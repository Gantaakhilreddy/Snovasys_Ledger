'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/context/auth-context';
import { authFetch } from '@/lib/utils/api-client';

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
}

export default function ReversalManagementPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'REVERSED'>('ALL');

  // Adjudication Panel State
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [reversalReasonCode, setReversalReasonCode] = useState('Duplicate Charge / Operational Error');
  const [reversalAuditNote, setReversalAuditNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<{ reference: string; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/transactions?limit=100');
      if (res.ok) {
        const json = await res.json();
        const txList: Transaction[] = json.data || [];
        setTransactions(txList);
        const eligible = txList.find(t => t.status === 'COMPLETED');
        if (eligible) {
          setSelectedTx(eligible);
        }
      }
    } catch (err) {
      console.error('Failed to load transactions for reversal', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const formatINR = (paise: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(paise / 100);
  };

  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) return;

    setErrorMessage(null);
    setSuccessToast(null);

    const fullReason = `${reversalReasonCode}: ${reversalAuditNote || 'Administrative reversal authorized under compliance mandate'}`;

    try {
      setIsSubmitting(true);
      const res = await authFetch(`/api/v1/transactions/${selectedTx.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: fullReason })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Reversal failed');
      }

      setSuccessToast({
        reference: json.data?.reference_number || 'REV-RECORD',
        message: 'Compensating double-entry ledger entries successfully committed.'
      });
      setReversalAuditNote('');
      await fetchTransactions();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing transaction reversal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const { reversedTotalPaise, reversedCount, completedCount, filteredList } = useMemo(() => {
    let revTotal = 0;
    let revCount = 0;
    let compCount = 0;

    transactions.forEach(t => {
      if (t.status === 'REVERSED') {
        revTotal += t.amount_paise;
        revCount++;
      } else if (t.status === 'COMPLETED') {
        compCount++;
      }
    });

    const filtered = transactions.filter(t => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRef = t.reference_number.toLowerCase().includes(q);
        const matchesDesc = t.description && t.description.toLowerCase().includes(q);
        if (!matchesRef && !matchesDesc) return false;
      }
      return true;
    });

    return {
      reversedTotalPaise: revTotal,
      reversedCount: revCount,
      completedCount: compCount,
      filteredList: filtered
    };
  }, [transactions, statusFilter, searchQuery]);

  return (
    <AppShell activePath="reversal-management">
      <div className="flex flex-col w-full gap-space-lg pb-margin-lg">
        {/* Top Command Bar */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">
                Administration
              </span>
              <span className="font-label-sm text-label-sm text-outline-variant">/</span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-medium">
                Compensating Ledger Desk
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">
              Reversal & Exception Management
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Adjudicate and execute compensating double-entry reversals. Preserves immutable transaction history while creating balanced correcting journal entries.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-xs hover:bg-surface-container transition-all"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span>Reversal Dossier</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-2xl">check_circle</span>
              <div>
                <span className="font-bold">Reversal Completed Successfully</span>
                <p className="text-xs text-emerald-800">
                  New Compensating Reference: <span className="font-mono font-bold">{successToast.reference}</span> • {successToast.message}
                </p>
              </div>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-xs text-emerald-800 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* 4-KPI Array */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {/* Card 1: Midnight Navy Highlight Card */}
          <div className="relative overflow-hidden rounded-xl bg-primary-container text-on-primary p-space-lg flex flex-col justify-between shadow-md">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-secondary/20 blur-2xl pointer-events-none"></div>
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-tertiary-fixed font-semibold">
                  Eligible For Reversal
                </span>
                <span className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-primary mt-1 font-mono">
                  {completedCount}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-lowest/10 text-tertiary-fixed">
                <span className="material-symbols-outlined text-2xl">pending_actions</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container-lowest/10 text-xs font-mono text-on-primary-container">
              STATUS: COMPLETED (SETTLED)
            </div>
          </div>

          {/* Card 2: Executed Reversals */}
          <div className="rounded-xl bg-surface-container-lowest text-on-surface p-space-lg flex flex-col justify-between shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-medium">
                  Reversals Executed
                </span>
                <span className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface mt-1 font-mono">
                  {reversedCount}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface-container text-secondary">
                <span className="material-symbols-outlined text-2xl">assignment_turned_in</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface font-mono">
                  {formatINR(reversedTotalPaise)}
                </span>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>

          {/* Card 3: Immutability Guarantee */}
          <div className="rounded-xl bg-surface-container-lowest text-on-surface p-space-lg flex flex-col justify-between shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-medium">
                  Immutability Invariant
                </span>
                <span className="font-headline-lg text-headline-lg font-bold tracking-tight text-emerald-700 mt-1 font-mono">
                  100%
                </span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <span className="material-symbols-outlined text-2xl">lock</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-on-surface-variant">
              Compensating entries posted. Original transactions remain intact in database.
            </div>
          </div>

          {/* Card 4: Audit SLA */}
          <div className="rounded-xl bg-surface-container-lowest text-on-surface p-space-lg flex flex-col justify-between shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-medium">
                  Audit Protocol
                </span>
                <span className="font-headline-lg text-headline-lg font-bold tracking-tight text-secondary mt-1">
                  Enforced
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface-container text-on-surface">
                <span className="material-symbols-outlined text-2xl">gavel</span>
              </div>
            </div>
            <div className="mt-4 text-xs font-mono text-outline">
              ISO 20022 camt.056 Reversal Mandate
            </div>
          </div>
        </div>

        {/* Main Adjudication Layout (Split: 8 Cols Table / 4 Cols Interactive Panel) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Left Operations Column (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-space-md min-w-0">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-space-md py-2 rounded-lg font-label-md text-label-md font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                  statusFilter === 'ALL'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>All Transactions</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest/20 text-xs">
                  {transactions.length}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETED')}
                className={`px-space-md py-2 rounded-lg font-label-md text-label-md font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                  statusFilter === 'COMPLETED'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>Eligible for Reversal</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  {completedCount}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('REVERSED')}
                className={`px-space-md py-2 rounded-lg font-label-md text-label-md font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                  statusFilter === 'REVERSED'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>Already Reversed</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">
                  {reversedCount}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search by reference hash or description..."
                  className="w-full bg-surface-container-low text-on-surface text-sm pl-9 pr-3 py-2 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-secondary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                      <th className="py-3 px-space-lg font-semibold">Reference</th>
                      <th className="py-3 px-space-md font-semibold">Type</th>
                      <th className="py-3 px-space-md font-semibold">Memo</th>
                      <th className="py-3 px-space-md font-semibold">Status</th>
                      <th className="py-3 px-space-lg font-semibold text-right">Amount</th>
                      <th className="py-3 px-space-md font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                          Loading eligible transactions...
                        </td>
                      </tr>
                    ) : filteredList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                          No matching transactions found.
                        </td>
                      </tr>
                    ) : (
                      filteredList.map((tx) => {
                        const isSelected = selectedTx?.id === tx.id;
                        return (
                          <tr
                            key={tx.id}
                            onClick={() => setSelectedTx(tx)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-surface-container-low border-l-4 border-l-secondary'
                                : 'hover:bg-surface-container-low/60'
                            }`}
                          >
                            <td className="py-3.5 px-space-lg font-mono font-bold text-on-surface text-xs">
                              {tx.reference_number}
                            </td>
                            <td className="py-3.5 px-space-md">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container-low text-on-surface">
                                {tx.transaction_type}
                              </span>
                            </td>
                            <td className="py-3.5 px-space-md text-on-surface max-w-xs truncate text-xs">
                              {tx.description || 'N/A'}
                            </td>
                            <td className="py-3.5 px-space-md">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                tx.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : tx.status === 'REVERSED'
                                  ? 'bg-purple-50 text-purple-800'
                                  : 'bg-amber-50 text-amber-800'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-space-lg text-right font-mono font-bold text-on-surface whitespace-nowrap">
                              {formatINR(tx.amount_paise)}
                            </td>
                            <td className="py-3.5 px-space-md text-center">
                              {tx.status === 'COMPLETED' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTx(tx);
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
                                >
                                  Select for Reversal
                                </button>
                              ) : (
                                <span className="text-xs text-outline">Reversed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Adjudication & Audit Panel (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center gap-2 border-b border-surface-container-low pb-3">
                <span className="material-symbols-outlined text-secondary text-2xl">undo</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Reversal Adjudication
                  </h3>
                  <span className="text-xs text-on-surface-variant">Administrative Compensating Action</span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              {selectedTx ? (
                <form onSubmit={handleExecuteReversal} className="flex flex-col gap-4">
                  {/* Target Tx Details */}
                  <div className="bg-surface-container-low p-3 rounded-xl flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-semibold">Target Transaction:</span>
                      <span className="font-mono font-bold text-on-surface">{selectedTx.reference_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-semibold">Type & Status:</span>
                      <span className="font-semibold">{selectedTx.transaction_type} • {selectedTx.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-semibold">Reversal Principal:</span>
                      <span className="font-mono font-bold text-headline-sm text-on-surface">
                        {formatINR(selectedTx.amount_paise)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-surface-container-high/50">
                      <span className="text-on-surface-variant">Settled At:</span>
                      <span>{new Date(selectedTx.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {selectedTx.status === 'REVERSED' ? (
                    <div className="p-4 rounded-xl bg-purple-50 text-purple-900 text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-purple-700">info</span>
                      <span>This transaction has already been reversed. Duplicate reversals are strictly prohibited.</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase text-on-surface-variant">
                          Dispute / Exception Reason
                        </label>
                        <select
                          className="w-full bg-surface-container-low text-on-surface font-semibold text-xs p-2.5 rounded-lg border-0 focus:ring-1 focus:ring-secondary cursor-pointer"
                          value={reversalReasonCode}
                          onChange={(e) => setReversalReasonCode(e.target.value)}
                        >
                          <option value="Duplicate Charge / Operational Error">Duplicate Charge (System Error)</option>
                          <option value="Fraudulent Account Takeover">Fraudulent Account Takeover</option>
                          <option value="Incorrect Amount / Routing Mismatch">Incorrect Routing / Destination</option>
                          <option value="Customer Dispute Regulatory Recall">Regulation E / Customer Recall</option>
                          <option value="Administrative Compliance Void">Administrative Audit Void</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase text-on-surface-variant">
                          Mandatory Audit Notes & Justification
                        </label>
                        <textarea
                          className="w-full bg-surface-container-low text-on-surface text-xs p-2.5 rounded-lg border-0 focus:ring-1 focus:ring-secondary resize-none h-20"
                          placeholder="Provide detailed administrative notes for compliance auditor review..."
                          value={reversalAuditNote}
                          onChange={(e) => setReversalAuditNote(e.target.value)}
                          required
                        />
                      </div>

                      {/* Compensating Ledger Notice */}
                      <div className="p-3 rounded-xl bg-amber-50 text-amber-900 text-xs flex flex-col gap-1">
                        <div className="flex items-center gap-1 font-bold">
                          <span className="material-symbols-outlined text-amber-700 text-sm">verified_user</span>
                          <span>Compensating Ledger Protocol</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Executing this reversal will debit and credit accounts in reverse direction. The original journal entries will not be deleted or modified.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || user?.role !== 'ADMIN'}
                        className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-base">undo</span>
                        <span>{isSubmitting ? 'Posting Compensating Rows...' : 'Execute Reversal & Post Compensating Entries'}</span>
                      </button>
                    </>
                  )}
                </form>
              ) : (
                <div className="p-8 text-center text-xs text-on-surface-variant">
                  Select a transaction from the table to begin adjudication.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
