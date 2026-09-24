import React, { useState, useEffect } from 'react';
import { Users, Plus, ShieldOff, Search, X, Copy } from 'lucide-react';
import api from '../../frontend/src/lib/api';

const ROLES = ['admin', 'entry_operator', 'engineer', 'accounts'];

const RoleBadge = ({ role }) => {
  const styles = {
    admin: 'bg-indigo-100 text-indigo-700',
    entry_operator: 'bg-blue-100 text-blue-700',
    engineer: 'bg-teal-100 text-teal-700',
    accounts: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[role] || 'bg-slate-100 text-slate-500'}`}>
      {role?.replace('_', ' ') || '—'}
    </span>
  );
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', full_name: '', role: 'entry_operator', department: '' });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null); // { email, temporary_password }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      showToast(err.response?.data?.detail || 'Could not load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleUserActive = async (userId, currentStatus) => {
    setDeactivating(userId);
    try {
      await api.patch(`/users/${userId}/active`, { is_active: !currentStatus });
      showToast(currentStatus ? 'User deactivated' : 'User reactivated');
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.detail || err.message, 'error');
    } finally {
      setDeactivating(null);
    }
  };

  const createUser = async () => {
    if (!newUser.email || !newUser.full_name) {
      showToast('Email and name are required', 'error');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post('/users', {
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
        department: newUser.department || undefined,
      });
      showToast(`User "${newUser.full_name}" created successfully`);
      setNewUser({ email: '', full_name: '', role: 'entry_operator', department: '' });
      setShowCreate(false);
      // No email delivery configured — show the one-time password so the admin can pass it on.
      setCreatedCredentials({ email: data.email, temporary_password: data.temporary_password });
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.detail || `Error: ${err.message}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  const filtered = search.trim()
    ? users.filter(u =>
        (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.role || '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <div className="space-y-5 relative">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
          toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* One-time temporary password reveal */}
      {createdCredentials && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-lg">User created</h3>
            <p className="text-sm text-slate-500">
              There's no email delivery configured, so share this temporary password with{' '}
              <span className="font-medium text-slate-700">{createdCredentials.email}</span> yourself —
              it won't be shown again.
            </p>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <code className="flex-1 text-sm font-mono text-slate-800 break-all">
                {createdCredentials.temporary_password}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(createdCredentials.temporary_password)}
                className="text-slate-400 hover:text-indigo-600 shrink-0"
                title="Copy"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setCreatedCredentials(null)}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {ROLES.map(role => {
          const count = users.filter(u => u.role === role).length;
          return (
            <div key={role} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="text-2xl font-bold text-slate-800">{count}</div>
              <div className="text-xs text-slate-400 mt-1 capitalize">{role.replace('_', ' ')}</div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex gap-3 items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or role..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">Create New User</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Full Name</label>
                <input
                  value={newUser.full_name}
                  onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                  placeholder="e.g. rajesh@bharatoil.in"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Role</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Department (optional)</label>
                <input
                  value={newUser.department}
                  onChange={e => setNewUser(p => ({ ...p, department: e.target.value }))}
                  placeholder="e.g. Warehouse Intake"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={createUser}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No users found
                  </td>
                </tr>
              ) : filtered.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 font-medium text-slate-800">{user.full_name || '—'}</td>
                  <td className="px-5 py-4"><RoleBadge role={user.role} /></td>
                  <td className="px-5 py-4 text-slate-500">{user.department || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      user.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {user.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      disabled={deactivating === user.id}
                      onClick={() => toggleUserActive(user.id, user.is_active !== false)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        user.is_active !== false
                          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      <ShieldOff className="w-3.5 h-3.5" />
                      {user.is_active !== false ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
