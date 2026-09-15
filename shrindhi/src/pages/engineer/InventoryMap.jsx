import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Box, 
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { mockWarehouses } from '../../data/locations';
import { mockInventory, getStockStatus } from '../../data/inventory';
import { mockMaterials } from '../../data/materials';
import { CNMCBadge } from '../../components/materials/CNMCBadge';
import { StockBadge } from '../../components/materials/StockBadge';

export function InventoryMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlWhse = searchParams.get('whse') || 'WHSE-A';
  const urlLoc = searchParams.get('loc') || '';

  const [selectedWarehouseCode, setSelectedWarehouseCode] = useState(urlWhse);
  const [selectedLocationCode, setSelectedLocationCode] = useState(urlLoc);

  const currentWarehouse = useMemo(() => {
    return mockWarehouses.find((w) => w.code === selectedWarehouseCode) || mockWarehouses[0];
  }, [selectedWarehouseCode]);

  useEffect(() => {
    if (urlLoc) {
      const parts = urlLoc.split('-');
      if (parts.length >= 4) {
        const whse = `${parts[0]}-${parts[1]}`;
        setSelectedWarehouseCode(whse);
        setSelectedLocationCode(urlLoc);
      }
    }
  }, [urlLoc]);

  // Selected bin detail object
  const selectedBinDetail = useMemo(() => {
    if (!selectedLocationCode) {
      // Default to first occupied bin in this warehouse
      const firstFound = mockInventory.find((inv) => inv.warehouse === selectedWarehouseCode);
      if (firstFound) {
        const mat = mockMaterials.find((m) => m.id === firstFound.material_id);
        return {
          locationCode: firstFound.location_code,
          warehouse: firstFound.warehouse,
          aisle: firstFound.aisle,
          rack: firstFound.rack,
          bin: firstFound.bin,
          quantity: firstFound.quantity,
          reservedQuantity: firstFound.reserved_quantity,
          availableQuantity: firstFound.quantity - firstFound.reserved_quantity,
          reorderLevel: firstFound.reorder_level,
          maxStock: firstFound.max_stock,
          status: getStockStatus(firstFound.quantity, firstFound.reorder_level),
          material: mat,
        };
      }
      return null;
    }

    const inv = mockInventory.find((i) => i.location_code === selectedLocationCode);
    if (inv) {
      const mat = mockMaterials.find((m) => m.id === inv.material_id);
      return {
        locationCode: inv.location_code,
        warehouse: inv.warehouse,
        aisle: inv.aisle,
        rack: inv.rack,
        bin: inv.bin,
        quantity: inv.quantity,
        reservedQuantity: inv.reserved_quantity,
        availableQuantity: inv.quantity - inv.reserved_quantity,
        reorderLevel: inv.reorder_level,
        maxStock: inv.max_stock,
        status: getStockStatus(inv.quantity, inv.reorder_level),
        material: mat,
      };
    }

    // Empty bin placeholder
    const parts = selectedLocationCode.split('-');
    return {
      locationCode: selectedLocationCode,
      warehouse: parts.slice(0, 2).join('-'),
      aisle: parts[2] || 'A1',
      rack: parts[3] || 'R1',
      bin: parts[4] || 'B1',
      quantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
      reorderLevel: 0,
      maxStock: 500,
      status: 'empty',
      material: null,
    };
  }, [selectedLocationCode, selectedWarehouseCode]);

  const legendItems = [
    { label: 'Well Stocked', color: 'bg-emerald-500', border: 'border-emerald-200 bg-emerald-50' },
    { label: 'Low Stock', color: 'bg-amber-500', border: 'border-amber-200 bg-amber-50' },
    { label: 'Critical Alert', color: 'bg-rose-500', border: 'border-rose-200 bg-rose-50' },
    { label: 'Empty Bin', color: 'bg-slate-300', border: 'border-slate-200 bg-slate-50' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Page Header with Status & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Spatial Inventory Map
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 font-mono">
              <MapPin className="w-3 h-3 text-blue-600" />
              Live Store Layout
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time physical bin coordinates, occupancy, and material stock health.
          </p>
        </div>

        {/* Rich Interactive Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {legendItems.map((item) => (
            <div 
              key={item.label} 
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium text-slate-700 text-[11px] ${item.border}`}
            >
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Warehouse Selector Tabs with Color Accents */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {mockWarehouses.map((wh, idx) => {
          const isSelected = selectedWarehouseCode === wh.code;
          const colors = [
            { active: 'bg-blue-700 text-white shadow-sm ring-2 ring-blue-700/20', tag: 'bg-blue-800 text-blue-100' },
            { active: 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-600/20', tag: 'bg-amber-700 text-amber-100' },
            { active: 'bg-purple-700 text-white shadow-sm ring-2 ring-purple-700/20', tag: 'bg-purple-800 text-purple-100' },
          ];
          const color = colors[idx % 3];

          return (
            <button
              key={wh.code}
              type="button"
              onClick={() => {
                setSelectedWarehouseCode(wh.code);
                setSelectedLocationCode('');
                setSearchParams({ whse: wh.code });
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-2 shadow-2xs ${
                isSelected
                  ? color.active
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{wh.code}</span>
              <span>— {wh.name.split('—')[1] || wh.name}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                isSelected ? color.tag : 'bg-slate-100 text-slate-600'
              }`}>
                {wh.totalCapacityBins} bins
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Spatial Matrix on Left; Selected Location Panel on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 Cols): Clean All-Aisle Spatial Grid with Interactive Bin Buttons */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {currentWarehouse.name}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  Facility Code: {currentWarehouse.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                {currentWarehouse.description}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <span>Aisles: <strong>{currentWarehouse.aisles.length}</strong></span>
              <span>•</span>
              <span>Total Bins: <strong>{currentWarehouse.totalCapacityBins}</strong></span>
            </div>
          </div>

          {/* Aisles Stack */}
          <div className="space-y-6">
            {currentWarehouse.aisles.map((aisle) => (
              <div key={aisle.id} className="space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-900 font-mono flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-bold">
                      {aisle.id}
                    </span>
                    <span>{aisle.name}</span>
                    <span className="font-sans font-normal text-slate-500">({aisle.category})</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {aisle.racks.length} Racks • {aisle.racks.length * aisle.binsPerRack.length} Bins
                  </span>
                </div>

                {/* Horizontal Racks Row */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                  {aisle.racks.map((rack) => (
                    <div key={rack} className="p-2.5 bg-slate-50/90 rounded-lg border border-slate-200/90 space-y-2">
                      <div className="text-[10px] font-mono font-bold text-slate-600 text-center tracking-wider uppercase">
                        {rack}
                      </div>

                      {/* Bins inside this rack */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {aisle.binsPerRack.map((bin) => {
                          const code = `${selectedWarehouseCode}-${aisle.id}-${rack}-${bin}`;
                          const inv = mockInventory.find((i) => i.location_code === code);
                          const mat = inv ? mockMaterials.find((m) => m.id === inv.material_id) : null;
                          const status = inv ? getStockStatus(inv.quantity, inv.reorder_level) : 'empty';
                          const isSelected = selectedBinDetail?.locationCode === code;

                          let binBg = 'bg-white border-slate-200 hover:border-slate-300';
                          let dotColor = 'bg-slate-300';
                          let badgeTextColor = 'text-slate-500';

                          if (status === 'good') {
                            binBg = 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300';
                            dotColor = 'bg-emerald-500';
                            badgeTextColor = 'text-emerald-800 font-bold';
                          } else if (status === 'low') {
                            binBg = 'bg-amber-50/60 border-amber-200 hover:border-amber-300';
                            dotColor = 'bg-amber-500 animate-pulse';
                            badgeTextColor = 'text-amber-800 font-bold';
                          } else if (status === 'critical') {
                            binBg = 'bg-rose-50/60 border-rose-200 hover:border-rose-300';
                            dotColor = 'bg-rose-600 animate-ping';
                            badgeTextColor = 'text-rose-800 font-bold';
                          }

                          return (
                            <button
                              key={bin}
                              type="button"
                              onClick={() => setSelectedLocationCode(code)}
                              className={`p-1.5 rounded-md text-left transition-all duration-150 border relative ${
                                isSelected
                                  ? 'bg-blue-100 border-blue-600 ring-2 ring-blue-600/40 shadow-sm scale-105 z-10'
                                  : `${binBg} hover:scale-102 hover:shadow-2xs`
                              }`}
                              title={mat ? `${code}: ${mat.standard_description} (${inv.quantity - inv.reserved_quantity} available)` : `${code} (Empty)`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono font-bold text-slate-800">{bin}</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                              </div>
                              <div className={`text-[10px] font-mono text-right mt-0.5 ${badgeTextColor}`}>
                                {inv ? inv.quantity - inv.reserved_quantity : '—'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (1 Col): Selected Location Detail Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 sticky top-20">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Storage Bin Inspector
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Live telemetry</span>
            </div>
          </div>

          {selectedBinDetail ? (
            <div className="space-y-4 text-xs font-sans">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">
                  Location Coordinate
                </span>
                <span className="text-lg font-bold font-mono text-blue-950 mt-0.5 block tracking-tight">
                  {selectedBinDetail.locationCode}
                </span>
                <span className="text-xs text-slate-600 font-sans mt-0.5 block">
                  Store: <strong className="text-slate-800">{selectedBinDetail.warehouse}</strong> → Aisle {selectedBinDetail.aisle} → Rack {selectedBinDetail.rack} → Bin {selectedBinDetail.bin}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 pb-1 border-t border-b border-slate-100">
                <span className="text-slate-500 text-xs font-medium">Stock Health Status:</span>
                <StockBadge status={selectedBinDetail.status} />
              </div>

              {selectedBinDetail.material ? (
                <>
                  <div className="p-3.5 bg-blue-50/40 rounded-lg border border-blue-200/80 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-blue-700 font-bold block">
                      Stored Material Record
                    </span>
                    <div className="font-bold text-slate-900 text-xs leading-snug">
                      {selectedBinDetail.material.standard_description}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <CNMCBadge code={selectedBinDetail.material.cnmc} className="text-[10px]" />
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {selectedBinDetail.material.category}
                      </span>
                    </div>
                  </div>

                  {/* Stock Metrics & Visual Capacity Bar */}
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5 font-mono text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Total In Bin:</span>
                      <span className="text-slate-900 font-bold">
                        {selectedBinDetail.quantity} {selectedBinDetail.material.unit_of_measure}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Reserved / Locked:</span>
                      <span className="text-amber-700 font-bold">
                        {selectedBinDetail.reservedQuantity} {selectedBinDetail.material.unit_of_measure}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-900 pt-2 border-t border-slate-200">
                      <span className="font-bold">Available to Issue:</span>
                      <span className="font-bold text-base text-blue-700">
                        {selectedBinDetail.availableQuantity} {selectedBinDetail.material.unit_of_measure}
                      </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="pt-2 border-t border-slate-200 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>Reorder Level: {selectedBinDetail.reorderLevel}</span>
                        <span>Max Bin Cap: {selectedBinDetail.maxStock || 500}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((selectedBinDetail.quantity / (selectedBinDetail.maxStock || 500)) * 100)
                            )}%`,
                          }}
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/engineer/material/${selectedBinDetail.material.id}`)}
                    className="w-full py-2.5 px-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm hover:shadow active:scale-98"
                  >
                    <span>View Material Engineering Profile</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-center text-slate-500 space-y-2">
                  <Box className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">Storage Bin is Empty</p>
                  <p className="text-[11px] text-slate-400 font-mono">Capacity: 500 units available for intake</p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Select a location from the warehouse grid.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InventoryMap;
