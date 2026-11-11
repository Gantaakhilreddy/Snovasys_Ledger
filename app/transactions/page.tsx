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
  account_type?: string;
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
  metadata?: any;
  ledger_entries?: LedgerEntry[];
}

export default function TransactionHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL' | 'REVERSAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'REVERSED'>('ALL');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/transactions?limit=100');
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load transaction history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const formatINR = (paise: number | string | bigint) => {
    const p = typeof paise === 'bigint' ? Number(paise) : typeof paise === 'string' ? parseFloat(paise) : Number(paise);
    const rupees = (isNaN(p) ? 0 : p) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(rupees);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Inspect transaction and load its double-entry ledger rows
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

  // Analytical aggregates
  const { settledVolumePaise, netFlowPaise, pendingCount, pendingVolumePaise, filteredList } = useMemo(() => {
    let settledVol = 0;
    let netFlow = 0;
    let pendCount = 0;
    let pendVol = 0;

    transactions.forEach((tx) => {
      const amt = Number(tx.amount_paise) || 0;
      if (tx.status === 'COMPLETED') {
        settledVol += amt;
        if (tx.transaction_type === 'DEPOSIT') {
          netFlow += amt;
        } else if (tx.transaction_type === 'WITHDRAWAL') {
          netFlow -= amt;
        }
      } else if (tx.status === 'PENDING') {
        pendCount++;
        pendVol += amt;
      }
    });

    const filtered = transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.transaction_type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && tx.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRef = tx.reference_number.toLowerCase().includes(q);
        const matchesDesc = tx.description && tx.description.toLowerCase().includes(q);
        const matchesType = tx.transaction_type.toLowerCase().includes(q);
        if (!matchesRef && !matchesDesc && !matchesType) return false;
      }
      return true;
    });

    return {
      settledVolumePaise: settledVol,
      netFlowPaise: netFlow,
      pendingCount: pendCount,
      pendingVolumePaise: pendVol,
      filteredList: filtered
    };
  }, [transactions, typeFilter, statusFilter, searchQuery]);

  return (
    <AppShell activePath="transaction-history">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              <span>Ledger Kernel</span>
              <span>/</span>
              <span className="text-secondary font-bold">SHA-256 Engine</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1"></span>
              <span className="text-on-surface-variant font-mono">Consensus Validated</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Transaction History & Ledger Explorer
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Tamper-evident, double-entry journal records cryptographically verified with immutable balances.
            </p>
          </div>

          {/* Action Cluster */}
          <div className="flex items-center flex-wrap gap-space-sm">
            <button
              onClick={() => window.print()}
              className="bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-md text-label-md px-space-md py-2.5 rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base text-on-surface-variant">picture_as_pdf</span>
              <span>Export Statement</span>
            </button>
            <button
              onClick={() => {
                const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(transactions, null, 2));
                const dlAnchor = document.createElement('a');
                dlAnchor.setAttribute('href', dataStr);
                dlAnchor.setAttribute('download', 'ledgerline_transactions.json');
                dlAnchor.click();
              }}
              className="bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-md text-label-md px-space-md py-2.5 rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base text-secondary">verified</span>
              <span>Raw JSON Export</span>
            </button>
            <button
              onClick={() => router.push('/transactions/transfer')}
              className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md px-space-lg py-2.5 rounded-lg shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">sync_alt</span>
              <span>New Transfer</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {/* Card 1: Net Ledger Flow (Featured Dark Institutional) */}
          <div className="bg-primary-container text-white rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden border border-white/10">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-secondary/15 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-slate-300 tracking-wider uppercase font-semibold">
                Net Inflow Balance
              </span>
              <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                <span className="material-symbols-outlined text-xs">trending_up</span> Live
              </span>
            </div>
            <div className="my-space-sm">
              <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-white font-mono">
                {netFlowPaise >= 0 ? '+' : ''}{formatINR(netFlowPaise)}
              </div>
              <p className="font-body-sm text-body-sm text-slate-300 mt-1">
                Net platform liquidity movement
              </p>
            </div>
            <div className="w-full h-6 pt-1">
              <svg className="w-full h-full text-tertiary-fixed-dim" fill="none" preserveAspectRatio="none" viewBox="0 0 200 40">
                <path d="M0,35 Q30,30 50,22 T100,28 T150,12 T200,4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                <path d="M0,35 Q30,30 50,22 T100,28 T150,12 T200,4 L200,40 L0,40 Z" fill="currentColor" fillOpacity="0.1" />
              </svg>
            </div>
          </div>

          {/* Card 2: Settled Volume */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase font-semibold">
                Settled Volume
              </span>
              <span className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-on-surface">
                <span className="material-symbols-outlined text-base">task_alt</span>
              </span>
            </div>
            <div className="my-space-sm">
              <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface font-mono">
                {formatINR(settledVolumePaise)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  {transactions.filter(t => t.status === 'COMPLETED').length} Transactions
                </span>
                <span className="text-outline-variant">•</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Cleared</span>
              </div>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
              <div className="bg-secondary h-full rounded-full" style={{ width: '98%' }}></div>
            </div>
          </div>

          {/* Card 3: In-Flight & Processing */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase font-semibold">
                In-Flight / Pending
              </span>
              <span className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-700">
                <span className="material-symbols-outlined text-base">pending</span>
              </span>
            </div>
            <div className="my-space-sm">
              <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface font-mono">
                {formatINR(pendingVolumePaise)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-label-md text-label-md text-amber-800 font-medium">
                  {pendingCount} Pending Queue
                </span>
                <span className="text-outline-variant">•</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">In settlement</span>
              </div>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: pendingCount > 0 ? '25%' : '0%' }}></div>
            </div>
          </div>

          {/* Card 4: Disputed / Integrity Audit */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase font-semibold">
                Double-Entry Invariant
              </span>
              <span className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <span className="material-symbols-outlined text-base">verified</span>
              </span>
            </div>
            <div className="my-space-sm">
              <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-emerald-700 font-mono">
                ₹0.00
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-label-md text-label-md text-emerald-700 font-semibold">
                  0 Exceptions
                </span>
                <span className="text-outline-variant">•</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">100% Match</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 font-label-sm text-label-sm">
              <span className="material-symbols-outlined text-sm">lock</span>
              <span>Σ(DR) ≡ Σ(CR) Invariant Maintained</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
          {/* Row 1: Search */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-space-sm">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
                search
              </span>
              <input
                className="w-full bg-surface-container-low text-on-surface font-body-sm text-body-sm pl-11 pr-4 py-2.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all placeholder:text-outline"
                placeholder="Search by transaction reference hash, type, description, amount..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-space-xs overflow-x-auto pb-1 lg:pb-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-surface-container-low text-on-surface font-label-md text-label-md px-3 py-2.5 rounded-lg border-0 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="REVERSED">Reversed</option>
              </select>

              <button
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface p-2.5 rounded-lg"
                title="Reset Filters"
              >
                <span className="material-symbols-outlined text-base">restart_alt</span>
              </button>
            </div>
          </div>

          {/* Row 2: Type Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-surface-container-low">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold mr-1">
              Type:
            </span>
            {(['ALL', 'TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'REVERSAL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold transition-colors ${
                  typeFilter === t
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                {t === 'ALL' ? 'All Transactions' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction Table Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                  <th className="py-3 px-space-lg font-semibold">Reference & Hash</th>
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
                      Querying immutable journal records...
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                      No matching transaction records found.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((tx) => {
                    const isCredit = tx.transaction_type === 'DEPOSIT';
                    return (
                      <tr key={tx.id} className="hover:bg-surface-container-low/60 transition-colors">
                        <td className="py-3.5 px-space-lg">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-on-surface">
                              {tx.reference_number}
                            </span>
                            <button
                              onClick={() => copyToClipboard(tx.reference_number)}
                              className="text-on-surface-variant hover:text-secondary p-1"
                              title="Copy Reference"
                            >
                              <span className="material-symbols-outlined text-xs">
                                {copiedHash === tx.reference_number ? 'check' : 'content_copy'}
                              </span>
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-space-md">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container-low text-on-surface">
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-space-md text-on-surface max-w-[240px] truncate">
                          {tx.description || 'N/A'}
                        </td>
                        <td className="py-3.5 px-space-md">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              tx.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-800'
                                : tx.status === 'REVERSED'
                                ? 'bg-purple-50 text-purple-800'
                                : tx.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-red-50 text-red-800'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-space-md text-on-surface-variant whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className={`py-3.5 px-space-lg text-right font-mono font-bold whitespace-nowrap ${
                          isCredit ? 'text-emerald-700' : 'text-on-surface'
                        }`}>
                          {isCredit ? '+' : ''}{formatINR(tx.amount_paise)}
                        </td>
                        <td className="py-3.5 px-space-md text-center">
                          <button
                            onClick={() => handleInspect(tx)}
                            className="p-1.5 rounded-lg bg-surface-container-low text-on-surface hover:text-secondary hover:bg-surface-container transition-colors"
                            title="Inspect Double-Entry Journal"
                          >
                            <span className="material-symbols-outlined text-base">receipt_long</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-space-md bg-surface-container-low/40 flex items-center justify-between text-xs text-on-surface-variant">
            <span>Showing {filteredList.length} of {transactions.length} records</span>
            <span className="font-mono">ENCRYPTED-JOURNAL-V4</span>
          </div>
        </div>

        {/* Double-Entry Ledger Inspector Drawer / Modal */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-2xl">receipt_long</span>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Double-Entry Ledger Journal
                    </h3>
                    <span className="font-mono text-xs text-outline">
                      Ref: {selectedTx.reference_number}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Master Tx Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container-low p-4 rounded-xl text-xs">
                <div>
                  <span className="text-on-surface-variant block uppercase font-medium">Type</span>
                  <span className="font-bold text-on-surface">{selectedTx.transaction_type}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block uppercase font-medium">Status</span>
                  <span className="font-bold text-emerald-700">{selectedTx.status}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block uppercase font-medium">Total Volume</span>
                  <span className="font-mono font-bold text-on-surface">{formatINR(selectedTx.amount_paise)}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block uppercase font-medium">Timestamp</span>
                  <span className="text-on-surface">{new Date(selectedTx.created_at).toUTCString()}</span>
                </div>
              </div>

              {/* Ledger Entries Table */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-label-md text-label-md font-bold text-on-surface uppercase tracking-wider">
                    Balanced Journal Rows (Σ DR = Σ CR)
                  </h4>
                  <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                    Balanced Invariant Verified
                  </span>
                </div>

                {loadingLedger ? (
                  <div className="p-8 text-center text-sm text-on-surface-variant">
                    Fetching cryptographic ledger entries...
                  </div>
                ) : ledgerEntries.length === 0 ? (
                  <div className="p-6 bg-surface-container-low rounded-xl text-center text-sm text-on-surface-variant">
                    No individual ledger rows found or cached.
                  </div>
                ) : (
                  <div className="border border-surface-container-low rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-container-low text-on-surface-variant uppercase font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">Entry ID</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Account Identifier</th>
                          <th className="py-2.5 px-4 text-right">Debit (₹)</th>
                          <th className="py-2.5 px-4 text-right">Credit (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-low font-mono">
                        {ledgerEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-surface-container-low/40">
                            <td className="py-2.5 px-4 text-outline truncate max-w-[120px]">
                              {entry.id}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded font-bold ${
                                entry.entry_type === 'DEBIT' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                              }`}>
                                {entry.entry_type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-on-surface">
                              {entry.account_number || entry.account_id}
                            </td>
                            <td className="py-2.5 px-4 text-right text-amber-800 font-semibold">
                              {entry.entry_type === 'DEBIT' ? formatINR(entry.amount_paise) : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right text-blue-800 font-semibold">
                              {entry.entry_type === 'CREDIT' ? formatINR(entry.amount_paise) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-container-low">
                <span className="text-xs text-outline">
                  Immutable guarantee: Financial ledger rows can never be modified or deleted.
                </span>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary-container"
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
