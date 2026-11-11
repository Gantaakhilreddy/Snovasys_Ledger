import { describe, it, expect } from 'vitest';
import { TransactionService } from '@/lib/services/transaction.service';
import { AccountService } from '@/lib/services/account.service';
import { query } from '@/lib/database/db';

describe('Transaction Service Integration Tests', () => {
  let aliceId: string;
  let bobId: string;
  let adminId: string;
  let aliceAccountId: string;
  let bobAccountId: string;

  it('setup accounts for transactions', async () => {
    const admin = await query<{ id: string }>('SELECT id FROM profiles WHERE role = $1 LIMIT 1', ['ADMIN']);
    adminId = admin.rows[0].id;

    const alice = await query<{ id: string }>('SELECT id FROM profiles WHERE email = $1', ['alice@example.com']);
    aliceId = alice.rows[0].id;

    const bob = await query<{ id: string }>('SELECT id FROM profiles WHERE email = $1', ['bob@example.com']);
    bobId = bob.rows[0].id;

    const aliceAcc = await query<{ id: string }>('SELECT id FROM accounts WHERE user_id = $1 LIMIT 1', [aliceId]);
    aliceAccountId = aliceAcc.rows[0].id;

    const bobAcc = await query<{ id: string }>('SELECT id FROM accounts WHERE user_id = $1 LIMIT 1', [bobId]);
    bobAccountId = bobAcc.rows[0].id;
  });

  it('should process authorized deposit to Alice account', async () => {
    const depositAmount = 250000; // ₹2,500

    const initial = await query<{ balance_paise: string }>(
      'SELECT balance_paise FROM accounts WHERE id = $1', [aliceAccountId]
    );
    const initialBalance = BigInt(initial.rows[0].balance_paise);

    const result = await TransactionService.deposit({
      accountId: aliceAccountId,
      amountPaise: depositAmount,
      description: 'Test Deposit'
    }, adminId);

    expect(result.status).toBe('COMPLETED');
    expect(result.amount_paise).toBe(depositAmount);

    const after = await query<{ balance_paise: string }>(
      'SELECT balance_paise FROM accounts WHERE id = $1', [aliceAccountId]
    );
    expect(BigInt(after.rows[0].balance_paise)).toBe(initialBalance + BigInt(depositAmount));
  });

  it('should transfer money from Alice to Bob atomically', async () => {
    const transferAmount = 100000; // ₹1,000

    const aliceBefore = await query<{ balance_paise: string }>('SELECT balance_paise FROM accounts WHERE id = $1', [aliceAccountId]);
    const bobBefore = await query<{ balance_paise: string }>('SELECT balance_paise FROM accounts WHERE id = $1', [bobAccountId]);

    const result = await TransactionService.transfer({
      sourceAccountId: aliceAccountId,
      destinationAccountId: bobAccountId,
      amountPaise: transferAmount,
      description: 'Alice to Bob Payment'
    }, aliceId, 'ACCOUNT_HOLDER');

    expect(result.status).toBe('COMPLETED');
    expect(result.reference_no).toMatch(/^TXN-/);

    const aliceAfter = await query<{ balance_paise: string }>('SELECT balance_paise FROM accounts WHERE id = $1', [aliceAccountId]);
    const bobAfter = await query<{ balance_paise: string }>('SELECT balance_paise FROM accounts WHERE id = $1', [bobAccountId]);

    expect(BigInt(aliceAfter.rows[0].balance_paise)).toBe(BigInt(aliceBefore.rows[0].balance_paise) - BigInt(transferAmount));
    expect(BigInt(bobAfter.rows[0].balance_paise)).toBe(BigInt(bobBefore.rows[0].balance_paise) + BigInt(transferAmount));
  });

  it('should reject transfer when available balance is insufficient', async () => {
    const excessiveAmount = 999999999999; // Huge amount

    await expect(
      TransactionService.transfer({
        sourceAccountId: aliceAccountId,
        destinationAccountId: bobAccountId,
        amountPaise: excessiveAmount
      }, aliceId, 'ACCOUNT_HOLDER')
    ).rejects.toThrow(/Insufficient balance/);
  });

  it('should prevent transfer if account is frozen', async () => {
    // Freeze Alice account temporarily
    await AccountService.freezeAccount(aliceAccountId, 'Security check', adminId);

    await expect(
      TransactionService.transfer({
        sourceAccountId: aliceAccountId,
        destinationAccountId: bobAccountId,
        amountPaise: 5000
      }, aliceId, 'ACCOUNT_HOLDER')
    ).rejects.toThrow(/frozen/);

    // Unfreeze
    await AccountService.unfreezeAccount(aliceAccountId, 'Cleared', adminId);
  });

  it('should reject self-transfer to same account', async () => {
    await expect(
      TransactionService.transfer({
        sourceAccountId: aliceAccountId,
        destinationAccountId: aliceAccountId,
        amountPaise: 5000
      }, aliceId, 'ACCOUNT_HOLDER')
    ).rejects.toThrow(/same account/);
  });
});

