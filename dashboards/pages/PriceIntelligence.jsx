import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { CheckCircle, AlertTriangle, Info, TrendingDown, Calculator } from 'lucide-react';
import { materials, purchases } from '../data/mockAccountsData';
import { getMaterialVendorStats, formatINR, getSavingsOpportunities } from '../utils/accountsUtils';

export default function PriceIntelligence() {
  const [selectedMaterialId, setSelectedMaterialId] = useState(materials[0].id);

  const selectedMaterial = useMemo(() => materials.find(m => m.id === selectedMaterialId), [selectedMaterialId]);
  
  const vendorStats = useMemo(() => {
    if (!selectedMaterialId) return [];
    const stats = getMaterialVendorStats(selectedMaterialId);
    
    // Sort logic to find recommended: Highest quality, then lowest price
    const recommended = [...stats].sort((a, b) => {
      if (b.qualityPercent !== a.qualityPercent) {
        return b.qualityPercent - a.qualityPercent;
      }
      return a.avgPrice - b.avgPrice;
    })[0];
    
    return stats.map(s => ({
      ...s,
      isRecommended: recommended && s.vendorId === recommended.vendorId
    })).sort((a, b) => a.avgPrice - b.avgPrice);
  }, [selectedMaterialId]);

  const priceTrendData = useMemo(() => {
    if (!selectedMaterialId) return [];
    
    const matPurchases = purchases.filter(p => p.materialId === selectedMaterialId);
    
    const monthMap = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthMap[key] = { name: key };
    }

    matPurchases.forEach(p => {
      const d = new Date(p.date);
      if (d > new Date(now.getFullYear(), now.getMonth() - 11, 1)) {
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (monthMap[key]) {
          if (!monthMap[key][p.vendorName]) {
            monthMap[key][p.vendorName] = [];
          }
          monthMap[key][p.vendorName].push(p.unitPrice);
        }
      }
    });
    
    // Average prices if multiple per month
    return Object.values(monthMap).map(m => {
      const result = { name: m.name };
      Object.keys(m).forEach(k => {
        if (k !== 'name') {
          result[k] = m[k].reduce((a, b) => a + b, 0) / m[k].length;
        }
      });
      return result;
    });
  }, [selectedMaterialId]);

  const savingsOpportunities = useMemo(() => getSavingsOpportunities(), []);
  
  // Find savings calculator data for selected material
  const currentMaterialSavings = useMemo(() => {
    return savingsOpportunities.find(o => o.materialId === selectedMaterialId);
  }, [selectedMaterialId, savingsOpportunities]);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const vendorsInChart = useMemo(() => {
    const vSet = new Set();
    priceTrendData.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== 'name') vSet.add(k);
      });
    });
    return Array.from(vSet);
  }, [priceTrendData]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Selection */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1 max-w-xl">
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Material for Analysis</label>
            <select 
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
            >
              {materials.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.cnmc}) - {m.category}</option>
              ))}
            </select>
          </div>
          {selectedMaterial && (
            <div className="flex gap-8 text-sm">
              <div>
                <span className="block text-slate-500 mb-1">CNMC</span>
                <span className="font-semibold text-slate-800">{selectedMaterial.cnmc}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Category</span>
                <span className="font-semibold text-slate-800">{selectedMaterial.category}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">UoM</span>
                <span className="font-semibold text-slate-800">{selectedMaterial.uom}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vendor Comparison */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Vendor Comparison</h3>
          <p className="text-sm text-slate-500">Historical performance and pricing for {selectedMaterial?.name}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4 text-right">Avg Price</th>
                <th className="px-6 py-4 text-right">Last Price</th>
                <th className="px-6 py-4 text-right">Min Price</th>
                <th className="px-6 py-4 text-right">Purchases</th>
                <th className="px-6 py-4 text-center">Quality (A%)</th>
                <th className="px-6 py-4 text-center">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorStats.map((v, idx) => (
                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${v.isRecommended ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-6 py-4 font-medium text-slate-800">{v.vendorName}</td>
                  <td className="px-6 py-4 text-right">{formatINR(v.avgPrice)}</td>
                  <td className="px-6 py-4 text-right">{formatINR(v.lastPrice)}</td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-medium">{formatINR(v.minPrice)}</td>
                  <td className="px-6 py-4 text-right">{v.purchases}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      v.qualityPercent >= 90 ? 'bg-emerald-100 text-emerald-800' : 
                      v.qualityPercent >= 75 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {v.qualityPercent}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {v.isRecommended && (
                      <span className="inline-flex items-center text-blue-700 bg-blue-100 px-3 py-1 rounded-full text-xs font-semibold">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Recommended
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {vendorStats.length === 0 && (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">No purchase history found for this material.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price Trend Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Price Trend (12 Months)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `₹${value}`}
                />
                <RechartsTooltip formatter={(value) => formatINR(value)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                {vendorsInChart.map((v, i) => (
                  <Line key={v} type="monotone" dataKey={v} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Savings Calculator */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-800">Savings Calculator</h3>
          </div>
          
          {currentMaterialSavings ? (
            <div className="space-y-6">
              <div>
                <div className="text-sm text-slate-500 mb-1">Current/Reference Price</div>
                <div className="text-lg font-medium text-slate-800">{formatINR(currentMaterialSavings.currentPrice)} <span className="text-sm font-normal text-slate-500">via {currentMaterialSavings.currentVendorName}</span></div>
              </div>
              
              <div>
                <div className="text-sm text-slate-500 mb-1">Recommended Price</div>
                <div className="text-lg font-medium text-emerald-600">{formatINR(currentMaterialSavings.bestPrice)} <span className="text-sm font-normal text-slate-500">via {currentMaterialSavings.bestVendorName}</span></div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="text-sm font-medium text-slate-800 mb-1">Estimated Annual Savings</div>
                <div className="text-3xl font-bold text-emerald-600 mb-1">{formatINR(currentMaterialSavings.estAnnualSaving)}</div>
                <div className="text-sm text-slate-500 flex items-center gap-1">
                  <Info className="w-4 h-4" /> Based on historical volume
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-3 pb-8">
              <AlertTriangle className="w-10 h-10 text-slate-300" />
              <p>No significant savings opportunities identified for this material based on current data.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Savings Opportunities */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-800">All Bulk Savings Opportunities</h3>
            <p className="text-sm text-slate-500">Materials with cheaper vetted alternatives</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Material</th>
                <th className="px-6 py-4">Current Vendor</th>
                <th className="px-6 py-4">Best Vendor</th>
                <th className="px-6 py-4 text-right">Savings / Unit</th>
                <th className="px-6 py-4 text-right">Est. Annual Saving</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {savingsOpportunities.map((opp, idx) => (
                <tr 
                  key={idx} 
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedMaterialId(opp.materialId)}
                >
                  <td className="px-6 py-4 font-medium text-blue-600">{opp.materialName}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {opp.currentVendorName} <span className="text-slate-400">({formatINR(opp.currentPrice)})</span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {opp.bestVendorName} <span className="text-emerald-600">({formatINR(opp.bestPrice)})</span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">{formatINR(opp.savingsPerUnit)}</td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatINR(opp.estAnnualSaving)}</td>
                </tr>
              ))}
              {savingsOpportunities.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    No savings opportunities found at this time.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
