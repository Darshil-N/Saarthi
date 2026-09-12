import React from 'react';
import { useMatchingQueue, useApproveMatch, useRejectMatch } from '@/hooks/useMatching';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import MatchStatusBadge from '@/components/intake/MatchStatusBadge';
import CNMCBadge from '@/components/materials/CNMCBadge';

export default function PendingApprovals() {
  const { data: queue, isLoading } = useMatchingQueue();
  const approveMutation = useApproveMatch();
  const rejectMutation = useRejectMatch();

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!queue || queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4 opacity-80" />
        <h2 className="text-2xl font-bold text-slate-700">All caught up!</h2>
        <p className="mt-2 text-slate-500">No pending approvals in the queue.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {queue.map((item) => (
        <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <MatchStatusBadge 
              match_status={item.match_status} 
              confidence={item.confidence} 
              match_reason={item.match_reason} 
            />
            <span className="text-xs font-mono text-slate-400">ID: {item.id}</span>
          </div>

          {/* Body */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
            {/* Visual separator for large screens */}
            <div className="hidden md:flex absolute inset-y-0 left-1/2 items-center justify-center -ml-4 z-10 pointer-events-none">
               <div className="bg-white p-2 rounded-full border border-slate-200 shadow-sm">
                 <ArrowRight className="h-5 w-5 text-slate-400" />
               </div>
            </div>

            {/* Left: New Material */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">New Incoming Material</h4>
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                <p className="font-medium text-slate-800 text-lg mb-3">{item.description}</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mb-4">
                  <div>Qty: <span className="font-semibold">{item.quantity} {item.unit}</span></div>
                  <div>Price: <span className="font-semibold">₹{item.unit_price?.toFixed(2)}</span></div>
                </div>
                <CNMCBadge cnmc={item.cnmc} is_new_material={true} editable={false} />
              </div>
            </div>

            {/* Right: Matched Material */}
            <div className="space-y-4">
               <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Existing Canonical Material</h4>
               {item.matched_material_id ? (
                 <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                   <p className="font-medium text-slate-800 text-lg mb-3">{item.matched_description}</p>
                   <div className="mb-4">
                     <div className="flex justify-between text-xs mb-1">
                       <span className="text-slate-500 font-medium">Match Confidence</span>
                       <span className="font-bold text-slate-700">{(item.confidence * 100).toFixed(1)}%</span>
                     </div>
                     <Progress value={item.confidence * 100} className="h-2" />
                     <p className="mt-2 text-xs text-slate-500 italic leading-snug">{item.match_reason}</p>
                   </div>
                   {/* In a real app we'd fetch the existing material's CNMC, for now mockup */}
                   <span className="font-mono bg-slate-200 text-slate-800 px-2 py-1 rounded text-xs border border-slate-300">
                     {item.cnmc.replace(/-NEW$/, '')}
                   </span>
                 </div>
               ) : (
                 <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 text-slate-400 text-sm p-4 text-center">
                   No existing material matched.
                 </div>
               )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
             <Button 
               variant="outline" 
               className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
               onClick={() => rejectMutation.mutate(item.id)}
               disabled={rejectMutation.isPending || approveMutation.isPending}
             >
               {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
               Reject Match
             </Button>
             
             <Button 
               className="bg-green-600 hover:bg-green-700 text-white"
               onClick={() => approveMutation.mutate(item.id)}
               disabled={rejectMutation.isPending || approveMutation.isPending}
             >
               {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
               Approve Mapping
             </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
