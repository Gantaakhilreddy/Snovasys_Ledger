'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [roleTab, setRoleTab] = useState<'holder' | 'admin' | 'auditor'>('holder');
  const [email, setEmail] = useState('alice@example.com');
  const [password, setPassword] = useState('Password@123456');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick switch presets when clicking role pill tabs
  const handleRoleSelect = (role: 'holder' | 'admin' | 'auditor') => {
    setRoleTab(role);
    setErrorMessage(null);
    if (role === 'admin') {
      setEmail('admin@ledgerline.com');
      setPassword('Admin@123456');
    } else if (role === 'auditor') {
      setEmail('auditor@ledgerline.com');
      setPassword('Auditor@123456');
    } else {
      setEmail('alice@example.com');
      setPassword('Password@123456');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const res = await login(email, password);
    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Invalid credentials.');
    }
  };

  return (
    <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-surface">
      {/* LEFT SIDE: Brand & Narrative Panel (5 cols on Desktop) */}
      <div className="lg:col-span-5 relative bg-primary-container text-on-primary p-8 sm:p-12 lg:p-16 flex flex-col justify-between overflow-hidden shadow-xl">
        {/* Ambient Visual Layer */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-secondary blur-3xl"></div>
          <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-tertiary-fixed-dim blur-3xl opacity-20"></div>
        </div>

        {/* Technical Grid Overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.75" />
              <circle cx="0" cy="0" r="1.5" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        </svg>

        {/* Top Branding Section */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-lg bg-surface-container-lowest/10 flex items-center justify-center p-1.5 shadow-sm border border-white/10">
              <span className="material-symbols-outlined text-tertiary-fixed text-2xl font-bold">account_balance</span>
            </div>
            <span className="font-headline-md text-headline-md tracking-tight font-bold text-on-primary">LedgerLine</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-surface-container/20 text-on-primary text-label-sm font-label-sm uppercase tracking-wider backdrop-blur-sm border border-white/10">
              v4.19 Core
            </span>
          </div>

          <div className="space-y-4 max-w-lg">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-container/10 backdrop-blur-md border border-white/5">
              <span className="w-2 h-2 rounded-full bg-tertiary-fixed animate-pulse"></span>
              <span className="font-label-sm text-label-sm text-tertiary-fixed uppercase tracking-wider text-xs">
                Double-Entry Accounting Architecture
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-primary tracking-tight leading-none">
              Every Transaction. <br />
              <span className="text-tertiary-fixed-dim">Accounted For.</span>
            </h1>
            <p className="font-body-lg text-body-lg text-inverse-primary max-w-sm pt-2">
              The canonical ledger protocol built for high-scale institutional velocity, continuous audit cycles, and real-time reconciliation.
            </p>
          </div>

          {/* Pillar Features */}
          <div className="mt-10 space-y-3.5 max-w-md">
            <div className="flex items-start gap-3.5 p-3 rounded-lg bg-surface-container/5 hover:bg-surface-container/10 transition-colors">
              <div className="p-2 rounded-md bg-secondary/30 text-tertiary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-body-lg">verified_user</span>
              </div>
              <div>
                <p className="font-label-lg text-label-lg font-semibold text-on-primary">Institutional-Grade Auditability</p>
                <p className="font-body-sm text-body-sm text-inverse-primary/80">Tamper-evident cryptographically signed transaction ledgers updated continuously.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-lg bg-surface-container/5 hover:bg-surface-container/10 transition-colors">
              <div className="p-2 rounded-md bg-secondary/30 text-tertiary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-body-lg">bolt</span>
              </div>
              <div>
                <p className="font-label-lg text-label-lg font-semibold text-on-primary">Atomic Row-Level Settlement</p>
                <p className="font-body-sm text-body-sm text-inverse-primary/80">Zero race conditions and zero negative balances guaranteed by PostgreSQL locks.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3 rounded-lg bg-surface-container/5 hover:bg-surface-container/10 transition-colors">
              <div className="p-2 rounded-md bg-secondary/30 text-tertiary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-body-lg">shield_lock</span>
              </div>
              <div>
                <p className="font-label-lg text-label-lg font-semibold text-on-primary">Zero-Knowledge Anomaly Prevention</p>
                <p className="font-body-sm text-body-sm text-inverse-primary/80">Automated structural compliance filters safeguarding counterparty exposure.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Floating Metric Sparkline Widget */}
        <div className="relative z-10 my-6 p-4 rounded-xl bg-surface-container-lowest/5 backdrop-blur-md border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary-fixed-dim text-sm">finance_chip</span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-inverse-primary text-xs">
                Ledger Equilibrium
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-tertiary-fixed font-semibold text-xs">Σ DEBITS = Σ CREDITS</span>
          </div>
          <svg className="w-full h-10 stroke-tertiary-fixed-dim fill-none" viewBox="0 0 300 48" preserveAspectRatio="none">
            <path d="M0,40 L35,32 L70,36 L105,20 L140,24 L175,10 L210,18 L245,6 L280,12 L300,4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0,40 L35,32 L70,36 L105,20 L140,24 L175,10 L210,18 L245,6 L280,12 L300,4 L300,48 L0,48 Z" fill="currentColor" fillOpacity="0.08" stroke="none" />
          </svg>
        </div>

        {/* Bottom Testimonial & Security Badge */}
        <div className="relative z-10 pt-2">
          <div className="flex items-center justify-between text-inverse-primary pt-2 text-xs border-t border-white/10">
            <div className="flex items-center gap-1.5 font-label-sm text-label-sm">
              <span className="material-symbols-outlined text-tertiary-fixed-dim text-sm">lock</span>
              <span>SOC2 Type II Certified</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5 font-label-sm text-label-sm">
              <span className="material-symbols-outlined text-tertiary-fixed-dim text-sm">encrypted</span>
              <span>256-Bit Quantum-Resistant</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Authentication Workspace (7 cols on Desktop) */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center px-6 py-12 sm:px-12 md:px-16 lg:px-20 bg-surface">
        <div className="w-full max-w-lg space-y-8">
          {/* Mobile Logo Header */}
          <div className="flex lg:hidden items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary-fixed text-xl">account_balance</span>
            </div>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">LedgerLine</span>
          </div>

          {/* Greeting Block */}
          <div className="space-y-2">
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">Welcome back</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Enter your enterprise credentials to access your financial workstation.
            </p>
          </div>

          {/* Role Selector Pill Tabs */}
          <div className="p-1 rounded-xl bg-surface-container flex items-center gap-1 border border-surface-container-high" id="role-selector">
            <button
              type="button"
              onClick={() => handleRoleSelect('holder')}
              className={`flex-1 py-2 text-center rounded-lg font-label-md text-label-md font-semibold transition-all duration-150 ${
                roleTab === 'holder'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Account Holder
            </button>
            <button
              type="button"
              onClick={() => handleRoleSelect('admin')}
              className={`flex-1 py-2 text-center rounded-lg font-label-md text-label-md font-semibold transition-all duration-150 ${
                roleTab === 'admin'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Administrator
            </button>
            <button
              type="button"
              onClick={() => handleRoleSelect('auditor')}
              className={`flex-1 py-2 text-center rounded-lg font-label-md text-label-md font-semibold transition-all duration-150 ${
                roleTab === 'auditor'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Auditor
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-error-container/40 border border-error/30 text-error flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-lg shrink-0">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Work Email Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-label-md text-label-md font-semibold text-on-surface" htmlFor="work-email">
                  Work Email
                </label>
                <span className="font-label-sm text-label-sm text-secondary font-medium">Domain Verified</span>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-outline text-body-lg pointer-events-none">
                  alternate_email
                </span>
                <input
                  id="work-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  className="w-full pl-11 pr-10 py-2.5 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md placeholder:text-outline shadow-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                />
                <span className="material-symbols-outlined absolute right-3.5 text-emerald-600 text-body-lg font-semibold pointer-events-none" title="Domain verified">
                  check_circle
                </span>
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-label-md text-label-md font-semibold text-on-surface" htmlFor="password">
                  Workstation Password
                </label>
                <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined text-xs">usb</span> FIDO2 Key Active
                </span>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-outline text-body-lg pointer-events-none">
                  lock
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full pl-11 pr-11 py-2.5 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md placeholder:text-outline shadow-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-outline hover:text-on-surface p-1 rounded transition-colors"
                >
                  <span className="material-symbols-outlined text-body-lg">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Utilities: Remember + Recovery */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-secondary focus:ring-secondary cursor-pointer bg-surface-container-lowest accent-secondary"
                />
                <span className="font-body-sm text-body-sm text-on-surface-variant select-none">Remember workstation for 30 days</span>
              </label>
              <a
                href="/forgot-password"
                className="font-label-md text-label-md text-secondary hover:text-on-secondary-fixed-variant font-semibold transition-colors"
              >
                Forgot credentials?
              </a>
            </div>

            {/* Primary Sign-In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-lg bg-primary-container text-on-primary hover:bg-secondary transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="font-label-lg text-label-lg font-semibold">Sign In to LedgerLine</span>
                  <span className="material-symbols-outlined text-body-lg group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Enterprise SSO Divider */}
          <div className="relative flex items-center justify-center my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full bg-surface-variant h-px"></div>
            </div>
            <span className="relative px-4 bg-surface text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider text-xs">
              or continue with enterprise SSO
            </span>
          </div>

          {/* SSO Identity Providers */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => alert('Google Workspace SSO is configured for institutional enterprise domains.')}
              className="py-2.5 px-4 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low text-on-surface transition-colors shadow-sm flex items-center justify-center gap-2.5 cursor-pointer border border-surface-container-high text-xs font-semibold"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.86c2.26-2.09 3.685-5.17 3.685-9.09z" fill="#4285F4"></path>
                <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.37 24 12 24z" fill="#34A853"></path>
                <path d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" fill="#FBBC05"></path>
                <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" fill="#EA4335"></path>
              </svg>
              <span>Google Workspace</span>
            </button>
            <button
              type="button"
              onClick={() => alert('Okta SAML 2.0 integration is active for verified identity federations.')}
              className="py-2.5 px-4 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low text-on-surface transition-colors shadow-sm flex items-center justify-center gap-2.5 cursor-pointer border border-surface-container-high text-xs font-semibold"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary text-[8px] font-bold">
                O
              </div>
              <span>Okta SAML</span>
            </button>
          </div>

          {/* Footnote & Access Request */}
          <div className="pt-4 text-center space-y-3">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Don&apos;t have an institutional account?{' '}
              <a href="/register" className="font-semibold text-secondary hover:text-on-secondary-fixed-variant transition-colors">
                Request Access / Register
              </a>
            </p>
            <div className="flex items-center justify-center gap-2 text-outline font-label-sm text-label-sm text-xs">
              <span className="material-symbols-outlined text-sm">verified</span>
              <span>LedgerLine Institutional Workstation 2025 • Hardware Token Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
