import { NextRequest } from 'next/server';
import { extractAuthToken, verifyToken } from '@/lib/security/auth';
import { query } from '@/lib/database/db';
import { AuthTokenPayload, UserProfile, UserRole } from '@/types/auth';

export interface AuthenticatedContext {
  user: UserProfile;
  tokenPayload: AuthTokenPayload;
}

export async function authenticateRequest(req: NextRequest): Promise<AuthenticatedContext> {
  const token = extractAuthToken(req);
  if (!token) {
    throw new Error('Unauthorized: Authentication token is missing');
  }

  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    throw new Error('Unauthorized: Invalid or expired authentication token');
  }

  // Fetch current user record from database
  const res = await query<UserProfile>(`
    SELECT id, email, full_name, phone, role, status, failed_login_attempts,
           locked_until, last_login_at, metadata, created_at, updated_at
    FROM profiles
    WHERE id = $1;
  `, [payload.userId]);

  if (res.rows.length === 0) {
    throw new Error('Unauthorized: User profile no longer exists');
  }

  const user = res.rows[0];

  if (user.status === 'PENDING' || user.status === 'PENDING_APPROVAL') {
    throw new Error('Forbidden: User account is pending administrator approval');
  }

  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    throw new Error(`Forbidden: User account is ${user.status.toLowerCase()}`);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new Error(`Forbidden: Account is temporarily locked until ${new Date(user.locked_until).toISOString()}`);
  }

  return { user, tokenPayload: payload };
}

export async function authorizeRoles(req: NextRequest, allowedRoles: UserRole[]): Promise<AuthenticatedContext> {
  const auth = await authenticateRequest(req);
  if (!allowedRoles.includes(auth.user.role)) {
    throw new Error(`Forbidden: Insufficient permissions. Role '${auth.user.role}' is not authorized for this endpoint.`);
  }
  return auth;
}

