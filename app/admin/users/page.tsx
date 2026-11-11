'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/context/auth-context';
import { authFetch } from '@/lib/utils/api-client';

interface UserEntity {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'ACCOUNT_HOLDER' | 'AUDITOR';
  status: 'ACTIVE' | 'PENDING' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'DEACTIVATED';
  created_at: string;
  phone_number?: string;
}

export default function UserManagementPage() {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState<UserEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Role Edit Modal State
  const [editingUser, setEditingUser] = useState<UserEntity | null>(null);
  const [newRole, setNewRole] = useState<'ADMIN' | 'ACCOUNT_HOLDER' | 'AUDITOR'>('ACCOUNT_HOLDER');
  const [savingRole, setSavingRole] = useState(false);

  // Status Toggle Modal State
  const [statusUser, setStatusUser] = useState<UserEntity | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  // Add User Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'ACCOUNT_HOLDER' | 'AUDITOR'>('ACCOUNT_HOLDER');
  const [newPassword, setNewPassword] = useState('Password@123');
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/users?limit=100');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApproveUser = async (u: UserEntity) => {
    try {
      setActionFeedback(null);
      const res = await authFetch(`/api/v1/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to approve user');
      }

      setActionFeedback(`User ${u.full_name || u.email} approved and activated successfully.`);
      await fetchUsers();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleRejectUser = async (u: UserEntity) => {
    if (!confirm(`Are you sure you want to reject the registration application for ${u.full_name || u.email}?`)) {
      return;
    }
    try {
      setActionFeedback(null);
      const res = await authFetch(`/api/v1/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DEACTIVATED' })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to reject user');
      }

      setActionFeedback(`Registration application for ${u.full_name || u.email} was rejected.`);
      await fetchUsers();
    } catch (err: any) {
      alert(`Reject error: ${err.message}`);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingUser) return;
    try {
      setSavingRole(true);
      const res = await authFetch(`/api/v1/users/${editingUser.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to update user role');
      }

      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingRole(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusUser) return;
    try {
      setSavingStatus(true);
      const targetStatus = statusUser.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      const res = await authFetch(`/api/v1/users/${statusUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to update user status');
      }

      setStatusUser(null);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newName.trim()) {
      setCreateError('Full legal name is required.');
      return;
    }
    if (!newEmail.trim()) {
      setCreateError('Corporate email address is required.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setCreateError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setCreatingUser(true);
      const res = await authFetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          phone: newPhone.trim() || undefined,
          role: newUserRole,
          password: newPassword,
          status: 'ACTIVE'
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to provision user');
      }

      setAddModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('Password@123');
      setNewUserRole('ACCOUNT_HOLDER');
      setActionFeedback(`User ${json.data?.user?.full_name || newEmail} successfully provisioned as ${newUserRole} with ACTIVE status.`);
      await fetchUsers();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING') {
          if (u.status !== 'PENDING' && u.status !== 'PENDING_APPROVAL') return false;
        } else if (u.status !== statusFilter) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.full_name?.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesId = u.id.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesId) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const holderCount = users.filter((u) => u.role === 'ACCOUNT_HOLDER').length;
  const auditorCount = users.filter((u) => u.role === 'AUDITOR').length;
  const pendingCount = users.filter((u) => u.status === 'PENDING' || u.status === 'PENDING_APPROVAL').length;

  return (
    <AppShell activePath="user-management">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              <span>Admin Console</span>
              <span>/</span>
              <span className="text-secondary font-bold">Identity &amp; Access Management</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              User Directory &amp; Role Governance
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Role-Based Access Control (RBAC) administration, privileged credential elevation, legal entity verification, and account registration approvals.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setCreateError(null);
                setAddModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/90 text-white font-semibold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              <span>Provision New User</span>
            </button>
          </div>
        </div>

        {/* Action Feedback Toast */}
        {actionFeedback && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
              <span className="font-semibold">{actionFeedback}</span>
            </div>
            <button onClick={() => setActionFeedback(null)} className="text-emerald-800 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Pending Approvals Action Banner */}
        {pendingCount > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl animate-pulse">hourglass_top</span>
              </div>
              <div>
                <span className="font-bold text-sm block">Action Required: {pendingCount} Account Holder Registration{pendingCount > 1 ? 's' : ''} Pending Approval</span>
                <p className="text-xs text-amber-800">New user accounts require administrator authorization before they can log in or access banking vaults.</p>
              </div>
            </div>
            <button
              onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
              className="px-4 py-2 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs transition-colors shadow-xs self-start sm:self-auto shrink-0"
            >
              {statusFilter === 'PENDING' ? 'View All Users' : 'Review Pending Queue'}
            </button>
          </div>
        )}

        {/* 4-KPI Array */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
                Total Identities
              </span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {pendingCount} Pending
                </span>
              )}
            </div>
            <div className="my-space-sm">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface font-mono">
                {users.length}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Enrolled in Auth Service</p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-emerald-700 font-semibold">
              Supabase Auth Linked
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
              Account Holders
            </span>
            <div className="my-space-sm">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface font-mono">
                {holderCount}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Operational Banking Users</p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-on-surface-variant">
              Standard Client Tier
            </div>
          </div>

          <div className="bg-primary-container text-white p-space-lg rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden border border-white/10">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-slate-300 font-semibold">
              System Administrators
            </span>
            <div className="my-space-sm">
              <span className="font-headline-lg text-headline-lg font-bold text-cyan-400 font-mono">
                {adminCount}
              </span>
              <p className="font-body-sm text-body-sm text-slate-300 mt-1">Privileged Operations</p>
            </div>
            <div className="pt-2 border-t border-surface-container-lowest/10 text-xs text-slate-400 font-mono">
              FULL PRIVILEGE ROLE
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
              Compliance Auditors
            </span>
            <div className="my-space-sm">
              <span className="font-headline-lg text-headline-lg font-bold text-secondary font-mono">
                {auditorCount}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Read-Only Forensic Access</p>
            </div>
            <div className="pt-2 border-t border-surface-container-low text-xs text-on-surface-variant">
              SOC-2 / SOX Assurance
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, email, or user ID..."
              className="w-full bg-surface-container-low text-on-surface text-sm pl-9 pr-3 py-2 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-secondary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase font-semibold text-on-surface-variant">Status:</span>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'PENDING', label: `Pending (${pendingCount})` },
                { id: 'ACTIVE', label: 'Active' },
                { id: 'SUSPENDED', label: 'Suspended' }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    statusFilter === s.id
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-surface-container-high hidden sm:block"></div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase font-semibold text-on-surface-variant">Role:</span>
              {['ALL', 'ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    roleFilter === r
                      ? 'bg-secondary text-white shadow-xs'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {r === 'ALL' ? 'All Roles' : r === 'ACCOUNT_HOLDER' ? 'Holders' : r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                  <th className="py-3 px-space-lg font-semibold">Identity</th>
                  <th className="py-3 px-space-md font-semibold">Assigned Role</th>
                  <th className="py-3 px-space-md font-semibold">Account Status</th>
                  <th className="py-3 px-space-md font-semibold">Enrolled On</th>
                  <th className="py-3 px-space-md font-semibold text-center">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                      Querying identity directory...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                      No matching user records found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isPending = u.status === 'PENDING' || u.status === 'PENDING_APPROVAL';
                    return (
                      <tr key={u.id} className={`hover:bg-surface-container-low/60 transition-colors ${isPending ? 'bg-amber-50/40' : ''}`}>
                        <td className="py-3.5 px-space-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                              isPending ? 'bg-amber-200 text-amber-900' : 'bg-surface-container-high text-on-surface'
                            }`}>
                              {u.full_name?.slice(0, 2).toUpperCase() || u.email.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-on-surface flex items-center gap-1.5">
                                {u.full_name || 'System User'}
                                {isPending && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                    New Applicant
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-on-surface-variant font-mono">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-space-md">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-900 ring-1 ring-purple-300'
                              : u.role === 'AUDITOR'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-surface-container-low text-on-surface'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-space-md">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              PENDING APPROVAL
                            </span>
                          ) : (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-red-50 text-red-800'
                            }`}>
                              {u.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-space-md text-on-surface-variant text-xs whitespace-nowrap">
                          {new Date(u.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="py-3.5 px-space-md text-center">
                          {isPending ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleApproveUser(u)}
                                className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">check</span>
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleRejectUser(u)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingUser(u);
                                  setNewRole(u.role);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors"
                              >
                                Edit Role
                              </button>
                              <button
                                onClick={() => setStatusUser(u)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Edit Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-2xl">admin_panel_settings</span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Modify User Role
                  </h3>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="bg-surface-container-low p-3 rounded-xl flex flex-col gap-1 text-xs">
                <span className="font-semibold text-on-surface">{editingUser.full_name}</span>
                <span className="text-on-surface-variant font-mono">{editingUser.email}</span>
                <span className="text-outline">User ID: {editingUser.id}</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-on-surface-variant">
                  Select Authorization Role
                </label>
                <div className="flex flex-col gap-2">
                  {[
                    { role: 'ACCOUNT_HOLDER', desc: 'Standard client accounts, transfers & balances' },
                    { role: 'ADMIN', desc: 'Manage users, freeze accounts, deposits, reversals' },
                    { role: 'AUDITOR', desc: 'Read-only integrity checks, audit trails & reports' }
                  ].map((item) => (
                    <label
                      key={item.role}
                      onClick={() => setNewRole(item.role as any)}
                      className={`p-3 rounded-xl border flex flex-col gap-0.5 cursor-pointer transition-all ${
                        newRole === item.role
                          ? 'border-secondary bg-surface-container-low ring-1 ring-secondary'
                          : 'border-surface-container hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-on-surface">{item.role}</span>
                        <input
                          type="radio"
                          name="roleChoice"
                          checked={newRole === item.role}
                          onChange={() => setNewRole(item.role as any)}
                          className="text-secondary"
                        />
                      </div>
                      <span className="text-xs text-on-surface-variant">{item.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRole}
                  disabled={savingRole}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container disabled:opacity-50"
                >
                  {savingRole ? 'Saving...' : 'Update Role'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Toggle Modal */}
        {statusUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  statusUser.status === 'ACTIVE' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <span className="material-symbols-outlined">
                    {statusUser.status === 'ACTIVE' ? 'block' : 'check_circle'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {statusUser.status === 'ACTIVE' ? 'Suspend User Account' : 'Reactivate User Account'}
                  </h3>
                  <span className="text-xs text-on-surface-variant">{statusUser.email}</span>
                </div>
              </div>

              <p className="text-sm text-on-surface-variant">
                {statusUser.status === 'ACTIVE'
                  ? 'Suspending this user will immediately revoke login sessions and block money transfers.'
                  : 'Reactivating this user will restore regular authentication and banking capabilities.'}
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
                <button
                  onClick={() => setStatusUser(null)}
                  className="px-4 py-2 text-xs text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={handleToggleStatus}
                  disabled={savingStatus}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold text-white ${
                    statusUser.status === 'ACTIVE'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {savingStatus ? 'Processing...' : statusUser.status === 'ACTIVE' ? 'Confirm Suspension' : 'Confirm Activation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Provision User Modal */}
        {addModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 border border-surface-container-high my-8 animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">person_add</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Provision Platform Identity
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Directly provision and activate an Administrator, Auditor, or Account Holder
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAddModalOpen(false)}
                  className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Error Alert */}
              {createError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-red-600 shrink-0">error</span>
                  <span>{createError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
                {/* Full Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Full Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-surface-container-low text-on-surface text-sm px-3.5 py-2.5 rounded-xl border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>

                {/* Email Address */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Corporate Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. j.doe@ledgerline.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-surface-container-low text-on-surface text-sm px-3.5 py-2.5 rounded-xl border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Phone Number <span className="text-on-surface-variant/60 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-surface-container-low text-on-surface text-sm px-3.5 py-2.5 rounded-xl border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>

                {/* Role Picker */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Assigned Role &amp; Access Tier <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        role: 'ACCOUNT_HOLDER' as const,
                        label: 'Account Holder',
                        icon: 'account_balance_wallet',
                        desc: 'Sovereign client, banking vaults, deposits & payments',
                        badgeClass: 'bg-emerald-100 text-emerald-800'
                      },
                      {
                        role: 'ADMIN' as const,
                        label: 'Admin',
                        icon: 'admin_panel_settings',
                        desc: 'Full platform management, approvals & reversals',
                        badgeClass: 'bg-purple-100 text-purple-900'
                      },
                      {
                        role: 'AUDITOR' as const,
                        label: 'Auditor',
                        icon: 'verified_user',
                        desc: 'Read-only audit logs, invariants & compliance',
                        badgeClass: 'bg-blue-100 text-blue-900'
                      }
                    ].map((item) => {
                      const isSelected = newUserRole === item.role;
                      return (
                        <div
                          key={item.role}
                          onClick={() => setNewUserRole(item.role)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-2 select-none ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-xs'
                              : 'border-surface-container-high bg-surface-container-low hover:bg-surface-container'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="material-symbols-outlined text-xl text-primary">{item.icon}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.badgeClass}`}>
                              {item.role}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-xs text-on-surface block">{item.label}</span>
                            <span className="text-[11px] text-on-surface-variant leading-tight block mt-0.5">{item.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Initial Password */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Initial Password <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-primary hover:underline font-medium cursor-pointer"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 8 chars: uppercase, lowercase, digit, symbol"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-surface-container-low text-on-surface text-sm px-3.5 py-2.5 rounded-xl border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono transition-all"
                  />
                  <p className="text-[11px] text-on-surface-variant/80">
                    Must contain at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special symbol. Status is set to <span className="font-semibold text-emerald-700">ACTIVE</span> immediately.
                  </p>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-low mt-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    disabled={creatingUser}
                    className="px-4 py-2.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {creatingUser ? (
                      <>
                        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                        <span>Provisioning User...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>Provision &amp; Activate User</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
