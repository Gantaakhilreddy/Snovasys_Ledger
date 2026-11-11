'use client';

import React, { useEffect, useState } from 'react';
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
  status: string;
}

export default function DepositWithdrawPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Form states for Deposit
  const [selectedDepositAccountId, setSelectedDepositAccountId] = useState('');
  const [depositAmountRupees, setDepositAmountRupees] = useState('25000');
  const [depositDescription, setDepositDescription] = useState('Authorized Capital Inflow');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [userDepositRequests, setUserDepositRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Form states for Withdraw
  const [selectedWithdrawAccountId, setSelectedWithdrawAccountId] = useState('');
  const [withdrawAmountRupees, setWithdrawAmountRupees] = useState('50000');
  const [withdrawDescription, setWithdrawDescription] = useState('Institutional Liquidity Outflow');
  const [withdrawSpeed, setWithdrawSpeed] = useState<'standard' | 'rtgs' | 'sweep'>('rtgs');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const res = await authFetch('/api/v1/accounts?limit=100');
      if (res.ok) {
        const json = await res.json();
        const accts: Account[] = json.data || [];
        setAccounts(accts);
        const active = accts.filter(a => a.status === 'ACTIVE');
        if (active.length > 0) {
          setSelectedDepositAccountId(active[0].id);
          setSelectedWithdrawAccountId(active[0].id);
        } else if (accts.length > 0) {
          setSelectedDepositAccountId(accts[0].id);
          setSelectedWithdrawAccountId(accts[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load accounts', err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const fetchDepositRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await authFetch('/api/v1/transactions?type=DEPOSIT&limit=20');
      if (res.ok) {
        const json = await res.json();
        setUserDepositRequests(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load deposit history', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchDepositRequests();
  }, []);

  const totalLiquidityPaise = accounts.reduce((acc, a) => {
    const amt = Number(a.balance_paise) || 0;
    return acc + (a.status === 'ACTIVE' ? amt : 0);
  }, 0);

  const formatINR = (paise: number | string | bigint) => {
    const p = typeof paise === 'bigint' ? Number(paise) : typeof paise === 'string' ? parseFloat(paise) : Number(paise);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format((isNaN(p) ? 0 : p) / 100);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Handle Deposit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);
    setDepositSuccessMsg(null);

    const amountNum = parseFloat(depositAmountRupees);
    if (!amountNum || amountNum <= 0) {
      setDepositError('Please enter a valid deposit amount greater than ₹0.');
      return;
    }
    if (!selectedDepositAccountId) {
      setDepositError('Please select a destination account.');
      return;
    }

    try {
      setDepositLoading(true);
      const res = await authFetch('/api/v1/transactions/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': `dep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        },
        body: JSON.stringify({
          accountId: selectedDepositAccountId,
          amountPaise: Math.round(amountNum * 100),
          amount: amountNum,
          description: depositDescription || 'Account Deposit'
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Deposit failed');
      }

      if (user?.role === 'ACCOUNT_HOLDER' || json.data?.status === 'PENDING') {
        setDepositSuccessMsg(`Deposit request of ₹${amountNum.toLocaleString('en-IN')} submitted! Status: PENDING APPROVAL. An administrator will review and credit your account shortly. (Ref: ${json.data?.reference_number})`);
      } else {
        setDepositSuccessMsg(`Deposit of ₹${amountNum.toLocaleString('en-IN')} successfully settled! Reference: ${json.data?.reference_number}`);
      }

      await Promise.all([fetchAccounts(), fetchDepositRequests()]);
    } catch (err: any) {
      setDepositError(err.message || 'Error processing deposit');
    } finally {
      setDepositLoading(false);
    }
  };

  // Handle Withdraw
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccessMsg(null);

    const amountNum = parseFloat(withdrawAmountRupees);
    if (!amountNum || amountNum <= 0) {
      setWithdrawError('Please enter a valid withdrawal amount greater than ₹0.');
      return;
    }
    if (!selectedWithdrawAccountId) {
      setWithdrawError('Please select a source account.');
      return;
    }

    const currentAccount = accounts.find(a => a.id === selectedWithdrawAccountId);
    if (currentAccount && (amountNum * 100) > currentAccount.available_balance_paise) {
      setWithdrawError(`Insufficient funds. Available balance is ${formatINR(currentAccount.available_balance_paise)}.`);
      return;
    }

    try {
      setWithdrawLoading(true);
      const res = await authFetch('/api/v1/transactions/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': `wdr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        },
        body: JSON.stringify({
          accountId: selectedWithdrawAccountId,
          amountPaise: Math.round(amountNum * 100),
          amount: amountNum,
          description: `${withdrawDescription} (${withdrawSpeed.toUpperCase()})`
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Withdrawal failed');
      }

      setWithdrawSuccessMsg(`Dispersal of ₹${amountNum.toLocaleString('en-IN')} successfully cleared! Reference: ${json.data?.reference_number}`);
      await fetchAccounts();
    } catch (err: any) {
      setWithdrawError(err.message || 'Error executing withdrawal');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const selectedWithdrawAccount = accounts.find(a => a.id === selectedWithdrawAccountId);

  return (
    <AppShell activePath="deposit-withdraw">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Top Operational Banner & Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm uppercase tracking-wider font-semibold">
                Treasury Ops Level 4
              </span>
              <span className="text-on-surface-variant font-label-sm text-label-sm">
                • Continuous RTGS & IMPS Settlement Engine
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Deposit & Withdraw Capital
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Manage external institutional funding sources, programmatic liquidity sweeps, corporate dispatches, and atomic double-entry balance clearance.
            </p>
          </div>

          {/* Quick Liquidity Gauge Widget */}
          <div className="flex items-center gap-space-md bg-surface-container-lowest p-space-sm px-space-md rounded-xl shadow-sm">
            <div className="flex flex-col text-right">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                Unencumbered Balance
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
                {formatINR(totalLiquidityPaise)}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
          </div>
        </div>

        {/* Mode Selector Segmented Tabs */}
        <div className="flex p-1 bg-surface-container-low rounded-xl max-w-xl shadow-sm self-start">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-label-lg text-label-lg transition-all duration-150 ${
              activeTab === 'deposit'
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface font-medium'
            }`}
          >
            <span className={`material-symbols-outlined text-lg ${activeTab === 'deposit' ? 'text-secondary' : ''}`}>
              arrow_downward
            </span>
            Deposit Funds (Inbound Liquidity)
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-label-lg text-label-lg transition-all duration-150 ${
              activeTab === 'withdraw'
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface font-medium'
            }`}
          >
            <span className={`material-symbols-outlined text-lg ${activeTab === 'withdraw' ? 'text-secondary' : ''}`}>
              arrow_upward
            </span>
            Withdraw Funds (Outbound Capital)
          </button>
        </div>

        {/* DEPOSIT VIEW CONTAINER */}
        {activeTab === 'deposit' && (
          <div className="flex flex-col gap-space-lg">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
              {/* Inbound Instructions Card (8 Cols) */}
              <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
                <div className="flex flex-col gap-space-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-xl">account_tree</span>
                        <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                          Institutional Wiring Directives
                        </h2>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                        Use these sovereign identifiers for inbound RTGS, NEFT, IMPS, and domestic treasury sweeps directly into your primary operating vault.
                      </p>
                    </div>
                    <span className="self-start sm:self-auto px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-label-sm text-label-sm font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Real-time Ingestion Active
                    </span>
                  </div>

                  {/* Directive Parameter Badges Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-space-md pt-2">
                    {/* Beneficiary Name */}
                    <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                          Beneficiary Entity
                        </span>
                        <button
                          className="text-on-surface-variant hover:text-secondary p-1 rounded transition-colors"
                          onClick={() => copyToClipboard(user?.full_name || 'LedgerLine Custody FBO', 'bene')}
                          title="Copy"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {copiedField === 'bene' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                      <span className="font-label-md text-label-md text-on-surface font-semibold truncate pt-1">
                        {user?.full_name || 'LedgerLine Enterprise Vault'}
                      </span>
                    </div>

                    {/* Receiving Bank */}
                    <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                          Receiving Depository
                        </span>
                        <button
                          className="text-on-surface-variant hover:text-secondary p-1 rounded transition-colors"
                          onClick={() => copyToClipboard('Reserve Bank Custody / LedgerLine Node', 'bank')}
                          title="Copy"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {copiedField === 'bank' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                      <span className="font-label-md text-label-md text-on-surface font-semibold truncate pt-1">
                        Reserve Depository / Central Node
                      </span>
                    </div>

                    {/* Routing Number / IFSC */}
                    <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                          IFSC / Routing Code
                        </span>
                        <button
                          className="text-on-surface-variant hover:text-secondary p-1 rounded transition-colors"
                          onClick={() => copyToClipboard('LDGR0001849', 'ifsc')}
                          title="Copy"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {copiedField === 'ifsc' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                      <span className="font-label-md text-label-md text-on-surface font-mono font-semibold pt-1">
                        LDGR0001849
                      </span>
                    </div>

                    {/* Selected Virtual Account */}
                    <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                          Target Vault Account
                        </span>
                        <button
                          className="text-on-surface-variant hover:text-secondary p-1 rounded transition-colors"
                          onClick={() => {
                            const acct = accounts.find(a => a.id === selectedDepositAccountId);
                            if (acct) copyToClipboard(acct.account_number, 'acct');
                          }}
                          title="Copy"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {copiedField === 'acct' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                      <span className="font-label-md text-label-md text-on-surface font-mono font-semibold pt-1">
                        {accounts.find(a => a.id === selectedDepositAccountId)?.account_number || '•••• 8492'}
                      </span>
                    </div>

                    {/* SWIFT / BIC */}
                    <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                          SWIFT / BIC Code
                        </span>
                        <button
                          className="text-on-surface-variant hover:text-secondary p-1 rounded transition-colors"
                          onClick={() => copyToClipboard('LDGRINBBXXX', 'swift')}
                          title="Copy"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {copiedField === 'swift' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                      <span className="font-label-md text-label-md text-on-surface font-mono font-semibold pt-1">
                        LDGRINBBXXX
                      </span>
                    </div>

                    {/* Unique Memo Code */}
                    <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                          Mandatory Memo/Ref
                        </span>
                        <button
                          className="text-on-surface-variant hover:text-secondary p-1 rounded transition-colors"
                          onClick={() => copyToClipboard(`LDG-REF-${user?.id?.slice(0, 8)}`, 'memo')}
                          title="Copy"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {copiedField === 'memo' ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                      <span className="font-label-md text-label-md text-secondary font-mono font-bold pt-1">
                        {`LDG-REF-${user?.id?.slice(0, 8) || 'MAIN'}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-space-md p-space-sm bg-surface-container-high/40 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-on-surface-variant text-base">info</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Inbound RTGS settlements post within seconds. Double-entry ledger balanced atomically.
                    </span>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="font-label-sm text-label-sm font-semibold text-secondary hover:underline flex items-center gap-1"
                  >
                    Directives PDF
                    <span className="material-symbols-outlined text-xs">download</span>
                  </button>
                </div>
              </div>

              {/* Inbound Deposit Trigger Panel (4 Cols) */}
              <div className="lg:col-span-4 bg-primary-container text-white rounded-xl p-space-lg shadow-md flex flex-col justify-between border border-white/10">
                <form onSubmit={handleDepositSubmit} className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-cyan-400 text-xl">payments</span>
                      <span className="font-headline-sm text-headline-sm font-bold text-white">
                        {user?.role === 'ADMIN' ? 'Authorized Deposit' : 'Deposit Money Request'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-surface-container-lowest/15 text-cyan-400 font-label-sm text-label-sm uppercase font-mono">
                      {user?.role === 'ADMIN' ? 'Direct Settle' : 'Pending Review'}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-slate-300">
                    {user?.role === 'ADMIN'
                      ? 'As an Administrator, you can execute authorized deposits directly into any account with immediate balance crediting.'
                      : 'Submit a deposit request to add funds into your account. Once submitted, your request will be reviewed and approved by an administrator before funds are credited.'}
                  </p>

                  {depositError && (
                    <div className="p-2.5 rounded bg-red-900/60 text-red-200 text-xs font-medium">
                      {depositError}
                    </div>
                  )}
                  {depositSuccessMsg && (
                    <div className="p-2.5 rounded bg-emerald-900/60 text-emerald-200 text-xs font-medium">
                      {depositSuccessMsg}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 mt-space-sm">
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-slate-300 uppercase font-semibold">
                        Destination Account
                      </label>
                      <select
                        className="w-full bg-white/10 text-white font-label-md text-label-md rounded-lg py-2 pl-3 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer border border-white/20"
                        value={selectedDepositAccountId}
                        onChange={(e) => setSelectedDepositAccountId(e.target.value)}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} className="bg-slate-900 text-white" value={a.id}>
                            {a.account_type} •••• {a.account_number.slice(-4)} ({formatINR(a.balance_paise)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <label className="font-label-sm text-label-sm text-slate-300 uppercase font-semibold">
                          Deposit Amount (₹)
                        </label>
                        <span className="font-label-sm text-label-sm text-cyan-400">Zero Variance</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-headline-sm">
                          ₹
                        </span>
                        <input
                          className="w-full bg-white/10 text-white font-headline-sm text-headline-sm pl-8 pr-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono border border-white/20"
                          type="number"
                          step="0.01"
                          value={depositAmountRupees}
                          onChange={(e) => setDepositAmountRupees(e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-slate-300 uppercase font-semibold">
                        Deposit Memo / Reason
                      </label>
                      <input
                        className="w-full bg-white/10 text-white font-body-sm text-body-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400 border border-white/20"
                        type="text"
                        value={depositDescription}
                        onChange={(e) => setDepositDescription(e.target.value)}
                        placeholder="e.g. Salary Credit, Savings Deposit"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={depositLoading}
                    className="w-full mt-space-md py-3 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 hover:bg-tertiary-fixed-dim transition-all shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    <span>{depositLoading ? 'Submitting...' : user?.role === 'ADMIN' ? 'Authorize & Execute Deposit' : 'Submit Deposit Request for Approval'}</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                </form>
              </div>
            </div>

            {/* My Deposit Requests & Approvals History */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container-high flex flex-col gap-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-2 border-b border-surface-container">
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    My Inbound Deposit Requests
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Track the real-time status of your deposit requests through administrative approval and balance credit.
                  </p>
                </div>
                <button
                  onClick={fetchDepositRequests}
                  className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Refresh Status
                </button>
              </div>

              {loadingRequests ? (
                <div className="py-8 text-center text-on-surface-variant text-xs">Loading deposit history...</div>
              ) : userDepositRequests.length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant text-xs">
                  No deposit requests submitted yet. Use the form above to submit your first deposit request.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-surface-container text-on-surface-variant uppercase tracking-wider font-semibold">
                        <th className="pb-3 px-2">Ref / Memo</th>
                        <th className="pb-3 px-2">Target Account</th>
                        <th className="pb-3 px-2">Amount</th>
                        <th className="pb-3 px-2">Status</th>
                        <th className="pb-3 px-2">Submitted At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {userDepositRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-surface-container-low/40">
                          <td className="py-3 px-2 font-mono font-medium text-on-surface">
                            <div>{req.reference_number || req.reference_no}</div>
                            <div className="text-[10px] text-on-surface-variant font-sans">{req.description}</div>
                          </td>
                          <td className="py-3 px-2 font-mono text-on-surface">
                            {accounts.find(a => a.id === req.destination_account_id)?.account_number || req.destination_account_id?.slice(0, 8)}
                          </td>
                          <td className="py-3 px-2 font-mono font-bold text-on-surface">
                            {formatINR(req.amount_paise)}
                          </td>
                          <td className="py-3 px-2">
                            {req.status === 'PENDING' && (
                              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] uppercase flex items-center gap-1 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                Pending Approval
                              </span>
                            )}
                            {req.status === 'COMPLETED' && (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase flex items-center gap-1 w-fit">
                                <span className="material-symbols-outlined text-xs">check</span>
                                Approved & Credited
                              </span>
                            )}
                            {req.status === 'FAILED' && (
                              <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold text-[10px] uppercase flex items-center gap-1 w-fit" title={req.failure_reason}>
                                <span className="material-symbols-outlined text-xs">close</span>
                                Declined
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-on-surface-variant">
                            {new Date(req.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Linked Counterparty Sources */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Connected Treasury Counterparties
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Validated institutional counterparties eligible for automated liquidity ingestion.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between gap-space-md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center font-bold text-on-surface shadow-xs">
                        RBI
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-lg text-label-lg font-bold text-on-surface">Central Clearing Depository</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">RTGS Gateway •••• 1092</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-label-sm text-label-sm font-semibold">
                      Connected
                    </span>
                  </div>
                  <div className="flex items-end justify-between pt-space-xs">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">Status</span>
                      <span className="font-headline-sm text-headline-sm font-bold text-on-surface font-mono">Real-Time</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDepositDescription('Inbound from Central Clearing Gateway')}
                      className="text-secondary font-label-sm text-label-sm font-semibold hover:underline"
                    >
                      Use as Source
                    </button>
                  </div>
                </div>

                <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between gap-space-md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center font-bold text-on-surface shadow-xs">
                        SBI
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-lg text-label-lg font-bold text-on-surface">State Bank Liquidity Desk</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">Institutional Pool •••• 9811</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-label-sm text-label-sm font-semibold">
                      Connected
                    </span>
                  </div>
                  <div className="flex items-end justify-between pt-space-xs">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">Status</span>
                      <span className="font-headline-sm text-headline-sm font-bold text-on-surface font-mono">Settled</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDepositDescription('Inbound from State Bank Desk')}
                      className="text-secondary font-label-sm text-label-sm font-semibold hover:underline"
                    >
                      Use as Source
                    </button>
                  </div>
                </div>

                <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between gap-space-md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center font-bold text-on-surface shadow-xs">
                        HDFC
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-lg text-label-lg font-bold text-on-surface">HDFC Treasury Clearing</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">Corporate Sweep •••• 3301</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-label-sm text-label-sm font-semibold">
                      Connected
                    </span>
                  </div>
                  <div className="flex items-end justify-between pt-space-xs">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">Status</span>
                      <span className="font-headline-sm text-headline-sm font-bold text-on-surface font-mono">Immediate</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDepositDescription('Inbound from HDFC Treasury')}
                      className="text-secondary font-label-sm text-label-sm font-semibold hover:underline"
                    >
                      Use as Source
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WITHDRAW VIEW CONTAINER */}
        {activeTab === 'withdraw' && (
          <div className="flex flex-col gap-space-lg">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
              {/* Withdrawal Execution Panel (8 Cols) */}
              <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-lg">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-xl">payments</span>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      Capital Dispersal & Outbound Dispatches
                    </h2>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Remit capital from unencumbered primary liquidity to verified external institutional destinations with atomic balance checks.
                  </p>
                </div>

                {withdrawError && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm font-medium">
                    {withdrawError}
                  </div>
                )}
                {withdrawSuccessMsg && (
                  <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium">
                    {withdrawSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleWithdrawSubmit} className="flex flex-col gap-space-md">
                  {/* Source Account Picker */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                      Source Operating Vault
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low text-on-surface font-label-md text-label-md rounded-lg py-3 pl-3 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                        value={selectedWithdrawAccountId}
                        onChange={(e) => setSelectedWithdrawAccountId(e.target.value)}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id} disabled={a.status !== 'ACTIVE'}>
                            {a.account_type} •••• {a.account_number.slice(-4)} — Available: {formatINR(a.available_balance_paise)} {a.status !== 'ACTIVE' ? `(${a.status})` : ''}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                        unfold_more
                      </span>
                    </div>
                  </div>

                  {/* Dispersal Amount Input */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                        Dispersal Amount (₹)
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          Available:{' '}
                          <strong className="text-on-surface font-mono">
                            {selectedWithdrawAccount ? formatINR(selectedWithdrawAccount.available_balance_paise) : '₹0.00'}
                          </strong>
                        </span>
                        <button
                          type="button"
                          className="px-2 py-0.5 text-xs font-semibold rounded bg-surface-container-high text-secondary hover:bg-secondary hover:text-on-secondary transition-colors"
                          onClick={() => {
                            if (selectedWithdrawAccount) {
                              setWithdrawAmountRupees((selectedWithdrawAccount.available_balance_paise / 100).toFixed(2));
                            }
                          }}
                        >
                          Max
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-headline-md">
                        ₹
                      </span>
                      <input
                        className="w-full bg-surface-container-low text-on-surface font-headline-md text-headline-md pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        value={withdrawAmountRupees}
                        onChange={(e) => setWithdrawAmountRupees(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Description / Memo */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                      Outbound Memo / Justification
                    </label>
                    <input
                      className="w-full bg-surface-container-low text-on-surface font-body-sm text-body-sm px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                      placeholder="e.g. Authorized Vendor Remittance"
                      type="text"
                      value={withdrawDescription}
                      onChange={(e) => setWithdrawDescription(e.target.value)}
                      required
                    />
                  </div>

                  {/* Speed / Settlement Tier Selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                      Settlement Velocity
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                      <label
                        onClick={() => setWithdrawSpeed('standard')}
                        className={`p-space-sm rounded-lg flex flex-col gap-1 cursor-pointer transition-all border ${
                          withdrawSpeed === 'standard'
                            ? 'bg-surface-container-low border-secondary'
                            : 'bg-surface-container-low/60 border-transparent hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <input
                            type="radio"
                            name="speed"
                            checked={withdrawSpeed === 'standard'}
                            onChange={() => setWithdrawSpeed('standard')}
                            className="text-secondary focus:ring-0"
                          />
                          <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">₹0.00 Fee</span>
                        </div>
                        <span className="font-label-md text-label-md font-bold text-on-surface">Standard NEFT</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">Batch window (15 mins)</span>
                      </label>

                      <label
                        onClick={() => setWithdrawSpeed('rtgs')}
                        className={`p-space-sm rounded-lg flex flex-col gap-1 cursor-pointer transition-all border ${
                          withdrawSpeed === 'rtgs'
                            ? 'bg-surface-container-low border-secondary'
                            : 'bg-surface-container-low/60 border-transparent hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <input
                            type="radio"
                            name="speed"
                            checked={withdrawSpeed === 'rtgs'}
                            onChange={() => setWithdrawSpeed('rtgs')}
                            className="text-secondary focus:ring-0"
                          />
                          <span className="font-label-sm text-label-sm text-secondary font-mono">Immediate</span>
                        </div>
                        <span className="font-label-md text-label-md font-bold text-on-surface">RTGS / IMPS Outbound</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">Immediate Gross Finality</span>
                      </label>

                      <label
                        onClick={() => setWithdrawSpeed('sweep')}
                        className={`p-space-sm rounded-lg flex flex-col gap-1 cursor-pointer transition-all border ${
                          withdrawSpeed === 'sweep'
                            ? 'bg-surface-container-low border-secondary'
                            : 'bg-surface-container-low/60 border-transparent hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <input
                            type="radio"
                            name="speed"
                            checked={withdrawSpeed === 'sweep'}
                            onChange={() => setWithdrawSpeed('sweep')}
                            className="text-secondary focus:ring-0"
                          />
                          <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">Scheduled</span>
                        </div>
                        <span className="font-label-md text-label-md font-bold text-on-surface">Treasury Sweep</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">Post 4:30 PM Batch</span>
                      </label>
                    </div>
                  </div>

                  {/* Compliance & Dual-Signoff Guardrail Box */}
                  <div className="p-space-md rounded-xl bg-amber-50 flex items-start gap-space-md">
                    <span className="material-symbols-outlined text-amber-700 text-2xl mt-0.5">verified_user</span>
                    <div className="flex flex-col gap-1">
                      <span className="font-label-md text-label-md font-bold text-amber-900 uppercase tracking-wide">
                        Dual-Signoff Protocol Enforced
                      </span>
                      <p className="font-body-sm text-body-sm text-amber-900/80">
                        Dispersals exceeding threshold require secondary cryptographic signoff. All ledger entries are recorded with immutable double-entry journal balance.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-space-md pt-space-xs">
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard')}
                      className="px-5 py-2.5 rounded-lg text-on-surface-variant hover:text-on-surface font-label-md text-label-md font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={withdrawLoading || user?.role === 'AUDITOR'}
                      className="px-8 py-3 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-bold flex items-center gap-2 hover:bg-on-surface transition-all shadow-md disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-lg">send</span>
                      {withdrawLoading ? 'Authorizing Dispersal...' : 'Execute Dispersal Request'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Policy & Limits Overview (4 Cols) */}
              <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
                <div className="flex flex-col gap-space-md">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Policy & Limits Overview
                  </h3>
                  <div className="flex flex-col gap-space-sm divide-y divide-surface-container">
                    <div className="pt-2 flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Daily Dispersal Limit:</span>
                      <span className="font-semibold text-on-surface font-mono">₹5,00,00,000</span>
                    </div>
                    <div className="pt-2 flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Settlement Network:</span>
                      <span className="font-semibold text-emerald-700">Active & Available</span>
                    </div>
                    <div className="pt-2 flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Central RTGS Window:</span>
                      <span className="font-semibold text-on-surface">24x7x365</span>
                    </div>
                    <div className="pt-2 flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Double-Entry Ledger:</span>
                      <span className="font-semibold text-secondary">Balanced Invariant</span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-container-low rounded-lg text-xs text-on-surface-variant">
                    All financial operations create immutable entries in the ledger. Completed entries cannot be modified or deleted.
                  </div>
                </div>

                <div className="pt-4 border-t border-surface-container-low text-xs text-outline flex items-center justify-between">
                  <span>Audit Engine v4.19</span>
                  <span className="font-mono">ENCRYPTED-TLS-1.3</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
