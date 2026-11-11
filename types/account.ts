export type AccountType = 'SAVINGS' | 'CHECKING' | 'BUSINESS' | 'SYSTEM_RESERVE';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export interface BankAccount {
  id: string;
  account_number: string;
  user_id: string;
  account_type: AccountType;
  currency: string;
  balance_paise: string | number; // BIGINT as string or number
  balance_rupees?: number;
  status: AccountStatus;
  frozen_reason?: string | null;
  frozen_at?: string | null;
  created_at: string;
  updated_at: string;
  owner_name?: string;
  owner_email?: string;
}

export interface CreateAccountInput {
  userId?: string;
  accountType: AccountType;
  initialDepositPaise?: number;
}

