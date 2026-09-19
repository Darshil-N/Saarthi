import React, { useState } from 'react';
import { useReceipts, useReceipt } from '@/hooks/useIntake';
import { useVendors } from '@/hooks/useMaterials';
import { useIntakeStore } from '@/store/intakeStore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, FilterX, ChevronRight, X } from 'lucide-react';
import OCRResultsTable from '@/components/intake/OCRResultsTable';

const STATUS_COLORS = {
  draft: 'secondary',
  processing: 'default',
  completed: 'outline',
  rejected: 'destructive',
};

export default function ReceiptHistory() {
  const [filters, setFilters] = useState({
    vendor_id: 'all',
    status: 'all',
    from_date: '',
    to_date: ''
  });
  const [selectedId, setSelectedId] = useState(null);

  const { data: vendors } = useVendors();
  const { data: receipts, isLoading } = useReceipts(filters);
  const { data: selectedReceipt, isLoading: detailsLoading } = useReceipt(selectedId);
  const setLineItems = useIntakeStore(s => s.setLineItems);

  // Sync selected receipt items into the store for the read-only OCRResultsTable to consume
  React.useEffect(() => {
    if (selectedReceipt?.line_items) {
      setLineItems(selectedReceipt.line_items);
    }
  }, [selectedReceipt, setLineItems]);

  const handleClearFilters = () => {
    setFilters({ vendor_id: 'all', status: 'all', from_date: '', to_date: '' });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto h-[calc(100vh-8rem)]">
      
      {/* List Panel */}
      <div className={`flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 ${selectedId ? 'w-full lg:w-1/3 hidden lg:flex' : 'w-full'}`}>
        
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center">
              <Search className="h-4 w-4 mr-2" /> Filters
            </h3>
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 text-xs text-slate-500">
              <FilterX className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             <Select value={filters.vendor_id} onValueChange={v => setFilters({...filters, vendor_id: v})}>
               <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vendor" /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Vendors</SelectItem>
                 {vendors?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
               </SelectContent>
             </Select>

             <Select value={filters.status} onValueChange={v => setFilters({...filters, status: v})}>
               <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Statuses</SelectItem>
                 <SelectItem value="processing">Processing</SelectItem>
                 <SelectItem value="confirmed">Confirmed</SelectItem>
                 <SelectItem value="rejected">Rejected</SelectItem>
               </SelectContent>
             </Select>
             
             <Input 
               type="date" 
               className="h-8 text-xs" 
               value={filters.from_date}
               onChange={e => setFilters({...filters, from_date: e.target.value})}
             />
             <Input 
               type="date" 
               className="h-8 text-xs"
               value={filters.to_date}
               onChange={e => setFilters({...filters, to_date: e.target.value})}
             />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : !receipts || receipts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No receipts found.</div>
          ) : (
            <div className="space-y-1">
              {receipts.map(receipt => (
                <div 
                  key={receipt.id}
                  onClick={() => setSelectedId(receipt.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                    selectedId === receipt.id 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-slate-800">{receipt.id.split('-')[0]}</span>
                      <Badge variant={STATUS_COLORS[receipt.status]} className="text-[10px] px-1.5 py-0 capitalize">
                        {receipt.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 font-medium truncate w-48">{receipt.vendor_name || receipt.vendor_id}</div>
                    <div className="text-xs text-slate-400">{new Date(receipt.receipt_date).toLocaleDateString()} • {receipt.items_count} items</div>
                  </div>
                  <ChevronRight className={`h-4 w-4 ${selectedId === receipt.id ? 'text-blue-500' : 'text-slate-300'}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Panel */}
      {selectedId && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-full">
          {detailsLoading || !selectedReceipt ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-64 w-full mt-8" />
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold font-mono text-slate-800">{selectedReceipt.id}</h2>
                    <Badge variant={STATUS_COLORS[selectedReceipt.status]} className="capitalize">
                        {selectedReceipt.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-sm">
                    <div><span className="text-slate-500">Vendor:</span> <span className="font-medium">{selectedReceipt.vendor_id}</span></div>
                    <div><span className="text-slate-500">Date:</span> <span className="font-medium">{new Date(selectedReceipt.receipt_date).toLocaleDateString()}</span></div>
                    <div><span className="text-slate-500">PO:</span> <span className="font-medium">{selectedReceipt.po_number || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Items:</span> <span className="font-medium">{selectedReceipt.line_items?.length || 0}</span></div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} className="lg:hidden text-slate-500">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Items Table */}
              <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
                 <OCRResultsTable readOnly={true} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty State when nothing selected (Large screens) */}
      {!selectedId && (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <div className="text-center text-slate-400">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Select a receipt</p>
            <p className="text-sm">Click a receipt on the left to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
