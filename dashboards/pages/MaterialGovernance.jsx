import React, { useState, useEffect, useCallback } from 'react';
import { Search, CheckCircle, XCircle, AlertCircle, ChevronDown, Edit3, X, Check } from 'lucide-react';
import api from '../../frontend/src/lib/api';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'deprecated'];

const StatusBadge = ({ status }) => {
  const styles = {
    approved: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    deprecated: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
};

export default function MaterialGovernance() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [editRow, setEditRow] = useState(null); // { id, field, value }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/materials', {
        params: {
          status_filter: filter !== 'all' ? filter : undefined,
          search: search.trim() || undefined,
          limit: 100,
        },
      });
      setMaterials(data || []);
    } catch (err) {
      console.error('Error fetching materials:', err);
      showToast(err.response?.data?.detail || 'Could not load materials', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(fetchMaterials, 300);
    return () => clearTimeout(t);
  }, [fetchMaterials]);

  const updateStatus = async (ids, newStatus) => {
    setActionLoading(true);
    try {
      const action = newStatus === 'approved' ? 'approve' : 'deprecate';
      const { data } = await api.patch('/materials', { ids, action });
      showToast(`${data.updated} material(s) marked as ${newStatus}`
        + (data.not_found.length ? ` (${data.not_found.length} not found)` : ''));
      setSelected(new Set());
      fetchMaterials();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update those materials', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setActionLoading(true);
    try {
      await api.patch(`/materials/${editRow.id}`, { [editRow.field]: editRow.value });
      showToast('Material updated successfully');
      setEditRow(null);
      fetchMaterials();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not save that edit', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === materials.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(materials.map(m => m.id)));
    }
  };

  return (
    <div className="space-y-5 relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all duration-300 ${
          toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search CNMC or description..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-indigo-700">{selected.size} selected</span>
          <button
            onClick={() => updateStatus([...selected], 'approved')}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Approve All
          </button>
          <button
            onClick={() => updateStatus([...selected], 'deprecated')}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-500 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" /> Deprecate All
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === materials.length && materials.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded text-indigo-600"
                  />
                </th>
                <th className="px-4 py-3">CNMC</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">UOM</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No materials match your filter
                  </td>
                </tr>
              ) : materials.map((m) => (
                <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${selected.has(m.id) ? 'bg-indigo-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                      className="rounded text-indigo-600"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.cnmc || '—'}</td>
                  <td className="px-4 py-3 max-w-xs">
                    {editRow?.id === m.id && editRow.field === 'standard_description' ? (
                      <div className="flex gap-1 items-center">
                        <input
                          autoFocus
                          value={editRow.value}
                          onChange={e => setEditRow(r => ({ ...r, value: e.target.value }))}
                          className="border border-indigo-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-800"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditRow(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <span className="font-medium text-slate-800 truncate block max-w-[260px]" title={m.standard_description}>
                        {m.standard_description}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{m.category || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{m.material_type || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{m.unit_of_measure || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        title="Edit description"
                        onClick={() => setEditRow({ id: m.id, field: 'standard_description', value: m.standard_description })}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {m.status !== 'approved' && (
                        <button
                          title="Approve"
                          onClick={() => updateStatus([m.id], 'approved')}
                          className="text-slate-400 hover:text-emerald-600 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {m.status !== 'deprecated' && (
                        <button
                          title="Deprecate"
                          onClick={() => updateStatus([m.id], 'deprecated')}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
          Showing {materials.length} materials {filter !== 'all' ? `(${filter})` : ''}
        </div>
      </div>
    </div>
  );
}
