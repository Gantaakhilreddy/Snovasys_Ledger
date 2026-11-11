import { describe, it, expect } from 'vitest';
import { AccountService } from '@/lib/services/account.service';
import { TransactionService } from '@/lib/services/transaction.service';
import { query } from '@/lib/database/db';

describe('RLS & Access Restriction Tests', () => {
  let aliceId: string;
  let bobId: string;
  let bobAccId: string;

  it('setup profiles and accounts', async () => {
    const alice = await query<{ id: string }>('SELECT id FROM profiles WHERE email = $1', ['alice@example.com']);
    aliceId = alice.rows[0].id;

    const bob = await query<{ id: string }>('SELECT id FROM profiles WHERE email = $1', ['bob@example.com']);
    bobId = bob.rows[0].id;

    const bobAcc = await query<{ id: string }>('SELECT id FROM accounts WHERE user_id = $1 LIMIT 1', [bobId]);
    bobAccId = bobAcc.rows[0].id;
  });

  it('should block Account Holder Alice from viewing Bob account details', async () => {
    await expect(
      AccountService.getAccountById(bobAccId, 'ACCOUNT_HOLDER', aliceId)
    ).rejects.toThrow(/Forbidden/);
  });

  it('should block Account Holder Alice from transferring funds out of Bob account', async () => {
    await expect(
      TransactionService.transfer({
        sourceAccountId: bobAccId,
        destinationAccountId: bobAccId, // invalid anyway, but ownership check fires first
        amountPaise: 1000
      }, aliceId, 'ACCOUNT_HOLDER')
    ).rejects.toThrow(/Forbidden/);
  });

  it('should block Auditor from initiating a deposit or transfer', async () => {
    const auditor = await query<{ id: string }>('SELECT id FROM profiles WHERE role = $1 LIMIT 1', ['AUDITOR']);
    const auditorId = auditor.rows[0].id;

    await expect(
      TransactionService.transfer({
        sourceAccountId: bobAccId,
        destinationAccountId: bobAccId,
        amountPaise: 1000
      }, auditorId, 'ACCOUNT_HOLDER') // using account holder role check
    ).rejects.toThrow(/Forbidden/);
  });
});

