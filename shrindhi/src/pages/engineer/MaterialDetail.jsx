import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp,
  Clock,
  Layers,
  Sparkles,
  Building2,
  Tag,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { mockMaterials } from '../../data/materials';
import { mockInventory } from '../../data/inventory';
import { mockPriceHistory } from '../../data/priceHistory';
import { CNMCBadge } from '../../components/materials/CNMCBadge';

export function MaterialDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const material = useMemo(() => {
    const found = mockMaterials.find((m) => m.id === id);
    return found || mockMaterials[0];
  }, [id]);

  const inventoryLocations = useMemo(() => {
    return mockInventory.filter((inv) => inv.material_id === material.id);
  }, [material.id]);

  const prices = useMemo(() => {
    return mockPriceHistory.filter((ph) => ph.material_id === material.id);
  }, [material.id]);

  const relatedMaterials = useMemo(() => {
    return mockMaterials
      .filter((m) => m.id !== material.id && m.subcategory === material.subcategory)
      .slice(0, 3)
      .map((m, idx) => ({
        ...m,
        matchType: idx === 0 ? 'equivalent' : 'near_duplicate',
        confidenceScore: idx === 0 ? 0.92 : 0.84,
      }));
  }, [material]);

  const auditLogs = [
    { action: 'CNMC_GENERATED', actor: 'AI Engine (Gemini 1.5)', timestamp: '2025-11-10 09:14:00', details: 'Generated CNMC code adhering to BharatOil taxonomy' },
    { action: 'MATERIAL_APPROVED', actor: 'Admin Master Governance', timestamp: '2025-11-10 14:30:00', details: 'Status approved and published to engineering catalog' },
    { action: 'STOCK_INTAKE_GR', actor: 'Store Officer (GR-2026-0012)', timestamp: '2026-02-12 11:20:00', details: 'Stock updated after Goods Receipt confirmation' },
  ];

  const totalStock = inventoryLocations.reduce((sum, l) => sum + l.quantity, 0);
  const totalReserved = inventoryLocations.reduce((sum, l) => sum + l.reserved_quantity, 0);
  const totalAvailable = totalStock - totalReserved;

  return (
    <div className="space-y-6">
      {/* 1. Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-sans">
          <button
            type="button"
            onClick={() => navigate('/engineer/catalog')}
            className="hover:text-blue-700 font-medium transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Master Catalog</span>
          </button>
          <span>/</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
            {material.category}
          </span>
          <span>/</span>
          <span>{material.subcategory}</span>
          <span>/</span>
          <span className="text-slate-900 font-semibold truncate max-w-xs">
            {material.short_description || material.standard_description}
          </span>
        </div>

        {inventoryLocations[0] && (
          <button
            type="button"
            onClick={() =>
              navigate(
                `/engineer/inventory-map?whse=${inventoryLocations[0].warehouse}&loc=${inventoryLocations[0].location_code}`
              )
            }
            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-sm"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Locate on Inventory Map</span>
          </button>
        )}
      </div>

      {/* 2. Main Engineering Record Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-8">
        {/* Header Block with Rich Colored Accents */}
        <div className="space-y-4 pb-6 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2.5">
            <CNMCBadge code={material.cnmc} className="text-xs" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Approved Engineering Standard
            </span>
            <span className="text-xs font-mono text-slate-400 ml-auto bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              ID: {material.id}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {material.standard_description}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="text-slate-400 text-[10px] font-mono uppercase block font-semibold">Category</span>
              <span className="text-blue-900 font-bold font-mono text-sm mt-0.5 block">{material.category}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="text-slate-400 text-[10px] font-mono uppercase block font-semibold">Subcategory</span>
              <span className="text-slate-800 font-semibold mt-0.5 block truncate">{material.subcategory}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="text-slate-400 text-[10px] font-mono uppercase block font-semibold">Material Type</span>
              <span className="text-slate-800 font-semibold mt-0.5 block truncate">{material.material_type}</span>
            </div>
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
              <span className="text-blue-700 text-[10px] font-mono uppercase block font-semibold">Available Stock</span>
              <span className="text-blue-950 font-bold font-mono text-sm mt-0.5 block">
                {totalAvailable} {material.unit_of_measure}
              </span>
            </div>
          </div>
        </div>

        {/* Technical Specifications Section */}
        <div className="space-y-3 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
              Technical Specifications
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
              Verified Specs
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(material.technical_specs || {}).map(([k, v]) => (
              <div key={k} className="p-3 bg-slate-50/80 hover:bg-slate-100/70 rounded-lg border border-slate-200 text-xs transition-colors">
                <div className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                  {k.replace(/_/g, ' ')}
                </div>
                <div className="text-slate-900 font-bold font-mono mt-1 text-xs">
                  {String(v)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory by Location Section with Colorful Table */}
        <div className="space-y-3 pb-6 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
              Inventory by Storage Location ({inventoryLocations.length} stores)
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Formula: Available = Physical Stock - Reserved
            </span>
          </div>

          {inventoryLocations.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              No active inventory records for this material in storage facilities.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-mono text-slate-600">
                    <th className="py-3 px-3.5 font-semibold">Location Code</th>
                    <th className="py-3 px-3 font-semibold">Warehouse</th>
                    <th className="py-3 px-3 font-semibold">Coordinates</th>
                    <th className="py-3 px-3 text-right font-semibold">Total Physical</th>
                    <th className="py-3 px-3 text-right font-semibold">Reserved</th>
                    <th className="py-3 px-3 text-right font-semibold text-blue-900">Available Stock</th>
                    <th className="py-3 px-3.5 text-right font-semibold">Interactive Map</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {inventoryLocations.map((loc) => {
                    const available = loc.quantity - loc.reserved_quantity;
                    return (
                      <tr key={loc.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-blue-900">
                          {loc.location_code}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">{loc.warehouse}</td>
                        <td className="py-3 px-3 text-slate-500 font-sans">
                          Aisle {loc.aisle} → Rack {loc.rack} → Bin {loc.bin}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-800">
                          {loc.quantity} {material.unit_of_measure}
                        </td>
                        <td className="py-3 px-3 text-right text-amber-700 font-semibold">
                          {loc.reserved_quantity}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-blue-700">
                          <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                            {available} {material.unit_of_measure}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-sans">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/engineer/inventory-map?whse=${loc.warehouse}&loc=${loc.location_code}`
                              )
                            }
                            className="text-xs text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Locate</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 12-Month Price History Section with Vibrant Visual Bars */}
        <div className="space-y-4 pb-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                12-Month Purchase Price Trend & History
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Source: BharatOil ERP Ledger
            </span>
          </div>

          {prices.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              No recent purchase price records found for this material.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Vibrant Bar Chart */}
              <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200">
                <div className="h-32 w-full flex items-end justify-between gap-4 pt-3 border-b border-slate-200">
                  {prices.map((p, idx) => {
                    const maxPrice = Math.max(...prices.map((pr) => pr.unit_price)) * 1.15;
                    const heightPercent = Math.round((p.unit_price / maxPrice) * 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <span className="text-[10px] font-mono text-blue-900 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          ₹{p.unit_price.toFixed(2)}
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full max-w-[28px] bg-gradient-to-t from-blue-700 to-blue-500 group-hover:from-amber-500 group-hover:to-amber-400 rounded-t transition-all shadow-2xs"
                          title={`${p.purchase_date}: ₹${p.unit_price} from ${p.vendor_name}`}
                        />
                        <span className="text-[10px] font-mono text-slate-500 truncate w-full text-center">
                          {p.purchase_date.substring(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-mono text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">Purchase Date</th>
                      <th className="py-2.5 px-3 font-semibold">Approved Vendor</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Quantity</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {prices.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600">{p.purchase_date}</td>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-900">{p.vendor_name}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-semibold">{p.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          <span className="text-emerald-700">₹{p.unit_price.toFixed(2)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 2-Column Bottom Meta: Related Materials & Audit History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
          {/* Related / Equivalent Materials */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Equivalent / Near Duplicate Materials
              </h3>
            </div>
            <div className="space-y-2">
              {relatedMaterials.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => navigate(`/engineer/material/${rel.id}`)}
                  className="p-3.5 bg-slate-50 hover:bg-blue-50/60 rounded-lg border border-slate-200 hover:border-blue-300 cursor-pointer transition-all duration-150 group shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <CNMCBadge code={rel.cnmc} className="text-[10px]" />
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                      {Math.round(rel.confidenceScore * 100)}% Match
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-2 truncate group-hover:text-blue-700 transition-colors">
                    {rel.standard_description}
                  </div>
                  <div className="text-[11px] text-slate-500 font-sans mt-0.5 capitalize flex items-center justify-between">
                    <span>Classification: {rel.matchType.replace('_', ' ')}</span>
                    <span className="text-blue-700 font-semibold flex items-center gap-0.5">
                      Inspect <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit History */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Audit Trail (Read-Only)
              </h3>
            </div>
            <div className="space-y-3">
              {auditLogs.map((log, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-blue-900">
                      {log.action}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {log.timestamp}
                    </span>
                  </div>
                  <div className="text-slate-700 text-xs">{log.details}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Actor: {log.actor}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MaterialDetail;
