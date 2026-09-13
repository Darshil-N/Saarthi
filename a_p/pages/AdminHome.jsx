import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, CheckCircle2, Clock, Copy, BarChart2,
  ArrowRight, AlertTriangle, Shield, Users
} from 'lucide-react';
import supabase from '../utils/supabase';

const StatusBadge = ({ status }) => {
  const colors = {
    approved: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    deprecated: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colors[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
};

const MetricCard = ({ title, value, icon: Icon, color, description, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-3 transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
  >
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-500">{title}</span>
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div className="text-3xl font-bold text-slate-800">{value ?? '—'}</div>
    {description && <p className="text-xs text-slate-400">{description}</p>}
  </div>
);

export default function AdminHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: null,
    approved: null,
    pending: null,
    duplicates: null,
    qualityScore: null,
  });
  const [recentMaterials, setRecentMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [totalRes, approvedRes, pendingRes, dupRes, allMatRes] = await Promise.all([
          supabase.from('materials').select('id', { count: 'exact', head: true }),
          supabase.from('materials').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase.from('materials').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('matching_queue').select('id', { count: 'exact', head: true }),
          supabase.from('materials').select('technical_specs').eq('status', 'approved').limit(500),
        ]);

        const approved = approvedRes.count || 0;
        const total = totalRes.count || 0;

        // Data quality: % of approved materials with non-null technical_specs
        const specsData = allMatRes.data || [];
        const withSpecs = specsData.filter(m => m.technical_specs && Object.keys(m.technical_specs).length > 0).length;
        const qualityScore = specsData.length > 0 ? Math.round((withSpecs / specsData.length) * 100) : 0;

        setStats({
          total,
          approved,
          pending: pendingRes.count || 0,
          duplicates: dupRes.count || 0,
          qualityScore,
        });
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      }
    }

    async function fetchRecentMaterials() {
      try {
        const { data } = await supabase
          .from('materials')
          .select('id, cnmc, standard_description, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentMaterials(data || []);
      } catch (err) {
        console.error('Failed to fetch recent materials:', err);
      }
    }

    Promise.all([fetchStats(), fetchRecentMaterials()]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl p-6 text-white flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Admin Control Centre</h2>
          <p className="text-indigo-200 text-sm mt-1">Full visibility into the NUMM material master &amp; system health</p>
        </div>
        <Shield className="w-12 h-12 text-indigo-300 opacity-60" />
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Materials"
            value={stats.total?.toLocaleString()}
            icon={Database}
            color="bg-indigo-50 text-indigo-600"
            description="In master material list"
            onClick={() => navigate('/admin/material-governance')}
          />
          <MetricCard
            title="Approved CNMCs"
            value={stats.approved?.toLocaleString()}
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-600"
            description="Active & approved"
            onClick={() => navigate('/admin/material-governance')}
          />
          <MetricCard
            title="Pending Approval"
            value={stats.pending?.toLocaleString()}
            icon={Clock}
            color="bg-amber-50 text-amber-600"
            description="Awaiting review"
            onClick={() => navigate('/admin/material-governance')}
          />
          <MetricCard
            title="Duplicates Detected"
            value={stats.duplicates?.toLocaleString()}
            icon={Copy}
            color="bg-rose-50 text-rose-600"
            description="All time, in matching queue"
            onClick={() => navigate('/admin/duplicate-detection')}
          />
        </div>
      )}

      {/* Data Quality & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Data Quality Score */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800">Data Quality Score</h3>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-5xl font-extrabold text-indigo-600">
              {loading ? '—' : `${stats.qualityScore}%`}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-indigo-500 transition-all duration-700"
              style={{ width: loading ? '0%' : `${stats.qualityScore}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">% of approved materials with complete technical specs</p>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-3 lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-2">Quick Actions</h3>
          {[
            { label: 'Review pending materials', to: '/admin/material-governance', icon: Clock, color: 'text-amber-600 bg-amber-50' },
            { label: 'View new duplicates', to: '/admin/duplicate-detection', icon: Copy, color: 'text-rose-600 bg-rose-50' },
            { label: 'Audit trail — latest activity', to: '/admin/audit-trail', icon: AlertTriangle, color: 'text-slate-600 bg-slate-100' },
            { label: 'Manage user accounts', to: '/admin/user-management', icon: Users, color: 'text-indigo-600 bg-indigo-50' },
          ].map(({ label, to, icon: Icon, color }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors text-left group"
            >
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 flex-1">{label}</span>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Recent Materials */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Recently Added Materials</h3>
          <button
            onClick={() => navigate('/admin/material-governance')}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">CNMC</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : recentMaterials.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">No materials found</td></tr>
              ) : recentMaterials.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">{m.cnmc || '—'}</td>
                  <td className="px-6 py-4 font-medium text-slate-800 max-w-xs truncate">{m.standard_description}</td>
                  <td className="px-6 py-4"><StatusBadge status={m.status} /></td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {m.created_at ? new Date(m.created_at).toLocaleDateString('en-IN') : '—'}
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
