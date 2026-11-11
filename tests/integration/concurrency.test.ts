import { describe, it, expect } from 'vitest';
import { TransactionService } from '@/lib/services/transaction.service';
import { AccountService } from '@/lib/services/account.service';
import { query } from '@/lib/database/db';

describe('Concurrency & Race Condition Tests', () => {
  let adminId: string;
  let senderAccountId: string;
  let receiverAccountId: string;
  const initialBalance = 100000; // ₹1,000 (100,000 paise)

  it('setup dedicated accounts for concurrency testing', async () => {
    const admin = await query<{ id: string }>('SELECT id FROM profiles WHERE role = $1 LIMIT 1', ['ADMIN']);
    adminId = admin.rows[0].id;

    // Create sender with exactly ₹1,000
    const sender = await AccountService.createAccount({
      userId: adminId,
      accountType: 'CHECKING',
      initialDepositPaise: initialBalance,
      actorId: adminId
    });
    senderAccountId = sender.id;

    // Create receiver
    const receiver = await AccountService.createAccount({
      userId: adminId,
      accountType: 'SAVINGS',
      initialDepositPaise: 0,
      actorId: adminId
    });
    receiverAccountId = receiver.id;
  });

  it('should handle simultaneous concurrent transfers safely without race conditions or negative balance', async () => {
    // Attempt 5 simultaneous transfers of ₹300 (30,000 paise) each.
    // Total requested: 150,000 paise, but account only has 100,000 paise!
    // Exactly 3 transfers should succeed (90,000 paise deducted), and 2 should fail due to insufficient balance.
    const transferAmount = 30000;
    const transferPromises = Array.from({ length: 5 }, (_, i) =>
      TransactionService.transfer({
        sourceAccountId: senderAccountId,
        destinationAccountId: receiverAccountId,
        amountPaise: transferAmount,
        description: `Concurrent transfer attempt #${i + 1}`
      }, adminId, 'ADMIN')
        .then(res => ({ success: true, res }))
        .catch(err => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(transferPromises);

    const succeeded = results.filter((r): r is { success: true; res: any } => r.success);
    const failed = results.filter((r): r is { success: false; error: any } => !r.success);

    // Exactly 3 must succeed, 2 must fail
    expect(succeeded.length).toBe(3);
    expect(failed.length).toBe(2);

    // Verify all failures were due to insufficient balance
    for (const f of failed) {
      expect(f.error).toMatch(/Insufficient balance/i);
    }

    // Verify final balances
    const senderAcc = await query<{ balance_paise: string }>(
      'SELECT balance_paise FROM accounts WHERE id = $1', [senderAccountId]
    );
    const receiverAcc = await query<{ balance_paise: string }>(
      'SELECT balance_paise FROM accounts WHERE id = $1', [receiverAccountId]
    );

    expect(BigInt(senderAcc.rows[0].balance_paise)).toBe(10000n); // 100000 - 90000 = 10000 paise (₹100)
    expect(BigInt(receiverAcc.rows[0].balance_paise)).toBe(90000n); // exactly 90,000 paise received
  });
});
