'use client';

import React, { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.success) {
        setSuccessMessage(
          data.data?.message || 'A tamper-evident recovery challenge has been dispatched to your corporate email.'
        );
      } else {
        setErrorMessage(data.error || 'Failed to dispatch reset link.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'Network error');
    }
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-surface overflow-hidden">
      {/* Ambient Security Halo */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[480px] bg-gradient-to-b from-secondary-container/10 via-tertiary-fixed-dim/5 to-transparent blur-3xl rounded-full pointer-events-none -z-10"></div>
      <div className="absolute bottom-[-100px] right-[-80px] w-96 h-96 bg-primary-container/5 blur-2xl rounded-full pointer-events-none -z-10"></div>

      <div className="w-full max-w-[580px] flex flex-col items-center">
        {/* Upper Micro-Badge: Protocol State */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-md text-label-md shadow-sm mb-6 text-xs">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="tracking-wide">TLS 1.3 End-to-End Encrypted Session</span>
          <span className="text-outline font-mono ml-1">#SEC-98402</span>
        </div>

        {/* Main Vault Card */}
        <div className="w-full bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden border border-surface-container-high">
          {/* Card Top Accented Security Strip */}
          <div className="h-1.5 w-full bg-gradient-to-r from-secondary-container via-tertiary-fixed-dim to-secondary"></div>

          <div className="p-6 sm:p-10 flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="relative flex items-center justify-center w-14 h-14 rounded-xl bg-primary-container text-on-primary shadow-md">
                <span className="material-symbols-outlined text-[30px] text-tertiary-fixed">enhanced_encryption</span>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                </div>
              </div>
              <div className="flex flex-col items-end text-right">
                <span className="font-headline-sm text-body-sm text-on-surface tracking-wider uppercase font-bold text-xs">
                  LedgerLine
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider text-[11px]">
                  HSM Vault Node • US-EAST-1
                </span>
              </div>
            </div>

            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight mb-2 font-bold">
              Reset Your Security Credentials
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6 leading-relaxed text-sm">
              Enter your registered corporate email address and we&apos;ll dispatch an encrypted single-use recovery payload with hardware token challenge.
            </p>

            {successMessage && (
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm mb-6 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0 mt-0.5">check_circle</span>
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-error-container/40 border border-error/30 text-error flex items-center gap-2 text-sm mb-6">
                <span className="material-symbols-outlined text-lg shrink-0">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-lg text-label-lg text-on-surface font-semibold text-sm" htmlFor="corporate-email">
                  Corporate Email Address
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center pointer-events-none text-on-surface-variant">
                    <span className="material-symbols-outlined text-lg">alternate_email</span>
                  </div>
                  <input
                    id="corporate-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="executive@organization.com"
                    className="w-full h-11 pl-11 pr-11 bg-surface-container-low focus:bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg outline-none border border-surface-container-high focus:ring-2 focus:ring-secondary transition-all placeholder:text-outline"
                  />
                  <div className="absolute right-3.5 flex items-center pointer-events-none text-outline">
                    <span className="material-symbols-outlined text-lg">fingerprint</span>
                  </div>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 text-xs pt-1">
                  <span className="material-symbols-outlined text-xs text-outline">lock</span>
                  Requires multi-tenant corporate directory or hardware passkey enrollment
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-lg bg-primary-container hover:bg-secondary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg text-tertiary-fixed">send</span>
                    <span className="font-semibold text-sm">Send Recovery Link &amp; OTP Token</span>
                  </>
                )}
              </button>
            </form>

            <div className="w-full h-px bg-surface-container-high my-6"></div>

            {/* What Happens Next? Panel */}
            <div className="rounded-xl bg-surface-container-low p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-lg">info</span>
                  <span className="font-headline-sm text-body-md text-on-surface font-bold text-sm">What happens next?</span>
                </div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant bg-surface-container px-2 py-0.5 rounded text-[10px] font-semibold">
                  3-Step Protocol
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-mono text-[10px] shrink-0">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-on-surface">Check your email payload: </span>
                    <span className="text-on-surface-variant">We dispatch a single-use magic authorization handshake valid for 10 minutes.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-mono text-[10px] shrink-0">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-on-surface">Confirm FIDO2 or OTP: </span>
                    <span className="text-on-surface-variant">Complete secondary verification challenge against your enrolled cryptographic key.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <a href="/login" className="font-semibold text-xs text-secondary hover:underline flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Return to Sign In</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
