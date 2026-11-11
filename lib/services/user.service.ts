import { query } from '@/lib/database/db';
import { UserProfile, UserRole } from '@/types/auth';
import { hashPassword } from '@/lib/security/auth';
import { AuditService } from './audit.service';
import { AccountService } from './account.service';

export class UserService {
  static async listUsers(filters: {
    role?: string;
    status?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ users: UserProfile[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filters.role) {
      conditions.push(`role = $${pIdx++}`);
      params.push(filters.role);
    }
    if (filters.status) {
      conditions.push(`status = $${pIdx++}`);
      params.push(filters.status);
    }
    if (filters.search) {
      conditions.push(`(email ILIKE $${pIdx} OR full_name ILIKE $${pIdx})`);
      params.push(`%${filters.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(`
      SELECT COUNT(*) as count FROM profiles ${whereClause};
    `, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const offset = (filters.page - 1) * filters.limit;
    params.push(filters.limit, offset);

    const dataRes = await query<UserProfile>(`
      SELECT id, email, full_name, phone, role, status, failed_login_attempts,
             locked_until, last_login_at, metadata, created_at, updated_at
      FROM profiles
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `, params);

    return { users: dataRes.rows, total };
  }

  static async getUserById(id: string): Promise<UserProfile | null> {
    const res = await query<UserProfile>(`
      SELECT id, email, full_name, phone, role, status, failed_login_attempts,
             locked_until, last_login_at, metadata, created_at, updated_at
      FROM profiles
      WHERE id = $1;
    `, [id]);

    return res.rows[0] || null;
  }

  static async updateUser(
    id: string,
    data: { full_name?: string; phone?: string | null; status?: string },
    actorId: string
  ): Promise<UserProfile> {
    const existing = await this.getUserById(id);
    if (!existing) {
      throw new Error('User not found.');
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let pIdx = 2;

    if (data.full_name !== undefined) {
      updates.push(`full_name = $${pIdx++}`);
      params.push(data.full_name);
    }
    if (data.phone !== undefined) {
      updates.push(`phone = $${pIdx++}`);
      params.push(data.phone);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${pIdx++}`);
      params.push(data.status);
    }

    const res = await query<UserProfile>(`
      UPDATE profiles
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, email, full_name, phone, role, status, failed_login_attempts,
                locked_until, last_login_at, metadata, created_at, updated_at;
    `, params);

    const updated = res.rows[0];

    await AuditService.log({
      userId: actorId,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      oldData: existing,
      newData: updated,
      status: 'SUCCESS'
    });

    return updated;
  }

  static async updateRole(id: string, role: UserRole, actorId: string): Promise<UserProfile> {
    const existing = await this.getUserById(id);
    if (!existing) {
      throw new Error('User not found.');
    }

    const res = await query<UserProfile>(`
      UPDATE profiles
      SET role = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, full_name, phone, role, status, failed_login_attempts,
                locked_until, last_login_at, metadata, created_at, updated_at;
    `, [role, id]);

    const updated = res.rows[0];

    await AuditService.log({
      userId: actorId,
      action: 'USER_ROLE_CHANGED',
      entityType: 'USER',
      entityId: id,
      oldData: { role: existing.role },
      newData: { role: updated.role },
      status: 'SUCCESS'
    });

    return updated;
  }

  static async createUser(
    data: {
      email: string;
      password: string;
      full_name: string;
      phone?: string | null;
      role: UserRole;
      status?: string;
    },
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserProfile> {
    const existing = await query('SELECT id FROM profiles WHERE email = $1', [data.email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw new Error('A user with this email address already exists.');
    }

    const passwordHash = await hashPassword(data.password);
    const role = data.role;
    const status = data.status || 'ACTIVE';

    const insertRes = await query<UserProfile>(`
      INSERT INTO profiles (email, full_name, phone, role, status, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, full_name, phone, role, status, failed_login_attempts,
                locked_until, last_login_at, metadata, created_at, updated_at;
    `, [data.email.toLowerCase(), data.full_name, data.phone || null, role, status, passwordHash]);

    const createdUser = insertRes.rows[0];

    // If provisioning an ACCOUNT_HOLDER, automatically create their initial SAVINGS account
    if (createdUser.role === 'ACCOUNT_HOLDER') {
      try {
        await AccountService.createAccount({
          userId: createdUser.id,
          accountType: 'SAVINGS',
          actorId
        });
      } catch (accErr) {
        console.warn('Auto account creation warning for provisioned account holder:', accErr);
      }
    }

    // Audit log
    await AuditService.log({
      userId: actorId,
      action: 'ADMIN_USER_PROVISIONED',
      entityType: 'USER',
      entityId: createdUser.id,
      ipAddress,
      userAgent,
      newData: {
        email: createdUser.email,
        role: createdUser.role,
        full_name: createdUser.full_name,
        status: createdUser.status,
        provisionedBy: actorId
      },
      status: 'SUCCESS'
    });

    return createdUser;
  }
}

