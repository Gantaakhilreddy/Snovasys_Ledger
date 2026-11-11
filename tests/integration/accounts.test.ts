import { describe, it, expect } from 'vitest';
import { AccountService } from '@/lib/services/account.service';
import { query } from '@/lib/database/db';

describe('Account Service Integration Tests', () => {
  let testUserId: string;
  let adminId: string;
  let createdAccountId: string;

  it('setup user and admin', async () => {
    const adminRes = await query<{ id: string }>('SELECT id FROM profiles WHERE role = $1 LIMIT 1', ['ADMIN']);
    adminId = adminRes.rows[0].id;

    const userRes = await query<{ id: string }>(
      'SELECT id FROM profiles WHERE email = $1',
      ['alice@example.com']
    );
    testUserId = userRes.rows[0].id;
  });

  it('should create a new savings account with unique account number', async () => {
    const account = await AccountService.createAccount({
      userId: testUserId,
      accountType: 'SAVINGS',
      actorId: adminId
    });

    expect(account).toBeDefined();
    expect(account.account_number).toMatch(/^LL-SAV-\d{8}$/);
    expect(account.status).toBe('ACTIVE');
    expect(Number(account.balance_paise)).toBe(0);

    createdAccountId = account.id;
  });

  it('should freeze account with reason by admin', async () => {
    const frozen = await AccountService.freezeAccount(
      createdAccountId,
      'Suspicious activity investigation',
      adminId
    );

    expect(frozen.status).toBe('FROZEN');
    expect(frozen.frozen_reason).toBe('Suspicious activity investigation');
    expect(frozen.frozen_at).toBeDefined();
  });

  it('should unfreeze account by admin', async () => {
    const unfrozen = await AccountService.unfreezeAccount(
      createdAccountId,
      'Investigation cleared',
      adminId
    );

    expect(unfrozen.status).toBe('ACTIVE');
    expect(unfrozen.frozen_reason).toBeNull();
  });
});

