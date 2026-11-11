'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, isRouteAllowedForRole, getDefaultRouteForRole } from '@/lib/context/auth-context';
import { ThemeToggle } from '@/components/theme/theme-toggle';

interface AppShellProps {
  children: React.ReactNode;
  activePath?: string;
}

export function AppShell({ children, activePath }: AppShellProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const role = user?.role || 'ACCOUNT_HOLDER';
  const isAllowed = user ? isRouteAllowedForRole(role, pathname) : true;

  const navItemClass = (path: string) => {
    const isActive =
      pathname === path ||
      (path !== '/dashboard' && path !== '/admin' && path !== '/auditor' && pathname.startsWith(path));
    return `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 font-label-md text-label-md select-none ${
      isActive
        ? 'bg-gradient-to-r from-indigo-500/20 via-indigo-500/10 to-transparent text-white font-bold border-l-2 border-indigo-400 shadow-xs'
        : 'text-slate-400 hover:text-white hover:bg-white/5 font-medium'
    }`;
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop Persistent + Mobile Drawer) */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-primary-container z-50 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col">
          {/* Logo & Platform Info */}
          <div className="px-6 pt-6 pb-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container-lowest/10 flex items-center justify-center p-1.5 shadow-sm border border-white/10">
                  <span className="material-symbols-outlined text-tertiary-fixed text-2xl font-bold">
                    account_balance
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm text-on-primary tracking-tight font-bold">
                    LedgerLine
                  </span>
                  <span className="font-label-sm text-label-sm text-on-primary-container tracking-wider uppercase font-semibold">
                    FINANCIAL OS
                  </span>
                </div>
              </div>
              <button
                className="lg:hidden text-on-primary-container hover:text-on-primary p-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="font-label-sm text-label-sm text-on-primary-container pl-1 pt-1.5 text-xs opacity-80">
              Every Transaction. Accounted For.
            </p>
          </div>

          {/* Verified Operating Role Indicator (Non-spoofable) */}
          <div className="px-4 py-2">
            <div className="bg-surface-container-lowest/5 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-label-sm text-label-sm text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  Operating Role
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-tertiary-fixed/20 text-tertiary-fixed border border-tertiary-fixed/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed animate-pulse"></span>
                  {role === 'ADMIN' ? 'SYS_ADMIN' : role === 'AUDITOR' ? 'AUDITOR_SEC' : 'HOLDER'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <span className="material-symbols-outlined text-base text-tertiary-fixed">
                  {role === 'ADMIN' ? 'admin_panel_settings' : role === 'AUDITOR' ? 'verified_user' : 'account_balance_wallet'}
                </span>
                <span className="truncate">
                  {role === 'ADMIN' ? 'System Administrator' : role === 'AUDITOR' ? 'Compliance Auditor' : 'Account Holder'}
                </span>
              </div>
              <div className="text-[10px] text-slate-300 pt-1 font-mono">
                {role === 'ADMIN'
                  ? 'Full Platform Authority'
                  : role === 'AUDITOR'
                  ? 'Read-Only Assurance & ISO 20022'
                  : 'Sovereign Vault Account'}
              </div>
            </div>
          </div>

          {/* Navigation Links - Role Segregated */}
          <nav
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) {
                setMobileMenuOpen(false);
              }
            }}
            className="px-4 py-2 flex flex-col gap-4"
          >
            {/* 1. ACCOUNT HOLDER: Personal Banking */}
            {role === 'ACCOUNT_HOLDER' && (
              <div className="flex flex-col gap-1">
                <div className="px-2 py-1 font-label-sm text-label-sm text-on-primary-container uppercase tracking-wider font-semibold text-[11px] opacity-70">
                  Personal Banking
                </div>
                <Link href="/dashboard" className={navItemClass('/dashboard')}>
                  <span className="material-symbols-outlined text-lg">dashboard</span>
                  User Dashboard
                </Link>
                <Link href="/accounts" className={navItemClass('/accounts')}>
                  <span className="material-symbols-outlined text-lg">account_balance</span>
                  My Accounts
                </Link>
                <Link href="/transactions/transfer" className={navItemClass('/transactions/transfer')}>
                  <span className="material-symbols-outlined text-lg">sync_alt</span>
                  Transfer Money
                </Link>
                <Link href="/transactions/deposit-withdraw" className={navItemClass('/transactions/deposit-withdraw')}>
                  <span className="material-symbols-outlined text-lg">payments</span>
                  Deposit &amp; Withdraw
                </Link>
                <Link href="/transactions" className={navItemClass('/transactions')}>
                  <span className="material-symbols-outlined text-lg">receipt_long</span>
                  Transaction History
                </Link>
              </div>
            )}

            {/* 2. AUDITOR: Compliance, Security & Read-Only Forensic Oversight */}
            {role === 'AUDITOR' && (
              <>
                <div className="flex flex-col gap-1">
                  <div className="px-2 py-1 font-label-sm text-label-sm text-on-primary-container uppercase tracking-wider font-semibold text-[11px] opacity-70">
                    Compliance &amp; Assurance
                  </div>
                  <Link href="/auditor" className={navItemClass('/auditor')}>
                    <span className="material-symbols-outlined text-lg">verified_user</span>
                    Auditor Dashboard
                  </Link>
                  <Link href="/auditor/audit-logs" className={navItemClass('/auditor/audit-logs')}>
                    <span className="material-symbols-outlined text-lg">history_edu</span>
                    Audit Logs
                  </Link>
                  <Link href="/auditor/integrity" className={navItemClass('/auditor/integrity')}>
                    <span className="material-symbols-outlined text-lg">assessment</span>
                    Integrity Reports
                  </Link>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="px-2 py-1 font-label-sm text-label-sm text-on-primary-container uppercase tracking-wider font-semibold text-[11px] opacity-70">
                    Security Telemetry
                  </div>
                  <Link href="/auditor/security-alerts" className={navItemClass('/auditor/security-alerts')}>
                    <span className="material-symbols-outlined text-lg">shield</span>
                    Security Alerts &amp; Anomalies
                  </Link>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="px-2 py-1 font-label-sm text-label-sm text-on-primary-container uppercase tracking-wider font-semibold text-[11px] opacity-70">
                    Forensic Supervision (Read-Only)
                  </div>
                  <Link href="/admin/accounts" className={navItemClass('/admin/accounts')}>
                    <span className="material-symbols-outlined text-lg">badge</span>
                    Account Directory
                  </Link>
                  <Link href="/admin/transactions" className={navItemClass('/admin/transactions')}>
                    <span className="material-symbols-outlined text-lg">rule</span>
                    Transaction Ledger
                  </Link>
                </div>
              </>
            )}

            {/* 3. ADMIN: Administrative Control, Operations & Oversight */}
            {role === 'ADMIN' && (
              <>
                <div className="flex flex-col gap-1">
                  <div className="px-2 py-1 font-label-sm text-label-sm text-on-primary-container uppercase tracking-wider font-semibold text-[11px] opacity-70">
                    Administrative Control
                  </div>
                  <Link href="/admin" className={navItemClass('/admin')}>
                    <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                    Admin Dashboard
                  </Link>
                  <Link href="/admin/users" className={navItemClass('/admin/users')}>
                    <span className="material-symbols-outlined text-lg">group</span>
                    User Management
                  </Link>
                  <Link href="/admin/accounts" className={navItemClass('/admin/accounts')}>
                    <span className="material-symbols-outlined text-lg">badge</span>
                    Account Management
                  </Link>
                  <Link href="/admin/transactions" className={navItemClass('/admin/transactions')}>
                    <span className="material-symbols-outlined text-lg">rule</span>
                    Transaction Management
                  </Link>
                  <Link href="/admin/reversals" className={navItemClass('/admin/reversals')}>
                    <span className="material-symbols-outlined text-lg">undo</span>
                    Reversal Management
                  </Link>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="px-2 py-1 font-label-sm text-label-sm text-on-primary-container uppercase tracking-wider font-semibold text-[11px] opacity-70">
                    Operations &amp; Liquidity
                  </div>
                  <Link href="/transactions/deposit-withdraw" className={navItemClass('/transactions/deposit-withdraw')}>
                    <span className="material-symbols-outlined text-lg">payments</span>
                    Deposit &amp; Withdraw
                  </Link>
                  <Link href="/accounts" className={navItemClass('/accounts')}>
                    <span className="material-symbols-outlined text-lg">account_balance</span>
                    Platform Accounts
                  </Link>
                  <Link href="/transactions" className={navItemClass('/transactions')}>
                    <span className="material-symbols-outlined text-lg">receipt_long</span>
                    Platform Transactions
                  </Link>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="px-2 py-1 font-label-sm text-label-sm text-on-primary-container uppercase tracking-wider font-semibold text-[11px] opacity-70">
                    Compliance Oversight
                  </div>
                  <Link href="/auditor" className={navItemClass('/auditor')}>
                    <span className="material-symbols-outlined text-lg">verified_user</span>
                    Auditor Overview
                  </Link>
                  <Link href="/auditor/audit-logs" className={navItemClass('/auditor/audit-logs')}>
                    <span className="material-symbols-outlined text-lg">history_edu</span>
                    Audit Logs
                  </Link>
                  <Link href="/auditor/integrity" className={navItemClass('/auditor/integrity')}>
                    <span className="material-symbols-outlined text-lg">assessment</span>
                    Integrity Reports
                  </Link>
                  <Link href="/auditor/security-alerts" className={navItemClass('/auditor/security-alerts')}>
                    <span className="material-symbols-outlined text-lg">shield</span>
                    Security Alerts
                  </Link>
                </div>
              </>
            )}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5">
          <div className="bg-surface-container-lowest/5 rounded-xl p-3 flex items-center justify-between border border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse"></div>
              <span className="font-label-sm text-label-sm text-on-primary-container text-xs">
                Ledger Immutable
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-tertiary-fixed-dim font-mono text-xs">
              v4.19
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Header */}
        <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-surface-container">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            {/* Hamburger Button on Mobile */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>

            {/* Search Input */}
            <div className="relative w-full max-w-md hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions, accounts... (Press ⌘K)"
                className="w-full bg-surface-container-low text-on-surface font-body-sm text-body-sm pl-9 pr-4 py-2 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-secondary placeholder:text-outline transition-all"
              />
            </div>
          </div>

          {/* Right Header Badges & Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface-container-low border border-surface-container-high text-xs shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                AES-256 Validated
              </span>
              <span className="text-outline-variant">•</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">99.99% Uptime</span>
            </div>

            {/* Light / Dark Mode Toggle */}
            <ThemeToggle />

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
                title="Notifications"
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full ring-2 ring-surface"></span>
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest rounded-xl shadow-xl p-4 border border-surface-container-high z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container">
                    <span className="font-label-md text-label-md font-bold text-on-surface">
                      System Notifications
                    </span>
                    <span
                      className="font-label-sm text-label-sm text-secondary cursor-pointer"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      Close
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-surface-container-low">
                      <p className="font-semibold text-on-surface">Double-Entry Ledger Balanced</p>
                      <p className="text-on-surface-variant">
                        Continuous reconciliation cycle executed with 0 discrepancies.
                      </p>
                      <span className="text-[10px] text-outline mt-1 block">Just now</span>
                    </div>
                    <div className="p-2 rounded-lg bg-surface-container-low">
                      <p className="font-semibold text-on-surface">Security Audit Passed</p>
                      <p className="text-on-surface-variant">
                        Row Level Security verified for active session.
                      </p>
                      <span className="text-[10px] text-outline mt-1 block">5m ago</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-surface-container-high"></div>

            {/* Profile Dropdown */}
            <div className="relative">
              <div
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2.5 cursor-pointer group select-none"
              >
                <div className="flex flex-col text-right hidden sm:flex">
                  <span className="font-label-md text-label-md text-on-surface font-semibold group-hover:text-secondary transition-colors">
                    {user?.full_name || 'Authorized Officer'}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase text-[10px] font-mono">
                    {role}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 p-[1.5px] shadow-xs">
                  <div className="w-full h-full rounded-full bg-surface-container-lowest text-on-surface flex items-center justify-center font-bold text-xs">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-base hidden sm:block">
                  expand_more
                </span>
              </div>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-surface-container-lowest rounded-xl shadow-xl p-2 border border-surface-container-high z-50">
                  <div className="px-3 py-2 border-b border-surface-container mb-1">
                    <p className="font-semibold text-sm text-on-surface truncate">
                      {user?.full_name || 'Officer'}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold uppercase">
                        {role}
                      </span>
                      <span className="text-[10px] text-outline">Verified</span>
                    </div>
                  </div>
                  <Link
                    href={getDefaultRouteForRole(role)}
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">dashboard</span>
                    {role === 'ADMIN'
                      ? 'Admin Command Center'
                      : role === 'AUDITOR'
                      ? 'Auditor Dashboard'
                      : 'Personal Dashboard'}
                  </Link>
                  <button
                    onClick={() => logout()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-error hover:bg-error-container/20 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-base">logout</span>
                    Sign Out / Switch Role
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Main View with Role Access Guard */}
        <main className="flex-1 mt-16 bg-surface min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 w-full">
          {isAllowed ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-error-container text-error flex items-center justify-center mb-4 shadow-sm">
                <span className="material-symbols-outlined text-4xl">gpp_maybe</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold mb-2">
                Access Restricted
              </h2>
              <p className="text-on-surface-variant font-body-md text-body-md max-w-md mb-6">
                Your account is authenticated with the role{' '}
                <span className="font-mono font-semibold text-secondary">{role}</span>, which does not
                have authorization to access this panel ({pathname}).
              </p>
              <button
                onClick={() => router.push(getDefaultRouteForRole(role))}
                className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity shadow-md flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Return to Authorized Workspace
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
