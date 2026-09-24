import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Filter, RefreshCw } from 'lucide-react';
import api from '../../arya_frontend/src/lib/api';

// Real audit_log.action values (services/audit_service.py callers) and entity_type values —
// this page previously used INSERT/UPDATE/DELETE/APPROVE/DEPRECATE and singular entity names,
// none of which the app ever actually writes.
const ACTIONS = [
  'receipt_confirmed', 'material_approved', 'material_deprecated', 'material_edited',
  'mapping_approved', 'mapping_rejected', 'materials_merged', 'cnmc_generated',
  'user_created', 'user_activated', 'user_deactivated',
];
const ENTITY_TYPES = ['materials', 'goods_receipts', 'matching_queue', 'user'];

const ACTION_COLORS = {
  material_approved: 'bg-emerald-100 text-emerald-700',
  material_deprecated: 'bg-amber-100 text-amber-700',
  material_edited: 'bg-blue-100 text-blue-700',
  mapping_approved: 'bg-emerald-100 text-emerald-700',
  mapping_rejected: 'bg-rose-100 text-rose-700',
  materials_merged: 'bg-indigo-100 text-indigo-700',
  receipt_confirmed: 'bg-blue-100 text-blue-700',
  cnmc_generated: 'bg-slate-100 text-slate-600',
  user_created: 'bg-emerald-100 text-emerald-700',
  user_activated: 'bg-emerald-100 text-emerald-700',
  user_deactivated: 'bg-rose-100 text-rose-700',
};

const ActionBadge = ({ action }) => (
  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ACTION_COLORS[action] || 'bg-slate-100 text-slate-600'}`}>
    {action?.replace(/_/g, ' ') || '—'}
  </span>
);

const formatTimestamp = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/audit', {
        params: {
          action: actionFilter !== 'all' ? actionFilter : undefined,
          entity_type: entityFilter !== 'all' ? entityFilter : undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      });
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching audit log:', err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = search.trim()
    ? logs.filter(l =>
        (l.entity_id || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.actor_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.action || '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const exportCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID'];
    const rows = filteredLogs.map(l => [
      formatTimestamp(l.created_at),
      l.actor_name || '—',
      l.action || '—',
      l.entity_type || '—',
      l.entity_id || '—',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(0); }}
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none"
            >
              <option value="all">All Actions</option>
              {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <select
              value={entityFilter}
              onChange={e => { setEntityFilter(e.target.value); setPage(0); }}
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none"
            >
              <option value="all">All Entities</option>
              {ENTITY_TYPES.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search this page's results..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Entity Type</th>
                <th className="px-5 py-3">Entity ID</th>
                <th className="px-5 py-3">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-4/5" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No audit log entries found
                  </td>
                </tr>
              ) : filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors align-top">
                  <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">{formatTimestamp(log.created_at)}</td>
                  <td className="px-5 py-4 text-xs text-slate-600 max-w-[140px] truncate" title={log.actor_id}>
                    {log.actor_name || 'system'}
                    {log.actor_role && <span className="text-slate-400"> · {log.actor_role}</span>}
                  </td>
                  <td className="px-5 py-4"><ActionBadge action={log.action} /></td>
                  <td className="px-5 py-4 text-slate-600 capitalize">{log.entity_type?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500 max-w-[100px] truncate" title={log.entity_id}>
                    {log.entity_id ? log.entity_id.substring(0, 8) + '…' : '—'}
                  </td>
                  <td className="px-5 py-4 max-w-xs">
                    {log.new_value ? (
                      <details className="cursor-pointer">
                        <summary className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View changes</summary>
                        <pre className="mt-1 text-xs text-slate-500 bg-slate-50 rounded p-2 overflow-x-auto max-w-xs">
                          {JSON.stringify(log.new_value, null, 2)}
                        </pre>
                      </details>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Page {page + 1} · {filteredLogs.length} entries</span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              disabled={logs.length < PAGE_SIZE}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
