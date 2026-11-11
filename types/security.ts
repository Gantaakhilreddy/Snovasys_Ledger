export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface SecurityAlert {
  id: string;
  user_id?: string | null;
  account_id?: string | null;
  transaction_id?: string | null;
  alert_type: string;
  severity: AlertSeverity;
  description: string;
  metadata?: Record<string, any>;
  status: AlertStatus;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  user_email?: string;
  resolver_name?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  error_message?: string | null;
  created_at: string;
  user_email?: string;
  user_role?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
}

