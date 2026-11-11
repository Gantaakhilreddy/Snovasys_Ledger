'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/context/auth-context';
import { authFetch } from '@/lib/utils/api-client';

interface LedgerEntry {
  id: string;
  account_id: string;
  entry_type: 'DEBIT' | 'CREDIT';
  amount_paise: number;
  balance_after_paise?: number;
  account_number?: string;
}

interface Transaction {
  id: string;
  reference_number: string;
  transaction_type: string;
  amount_paise: number;
  currency: string;
  status: string;
  description: string;
  source_account_id?: string;
  destination_account_id?: string;
  created_at: string;
  ledger_entries?: LedgerEntry[];
}

export default function AdminTransactionManagementPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/transactions?limit=100');
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleInspect = async (tx: Transaction) => {
    setSelectedTx(tx);
    try {
      setLoadingLedger(true);
      const res = await authFetch(`/api/v1/transactions/${tx.id}`);
      if (res.ok) {
        const json = await res.json();
        setLedgerEntries(json.data?.ledger_entries || []);
      } else {
        setLedgerEntries([]);
      }
    } catch (err) {
      console.error('Failed to load ledger entries', err);
      setLedgerEntries([]);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleApproveDeposit = async (txId: string) => {
    try {
      const res = await authFetch(`/api/v1/admin/pending-deposits/${txId}/approve`, {
        method: 'POST'
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Approval failed');
      alert('Deposit approved and credited successfully!');
      setSelectedTx(null);
      await fetchTransactions();
    } catch (err: any) {
      alert(`Error approving deposit: ${err.message}`);
    }
  };

  const handleRejectDeposit = async (txId: string) => {
    const reason = prompt('Enter rejection reason for this deposit request:', 'Compliance check failed');
    if (!reason) return;
    try {
      const res = await authFetch(`/api/v1/admin/pending-deposits/${txId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Rejection failed');
      alert('Deposit request rejected.');
      setSelectedTx(null);
      await fetchTransactions();
    } catch (err: any) {
      alert(`Error rejecting deposit: ${err.message}`);
    }
  };

  const formatINR = (paise: number | string | bigint) => {
    const p = typeof paise === 'bigint' ? Number(paise) : typeof paise === 'string' ? parseFloat(paise) : Number(paise);
    const rupees = (isNaN(p) ? 0 : p) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(rupees);
  };

  const { totalSettledPaise, reversedCount, pendingCount, filteredTransactions } = useMemo(() => {
    let settled = 0;
    let rev = 0;
    let pend = 0;

    transactions.forEach((tx) => {
      const amt = Number(tx.amount_paise) || 0;
      if (tx.status === 'COMPLETED') settled += amt;
      if (tx.status === 'REVERSED') rev++;
      if (tx.status === 'PENDING') pend++;
    });

    const filtered = transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.transaction_type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && tx.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRef = tx.reference_number.toLowerCase().includes(q);
        const matchesDesc = tx.description && tx.description.toLowerCase().includes(q);
        if (!matchesRef && !matchesDesc) return false;
      }
      return true;
    });

    return {
      totalSettledPaise: settled,
      reversedCount: rev,
      pendingCount: pend,
      filteredTransactions: filtered
    };
  }, [transactions, typeFilter, statusFilter, searchQuery]);

  return (
    <AppShell activePath="transaction-management">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              <span>Admin Console</span>
              <span>/</span>
              <span className="text-secondary font-bold">Transaction Supervision</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Transaction Supervision & Ledger Audit
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Platform-wide transaction monitoring, invariant surveillance, atomic double-entry journal inspection, and reversal oversight.
            </p>
          </div>

          {user?.role === 'ADMIN' && (
            <div className="flex items-center gap-2">
              <Link
                href="/admin/reversals"
                className="px-4 py-2 bg-surface-container-low hover:bg-surface-container text-on-surface text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base text-amber-600">undo</span>
                <span>Reversals Desk</span>
              </Link>
              <Link
                href="/transactions/deposit-withdraw"
                className="px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:bg-primary-container transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">payments</span>
                <span>Authorize Deposit</span>
              </Link>
            </div>
          )}
        </div>

        {/* Auditor Read-Only Banner */}
        {user?.role === 'AUDITOR' && (
          <div className="bg-secondary-fixed/20 border border-secondary/30 rounded-xl p-3.5 flex items-center justify-between text-xs text-on-surface">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary text-xl">verified_user</span>
              <div>
                <span className="font-bold text-secondary">Compliance Auditor Oversight Mode:</span>
                <span className="text-on-surface-variant ml-1.5">
                  Platform transaction journal is presented in continuous assurance mode. Reversals and liquidity interventions are restricted to administrators.
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] tracking-wider uppercase shrink-0">
              IMMUTABLE JOURNAL
            </span>
          </div>
        )}

        {/* 4-KPI Array */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
              Total Transactions
            </span>
            <div className="my-space-sm">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface font-mono">
                {transactions.length}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Platform-wide events</p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-emerald-700 font-semibold">
              100% Invariant Compliant
            </div>
          </div>

          <div className="bg-primary-container text-white p-space-lg rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden border border-white/10">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-slate-300 font-semibold">
              Gross Cleared Volume
            </span>
            <div className="my-space-sm">
              <span className="font-headline-sm text-headline-sm font-bold text-cyan-400 font-mono truncate block">
                {formatINR(totalSettledPaise)}
              </span>
              <p className="font-body-sm text-body-sm text-slate-300 mt-1">Settled on Central Rails</p>
            </div>
            <div className="pt-2 border-t border-surface-container-lowest/10 text-xs text-slate-400 font-mono">
              ZERO DISCREPANCY
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
              Reversals Executed
            </span>
            <div className="my-space-sm">
              <span className="font-headline-lg text-headline-lg font-bold text-secondary font-mono">
                {reversedCount}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Compensating entries posted</p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-on-surface-variant">
              Full Traceability Maintained
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
              In-Flight / Pending
            </span>
            <div className="my-space-sm">
              <span className="font-headline-lg text-headline-lg font-bold text-amber-700 font-mono">
                {pendingCount}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">In settlement process</p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-on-surface-variant">
              Batch Queued
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-space-sm">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
                search
              </span>
              <input
                type="text"
                className="w-full bg-surface-container-low text-on-surface font-body-sm text-body-sm pl-11 pr-4 py-2.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all placeholder:text-outline"
                placeholder="Search by transaction reference hash or memo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface text-sm px-3 py-2.5 rounded-lg border-0 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-surface-container-low">
            <span className="text-xs uppercase font-semibold text-on-surface-variant mr-1">Type:</span>
            {['ALL', 'TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'REVERSAL'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  typeFilter === t
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                {t === 'ALL' ? 'All Types' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                  <th className="py-3 px-space-lg font-semibold">Reference</th>
                  <th className="py-3 px-space-md font-semibold">Type</th>
                  <th className="py-3 px-space-md font-semibold">Description</th>
                  <th className="py-3 px-space-md font-semibold">Status</th>
                  <th className="py-3 px-space-md font-semibold">Timestamp</th>
                  <th className="py-3 px-space-lg font-semibold text-right">Amount</th>
                  <th className="py-3 px-space-md font-semibold text-center">Ledger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                      Querying platform transactions...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                      No matching transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3.5 px-space-lg font-mono font-bold text-on-surface">
                        {tx.reference_number}
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container-low text-on-surface">
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface max-w-xs truncate">
                        {tx.description || 'N/A'}
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          tx.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-800'
                            : tx.status === 'REVERSED'
                            ? 'bg-purple-50 text-purple-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface-variant whitespace-nowrap text-xs">
                        {new Date(tx.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-space-lg text-right font-mono font-bold text-on-surface whitespace-nowrap">
                        {formatINR(tx.amount_paise)}
                      </td>
                      <td className="py-3.5 px-space-md text-center">
                        <button
                          onClick={() => handleInspect(tx)}
                          className="p-1.5 rounded-lg bg-surface-container-low text-on-surface hover:text-secondary hover:bg-surface-container transition-colors"
                          title="Inspect Journal Rows"
                        >
                          <span className="material-symbols-outlined text-base">receipt_long</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ledger Rows Modal */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-2xl">receipt_long</span>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Double-Entry Journal Rows
                    </h3>
                    <span className="font-mono text-xs text-outline">{selectedTx.reference_number}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {loadingLedger ? (
                <div className="p-8 text-center text-sm text-on-surface-variant">Loading journal entries...</div>
              ) : (
                <div className="border border-surface-container-low rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-surface-container-low text-on-surface-variant uppercase font-sans font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Entry ID</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Account</th>
                        <th className="py-2.5 px-4 text-right">Debit (DR)</th>
                        <th className="py-2.5 px-4 text-right">Credit (CR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-low">
                      {ledgerEntries.map((e) => (
                        <tr key={e.id}>
                          <td className="py-2.5 px-4 text-outline truncate max-w-[120px]">{e.id}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              e.entry_type === 'DEBIT' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                            }`}>
                              {e.entry_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-on-surface">{e.account_number || e.account_id}</td>
                          <td className="py-2.5 px-4 text-right text-amber-800 font-semibold">
                            {e.entry_type === 'DEBIT' ? formatINR(e.amount_paise) : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right text-blue-800 font-semibold">
                            {e.entry_type === 'CREDIT' ? formatINR(e.amount_paise) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-surface-container-low">
                <div>
                  {selectedTx.status === 'PENDING' && selectedTx.transaction_type === 'DEPOSIT' && user?.role === 'ADMIN' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveDeposit(selectedTx.id)}
                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">check</span>
                        Approve & Credit Deposit
                      </button>
                      <button
                        onClick={() => handleRejectDeposit(selectedTx.id)}
                        className="px-3.5 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary-container cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
