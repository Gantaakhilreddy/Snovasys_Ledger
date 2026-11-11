'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

function TransferMoneyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const defaultFromId = searchParams.get('source') || searchParams.get('from');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Transfer Form State
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destinationAccount, setDestinationAccount] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [description, setDescription] = useState('');

  // Execution states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoadingAccounts(true);
        const res = await authFetch('/api/v1/accounts?limit=100');
        if (res.ok) {
          const json = await res.json();
          const accts: Account[] = json.data || [];
          setAccounts(accts);

          const active = accts.filter(a => a.status === 'ACTIVE');
          if (defaultFromId && accts.some(a => a.id === defaultFromId || a.account_number === defaultFromId)) {
            const matched = accts.find(a => a.id === defaultFromId || a.account_number === defaultFromId);
            if (matched) setSourceAccountId(matched.id);
          } else if (active.length > 0) {
            setSourceAccountId(active[0].id);
          } else if (accts.length > 0) {
            setSourceAccountId(accts[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load accounts for transfer', err);
      } finally {
        setLoadingAccounts(false);
      }
    }
    loadAccounts();
  }, [defaultFromId]);

  const selectedSource = accounts.find(a => a.id === sourceAccountId);

  const formatINR = (paise: number | string | bigint) => {
    const p = typeof paise === 'bigint' ? Number(paise) : typeof paise === 'string' ? parseFloat(paise) : Number(paise);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format((isNaN(p) ? 0 : p) / 100);
  };

  const amountPaise = (parseFloat(amountRupees) || 0) * 100;
  const isOverBalance = selectedSource && amountPaise > 0 && amountPaise > Number(selectedSource.balance_paise);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessResult(null);

    const amountNum = parseFloat(amountRupees);
    if (!amountNum || amountNum <= 0) {
      setErrorMessage('Please enter a valid transfer amount greater than ₹0.');
      return;
    }
    if (!sourceAccountId) {
      setErrorMessage('Please select a source account to send money from.');
      return;
    }
    const destClean = destinationAccount.trim();
    if (!destClean) {
      setErrorMessage('Please enter the recipient account number or account ID.');
      return;
    }

    if (selectedSource && amountPaise > selectedSource.balance_paise) {
      setErrorMessage(`Insufficient balance: Source account available balance is ${formatINR(selectedSource.balance_paise)}, requested ${formatINR(amountPaise)}.`);
      return;
    }

    if (selectedSource && (selectedSource.account_number.toLowerCase() === destClean.toLowerCase() || selectedSource.id === destClean)) {
      setErrorMessage('Source and destination accounts cannot be the same. Please specify another recipient account.');
      return;
    }

    try {
      setIsSubmitting(true);
      const idempotencyKey = `xfer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const res = await authFetch('/api/v1/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          sourceAccountId,
          destinationAccountNumber: destClean,
          amountPaise,
          amount: amountNum,
          description: description.trim() || 'Direct Account Transfer',
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Transfer failed');
      }

      setSuccessResult(json.data);
      setAmountRupees('');
      setDestinationAccount('');
      setDescription('');

      // Reload accounts for updated balances
      const acctRes = await authFetch('/api/v1/accounts?limit=100');
      if (acctRes.ok) {
        const acctJson = await acctRes.json();
        setAccounts(acctJson.data || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete fund transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell activePath="transfer-money">
      <div className="flex flex-col w-full gap-space-lg pb-space-xl max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
            <span className="font-semibold text-secondary">Payments & Transfers</span>
            <span>/</span>
            <span className="text-on-surface font-semibold">Send Money</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Transfer Money
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Transfer funds instantly between LedgerLine accounts. Enter the recipient's account ID or account number and verify funds are available.
          </p>
        </div>

        {/* Success Confirmation Card */}
        {successResult && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline-sm font-bold text-emerald-900">
                  Transfer Successfully Completed!
                </h3>
                <p className="text-sm text-emerald-800 mt-0.5">
                  Reference: <span className="font-mono font-bold">{successResult.reference_number || successResult.reference_no}</span> • Amount:{' '}
                  <strong>{formatINR(successResult.amount_paise)}</strong>
                </p>
                <span className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Atomic double-entry ledger entries written and balances updated.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/transactions')}
                className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition-colors shadow-xs"
              >
                View History
              </button>
              <button
                onClick={() => setSuccessResult(null)}
                className="px-3 py-2 text-emerald-800 text-xs font-semibold hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 shadow-sm flex items-start gap-3 text-red-800 animate-in fade-in duration-200">
            <span className="material-symbols-outlined text-red-600 text-2xl shrink-0 mt-0.5">error</span>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-sm">Transfer Failed</span>
              <p className="text-xs text-red-700">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Streamlined Transfer Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleSubmit} className="lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-6 flex flex-col gap-6">
            {/* Step 1: Source Account */}
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-label-md font-semibold text-on-surface uppercase tracking-wider text-xs">
                From Account (Source)
              </label>
              <div className="relative">
                <select
                  className="w-full bg-surface-container-low text-on-surface font-semibold text-sm py-3 px-3.5 rounded-lg appearance-none cursor-pointer border border-surface-container-high focus:outline-none focus:border-secondary shadow-xs pr-10"
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  disabled={loadingAccounts || isSubmitting}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.status !== 'ACTIVE'}>
                      {a.account_type} Account ({a.account_number}) — Balance: {formatINR(a.balance_paise)} {a.status !== 'ACTIVE' ? `[${a.status}]` : ''}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                  unfold_more
                </span>
              </div>

              {selectedSource && (
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-surface-container-low/60 border border-surface-container-high text-xs text-on-surface-variant">
                  <span>Available Balance: <strong className="text-on-surface font-mono">{formatINR(selectedSource.balance_paise)}</strong></span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    selectedSource.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedSource.status}
                  </span>
                </div>
              )}
            </div>

            {/* Step 2: Destination Account */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-label-md text-label-md font-semibold text-on-surface uppercase tracking-wider text-xs">
                  To Account (Recipient)
                </label>
                <span className="text-[11px] text-on-surface-variant">Account Number or Account ID</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  className="w-full bg-surface-container-low text-on-surface text-sm px-3.5 py-3 rounded-lg border border-surface-container-high focus:outline-none focus:border-secondary font-mono placeholder:font-sans placeholder:text-outline"
                  placeholder="e.g. LL-SAV-84588546 or Account UUID"
                  value={destinationAccount}
                  onChange={(e) => setDestinationAccount(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <p className="text-[11px] text-on-surface-variant">
                The money will only move if the recipient account exists in LedgerLine and is active.
              </p>
            </div>

            {/* Step 3: Transfer Amount */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-label-md text-label-md font-semibold text-on-surface uppercase tracking-wider text-xs">
                  Transfer Amount
                </label>
                {selectedSource && (
                  <button
                    type="button"
                    onClick={() => setAmountRupees((selectedSource.balance_paise / 100).toString())}
                    className="text-[11px] font-semibold text-secondary hover:underline cursor-pointer"
                  >
                    Transfer Max ({formatINR(selectedSource.balance_paise)})
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-lg">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className={`w-full bg-surface-container-low text-on-surface font-headline-md text-headline-md pl-9 pr-4 py-3 rounded-lg border focus:outline-none focus:border-secondary font-mono ${
                    isOverBalance ? 'border-red-400 bg-red-50/30' : 'border-surface-container-high'
                  }`}
                  placeholder="0.00"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {['500', '1000', '5000', '10000', '50000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountRupees(amt)}
                    className="px-2.5 py-1 rounded-md bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors border border-surface-container-high"
                  >
                    +₹{parseInt(amt).toLocaleString('en-IN')}
                  </button>
                ))}
              </div>

              {isOverBalance && (
                <span className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Amount exceeds available balance ({formatINR(selectedSource?.balance_paise || 0)}).
                </span>
              )}
            </div>

            {/* Step 4: Transfer Note / Description */}
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-label-md font-semibold text-on-surface uppercase tracking-wider text-xs">
                Description / Memo (Optional)
              </label>
              <input
                type="text"
                className="w-full bg-surface-container-low text-on-surface text-sm px-3.5 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:border-secondary placeholder:text-outline"
                placeholder="e.g. Vendor Payment, Rent, Personal Settlement"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2.5 text-on-surface-variant hover:text-on-surface font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isOverBalance || !sourceAccountId || !destinationAccount.trim() || !amountRupees || user?.role === 'AUDITOR'}
                className="px-6 py-3 rounded-lg bg-primary-container text-on-primary font-semibold text-xs flex items-center gap-2 hover:bg-secondary transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">send</span>
                {isSubmitting ? 'Verifying & Transferring...' : 'Transfer Money Now'}
              </button>
            </div>
          </form>

          {/* Transfer Summary & Security Assurance (Right Column) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-surface-container-high flex flex-col gap-4">
              <h3 className="font-headline-sm font-bold text-on-surface text-sm">
                Transfer Summary
              </h3>

              <div className="flex flex-col gap-2.5 divide-y divide-surface-container text-xs">
                <div className="flex justify-between items-center pt-2">
                  <span className="text-on-surface-variant">Sending From:</span>
                  <span className="font-mono font-semibold text-on-surface">
                    {selectedSource ? selectedSource.account_number : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-on-surface-variant">Recipient:</span>
                  <span className="font-mono font-semibold text-on-surface truncate max-w-[150px]">
                    {destinationAccount || '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-on-surface-variant">Transfer Amount:</span>
                  <span className="font-mono font-bold text-sm text-on-surface">
                    {amountRupees ? formatINR(amountPaise) : '₹0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-on-surface-variant">Transfer Fee:</span>
                  <span className="font-semibold text-emerald-700">₹0.00 (Zero Fee)</span>
                </div>
                <div className="flex justify-between items-center pt-2 font-bold text-on-surface">
                  <span>Total Debit:</span>
                  <span className="font-mono text-sm">{amountRupees ? formatINR(amountPaise) : '₹0.00'}</span>
                </div>
              </div>

              {/* Security Box */}
              <div className="bg-surface-container-low/70 p-3.5 rounded-lg border border-surface-container-high flex flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-on-surface">
                  <span className="material-symbols-outlined text-emerald-600 text-base">verified_user</span>
                  <span>Atomic Execution</span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  LedgerLine verifies recipient identity and source balance before moving money. Transactions are balanced with zero loss and full audit tracking.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function TransferMoneyPage() {
  return (
    <React.Suspense fallback={<div className="p-12 text-center text-on-surface-variant font-medium">Loading transfer console...</div>}>
      <TransferMoneyContent />
    </React.Suspense>
  );
}
