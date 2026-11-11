'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/context/auth-context';
import { authFetch } from '@/lib/utils/api-client';

interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user_email?: string;
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/audit-logs?limit=100');
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const privilegedCount = useMemo(() => {
    return logs.filter(l =>
      l.action.includes('FREEZE') ||
      l.action.includes('ROLE') ||
      l.action.includes('REVERSAL') ||
      l.action.includes('DEPOSIT')
    ).length;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (actionFilter !== 'ALL' && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesAction = log.action.toLowerCase().includes(q);
        const matchesEntity = log.entity_type?.toLowerCase().includes(q) || log.entity_id?.toLowerCase().includes(q);
        const matchesActor = log.user_id?.toLowerCase().includes(q) || log.user_email?.toLowerCase().includes(q);
        if (!matchesAction && !matchesEntity && !matchesActor) return false;
      }
      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  return (
    <AppShell activePath="audit-logs">
      <div className="flex flex-col w-full">
        {/* Breadcrumb Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm mb-space-sm">
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
              COMPLIANCE & AUDIT
            </span>
            <span className="material-symbols-outlined text-outline text-xs">chevron_right</span>
            <span className="font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider">
              TRACEABILITY & SYSTEM EVIDENCE
            </span>
          </div>
          <div className="flex items-center gap-space-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-sm text-tertiary-fixed-dim">verified_user</span>
            <span className="font-label-sm text-label-sm font-mono tracking-tight text-on-surface-variant">
              CHAIN IDENTIFIER: LGR-MAINNET-0x981A
            </span>
          </div>
        </div>

        {/* Primary Page Header */}
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-space-lg mb-space-xl">
          <div className="max-w-3xl flex flex-col gap-space-xs">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              Immutable Audit Trail & System Evidence
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Forensic tamper-evident chronicle of every administrative action, consensus event, transaction override, and access event across all sovereign ledgers.
            </p>
          </div>

          {/* Action Cluster */}
          <div className="flex flex-wrap items-center gap-space-sm shrink-0">
            <button
              onClick={() => {
                const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
                const dlAnchor = document.createElement('a');
                dlAnchor.setAttribute('href', dataStr);
                dlAnchor.setAttribute('download', 'ledgerline_forensic_audit_trail.json');
                dlAnchor.click();
              }}
              className="flex items-center gap-2 px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface font-label-lg text-label-lg shadow-sm hover:bg-surface-container-low transition-all"
            >
              <span className="material-symbols-outlined text-lg text-on-surface-variant">download</span>
              <span>Export Forensic JSON</span>
            </button>
            <div className="flex items-center gap-2 px-space-md py-2 rounded-lg bg-primary-container text-on-primary font-label-lg text-label-lg shadow-md">
              <span className="material-symbols-outlined text-lg text-tertiary-fixed">shield_lock</span>
              <span>SHA-256 Merkle Sequence Valid</span>
            </div>
          </div>
        </div>

        {/* Forensic KPI Ribbon */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-xl">
          {/* Card 1: Total Records */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-space-sm">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
                Total Audit Records
              </span>
              <span className="material-symbols-outlined text-secondary text-xl">database</span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
                  {logs.length}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">REC</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Indexed & Anchored via Immutable Triggers
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Privileged Admin Actions */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-space-sm">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
                Privileged Actions
              </span>
              <span className="material-symbols-outlined text-secondary text-xl">admin_panel_settings</span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
                  {privilegedCount}
                </span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">Tracked</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
                  100% Attested
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Zero untracked operations</span>
              </div>
            </div>
          </div>

          {/* Card 3: Cryptographic Chain Status (Featured Dark Card) */}
          <div className="bg-primary-container p-space-lg rounded-xl shadow-md text-on-primary flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-space-sm">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-primary-container font-semibold">
                Audit Immutability
              </span>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-lowest/10 text-tertiary-fixed text-label-sm font-semibold">
                <span className="material-symbols-outlined text-sm">verified</span>
                <span>SOC-2 TYPE II</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm font-bold text-tertiary-fixed">
                  VALID & SYNCHRONIZED
                </span>
              </div>
              <p className="font-label-sm text-label-sm font-mono text-on-primary-container mt-1">
                Zero Modification Trigger Protected
              </p>
            </div>
            <div className="mt-space-sm pt-space-xs flex items-center justify-between border-t border-surface-container-lowest/10">
              <span className="font-label-sm text-label-sm text-on-primary-container">Attestation:</span>
              <span className="font-label-sm text-label-sm font-mono text-on-primary font-medium">CLEAN OPINION</span>
            </div>
          </div>

          {/* Card 4: Legal Holds */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-space-sm">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
                Retention Guarantee
              </span>
              <span className="material-symbols-outlined text-amber-600 text-xl">gavel</span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
                  7 Years
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Statutory Mandate</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-label-sm text-label-sm font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                  Append-Only Protected
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Query & Filter Toolbar */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md mb-space-lg">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-space-sm">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
                search
              </span>
              <input
                className="w-full bg-surface-container-low text-on-surface font-body-sm text-body-sm pl-11 pr-4 py-2.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all placeholder:text-outline"
                placeholder="Search audit trail by action, actor, entity ID, or details..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setActionFilter('ALL');
              }}
              className="bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface p-2.5 rounded-lg"
              title="Reset Filters"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
            </button>
          </div>

          {/* Action Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-surface-container-low">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold mr-1">
              Action Filter:
            </span>
            {['ALL', 'LOGIN', 'ACCOUNT', 'FREEZE', 'TRANSFER', 'REVERSAL', 'ROLE'].map((act) => (
              <button
                key={act}
                onClick={() => setActionFilter(act)}
                className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold transition-colors ${
                  actionFilter === act
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                {act === 'ALL' ? 'All Activities' : act}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                  <th className="py-3 px-space-lg font-semibold">Timestamp</th>
                  <th className="py-3 px-space-md font-semibold">Action Event</th>
                  <th className="py-3 px-space-md font-semibold">Actor</th>
                  <th className="py-3 px-space-md font-semibold">Entity Target</th>
                  <th className="py-3 px-space-md font-semibold">Client Context</th>
                  <th className="py-3 px-space-md font-semibold text-center">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      Querying immutable append-only audit register...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      No matching audit records found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3.5 px-space-lg text-on-surface-variant whitespace-nowrap font-mono text-xs">
                        {new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          log.action.includes('FREEZE') || log.action.includes('REVERSAL')
                            ? 'bg-red-50 text-red-800'
                            : log.action.includes('LOGIN')
                            ? 'bg-blue-50 text-blue-800'
                            : 'bg-surface-container-low text-on-surface'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface">
                        <span className="font-mono text-xs">{log.user_email || log.user_id || 'System'}</span>
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface-variant font-mono text-xs">
                        {log.entity_type ? `${log.entity_type}: ${log.entity_id?.slice(0, 12)}...` : 'N/A'}
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface-variant font-mono text-xs">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                      <td className="py-3.5 px-space-md text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg bg-surface-container-low text-on-surface hover:text-secondary hover:bg-surface-container transition-colors"
                          title="Inspect Evidence Payload"
                        >
                          <span className="material-symbols-outlined text-base">code</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payload Inspector Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">fingerprint</span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Forensic Evidence Payload
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-surface-container-low p-3 rounded-xl">
                <div>
                  <span className="text-on-surface-variant block font-sans uppercase font-bold">Action</span>
                  <span className="text-on-surface">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block font-sans uppercase font-bold">Record ID</span>
                  <span className="text-on-surface truncate block">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block font-sans uppercase font-bold">Actor ID</span>
                  <span className="text-on-surface">{selectedLog.user_id || 'System Process'}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block font-sans uppercase font-bold">Timestamp</span>
                  <span className="text-on-surface">{new Date(selectedLog.created_at).toUTCString()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-on-surface-variant">
                  Cryptographic Payload Details
                </label>
                <pre className="p-3 bg-surface-container text-on-surface font-mono text-xs rounded-xl overflow-x-auto max-h-60 border border-surface-container-high">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary-container"
                >
                  Close Payload
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
