import { query } from '@/lib/database/db';
import { AuditLogEntry } from '@/types/security';

export interface CreateAuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  status?: 'SUCCESS' | 'FAILURE' | 'WARNING';
  errorMessage?: string | null;
}

export class AuditService {
  static async log(params: CreateAuditLogParams): Promise<void> {
    try {
      await query(`
        INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id, ip_address,
          user_agent, old_data, new_data, status, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
      `, [
        params.userId || null,
        params.action,
        params.entityType,
        params.entityId || null,
        params.ipAddress || null,
        params.userAgent || null,
        params.oldData ? JSON.stringify(params.oldData) : null,
        params.newData ? JSON.stringify(params.newData) : null,
        params.status || 'SUCCESS',
        params.errorMessage || null
      ]);
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  static async listLogs(filters: {
    userId?: string;
    action?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filters.userId) {
      conditions.push(`a.user_id = $${pIdx++}`);
      params.push(filters.userId);
    }
    if (filters.action) {
      conditions.push(`a.action ILIKE $${pIdx++}`);
      params.push(`%${filters.action}%`);
    }
    if (filters.status) {
      conditions.push(`a.status = $${pIdx++}`);
      params.push(filters.status);
    }
    if (filters.startDate) {
      conditions.push(`a.created_at >= $${pIdx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`a.created_at <= $${pIdx++}`);
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(`
      SELECT COUNT(*) as count FROM audit_logs a ${whereClause};
    `, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const offset = (filters.page - 1) * filters.limit;
    params.push(filters.limit, offset);

    const dataRes = await query<AuditLogEntry>(`
      SELECT 
        a.id, a.user_id, a.action, a.entity_type, a.entity_id,
        a.ip_address, a.user_agent, a.old_data, a.new_data,
        a.status, a.error_message, a.created_at,
        p.email as user_email, p.role as user_role
      FROM audit_logs a
      LEFT JOIN profiles p ON a.user_id = p.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `, params);

    return { logs: dataRes.rows, total };
  }

  static async getLogById(id: string): Promise<AuditLogEntry | null> {
    const res = await query<AuditLogEntry>(`
      SELECT 
        a.id, a.user_id, a.action, a.entity_type, a.entity_id,
        a.ip_address, a.user_agent, a.old_data, a.new_data,
        a.status, a.error_message, a.created_at,
        p.email as user_email, p.role as user_role
      FROM audit_logs a
      LEFT JOIN profiles p ON a.user_id = p.id
      WHERE a.id = $1;
    `, [id]);

    return res.rows[0] || null;
  }
}

