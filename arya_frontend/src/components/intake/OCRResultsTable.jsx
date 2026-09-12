import React from 'react';
import { useIntakeStore } from '@/store/intakeStore';
import LineItemEditor from '@/components/intake/LineItemEditor';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageOpen } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
}

export default function OCRResultsTable({ readOnly = false, isLoading = false }) {
  const line_items = useIntakeStore((s) => s.line_items);

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    );
  }

  if (!line_items || line_items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <PackageOpen className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">No items yet.</p>
        <p className="text-xs">Upload a bill or scan a barcode to get started.</p>
      </div>
    );
  }

  const total = line_items.reduce((sum, item) => sum + (item.total_price || 0), 0);

  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-8">#</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-16">Qty</TableHead>
            <TableHead className="w-14">UoM</TableHead>
            <TableHead className="w-24">Unit Price</TableHead>
            <TableHead>CNMC</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Quality</TableHead>
            <TableHead className="w-40">Location</TableHead>
            {!readOnly && <TableHead className="w-10"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {line_items.map((item, i) => (
            <LineItemEditor key={item.line_id} item={item} index={i} readOnly={readOnly} />
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={readOnly ? 9 : 10} className="text-right font-semibold text-slate-700 pr-6">
              Total: <span className="text-blue-700 text-base ml-2">{formatINR(total)}</span>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
