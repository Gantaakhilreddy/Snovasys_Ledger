export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'REVERSAL';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface FinancialTransaction {
  id: string;
  reference_no: string;
  type: TransactionType;
  amount_paise: string | number;
  amount_rupees?: number;
  fee_paise: string | number;
  status: TransactionStatus;
  source_account_id?: string | null;
  destination_account_id?: string | null;
  description: string;
  failure_reason?: string | null;
  metadata?: Record<string, any>;
  created_by?: string | null;
  created_at: string;
  completed_at?: string | null;
  source_account_number?: string;
  destination_account_number?: string;
  creator_name?: string;
}

export interface TransferRequestInput {
  sourceAccountId: string;
  destinationAccountId?: string;
  destinationAccountNumber?: string;
  amountPaise: number;
  description?: string;
  idempotencyKey?: string;
}

export interface DepositRequestInput {
  accountId: string;
  amountPaise: number;
  description?: string;
  idempotencyKey?: string;
}

export interface WithdrawalRequestInput {
  accountId: string;
  amountPaise: number;
  description?: string;
  idempotencyKey?: string;
}

export interface ReversalRequestInput {
  reason: string;
}

