import { query } from '@/lib/database/db';
import { paiseToRupees } from '@/lib/utils/currency';

export class ReportService {
  static async getTransactionReport(filters: { startDate?: string; endDate?: string }): Promise<any> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filters.startDate) {
      conditions.push(`created_at >= $${pIdx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`created_at <= $${pIdx++}`);
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const summaryRes = await query(`
      SELECT 
        type,
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount_paise), 0) as total_paise,
        COALESCE(SUM(fee_paise), 0) as total_fee_paise
      FROM transactions
      ${whereClause}
      GROUP BY type, status
      ORDER BY type, status;
    `, params);

    const overallRes = await query(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount_paise), 0) as total_volume_paise,
        COALESCE(AVG(amount_paise), 0) as avg_amount_paise
      FROM transactions
      ${whereClause};
    `, params);

    return {
      summary: summaryRes.rows.map(row => ({
        ...row,
        total_rupees: paiseToRupees(row.total_paise),
        total_fee_rupees: paiseToRupees(row.total_fee_paise)
      })),
      aggregate: {
        totalTransactions: parseInt(overallRes.rows[0]?.total_transactions || '0', 10),
        totalVolumePaise: overallRes.rows[0]?.total_volume_paise || '0',
        totalVolumeRupees: paiseToRupees(overallRes.rows[0]?.total_volume_paise || '0'),
        avgAmountRupees: paiseToRupees(overallRes.rows[0]?.avg_amount_paise || '0')
      }
    };
  }

  static async getAccountReport(): Promise<any> {
    const breakdown = await query(`
      SELECT 
        account_type,
        status,
        COUNT(*) as count,
        COALESCE(SUM(balance_paise), 0) as total_balance_paise
      FROM accounts
      GROUP BY account_type, status
      ORDER BY account_type, status;
    `);

    const totals = await query(`
      SELECT 
        COUNT(*) as total_accounts,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_accounts,
        COUNT(*) FILTER (WHERE status = 'FROZEN') as frozen_accounts,
        COALESCE(SUM(balance_paise) FILTER (WHERE account_type <> 'SYSTEM_RESERVE'), 0) as customer_deposits_paise,
        COALESCE(SUM(balance_paise) FILTER (WHERE account_type = 'SYSTEM_RESERVE'), 0) as reserve_balance_paise
      FROM accounts;
    `);

    const tot = totals.rows[0];

    return {
      distribution: breakdown.rows.map(row => ({
        ...row,
        total_balance_rupees: paiseToRupees(row.total_balance_paise)
      })),
      summary: {
        totalAccounts: parseInt(tot.total_accounts || '0', 10),
        activeAccounts: parseInt(tot.active_accounts || '0', 10),
        frozenAccounts: parseInt(tot.frozen_accounts || '0', 10),
        customerDepositsPaise: tot.customer_deposits_paise,
        customerDepositsRupees: paiseToRupees(tot.customer_deposits_paise),
        reserveBalancePaise: tot.reserve_balance_paise,
        reserveBalanceRupees: paiseToRupees(tot.reserve_balance_paise)
      }
    };
  }

  static async getFinancialSummary(): Promise<any> {
    // 1. Double-Entry Aggregate Totals
    const ledgerAgg = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_paise ELSE 0 END), 0) as total_debits_paise,
        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_paise ELSE 0 END), 0) as total_credits_paise
      FROM ledger_entries;
    `);

    // 2. Customer Deposits vs Reserve Assets
    const balances = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN account_type <> 'SYSTEM_RESERVE' THEN balance_paise ELSE 0 END), 0) as total_customer_deposits,
        COALESCE(SUM(CASE WHEN account_type = 'SYSTEM_RESERVE' THEN balance_paise ELSE 0 END), 0) as total_system_reserve
      FROM accounts;
    `);

    const debits = ledgerAgg.rows[0].total_debits_paise;
    const credits = ledgerAgg.rows[0].total_credits_paise;
    const customerLiabilities = balances.rows[0].total_customer_deposits;
    const systemAssets = balances.rows[0].total_system_reserve;

    return {
      accounting: {
        totalDebitsPaise: debits,
        totalCreditsPaise: credits,
        totalDebitsRupees: paiseToRupees(debits),
        totalCreditsRupees: paiseToRupees(credits),
        isBalanced: debits === credits,
        differencePaise: Math.abs(Number(BigInt(debits) - BigInt(credits)))
      },
      balanceSheet: {
        assets: {
          centralReservePaise: systemAssets,
          centralReserveRupees: paiseToRupees(systemAssets)
        },
        liabilities: {
          customerDepositsPaise: customerLiabilities,
          customerDepositsRupees: paiseToRupees(customerLiabilities)
        }
      },
      generatedAt: new Date().toISOString()
    };
  }
}

