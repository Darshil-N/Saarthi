import React, { useState, useEffect, useCallback } from 'react';
import { Copy, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../../frontend/src/lib/api';

// Real matching_queue.status values (schema.sql) — this page previously used
// 'pending_review' / 'merged', which never existed; 'approved' is what the backend calls a
// merge, since that is what approving a match actually does (services/receipt confirm ->
// approve_mapping RPC).
const QUEUE_STATUSES = ['all', 'pending', 'approved', 'rejected', 'auto_resolved'];

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-amber-100 text-amber-700',
    auto_resolved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
    approved: 'bg-indigo-100 text-indigo-700',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status] || 'bg-slate-100 text-slate-500'}`}>
      {status?.replace('_', ' ') || '—'}
    </span>
  );
};

const ScoreBar = ({ score }) => {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-400' : 'bg-slate-300';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-9 text-right">{pct}%</span>
    </div>
  );
};

export default function DuplicateDetection() {
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, autoResolved: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, queueRes] = await Promise.all([
        api.get('/matching/stats'),
        api.get('/matching', { params: { status: statusFilter } }),
      ]);
      setStats(statsRes.data);
      setQueue(queueRes.data || []);
    } catch (err) {
      console.error('Error fetching duplicate queue:', err);
      showToast(err.response?.data?.detail || 'Could not load the matching queue', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const resolveItem = async (id, action) => {
    setActionLoading(id);
    try {
      const { data } = await api.patch(`/matching/${id}/${action}`);
      showToast(action === 'approve' ? 'Merged — stock combined, duplicate deprecated' : 'Marked as a different material');
      fetchQueue();
    } catch (err) {
      showToast(err.response?.data?.detail || `Could not ${action} this match`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
          toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total in Queue', value: stats.total, icon: Copy, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-amber-600 bg-amber-50' },
          { label: 'Auto-Resolved', value: stats.autoResolved, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-rose-600 bg-rose-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Refresh */}
      <div className="flex gap-3 items-center flex-wrap">
        {QUEUE_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
        <button
          onClick={fetchQueue}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Match Type</th>
                <th className="px-5 py-3">New Material</th>
                <th className="px-5 py-3">Matches (existing)</th>
                <th className="px-5 py-3">Confidence</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : queue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-400">No items in queue with this status</p>
                  </td>
                </tr>
              ) : queue.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      item.match_type === 'exact' ? 'bg-rose-100 text-rose-700' :
                      item.match_type === 'near_duplicate' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {item.match_type || 'unknown'}
                    </span>
                  </td>
                  <td className="px-5 py-4 max-w-xs">
                    <p className="font-medium text-slate-800 truncate">{item.new_description}</p>
                    <p className="font-mono text-xs text-slate-400">{item.new_cnmc}</p>
                  </td>
                  <td className="px-5 py-4 max-w-xs">
                    <p className="font-medium text-slate-800 truncate">{item.matched_description}</p>
                    <p className="font-mono text-xs text-slate-400">{item.matched_cnmc}</p>
                  </td>
                  <td className="px-5 py-4 w-40">
                    <ScoreBar score={item.confidence_score} />
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {item.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          disabled={actionLoading === item.id}
                          onClick={() => resolveItem(item.id, 'approve')}
                          className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 disabled:opacity-50"
                          title="Confirm these are the same material: merges stock and deprecates the duplicate"
                        >
                          Merge
                        </button>
                        <button
                          disabled={actionLoading === item.id}
                          onClick={() => resolveItem(item.id, 'reject')}
                          className="text-xs font-medium px-2 py-1 bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200 disabled:opacity-50"
                          title="These are different materials — leave both as they are"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">
                        {item.reviewer_name ? `by ${item.reviewer_name}` : '—'}
                      </span>
                    )}
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
