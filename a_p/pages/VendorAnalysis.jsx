import React, { useState, useMemo } from 'react';
import { ShieldCheck, Truck, TrendingUp, Search } from 'lucide-react';
import { vendors, materials, purchases } from '../data/mockAccountsData';
import { formatINR } from '../utils/accountsUtils';

export default function VendorAnalysis() {
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate deep vendor stats from purchases
  const vendorStats = useMemo(() => {
    return vendors.map(v => {
      const vPurchases = purchases.filter(p => p.vendorId === v.id);
      
      const materialsSupplied = new Set(vPurchases.map(p => p.materialId)).size;
      const totalVolume = vPurchases.reduce((sum, p) => sum + p.totalValue, 0);
      const qualityA = vPurchases.filter(p => p.quality === 'A').length;
      const calcQualityPercent = vPurchases.length ? Math.round((qualityA / vPurchases.length) * 100) : 0;
      
      // Price score: 100 - (how often they were more expensive than avg)
      // Since mock data is random, we'll just use a derived mock for price score or their base score
      const priceScore = v.score; 

      return {
        ...v,
        materialsSupplied,
        totalVolume,
        qualityPercent: calcQualityPercent > 0 ? calcQualityPercent : v.qualityPercent,
        priceScore,
        overallScore: Math.round((v.deliveryReliability + (calcQualityPercent || v.qualityPercent) + priceScore) / 3)
      };
    }).sort((a, b) => b.overallScore - a.overallScore);
  }, []);

  const vendorMatrix = useMemo(() => {
    // Generate a mapping of Vendor -> Materials they supplied
    const matrix = vendors.map(v => {
      const vPurchases = purchases.filter(p => p.vendorId === v.id);
      const suppliedMaterialIds = Array.from(new Set(vPurchases.map(p => p.materialId)));
      
      const materialDetails = suppliedMaterialIds.map(mid => {
        const mat = materials.find(m => m.id === mid);
        const pList = vPurchases.filter(p => p.materialId === mid);
        const avgP = pList.reduce((s, p) => s + p.unitPrice, 0) / pList.length;
        return { ...mat, avgPrice: avgP, purchaseCount: pList.length };
      });

      return {
        ...v,
        materials: materialDetails
      };
    });

    if (!searchTerm) return matrix;
    const lower = searchTerm.toLowerCase();
    
    return matrix.map(v => ({
      ...v,
      materials: v.materials.filter(m => m.name.toLowerCase().includes(lower) || m.cnmc.toLowerCase().includes(lower))
    })).filter(v => v.name.toLowerCase().includes(lower) || v.materials.length > 0);
  }, [searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* Vendor Scorecards */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4">Top Vendor Scorecards</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {vendorStats.slice(0, 3).map((v, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{v.name}</h4>
                  <div className="text-sm text-slate-500">{v.code}</div>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  v.overallScore >= 90 ? 'bg-emerald-100 text-emerald-700' :
                  v.overallScore >= 80 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {v.overallScore}
                </div>
              </div>
              <div className="p-5 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Quality (A%)</div>
                    <div className="font-semibold text-slate-800">{v.qualityPercent}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Delivery</div>
                    <div className="font-semibold text-slate-800">{v.deliveryReliability}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Price Score</div>
                    <div className="font-semibold text-slate-800">{v.priceScore}/100</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Total Volume</div>
                    <div className="font-semibold text-slate-800">{formatINR(v.totalVolume)}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vendor to Material Matrix */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Vendor & Material Matrix</h3>
            <p className="text-sm text-slate-500">Explore materials supplied by each vendor</p>
          </div>
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search vendor or material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>
        
        <div className="p-0">
          {vendorMatrix.map(v => (
            <div key={v.id} className="border-b border-slate-100 last:border-0">
              <div className="px-6 py-3 bg-slate-50 font-semibold text-slate-800 flex justify-between">
                <span>{v.name} <span className="text-slate-400 font-normal ml-2">{v.code}</span></span>
                <span className="text-sm font-normal text-slate-500">{v.materials.length} Materials</span>
              </div>
              {v.materials.length > 0 ? (
                <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {v.materials.map(m => (
                    <div key={m.id} className="border border-slate-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                      <div className="font-medium text-slate-800 text-sm mb-1">{m.name}</div>
                      <div className="text-xs text-slate-500 mb-2">{m.cnmc} • {m.category}</div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">Avg: {formatINR(m.avgPrice)}</span>
                        <span className="text-blue-600 font-medium">{m.purchaseCount} POs</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-4 text-sm text-slate-500 italic">
                  No materials match the search for this vendor.
                </div>
              )}
            </div>
          ))}
          {vendorMatrix.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No vendors or materials found matching "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
