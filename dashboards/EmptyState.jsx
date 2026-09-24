import React from 'react';

/**
 * Shared EmptyState component used across all dashboards.
 *
 * Props:
 *   icon      — Lucide icon component (or any SVG component)
 *   title     — Primary empty-state heading
 *   message   — Secondary descriptive text
 *   action    — Optional { label, onClick } object for a CTA button
 */
export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
          <Icon className="w-8 h-8 text-slate-300" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {message && <p className="text-sm text-slate-400 max-w-xs leading-relaxed">{message}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
