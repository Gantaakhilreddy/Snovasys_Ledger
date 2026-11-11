import { query } from '@/lib/database/db';
import { generateAccountNumber } from '@/lib/utils/reference-generator';
import { paiseToRupees } from '@/lib/utils/currency';
import { AuditService } from './audit.service';
import { BankAccount, AccountType, AccountStatus } from '@/types/account';
import { UserRole } from '@/types/auth';

export class AccountService {
  static async createAccount(data: {
    userId: string;
    accountType?: AccountType;
    initialDepositPaise?: number;
    actorId: string;
  }): Promise<BankAccount> {
    const accountType = data.accountType || 'SAVINGS';
    let accountNumber = generateAccountNumber(accountType);

    // Verify uniqueness
    let attempts = 0;
    while (attempts < 5) {
      const check = await query('SELECT id FROM accounts WHERE account_number = $1', [accountNumber]);
      if (check.rows.length === 0) break;
      accountNumber = generateAccountNumber(accountType);
      attempts++;
    }

    const res = await query<BankAccount>(`
      INSERT INTO accounts (account_number, user_id, account_type, currency, balance_paise, status)
      VALUES ($1, $2, $3, 'INR', 0, 'ACTIVE')
      RETURNING id, account_number, user_id, account_type, currency, balance_paise,
                status, frozen_reason, frozen_at, created_at, updated_at;
    `, [accountNumber, data.userId, accountType]);

    const account = res.rows[0];
    account.balance_rupees = paiseToRupees(account.balance_paise);

    // If initial deposit requested, process via deposit procedure
    if (data.initialDepositPaise && data.initialDepositPaise > 0) {
      await query(`
        SELECT deposit_funds_atomic($1, $2, 'Initial Account Opening Deposit', $3);
      `, [account.id, data.initialDepositPaise, data.actorId]);

      // Refresh balance
      const updated = await query<{ balance_paise: string }>(
        'SELECT balance_paise FROM accounts WHERE id = $1', [account.id]
      );
      account.balance_paise = updated.rows[0].balance_paise;
      account.balance_rupees = paiseToRupees(account.balance_paise);
    }

    await AuditService.log({
      userId: data.actorId,
      action: 'ACCOUNT_CREATED',
      entityType: 'ACCOUNT',
      entityId: account.id,
      newData: {
        account_number: account.account_number,
        user_id: account.user_id,
        account_type: account.account_type,
        initial_balance_paise: account.balance_paise
      },
      status: 'SUCCESS'
    });

    // Notify user
    await query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ($1, 'Account Created', 'Your new ' || $2 || ' account (' || $3 || ') has been successfully created.', 'ACCOUNT');
    `, [data.userId, account.account_type, account.account_number]);

    return account;
  }

  static async listAccounts(
    userRole: UserRole,
    userId: string,
    filters: {
      ownerUserId?: string;
      status?: string;
      accountType?: string;
      search?: string;
      page: number;
      limit: number;
    }
  ): Promise<{ accounts: BankAccount[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    // Authorization filter
    if (userRole === 'ACCOUNT_HOLDER') {
      conditions.push(`a.user_id = $${pIdx++}`);
      params.push(userId);
    } else if (filters.ownerUserId) {
      conditions.push(`a.user_id = $${pIdx++}`);
      params.push(filters.ownerUserId);
    }

    if (filters.status) {
      conditions.push(`a.status = $${pIdx++}`);
      params.push(filters.status);
    }

    if (filters.accountType) {
      conditions.push(`a.account_type = $${pIdx++}`);
      params.push(filters.accountType);
    }

    if (filters.search) {
      conditions.push(`(a.account_number ILIKE $${pIdx} OR p.full_name ILIKE $${pIdx} OR p.email ILIKE $${pIdx})`);
      params.push(`%${filters.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(`
      SELECT COUNT(*) as count 
      FROM accounts a
      JOIN profiles p ON a.user_id = p.id
      ${whereClause};
    `, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const offset = (filters.page - 1) * filters.limit;
    params.push(filters.limit, offset);

    const dataRes = await query<BankAccount>(`
      SELECT 
        a.id, a.account_number, a.user_id, a.account_type, a.currency,
        a.balance_paise, a.status, a.frozen_reason, a.frozen_at,
        a.created_at, a.updated_at,
        p.full_name as owner_name, p.email as owner_email
      FROM accounts a
      JOIN profiles p ON a.user_id = p.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `, params);

    const accounts = dataRes.rows.map(acc => ({
      ...acc,
      balance_paise: Number(acc.balance_paise),
      available_balance_paise: Number(acc.balance_paise),
      balance_rupees: paiseToRupees(Number(acc.balance_paise))
    }));

    return { accounts, total };
  }

  static async getAccountById(
    accountId: string,
    userRole: UserRole,
    userId: string
  ): Promise<BankAccount | null> {
    const res = await query<BankAccount>(`
      SELECT 
        a.id, a.account_number, a.user_id, a.account_type, a.currency,
        a.balance_paise, a.status, a.frozen_reason, a.frozen_at,
        a.created_at, a.updated_at,
        p.full_name as owner_name, p.email as owner_email
      FROM accounts a
      JOIN profiles p ON a.user_id = p.id
      WHERE a.id::text = $1 OR a.account_number = $1;
    `, [accountId]);

    if (res.rows.length === 0) return null;
    const account = res.rows[0];

    // Enforce account ownership for ACCOUNT_HOLDER
    if (userRole === 'ACCOUNT_HOLDER' && account.user_id !== userId) {
      throw new Error('Forbidden: You do not have permission to access this account.');
    }

    account.balance_paise = Number(account.balance_paise) as any;
    (account as any).available_balance_paise = Number(account.balance_paise);
    account.balance_rupees = paiseToRupees(account.balance_paise);
    return account;
  }

  static async freezeAccount(
    accountId: string,
    reason: string,
    actorId: string
  ): Promise<BankAccount> {
    const current = await query<BankAccount>('SELECT * FROM accounts WHERE id = $1', [accountId]);
    if (current.rows.length === 0) throw new Error('Account not found.');
    const acc = current.rows[0];

    if (acc.status === 'FROZEN') {
      throw new Error('Account is already frozen.');
    }

    const res = await query<BankAccount>(`
      UPDATE accounts
      SET status = 'FROZEN', frozen_reason = $1, frozen_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `, [reason, accountId]);

    const updated = res.rows[0];

    await AuditService.log({
      userId: actorId,
      action: 'ACCOUNT_FROZEN',
      entityType: 'ACCOUNT',
      entityId: accountId,
      oldData: { status: acc.status },
      newData: { status: 'FROZEN', reason },
      status: 'SUCCESS'
    });

    await query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ($1, 'Account Frozen', 'Your account ' || $2 || ' has been frozen: ' || $3, 'SECURITY');
    `, [acc.user_id, acc.account_number, reason]);

    updated.balance_rupees = paiseToRupees(updated.balance_paise);
    return updated;
  }

  static async unfreezeAccount(
    accountId: string,
    reason: string | undefined,
    actorId: string
  ): Promise<BankAccount> {
    const current = await query<BankAccount>('SELECT * FROM accounts WHERE id = $1', [accountId]);
    if (current.rows.length === 0) throw new Error('Account not found.');
    const acc = current.rows[0];

    if (acc.status !== 'FROZEN') {
      throw new Error('Account is not frozen.');
    }

    const res = await query<BankAccount>(`
      UPDATE accounts
      SET status = 'ACTIVE', frozen_reason = NULL, frozen_at = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `, [accountId]);

    const updated = res.rows[0];

    await AuditService.log({
      userId: actorId,
      action: 'ACCOUNT_UNFROZEN',
      entityType: 'ACCOUNT',
      entityId: accountId,
      oldData: { status: 'FROZEN', reason: acc.frozen_reason },
      newData: { status: 'ACTIVE', unfreeze_reason: reason },
      status: 'SUCCESS'
    });

    await query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ($1, 'Account Unfrozen', 'Your account ' || $2 || ' is now active and ready for transactions.', 'SECURITY');
    `, [acc.user_id, acc.account_number]);

    updated.balance_rupees = paiseToRupees(updated.balance_paise);
    return updated;
  }
}

