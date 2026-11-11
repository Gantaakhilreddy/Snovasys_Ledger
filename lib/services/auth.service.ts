import { query } from '@/lib/database/db';
import { hashPassword, verifyPassword, generateToken } from '@/lib/security/auth';
import { checkFailedAttemptsAnomaly } from '@/lib/security/anomaly-detector';
import { AuditService } from './audit.service';
import { AuthResponse, UserProfile, UserRole } from '@/types/auth';

export class AuthService {
  static async register(data: {
    email: string;
    password: string;
    full_name: string;
    phone?: string | null;
    role?: UserRole;
    status?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResponse & { pendingApproval?: boolean }> {
    const existing = await query('SELECT id FROM profiles WHERE email = $1', [data.email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw new Error('A user with this email address already exists.');
    }

    const passwordHash = await hashPassword(data.password);
    const role = data.role || 'ACCOUNT_HOLDER';
    const status = data.status || 'PENDING';

    const insertRes = await query<UserProfile>(`
      INSERT INTO profiles (email, full_name, phone, role, status, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, full_name, phone, role, status, failed_login_attempts,
                locked_until, last_login_at, metadata, created_at, updated_at;
    `, [data.email.toLowerCase(), data.full_name, data.phone || null, role, status, passwordHash]);

    const user = insertRes.rows[0];

    // Audit log
    await AuditService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      newData: { email: user.email, role: user.role, full_name: user.full_name, status: user.status },
      status: 'SUCCESS'
    });

    const isPending = user.status === 'PENDING' || user.status === 'PENDING_APPROVAL';

    const token = isPending
      ? ''
      : generateToken({
          userId: user.id,
          email: user.email,
          role: user.role,
          status: user.status
        });

    return {
      user,
      token,
      expiresIn: isPending ? '0' : '24h',
      pendingApproval: isPending
    };
  }

  static async login(data: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResponse> {
    const res = await query<UserProfile & { password_hash: string }>(`
      SELECT id, email, full_name, phone, role, status, password_hash,
             failed_login_attempts, locked_until, last_login_at, metadata, created_at, updated_at
      FROM profiles
      WHERE email = $1;
    `, [data.email.toLowerCase()]);

    if (res.rows.length === 0) {
      await AuditService.log({
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'USER',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'FAILURE',
        errorMessage: `Unknown user attempt for email: ${data.email}`
      });
      throw new Error('Invalid email or password.');
    }

    const user = res.rows[0];

    // Check account status
    if (user.status === 'PENDING' || user.status === 'PENDING_APPROVAL') {
      throw new Error('Your registration is pending administrator approval. Please wait for an administrator to review and activate your account.');
    }
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      throw new Error(`Your account is currently ${user.status.toLowerCase()}. Please contact system support.`);
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesRemaining = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
      throw new Error(`Account is locked due to repeated failed logins. Try again in ${minutesRemaining} minutes.`);
    }

    const isMatch = await verifyPassword(data.password, user.password_hash);

    if (!isMatch) {
      const newFailedCount = user.failed_login_attempts + 1;
      let lockSql = 'failed_login_attempts = failed_login_attempts + 1';

      if (newFailedCount >= 5) {
        // Lock for 30 minutes
        lockSql += ", locked_until = NOW() + INTERVAL '30 minutes'";
      }

      await query(`UPDATE profiles SET ${lockSql} WHERE id = $1`, [user.id]);

      await AuditService.log({
        userId: user.id,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'FAILURE',
        errorMessage: `Failed password attempt (${newFailedCount}/5)`
      });

      // Anomaly detection check
      await checkFailedAttemptsAnomaly(user.id, newFailedCount, data.ipAddress);

      throw new Error('Invalid email or password.');
    }

    // Successful login: reset failed attempts, update last_login_at
    await query(`
      UPDATE profiles
      SET failed_login_attempts = 0,
          locked_until = NULL,
          last_login_at = NOW()
      WHERE id = $1;
    `, [user.id]);

    await AuditService.log({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'SUCCESS'
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status
    });

    const { password_hash, ...safeUser } = user;

    return {
      user: safeUser,
      token,
      expiresIn: '24h'
    };
  }

  static async forgotPassword(email: string, ipAddress?: string): Promise<{ message: string }> {
    const res = await query('SELECT id FROM profiles WHERE email = $1', [email.toLowerCase()]);
    if (res.rows.length > 0) {
      await AuditService.log({
        userId: res.rows[0].id,
        action: 'AUTH_FORGOT_PASSWORD_REQUESTED',
        entityType: 'USER',
        entityId: res.rows[0].id,
        ipAddress,
        status: 'SUCCESS'
      });
    }

    // Always return standard message to avoid email enumeration
    return {
      message: 'If the provided email is associated with an active account, a password reset link has been dispatched.'
    };
  }

  static async logout(userId: string, ipAddress?: string): Promise<void> {
    await AuditService.log({
      userId,
      action: 'AUTH_LOGOUT',
      entityType: 'USER',
      entityId: userId,
      ipAddress,
      status: 'SUCCESS'
    });
  }
}

