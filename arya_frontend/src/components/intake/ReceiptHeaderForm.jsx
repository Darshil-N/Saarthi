import React from 'react';
import { useVendors } from '@/hooks/useMaterials';
import { useIntakeStore } from '@/store/intakeStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Vendor, PO number and receipt date for the receipt being built. Shared by the OCR and
 * barcode tabs (both feed the same draft receipt).
 *
 * attempted    - the user already tried to continue, so missing required fields are flagged
 * vendorLocked - the vendor cannot change any more (bill already processed for that vendor)
 */
export default function ReceiptHeaderForm({ attempted = false, vendorLocked = false }) {
  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const vendor_id = useIntakeStore((s) => s.vendor_id);
  const po_number = useIntakeStore((s) => s.po_number);
  const receipt_date = useIntakeStore((s) => s.receipt_date);
  const setVendorId = useIntakeStore((s) => s.setVendorId);
  const setPoNumber = useIntakeStore((s) => s.setPoNumber);
  const setReceiptDate = useIntakeStore((s) => s.setReceiptDate);

  const vendorMissing = attempted && !vendor_id;
  const dateMissing = attempted && !receipt_date;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="vendor">Vendor <span className="text-red-500">*</span></Label>
        <Select value={vendor_id || ''} onValueChange={setVendorId} disabled={vendorLocked}>
          <SelectTrigger id="vendor" className={vendorMissing || !vendor_id ? 'border-red-200' : ''}>
            <SelectValue placeholder={vendorsLoading ? 'Loading...' : 'Select Vendor'} />
          </SelectTrigger>
          <SelectContent>
            {vendors?.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {vendorMissing && <p className="text-xs text-red-500">Vendor is required.</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="poNumber">PO Number</Label>
        <Input
          id="poNumber"
          placeholder="e.g. PO-2026-0417"
          value={po_number}
          onChange={(e) => setPoNumber(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="receiptDate">Receipt Date <span className="text-red-500">*</span></Label>
        <Input
          id="receiptDate"
          type="date"
          value={receipt_date}
          onChange={(e) => setReceiptDate(e.target.value)}
          className={dateMissing ? 'border-red-400' : ''}
        />
        {dateMissing && <p className="text-xs text-red-500">Receipt date is required.</p>}
      </div>
    </div>
  );
}
