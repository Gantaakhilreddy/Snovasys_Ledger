'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import { UserRole } from '@/types/auth';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [certify, setCertify] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!certify) {
      setErrorMessage('You must certify that you are an authorized corporate signatory.');
      return;
    }

    setLoading(true);
    const res = await register({
      full_name: fullName,
      email,
      phone,
      password,
      role: 'ACCOUNT_HOLDER',
    });
    setLoading(false);

    if (res.success) {
      setSubmittedSuccess(true);
    } else {
      setErrorMessage(res.error || 'Registration failed.');
    }
  };

  return (
    <div className="w-full min-h-screen bg-surface flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-7xl mx-auto">
        {/* Top LedgerLine Header Hub */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-8 gap-4 border-b border-surface-container mb-8">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-primary-container p-2 flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-tertiary-fixed text-2xl">account_balance</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">LedgerLine</span>
                <span className="font-label-sm text-label-sm uppercase tracking-wider bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full text-xs font-semibold">
                  Institutional
                </span>
              </div>
              <p className="font-label-md text-label-md text-on-surface-variant text-xs">
                Tier-1 Digital Custody &amp; Settlement Architecture
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-center">
            <ThemeToggle showLabel />
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-sm border border-surface-container-high text-xs">
              <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse"></span>
              256-Bit TLS Direct Handshake
            </span>
            <div className="hidden md:flex items-center gap-1 text-on-surface-variant font-label-md text-label-md text-xs">
              <span className="material-symbols-outlined text-sm">lock</span>
              SOC-2 Type II Certified
            </div>
          </div>
        </header>

        {/* Main Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Primary Registration Funnel (7 Cols) */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl shadow-sm p-6 sm:p-10 flex flex-col gap-8 border border-surface-container-high">
            {/* Step Progress Tracker Bar */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-3 text-on-surface">
                <span className="font-label-md text-label-md uppercase tracking-wider text-secondary font-semibold text-xs">
                  Step 01 / 04
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant text-xs">Estimated: 2 mins</span>
              </div>
              <div className="grid grid-cols-4 gap-2 w-full">
                <div className="h-1.5 bg-secondary-container rounded-full"></div>
                <div className="h-1.5 bg-surface-container-high rounded-full"></div>
                <div className="h-1.5 bg-surface-container-high rounded-full"></div>
                <div className="h-1.5 bg-surface-container-high rounded-full"></div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                <div className="flex flex-col">
                  <span className="font-label-md text-on-surface font-semibold truncate">1. Profile &amp; Role</span>
                  <span className="font-label-sm text-secondary truncate">Active</span>
                </div>
                <div className="flex flex-col opacity-60">
                  <span className="font-label-md text-on-surface truncate">2. Vault Account</span>
                  <span className="font-label-sm text-on-surface-variant truncate">Auto-Created</span>
                </div>
                <div className="flex flex-col opacity-60">
                  <span className="font-label-md text-on-surface truncate">3. Verification</span>
                  <span className="font-label-sm text-on-surface-variant truncate">RLS Enforced</span>
                </div>
                <div className="flex flex-col opacity-60">
                  <span className="font-label-md text-on-surface truncate">4. Provisioning</span>
                  <span className="font-label-sm text-on-surface-variant truncate">Instant</span>
                </div>
              </div>
            </div>

            {/* Section Title */}
            <div className="flex flex-col gap-1.5">
              <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-bold">
                LedgerLine Account Holder Registration
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Apply for an authorized multi-tenant institutional vault account. All new accounts require Administrator approval before activation.
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-error-container/40 border border-error/30 text-error flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-lg shrink-0">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {submittedSuccess ? (
              <div className="flex flex-col items-center text-center py-6 px-2 gap-5 animate-in fade-in duration-200">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-4xl">hourglass_top</span>
                </div>
                <div className="flex flex-col gap-1.5 max-w-md">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 self-center">
                    APPLICATION SUBMITTED • PENDING APPROVAL
                  </span>
                  <h2 className="font-headline-md text-2xl font-bold text-on-surface tracking-tight mt-1">
                    Application Awaiting Approval
                  </h2>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Thank you, <strong className="text-on-surface">{fullName}</strong>. Your registration for{' '}
                    <code className="font-mono bg-surface-container px-1.5 py-0.5 rounded text-xs font-semibold">{email}</code> has been successfully received.
                  </p>
                </div>

                <div className="w-full max-w-md p-4 rounded-xl bg-surface-container-low border border-surface-container text-left text-xs text-on-surface-variant space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-on-surface">
                    <span className="material-symbols-outlined text-secondary text-base">shield</span>
                    <span>Institutional Security Governance</span>
                  </div>
                  <p className="leading-relaxed">
                    1. A <strong>System Administrator</strong> has been notified to review your application and activate your account.
                  </p>
                  <p className="leading-relaxed">
                    2. Once approved, you will be able to log in with your credentials and manage your financial accounts and transfers.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md pt-2">
                  <a
                    href="/login"
                    className="w-full py-3 px-6 rounded-lg bg-primary-container text-on-primary hover:bg-secondary font-semibold text-sm transition-all shadow-md text-center"
                  >
                    Return to Sign In
                  </a>
                </div>
              </div>
            ) : (
              /* Registration Form Elements */
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Officer Full Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-lg text-label-lg text-on-surface font-semibold text-sm" htmlFor="full-name">
                    Authorized Officer Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                      <span className="material-symbols-outlined text-lg">person</span>
                    </div>
                    <input
                      id="full-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Elena Rostova"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                    />
                  </div>
                </div>

                {/* Work Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-lg text-label-lg text-on-surface font-semibold text-sm" htmlFor="corp-email">
                      Corporate Work Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                        <span className="material-symbols-outlined text-lg">alternate_email</span>
                      </div>
                      <input
                        id="corp-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.rostova@apexledger.io"
                        className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-lg text-label-lg text-on-surface font-semibold text-sm" htmlFor="phone-number">
                      Direct Telephone
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                        <span className="material-symbols-outlined text-lg">call</span>
                      </div>
                      <input
                        id="phone-number"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91-9876543210"
                        className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Fixed Role & Admin Approval Notice */}
                <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-xl">account_balance_wallet</span>
                      <span className="font-label-lg font-bold text-sm text-on-surface">Account Holder Account</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold uppercase tracking-wider">
                      Standard Vault
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Public registration is reserved strictly for <strong>Account Holders</strong> (Treasury, Money Transfer, and Account Management). Privileged Administrator and Auditor accounts cannot be self-registered and are provisioned internally by platform owners.
                  </p>
                  <div className="mt-1 pt-2 border-t border-surface-container flex items-start gap-2 text-xs text-amber-900 bg-amber-50/90 p-2.5 rounded-lg border border-amber-200">
                    <span className="material-symbols-outlined text-amber-700 text-base shrink-0 mt-0.5">verified_user</span>
                    <span>
                      <strong>Requires Admin Approval:</strong> Your application will be queued for review. A System Administrator must approve and activate your account before you can log in.
                    </span>
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-label-lg text-label-lg text-on-surface font-semibold text-sm" htmlFor="reg-pwd">
                      Master Workstation Password
                    </label>
                    <span className="font-label-sm text-label-sm text-secondary text-xs">Min 8 chars, 1 uppercase, 1 special</span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                      <span className="material-symbols-outlined text-lg">lock</span>
                    </div>
                    <input
                      id="reg-pwd"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                    />
                  </div>
                </div>

                {/* Signatory Certification Checkbox */}
                <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={certify}
                    onChange={(e) => setCertify(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-secondary focus:ring-secondary cursor-pointer accent-secondary"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface-variant text-xs">
                    I certify under penalty of perjury that I am authorized to bind the specified organization and abide by LedgerLine&apos;s institutional charter.
                  </span>
                </label>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-6 rounded-lg bg-primary-container text-on-primary hover:bg-secondary transition-all duration-200 shadow-md flex items-center justify-center gap-2 font-semibold text-sm cursor-pointer disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Submit Application for Admin Approval</span>
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Information, Compliance & Trust Showcase (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-primary-container text-on-primary rounded-xl p-6 sm:p-8 shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container/20 text-tertiary-fixed font-label-sm text-label-sm uppercase tracking-wider text-xs">
                  Zero-Knowledge Vault
                </span>
                <h3 className="font-headline-md text-headline-md font-bold text-on-primary">
                  Sovereign Multi-Tenant Isolation
                </h3>
                <p className="font-body-md text-body-md text-inverse-primary/90 text-sm leading-relaxed">
                  Every account provisioned on LedgerLine is enforced with strict database-level Row Level Security policies. Financial assets cannot leak across corporate boundaries.
                </p>
                <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="block text-on-primary-container">Audit Interval</span>
                    <span className="font-bold text-on-primary">Continuous</span>
                  </div>
                  <div>
                    <span className="block text-on-primary-container">Integrity Guarantee</span>
                    <span className="font-bold text-tertiary-fixed-dim">Balanced (ΣD = ΣC)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Already registered card */}
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container-high flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-on-surface">Already hold credentials?</p>
                <p className="text-xs text-on-surface-variant">Sign in to your active workstation session.</p>
              </div>
              <a
                href="/login"
                className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary font-semibold text-xs transition-colors"
              >
                Sign In
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
