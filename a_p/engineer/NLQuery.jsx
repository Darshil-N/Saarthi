import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, ChevronDown, ChevronUp, History, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import supabase from '../utils/supabase';

const EXAMPLE_QUERIES = [
  'Where are M8 bolts stored?',
  'How many gate valves are in stock?',
  'Which bin has pipe fittings?',
  'Show all mechanical materials with quantity below 20',
  'List all materials in WHSE-A',
  'What is the stock of safety gloves?',
];

const API_BASE = import.meta?.env?.VITE_API_BASE_URL || 'http://localhost:8000';

async function runNLQuery(query) {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const stored = JSON.parse(localStorage.getItem('mock_auth') || 'null');
    if (stored?.session?.access_token) {
      headers.Authorization = `Bearer ${stored.session.access_token}`;
    }
  } catch (_) { /* ignore */ }

  // Call the backend NL->data lookup endpoint
  const res = await fetch(`${API_BASE}/materials/nl-query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json(); // { sql, explanation, results, result_count }
}

export default function NLQuery() {
  const [input, setInput] = useState('');
  const [placeholder, setPlaceholder] = useState(EXAMPLE_QUERIES[0]);
  const [phase, setPhase] = useState('idle'); // idle | generating | fetching | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [sqlOpen, setSqlOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);

  // Cycle placeholder
  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholder(p => {
        const idx = EXAMPLE_QUERIES.indexOf(p);
        return EXAMPLE_QUERIES[(idx + 1) % EXAMPLE_QUERIES.length];
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = useCallback(async (q) => {
    const query = (q || input).trim();
    if (!query) return;

    setPhase('generating');
    setSqlOpen(false);
    setResult(null);
    setError('');

    try {
      // Phase 1: "Generating query..."
      await new Promise(r => setTimeout(r, 600));
      setPhase('fetching');

      // Phase 2: actual call
      const data = await runNLQuery(query);
      setResult({ ...data, query });
      setPhase('done');

      // Add to history (deduplicated)
      setHistory(prev => {
        const filtered = prev.filter(h => h !== query);
        return [query, ...filtered].slice(0, 10);
      });

      // Log to nl_query_log
      try {
        await supabase.from('nl_query_log').insert({
          query,
          generated_sql: data.sql,
          result_count: data.result_count ?? 0,
          was_successful: true,
        });
      } catch (_) { /* non-fatal */ }

    } catch (err) {
      setError(err.message || 'Query failed');
      setPhase('error');
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const columns = result?.results?.[0] ? Object.keys(result.results[0]) : [];

  return (
    <div className="flex gap-6 h-full">
      {/* Main Panel */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-teal-600" />
            <h2 className="font-bold text-slate-800">Ask anything about materials & inventory</h2>
          </div>
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={phase === 'generating' || phase === 'fetching'}
              className="flex-1 bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || phase === 'generating' || phase === 'fetching'}
              className="px-5 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
            >
              {phase === 'generating' || phase === 'fetching' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Ask
            </button>
          </div>

          {/* Example chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLE_QUERIES.slice(0, 4).map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); handleSubmit(q); }}
                className="text-xs bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 px-3 py-1.5 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {(phase === 'generating' || phase === 'fetching') && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center gap-4 shadow-sm">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            <p className="text-slate-600 font-medium">
              {phase === 'generating' ? 'Generating SQL query with Gemini AI...' : 'Fetching results from database...'}
            </p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-700 mb-1">Query failed</p>
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={() => handleSubmit()}
                className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
              >
                <RotateCcw className="w-4 h-4" /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {phase === 'done' && result && (
          <div className="space-y-4">
            {/* Result summary */}
            <div className="bg-teal-50 border border-teal-200 rounded-xl px-5 py-3 flex items-center justify-between">
              <p className="text-sm text-teal-800 font-medium">
                Found <span className="font-bold">{result.result_count ?? result.results?.length ?? 0}</span> result(s)
                for: <em>"{result.query}"</em>
              </p>
              {result.explanation && (
                <span className="text-xs text-teal-600 hidden md:block max-w-xs truncate">{result.explanation}</span>
              )}
            </div>

            {/* Table */}
            {result.results?.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        {columns.map(col => (
                          <th key={col} className="px-5 py-3 whitespace-nowrap">{col.replace(/_/g, ' ')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.results.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          {columns.map(col => (
                            <td key={col} className="px-5 py-3 text-slate-700 whitespace-nowrap">
                              {row[col] === null || row[col] === undefined
                                ? <span className="text-slate-300">—</span>
                                : typeof row[col] === 'number'
                                  ? row[col].toLocaleString()
                                  : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
                No results found. Try rephrasing your question.
              </div>
            )}

            {/* SQL Accordion */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <button
                onClick={() => setSqlOpen(o => !o)}
                className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">SQL</span>
                  Generated query
                </span>
                {sqlOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {sqlOpen && (
                <div className="border-t border-slate-200">
                  {result.explanation && (
                    <p className="px-5 py-3 text-sm text-slate-500 border-b border-slate-100">{result.explanation}</p>
                  )}
                  <pre className="px-5 py-4 text-xs text-teal-700 bg-slate-50 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                    {result.sql}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* History Sidebar */}
      <div className="w-64 shrink-0 hidden lg:block">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-0">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-700 text-sm">Query History</h3>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Your recent queries will appear here</p>
          ) : (
            <ul className="space-y-1">
              {history.map((q, i) => (
                <li key={i}>
                  <button
                    onClick={() => { setInput(q); handleSubmit(q); }}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors truncate"
                    title={q}
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
