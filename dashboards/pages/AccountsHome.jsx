import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, IndianRupee, TrendingDown, Users, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { getInventoryValuation, getSpendThisMonth, getSavingsOpportunities, formatINR } from '../utils/accountsUtils';
import { vendors, purchases } from '../data/mockAccountsData';

const StatCard = ({ title, value, icon: Icon, description }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div className="text-2xl font-bold text-slate-800">{value}</div>
    {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
  </div>
);

export default function AccountsHome() {
  const navigate = useNavigate();
  
  const totalInventoryValuation = getInventoryValuation();
  const spendThisMonth = getSpendThisMonth();
  const opportunities = getSavingsOpportunities();
  
  const bestOpportunity = opportunities.length > 0 ? opportunities[0] : null;
  const activeVendors = new Set(purchases.map(p => p.vendorId)).size;

  // Monthly Spend Trend data
  const spendDataMap = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    spendDataMap[d.toLocaleString('default', { month: 'short' })] = 0;
  }
  
  purchases.forEach(p => {
    const d = new Date(p.date);
    if (d > new Date(now.getFullYear(), now.getMonth() - 5, 1)) {
      const month = d.toLocaleString('default', { month: 'short' });
      if (spendDataMap[month] !== undefined) {
        spendDataMap[month] += p.totalValue;
      }
    }
  });

  const chartData = Object.entries(spendDataMap).map(([month, spend]) => ({
    name: month,
    spend
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Inventory Value"
          value={formatINR(totalInventoryValuation)}
          icon={Package}
          description="Based on avg unit price"
        />
        <StatCard
          title="Spend This Month"
          value={formatINR(spendThisMonth)}
          icon={IndianRupee}
          description="Current calendar month"
        />
        <StatCard
          title="Best Savings Opportunity"
          value={bestOpportunity ? formatINR(bestOpportunity.estAnnualSaving) : '₹0'}
          icon={TrendingDown}
          description={bestOpportunity ? bestOpportunity.materialName : 'No opportunities'}
        />
        <StatCard
          title="Active Vendors"
          value={activeVendors}
          icon={Users}
          description="With recent purchases"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Spend Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-1 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Monthly Spend Trend</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`}
                />
                <RechartsTooltip 
                  formatter={(value) => formatINR(value)}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="spend" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Savings Opportunities */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-0 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Potential Savings Opportunities</h3>
              <p className="text-sm text-slate-500">Top materials with better vendor alternatives</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Material</th>
                  <th className="px-6 py-4">Current Vendor & Price</th>
                  <th className="px-6 py-4">Better Vendor & Price</th>
                  <th className="px-6 py-4 text-right">Est. Savings</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {opportunities.slice(0, 5).map((opp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{opp.materialName}</td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800">{opp.currentVendorName}</div>
                      <div className="text-slate-500">{formatINR(opp.currentPrice)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-emerald-600 font-medium">{opp.bestVendorName}</div>
                      <div className="text-slate-500">{formatINR(opp.bestPrice)}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-emerald-600">{formatINR(opp.estAnnualSaving)}</div>
                      <div className="text-xs text-slate-400">{formatINR(opp.savingsPerUnit)} / unit</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => navigate('/accounts/price-intelligence')}
                        className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center text-sm"
                      >
                        Details <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </td>
                  </tr>
                ))}
                {opportunities.length === 0 && (
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
    </div>
  );
}
