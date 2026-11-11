import { describe, it, expect } from 'vitest';
import { AuthService } from '@/lib/services/auth.service';
import { verifyToken } from '@/lib/security/auth';
import { query } from '@/lib/database/db';

describe('Auth Service Integration Tests', () => {
  const testEmail = `testuser_${Date.now()}@ledgerline.test`;

  it('should successfully register a new user in PENDING status awaiting approval', async () => {
    const result = await AuthService.register({
      email: testEmail,
      password: 'StrongPassword@123',
      full_name: 'Integration Test User',
      phone: '+91-9999888877'
    });

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(testEmail.toLowerCase());
    expect(result.user.role).toBe('ACCOUNT_HOLDER');
    expect(result.user.status).toBe('PENDING');
    expect(result.pendingApproval).toBe(true);
  });

  it('should reject registration with duplicate email', async () => {
    await expect(
      AuthService.register({
        email: testEmail,
        password: 'AnotherPassword@123',
        full_name: 'Duplicate User'
      })
    ).rejects.toThrow(/already exists/);
  });

  it('should reject login while account is PENDING administrator approval', async () => {
    await expect(
      AuthService.login({
        email: testEmail,
        password: 'StrongPassword@123'
      })
    ).rejects.toThrow(/pending administrator approval/);
  });

  it('should successfully authenticate user once approved by administrator', async () => {
    // Simulate administrator approving user registration
    await query("UPDATE profiles SET status = 'ACTIVE' WHERE email = $1", [testEmail.toLowerCase()]);

    const loginRes = await AuthService.login({
      email: testEmail,
      password: 'StrongPassword@123'
    });

    expect(loginRes.user.email).toBe(testEmail.toLowerCase());
    expect(loginRes.user.status).toBe('ACTIVE');
    expect(loginRes.token).toBeDefined();

    const decoded = verifyToken(loginRes.token);
    expect(decoded?.userId).toBe(loginRes.user.id);
    expect(decoded?.email).toBe(testEmail.toLowerCase());
  });

  it('should reject login with wrong password and increment failed attempts', async () => {
    await expect(
      AuthService.login({
        email: testEmail,
        password: 'WrongPassword@123'
      })
    ).rejects.toThrow(/Invalid email or password/);

    const check = await query<{ failed_login_attempts: number }>(
      'SELECT failed_login_attempts FROM profiles WHERE email = $1',
      [testEmail.toLowerCase()]
    );
    expect(check.rows[0].failed_login_attempts).toBeGreaterThan(0);
  });
});

