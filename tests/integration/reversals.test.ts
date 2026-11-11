import { describe, it, expect } from 'vitest';
import { TransactionService } from '@/lib/services/transaction.service';
import { query } from '@/lib/database/db';

describe('Transaction Reversal Integration Tests', () => {
  let adminId: string;
  let aliceId: string;
  let bobId: string;
  let aliceAccId: string;
  let bobAccId: string;
  let testTxnId: string;

  it('setup transfer to be reversed', async () => {
    const admin = await query<{ id: string }>('SELECT id FROM profiles WHERE role = $1 LIMIT 1', ['ADMIN']);
    adminId = admin.rows[0].id;

    const alice = await query<{ id: string }>('SELECT id FROM profiles WHERE email = $1', ['alice@example.com']);
    aliceId = alice.rows[0].id;

    const bob = await query<{ id: string }>('SELECT id FROM profiles WHERE email = $1', ['bob@example.com']);
    bobId = bob.rows[0].id;

    const aliceAcc = await query<{ id: string }>('SELECT id FROM accounts WHERE user_id = $1 LIMIT 1', [aliceId]);
    aliceAccId = aliceAcc.rows[0].id;

    const bobAcc = await query<{ id: string }>('SELECT id FROM accounts WHERE user_id = $1 LIMIT 1', [bobId]);
    bobAccId = bobAcc.rows[0].id;

    // Ensure Alice has sufficient balance before transfer
    await TransactionService.deposit({
      accountId: aliceAccId,
      amountPaise: 500000,
      description: 'Fund Alice for reversal test'
    }, adminId);

    // Create a new transfer
    const transfer = await TransactionService.transfer({
      sourceAccountId: aliceAccId,
      destinationAccountId: bobAccId,
      amountPaise: 50000, // ₹500
      description: 'Transfer before reversal'
    }, aliceId, 'ACCOUNT_HOLDER');

    testTxnId = transfer.transaction_id;
  });

  it('should reverse the transfer and create compensating ledger entries', async () => {
    const aliceBefore = await query<{ balance_paise: string }>('SELECT balance_paise FROM accounts WHERE id = $1', [aliceAccId]);
    const bobBefore = await query<{ balance_paise: string }>('SELECT balance_paise FROM accounts WHERE id = $1', [bobAccId]);

    const result = await TransactionService.reverse(testTxnId, {
      reason: 'Customer dispute resolved: erroneous transfer'
    }, adminId);

    expect(result.status).toBe('COMPLETED');
    expect(result.reversal_reference_no).toMatch(/^REV-/);

    // Verify original transaction is marked REVERSED
    const orig = await query<{ status: string }>('SELECT status FROM transactions WHERE id = $1', [testTxnId]);
    expect(orig.rows[0].status).toBe('REVERSED');

    // Verify balances restored
    const aliceAfter = await query<{ balance_paise: string }>('SELECT balance_paise FROM accounts WHERE id = $1', [aliceAccId]);
    const bobAfter = await query<{ balance_paise: string }>('SELECT balance_paise FROM accounts WHERE id = $1', [bobAccId]);

    expect(BigInt(aliceAfter.rows[0].balance_paise)).toBe(BigInt(aliceBefore.rows[0].balance_paise) + 50000n);
    expect(BigInt(bobAfter.rows[0].balance_paise)).toBe(BigInt(bobBefore.rows[0].balance_paise) - 50000n);

    // Verify compensating ledger entries
    const ledger = await query<{ total: string }>(
      'SELECT COUNT(*) as total FROM ledger_entries WHERE transaction_id = $1',
      [result.reversal_transaction_id]
    );
    expect(parseInt(ledger.rows[0].total, 10)).toBe(2);
  });

  it('should reject second reversal attempt on the same transaction', async () => {
    await expect(
      TransactionService.reverse(testTxnId, { reason: 'Duplicate attempt' }, adminId)
    ).rejects.toThrow(/already been reversed/);
  });
});

