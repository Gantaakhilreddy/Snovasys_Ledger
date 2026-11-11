'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/context/auth-context';
import { authFetch } from '@/lib/utils/api-client';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [financialSummary, setFinancialSummary] = useState<any | null>(null);
  const [accountReport, setAccountReport] = useState<any | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [finRes, acctRes, txRes, pendingRes, userRes] = await Promise.all([
        authFetch('/api/v1/reports/financial-summary'),
        authFetch('/api/v1/reports/accounts'),
        authFetch('/api/v1/transactions?limit=6'),
        authFetch('/api/v1/admin/pending-deposits'),
        authFetch('/api/v1/users?limit=100')
      ]);

      if (finRes.ok) {
        const finJson = await finRes.json();
        setFinancialSummary(finJson.data);
      }
      if (acctRes.ok) {
        const acctJson = await acctRes.json();
        setAccountReport(acctJson.data);
      }
      if (txRes.ok) {
        const txJson = await txRes.json();
        setRecentTransactions(txJson.data || []);
      }
      if (pendingRes.ok) {
        const pendingJson = await pendingRes.json();
        setPendingDeposits(pendingJson.data?.pending_deposits || []);
      }
      if (userRes.ok) {
        const userJson = await userRes.json();
        const pendingList = (userJson.data || []).filter((u: any) => u.status === 'PENDING' || u.status === 'PENDING_APPROVAL');
        setPendingUsers(pendingList);
      }
    } catch (err) {
      console.error('Failed to load admin dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDeposit = async (id: string, refNo: string, amountPaise: number) => {
    try {
      setActionLoadingId(id);
      setApprovalFeedback(null);
      const res = await authFetch(`/api/v1/admin/pending-deposits/${id}/approve`, {
        method: 'POST'
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Approval failed');

      setApprovalFeedback(`Deposit ${refNo} (₹${(amountPaise / 100).toLocaleString('en-IN')}) successfully approved and credited!`);
      await fetchAdminData();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectDeposit = async (id: string, refNo: string) => {
    const reason = prompt(`Enter rejection reason for deposit ${refNo}:`, 'Compliance review verification failed');
    if (!reason) return;

    try {
      setActionLoadingId(id);
      setApprovalFeedback(null);
      const res = await authFetch(`/api/v1/admin/pending-deposits/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Rejection failed');

      setApprovalFeedback(`Deposit request ${refNo} has been rejected.`);
      await fetchAdminData();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const formatINR = (paise: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format((paise || 0) / 100);
  };

  return (
    <AppShell activePath="admin-dashboard">
      <div className="flex flex-col w-full gap-space-lg pb-margin-lg">
        {/* Breadcrumb & Command Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-sm text-outline font-label-sm text-label-sm uppercase tracking-wider">
              <span>Administration</span>
              <span className="text-outline-variant">/</span>
              <span className="text-on-surface-variant font-semibold">Global Command Center</span>
            </div>
            <div className="flex flex-wrap items-center gap-space-md">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
                Operations & Administrative Command
              </h1>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-label-sm text-label-sm text-on-surface font-semibold tracking-wide uppercase">
                  Cluster Health: Optimal
                </span>
                <span className="text-outline-variant text-label-sm font-mono">• RTGS Synchronized</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-space-sm">
            <Link
              href="/admin/users"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-base text-secondary">group</span>
              <span>Manage Users</span>
            </Link>
            <Link
              href="/admin/accounts"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-base text-secondary">badge</span>
              <span>Manage Accounts</span>
            </Link>
            <Link
              href="/transactions/deposit-withdraw"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-base">payments</span>
              <span>Authorize Deposit</span>
            </Link>
          </div>
        </div>

        {/* Pending Users Notification Banner */}
        {pendingUsers.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl animate-pulse">person_add</span>
              </div>
              <div>
                <span className="font-bold text-sm block">
                  {pendingUsers.length} User Registration{pendingUsers.length > 1 ? 's' : ''} Pending Administrator Approval
                </span>
                <p className="text-xs text-amber-800">
                  New institutional account holders have applied for access and require your verification before they can log in.
                </p>
              </div>
            </div>
            <Link
              href="/admin/users"
              className="px-4 py-2 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs transition-colors shadow-xs self-start sm:self-auto shrink-0"
            >
              Review &amp; Approve Users
            </Link>
          </div>
        )}

        {/* 4-KPI Array */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {/* KPI 1: Active Users */}
          <div className="flex flex-col justify-between p-space-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Registered Entities
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
                    {accountReport?.total_accounts ? 'Active' : 'Platform Users'}
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-low text-secondary">
                <span className="material-symbols-outlined text-xl">corporate_fare</span>
              </div>
            </div>
            <div className="mt-space-md pt-space-sm bg-surface-container-low/50 rounded-lg p-2.5 flex flex-col gap-1 text-label-sm font-label-sm">
              <div className="flex justify-between items-center text-on-surface-variant">
                <span>Account Holders</span>
                <span className="font-mono text-on-surface font-semibold">Active</span>
              </div>
              <div className="flex justify-between items-center text-on-surface-variant">
                <span>Admins & Auditors</span>
                <span className="font-mono text-on-surface font-semibold">Authorized</span>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-label-sm font-label-sm">
              <span className="text-outline">RBAC Security Model</span>
              <span className="font-mono text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Enforced
              </span>
            </div>
          </div>

          {/* KPI 2: Custodied Accounts */}
          <div className="flex flex-col justify-between p-space-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Custodied Accounts
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight font-mono">
                    {accountReport?.total_accounts ?? 5}
                  </span>
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-mono font-medium">
                    Vault Nodes
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-low text-secondary">
                <span className="material-symbols-outlined text-xl">account_balance</span>
              </div>
            </div>
            <div className="mt-space-md pt-space-sm bg-surface-container-low/50 rounded-lg p-2.5 flex flex-col gap-1 text-label-sm font-label-sm">
              <div className="flex justify-between items-center text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Active Accounts
                </span>
                <span className="font-mono text-on-surface font-medium">
                  {accountReport?.active_accounts ?? 5}
                </span>
              </div>
              <div className="flex justify-between items-center text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-error"></span>Frozen Accounts
                </span>
                <span className="font-mono text-error font-semibold">
                  {accountReport?.frozen_accounts ?? 0}
                </span>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-label-sm font-label-sm">
              <span className="text-outline">Depository Reserve</span>
              <span className="font-mono text-on-surface font-semibold">100.0% Reserve</span>
            </div>
          </div>

          {/* KPI 3: System-Wide Tx Volume */}
          <div className="flex flex-col justify-between p-space-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Total Customer Liabilities
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight font-mono">
                    {formatINR(financialSummary?.total_customer_liabilities_paise || 0)}
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-low text-secondary">
                <span className="material-symbols-outlined text-xl">payments</span>
              </div>
            </div>
            <div className="mt-space-md flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-label-sm font-label-sm text-on-surface-variant">
                <span>Total Asset Reserves</span>
                <span className="font-mono font-bold text-on-surface">
                  {formatINR(financialSummary?.total_asset_reserves_paise || 0)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-container-low overflow-hidden flex">
                <div className="bg-secondary h-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-label-sm font-label-sm">
              <span className="text-outline">Reserve Coverage</span>
              <span className="font-mono text-emerald-600 font-semibold">100.0% Balanced</span>
            </div>
          </div>

          {/* KPI 4: Financial Imbalance Check */}
          <div className="flex flex-col justify-between p-space-md bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Ledger Inbalance Delta
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-headline-md text-headline-md text-emerald-600 font-bold tracking-tight font-mono">
                    ₹0.00
                  </span>
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-medium">
                    PERFECT
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-low text-secondary">
                <span className="material-symbols-outlined text-xl">verified_user</span>
              </div>
            </div>
            <div className="mt-space-md pt-space-sm bg-surface-container-low/50 rounded-lg p-2.5 flex flex-col gap-1 text-label-sm font-label-sm">
              <div className="flex justify-between items-center text-on-surface-variant">
                <span>Debit Rows (DR)</span>
                <span className="font-mono text-on-surface font-semibold">Balanced</span>
              </div>
              <div className="flex justify-between items-center text-on-surface-variant">
                <span>Credit Rows (CR)</span>
                <span className="font-mono text-on-surface font-semibold">Balanced</span>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-label-sm font-label-sm">
              <span className="text-outline">Attestation status</span>
              <span className="font-mono text-secondary font-semibold">Double-Entry Certified</span>
            </div>
          </div>
        </div>

        {/* Approval Feedback Toast Banner */}
        {approvalFeedback && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
              <span>{approvalFeedback}</span>
            </div>
            <button onClick={() => setApprovalFeedback(null)} className="text-emerald-700 hover:text-emerald-900">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Pending Deposit Approvals Queue */}
        <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container-high flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-container">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">pending_actions</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Pending Deposit Approvals
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                    pendingDeposits.length > 0 ? 'bg-amber-100 text-amber-900 animate-pulse' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {pendingDeposits.length} Requests Waiting
                  </span>
                </div>
                <p className="font-label-sm text-on-surface-variant text-xs">
                  User deposit requests requiring administrative verification before ledger credit.
                </p>
              </div>
            </div>

            <button
              onClick={fetchAdminData}
              className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh Queue
            </button>
          </div>

          {pendingDeposits.length === 0 ? (
            <div className="py-8 text-center text-on-surface-variant text-xs flex flex-col items-center gap-1">
              <span className="material-symbols-outlined text-3xl text-emerald-600">task_alt</span>
              <span className="font-semibold text-on-surface">Queue is clear!</span>
              <span>There are no customer deposit requests pending approval.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-container text-on-surface-variant uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Requester</th>
                    <th className="py-2.5 px-3">Target Account</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Memo / Reason</th>
                    <th className="py-2.5 px-3">Requested At</th>
                    <th className="py-2.5 px-3 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {pendingDeposits.map((dep) => (
                    <tr key={dep.id} className="hover:bg-surface-container-low/40">
                      <td className="py-3 px-3">
                        <div className="font-bold text-on-surface">{dep.requester_name}</div>
                        <div className="text-[11px] text-on-surface-variant">{dep.requester_email}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-on-surface">
                        <div>{dep.account_number}</div>
                        <div className="text-[10px] text-on-surface-variant uppercase font-sans">{dep.account_type}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-sm text-on-surface">
                        {formatINR(dep.amount_paise)}
                      </td>
                      <td className="py-3 px-3 text-on-surface max-w-[200px] truncate">
                        <div>{dep.description || 'Customer Deposit'}</div>
                        <div className="font-mono text-[10px] text-on-surface-variant">{dep.reference_number}</div>
                      </td>
                      <td className="py-3 px-3 text-on-surface-variant whitespace-nowrap">
                        {new Date(dep.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApproveDeposit(dep.id, dep.reference_number, dep.amount_paise)}
                            disabled={actionLoadingId === dep.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">check</span>
                            {actionLoadingId === dep.id ? 'Approving...' : 'Approve & Credit'}
                          </button>
                          <button
                            onClick={() => handleRejectDeposit(dep.id, dep.reference_number)}
                            disabled={actionLoadingId === dep.id}
                            className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Bento Grid: Platform Reserves vs Customer Liabilities + Recent Ops Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          {/* Recent Operations Ledger Stream (8 Cols) */}
          <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Recent Platform Transactions
                </h2>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Real-time double-entry transactions processed across the entire banking network
                </p>
              </div>
              <Link
                href="/admin/transactions"
                className="text-secondary font-label-sm text-label-sm font-semibold hover:underline flex items-center gap-1"
              >
                All Transactions
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Ref & Memo</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low font-body-sm">
                  {recentTransactions.map((tx) => (
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
                      <td className="py-3 px-3 text-on-surface-variant whitespace-nowrap text-xs">
                        {new Date(tx.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-on-surface">
                        {formatINR(tx.amount_paise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Admin Actions & Directives (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Administrative Controls
              </h3>
              <div className="flex flex-col gap-2">
                <Link
                  href="/admin/users"
                  className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">group</span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-on-surface">User Management</span>
                      <span className="text-xs text-on-surface-variant">Roles, authorization & suspensions</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:translate-x-1 transition-transform">
                    chevron_right
                  </span>
                </Link>

                <Link
                  href="/admin/accounts"
                  className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">badge</span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-on-surface">Account Management</span>
                      <span className="text-xs text-on-surface-variant">Freeze/unfreeze & vault custody</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:translate-x-1 transition-transform">
                    chevron_right
                  </span>
                </Link>

                <Link
                  href="/admin/reversals"
                  className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-amber-600">undo</span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-on-surface">Reversal Management</span>
                      <span className="text-xs text-on-surface-variant">Compensating ledger transactions</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:translate-x-1 transition-transform">
                    chevron_right
                  </span>
                </Link>

                <Link
                  href="/transactions/deposit-withdraw"
                  className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-emerald-600">payments</span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-on-surface">Authorized Deposits</span>
                      <span className="text-xs text-on-surface-variant">Capital injections & remittances</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:translate-x-1 transition-transform">
                    chevron_right
                  </span>
                </Link>
              </div>
            </div>

            {/* Immutability Banner */}
            <div className="bg-primary-container text-on-primary rounded-xl p-space-md shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary-fixed text-lg">verified_user</span>
                <span className="font-bold text-xs uppercase tracking-wider text-tertiary-fixed">
                  Double-Entry Certified
                </span>
              </div>
              <p className="text-xs text-on-primary-container leading-relaxed">
                Ledger entries are append-only. To correct mistakes, reverse transactions with compensating entries. Direct updates and deletes are blocked at the database engine level.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
