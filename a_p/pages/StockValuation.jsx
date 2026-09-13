import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Package, AlertTriangle, Clock } from 'lucide-react';
import { materials, purchases } from '../data/mockAccountsData';
import { formatINR, getInventoryValuation } from '../utils/accountsUtils';

export default function StockValuation() {
  const inventoryByCategory = useMemo(() => {
    const categoryMap = {};
    const totalValuation = getInventoryValuation();

    materials.forEach(mat => {
      if (!categoryMap[mat.category]) {
        categoryMap[mat.category] = { category: mat.category, count: 0, value: 0 };
      }
      
      const matPurchases = purchases.filter(p => p.materialId === mat.id);
      const avgPrice = matPurchases.length ? matPurchases.reduce((sum, p) => sum + p.unitPrice, 0) / matPurchases.length : 0;
      
      categoryMap[mat.category].count += 1;
      categoryMap[mat.category].value += mat.currentStock * avgPrice;
    });

    return Object.values(categoryMap).map(c => ({
      ...c,
      percentage: totalValuation > 0 ? (c.value / totalValuation) * 100 : 0
    })).sort((a, b) => b.value - a.value);
  }, []);

  const agingInventory = useMemo(() => {
    const now = new Date();
    return materials.map(mat => {
      const daysSinceMovement = Math.floor((now - new Date(mat.lastMovement)) / (1000 * 60 * 60 * 24));
      
      const matPurchases = purchases.filter(p => p.materialId === mat.id);
      const avgPrice = matPurchases.length ? matPurchases.reduce((sum, p) => sum + p.unitPrice, 0) / matPurchases.length : 0;
      const value = mat.currentStock * avgPrice;
      
      let status = '';
      if (daysSinceMovement >= 365) status = '365+ Days';
      else if (daysSinceMovement >= 180) status = '180+ Days';
      else if (daysSinceMovement >= 90) status = '90+ Days';
      
      return { ...mat, daysSinceMovement, value, status };
    }).filter(mat => mat.status).sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);
  }, []);

  const overstockAlerts = useMemo(() => {
    return materials.map(mat => {
      const matPurchases = purchases.filter(p => p.materialId === mat.id);
      const avgPrice = matPurchases.length ? matPurchases.reduce((sum, p) => sum + p.unitPrice, 0) / matPurchases.length : 0;
      const value = mat.currentStock * avgPrice;
      const stockPercent = (mat.currentStock / mat.maxStock) * 100;
      const excess = mat.currentStock - mat.maxStock;
      
      return { ...mat, stockPercent, excess, value, location: 'Primary Warehouse' }; // Mock location
    }).filter(mat => mat.stockPercent > 150).sort((a, b) => b.stockPercent - a.stockPercent);
  }, []);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" /> Inventory Value by Category
          </h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={inventoryByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="category"
                >
                  {inventoryByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => formatINR(value)} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Category Breakdown</h3>
            <span className="text-sm text-slate-500 font-medium">Total: {formatINR(getInventoryValuation())}</span>
          </div>
          <div className="overflow-x-auto h-full">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-center">Items</th>
                  <th className="px-6 py-4 text-right">Value</th>
                  <th className="px-6 py-4 text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryByCategory.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      {cat.category}
                    </td>
                    <td className="px-6 py-4 text-center">{cat.count}</td>
                    <td className="px-6 py-4 text-right font-medium">{formatINR(cat.value)}</td>
                    <td className="px-6 py-4 text-right">{cat.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Overstock Alerts */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-red-50/50 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-bold text-red-900">Overstock Alerts (&gt;150% Max Stock)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Material</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4 text-right">Current Stock</th>
                <th className="px-6 py-4 text-right">Max Stock</th>
                <th className="px-6 py-4 text-right">Excess Qty</th>
                <th className="px-6 py-4 text-right">Value of Excess</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overstockAlerts.map((mat, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{mat.name}</div>
                    <div className="text-xs text-slate-500">{mat.cnmc}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{mat.location}</td>
                  <td className="px-6 py-4 text-right text-red-600 font-bold">{mat.currentStock} <span className="text-xs font-normal">({mat.stockPercent.toFixed(0)}%)</span></td>
                  <td className="px-6 py-4 text-right text-slate-600">{mat.maxStock}</td>
                  <td className="px-6 py-4 text-right text-slate-800 font-medium">{mat.excess}</td>
                  <td className="px-6 py-4 text-right font-medium">{formatINR((mat.value / mat.currentStock) * mat.excess)}</td>
                </tr>
              ))}
              {overstockAlerts.length === 0 && (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No overstock items detected.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aging Inventory */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-amber-50/50 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          <h3 className="text-lg font-bold text-amber-900">Aging Inventory (No Movement &gt; 90 Days)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Material</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Quantity</th>
                <th className="px-6 py-4 text-right">Inventory Value</th>
                <th className="px-6 py-4">Last Movement</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agingInventory.map((mat, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{mat.name}</div>
                    <div className="text-xs text-slate-500">{mat.cnmc}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{mat.category}</td>
                  <td className="px-6 py-4 text-right">{mat.currentStock}</td>
                  <td className="px-6 py-4 text-right font-medium">{formatINR(mat.value)}</td>
                  <td className="px-6 py-4">
                    <div className="text-slate-800">{new Date(mat.lastMovement).toLocaleDateString()}</div>
                    <div className="text-xs text-slate-500">{mat.daysSinceMovement} days ago</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      mat.status === '365+ Days' ? 'bg-red-100 text-red-800' :
                      mat.status === '180+ Days' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {mat.status}
                    </span>
                  </td>
                </tr>
              ))}
              {agingInventory.length === 0 && (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No aging inventory detected.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
