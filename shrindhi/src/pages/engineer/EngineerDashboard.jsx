import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  ArrowRight, 
  ArrowUpRight, 
  Layers, 
  AlertTriangle, 
  Clock, 
  Building2, 
  MapPin, 
  Sparkles,
  CheckCircle2,
  TrendingDown,
  ChevronRight
} from 'lucide-react';
import { mockDashboardMetrics } from '../../data/dashboard';
import { mockMaterials } from '../../data/materials';
import { mockInventory, getStockStatus } from '../../data/inventory';
import { CNMCBadge } from '../../components/materials/CNMCBadge';
import { StockBadge } from '../../components/materials/StockBadge';

export function EngineerDashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/engineer/find-material?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/engineer/find-material');
    }
  };

  // Compile low-stock items from mock inventory for the attention table
  const lowStockItems = mockInventory
    .filter((inv) => inv.quantity <= inv.reorder_level * 1.5)
    .slice(0, 6)
    .map((inv) => {
      const mat = mockMaterials.find((m) => m.id === inv.material_id);
      const available = inv.quantity - inv.reserved_quantity;
      const status = getStockStatus(inv.quantity, inv.reorder_level);
      const pct = Math.min(100, Math.round((available / (inv.reorder_level || 1)) * 100));
      return {
        id: inv.id,
        materialId: mat?.id,
        description: mat?.standard_description || 'Unknown Material',
        category: mat?.category || 'GEN',
        cnmc: mat?.cnmc,
        unit: mat?.unit_of_measure || 'EA',
        locationCode: inv.location_code,
        warehouse: inv.warehouse,
        available,
        reorderLevel: inv.reorder_level,
        status,
        pct,
      };
    });

  const commonSearches = [
    { label: 'M8 stainless bolts', category: 'MECH' },
    { label: 'Gate valves', category: 'MECH' },
    { label: 'Pipe fittings', category: 'MECH' },
    { label: 'Induction motor 5HP', category: 'ELEC' },
    { label: 'Turbine oil ISO VG 46', category: 'CHEM' },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Page Header with quick status pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Engineering Dashboard
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Store Network Active
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Material and inventory operations across BharatOil stores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/engineer/catalog')}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors shadow-2xs inline-flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Master Catalog</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/engineer/inventory-map')}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors shadow-sm inline-flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Inventory Map</span>
          </button>
        </div>
      </div>

      {/* 2. Hero: Enterprise Engineering Search Console with Sleek Greyish / Silver Theme */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 via-zinc-100 to-slate-200/90 p-6 sm:p-7 text-slate-900 shadow-sm border border-slate-300/80">
        {/* Subtle metallic silver shimmer accents */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-16 w-48 h-48 bg-slate-300/40 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 font-mono">
                  Natural Language & Material Search
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-300 font-mono font-medium shadow-2xs">
                  AI-Assisted
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tracking-tight">
                Locate materials, specifications, and physical bins instantly
              </h3>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-1">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask e.g. 'Where are M8 stainless bolts?' or search by CNMC..."
                className="w-full bg-white hover:bg-white focus:bg-white text-slate-900 placeholder-slate-400 border border-slate-300 focus:border-slate-600 rounded-lg py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 transition-all shadow-xs"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 hover:from-slate-800 hover:to-zinc-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow active:scale-98 shrink-0 border border-slate-700"
            >
              <span>Search Store</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          </form>

          {/* Interactive quick searches */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Suggested:
            </span>
            {commonSearches.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => navigate(`/engineer/find-material?q=${encodeURIComponent(item.label)}`)}
                className="group text-xs text-slate-700 hover:text-slate-900 bg-white/90 hover:bg-white hover:border-slate-400 border border-slate-300/90 px-3 py-1 rounded-full transition-all duration-150 flex items-center gap-1.5 shadow-2xs hover:scale-102"
              >
                <span>{item.label}</span>
                <ArrowRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-slate-600" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Catalog Overview: 4 Richly Colored Interactive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Materials in Master (Royal Blue) */}
        <div 
          onClick={() => navigate('/engineer/catalog')}
          className="group cursor-pointer bg-white hover:bg-blue-50/30 border border-slate-200 hover:border-blue-300 rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
              100% Valid
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {mockDashboardMetrics.totalMaterials.value.toLocaleString('en-IN')}
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">
              Materials in Master
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-blue-700 transition-colors">
              <span>View full catalog</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>

        {/* Metric 2: Below Reorder Level (Amber / Orange) */}
        <div 
          onClick={() => navigate('/engineer/catalog')}
          className="group cursor-pointer bg-white hover:bg-amber-50/30 border border-slate-200 hover:border-amber-300 rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
              Attention
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-700 tracking-tight">
              {mockDashboardMetrics.lowStockItems.value}
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">
              Below Reorder Level
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-amber-700 transition-colors">
              <span>Inspect flagged items</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>

        {/* Metric 3: Recent Queries (Violet / Indigo) */}
        <div 
          onClick={() => navigate('/engineer/queries')}
          className="group cursor-pointer bg-white hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-300 rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
              Current Shift
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {mockDashboardMetrics.recentQueries.value}
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">
              Recent Queries
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-indigo-700 transition-colors">
              <span>View execution logs</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>

        {/* Metric 4: Warehouse Stores (Emerald / Teal) */}
        <div 
          onClick={() => navigate('/engineer/inventory-map')}
          className="group cursor-pointer bg-white hover:bg-emerald-50/30 border border-slate-200 hover:border-emerald-300 rounded-xl p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
              3 Facilities
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              720 Bins
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">
              Physical Storage Network
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-emerald-700 transition-colors">
              <span>Explore spatial map</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Inventory Attention Section with Stock Progress Bars */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Inventory Attention
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Materials approaching or below configured reorder thresholds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
              {lowStockItems.length} items flagged
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-mono text-slate-600">
                <th className="py-3 px-4 font-semibold">Material Description</th>
                <th className="py-3 px-3 font-semibold">Location</th>
                <th className="py-3 px-3 font-semibold">Stock Health</th>
                <th className="py-3 px-3 text-right font-semibold">Available</th>
                <th className="py-3 px-3 text-right font-semibold">Reorder</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 text-right font-semibold">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {lowStockItems.map((item) => {
                const isCritical = item.status === 'critical';
                const isLow = item.status === 'low';
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-blue-50/40 transition-colors group"
                  >
                    <td 
                      onClick={() => navigate(`/engineer/material/${item.materialId}`)}
                      className="py-3 px-4 cursor-pointer"
                    >
                      <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                        {item.description}
                      </div>
                      <div className="mt-1">
                        <CNMCBadge code={item.cnmc} />
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-700">
                      <div className="font-semibold">{item.locationCode}</div>
                      <div className="text-[10px] text-slate-400">{item.warehouse}</div>
                    </td>
                    <td className="py-3 px-3 w-44">
                      {/* Visual stock health progress bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className={isCritical ? 'text-rose-600 font-bold' : isLow ? 'text-amber-700 font-semibold' : 'text-slate-600'}>
                            {item.pct}% of reorder
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${item.pct}%` }}
                            className={`h-full rounded-full transition-all ${
                              isCritical 
                                ? 'bg-gradient-to-r from-rose-600 to-red-500' 
                                : isLow 
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600' 
                                : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            }`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                      {item.available} {item.unit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500 text-xs">
                      {item.reorderLevel} {item.unit}
                    </td>
                    <td className="py-3 px-4">
                      <StockBadge status={item.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/engineer/inventory-map?whse=${item.warehouse}&loc=${item.locationCode}`)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-medium transition-all shadow-2xs hover:scale-102"
                      >
                        <MapPin className="w-3 h-3 text-blue-600 group-hover:text-white" />
                        <span>Locate</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Warehouse Network: 3 Interactive Store Cards with Top Borders */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Warehouse Network
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Physical store locations across BharatOil facilities
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/engineer/inventory-map')}
            className="text-xs text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1 group"
          >
            <span>Open Spatial Inventory Map</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockDashboardMetrics.warehouseOverview.map((wh, idx) => {
            const borderColors = [
              'border-t-blue-600',
              'border-t-amber-500',
              'border-t-purple-600',
            ];
            const bgHover = [
              'hover:border-blue-300 hover:bg-blue-50/20',
              'hover:border-amber-300 hover:bg-amber-50/20',
              'hover:border-purple-300 hover:bg-purple-50/20',
            ];
            const tagColor = [
              'bg-blue-50 text-blue-700 border-blue-200',
              'bg-amber-50 text-amber-800 border-amber-200',
              'bg-purple-50 text-purple-700 border-purple-200',
            ];

            return (
              <div
                key={wh.code}
                onClick={() => navigate(`/engineer/inventory-map?whse=${wh.code}`)}
                className={`cursor-pointer p-4 rounded-lg border border-slate-200 border-t-4 ${borderColors[idx % 3]} ${bgHover[idx % 3]} transition-all duration-150 shadow-2xs hover:shadow-sm hover:-translate-y-0.5 group`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {wh.code}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${tagColor[idx % 3]}`}>
                    {wh.department}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900 mt-2 group-hover:text-blue-700 transition-colors">
                  {wh.name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {wh.focus}
                </div>

                {/* Capacity Progress Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-700 font-medium">
                      {wh.materialsStored} materials
                    </span>
                    <span className="text-amber-700 font-semibold">
                      {wh.lowStockCount} low stock
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(95, 60 + idx * 12)}%` }}
                      className={`h-full rounded-full ${
                        idx === 0
                          ? 'bg-blue-600'
                          : idx === 1
                          ? 'bg-amber-500'
                          : 'bg-purple-600'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Capacity: {Math.min(95, 60 + idx * 12)}%</span>
                    <span className="text-blue-700 group-hover:underline flex items-center gap-0.5">
                      View Bins <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default EngineerDashboard;
