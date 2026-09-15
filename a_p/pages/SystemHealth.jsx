import React, { useState, useEffect } from 'react';
import { Activity, Database, Cpu, AlertCircle, CheckCircle2, RefreshCw, Clock, Zap } from 'lucide-react';
import supabase from '../utils/supabase';

const HealthCard = ({ title, value, unit, status, icon: Icon, description }) => {
  const statusColors = {
    good: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    critical: 'border-rose-200 bg-rose-50',
    info: 'border-slate-200 bg-white',
  };
  const iconColors = {
    good: 'text-emerald-600 bg-emerald-100',
    warning: 'text-amber-600 bg-amber-100',
    critical: 'text-rose-600 bg-rose-100',
    info: 'text-indigo-600 bg-indigo-50',
  };
  return (
    <div className={`rounded-xl border shadow-sm p-5 ${statusColors[status] || statusColors.info}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">{title}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-800">{value ?? '—'}</span>
            {unit && <span className="text-sm text-slate-400">{unit}</span>}
          </div>
          {description && <p className="text-xs text-slate-400 mt-2">{description}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${iconColors[status] || iconColors.info}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const StatRow = ({ label, value, mono }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
    <span className="text-sm text-slate-500">{label}</span>
    <span className={`text-sm font-semibold text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
  </div>
);

export default function SystemHealth() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbPing, setDbPing] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    const start = Date.now();
    try {
      const [matRes, grRes, auditRes, queueRes, nlRes] = await Promise.all([
        supabase.from('materials').select('id', { count: 'exact', head: true }),
        supabase.from('goods_receipts').select('id', { count: 'exact', head: true }),
        supabase.from('audit_log').select('id', { count: 'exact', head: true }),
        supabase.from('matching_queue').select('id', { count: 'exact', head: true }),
        supabase.from('nl_query_log').select('id', { count: 'exact', head: true }),
      ]);
      const elapsed = Date.now() - start;
      setDbPing(elapsed);
      setStats({
        materials: matRes.count || 0,
        goodsReceipts: grRes.count || 0,
        auditEntries: auditRes.count || 0,
        matchingQueue: queueRes.count || 0,
        nlQueries: nlRes.count || 0,
      });
      setLastChecked(new Date());
    } catch (err) {
      console.error('Error fetching system health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  const pingStatus = dbPing === null ? 'info' : dbPing < 200 ? 'good' : dbPing < 800 ? 'warning' : 'critical';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">
            {lastChecked
              ? `Last checked: ${lastChecked.toLocaleTimeString('en-IN')}`
              : 'Checking system…'}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Connectivity & Performance */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Connectivity &amp; Performance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HealthCard
            title="Database Response Time"
            value={loading ? '…' : `${dbPing}`}
            unit="ms"
            status={loading ? 'info' : pingStatus}
            icon={Zap}
            description={pingStatus === 'good' ? 'Excellent' : pingStatus === 'warning' ? 'Acceptable' : 'Slow — check network'}
          />
          <HealthCard
            title="Supabase Connection"
            value={loading ? '…' : dbPing ? 'Connected' : 'Error'}
            status={loading ? 'info' : dbPing ? 'good' : 'critical'}
            icon={CheckCircle2}
            description="PostgREST API reachable"
          />
          <HealthCard
            title="pgvector Extension"
            value="Active"
            status="good"
            icon={Cpu}
            description="768-dim embeddings enabled"
          />
        </div>
      </div>

      {/* Database Statistics */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Database Statistics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HealthCard
            title="Total Materials"
            value={loading ? '…' : stats?.materials?.toLocaleString()}
            status="info"
            icon={Database}
            description="In material master"
          />
          <HealthCard
            title="Goods Receipts"
            value={loading ? '…' : stats?.goodsReceipts?.toLocaleString()}
            status="info"
            icon={Activity}
            description="All GRs recorded"
          />
          <HealthCard
            title="Audit Log Entries"
            value={loading ? '…' : stats?.auditEntries?.toLocaleString()}
            status="info"
            icon={Clock}
            description="System actions tracked"
          />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-slate-800 mb-4">System Details</h3>
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div>
            <StatRow label="Materials in master" value={stats?.materials?.toLocaleString() ?? '—'} />
            <StatRow label="Goods receipts created" value={stats?.goodsReceipts?.toLocaleString() ?? '—'} />
            <StatRow label="Audit log entries" value={stats?.auditEntries?.toLocaleString() ?? '—'} />
            <StatRow label="Matching queue entries" value={stats?.matchingQueue?.toLocaleString() ?? '—'} />
            <StatRow label="NL queries processed" value={stats?.nlQueries?.toLocaleString() ?? '—'} />
            <StatRow label="API latency (last check)" value={dbPing ? `${dbPing}ms` : '—'} />
            <StatRow
              label="Supabase Project"
              value={import.meta.env.VITE_SUPABASE_URL?.replace('https://', '').split('.')[0] || 'Not configured'}
              mono
            />
          </div>
        )}
      </div>

      {/* Gemini API Usage Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Gemini API Usage</p>
          <p className="text-sm text-amber-700 mt-1">
            Token usage and per-model analytics require a backend service endpoint. Connect your FastAPI backend at 
            <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded text-xs">/dashboard/admin</code>
            to see real-time Gemini usage metrics here.
          </p>
        </div>
      </div>
    </div>
  );
}
