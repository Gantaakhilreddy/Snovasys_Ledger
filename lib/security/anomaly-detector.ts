import { query } from '@/lib/database/db';
import { AlertSeverity } from '@/types/security';

export interface AnomalyEvent {
  userId?: string;
  accountId?: string;
  transactionId?: string;
  alertType: string;
  severity: AlertSeverity;
  description: string;
  metadata?: Record<string, any>;
}

export async function createSecurityAlert(event: AnomalyEvent): Promise<string> {
  try {
    const res = await query<{ id: string }>(`
      INSERT INTO security_alerts (
        user_id, account_id, transaction_id, alert_type,
        severity, description, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN')
      RETURNING id;
    `, [
      event.userId || null,
      event.accountId || null,
      event.transactionId || null,
      event.alertType,
      event.severity,
      event.description,
      JSON.stringify(event.metadata || {})
    ]);

    console.warn(`[SECURITY ALERT TRIGGERED] [${event.severity}] ${event.alertType}: ${event.description}`);
    return res.rows[0].id;
  } catch (err) {
    console.error('Failed to record security alert:', err);
    return '';
  }
}

export async function checkTransferVelocityAnomaly(
  userId: string,
  sourceAccountId: string,
  amountPaise: number
): Promise<void> {
  try {
    // 1. High Velocity Check: > 5 transfers in past 10 minutes
    const velocityCheck = await query<{ count: string }>(`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE source_account_id = $1 
        AND type = 'TRANSFER'
        AND created_at >= NOW() - INTERVAL '10 minutes';
    `, [sourceAccountId]);

    const count = parseInt(velocityCheck.rows[0]?.count || '0', 10);
    if (count >= 5) {
      await createSecurityAlert({
        userId,
        accountId: sourceAccountId,
        alertType: 'HIGH_VELOCITY_TRANSFERS',
        severity: 'HIGH',
        description: `Unusual transaction velocity detected: Account has initiated ${count} transfers within the last 10 minutes.`,
        metadata: { count, windowMinutes: 10, currentAmountPaise: amountPaise }
      });
    }

    // 2. Large Transaction Anomaly Check: > 10,00,000 INR (100,000,000 paise)
    const LARGE_THRESHOLD_PAISE = 100000000;
    if (amountPaise >= LARGE_THRESHOLD_PAISE) {
      await createSecurityAlert({
        userId,
        accountId: sourceAccountId,
        alertType: 'LARGE_TRANSACTION_ANOMALY',
        severity: 'MEDIUM',
        description: `High-value transfer initiated: ₹${(amountPaise / 100).toLocaleString('en-IN')}. Requires enhanced monitoring.`,
        metadata: { amountPaise, thresholdPaise: LARGE_THRESHOLD_PAISE }
      });
    }
  } catch (err) {
    console.error('Velocity anomaly check failed:', err);
  }
}

export async function checkFailedAttemptsAnomaly(
  userId: string,
  failedCount: number,
  ipAddress?: string
): Promise<void> {
  if (failedCount >= 5) {
    await createSecurityAlert({
      userId,
      alertType: 'BRUTE_FORCE_LOGIN',
      severity: 'CRITICAL',
      description: `Account locked after ${failedCount} consecutive failed authentication attempts.`,
      metadata: { failedCount, ipAddress }
    });
  }
}

