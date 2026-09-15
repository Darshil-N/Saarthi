import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Terminal, ArrowRight, Play, CheckCircle2, Copy, Check, Clock, Sparkles } from 'lucide-react';
import { mockQueries } from '../../data/queries';

export function MyQueries() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(mockQueries[0]);
  const [copiedSql, setCopiedSql] = useState(false);

  const filteredQueries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return mockQueries;
    return mockQueries.filter(
      (m) =>
        m.natural_language_query.toLowerCase().includes(q) ||
        m.explanation.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  const handleRerun = (queryText) => {
    navigate(`/engineer/find-material?q=${encodeURIComponent(queryText)}`);
  };

  const handleCopySql = () => {
    if (!selectedLog?.generated_sql) return;
    navigator.clipboard.writeText(selectedLog.generated_sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Engineering Query Logs
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono">
              <Clock className="w-3 h-3 text-indigo-600" />
              Audit Log Active
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Historical audit log of natural language queries, generated SQL, and result sets.
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 bg-white rounded-md border border-slate-200 text-slate-600 shadow-2xs">
          Source: <strong className="text-indigo-700">nl_query_log</strong> • {filteredQueries.length} records
        </span>
      </div>

      {/* 2. Search Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-indigo-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search past queries, keywords, or explanations..."
            className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-600 focus:bg-white rounded-lg py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/30 font-sans transition-all shadow-inner"
          />
        </div>
      </div>

      {/* 3. History Table & Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 Cols): Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-mono text-slate-600">
                  <th className="py-3 px-4 font-semibold">Natural Language Query</th>
                  <th className="py-3 px-3 text-right font-semibold">Results</th>
                  <th className="py-3 px-3 text-right font-semibold">Execution</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredQueries.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/70 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="text-slate-900 font-semibold leading-snug">
                          "{log.natural_language_query}"
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {new Date(log.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold">
                          {log.query_result_count}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {log.execution_time_ms}ms
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Success
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRerun(log.natural_language_query);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-md text-xs font-semibold transition-all shadow-2xs"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Re-run</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (1 Col): Detail Inspector with Copy */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 sticky top-20">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                Query Inspector
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Engine telemetry</span>
            </div>
          </div>

          {selectedLog ? (
            <div className="space-y-4 text-xs font-sans">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">
                  Original User Prompt
                </span>
                <div className="font-bold text-slate-900 mt-1 text-sm leading-snug">
                  "{selectedLog.natural_language_query}"
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/40 rounded-lg border border-indigo-200/80">
                <span className="text-[10px] font-mono uppercase text-indigo-800 font-bold block">
                  Natural Language Interpretation
                </span>
                <p className="text-slate-700 mt-1 leading-relaxed text-xs">
                  {selectedLog.explanation}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                    Generated SQL Query
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors font-mono"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-3 bg-slate-950 text-indigo-300 rounded-lg border border-slate-800 font-mono text-[11px] overflow-x-auto leading-relaxed shadow-inner">
                  {selectedLog.generated_sql}
                </pre>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono text-slate-500">
                <span>Latency: <strong className="text-slate-900">{selectedLog.execution_time_ms}ms</strong></span>
                <span>User: <strong className="text-slate-900">{selectedLog.user_id}</strong></span>
              </div>

              <button
                type="button"
                onClick={() => handleRerun(selectedLog.natural_language_query)}
                className="w-full py-2.5 px-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm hover:shadow active:scale-98"
              >
                <span>Re-run in Find Material</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Select a query to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyQueries;
