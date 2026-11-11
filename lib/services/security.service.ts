import { query } from '@/lib/database/db';
import { SecurityAlert, AlertStatus, AlertSeverity } from '@/types/security';
import { AuditService } from './audit.service';

export class SecurityService {
  static async listAlerts(filters: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    page: number;
    limit: number;
  }): Promise<{ alerts: SecurityAlert[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filters.status) {
      conditions.push(`sa.status = $${pIdx++}`);
      params.push(filters.status);
    }

    if (filters.severity) {
      conditions.push(`sa.severity = $${pIdx++}`);
      params.push(filters.severity);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(`
      SELECT COUNT(*) as count FROM security_alerts sa ${whereClause};
    `, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const offset = (filters.page - 1) * filters.limit;
    params.push(filters.limit, offset);

    const dataRes = await query<SecurityAlert>(`
      SELECT 
        sa.id, sa.user_id, sa.account_id, sa.transaction_id,
        sa.alert_type, sa.severity, sa.description, sa.metadata,
        sa.status, sa.resolved_by, sa.resolved_at, sa.resolution_notes,
        sa.created_at,
        p.email as user_email,
        rp.full_name as resolver_name
      FROM security_alerts sa
      LEFT JOIN profiles p ON sa.user_id = p.id
      LEFT JOIN profiles rp ON sa.resolved_by = rp.id
      ${whereClause}
      ORDER BY sa.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `, params);

    return { alerts: dataRes.rows, total };
  }

  static async getAlertById(id: string): Promise<SecurityAlert | null> {
    const res = await query<SecurityAlert>(`
      SELECT 
        sa.id, sa.user_id, sa.account_id, sa.transaction_id,
        sa.alert_type, sa.severity, sa.description, sa.metadata,
        sa.status, sa.resolved_by, sa.resolved_at, sa.resolution_notes,
        sa.created_at,
        p.email as user_email,
        rp.full_name as resolver_name
      FROM security_alerts sa
      LEFT JOIN profiles p ON sa.user_id = p.id
      LEFT JOIN profiles rp ON sa.resolved_by = rp.id
      WHERE sa.id = $1;
    `, [id]);

    return res.rows[0] || null;
  }

  static async updateAlert(
    id: string,
    data: { status: AlertStatus; resolution_notes?: string },
    actorId: string
  ): Promise<SecurityAlert> {
    const existing = await this.getAlertById(id);
    if (!existing) {
      throw new Error('Security alert not found.');
    }

    const res = await query<SecurityAlert>(`
      UPDATE security_alerts
      SET status = $1,
          resolution_notes = COALESCE($2, resolution_notes),
          resolved_by = CASE WHEN $1 IN ('RESOLVED', 'DISMISSED') THEN $3 ELSE resolved_by END,
          resolved_at = CASE WHEN $1 IN ('RESOLVED', 'DISMISSED') THEN NOW() ELSE resolved_at END
      WHERE id = $4
      RETURNING *;
    `, [data.status, data.resolution_notes || null, actorId, id]);

    const updated = res.rows[0];

    await AuditService.log({
      userId: actorId,
      action: 'SECURITY_ALERT_UPDATED',
      entityType: 'SECURITY_ALERT',
      entityId: id,
      oldData: { status: existing.status },
      newData: { status: updated.status, resolution_notes: data.resolution_notes },
      status: 'SUCCESS'
    });

    return updated;
  }
}

