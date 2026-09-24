import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, X } from 'lucide-react';
import { purchases, vendors, materials, categories } from '../data/mockAccountsData';
import { formatINR } from '../utils/accountsUtils';

export default function PurchaseHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    vendorId: '',
    materialId: '',
    category: '',
    quality: '',
    dateFrom: '',
    dateTo: ''
  });

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // Search term (GR Number, Material Name, Vendor Name)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!p.id.toLowerCase().includes(term) && 
            !p.materialName.toLowerCase().includes(term) && 
            !p.vendorName.toLowerCase().includes(term)) {
          return false;
        }
      }

      if (filters.vendorId && p.vendorId !== filters.vendorId) return false;
      if (filters.materialId && p.materialId !== filters.materialId) return false;
      if (filters.category && p.category !== filters.category) return false;
      if (filters.quality && p.quality !== filters.quality) return false;
      
      if (filters.dateFrom && new Date(p.date) < new Date(filters.dateFrom)) return false;
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(p.date) > toDate) return false;
      }

      return true;
    });
  }, [searchTerm, filters]);

  const handleExportCSV = () => {
    if (filteredPurchases.length === 0) return;

    // Define headers
    const headers = [
      'GR Number', 'Date', 'Vendor Name', 'Material Name', 'CNMC', 
      'Category', 'Quantity', 'UoM', 'Unit Price (INR)', 'Total Value (INR)', 'Quality', 'Location'
    ];

    // Create CSV rows
    const rows = filteredPurchases.map(p => [
      p.id,
      new Date(p.date).toLocaleDateString(),
      `"${p.vendorName}"`,
      `"${p.materialName}"`,
      p.cnmc,
      p.category,
      p.quantity,
      p.uom,
      p.unitPrice,
      p.totalValue,
      p.quality,
      `"${p.location}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `purchase_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ vendorId: '', materialId: '', category: '', quality: '', dateFrom: '', dateTo: '' });
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length + (searchTerm ? 1 : 0);

  return (
    <div className="space-y-6 pb-12 flex flex-col h-[calc(100vh-100px)]">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 shrink-0">
        <div className="flex flex-col xl:flex-row justify-between gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search GR Number, Material, or Vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={clearFilters}
              disabled={activeFilterCount === 0}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center"
            >
              <X className="w-4 h-4 mr-1.5" /> Clear Filters
            </button>
            <button 
              onClick={handleExportCSV}
              disabled={filteredPurchases.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <select 
            value={filters.vendorId} 
            onChange={(e) => setFilters({...filters, vendorId: e.target.value})}
            className="w-full text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>

          <select 
            value={filters.materialId} 
            onChange={(e) => setFilters({...filters, materialId: e.target.value})}
            className="w-full text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Materials</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <select 
            value={filters.category} 
            onChange={(e) => setFilters({...filters, category: e.target.value})}
            className="w-full text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            value={filters.quality} 
            onChange={(e) => setFilters({...filters, quality: e.target.value})}
            className="w-full text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Quality</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
          </select>

          <input 
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
            className="w-full text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-slate-500"
            placeholder="From Date"
          />

          <input 
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
            className="w-full text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-slate-500"
            placeholder="To Date"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-[400px]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="text-sm font-medium text-slate-600 flex items-center">
            <Filter className="w-4 h-4 mr-2" /> Showing {filteredPurchases.length} records
          </div>
        </div>
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-600 font-medium border-b border-slate-200 sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">GR Number</th>
                <th className="px-6 py-4 whitespace-nowrap">Date</th>
                <th className="px-6 py-4">Material</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4 text-right">Qty</th>
                <th className="px-6 py-4 text-right">Unit Price</th>
                <th className="px-6 py-4 text-right">Total Value</th>
                <th className="px-6 py-4 text-center">QA</th>
                <th className="px-6 py-4">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800 whitespace-nowrap">{p.id}</td>
                  <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="px-6 py-3">
                    <div className="font-medium text-slate-800">{p.materialName}</div>
                    <div className="text-xs text-slate-500">{p.cnmc}</div>
                  </td>
                  <td className="px-6 py-3 text-slate-700">{p.vendorName}</td>
                  <td className="px-6 py-3 text-right">
                    {p.quantity} <span className="text-xs text-slate-400">{p.uom}</span>
                  </td>
                  <td className="px-6 py-3 text-right text-slate-600">{formatINR(p.unitPrice)}</td>
                  <td className="px-6 py-3 text-right font-medium text-slate-800">{formatINR(p.totalValue)}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                      p.quality === 'A' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {p.quality}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs">{p.location}</td>
                </tr>
              ))}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                    No purchase records match the current filters.
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
