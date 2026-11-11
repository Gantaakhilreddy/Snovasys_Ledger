export type LedgerEntryType = 'DEBIT' | 'CREDIT';

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  account_id: string;
  entry_type: LedgerEntryType;
  amount_paise: string | number;
  balance_after_paise: string | number;
  description: string;
  created_at: string;
  account_number?: string;
  transaction_ref?: string;
}

export interface IntegrityReport {
  is_valid: boolean;
  ledger_balanced: boolean;
  total_debits_paise: string | number;
  total_credits_paise: string | number;
  ledger_imbalance_paise: string | number;
  total_transactions_audited: number;
  mismatched_transactions_count: number;
  mismatched_transactions: any[];
  total_accounts_audited: number;
  mismatched_accounts_count: number;
  mismatched_accounts: any[];
  open_security_alerts_count: number;
  verified_at: string;
}

