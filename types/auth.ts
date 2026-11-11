export type UserRole = 'ADMIN' | 'ACCOUNT_HOLDER' | 'AUDITOR';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'DEACTIVATED';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  failed_login_attempts: number;
  locked_until?: string | null;
  last_login_at?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  user: Omit<UserProfile, 'password_hash'>;
  token: string;
  expiresIn: string;
}

