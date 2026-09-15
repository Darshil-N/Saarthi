import React, { useState, useEffect } from 'react';
import { Copy, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import supabase from '../utils/supabase';

const QUEUE_STATUSES = ['all', 'pending_review', 'auto_resolved', 'rejected', 'merged'];

const StatusBadge = ({ status }) => {
  const styles = {
    pending_review: 'bg-amber-100 text-amber-700',
    auto_resolved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
    merged: 'bg-indigo-100 text-indigo-700',
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
  const [stats, setStats] = useState({ total: 0, pending: 0, autoResolved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchQueue = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const [totalRes, pendingRes, autoRes, rejectedRes] = await Promise.all([
        supabase.from('matching_queue').select('id', { count: 'exact', head: true }),
        supabase.from('matching_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase.from('matching_queue').select('id', { count: 'exact', head: true }).eq('status', 'auto_resolved'),
        supabase.from('matching_queue').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);
      setStats({
        total: totalRes.count || 0,
        pending: pendingRes.count || 0,
        autoResolved: autoRes.count || 0,
        rejected: rejectedRes.count || 0,
      });

      // Fetch queue items with material details
      let query = supabase
        .from('matching_queue')
        .select(`
          id, status, similarity_score, match_type, reviewed_by, reviewed_at, created_at,
          incoming_material_id,
          matched_material_id
        `)
        .order('similarity_score', { ascending: false })
        .limit(50);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      setQueue(data || []);
    } catch (err) {
      console.error('Error fetching duplicate queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, [statusFilter]);

  const resolveItem = async (id, newStatus) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('matching_queue')
        .update({ status: newStatus, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      showToast(`Marked as ${newStatus.replace('_', ' ')}`);
      fetchQueue();
    } catch (err) {
      showToast(err.message, 'error');
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
                <th className="px-5 py-3">Incoming Material ID</th>
                <th className="px-5 py-3">Matched Material ID</th>
                <th className="px-5 py-3">Similarity</th>
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
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">
                    {item.incoming_material_id?.substring(0, 8)}…
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">
                    {item.matched_material_id?.substring(0, 8)}…
                  </td>
                  <td className="px-5 py-4 w-40">
                    <ScoreBar score={item.similarity_score} />
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {item.status === 'pending_review' ? (
                      <div className="flex gap-2">
                        <button
                          disabled={actionLoading === item.id}
                          onClick={() => resolveItem(item.id, 'merged')}
                          className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 disabled:opacity-50"
                        >
                          Merge
                        </button>
                        <button
                          disabled={actionLoading === item.id}
                          onClick={() => resolveItem(item.id, 'rejected')}
                          className="text-xs font-medium px-2 py-1 bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
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
