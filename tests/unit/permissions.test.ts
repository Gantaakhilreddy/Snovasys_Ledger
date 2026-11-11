import { describe, it, expect } from 'vitest';
import { hasPermission, assertPermission } from '@/lib/security/permissions';

describe('Role-Based Permissions Matrix', () => {
  it('ADMIN should have permissions for all core financial and management operations', () => {
    expect(hasPermission('ADMIN', 'user:create')).toBe(true);
    expect(hasPermission('ADMIN', 'account:freeze')).toBe(true);
    expect(hasPermission('ADMIN', 'transaction:deposit')).toBe(true);
    expect(hasPermission('ADMIN', 'transaction:reverse')).toBe(true);
    expect(hasPermission('ADMIN', 'security:resolve')).toBe(true);
    expect(hasPermission('ADMIN', 'integrity:verify')).toBe(true);
  });

  it('AUDITOR should have read-only access and strictly NO financial modification permissions', () => {
    expect(hasPermission('AUDITOR', 'transaction:read_all')).toBe(true);
    expect(hasPermission('AUDITOR', 'audit:read')).toBe(true);
    expect(hasPermission('AUDITOR', 'integrity:verify')).toBe(true);

    // Forbidden modifications
    expect(hasPermission('AUDITOR', 'transaction:transfer')).toBe(false);
    expect(hasPermission('AUDITOR', 'transaction:deposit')).toBe(false);
    expect(hasPermission('AUDITOR', 'transaction:reverse')).toBe(false);
    expect(hasPermission('AUDITOR', 'account:freeze')).toBe(false);
  });

  it('ACCOUNT_HOLDER should only have permissions on own accounts and transfers', () => {
    expect(hasPermission('ACCOUNT_HOLDER', 'account:read_own')).toBe(true);
    expect(hasPermission('ACCOUNT_HOLDER', 'transaction:transfer')).toBe(true);
    expect(hasPermission('ACCOUNT_HOLDER', 'transaction:read_own')).toBe(true);

    // Forbidden administrative actions
    expect(hasPermission('ACCOUNT_HOLDER', 'account:read_all')).toBe(false);
    expect(hasPermission('ACCOUNT_HOLDER', 'account:freeze')).toBe(false);
    expect(hasPermission('ACCOUNT_HOLDER', 'transaction:reverse')).toBe(false);
    expect(hasPermission('ACCOUNT_HOLDER', 'audit:read')).toBe(false);
  });

  it('assertPermission should throw for unauthorized role', () => {
    expect(() => assertPermission('ACCOUNT_HOLDER', 'account:freeze')).toThrow(/Forbidden/);
    expect(() => assertPermission('AUDITOR', 'transaction:deposit')).toThrow(/Forbidden/);
    expect(() => assertPermission('ADMIN', 'transaction:deposit')).not.toThrow();
  });
});

