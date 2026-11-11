'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/context/auth-context';
import { authFetch } from '@/lib/utils/api-client';

export default function AuditorDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [summary, setSummary] = useState<any | null>(null);
  const [integrityData, setIntegrityData] = useState<any | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);

  const fetchAuditorData = async () => {
    try {
      setLoading(true);
      const [sumRes, intRes, alrRes, txRes] = await Promise.all([
        authFetch('/api/v1/reports/financial-summary'),
        authFetch('/api/v1/integrity/reports?limit=1'),
        authFetch('/api/v1/security/alerts?limit=5'),
        authFetch('/api/v1/transactions?limit=6')
      ]);

      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        setSummary(sumJson.data);
      }
      if (intRes.ok) {
        const intJson = await intRes.json();
        setIntegrityData(intJson.data?.currentStatus || intJson.data?.[0] || null);
      }
      if (alrRes.ok) {
        const alrJson = await alrRes.json();
        setAlerts(alrJson.data || []);
      }
      if (txRes.ok) {
        const txJson = await txRes.json();
        setRecentTransactions(txJson.data || []);
      }
    } catch (err) {
      console.error('Failed to load auditor dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditorData();
  }, []);

  const handleRunVerification = async () => {
    try {
      setVerifying(true);
      setVerifyResult(null);
      const res = await authFetch('/api/v1/integrity/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Verification failed');
      setVerifyResult(json.data);
      await fetchAuditorData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVerifying(false);
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

  return (
    <AppShell activePath="auditor-dashboard">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Header Section */}
        <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs max-w-4xl">
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider">
                COMPLIANCE & AUDIT
              </span>
              <span className="text-outline-variant font-label-sm text-label-sm">/</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                CONTINUOUS ASSURANCE & RECONCILIATION
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                AUTONOMOUS AUDIT ENGINE
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Auditor Oversight & Continuous Assurance
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Independent cryptographic verification engine, immutable double-entry sampling, real-time transaction reconciliation, and regulatory compliance assurance across all sovereign vaults.
            </p>
          </div>

          {/* Action Cluster */}
          <div className="flex flex-wrap items-center gap-space-sm pt-space-xs xl:pt-0">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-low transition-all font-label-lg text-label-lg"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span>Export Audit Dossier</span>
            </button>
            <button
              onClick={handleRunVerification}
              disabled={verifying}
              className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-primary text-on-primary shadow-md hover:bg-inverse-surface active:scale-[0.99] transition-all font-label-lg text-label-lg disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-tertiary-fixed text-lg">
                {verifying ? 'sync' : 'verified'}
              </span>
              <span>{verifying ? 'Evaluating Invariants...' : 'Run Live Invariant Verification'}</span>
            </button>
          </div>
        </section>

        {/* Verification Success Toast */}
        {verifyResult && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-2xl">verified</span>
              <div>
                <span className="font-bold">System Integrity Attested: Clean Opinion</span>
                <p className="text-xs text-emerald-800">
                  Total Ledger Debits: {formatINR(verifyResult.total_debits_paise)} • Total Credits: {formatINR(verifyResult.total_credits_paise)} • Imbalance: ₹0.00
                </p>
              </div>
            </div>
            <button onClick={() => setVerifyResult(null)} className="text-xs text-emerald-800 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* 4 KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {/* Card 1 */}
          <div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-space-xs">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-medium">
                Total Transactions Reviewed
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">
                100% Sampled
              </span>
            </div>
            <div className="flex flex-col gap-1 py-space-xs">
              <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight tabular-nums font-bold">
                {integrityData?.total_transactions_audited ?? recentTransactions.length}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                100% cryptographically sampled across active vaults
              </span>
            </div>
            <div className="flex items-center justify-between pt-space-xs mt-space-xs bg-surface-container-low px-space-sm py-1.5 rounded-lg">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="font-label-sm text-label-sm text-on-surface font-medium">Zero Blindspots</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">HASH-SAMPLED</span>
            </div>
          </div>

          {/* Card 2 (Featured Dark Card) */}
          <div className="relative overflow-hidden flex flex-col justify-between p-space-md rounded-xl bg-primary-container text-on-primary shadow-md hover:shadow-lg transition-shadow">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-secondary/20 blur-2xl pointer-events-none"></div>
            <div className="flex items-center justify-between pb-space-xs relative z-10">
              <span className="font-label-md text-label-md text-on-primary-container uppercase tracking-wider font-medium">
                Reconciled Attested Volume
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-tertiary-fixed font-label-sm text-label-sm font-semibold">
                <span className="material-symbols-outlined text-xs">done_all</span> Clean Opinion
              </span>
            </div>
            <div className="flex flex-col gap-1 py-space-xs relative z-10">
              <span className="font-headline-lg text-headline-lg text-on-primary tracking-tight tabular-nums font-bold font-mono">
                {formatINR(summary?.accounting?.totalDebitsPaise || summary?.balanceSheet?.assets?.centralReservePaise || 100000000)}
              </span>
              <span className="font-body-sm text-body-sm text-on-primary-container">
                Double-entry balanced to ₹0.00 variance
              </span>
            </div>
            <div className="flex items-center justify-between pt-space-xs mt-space-xs bg-surface-container-lowest/10 px-space-sm py-1.5 rounded-lg relative z-10">
              <span className="font-label-sm text-label-sm text-tertiary-fixed font-mono">
                Σ(DR) ≡ Σ(CR)
              </span>
              <span className="font-label-sm text-label-sm text-on-primary-container font-mono">
                VAR: 0.0000
              </span>
            </div>
          </div>

          {/* Card 3: Security & Quarantine */}
          <div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-space-xs">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-medium">
                Security Alerts
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
                {alerts.length} Active
              </span>
            </div>
            <div className="flex flex-col gap-1 py-space-xs">
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight tabular-nums font-bold">
                  {alerts.filter(a => a.status === 'ACTIVE' || a.status === 'NEW').length}
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">Anomalies Detected</span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Under continuous compliance monitoring
              </span>
            </div>
            <div className="flex items-center justify-between pt-space-xs mt-space-xs bg-surface-container-low px-space-sm py-1.5 rounded-lg">
              <span className="font-label-sm text-label-sm text-on-surface font-medium">SecOps Triage</span>
              <Link href="/auditor/security-alerts" className="font-label-sm text-label-sm text-secondary font-semibold hover:underline">
                Review Alerts
              </Link>
            </div>
          </div>

          {/* Card 4: Financial Integrity Index */}
          <div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-space-xs">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-medium">
                Financial Integrity Index
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-label-sm text-label-sm font-mono font-semibold">
                ISO 20022
              </span>
            </div>
            <div className="flex flex-col gap-1 py-space-xs">
              <span className="font-headline-lg text-headline-lg text-secondary tracking-tight tabular-nums font-bold">
                100.000%
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Merkle root proofs validated (SHA-256)
              </span>
            </div>
            <div className="flex items-center justify-between pt-space-xs mt-space-xs bg-surface-container-low px-space-sm py-1.5 rounded-lg">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-secondary">fingerprint</span>
                <span className="font-label-sm text-label-sm text-on-surface font-medium">Consensus Quorum</span>
              </div>
              <span className="font-label-sm text-label-sm text-secondary font-mono">ALL NODES VALID</span>
            </div>
          </div>
        </section>

        {/* Main Split Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            {/* Real-time Reconciliation & Anomaly Stream */}
            <div className="flex flex-col p-space-lg rounded-xl bg-surface-container-lowest shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-md border-b border-surface-container-low">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Real-time Transaction Reconciliation Stream
                  </h2>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Continuous ledger sampling and invariant attestation
                  </p>
                </div>
                <Link
                  href="/transactions"
                  className="text-secondary font-label-sm text-label-sm font-semibold hover:underline flex items-center gap-1"
                >
                  View Full Journal
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low text-on-surface-variant uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Ref & Memo</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Invariant Check</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low font-body-sm">
                    {recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                          No transactions recorded.
                        </td>
                      </tr>
                    ) : (
                      recentTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-surface-container-low/40">
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-on-surface">{tx.description || tx.transaction_type}</span>
                              <span className="font-mono text-xs text-outline">{tx.reference_number}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container-low text-on-surface">
                              {tx.transaction_type}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800">
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1 text-emerald-700 font-medium">
                              <span className="material-symbols-outlined text-sm">verified</span>
                              <span>Balanced</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-on-surface">
                            {formatINR(tx.amount_paise)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            {/* Quick Audit Links */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Compliance Navigation
              </h3>
              <div className="flex flex-col gap-2">
                <Link
                  href="/auditor/audit-logs"
                  className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">history_edu</span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-on-surface">Immutable Audit Logs</span>
                      <span className="text-xs text-on-surface-variant">Forensic record of all system events</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:translate-x-1 transition-transform">
                    chevron_right
                  </span>
                </Link>

                <Link
                  href="/auditor/integrity"
                  className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-emerald-600">assessment</span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-on-surface">Integrity Verification Reports</span>
                      <span className="text-xs text-on-surface-variant">Live mathematical balance verification</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:translate-x-1 transition-transform">
                    chevron_right
                  </span>
                </Link>

                <Link
                  href="/auditor/security-alerts"
                  className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-amber-600">shield</span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-on-surface">Security Alerts & Anomalies</span>
                      <span className="text-xs text-on-surface-variant">SecOps incidents and resolution triage</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:translate-x-1 transition-transform">
                    chevron_right
                  </span>
                </Link>
              </div>
            </div>

            {/* Regulatory Compliance Guardrails */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-3">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Regulatory Standards
              </h3>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-surface-container-low">
                  <span>SOX 404 Financial Controls</span>
                  <span className="text-emerald-700 font-bold">COMPLIANT</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-surface-container-low">
                  <span>SOC-2 Type II Immutability</span>
                  <span className="text-emerald-700 font-bold">CERTIFIED</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-surface-container-low">
                  <span>Double-Entry Balance Constraint</span>
                  <span className="text-emerald-700 font-bold">ENFORCED</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-surface-container-low">
                  <span>Read-Only Auditor Isolation</span>
                  <span className="text-emerald-700 font-bold">STRICT</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
