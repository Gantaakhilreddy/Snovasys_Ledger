import { query } from '@/lib/database/db';
import { IntegrityReport } from '@/types/ledger';
import { AuditService } from './audit.service';
import { createSecurityAlert } from '@/lib/security/anomaly-detector';

export class IntegrityService {
  static async verifyIntegrity(actorId?: string): Promise<IntegrityReport> {
    const res = await query<{ report: IntegrityReport }>(`
      SELECT verify_system_integrity() AS report;
    `);

    const report = res.rows[0].report;

    await AuditService.log({
      userId: actorId || null,
      action: 'SYSTEM_INTEGRITY_VERIFIED',
      entityType: 'SYSTEM',
      newData: {
        is_valid: report.is_valid,
        total_accounts_audited: report.total_accounts_audited,
        total_transactions_audited: report.total_transactions_audited,
        ledger_balanced: report.ledger_balanced
      },
      status: report.is_valid ? 'SUCCESS' : 'WARNING'
    });

    // If integrity verification fails, generate critical security alert
    if (!report.is_valid) {
      await createSecurityAlert({
        alertType: 'LEDGER_INTEGRITY_MISMATCH',
        severity: 'CRITICAL',
        description: `Financial integrity verification failure detected! Imbalance: ${report.ledger_imbalance_paise} paise.`,
        metadata: { report }
      });
    }

    return report;
  }

  static async getIntegritySummary(): Promise<any> {
    const report = await this.verifyIntegrity();
    
    // Also fetch last 5 integrity verification audit events
    const historyRes = await query(`
      SELECT id, user_id, action, status, new_data, created_at
      FROM audit_logs
      WHERE action = 'SYSTEM_INTEGRITY_VERIFIED'
      ORDER BY created_at DESC
      LIMIT 10;
    `);

    return {
      currentStatus: report,
      verificationHistory: historyRes.rows
    };
  }
}

