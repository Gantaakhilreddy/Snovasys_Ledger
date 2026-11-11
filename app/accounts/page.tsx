'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/context/auth-context';
import { authFetch } from '@/lib/utils/api-client';
import { formatINR } from '@/lib/utils/currency';
import { BankAccount, AccountType } from '@/types/account';

export default function MyAccountsPage() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Open New Account Modal state
  const [showModal, setShowModal] = useState(false);
  const [newAccountType, setNewAccountType] = useState<AccountType>('SAVINGS');
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const url = new URL('/api/v1/accounts', window.location.origin);
      if (typeFilter) url.searchParams.set('accountType', typeFilter);
      if (statusFilter) url.searchParams.set('status', statusFilter);
      if (search) url.searchParams.set('search', search);

      const res = await authFetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [typeFilter, statusFilter, search]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setCreating(true);

    try {
      const res = await authFetch('/api/v1/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountType: newAccountType,
          initialDepositPaise: 0,
        }),
      });

      const data = await res.json();
      setCreating(false);

      if (res.ok && data.success) {
        setShowModal(false);
        fetchAccounts();
      } else {
        setModalError(data.error || 'Failed to create account');
      }
    } catch (err: any) {
      setCreating(false);
      setModalError(err.message || 'Network error');
    }
  };

  const totalPaise = accounts.reduce((acc, a) => acc + BigInt(a.balance_paise || 0), 0n);

  return (
    <AppShell>
      <div className="flex flex-col w-full gap-6">
        {/* Header and Quick Stats */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              My Financial Accounts
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant text-sm">
              Manage personal and business accounts, monitor real-time ledger balances, and view custody statuses.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-container text-on-primary hover:bg-secondary font-label-md text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-center"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Open New Account
          </button>
        </section>

        {/* Aggregated Balance Banner */}
        <section className="bg-primary-container text-on-primary rounded-xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
          <div className="flex flex-col gap-1 relative z-10">
            <span className="text-on-primary-container text-xs font-semibold uppercase tracking-wider">
              Total Combined Portfolio Balance
            </span>
            <span className="font-headline-xl font-bold tracking-tight tabular-nums">
              {formatINR(totalPaise)}
            </span>
            <span className="text-tertiary-fixed-dim text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">verified</span>
              {accounts.length} Accounts actively monitored with zero reconciliation discrepancies
            </span>
          </div>

          <div className="flex items-center gap-3 relative z-10">
            <a
              href="/transactions/transfer"
              className="px-4 py-2 rounded-lg bg-secondary text-on-secondary font-semibold text-xs shadow-sm hover:opacity-90 transition-all"
            >
              Transfer Funds
            </a>
            <a
              href="/transactions/deposit-withdraw"
              className="px-4 py-2 rounded-lg bg-surface-container-lowest/10 text-on-primary hover:bg-surface-container-lowest/20 font-semibold text-xs transition-all border border-white/10"
            >
              Deposit &amp; Wire
            </a>
          </div>
        </section>

        {/* Filters and Search Bar */}
        <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container-high flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by account number..."
              className="w-full pl-9 pr-3 py-2 bg-surface-container-low text-on-surface text-xs rounded-lg outline-none border border-surface-container-high focus:ring-1 focus:ring-secondary"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface text-xs px-3 py-2 rounded-lg border border-surface-container-high outline-none cursor-pointer"
            >
              <option value="">All Account Types</option>
              <option value="SAVINGS">Savings</option>
              <option value="CHECKING">Checking</option>
              <option value="BUSINESS">Business</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface text-xs px-3 py-2 rounded-lg border border-surface-container-high outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="FROZEN">Frozen</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </section>

        {/* Accounts Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container-high flex flex-col justify-between gap-4 hover:border-secondary transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-on-surface block">
                    {acc.account_number}
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {acc.account_type} Portfolio
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  acc.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : acc.status === 'FROZEN'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {acc.status}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-outline uppercase font-semibold block">Available Balance</span>
                <span className="font-headline-md font-bold text-on-surface tabular-nums">
                  {formatINR(acc.balance_paise)}
                </span>
                <span className="text-[11px] text-on-surface-variant block mt-0.5">
                  Currency: {acc.currency} • Verified Ledger Entry
                </span>
              </div>

              <div className="pt-3 border-t border-surface-container flex items-center justify-between gap-2">
                <a
                  href={`/accounts/${acc.id}`}
                  className="flex-1 text-center py-2 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold text-xs transition-colors"
                >
                  View Details
                </a>
                <a
                  href={`/transactions/transfer?source=${acc.id}`}
                  className="flex-1 text-center py-2 px-3 rounded-lg bg-primary-container text-on-primary hover:bg-secondary font-semibold text-xs transition-colors"
                >
                  Transfer
                </a>
              </div>
            </div>
          ))}

          {accounts.length === 0 && !loading && (
            <div className="col-span-3 text-center py-12 bg-surface-container-lowest rounded-xl border border-surface-container-high p-6">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">account_balance</span>
              <p className="font-semibold text-on-surface">No accounts match your criteria</p>
              <p className="text-xs text-on-surface-variant mt-1">Try resetting your search filters or open a new account.</p>
            </div>
          )}
        </section>

        {/* Modal: Open New Account */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface-container-lowest rounded-xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-surface-container-high">
              <div className="flex items-center justify-between pb-3 border-b border-surface-container mb-4">
                <h3 className="font-headline-sm font-bold text-on-surface">Open New Account</h3>
                <button onClick={() => setShowModal(false)} className="text-outline hover:text-on-surface p-1">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {modalError && (
                <div className="p-3 rounded-lg bg-error-container/40 border border-error/30 text-error text-xs mb-4">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface">Select Account Type</label>
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value as AccountType)}
                    className="w-full bg-surface-container-low text-on-surface text-sm p-2.5 rounded-lg border border-surface-container-high outline-none focus:ring-1 focus:ring-secondary"
                  >
                    <option value="SAVINGS">Savings Account (4.5% APY)</option>
                    <option value="CHECKING">Checking Account (Operating)</option>
                    <option value="BUSINESS">Business Treasury Account</option>
                  </select>
                </div>

                <div className="p-3 rounded-lg bg-surface-container-low text-xs text-on-surface-variant space-y-1">
                  <p className="font-semibold text-on-surface">Instant Provisioning Guarantee:</p>
                  <p>A unique account number (e.g., LL-SAV-XXXXXXXX) will be generated automatically and bound to your encrypted identity profile.</p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 rounded-lg bg-primary-container text-on-primary hover:bg-secondary text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Confirm & Open Account'}
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
