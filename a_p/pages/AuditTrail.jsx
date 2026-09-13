import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Filter, RefreshCw } from 'lucide-react';
import supabase from '../utils/supabase';

const ACTION_COLORS = {
  INSERT: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-rose-100 text-rose-700',
  APPROVE: 'bg-indigo-100 text-indigo-700',
  DEPRECATE: 'bg-amber-100 text-amber-700',
};

const ActionBadge = ({ action }) => (
  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ACTION_COLORS[action] || 'bg-slate-100 text-slate-600'}`}>
    {action}
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
      let query = supabase
        .from('audit_log')
        .select('id, actor_id, action, entity_type, entity_id, old_values, new_values, created_at, metadata')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);

      const { data, error } = await query;
      if (error) throw error;
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
        (l.actor_id || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.action || '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const exportCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID'];
    const rows = filteredLogs.map(l => [
      formatTimestamp(l.created_at),
      l.actor_id || '—',
      l.action || '—',
      l.entity_type || '—',
      l.entity_id || '—',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
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
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="APPROVE">APPROVE</option>
              <option value="DEPRECATE">DEPRECATE</option>
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
              <option value="material">material</option>
              <option value="goods_receipt">goods_receipt</option>
              <option value="matching_queue">matching_queue</option>
              <option value="user">user</option>
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
              placeholder="Search actor or entity..."
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
                  <td className="px-5 py-4 font-mono text-xs text-slate-600 max-w-[120px] truncate" title={log.actor_id}>
                    {log.actor_id ? log.actor_id.substring(0, 8) + '…' : 'system'}
                  </td>
                  <td className="px-5 py-4"><ActionBadge action={log.action} /></td>
                  <td className="px-5 py-4 text-slate-600 capitalize">{log.entity_type || '—'}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500 max-w-[100px] truncate" title={log.entity_id}>
                    {log.entity_id ? log.entity_id.substring(0, 8) + '…' : '—'}
                  </td>
                  <td className="px-5 py-4 max-w-xs">
                    {log.new_values ? (
                      <details className="cursor-pointer">
                        <summary className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View changes</summary>
                        <pre className="mt-1 text-xs text-slate-500 bg-slate-50 rounded p-2 overflow-x-auto max-w-xs">
                          {JSON.stringify(log.new_values, null, 2)}
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
              disabled={filteredLogs.length < PAGE_SIZE}
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
