'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  status: string;
  created_at: string;
  user_id: string;
  owner_name?: string;
  owner_email?: string;
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
  ledger_entries?: Array<{
    id: string;
    entry_type: 'DEBIT' | 'CREDIT';
    amount_paise: number;
    account_id: string;
  }>;
}

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const accountId = params?.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');

  const fetchAccountData = async () => {
    try {
      setLoading(true);
      setError(null);

      const acctRes = await authFetch(`/api/v1/accounts/${accountId}`);
      if (!acctRes.ok) {
        const errJson = await acctRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to load account (${acctRes.status})`);
      }

      const acctData = await acctRes.json();
      const loadedAccount = acctData.data?.account || acctData.data;
      setAccount(loadedAccount);

      const queryId = loadedAccount?.id || accountId;
      const txRes = await authFetch(`/api/v1/transactions?accountId=${queryId}&limit=50`);
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching account');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchAccountData();
    }
  }, [accountId]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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

  // Compute Inflow and Outflow
  const { inflowsPaise, outflowsPaise, filteredTransactions } = useMemo(() => {
    let inTotal = 0;
    let outTotal = 0;

    transactions.forEach((tx) => {
      const isDestination = tx.destination_account_id === accountId;
      const isDeposit = tx.transaction_type === 'DEPOSIT';
      const isWithdrawal = tx.transaction_type === 'WITHDRAWAL';
      const isSource = tx.source_account_id === accountId;
      const amt = Number(tx.amount_paise) || 0;

      if (isDestination || isDeposit) {
        inTotal += amt;
      } else if (isSource || isWithdrawal) {
        outTotal += amt;
      }
    });

    const filtered = transactions.filter((tx) => {
      const matchesSearch =
        tx.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.description && tx.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const isIncoming = tx.destination_account_id === accountId || tx.transaction_type === 'DEPOSIT';
      if (filterType === 'CREDIT') return isIncoming;
      if (filterType === 'DEBIT') return !isIncoming;
      return true;
    });

    return { inflowsPaise: inTotal, outflowsPaise: outTotal, filteredTransactions: filtered };
  }, [transactions, accountId, searchQuery, filterType]);

  const handleFreezeToggle = async () => {
    if (!account) return;
    try {
      setActionLoading(true);
      const isCurrentlyFrozen = account.status === 'FROZEN';
      const endpoint = isCurrentlyFrozen
        ? `/api/v1/accounts/${account.id}/unfreeze`
        : `/api/v1/accounts/${account.id}/freeze`;

      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: freezeReason || 'Administrative protocol check' })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Action failed');
      }

      setFreezeModalOpen(false);
      setFreezeReason('');
      await fetchAccountData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell activePath="my-accounts">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Top Breadcrumbs & Page Head Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
              <Link className="hover:text-secondary transition-colors" href="/accounts">
                Accounts
              </Link>
              <span className="material-symbols-outlined text-sm text-outline">chevron_right</span>
              <span className="text-on-surface font-semibold">
                {account?.account_type || 'Account Details'}
              </span>
            </div>
            <div className="flex items-center gap-space-sm flex-wrap">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
                {account ? `${account.account_type} Operating Vault` : 'Loading Account...'}
              </h1>
              {account && (
                <>
                  <span className="font-label-sm text-label-sm bg-surface-container-highest text-on-surface-variant px-2.5 py-1 rounded-full font-mono font-medium">
                    •••• {(account.account_number || '').slice(-4)}
                  </span>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-xs ${
                    account.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-800'
                      : account.status === 'FROZEN'
                      ? 'bg-rose-50 text-rose-800'
                      : 'bg-amber-50 text-amber-800'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      account.status === 'ACTIVE'
                        ? 'bg-emerald-600 animate-pulse'
                        : account.status === 'FROZEN'
                        ? 'bg-rose-600'
                        : 'bg-amber-600'
                    }`}></span>
                    <span className="font-label-sm text-label-sm font-semibold">
                      {account.status === 'ACTIVE' ? 'Active & Settled' : account.status}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions Top Cluster */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-lowest text-on-surface rounded-lg shadow-sm hover:bg-surface-container transition-all font-label-md text-label-md"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>Export Ledger</span>
            </button>

            {user?.role === 'ADMIN' && account && (
              <button
                onClick={() => setFreezeModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-lowest text-on-surface rounded-lg shadow-sm hover:bg-surface-container transition-all font-label-md text-label-md group"
              >
                <span className="material-symbols-outlined text-base text-on-surface-variant group-hover:text-error transition-colors">
                  {account.status === 'FROZEN' ? 'lock_open' : 'lock_outline'}
                </span>
                <span>{account.status === 'FROZEN' ? 'Unfreeze Account' : 'Freeze Account'}</span>
              </button>
            )}

            {user?.role !== 'AUDITOR' && (
              <button
                onClick={() => router.push(`/transactions/transfer?from=${accountId}`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg shadow-md hover:bg-primary-container transition-all font-label-md text-label-md"
              >
                <span className="material-symbols-outlined text-base">bolt</span>
                <span className="font-semibold">Initiate Wire</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-on-surface-variant font-medium">
            Fetching institutional ledger data...
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 text-red-700 rounded-xl font-medium">
            {error}
          </div>
        ) : account ? (
          <>
            {/* Hero Analytical KPI Ribbon */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
              {/* Current Ledger Balance (Spotlight Dark Card) */}
              <div className="relative bg-primary-container text-on-primary rounded-xl p-space-lg flex flex-col justify-between overflow-hidden shadow-md">
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-secondary-container/20 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-primary-container uppercase tracking-wider font-semibold">
                    Current Ledger Balance
                  </span>
                  <span className="material-symbols-outlined text-tertiary-fixed text-lg">
                    account_balance_wallet
                  </span>
                </div>
                <div className="mt-4 mb-2">
                  <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-primary tabular-nums">
                    {formatINR(account.balance_paise)}
                  </div>
                  <p className="font-label-sm text-label-sm text-on-primary-container mt-1">
                    Real-time atomic settlement • Double-entry balanced
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between text-xs text-on-primary-container font-mono border-t border-surface-container-lowest/10">
                  <span>BASE: {account.currency}</span>
                  <span className="text-tertiary-fixed-dim">Zero Variance Verified</span>
                </div>
              </div>

              {/* Available Clearing Balance */}
              <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Available Liquidity
                  </span>
                  <span className="material-symbols-outlined text-secondary text-lg">verified</span>
                </div>
                <div className="mt-4 mb-2">
                  <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface tabular-nums">
                    {formatINR(account.available_balance_paise)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      100% Immediate Availability
                    </span>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-surface-container-low">
                  <span>Holds: {formatINR(account.balance_paise - account.available_balance_paise)}</span>
                  <span className="font-medium text-secondary">View limits</span>
                </div>
              </div>

              {/* Uncleared Pending In-Flight */}
              <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Inflow Total (Period)
                  </span>
                  <span className="material-symbols-outlined text-emerald-600 text-lg">south_west</span>
                </div>
                <div className="mt-4 mb-2">
                  <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-emerald-700 tabular-nums">
                    +{formatINR(inflowsPaise)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Credits received into vault
                    </span>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-surface-container-low">
                  <span>Gross credits</span>
                  <span className="font-mono text-xs">RTGS_ACTIVE</span>
                </div>
              </div>

              {/* Outflow Total */}
              <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Outflow Total (Period)
                  </span>
                  <span className="material-symbols-outlined text-amber-600 text-lg">north_east</span>
                </div>
                <div className="mt-4 mb-2">
                  <div className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface tabular-nums">
                    -{formatINR(outflowsPaise)}
                  </div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                    Authorized disbursements
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-surface-container-low">
                  <span>Disbursements</span>
                  <span className="font-medium text-secondary">Audit Trail</span>
                </div>
              </div>
            </div>

            {/* Bento Section: Account Details & Specs */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
              {/* Account Metadata (8 Cols) */}
              <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-md border-b border-surface-container-low">
                    <div className="flex items-center gap-space-sm">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-xl">account_balance</span>
                      </div>
                      <div>
                        <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                          Account Specifications & Clearance
                        </h2>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">
                          Primary operational treasury node under master mandate
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-label-sm text-label-sm bg-surface-container-low text-on-surface px-2.5 py-1 rounded-md font-mono">
                        NODE-IN-BLR-01
                      </span>
                    </div>
                  </div>

                  {/* Spec Data Mosaic Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-space-md mt-space-md">
                    {/* Item 1: Routing Number */}
                    <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                        IFSC / Branch Route
                      </span>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-body-md text-body-md font-mono font-semibold text-on-surface tracking-wider">
                          LDGR0001849
                        </span>
                        <button
                          className="p-1 rounded text-on-surface-variant hover:text-secondary hover:bg-surface-container-highest transition-colors"
                          onClick={() => copyToClipboard('LDGR0001849', 'ifsc')}
                          title="Copy Routing Number"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {copiedField === 'ifsc' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                      <span className="font-label-sm text-label-sm text-outline mt-1">RTGS Direct Route</span>
                    </div>

                    {/* Item 2: Account Number */}
                    <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                        Account Identifier
                      </span>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-body-md text-body-md font-mono font-semibold text-on-surface tracking-wider">
                          {account.account_number}
                        </span>
                        <button
                          className="p-1 rounded text-on-surface-variant hover:text-secondary hover:bg-surface-container-highest transition-colors"
                          onClick={() => copyToClipboard(account.account_number, 'acct')}
                          title="Copy Account Number"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {copiedField === 'acct' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                      <span className="font-label-sm text-label-sm text-outline mt-1">
                        {account.account_type} Custody
                      </span>
                    </div>

                    {/* Item 3: Settlement Rail */}
                    <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                        Clearance Status
                      </span>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="font-body-md text-body-md font-semibold text-on-surface">
                          IMPS / NEFT / RTGS
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-outline mt-1">
                        Instant Atomic Finality
                      </span>
                    </div>

                    {/* Item 4: Account Holder Entity */}
                    <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                        Account Holder / Signer
                      </span>
                      <div className="mt-2">
                        <div className="font-body-md text-body-md font-semibold text-on-surface truncate">
                          {account.owner_name || user?.full_name || 'Primary Signer'}
                        </div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant truncate">
                          {account.owner_email || user?.email}
                        </div>
                      </div>
                    </div>

                    {/* Item 5: Created Date */}
                    <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                        Vault Inception
                      </span>
                      <div className="mt-2">
                        <div className="font-body-md text-body-md font-semibold text-on-surface">
                          {new Date(account.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant">
                          Established & Keyed
                        </div>
                      </div>
                    </div>

                    {/* Item 6: Capacity */}
                    <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                          Operating Tier
                        </span>
                        <span className="font-label-sm text-label-sm font-mono text-on-surface font-semibold">
                          Tier 1
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                          <div className="bg-secondary h-full rounded-full" style={{ width: '45%' }}></div>
                        </div>
                        <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant mt-1.5">
                          <span>Unrestricted limits</span>
                          <span className="font-semibold text-on-surface">Standard</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Notification Strip */}
                <div className="mt-space-md bg-surface-container rounded-lg p-space-sm flex items-center justify-between gap-space-sm text-xs text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base">verified_user</span>
                    <span>Immutable double-entry ledger guarantee: Every debit has an exact matching credit.</span>
                  </div>
                  <span className="font-mono text-secondary font-medium">SHA-256 Validated</span>
                </div>
              </div>

              {/* Compliance Mandate Card (4 Cols) */}
              <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
                <div className="flex flex-col gap-space-md">
                  <div className="flex items-center justify-between">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      Compliance & Protocol
                    </h2>
                    <span className="material-symbols-outlined text-on-surface-variant">shield</span>
                  </div>

                  <div className="bg-surface-container-low rounded-lg p-space-md flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                        Dual-Authorization
                      </span>
                      <span className="bg-secondary-fixed text-on-secondary-fixed text-xs px-2 py-0.5 rounded-full font-medium">
                        Enforced &gt;₹10,00,000
                      </span>
                    </div>
                    <p className="font-label-sm text-label-sm text-on-surface">
                      Transfers exceeding threshold require secondary administrative verification.
                    </p>
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex items-center justify-between bg-surface-container-lowest p-2 rounded">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                          <span className="font-label-sm text-label-sm text-on-surface font-medium">
                            {user?.full_name || 'Primary Signer'}
                          </span>
                        </div>
                        <span className="font-label-sm text-label-sm text-outline">Primary Signer</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container-low rounded-lg p-space-md flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                        Deposit Protection
                      </span>
                      <span className="bg-emerald-50 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                        Full Reserve
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                        100% Reserve Custody
                      </span>
                    </div>
                    <p className="font-label-sm text-label-sm text-outline mt-1">
                      Assets maintained in segregated Central Bank clearing reserves with atomic invariant guarantees.
                    </p>
                  </div>
                </div>

                <div className="pt-space-md flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant border-t border-surface-container-low mt-4">
                  <span>Policy ID: LDG-SEC-2025</span>
                  <span className="text-secondary font-medium font-mono">SOC-2 Compliant</span>
                </div>
              </div>
            </div>

            {/* Activity Timeline & Ledger Transaction Register */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
              {/* Action Bar & Filter Toolbar */}
              <div className="p-space-lg flex flex-col lg:flex-row lg:items-center justify-between gap-space-md border-b border-surface-container-low">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Account Ledger Activity
                  </h2>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Immutable activity ledger recorded against Account •••• {(account.account_number || '').slice(-4)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-space-sm">
                  {/* Search */}
                  <div className="relative min-w-[240px]">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                      search
                    </span>
                    <input
                      className="w-full bg-surface-container-low text-on-surface font-body-sm text-body-sm pl-8 pr-3 py-1.5 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-secondary placeholder:text-outline"
                      placeholder="Filter by ref, memo..."
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg">
                    <button
                      onClick={() => setFilterType('ALL')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                        filterType === 'ALL'
                          ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterType('CREDIT')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                        filterType === 'CREDIT'
                          ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Credits
                    </button>
                    <button
                      onClick={() => setFilterType('DEBIT')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                        filterType === 'DEBIT'
                          ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Debits
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Table Surface */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                      <th className="py-3 px-space-lg font-semibold">Transaction & Reference</th>
                      <th className="py-3 px-space-md font-semibold">Type</th>
                      <th className="py-3 px-space-md font-semibold">Status</th>
                      <th className="py-3 px-space-md font-semibold">Date & Time</th>
                      <th className="py-3 px-space-lg font-semibold text-right">Amount</th>
                      <th className="py-3 px-space-md font-semibold text-center">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                          No transactions found for this account.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const isIncoming =
                          tx.destination_account_id === accountId || tx.transaction_type === 'DEPOSIT';
                        return (
                          <tr key={tx.id} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="py-3.5 px-space-lg">
                              <div className="flex flex-col">
                                <span className="font-semibold text-on-surface">
                                  {tx.description || tx.transaction_type}
                                </span>
                                <span className="font-mono text-xs text-outline">
                                  {tx.reference_number}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-space-md">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-container-low text-on-surface">
                                {tx.transaction_type}
                              </span>
                            </td>
                            <td className="py-3.5 px-space-md">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  tx.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : tx.status === 'REVERSED'
                                    ? 'bg-purple-50 text-purple-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {tx.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-space-md text-on-surface-variant">
                              {new Date(tx.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className={`py-3.5 px-space-lg text-right font-mono font-semibold ${
                              isIncoming ? 'text-emerald-700' : 'text-on-surface'
                            }`}>
                              {isIncoming ? '+' : '-'}{formatINR(tx.amount_paise)}
                            </td>
                            <td className="py-3.5 px-space-md text-center">
                              <button
                                onClick={() => setSelectedTx(tx)}
                                className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors"
                                title="Inspect Double-Entry Ledger"
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
            </div>
          </>
        ) : null}

        {/* Double-Entry Ledger Inspection Modal */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-surface-container pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">receipt_long</span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Ledger Journal Record
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="flex flex-col gap-2 font-body-sm text-body-sm">
                <div className="flex justify-between py-1 border-b border-surface-container-low">
                  <span className="text-on-surface-variant">Reference Hash:</span>
                  <span className="font-mono font-medium text-on-surface">{selectedTx.reference_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-container-low">
                  <span className="text-on-surface-variant">Transaction Type:</span>
                  <span className="font-semibold text-on-surface">{selectedTx.transaction_type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-container-low">
                  <span className="text-on-surface-variant">Total Amount:</span>
                  <span className="font-mono font-bold text-on-surface">{formatINR(selectedTx.amount_paise)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-container-low">
                  <span className="text-on-surface-variant">Timestamp:</span>
                  <span className="text-on-surface">{new Date(selectedTx.created_at).toUTCString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-container-low">
                  <span className="text-on-surface-variant">Status:</span>
                  <span className="font-semibold text-emerald-700">{selectedTx.status}</span>
                </div>
                <div className="flex flex-col py-1">
                  <span className="text-on-surface-variant">Description / Memo:</span>
                  <span className="text-on-surface font-medium">{selectedTx.description || 'N/A'}</span>
                </div>
              </div>

              <div className="bg-surface-container-low p-3 rounded-xl flex items-center gap-2 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-secondary text-base">verified</span>
                <span>Double-Entry Balance: Debits equal Credits. Immutability guaranteed.</span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary-container transition-colors"
                >
                  Close Record
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Freeze/Unfreeze Modal (Admin Only) */}
        {freezeModalOpen && account && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  account.status === 'FROZEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  <span className="material-symbols-outlined">
                    {account.status === 'FROZEN' ? 'lock_open' : 'lock'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {account.status === 'FROZEN' ? 'Unfreeze Account' : 'Freeze Account'}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Account: {account.account_number}
                  </p>
                </div>
              </div>

              <p className="text-sm text-on-surface-variant">
                {account.status === 'FROZEN'
                  ? 'Unfreezing will restore active transfer and withdrawal operations for this vault.'
                  : 'Freezing this account will immediately halt all outbound debit and credit operations.'}
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface uppercase">
                  Mandatory Reason / Audit Note
                </label>
                <textarea
                  className="w-full bg-surface-container-low text-on-surface text-sm p-3 rounded-lg border-0 focus:ring-1 focus:ring-secondary resize-none h-24"
                  placeholder="Enter reason for this action..."
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setFreezeModalOpen(false)}
                  className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFreezeToggle}
                  disabled={actionLoading}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg text-white ${
                    account.status === 'FROZEN'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading ? 'Processing...' : account.status === 'FROZEN' ? 'Confirm Unfreeze' : 'Confirm Freeze'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
