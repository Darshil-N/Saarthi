import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  Terminal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Zap,
  Filter
} from 'lucide-react';
import { executeMockQuery } from '../../services/mockQueryEngine';
import { mockQueries } from '../../data/queries';
import { CNMCBadge } from '../../components/materials/CNMCBadge';

export function NLQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQuery = searchParams.get('q') || 'Where are M8 stainless bolts?';
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [activeQueryData, setActiveQueryData] = useState(null);
  const [showSql, setShowSql] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Local query history
  const [historyList, setHistoryList] = useState(mockQueries);

  const runQuery = (text) => {
    if (!text || !text.trim()) return;
    setIsLoading(true);

    setTimeout(() => {
      const response = executeMockQuery(text);
      setActiveQueryData(response);
      setIsLoading(false);

      // Add to query history
      setHistoryList((prev) => {
        const filtered = prev.filter((h) => h.natural_language_query.toLowerCase() !== text.toLowerCase());
        const newItem = {
          id: `LOG-${Date.now()}`,
          natural_language_query: text,
          generated_sql: response.generatedSql,
          query_result_count: response.totalCount,
          execution_time_ms: response.executionTimeMs,
          was_successful: response.wasSuccessful,
          created_at: new Date().toISOString(),
          explanation: response.interpretation,
        };
        return [newItem, ...filtered].slice(0, 10);
      });
    }, 150);
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQueryInput(q);
      runQuery(q);
    } else {
      runQuery(initialQuery);
    }
  }, [searchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (queryInput.trim()) {
      setSearchParams({ q: queryInput.trim() });
      runQuery(queryInput.trim());
    }
  };

  const handleSelectExample = (ex) => {
    setQueryInput(ex);
    setSearchParams({ q: ex });
    runQuery(ex);
  };

  const handleCopySql = () => {
    if (!activeQueryData?.generatedSql) return;
    navigator.clipboard.writeText(activeQueryData.generatedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const exampleQueries = [
    { text: 'Where are M8 stainless bolts?', tag: 'MECH', color: 'border-blue-200 text-blue-800 bg-blue-50/80 hover:bg-blue-100' },
    { text: 'How many gate valves are in stock?', tag: 'VALVES', color: 'border-amber-200 text-amber-800 bg-amber-50/80 hover:bg-amber-100' },
    { text: 'Which location has the most pipe fittings?', tag: 'PIPES', color: 'border-indigo-200 text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100' },
    { text: 'Find turbine oil ISO VG 46', tag: 'LUBRICANTS', color: 'border-purple-200 text-purple-800 bg-purple-50/80 hover:bg-purple-100' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Find Material & Inventory
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 font-mono">
              <Zap className="w-3 h-3 text-blue-700" />
              NL Engine v2
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Natural language query engine across BharatOil material master & physical warehouse bins.
          </p>
        </div>
      </div>

      {/* 2. Main Search Console with Rich Interactive Colors */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Ask anything in plain English (e.g. 'Where are M8 stainless bolts?')..."
              className="w-full bg-slate-50 hover:bg-white border border-slate-300 focus:border-blue-600 focus:bg-white rounded-lg py-3 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 font-sans transition-all shadow-inner"
            />
            {queryInput && (
              <button
                type="button"
                onClick={() => setQueryInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Clear input"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow active:scale-98 shrink-0"
          >
            {isLoading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <>
                <span>Execute Query</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Suggested Queries with Category Badges */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Suggested queries:
          </span>
          {exampleQueries.map((ex, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectExample(ex.text)}
              className={`text-xs px-3 py-1 rounded-full border transition-all duration-150 flex items-center gap-1.5 shadow-2xs hover:scale-102 ${ex.color}`}
            >
              <span className="font-semibold text-[9px] uppercase font-mono">{ex.tag}:</span>
              <span>{ex.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Query Results + History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 Cols): Results & Query Details */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs font-mono text-blue-700 flex flex-col items-center justify-center gap-2 shadow-xs">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Parsing semantics & querying BharatOil stores database...</span>
            </div>
          )}

          {!isLoading && activeQueryData && (
            <>
              {/* Query Interpretation Banner with Petroleum Blue Accent */}
              <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white border border-blue-200 rounded-xl p-4 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                        Query Interpretation
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                          {activeQueryData.executionTimeMs}ms
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed font-medium">
                      {activeQueryData.interpretation}
                    </p>
                    <div className="text-[11px] font-mono text-slate-500 mt-1.5 flex items-center gap-3">
                      <span>• Matched: <strong className="text-slate-900">{activeQueryData.totalCount} location record(s)</strong></span>
                      <span>• Status: <span className="text-emerald-700 font-semibold">SUCCESS</span></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                      Query Results ({activeQueryData.totalCount})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Sorted by Available Qty DESC
                  </span>
                </div>

                {activeQueryData.results.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No materials matched your query. Try searching for "M8 bolts", "gate valves", or "pipe fittings".
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-mono text-slate-600">
                          <th className="py-3 px-4 font-semibold">Material</th>
                          <th className="py-3 px-3 font-semibold">CNMC Code</th>
                          <th className="py-3 px-3 font-semibold">Storage Location</th>
                          <th className="py-3 px-3 text-right font-semibold">Available</th>
                          <th className="py-3 px-4 text-right font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {activeQueryData.results.map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                            <td 
                              onClick={() => navigate(`/engineer/material/${row.material_id}`)}
                              className="py-3 px-4 font-semibold text-slate-900 hover:text-blue-700 cursor-pointer max-w-xs"
                            >
                              <div className="truncate">{row.material}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                ID: {row.material_id}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <CNMCBadge code={row.cnmc} />
                            </td>
                            <td className="py-3 px-3 font-mono text-xs text-slate-700">
                              <div className="font-semibold text-slate-900">{row.warehouse}</div>
                              <div className="text-[11px] text-slate-500">Aisle {row.aisle} • Rack {row.rack} • Bin {row.bin}</div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200/60">
                                {row.available_quantity} {row.unit}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/engineer/inventory-map?whse=${row.warehouse}&loc=${row.location_code}`
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-700 text-blue-700 hover:text-white rounded-md text-xs font-semibold transition-all shadow-2xs group-hover:shadow"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>Show on Map</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Collapsible Query Details / SQL Transparency with Copy Button */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => setShowSql(!showSql)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-600" />
                    <span>View Generated SQL & Query Plan</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-mono">
                      Transparency
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {showSql ? 'Hide query details' : 'Show query details'}
                    </span>
                    {showSql ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {showSql && (
                  <div className="p-4 bg-slate-900 text-slate-200 space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-amber-400 font-semibold text-[11px]">
                        -- Generated SQL Query Representation
                      </span>
                      <button
                        type="button"
                        onClick={handleCopySql}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded transition-colors"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy SQL</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="text-slate-300 overflow-x-auto whitespace-pre p-2 bg-slate-950/80 rounded border border-slate-800 leading-relaxed text-[11px]">
                      {activeQueryData.generatedSql}
                    </pre>

                    <div className="pt-2 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>Dialect: PostgreSQL 15 / Supabase pgvector compatible</span>
                      <span>Execution Engine: Saarthi Mock v1.0</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Column (1 Col): Interactive Query History */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Recent Queries
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {historyList.length} logs
            </span>
          </div>

          <div className="space-y-2">
            {historyList.slice(0, 7).map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectExample(item.natural_language_query)}
                className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/40 cursor-pointer transition-all duration-150 space-y-1.5 group shadow-2xs"
              >
                <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 line-clamp-2 transition-colors">
                  "{item.natural_language_query}"
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {item.query_result_count || 0} matches
                  </span>
                  <span className="text-slate-400">
                    {item.execution_time_ms ? `${item.execution_time_ms}ms` : 'fast'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('/engineer/queries')}
            className="w-full py-2 px-3 text-center text-xs text-blue-700 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
          >
            View Complete Query Log
          </button>
        </div>
      </div>
    </div>
  );
}

export default NLQuery;
