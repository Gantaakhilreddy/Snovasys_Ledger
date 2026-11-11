import { describe, it, expect } from 'vitest';
import { query } from '@/lib/database/db';
import { IntegrityService } from '@/lib/services/integrity.service';

describe('Double-Entry Ledger Integrity & Immutability Tests', () => {
  it('should maintain strict equality between total debits and credits across all transactions', async () => {
    const res = await query<{
      transaction_id: string;
      total_debit: string;
      total_credit: string;
    }>(`
      SELECT 
        transaction_id,
        SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_paise ELSE 0 END) as total_debit,
        SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_paise ELSE 0 END) as total_credit
      FROM ledger_entries
      GROUP BY transaction_id;
    `);

    expect(res.rows.length).toBeGreaterThan(0);

    for (const row of res.rows) {
      expect(row.total_debit).toBe(row.total_credit);
      expect(BigInt(row.total_debit)).toBeGreaterThan(0n);
    }
  });

  it('should verify that all ledger entries match current account balances', async () => {
    const report = await IntegrityService.verifyIntegrity();
    expect(report.is_valid).toBe(true);
    expect(report.ledger_balanced).toBe(true);
    expect(Number(report.ledger_imbalance_paise)).toBe(0);
    expect(report.mismatched_transactions_count).toBe(0);
    expect(report.mismatched_accounts_count).toBe(0);
  });

  it('should strictly reject any attempt to UPDATE a ledger entry via database immutability trigger', async () => {
    const entry = await query<{ id: string }>('SELECT id FROM ledger_entries LIMIT 1');
    const entryId = entry.rows[0].id;

    await expect(
      query('UPDATE ledger_entries SET amount_paise = amount_paise + 1000 WHERE id = $1', [entryId])
    ).rejects.toThrow(/immutable/i);
  });

  it('should strictly reject any attempt to DELETE a ledger entry via database immutability trigger', async () => {
    const entry = await query<{ id: string }>('SELECT id FROM ledger_entries LIMIT 1');
    const entryId = entry.rows[0].id;

    await expect(
      query('DELETE FROM ledger_entries WHERE id = $1', [entryId])
    ).rejects.toThrow(/immutable/i);
  });
});

