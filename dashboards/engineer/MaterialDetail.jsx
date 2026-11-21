import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Clock,
  Layers,
  Package,
  Tag,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import api from '../../frontend/src/lib/api';
import CNMCBadge from '../../frontend/src/components/materials/CNMCBadge';

// ─── tiny helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    pending:  'bg-amber-50  text-amber-800  border-amber-200',
    deprecated: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
      {status === 'approved' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
      {status}
    </span>
  );
}

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse bg-slate-100 rounded ${className}`} />;
}

function ErrorBox({ message }) {
  return (
    <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {message}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function MaterialDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [material,    setMaterial]    = useState(null);
  const [inventory,   setInventory]   = useState([]);
  const [prices,      setPrices]      = useState([]);
  const [equivalents, setEquivalents] = useState([]);

  const [loadingMaterial,  setLoadingMaterial]  = useState(true);
  const [loadingDetails,   setLoadingDetails]   = useState(true);
  const [error,            setError]            = useState(null);

  // ── fetch core material record ───────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoadingMaterial(true);
    setError(null);
    api.get(`/materials/${id}`)
      .then(res => setMaterial(res.data))
      .catch(() => setError('Material not found or failed to load.'))
      .finally(() => setLoadingMaterial(false));
  }, [id]);

  // ── fetch supplementary data in parallel ─────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoadingDetails(true);
    Promise.allSettled([
      api.get('/inventory', { params: { material_id: id, limit: 200 } }),
      api.get(`/materials/${id}/price-history`, { params: { limit: 24 } }),
      api.get(`/materials/${id}/equivalents`),
    ]).then(([invRes, priceRes, eqRes]) => {
      if (invRes.status   === 'fulfilled') setInventory(invRes.value.data   || []);
      if (priceRes.status === 'fulfilled') setPrices(priceRes.value.data    || []);
      if (eqRes.status    === 'fulfilled') setEquivalents(eqRes.value.data  || []);
    }).finally(() => setLoadingDetails(false));
  }, [id]);

  // ── derived totals ────────────────────────────────────────────────────────
  const totalStock     = inventory.reduce((s, l) => s + (l.quantity          || 0), 0);
  const totalReserved  = inventory.reduce((s, l) => s + (l.reserved_quantity || 0), 0);
  const totalAvailable = totalStock - totalReserved;

  // ── loading state ─────────────────────────────────────────────────────────
  if (loadingMaterial) {
    return (
      <div className="space-y-6 p-1">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-48 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    );
  }

  if (error || !material) {
    return <ErrorBox message={error || 'Material not found.'} />;
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Breadcrumb & Navigation ──────────────────────────────────── */}
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
          {material.subcategory && (
            <>
              <span>/</span>
              <span>{material.subcategory}</span>
            </>
          )}
          <span>/</span>
          <span className="text-slate-900 font-semibold truncate max-w-xs">
            {material.short_description || material.standard_description}
          </span>
        </div>

        {inventory[0] && (
          <button
            type="button"
            onClick={() =>
              navigate(`/engineer/inventory-map?loc=${inventory[0].location_code}`)
            }
            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Locate on Inventory Map</span>
          </button>
        )}
      </div>

      {/* ── 2. Main Engineering Record ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-8">

        {/* Header Block */}
        <div className="space-y-4 pb-6 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2.5">
            <CNMCBadge cnmc={material.cnmc} is_new_material={material.status !== 'approved'} />
            <StatusBadge status={material.status} />
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
              <span className="text-blue-900 font-bold font-mono text-sm mt-0.5 block">{material.category || '—'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="text-slate-400 text-[10px] font-mono uppercase block font-semibold">Subcategory</span>
              <span className="text-slate-800 font-semibold mt-0.5 block truncate">{material.subcategory || '—'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <span className="text-slate-400 text-[10px] font-mono uppercase block font-semibold">Material Type</span>
              <span className="text-slate-800 font-semibold mt-0.5 block truncate">{material.material_type || '—'}</span>
            </div>
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
              <span className="text-blue-700 text-[10px] font-mono uppercase block font-semibold">Available Stock</span>
              <span className="text-blue-950 font-bold font-mono text-sm mt-0.5 block">
                {loadingDetails ? '…' : `${totalAvailable} ${material.unit_of_measure || ''}`}
              </span>
            </div>
          </div>
        </div>

        {/* Technical Specifications */}
        {material.technical_specs && Object.keys(material.technical_specs).length > 0 && (
          <div className="space-y-3 pb-6 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Technical Specifications
              </h3>
              <span className="text-[10px] font-mono px-1.5 rounded bg-slate-100 text-slate-600">Verified</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(material.technical_specs).map(([k, v]) => (
                <div key={k} className="p-3 bg-slate-50/80 hover:bg-slate-100/70 rounded-lg border border-slate-200 text-xs transition-colors">
                  <div className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                    {k.replace(/_/g, ' ')}
                  </div>
                  <div className="text-slate-900 font-bold font-mono mt-1 text-xs">{String(v)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory by Location */}
        <div className="space-y-3 pb-6 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Inventory by Storage Location
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Available = Physical − Reserved
            </span>
          </div>

          {loadingDetails ? (
            <SkeletonBlock className="h-24" />
          ) : inventory.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              No active inventory records for this material.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-mono text-slate-600">
                    <th className="py-3 px-3.5 font-semibold">Location Code</th>
                    <th className="py-3 px-3 text-right font-semibold">Total Physical</th>
                    <th className="py-3 px-3 text-right font-semibold">Reserved</th>
                    <th className="py-3 px-3 text-right font-semibold text-blue-900">Available</th>
                    <th className="py-3 px-3.5 text-right font-semibold">Map</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {inventory.map((loc) => {
                    const avail = (loc.quantity || 0) - (loc.reserved_quantity || 0);
                    return (
                      <tr key={loc.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-blue-900">{loc.location_code}</td>
                        <td className="py-3 px-3 text-right text-slate-800">{loc.quantity} {material.unit_of_measure}</td>
                        <td className="py-3 px-3 text-right text-amber-700 font-semibold">{loc.reserved_quantity}</td>
                        <td className="py-3 px-3 text-right font-bold text-blue-700">
                          <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                            {avail} {material.unit_of_measure}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/engineer/inventory-map?loc=${loc.location_code}`)}
                            className="text-xs text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            <MapPin className="w-3 h-3" />
                            Locate
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

        {/* Price History */}
        <div className="space-y-4 pb-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Purchase Price History
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Source: BharatOil ERP Ledger</span>
          </div>

          {loadingDetails ? (
            <SkeletonBlock className="h-32" />
          ) : prices.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              No purchase price records found for this material.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bar chart */}
              <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200">
                <div className="h-32 w-full flex items-end justify-between gap-2 border-b border-slate-200">
                  {prices.map((p, idx) => {
                    const maxPrice = Math.max(...prices.map(pr => pr.unit_price)) * 1.15;
                    const heightPercent = Math.round((p.unit_price / maxPrice) * 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                        <span className="text-[10px] font-mono text-blue-900 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          ₹{p.unit_price?.toFixed(2)}
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full max-w-[28px] bg-gradient-to-t from-blue-700 to-blue-500 group-hover:from-amber-500 group-hover:to-amber-400 rounded-t transition-all shadow-sm"
                          title={`${p.purchase_date}: ₹${p.unit_price} from ${p.vendor_name}`}
                        />
                        <span className="text-[10px] font-mono text-slate-500 truncate w-full text-center">
                          {(p.purchase_date || '').substring(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transactions table */}
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
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-900">{p.vendor_name || '—'}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-semibold">{p.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-bold">
                          <span className="text-emerald-700">₹{p.unit_price?.toFixed(2)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Bottom: Equivalents & Additional Specs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">

          {/* Equivalent / Related Materials */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Equivalent / Related Materials
              </h3>
            </div>
            {loadingDetails ? (
              <SkeletonBlock className="h-20" />
            ) : equivalents.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No confirmed equivalents on record.</p>
            ) : (
              <div className="space-y-2">
                {equivalents.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => navigate(`/engineer/material/${rel.id}`)}
                    className="p-3.5 bg-slate-50 hover:bg-blue-50/60 rounded-lg border border-slate-200 hover:border-blue-300 cursor-pointer transition-all duration-150 group shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <CNMCBadge cnmc={rel.cnmc} is_new_material={false} />
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-2 truncate group-hover:text-blue-700 transition-colors">
                      {rel.standard_description}
                    </div>
                    <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-0.5 mt-1">
                      Inspect <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional metadata */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Record Details
              </h3>
            </div>
            <div className="space-y-2 text-xs">
              {[
                ['Spec', material.spec],
                ['Quality Grade', material.quality_grade],
                ['Unit of Measure', material.unit_of_measure],
                ['Created', material.created_at ? new Date(material.created_at).toLocaleString('en-IN') : null],
                ['Last Updated', material.updated_at ? new Date(material.updated_at).toLocaleString('en-IN') : null],
              ].map(([label, val]) => val ? (
                <div key={label} className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold text-slate-500">{label}</span>
                  <span className="text-slate-800 font-mono text-[11px]">{val}</span>
                </div>
              ) : null)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
