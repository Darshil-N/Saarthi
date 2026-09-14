import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import supabase from '../utils/supabase';

// ─── Helpers ────────────────────────────────────────────────────────────────

const WAREHOUSES = ['WHSE-A', 'WHSE-B', 'WHSE-C'];
const WAREHOUSE_LABELS = {
  'WHSE-A': 'Warehouse A — Mechanical',
  'WHSE-B': 'Warehouse B — Electrical',
  'WHSE-C': 'Warehouse C — Chemicals & Consumables',
};

/**
 * Parse a location_code like "WHSE-A-A1-R2-B3" into parts.
 * Returns { warehouse, aisle, rack, bin } or null if unrecognised.
 */
function parseLocation(code) {
  if (!code) return null;
  const parts = code.split('-');
  // Minimum: WHSE-X-aisle-rack-bin (5 parts)
  if (parts.length < 3) return null;
  return {
    warehouse: `${parts[0]}-${parts[1]}`, // e.g. WHSE-A
    aisle: parts[2] || null,              // e.g. A1
    rack: parts[3] || null,               // e.g. R2
    bin: parts[4] || null,                // e.g. B3
    full: code,
  };
}

function getBinColor(qty, reorderLevel = 10, maxLevel = 100) {
  if (qty === 0) return { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-400', label: 'Empty' };
  if (qty < reorderLevel) return { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700', label: 'Low' };
  if (qty < maxLevel * 0.5) return { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700', label: 'Medium' };
  return { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700', label: 'Good' };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function InventoryMap() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState('WHSE-A');
  const [selectedBin, setSelectedBin] = useState(null);  // { location, items }
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(
          'id, location_code, quantity_on_hand, quantity_reserved, last_receipt_date,' +
          'materials(id, cnmc, standard_description, short_description, uom, category)'
        );
      if (error) throw error;
      setInventory(data || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('InventoryMap fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();

    // Subscribe to real-time updates on inventory table
    const channel = supabase
      .channel('inventory-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => { fetchInventory(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Group inventory by warehouse → aisle → rack → bin
  const warehouseData = React.useMemo(() => {
    const data = {};
    for (const item of inventory) {
      const loc = parseLocation(item.location_code);
      if (!loc) continue;
      if (!data[loc.warehouse]) data[loc.warehouse] = {};
      const wh = data[loc.warehouse];
      if (!wh[loc.aisle]) wh[loc.aisle] = {};
      const aisle = wh[loc.aisle];
      if (!aisle[loc.rack]) aisle[loc.rack] = {};
      const rack = aisle[loc.rack];
      if (!rack[loc.full]) rack[loc.full] = [];
      rack[loc.full].push(item);
    }
    return data;
  }, [inventory]);

  const currentWH = warehouseData[selectedWarehouse] || {};
  const aisles = Object.keys(currentWH).sort();

  const handleBinClick = (locCode, items) => {
    if (selectedBin?.location === locCode) {
      setSelectedBin(null);
    } else {
      setSelectedBin({ location: locCode, items });
    }
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Warehouse tabs */}
        <div className="flex gap-2 flex-wrap">
          {WAREHOUSES.map(wh => (
            <button
              key={wh}
              onClick={() => { setSelectedWarehouse(wh); setSelectedBin(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                selectedWarehouse === wh
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {wh}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-slate-400">
              Live · updated {lastRefresh.toLocaleTimeString('en-IN')}
            </span>
          )}
          <button
            onClick={fetchInventory}
            className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Warehouse label */}
      <div>
        <h2 className="text-lg font-bold text-slate-800">{WAREHOUSE_LABELS[selectedWarehouse]}</h2>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-600">
        {[
          { color: 'bg-emerald-200 border-emerald-300', label: 'Good stock (>50%)' },
          { color: 'bg-amber-200 border-amber-300', label: 'Medium (reorder–50%)' },
          { color: 'bg-red-200 border-red-300', label: 'Low (<reorder)' },
          { color: 'bg-slate-100 border-slate-200', label: 'Empty' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded border ${color}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      ) : aisles.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center text-slate-400">
          <p className="font-medium mb-1">No inventory data for {selectedWarehouse}</p>
          <p className="text-sm">Goods receipts will populate this map once confirmed.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="space-y-6">
            {aisles.map(aisle => {
              const racks = Object.keys(currentWH[aisle]).sort();
              return (
                <div key={aisle} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">
                    Aisle {aisle}
                  </h3>
                  <div className="space-y-4">
                    {racks.map(rack => {
                      const bins = currentWH[aisle][rack];
                      const binCodes = Object.keys(bins).sort();
                      return (
                        <div key={rack} className="flex items-start gap-4">
                          <span className="text-xs font-mono text-slate-400 w-14 pt-1.5 shrink-0">{rack}</span>
                          <div className="flex flex-wrap gap-2">
                            {binCodes.map(binCode => {
                              const items = bins[binCode];
                              const totalQty = items.reduce((s, i) => s + (i.quantity_on_hand || 0), 0);
                              const colors = getBinColor(totalQty);
                              const isSelected = selectedBin?.location === binCode;
                              const shortCode = binCode.split('-').slice(-1)[0];
                              return (
                                <button
                                  key={binCode}
                                  onClick={() => handleBinClick(binCode, items)}
                                  title={`${binCode}\n${items.length} material(s) · Qty: ${totalQty}`}
                                  className={`w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center text-xs font-semibold transition-all cursor-pointer hover:scale-105 hover:shadow-md ${colors.bg} ${colors.border} ${colors.text} ${isSelected ? 'ring-2 ring-teal-500 ring-offset-1' : ''}`}
                                >
                                  <span className="text-[10px] font-mono leading-tight">{shortCode}</span>
                                  <span className="text-sm font-bold leading-tight">{totalQty}</span>
                                  <span className="text-[9px] opacity-70 leading-tight">{items.length} mat</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slide-out Bin Detail */}
      {selectedBin && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col overflow-hidden transition-transform">
          <div className="px-5 py-4 border-b border-slate-100 bg-teal-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono opacity-75">{selectedBin.location}</p>
                <h3 className="font-bold text-lg mt-0.5">{selectedBin.items.length} Material{selectedBin.items.length !== 1 ? 's' : ''}</h3>
              </div>
              <button
                onClick={() => setSelectedBin(null)}
                className="p-1.5 hover:bg-teal-700 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {selectedBin.items.map((item, i) => {
              const colors = getBinColor(item.quantity_on_hand);
              return (
                <div key={i} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-teal-600">{item.materials?.cnmc || '—'}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5 leading-snug">
                        {item.materials?.standard_description || item.material_id}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{item.materials?.category}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-bold ${colors.text}`}>{item.quantity_on_hand}</p>
                      <p className="text-xs text-slate-400">{item.materials?.uom || 'EA'}</p>
                      <span className={`text-xs font-medium ${colors.text}`}>{colors.label}</span>
                    </div>
                  </div>
                  {item.last_receipt_date && (
                    <p className="text-xs text-slate-400 mt-2">
                      Last received: {new Date(item.last_receipt_date).toLocaleDateString('en-IN')}
                    </p>
                  )}
                  {item.quantity_reserved > 0 && (
                    <p className="text-xs text-amber-600 mt-1">Reserved: {item.quantity_reserved}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
