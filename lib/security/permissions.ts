import { UserRole } from '@/types/auth';

export type PermissionAction =
  | 'user:read'
  | 'user:create'
  | 'user:update'
  | 'user:change_role'
  | 'account:read_all'
  | 'account:read_own'
  | 'account:create'
  | 'account:freeze'
  | 'account:unfreeze'
  | 'transaction:deposit'
  | 'transaction:withdraw'
  | 'transaction:transfer'
  | 'transaction:reverse'
  | 'transaction:read_all'
  | 'transaction:read_own'
  | 'ledger:read'
  | 'audit:read'
  | 'security:read'
  | 'security:resolve'
  | 'integrity:verify'
  | 'reports:view';

const ROLE_PERMISSIONS: Record<UserRole, Set<PermissionAction>> = {
  ADMIN: new Set<PermissionAction>([
    'user:read',
    'user:create',
    'user:update',
    'user:change_role',
    'account:read_all',
    'account:read_own',
    'account:create',
    'account:freeze',
    'account:unfreeze',
    'transaction:deposit',
    'transaction:withdraw',
    'transaction:transfer',
    'transaction:reverse',
    'transaction:read_all',
    'transaction:read_own',
    'ledger:read',
    'audit:read',
    'security:read',
    'security:resolve',
    'integrity:verify',
    'reports:view'
  ]),

  AUDITOR: new Set<PermissionAction>([
    'user:read',
    'account:read_all',
    'transaction:read_all',
    'ledger:read',
    'audit:read',
    'security:read',
    'integrity:verify',
    'reports:view'
  ]),

  ACCOUNT_HOLDER: new Set<PermissionAction>([
    'account:read_own',
    'transaction:transfer',
    'transaction:withdraw',
    'transaction:read_own'
  ])
};

export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.has(action);
}

export function assertPermission(role: UserRole, action: PermissionAction): void {
  if (!hasPermission(role, action)) {
    throw new Error(`Forbidden: Role '${role}' lacks permission for '${action}'.`);
  }
}

