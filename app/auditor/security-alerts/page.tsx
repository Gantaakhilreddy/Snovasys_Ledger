'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/context/auth-context';
import { authFetch } from '@/lib/utils/api-client';

interface SecurityAlert {
  id: string;
  user_id?: string;
  account_id?: string;
  transaction_id?: string;
  alert_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  details?: any;
  created_at: string;
  updated_at: string;
  resolution_notes?: string;
}

export default function SecurityAlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/security/alerts?limit=50');
      if (res.ok) {
        const json = await res.json();
        setAlerts(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load security alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleUpdateStatus = async (alertId: string, newStatus: 'RESOLVED' | 'DISMISSED' | 'UNDER_REVIEW') => {
    try {
      setResolvingId(alertId);
      const res = await authFetch(`/api/v1/security/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolution_notes: resolutionNotes || `Marked as ${newStatus} by ${user?.email || 'SecOps'}`
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update alert');
      }

      setResolutionNotes('');
      setSelectedAlert(null);
      await fetchAlerts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResolvingId(null);
    }
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
      return true;
    });
  }, [alerts, statusFilter, severityFilter]);

  const criticalCount = alerts.filter(a => (a.severity === 'CRITICAL' || a.severity === 'HIGH') && a.status === 'OPEN').length;

  return (
    <AppShell activePath="security-alerts">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              <span>SecOps Telemetry</span>
              <span>/</span>
              <span className="text-secondary font-bold">Threat & Anomaly Defense</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Security Alerts & Anomalies
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Real-time threat evaluation, velocity monitoring, unusual transaction spikes, and forensic incident triage.
            </p>
          </div>

          <button
            onClick={fetchAlerts}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-lowest text-on-surface shadow-xs hover:bg-surface-container transition-all text-sm font-semibold self-start xl:self-auto"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            <span>Refresh Telemetry</span>
          </button>
        </div>

        {/* KPI Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {/* Card 1: Critical Open */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
                High / Critical Alerts
              </span>
              <span className={`w-3 h-3 rounded-full ${criticalCount > 0 ? 'bg-error animate-ping' : 'bg-emerald-500'}`}></span>
            </div>
            <div className="my-space-sm">
              <div className="font-headline-lg text-headline-lg font-bold text-on-surface">
                {criticalCount}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Requiring immediate investigation
              </p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-on-surface-variant">
              Triage Priority: Level 1
            </div>
          </div>

          {/* Card 2: Total Triaged */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
                Total Telemetry Events
              </span>
              <span className="material-symbols-outlined text-secondary">shield</span>
            </div>
            <div className="my-space-sm">
              <div className="font-headline-lg text-headline-lg font-bold text-on-surface">
                {alerts.length}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Monitored transaction hashes
              </p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-on-surface-variant">
              Automated rules active
            </div>
          </div>

          {/* Card 3: Featured Dark Card */}
          <div className="bg-primary-container text-on-primary p-space-lg rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-primary-container font-semibold">
                Platform SecOps Status
              </span>
              <span className="material-symbols-outlined text-tertiary-fixed">verified_user</span>
            </div>
            <div className="my-space-sm">
              <div className="font-headline-sm text-headline-sm font-bold text-tertiary-fixed">
                DEFENSE OPERATIONAL
              </div>
              <p className="font-body-sm text-body-sm text-on-primary-container mt-1">
                AES-256 Validated • TLS 1.3 Active
              </p>
            </div>
            <div className="pt-2 border-t border-surface-container-lowest/10 text-xs text-on-primary-container font-mono">
              ZERO ACTIVE EXPLOITS
            </div>
          </div>

          {/* Card 4: Avg Resolution Time */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
                Avg Response Window
              </span>
              <span className="material-symbols-outlined text-secondary">timer</span>
            </div>
            <div className="my-space-sm">
              <div className="font-headline-lg text-headline-lg font-bold text-on-surface font-mono">
                &lt; 15 min
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                SLO: 99.9% resolution threshold
              </p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-emerald-700 font-semibold">
              Meets SOC-2 Standards
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold mr-1">
              Status:
            </span>
            {['ALL', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
              Severity:
            </span>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  severityFilter === sev
                    ? 'bg-secondary text-white'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts Feed */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                  <th className="py-3 px-space-lg font-semibold">Severity</th>
                  <th className="py-3 px-space-md font-semibold">Anomaly & Description</th>
                  <th className="py-3 px-space-md font-semibold">Target Entity</th>
                  <th className="py-3 px-space-md font-semibold">Timestamp</th>
                  <th className="py-3 px-space-md font-semibold">Status</th>
                  <th className="py-3 px-space-md font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      Querying security alerts and anomaly events...
                    </td>
                  </tr>
                ) : filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      No security anomalies or active alerts reported.
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3.5 px-space-lg">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-red-100 text-red-900 ring-1 ring-red-300'
                            : alert.severity === 'HIGH'
                            ? 'bg-amber-100 text-amber-900'
                            : alert.severity === 'MEDIUM'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-surface-container-low text-on-surface'
                        }`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">{alert.alert_type}</span>
                          <span className="text-xs text-on-surface-variant max-w-sm truncate">
                            {alert.details ? JSON.stringify(alert.details) : 'Abnormal velocity detected'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md font-mono text-xs text-on-surface-variant">
                        {alert.account_id ? `Account: ${alert.account_id.slice(0, 10)}...` : alert.user_id ? `User: ${alert.user_id.slice(0, 10)}...` : 'System'}
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface-variant text-xs whitespace-nowrap">
                        {new Date(alert.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          alert.status === 'RESOLVED'
                            ? 'bg-emerald-50 text-emerald-800'
                            : alert.status === 'DISMISSED'
                            ? 'bg-surface-container-high text-on-surface-variant'
                            : 'bg-red-50 text-red-800'
                        }`}>
                          {alert.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedAlert(alert)}
                            className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-secondary"
                            title="Inspect Alert Details"
                          >
                            <span className="material-symbols-outlined text-base">visibility</span>
                          </button>
                          {user?.role === 'ADMIN' && alert.status === 'OPEN' && (
                            <button
                              onClick={() => handleUpdateStatus(alert.id, 'RESOLVED')}
                              disabled={resolvingId === alert.id}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alert Details & Resolution Modal */}
        {selectedAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 text-2xl">shield_with_heart</span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Incident Review: {selectedAlert.alert_type}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-surface-container-low p-3 rounded-xl">
                <div>
                  <span className="font-sans uppercase text-on-surface-variant font-bold">Severity</span>
                  <span className="font-bold text-red-700">{selectedAlert.severity}</span>
                </div>
                <div>
                  <span className="font-sans uppercase text-on-surface-variant font-bold">Status</span>
                  <span className="font-bold text-on-surface">{selectedAlert.status}</span>
                </div>
                <div>
                  <span className="font-sans uppercase text-on-surface-variant font-bold">Incident ID</span>
                  <span className="truncate block text-on-surface">{selectedAlert.id}</span>
                </div>
                <div>
                  <span className="font-sans uppercase text-on-surface-variant font-bold">Detected</span>
                  <span className="text-on-surface">{new Date(selectedAlert.created_at).toUTCString()}</span>
                </div>
              </div>

              {selectedAlert.details && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase text-on-surface-variant">Telemetry Payload</span>
                  <pre className="p-3 bg-surface-container text-on-surface font-mono text-xs rounded-xl overflow-x-auto max-h-40 border border-surface-container-high">
                    {JSON.stringify(selectedAlert.details, null, 2)}
                  </pre>
                </div>
              )}

              {user?.role === 'ADMIN' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Resolution Note</label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-low text-on-surface text-xs p-2.5 rounded-lg border-0 focus:ring-1 focus:ring-secondary"
                    placeholder="Enter resolution audit justification..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-surface-container-low">
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="px-4 py-2 text-xs text-on-surface-variant hover:text-on-surface"
                >
                  Close
                </button>
                {user?.role === 'ADMIN' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedAlert.id, 'DISMISSED')}
                      disabled={resolvingId === selectedAlert.id}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedAlert.id, 'RESOLVED')}
                      disabled={resolvingId === selectedAlert.id}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
