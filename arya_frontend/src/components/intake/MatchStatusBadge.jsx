import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  exact_match: {
    label: '🟢 Exact Match',
    className: 'bg-green-100 text-green-800 border border-green-200',
  },
  near_duplicate: {
    label: '🟡 Near Duplicate',
    className: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  },
  new_material: {
    label: '🔵 New Material',
    className: 'bg-blue-100 text-blue-800 border border-blue-200',
  },
  uncertain: {
    label: '🔴 Uncertain',
    className: 'bg-red-100 text-red-800 border border-red-200',
  },
};

export default function MatchStatusBadge({ match_status, confidence, match_reason }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[match_status] || STATUS_CONFIG.uncertain;
  const isExpandable = match_status === 'near_duplicate' || match_status === 'uncertain';

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => isExpandable && setExpanded(!expanded)}
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
          config.className,
          isExpandable && 'cursor-pointer hover:opacity-80'
        )}
      >
        {config.label}
        {isExpandable && <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />}
      </button>

      {expanded && isExpandable && (
        <div className="mt-1 p-2 rounded-md bg-white border border-slate-200 shadow-sm text-xs text-slate-700 max-w-xs">
          <div className="font-semibold text-slate-900 mb-1">
            Confidence: {((confidence || 0) * 100).toFixed(0)}%
          </div>
          <div className="text-slate-500 leading-snug italic">{match_reason || 'No reason provided.'}</div>
        </div>
      )}
    </div>
  );
}
