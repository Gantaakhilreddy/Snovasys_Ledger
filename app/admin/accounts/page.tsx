'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/context/auth-context';
import { authFetch } from '@/lib/utils/api-client';

interface Account {
  id: string;
  account_number: string;
  account_type: string;
  currency: string;
  balance_paise: number;
  available_balance_paise: number;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  created_at: string;
  user_id: string;
  owner_name?: string;
  owner_email?: string;
}

export default function AccountManagementPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Freeze / Unfreeze Action Modal
  const [actionAccount, setActionAccount] = useState<Account | null>(null);
  const [actionType, setActionType] = useState<'FREEZE' | 'UNFREEZE'>('FREEZE');
  const [reason, setReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // New Account Modal
  const [newAccountModalOpen, setNewAccountModalOpen] = useState(false);
  const [newAccountType, setNewAccountType] = useState('CHECKING');
  const [creatingAccount, setCreatingAccount] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/accounts?limit=100');
      if (res.ok) {
        const json = await res.json();
        setAccounts(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load accounts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleFreezeToggle = async () => {
    if (!actionAccount) return;
    try {
      setSubmittingAction(true);
      const endpoint = actionType === 'FREEZE'
        ? `/api/v1/accounts/${actionAccount.id}/freeze`
        : `/api/v1/accounts/${actionAccount.id}/unfreeze`;

      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Administrative compliance review' })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Action failed');
      }

      setActionAccount(null);
      setReason('');
      await fetchAccounts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingAccount(true);
      const res = await authFetch('/api/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType: newAccountType,
          currency: 'INR'
        })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Account creation failed');
      }

      setNewAccountModalOpen(false);
      await fetchAccounts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingAccount(false);
    }
  };

  const formatINR = (paise: number | string | bigint) => {
    const p = typeof paise === 'bigint' ? Number(paise) : typeof paise === 'string' ? parseFloat(paise) : Number(paise);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format((isNaN(p) ? 0 : p) / 100);
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = a.account_number.toLowerCase().includes(q);
        const matchesType = a.account_type.toLowerCase().includes(q);
        const matchesOwner = a.owner_name?.toLowerCase().includes(q) || a.owner_email?.toLowerCase().includes(q);
        if (!matchesNum && !matchesType && !matchesOwner) return false;
      }
      return true;
    });
  }, [accounts, statusFilter, searchQuery]);

  const totalBalancePaise = accounts.reduce((acc, a) => acc + a.balance_paise, 0);
  const activeCount = accounts.filter((a) => a.status === 'ACTIVE').length;
  const frozenCount = accounts.filter((a) => a.status === 'FROZEN').length;

  return (
    <AppShell activePath="account-management">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              <span>Admin Console</span>
              <span>/</span>
              <span className="text-secondary font-bold">Vault Fleet Management</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Account Fleet & Vault Custody
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              System-wide account fleet surveillance, status enforcement (freezing & unfreezing), multi-currency ledger reserves, and custodial compliance.
            </p>
          </div>

          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setNewAccountModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-bold shadow-md hover:bg-primary-container transition-all self-start xl:self-auto"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              <span>Open New Vault</span>
            </button>
          )}
        </div>

        {/* Auditor Read-Only Banner */}
        {user?.role === 'AUDITOR' && (
          <div className="bg-secondary-fixed/20 border border-secondary/30 rounded-xl p-3.5 flex items-center justify-between text-xs text-on-surface">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary text-xl">shield</span>
              <div>
                <span className="font-bold text-secondary">Compliance Auditor Oversight Mode:</span>
                <span className="text-on-surface-variant ml-1.5">
                  Account vault telemetry is displayed for continuous audit &amp; regulatory inspection. Account modifications (freezing, unfreezing, creation) are restricted to system administrators.
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] tracking-wider uppercase shrink-0">
              ISO 20022 READ-ONLY
            </span>
          </div>
        )}

        {/* 4-KPI Array */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
              Total Custodied Accounts
            </span>
            <div className="my-space-sm">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface font-mono">
                {accounts.length}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Platform-wide vaults</p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-emerald-700 font-semibold">
              100% Reserve Custody
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
              Active Accounts
            </span>
            <div className="my-space-sm">
              <span className="font-headline-lg text-headline-lg font-bold text-emerald-700 font-mono">
                {activeCount}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Permitted transfers & dispatches</p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-on-surface-variant">
              Operational
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
              Restricted / Frozen
            </span>
            <div className="my-space-sm">
              <span className={`font-headline-lg text-headline-lg font-bold font-mono ${frozenCount > 0 ? 'text-red-700' : 'text-on-surface'}`}>
                {frozenCount}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Halted by admin mandate</p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-on-surface-variant">
              SecOps / Legal Holds
            </div>
          </div>

          <div className="bg-primary-container text-white p-space-lg rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden border border-white/10">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-slate-300 font-semibold">
              Total Custodial Balance
            </span>
            <div className="my-space-sm">
              <span className="font-headline-sm text-headline-sm font-bold text-cyan-400 font-mono truncate block">
                {formatINR(totalBalancePaise)}
              </span>
              <p className="font-body-sm text-body-sm text-slate-300 mt-1">Segregated Central Reserves</p>
            </div>
            <div className="pt-2 border-t border-surface-container-lowest/10 text-xs text-slate-400 font-mono">
              ZERO DEFICIT
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-sm">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
              search
            </span>
            <input
              type="text"
              placeholder="Search by account number, type, or entity..."
              className="w-full bg-surface-container-low text-on-surface text-sm pl-9 pr-3 py-2 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-secondary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-semibold text-on-surface-variant">Status:</span>
            {['ALL', 'ACTIVE', 'FROZEN'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Accounts Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                  <th className="py-3 px-space-lg font-semibold">Account Identifier</th>
                  <th className="py-3 px-space-md font-semibold">Type & Signer</th>
                  <th className="py-3 px-space-md font-semibold">Status</th>
                  <th className="py-3 px-space-md font-semibold text-right">Available Balance</th>
                  <th className="py-3 px-space-md font-semibold text-right">Ledger Balance</th>
                  <th className="py-3 px-space-md font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      Querying account fleet...
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      No matching accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3.5 px-space-lg">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-on-surface">{a.account_number}</span>
                          <span className="text-xs text-outline">{a.currency} • IFSC: LDGR0001849</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">{a.account_type}</span>
                          <span className="text-xs text-on-surface-variant">{a.owner_name || a.owner_email || 'Institutional'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          a.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-red-50 text-red-800'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md text-right font-mono font-semibold text-on-surface">
                        {formatINR(a.available_balance_paise)}
                      </td>
                      <td className="py-3.5 px-space-md text-right font-mono font-bold text-on-surface">
                        {formatINR(a.balance_paise)}
                      </td>
                      <td className="py-3.5 px-space-md text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/accounts/${a.id}`}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors"
                          >
                            Details
                          </Link>
                          {user?.role === 'ADMIN' && (
                            a.status === 'ACTIVE' ? (
                              <button
                                onClick={() => {
                                  setActionAccount(a);
                                  setActionType('FREEZE');
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                              >
                                Freeze
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setActionAccount(a);
                                  setActionType('UNFREEZE');
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                Unfreeze
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Freeze / Unfreeze Action Modal */}
        {actionAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  actionType === 'FREEZE' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <span className="material-symbols-outlined">
                    {actionType === 'FREEZE' ? 'lock' : 'lock_open'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {actionType === 'FREEZE' ? 'Freeze Financial Account' : 'Unfreeze Account'}
                  </h3>
                  <span className="text-xs text-on-surface-variant font-mono">
                    Account: {actionAccount.account_number}
                  </span>
                </div>
              </div>

              <p className="text-sm text-on-surface-variant">
                {actionType === 'FREEZE'
                  ? 'Freezing this account immediately disables all outbound fund transfers and withdrawals. Inbound transfers are also blocked.'
                  : 'Unfreezing will restore full transactional capabilities for this account.'}
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-on-surface-variant">
                  Audit Justification / Mandate Reason
                </label>
                <textarea
                  className="w-full bg-surface-container-low text-on-surface text-sm p-3 rounded-lg border-0 focus:ring-1 focus:ring-secondary resize-none h-24"
                  placeholder="Enter detailed reason for this action..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
                <button
                  onClick={() => setActionAccount(null)}
                  className="px-4 py-2 text-xs text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFreezeToggle}
                  disabled={submittingAction}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg text-white ${
                    actionType === 'FREEZE' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {submittingAction ? 'Processing...' : actionType === 'FREEZE' ? 'Confirm Freeze' : 'Confirm Unfreeze'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Account Modal */}
        {newAccountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-2xl">account_balance</span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Open New Institutional Vault
                  </h3>
                </div>
                <button
                  onClick={() => setNewAccountModalOpen(false)}
                  className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Account Type</label>
                  <select
                    className="w-full bg-surface-container-low text-on-surface font-semibold text-sm p-3 rounded-lg border-0 focus:ring-1 focus:ring-secondary"
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value)}
                  >
                    <option value="CHECKING">Primary Checking Vault</option>
                    <option value="SAVINGS">Treasury Yield Savings</option>
                    <option value="TREASURY">Institutional Liquidity Reserve</option>
                  </select>
                </div>

                <div className="bg-surface-container-low p-3 rounded-xl flex flex-col gap-1 text-xs text-on-surface-variant">
                  <span className="font-semibold text-on-surface">Automatic Configuration:</span>
                  <span>• Sovereign Account Number generated atomically</span>
                  <span>• Base Currency: INR (₹)</span>
                  <span>• Balance Inception: ₹0.00 (Zero initial variance)</span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
                  <button
                    type="button"
                    onClick={() => setNewAccountModalOpen(false)}
                    className="px-4 py-2 text-xs text-on-surface-variant hover:text-on-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAccount}
                    className="px-5 py-2.5 bg-primary text-on-primary font-semibold text-xs rounded-lg hover:bg-primary-container disabled:opacity-50"
                  >
                    {creatingAccount ? 'Creating Vault...' : 'Create Vault'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
