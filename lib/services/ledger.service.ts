import { query } from '@/lib/database/db';
import { paiseToRupees } from '@/lib/utils/currency';
import { LedgerEntry } from '@/types/ledger';
import { UserRole } from '@/types/auth';

export class LedgerService {
  static async listLedgerEntries(
    userRole: UserRole,
    userId: string,
    filters: {
      accountId?: string;
      transactionId?: string;
      page: number;
      limit: number;
    }
  ): Promise<{ entries: LedgerEntry[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (userRole === 'ACCOUNT_HOLDER') {
      conditions.push(`le.account_id IN (SELECT id FROM accounts WHERE user_id = $${pIdx++})`);
      params.push(userId);
    }

    if (filters.accountId) {
      conditions.push(`le.account_id = $${pIdx++}`);
      params.push(filters.accountId);
    }

    if (filters.transactionId) {
      conditions.push(`le.transaction_id = $${pIdx++}`);
      params.push(filters.transactionId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(`
      SELECT COUNT(*) as count FROM ledger_entries le ${whereClause};
    `, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const offset = (filters.page - 1) * filters.limit;
    params.push(filters.limit, offset);

    const dataRes = await query<LedgerEntry>(`
      SELECT 
        le.id, le.transaction_id, le.account_id, le.entry_type,
        le.amount_paise, le.balance_after_paise, le.description,
        le.created_at,
        a.account_number,
        t.reference_no as transaction_ref
      FROM ledger_entries le
      JOIN accounts a ON le.account_id = a.id
      JOIN transactions t ON le.transaction_id = t.id
      ${whereClause}
      ORDER BY le.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `, params);

    return { entries: dataRes.rows, total };
  }
}

