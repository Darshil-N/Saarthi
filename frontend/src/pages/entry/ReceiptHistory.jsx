import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useReceipts, useReceipt } from '@/hooks/useIntake';
import { useVendors } from '@/hooks/useMaterials';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, FilterX, ChevronRight, X, ExternalLink, AlertCircle } from 'lucide-react';
import OCRResultsTable from '@/components/intake/OCRResultsTable';
import { formatINR, formatReceiptDate } from '@/lib/intake';
import { getApiErrorMessage } from '@/lib/utils';

const STATUS_COLORS = {
  draft: 'secondary',
  processing: 'default',
  completed: 'outline',
  rejected: 'destructive',
};

const STATUS_OPTIONS = [
  ['completed', 'Completed'],
  ['processing', 'Processing'],
  ['draft', 'Draft'],
  ['rejected', 'Rejected'],
];

const NO_FILTERS = { vendor_id: 'all', status: 'all', from_date: '', to_date: '' };

export default function ReceiptHistory() {
  const [filters, setFilters] = useState(NO_FILTERS);
  // The selected receipt lives in the URL so it can be linked to (Home page, post-confirm redirect).
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');
  const selectReceipt = (id) => setSearchParams(id ? { id } : {}, { replace: true });

  const { data: vendors } = useVendors();
  const { data: receipts, isLoading, isError: listFailed, error: listError, refetch } = useReceipts({ ...filters, limit: 100 });
  const {
    data: selectedReceipt,
    isLoading: detailsLoading,
    isError: detailFailed,
    error: detailError,
  } = useReceipt(selectedId);

  const handleClearFilters = () => setFilters(NO_FILTERS);

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
             <Select value={filters.vendor_id} onValueChange={(v) => setFilters({ ...filters, vendor_id: v })}>
               <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vendor" /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Vendors</SelectItem>
                 {vendors?.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
               </SelectContent>
             </Select>

             <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
               <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Statuses</SelectItem>
                 {STATUS_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
               </SelectContent>
             </Select>

             <Input
               type="date"
               className="h-8 text-xs"
               aria-label="From date"
               value={filters.from_date}
               onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
             />
             <Input
               type="date"
               className="h-8 text-xs"
               aria-label="To date"
               value={filters.to_date}
               onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
             />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : listFailed ? (
            <div className="text-center py-12 px-4 text-sm">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
              <p className="text-slate-700 font-medium">Could not load receipts</p>
              <p className="text-slate-500 mt-1">{getApiErrorMessage(listError, 'Please try again.')}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : !receipts || receipts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No receipts found.</div>
          ) : (
            <div className="space-y-1">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  onClick={() => selectReceipt(receipt.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                    selectedId === receipt.id
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-slate-800">{receipt.gr_number}</span>
                      <Badge variant={STATUS_COLORS[receipt.status]} className="text-[10px] px-1.5 py-0 capitalize">
                        {receipt.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 font-medium truncate">{receipt.vendor_name}</div>
                    <div className="text-xs text-slate-400">
                      {formatReceiptDate(receipt.receipt_date)} • {receipt.items_count} items • {formatINR(receipt.total_value)}
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 ${selectedId === receipt.id ? 'text-blue-500' : 'text-slate-300'}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Panel */}
      {selectedId && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-full">
          {detailsLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-64 w-full mt-8" />
            </div>
          ) : detailFailed || !selectedReceipt ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <AlertCircle className="h-10 w-10 mb-3 text-red-400" />
              <p className="text-slate-700 font-medium">Could not load this receipt</p>
              <p className="text-sm text-slate-500 mt-1">{getApiErrorMessage(detailError, 'It may have been removed.')}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => selectReceipt(null)}>Close</Button>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold font-mono text-slate-800">{selectedReceipt.gr_number}</h2>
                    <Badge variant={STATUS_COLORS[selectedReceipt.status]} className="capitalize">
                        {selectedReceipt.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-sm">
                    <div><span className="text-slate-500">Vendor:</span> <span className="font-medium">{selectedReceipt.vendor_name}</span></div>
                    <div><span className="text-slate-500">Date:</span> <span className="font-medium">{formatReceiptDate(selectedReceipt.receipt_date)}</span></div>
                    <div><span className="text-slate-500">PO:</span> <span className="font-medium">{selectedReceipt.po_number || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Items:</span> <span className="font-medium">{selectedReceipt.line_items?.length || 0}</span></div>
                  </div>
                  {selectedReceipt.bill_image_url && (
                    <a
                      href={selectedReceipt.bill_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-600 hover:underline mt-3"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> View bill
                    </a>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => selectReceipt(null)} className="lg:hidden text-slate-500" aria-label="Close details">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Items Table */}
              <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
                 <OCRResultsTable readOnly items={selectedReceipt.line_items} />
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
