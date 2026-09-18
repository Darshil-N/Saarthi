import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, ArrowRight, ShieldCheck, Filter, ChevronRight, Layers } from 'lucide-react';
import { mockMaterials } from '../../data/materials';
import { mockInventory } from '../../data/inventory';
import { CNMCBadge } from '../../components/materials/CNMCBadge';

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Categories', count: 12 },
  { id: 'MECH', label: 'Mechanical', color: 'border-blue-300 text-blue-700 bg-blue-50/80 active-bg-blue-600' },
  { id: 'ELEC', label: 'Electrical', color: 'border-amber-300 text-amber-800 bg-amber-50/80 active-bg-amber-600' },
  { id: 'CHEM', label: 'Chemical', color: 'border-purple-300 text-purple-700 bg-purple-50/80 active-bg-purple-600' },
  { id: 'CIVIL', label: 'Civil & Struct.', color: 'border-emerald-300 text-emerald-800 bg-emerald-50/80 active-bg-emerald-600' },
  { id: 'CONS', label: 'Consumables', color: 'border-teal-300 text-teal-800 bg-teal-50/80 active-bg-teal-600' },
];

export function MaterialCatalog() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSubcategory, setSelectedSubcategory] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  // Compute available stock and primary location for each material
  const materialsWithStock = useMemo(() => {
    return mockMaterials.map((mat) => {
      const invRecords = mockInventory.filter((inv) => inv.material_id === mat.id);
      const totalAvailable = invRecords.reduce(
        (sum, inv) => sum + (inv.quantity - inv.reserved_quantity),
        0
      );
      const primaryLoc = invRecords[0]?.location_code || 'Central Store';
      return {
        ...mat,
        availableStock: totalAvailable,
        primaryLocation: primaryLoc,
        locationCount: invRecords.length,
      };
    });
  }, []);

  const subcategoryOptions = useMemo(() => {
    const subcats = new Set();
    mockMaterials.forEach((m) => {
      if (selectedCategory === 'ALL' || m.category === selectedCategory) {
        subcats.add(m.subcategory);
      }
    });
    return ['ALL', ...Array.from(subcats).sort()];
  }, [selectedCategory]);

  const typeOptions = useMemo(() => {
    const types = new Set();
    mockMaterials.forEach((m) => {
      const matchCat = selectedCategory === 'ALL' || m.category === selectedCategory;
      const matchSub = selectedSubcategory === 'ALL' || m.subcategory === selectedSubcategory;
      if (matchCat && matchSub) {
        types.add(m.material_type);
      }
    });
    return ['ALL', ...Array.from(types).sort()];
  }, [selectedCategory, selectedSubcategory]);

  const filteredMaterials = useMemo(() => {
    return materialsWithStock.filter((m) => {
      const matchCat = selectedCategory === 'ALL' || m.category === selectedCategory;
      const matchSub = selectedSubcategory === 'ALL' || m.subcategory === selectedSubcategory;
      const matchType = selectedType === 'ALL' || m.material_type === selectedType;

      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        m.standard_description.toLowerCase().includes(q) ||
        m.short_description?.toLowerCase().includes(q) ||
        m.cnmc.toLowerCase().includes(q) ||
        m.spec?.toLowerCase().includes(q);

      return matchCat && matchSub && matchType && matchSearch;
    });
  }, [materialsWithStock, selectedCategory, selectedSubcategory, selectedType, searchTerm]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ALL');
    setSelectedSubcategory('ALL');
    setSelectedType('ALL');
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'MECH':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'ELEC':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'CHEM':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'CIVIL':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'CONS':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Master Material Catalog
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Saarthi Standardized
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Search and explore approved materials in the BharatOil national material master.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2.5 py-1 bg-white rounded-md border border-slate-200 text-slate-600 shadow-2xs">
            Showing <strong className="text-blue-700">{filteredMaterials.length}</strong> of {mockMaterials.length} items
          </span>
        </div>
      </div>

      {/* 2. Interactive Category Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {CATEGORY_TABS.map((tab) => {
          const isSelected = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedCategory(tab.id);
                setSelectedSubcategory('ALL');
                setSelectedType('ALL');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 shadow-2xs ${
                isSelected
                  ? 'bg-blue-700 text-white shadow-sm ring-2 ring-blue-700/20'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id !== 'ALL' && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.id}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Search & Fine Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by description, CNMC code, specification, or equipment type..."
            className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-lg py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 font-sans transition-all shadow-inner"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end pt-1">
          <div>
            <label className="block text-[11px] font-mono text-slate-500 mb-1">
              Category Scope
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedSubcategory('ALL');
                setSelectedType('ALL');
              }}
              className="w-full bg-white border border-slate-300 rounded-md py-2 px-2.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="MECH">MECH — Mechanical</option>
              <option value="ELEC">ELEC — Electrical</option>
              <option value="CHEM">CHEM — Chemical</option>
              <option value="CIVIL">CIVIL — Civil & Structural</option>
              <option value="CONS">CONS — Consumables</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-500 mb-1">
              Subcategory
            </label>
            <select
              value={selectedSubcategory}
              onChange={(e) => {
                setSelectedSubcategory(e.target.value);
                setSelectedType('ALL');
              }}
              className="w-full bg-white border border-slate-300 rounded-md py-2 px-2.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              {subcategoryOptions.map((sub) => (
                <option key={sub} value={sub}>
                  {sub === 'ALL' ? 'All Subcategories' : sub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-500 mb-1">
              Material Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md py-2 px-2.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type === 'ALL' ? 'All Types' : type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Master Data Table with Interactive Colors */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-mono text-slate-600">
                <th className="py-3 px-4 font-semibold">Standard CNMC</th>
                <th className="py-3 px-4 font-semibold">Material Description & Spec</th>
                <th className="py-3 px-3 font-semibold">Category</th>
                <th className="py-3 px-3 font-semibold">Subcategory</th>
                <th className="py-3 px-3 text-right font-semibold">Available Stock</th>
                <th className="py-3 px-3 font-semibold">Primary Store</th>
                <th className="py-3 px-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    No materials found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((mat) => {
                  const categoryBadge = getCategoryBadgeClass(mat.category);
                  const isLowStock = mat.availableStock < 50;

                  return (
                    <tr
                      key={mat.id}
                      onClick={() => navigate(`/engineer/material/${mat.id}`)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <CNMCBadge code={mat.cnmc} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                          {mat.standard_description}
                        </div>
                        <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                          Spec: <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">{mat.spec}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${categoryBadge}`}>
                          {mat.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 text-xs">
                        {mat.subcategory}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                          isLowStock
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {mat.availableStock.toLocaleString('en-IN')} {mat.unit_of_measure}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-slate-700">
                        <span className="font-medium">{mat.primaryLocation}</span>
                        {mat.locationCount > 1 && (
                          <span className="text-[10px] text-blue-700 ml-1 font-semibold">
                            (+{mat.locationCount - 1} bins)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-blue-700 group-hover:text-blue-900 font-semibold text-xs px-2.5 py-1 rounded bg-blue-50 group-hover:bg-blue-100 transition-colors"
                        >
                          <span>Profile</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MaterialCatalog;
