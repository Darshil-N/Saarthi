import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, Package, MessageSquare, Map,
  ArrowRight, CheckCircle2, Clock, TrendingUp
} from 'lucide-react';
import supabase from '../utils/supabase';

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

export default function EngineerHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalMaterials: null,
    approvedMaterials: null,
    pendingMaterials: null,
    totalInventoryLocations: null,
  });
  const [recentMaterials, setRecentMaterials] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [totalRes, approvedRes, pendingRes, invRes, recentRes, lowStockRes] = await Promise.all([
          supabase.from('materials').select('id', { count: 'exact', head: true }),
          supabase.from('materials').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase.from('materials').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('inventory').select('location_code', { count: 'exact', head: true }),
          supabase.from('materials')
            .select('id, cnmc, standard_description, status, category, created_at')
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(6),
          supabase.from('inventory')
            .select('id, material_id, location_code, quantity_on_hand, materials(standard_description, cnmc)')
            .order('quantity_on_hand', { ascending: true })
            .limit(5),
        ]);

        setStats({
          totalMaterials: totalRes.count,
          approvedMaterials: approvedRes.count,
          pendingMaterials: pendingRes.count,
          totalInventoryLocations: invRes.count,
        });
        setRecentMaterials(recentRes.data || []);
        setLowStockItems(lowStockRes.data || []);
      } catch (err) {
        console.error('EngineerHome fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const StatusBadge = ({ status }) => {
    const map = {
      approved: 'bg-emerald-100 text-emerald-700',
      pending: 'bg-amber-100 text-amber-700',
      deprecated: 'bg-slate-100 text-slate-500',
    };
    return (
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] || 'bg-slate-100 text-slate-500'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-xl p-6 text-white flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Engineering Dashboard</h2>
          <p className="text-teal-100 text-sm mt-1">
            Query the material catalog, review inventory levels, and explore warehouse maps
          </p>
        </div>
        <TrendingUp className="w-12 h-12 text-teal-300 opacity-60" />
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
            value={stats.totalMaterials?.toLocaleString()}
            icon={Database}
            color="bg-teal-50 text-teal-600"
            description="In master catalog"
            onClick={() => navigate('/engineer/catalog')}
          />
          <MetricCard
            title="Approved CNMCs"
            value={stats.approvedMaterials?.toLocaleString()}
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-600"
            description="Active & standardized"
            onClick={() => navigate('/engineer/catalog')}
          />
          <MetricCard
            title="Pending Review"
            value={stats.pendingMaterials?.toLocaleString()}
            icon={Clock}
            color="bg-amber-50 text-amber-600"
            description="Awaiting approval"
            onClick={() => navigate('/engineer/catalog')}
          />
          <MetricCard
            title="Inventory Slots"
            value={stats.totalInventoryLocations?.toLocaleString()}
            icon={Package}
            color="bg-blue-50 text-blue-600"
            description="Bin-level stock records"
            onClick={() => navigate('/engineer/inventory-map')}
          />
        </div>
      )}

      {/* Quick Actions + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-3">
          <h3 className="font-bold text-slate-800 mb-2">Quick Actions</h3>
          {[
            { label: 'Ask a question about stock', to: '/engineer/nl-query', icon: MessageSquare, color: 'text-teal-600 bg-teal-50' },
            { label: 'Browse material catalog', to: '/engineer/catalog', icon: BookOpenIcon, color: 'text-blue-600 bg-blue-50' },
            { label: 'View warehouse map', to: '/engineer/inventory-map', icon: Map, color: 'text-purple-600 bg-purple-50' },
          ].map(({ label, to, icon: Icon, color }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors text-left group"
            >
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-slate-700 group-hover:text-teal-600 flex-1">{label}</span>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
            </button>
          ))}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Lowest Stock Levels</h3>
            <button
              onClick={() => navigate('/engineer/inventory-map')}
              className="text-sm text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1"
            >
              View map <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : lowStockItems.length === 0 ? (
            <p className="text-slate-400 text-sm py-6 text-center">No inventory data yet</p>
          ) : (
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    item.quantity_on_hand <= 5 ? 'bg-red-500' :
                    item.quantity_on_hand <= 20 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {item.materials?.standard_description || item.material_id}
                    </p>
                    <p className="text-xs text-slate-400">{item.location_code}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${
                    item.quantity_on_hand <= 5 ? 'text-red-600' :
                    item.quantity_on_hand <= 20 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {item.quantity_on_hand}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Approved Materials */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Recently Approved Materials</h3>
          <button
            onClick={() => navigate('/engineer/catalog')}
            className="text-sm text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1"
          >
            Browse all <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">CNMC</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : recentMaterials.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No materials found</td></tr>
              ) : recentMaterials.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">{m.cnmc || '—'}</td>
                  <td className="px-6 py-4 font-medium text-slate-800 max-w-xs truncate">{m.standard_description}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{m.category || '—'}</td>
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

// inline icon to avoid import issues
const BookOpenIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);
