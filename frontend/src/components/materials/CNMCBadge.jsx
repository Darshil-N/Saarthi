import React from 'react';
import { Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function CNMCBadge({ cnmc, is_new_material, editable = false, onEdit }) {
  const segments = (cnmc || '').split('-');

  if (editable && is_new_material) {
    return (
      <Input
        value={cnmc || ''}
        onChange={(e) => onEdit && onEdit(e.target.value)}
        className="font-mono text-xs h-8 w-48 bg-blue-50 border-blue-300"
        placeholder="CNMC code"
      />
    );
  }

  return (
    <TooltipProvider>
      <div className="inline-flex items-center gap-1.5">
        <span className="font-mono bg-slate-100 text-slate-800 px-2 py-1 rounded text-xs border border-slate-200">
          {segments.map((seg, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-slate-400 mx-0.5">-</span>}
              <span>{seg}</span>
            </React.Fragment>
          ))}
        </span>

        {!is_new_material && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>CNMC is immutable once approved</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
