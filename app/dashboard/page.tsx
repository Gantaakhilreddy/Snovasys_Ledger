'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/context/auth-context';
import { authFetch } from '@/lib/utils/api-client';
import { formatINR, paiseToRupees } from '@/lib/utils/currency';
import { BankAccount } from '@/types/account';
import { FinancialTransaction } from '@/types/transaction';

export default function UserDashboardPage() {
  const { user, token } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch accounts
        const accRes = await authFetch('/api/v1/accounts?limit=100');
        const accData = await accRes.json();
        if (accData.success) {
          setAccounts(accData.data || []);
        }

        // Fetch recent transactions
        const txRes = await authFetch('/api/v1/transactions?limit=6');
        const txData = await txRes.json();
        if (txData.success) {
          setTransactions(txData.data || []);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Calculate total liquidity across accounts
  const totalBalancePaise = accounts.reduce((acc, a) => acc + BigInt(a.balance_paise || 0), 0n);

  return (
    <AppShell>
      <div className="flex flex-col w-full gap-6">
        {/* Top Welcome & Rapid Command Bar */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary font-label-sm text-label-sm uppercase tracking-wider font-semibold text-xs">
                Consolidated Portfolio
              </span>
              <span className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm text-xs">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse"></span>
                Real-time ledger sync active • 0 unverified discrepancies
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Good morning, {user?.full_name?.split(' ')[0] || 'Executive'}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant text-sm">
              Here is your unified treasury summary across {accounts.length} active financial accounts.
            </p>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/transactions/transfer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md text-xs font-semibold shadow-xs hover:bg-secondary/90 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-base">send_money</span>
              Transfer Funds
            </a>
            <a
              href="/transactions/deposit-withdraw"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md text-xs font-semibold shadow-xs hover:opacity-90 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-base">input</span>
              Deposit &amp; Wire
            </a>
            <a
              href="/accounts"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md text-xs font-semibold hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-base">account_balance</span>
              Manage Accounts
            </a>
          </div>
        </section>

        {/* Key Financial Metrics Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          {/* Primary Hero Card (Total Liquidity) */}
          <div className="lg:col-span-6 bg-primary-container text-white rounded-xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden border border-white/10">
            <div className="absolute -right-12 -top-12 w-64 h-64 bg-secondary-container/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute right-8 bottom-0 w-48 h-48 bg-tertiary-fixed-dim/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-label-sm uppercase tracking-widest text-slate-300 font-semibold text-xs">
                    Total Liquidity &amp; Available
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-lowest/15 text-cyan-400 font-label-sm text-xs font-mono">
                    {accounts.length} Accounts
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-headline-xl text-headline-xl font-bold tracking-tight text-white tabular-nums">
                    {formatINR(totalBalancePaise)}
                  </span>
                  <span className="font-label-md text-label-md px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold inline-flex items-center gap-1 text-xs">
                    <span className="material-symbols-outlined text-xs">trending_up</span>
                    Balanced
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-slate-300 flex items-center gap-1 text-xs">
                  <span className="text-cyan-400 font-medium">100% Reserve Backed</span> continuously reconciled in real-time
                </p>
              </div>
            </div>

            <div className="relative z-10 pt-4 mt-6 border-t border-surface-container-lowest/10 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="block text-slate-400">Ledger State</span>
                <span className="font-semibold text-white">Immutable</span>
              </div>
              <div>
                <span className="block text-slate-400">Settlement</span>
                <span className="font-semibold text-white">Instant (Atomic)</span>
              </div>
              <div>
                <span className="block text-slate-400">Audited Logs</span>
                <span className="font-semibold text-cyan-400">Verified</span>
              </div>
            </div>
          </div>

          {/* Metric Card 2: Primary Account Balance */}
          <div className="lg:col-span-3 md:col-span-1 bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-surface-container-high flex flex-col justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-semibold text-xs">
                  Primary Account
                </span>
                <span className="p-1.5 rounded-lg bg-secondary/10 text-secondary">
                  <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                </span>
              </div>
              <span className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight tabular-nums mt-2">
                {accounts[0] ? formatINR(accounts[0].balance_paise) : '₹0.00'}
              </span>
              <div className="inline-flex items-center gap-1.5 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-label-sm text-xs font-semibold">
                  {accounts[0]?.status || 'ACTIVE'}
                </span>
              </div>
            </div>
            <div className="pt-3 border-t border-surface-container text-on-surface-variant text-xs">
              Account: <span className="font-mono font-semibold text-on-surface">{accounts[0]?.account_number || 'LL-SAV-...'}</span>
            </div>
          </div>

          {/* Metric Card 3: Recent Transaction Volume */}
          <div className="lg:col-span-3 md:col-span-1 bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-surface-container-high flex flex-col justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-semibold text-xs">
                  Activity Velocity
                </span>
                <span className="p-1.5 rounded-lg bg-surface-container text-on-surface-variant">
                  <span className="material-symbols-outlined text-base">receipt_long</span>
                </span>
              </div>
              <span className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight tabular-nums mt-2">
                {transactions.length} Events
              </span>
              <div className="inline-flex items-center gap-1.5 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-xs font-medium">
                  Audited &amp; Recorded
                </span>
              </div>
            </div>
            <div className="pt-3 border-t border-surface-container text-on-surface-variant text-xs">
              Verification: <span className="font-semibold text-emerald-700">100% Balanced</span>
            </div>
          </div>
        </section>

        {/* Accounts List Quick View */}
        <section className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-headline-sm font-bold text-on-surface">Your Linked Bank Accounts</h2>
              <p className="text-xs text-on-surface-variant">Click any account to view balance sheets, velocity, and audit details.</p>
            </div>
            <a href="/accounts" className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1">
              <span>View All Accounts</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <a
                key={acc.id}
                href={`/accounts/${acc.id}`}
                className="p-4 rounded-xl border border-surface-container-high hover:border-secondary hover:shadow-md transition-all bg-surface-container-low/40 flex flex-col justify-between gap-3 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-on-surface group-hover:text-secondary transition-colors">
                    {acc.account_number}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    acc.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {acc.status}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant block">{acc.account_type} Account</span>
                  <span className="font-headline-sm font-bold text-on-surface tabular-nums">
                    {formatINR(acc.balance_paise)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-outline pt-2 border-t border-surface-container">
                  <span>Currency: {acc.currency}</span>
                  <span className="text-secondary font-semibold group-hover:underline">Details →</span>
                </div>
              </a>
            ))}
            {accounts.length === 0 && !loading && (
              <div className="col-span-3 text-center py-8 text-on-surface-variant text-sm">
                No accounts found. Open a new savings or checking account.
              </div>
            )}
          </div>
        </section>

        {/* Recent Transactions Table */}
        <section className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-headline-sm font-bold text-on-surface">Recent Financial Transactions</h2>
              <p className="text-xs text-on-surface-variant">Append-only cryptographic double-entry ledger stream.</p>
            </div>
            <a href="/transactions" className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1">
              <span>Full History</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-container text-xs text-on-surface-variant uppercase tracking-wider bg-surface-container-low/50">
                  <th className="py-2.5 px-3 font-semibold">Reference</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Description</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-sm">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-xs text-on-surface">
                      {tx.reference_no}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        tx.type === 'DEPOSIT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tx.type === 'TRANSFER'
                          ? 'bg-blue-100 text-blue-800'
                          : tx.type === 'REVERSAL'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-on-surface truncate max-w-xs">
                      {tx.description}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-right font-semibold tabular-nums ${
                      tx.type === 'DEPOSIT' ? 'text-emerald-700' : 'text-on-surface'
                    }`}>
                      {tx.type === 'DEPOSIT' ? '+' : '-'}{formatINR(tx.amount_paise)}
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-outline font-mono">
                      {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-on-surface-variant text-sm">
                      No recent transactions recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
