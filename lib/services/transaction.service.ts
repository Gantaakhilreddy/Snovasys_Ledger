import { query } from '@/lib/database/db';
import { generateTransactionReference } from '@/lib/utils/reference-generator';
import { paiseToRupees } from '@/lib/utils/currency';
import { checkTransferVelocityAnomaly } from '@/lib/security/anomaly-detector';
import { AuditService } from './audit.service';
import {
  FinancialTransaction,
  TransferRequestInput,
  DepositRequestInput,
  WithdrawalRequestInput,
  ReversalRequestInput
} from '@/types/transaction';
import { UserRole } from '@/types/auth';

export class TransactionService {
  static async transfer(
    input: TransferRequestInput,
    actorId: string,
    actorRole: UserRole
  ): Promise<any> {
    // 1. Verify source account ownership if ACCOUNT_HOLDER
    const sourceAccRes = await query<{ id: string; user_id: string; status: string; balance_paise: string; account_number: string }>(
      'SELECT id, user_id, status, balance_paise, account_number FROM accounts WHERE id::text = $1 OR account_number = $1',
      [input.sourceAccountId]
    );

    if (sourceAccRes.rows.length === 0) {
      throw new Error('Source account not found.');
    }

    const sourceAcc = sourceAccRes.rows[0];
    const sourceAccountId = sourceAcc.id;

    if (actorRole === 'ACCOUNT_HOLDER' && sourceAcc.user_id !== actorId) {
      throw new Error('Forbidden: You can only transfer funds from your own accounts.');
    }

    if (sourceAcc.status === 'FROZEN') {
      throw new Error('Transfer rejected: Source account is frozen.');
    }

    if (BigInt(sourceAcc.balance_paise) < BigInt(input.amountPaise)) {
      const avail = (Number(sourceAcc.balance_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const req = (Number(input.amountPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      throw new Error(`Insufficient balance: Available balance is ₹${avail}, but ₹${req} was requested.`);
    }

    // 2. Resolve destination account
    const destLookup = (input.destinationAccountNumber || input.destinationAccountId || '').trim();
    if (!destLookup) {
      throw new Error('Destination account identifier or account number is required.');
    }

    const destAccRes = await query<{ id: string; status: string; account_number: string }>(
      'SELECT id, status, account_number FROM accounts WHERE account_number = $1 OR id::text = $1',
      [destLookup]
    );
    if (destAccRes.rows.length === 0) {
      throw new Error(`Destination account '${destLookup}' not found. Please verify the account number.`);
    }

    const destAcc = destAccRes.rows[0];
    const destAccountId = destAcc.id;

    if (sourceAccountId === destAccountId) {
      throw new Error('Transfer rejected: Cannot transfer funds to the same account.');
    }

    if (destAcc.status === 'FROZEN') {
      throw new Error('Transfer rejected: Destination account is currently frozen.');
    }

    const refNo = generateTransactionReference('TXN');

    // 3. Execute atomic transfer in single DB transaction
    const res = await query<{ transfer_funds_atomic: any }>(`
      SELECT transfer_funds_atomic($1, $2, $3, $4, $5, $6, $7, $8) AS transfer_funds_atomic;
    `, [
      sourceAccountId,
      destAccountId,
      input.amountPaise,
      0, // fee_paise
      input.description || 'Transfer',
      actorId,
      refNo,
      JSON.stringify({ idempotencyKey: input.idempotencyKey || null })
    ]);

    const result = res.rows[0].transfer_funds_atomic;

    // 4. Run advisory security anomaly check (background)
    checkTransferVelocityAnomaly(actorId, sourceAccountId, input.amountPaise).catch(console.error);

    // 5. Notifications
    const accountsData = await query<{ id: string; user_id: string; account_number: string }>(
      'SELECT id, user_id, account_number FROM accounts WHERE id IN ($1, $2)',
      [sourceAccountId, destAccountId]
    );

    for (const acc of accountsData.rows) {
      if (acc.id === sourceAccountId) {
        await query(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES ($1, 'Debit Alert', '₹' || $2 || ' transferred from ' || $3 || ' (Ref: ' || $4 || ')', 'TRANSACTION');
        `, [acc.user_id, (input.amountPaise / 100).toFixed(2), acc.account_number, refNo]);
      } else {
        await query(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES ($1, 'Credit Alert', '₹' || $2 || ' received into ' || $3 || ' (Ref: ' || $4 || ')', 'TRANSACTION');
        `, [acc.user_id, (input.amountPaise / 100).toFixed(2), acc.account_number, refNo]);
      }
    }

    return result;
  }

  static async requestDeposit(
    input: DepositRequestInput,
    userId: string
  ): Promise<any> {
    const accRes = await query<{ id: string; user_id: string; status: string; account_number: string }>(
      'SELECT id, user_id, status, account_number FROM accounts WHERE id::text = $1 OR account_number = $1',
      [input.accountId]
    );

    if (accRes.rows.length === 0) {
      throw new Error('Account not found.');
    }

    const acc = accRes.rows[0];
    if (acc.user_id !== userId) {
      throw new Error('Forbidden: You can only request deposit into your own accounts.');
    }

    if (acc.status === 'FROZEN') {
      throw new Error('Cannot deposit to a frozen account.');
    }

    const refNo = generateTransactionReference('DEP');

    const res = await query(
      `INSERT INTO transactions (
        reference_no, type, amount_paise, fee_paise, status,
        destination_account_id, description, metadata, created_by
       ) VALUES (
        $1, 'DEPOSIT', $2, 0, 'PENDING',
        $3, $4, $5, $6
       ) RETURNING *`,
      [
        refNo,
        input.amountPaise,
        acc.id,
        input.description || 'Deposit Request (Pending Approval)',
        JSON.stringify({ requested_by: userId, requested_at: new Date().toISOString() }),
        userId
      ]
    );

    const txn = res.rows[0];

    // Notification to user
    await query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Deposit Request Submitted', 'Your deposit request for ₹' || $2 || ' into account ' || $3 || ' is pending admin approval (Ref: ' || $4 || ').', 'TRANSACTION')`,
      [userId, (input.amountPaise / 100).toFixed(2), acc.account_number, refNo]
    );

    await AuditService.log({
      userId,
      action: 'DEPOSIT_REQUEST_SUBMITTED',
      entityType: 'TRANSACTION',
      entityId: txn.id,
      newData: {
        reference_no: refNo,
        account_id: acc.id,
        amount_paise: input.amountPaise
      },
      status: 'SUCCESS'
    });

    return {
      id: txn.id,
      reference_number: txn.reference_no,
      amount_paise: Number(txn.amount_paise),
      status: 'PENDING',
      destination_account_id: acc.id,
      account_number: acc.account_number,
      description: txn.description,
      created_at: txn.created_at
    };
  }

  static async approveDeposit(
    transactionId: string,
    adminId: string
  ): Promise<any> {
    const txRes = await query<{
      id: string;
      reference_no: string;
      amount_paise: string;
      destination_account_id: string;
      created_by: string;
      description: string;
      status: string;
    }>(
      `SELECT id, reference_no, amount_paise, destination_account_id, created_by, description, status 
       FROM transactions 
       WHERE id = $1 AND type = 'DEPOSIT' FOR UPDATE`,
      [transactionId]
    );

    if (txRes.rows.length === 0) {
      throw new Error('Deposit transaction not found.');
    }

    const txn = txRes.rows[0];
    if (txn.status !== 'PENDING') {
      throw new Error(`Deposit transaction cannot be approved because its current status is '${txn.status}'.`);
    }

    const amountPaise = BigInt(txn.amount_paise);
    const targetAccountId = txn.destination_account_id;

    // Get or create system reserve
    const resReserve = await query<{ id: string; balance_paise: string }>(
      `SELECT id, balance_paise FROM accounts WHERE account_type = 'SYSTEM_RESERVE' LIMIT 1`
    );
    let reserveId = resReserve.rows[0]?.id;
    if (!reserveId) {
      const sysRes = await query<{ get_or_create_system_reserve_account: string }>(
        `SELECT get_or_create_system_reserve_account() AS get_or_create_system_reserve_account`
      );
      reserveId = sysRes.rows[0].get_or_create_system_reserve_account;
    }

    // Deterministic locking
    const firstLock = targetAccountId < reserveId ? targetAccountId : reserveId;
    const secondLock = targetAccountId < reserveId ? reserveId : targetAccountId;
    await query('SELECT 1 FROM accounts WHERE id = $1 FOR UPDATE', [firstLock]);
    await query('SELECT 1 FROM accounts WHERE id = $1 FOR UPDATE', [secondLock]);

    const targetAccRes = await query<{ id: string; balance_paise: string; status: string; account_number: string; user_id: string }>(
      'SELECT id, balance_paise, status, account_number, user_id FROM accounts WHERE id = $1',
      [targetAccountId]
    );
    if (targetAccRes.rows.length === 0) {
      throw new Error('Destination account no longer exists.');
    }
    const targetAcc = targetAccRes.rows[0];
    if (targetAcc.status !== 'ACTIVE') {
      throw new Error(`Cannot deposit to account with status '${targetAcc.status}'.`);
    }

    const newTargetBalance = BigInt(targetAcc.balance_paise) + amountPaise;
    await query(
      'UPDATE accounts SET balance_paise = $1, updated_at = NOW() WHERE id = $2',
      [newTargetBalance.toString(), targetAccountId]
    );

    const updateReserveRes = await query<{ balance_paise: string }>(
      'UPDATE accounts SET balance_paise = balance_paise + $1, updated_at = NOW() WHERE id = $2 RETURNING balance_paise',
      [amountPaise.toString(), reserveId]
    );
    const newReserveBalance = updateReserveRes.rows[0].balance_paise;

    const updatedTxRes = await query(
      `UPDATE transactions 
       SET status = 'COMPLETED',
           source_account_id = $1,
           completed_at = NOW(),
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('approved_by', $2::text, 'approved_at', NOW())
       WHERE id = $3
       RETURNING *`,
      [reserveId, adminId, transactionId]
    );

    // Balanced double-entry
    await query(
      `INSERT INTO ledger_entries (
        transaction_id, account_id, entry_type, amount_paise, balance_after_paise, description
       ) VALUES 
       ($1, $2, 'DEBIT', $3, $4, 'Reserve deposit backing for ' || $5),
       ($1, $6, 'CREDIT', $3, $7, $8)`,
      [
        transactionId,
        reserveId,
        amountPaise.toString(),
        newReserveBalance,
        targetAcc.account_number,
        targetAccountId,
        newTargetBalance.toString(),
        txn.description || 'Approved Customer Deposit'
      ]
    );

    await AuditService.log({
      userId: adminId,
      action: 'DEPOSIT_APPROVED',
      entityType: 'TRANSACTION',
      entityId: transactionId,
      newData: {
        reference_no: txn.reference_no,
        target_account_id: targetAccountId,
        amount_paise: txn.amount_paise,
        approved_by: adminId
      },
      status: 'SUCCESS'
    });

    const amountRupees = (Number(amountPaise) / 100).toFixed(2);
    await query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Deposit Approved & Credited', 'Your deposit of ₹' || $2 || ' into account ' || $3 || ' has been approved by administration (Ref: ' || $4 || ').', 'TRANSACTION')`,
      [targetAcc.user_id, amountRupees, targetAcc.account_number, txn.reference_no]
    );

    return updatedTxRes.rows[0];
  }

  static async rejectDeposit(
    transactionId: string,
    reason: string,
    adminId: string
  ): Promise<any> {
    const txRes = await query<{
      id: string;
      reference_no: string;
      amount_paise: string;
      destination_account_id: string;
      status: string;
    }>(
      `SELECT id, reference_no, amount_paise, destination_account_id, status 
       FROM transactions 
       WHERE id = $1 AND type = 'DEPOSIT' FOR UPDATE`,
      [transactionId]
    );

    if (txRes.rows.length === 0) {
      throw new Error('Deposit transaction not found.');
    }

    const txn = txRes.rows[0];
    if (txn.status !== 'PENDING') {
      throw new Error(`Deposit transaction cannot be rejected because its current status is '${txn.status}'.`);
    }

    const updatedRes = await query(
      `UPDATE transactions 
       SET status = 'FAILED',
           failure_reason = $1,
           completed_at = NOW(),
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('rejected_by', $2::text, 'rejected_at', NOW(), 'rejection_reason', $1)
       WHERE id = $3
       RETURNING *`,
      [reason || 'Rejected by Administrator', adminId, transactionId]
    );

    const targetAcc = await query<{ user_id: string; account_number: string }>(
      'SELECT user_id, account_number FROM accounts WHERE id = $1',
      [txn.destination_account_id]
    );
    if (targetAcc.rows.length > 0) {
      const amountRupees = (Number(txn.amount_paise) / 100).toFixed(2);
      await query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, 'Deposit Request Declined', 'Your deposit request for ₹' || $2 || ' into account ' || $3 || ' was declined: ' || $4, 'TRANSACTION')`,
        [targetAcc.rows[0].user_id, amountRupees, targetAcc.rows[0].account_number, reason || 'Administrative policy check']
      );
    }

    await AuditService.log({
      userId: adminId,
      action: 'DEPOSIT_REJECTED',
      entityType: 'TRANSACTION',
      entityId: transactionId,
      newData: {
        reference_no: txn.reference_no,
        rejection_reason: reason,
        rejected_by: adminId
      },
      status: 'SUCCESS'
    });

    return updatedRes.rows[0];
  }

  static async deposit(
    input: DepositRequestInput,
    actorId: string
  ): Promise<any> {
    const acc = await query<{ id: string; user_id: string; account_number: string }>(
      'SELECT id, user_id, account_number FROM accounts WHERE id::text = $1 OR account_number = $1',
      [input.accountId]
    );
    if (acc.rows.length === 0) {
      throw new Error('Account not found.');
    }
    const resolvedAccountId = acc.rows[0].id;

    const refNo = generateTransactionReference('DEP');

    const res = await query<{ deposit_funds_atomic: any }>(`
      SELECT deposit_funds_atomic($1, $2, $3, $4, $5, $6) AS deposit_funds_atomic;
    `, [
      resolvedAccountId,
      input.amountPaise,
      input.description || 'Deposit',
      actorId,
      refNo,
      JSON.stringify({ idempotencyKey: input.idempotencyKey || null })
    ]);

    const result = res.rows[0].deposit_funds_atomic;

    // Notification to account owner
    await query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ($1, 'Deposit Successful', '₹' || $2 || ' deposited to ' || $3 || ' (Ref: ' || $4 || ')', 'TRANSACTION');
    `, [acc.rows[0].user_id, (input.amountPaise / 100).toFixed(2), acc.rows[0].account_number, refNo]);

    return result;
  }

  static async withdraw(
    input: WithdrawalRequestInput,
    actorId: string,
    actorRole: UserRole
  ): Promise<any> {
    const accRes = await query<{ id: string; user_id: string; status: string; balance_paise: string; account_number: string }>(
      'SELECT id, user_id, status, balance_paise, account_number FROM accounts WHERE id::text = $1 OR account_number = $1',
      [input.accountId]
    );

    if (accRes.rows.length === 0) throw new Error('Account not found.');
    const acc = accRes.rows[0];
    const resolvedAccountId = acc.id;

    if (actorRole === 'ACCOUNT_HOLDER' && acc.user_id !== actorId) {
      throw new Error('Forbidden: You can only withdraw from your own account.');
    }

    if (acc.status === 'FROZEN') {
      throw new Error('Withdrawal rejected: Account is frozen.');
    }

    if (BigInt(acc.balance_paise) < BigInt(input.amountPaise)) {
      const avail = (Number(acc.balance_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const req = (Number(input.amountPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      throw new Error(`Insufficient funds: Available balance is ₹${avail}, but ₹${req} was requested.`);
    }

    const refNo = generateTransactionReference('WTH');

    const res = await query<{ withdraw_funds_atomic: any }>(`
      SELECT withdraw_funds_atomic($1, $2, $3, $4, $5, $6) AS withdraw_funds_atomic;
    `, [
      resolvedAccountId,
      input.amountPaise,
      input.description || 'Withdrawal',
      actorId,
      refNo,
      JSON.stringify({ idempotencyKey: input.idempotencyKey || null })
    ]);

    const result = res.rows[0].withdraw_funds_atomic;

    await query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ($1, 'Withdrawal Alert', '₹' || $2 || ' withdrawn from ' || $3 || ' (Ref: ' || $4 || ')', 'TRANSACTION');
    `, [acc.user_id, (input.amountPaise / 100).toFixed(2), acc.account_number, refNo]);

    return result;
  }

  static async reverse(
    transactionId: string,
    input: ReversalRequestInput,
    actorId: string
  ): Promise<any> {
    const refNo = generateTransactionReference('REV');

    const res = await query<{ reverse_transaction_atomic: any }>(`
      SELECT reverse_transaction_atomic($1, $2, $3, $4) AS reverse_transaction_atomic;
    `, [transactionId, input.reason, actorId, refNo]);

    return res.rows[0].reverse_transaction_atomic;
  }

  static async listTransactions(
    userRole: UserRole,
    userId: string,
    filters: {
      accountId?: string;
      type?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page: number;
      limit: number;
    }
  ): Promise<{ transactions: FinancialTransaction[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    // Role-based visibility
    if (userRole === 'ACCOUNT_HOLDER') {
      conditions.push(`(
        t.created_by = $${pIdx} OR 
        t.source_account_id IN (SELECT id FROM accounts WHERE user_id = $${pIdx}) OR
        t.destination_account_id IN (SELECT id FROM accounts WHERE user_id = $${pIdx})
      )`);
      params.push(userId);
      pIdx++;
    }

    if (filters.accountId) {
      conditions.push(`(
        t.source_account_id::text = $${pIdx} OR 
        t.destination_account_id::text = $${pIdx} OR 
        t.source_account_id IN (SELECT id FROM accounts WHERE account_number = $${pIdx}) OR 
        t.destination_account_id IN (SELECT id FROM accounts WHERE account_number = $${pIdx})
      )`);
      params.push(filters.accountId);
      pIdx++;
    }

    if (filters.type) {
      conditions.push(`t.type = $${pIdx++}`);
      params.push(filters.type);
    }

    if (filters.status) {
      conditions.push(`t.status = $${pIdx++}`);
      params.push(filters.status);
    }

    if (filters.startDate) {
      conditions.push(`t.created_at >= $${pIdx++}`);
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`t.created_at <= $${pIdx++}`);
      params.push(filters.endDate);
    }

    if (filters.search) {
      conditions.push(`(t.reference_no ILIKE $${pIdx} OR t.description ILIKE $${pIdx})`);
      params.push(`%${filters.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(`
      SELECT COUNT(*) as count 
      FROM transactions t
      ${whereClause};
    `, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const offset = (filters.page - 1) * filters.limit;
    params.push(filters.limit, offset);

    const dataRes = await query<FinancialTransaction>(`
      SELECT 
        t.id, t.reference_no, t.type, t.amount_paise, t.fee_paise,
        t.status, t.source_account_id, t.destination_account_id,
        t.description, t.failure_reason, t.metadata, t.created_by,
        t.created_at, t.completed_at,
        sa.account_number as source_account_number,
        da.account_number as destination_account_number,
        p.full_name as creator_name
      FROM transactions t
      LEFT JOIN accounts sa ON t.source_account_id = sa.id
      LEFT JOIN accounts da ON t.destination_account_id = da.id
      LEFT JOIN profiles p ON t.created_by = p.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `, params);

    const transactions = dataRes.rows.map(txn => ({
      ...txn,
      reference_number: txn.reference_no,
      transaction_type: txn.type,
      amount_paise: Number(txn.amount_paise),
      fee_paise: Number(txn.fee_paise || 0),
      amount_rupees: paiseToRupees(Number(txn.amount_paise))
    }));

    return { transactions, total };
  }

  static async getTransactionById(
    transactionId: string,
    userRole: UserRole,
    userId: string
  ): Promise<any | null> {
    const res = await query<FinancialTransaction>(`
      SELECT 
        t.id, t.reference_no, t.type, t.amount_paise, t.fee_paise,
        t.status, t.source_account_id, t.destination_account_id,
        t.description, t.failure_reason, t.metadata, t.created_by,
        t.created_at, t.completed_at,
        sa.account_number as source_account_number,
        da.account_number as destination_account_number,
        p.full_name as creator_name
      FROM transactions t
      LEFT JOIN accounts sa ON t.source_account_id = sa.id
      LEFT JOIN accounts da ON t.destination_account_id = da.id
      LEFT JOIN profiles p ON t.created_by = p.id
      WHERE t.id = $1;
    `, [transactionId]);

    if (res.rows.length === 0) return null;
    const txn = res.rows[0];

    // Authorization check
    if (userRole === 'ACCOUNT_HOLDER') {
      const allowed = await query<{ count: string }>(`
        SELECT COUNT(*) as count FROM accounts
        WHERE user_id = $1 AND id IN ($2, $3);
      `, [userId, txn.source_account_id, txn.destination_account_id]);

      if (parseInt(allowed.rows[0]?.count || '0', 10) === 0 && txn.created_by !== userId) {
        throw new Error('Forbidden: You do not have permission to view this transaction.');
      }
    }

    const mappedTxn = {
      ...txn,
      reference_number: txn.reference_no,
      transaction_type: txn.type,
      amount_paise: Number(txn.amount_paise),
      fee_paise: Number(txn.fee_paise || 0),
      amount_rupees: paiseToRupees(Number(txn.amount_paise))
    };

    // Fetch corresponding balanced double-entry ledger entries
    const ledgerRes = await query(`
      SELECT 
        le.id, le.account_id, le.entry_type, le.amount_paise,
        le.balance_after_paise, le.description, le.created_at,
        a.account_number
      FROM ledger_entries le
      JOIN accounts a ON le.account_id = a.id
      WHERE le.transaction_id = $1
      ORDER BY le.created_at ASC;
    `, [transactionId]);

    return {
      transaction: mappedTxn,
      ledgerEntries: ledgerRes.rows.map(entry => ({
        ...entry,
        amount_paise: Number(entry.amount_paise),
        balance_after_paise: Number(entry.balance_after_paise),
        amount_rupees: paiseToRupees(Number(entry.amount_paise)),
        balance_after_rupees: paiseToRupees(Number(entry.balance_after_paise))
      }))
    };
  }
}

