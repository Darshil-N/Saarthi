import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CNMCBadge({ code, className = '' }) {
  const [copied, setCopied] = useState(false);

  if (!code) return <span className="text-slate-400 font-mono text-xs">—</span>;

  // Derive subtle category color accent from the CNMC prefix
  const getCategoryTheme = (code) => {
    if (code.startsWith('MECH')) return 'bg-blue-50 text-blue-900 border-blue-200 hover:border-blue-400 hover:bg-blue-100/70';
    if (code.startsWith('ELEC')) return 'bg-amber-50 text-amber-900 border-amber-200 hover:border-amber-400 hover:bg-amber-100/70';
    if (code.startsWith('CHEM')) return 'bg-purple-50 text-purple-900 border-purple-200 hover:border-purple-400 hover:bg-purple-100/70';
    if (code.startsWith('CIVIL')) return 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100/70';
    if (code.startsWith('CONS')) return 'bg-teal-50 text-teal-900 border-teal-200 hover:border-teal-400 hover:bg-teal-100/70';
    return 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-400 hover:bg-slate-100';
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy CNMC code"
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-2 py-0.5 rounded border transition-all cursor-pointer group shadow-2xs ${getCategoryTheme(code)} ${className}`}
    >
      <span>{code}</span>
      {copied ? (
        <span className="flex items-center gap-0.5 text-emerald-700 text-[10px] font-sans font-medium animate-fade-in">
          <Check className="w-3 h-3" />
          <span>Copied</span>
        </span>
      ) : (
        <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      )}
    </button>
  );
}

export default CNMCBadge;
