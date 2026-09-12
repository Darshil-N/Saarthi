import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, CheckCircle, FileText, Loader2 } from 'lucide-react';
import { useVendors } from '@/hooks/useMaterials';
import { useOCRUpload, useConfirmReceipt } from '@/hooks/useIntake';
import { useIntakeStore } from '@/store/intakeStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import OCRResultsTable from './OCRResultsTable';

export default function OCRUpload() {
  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const ocrMutation = useOCRUpload();
  const confirmMutation = useConfirmReceipt();
  const { toast } = useToast();
  
  const { vendor_id, po_number, receipt_date, receipt_id, line_items } = useIntakeStore();
  const { setVendorId, setPoNumber, setReceiptDate } = useIntakeStore();
  
  const [file, setFile] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const handleProcess = () => {
    if (!vendor_id) {
      toast({ title: 'Vendor Required', description: 'Please select a vendor first.', variant: 'destructive' });
      return;
    }
    if (!file) {
      toast({ title: 'File Required', description: 'Please upload a bill image.', variant: 'destructive' });
      return;
    }
    
    const formData = new FormData();
    formData.append('bill_image', file);
    formData.append('vendor_id', vendor_id);
    
    ocrMutation.mutate(formData);
  };

  const handleConfirm = () => {
    if (line_items.length === 0) return;
    
    // Validate required fields
    const invalidRows = line_items.filter(i => !i.location_code || !i.quality_grade);
    if (invalidRows.length > 0) {
      toast({ 
        title: 'Validation Error', 
        description: `Please set Location and Quality for all items. ${invalidRows.length} item(s) missing data.`, 
        variant: 'destructive' 
      });
      return;
    }

    confirmMutation.mutate({
      vendor_id,
      receipt_date,
      po_number,
      bill_image_url: 'placeholder_url', // In a real app, this comes from the upload response
      line_items
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* Header Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="vendor">Vendor <span className="text-red-500">*</span></Label>
          <Select value={vendor_id || ''} onValueChange={setVendorId} disabled={!!receipt_id}>
            <SelectTrigger id="vendor" className={!vendor_id ? "border-red-200" : ""}>
              <SelectValue placeholder={vendorsLoading ? "Loading..." : "Select Vendor"} />
            </SelectTrigger>
            <SelectContent>
              {vendors?.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="poNumber">PO Number</Label>
          <Input 
            id="poNumber" 
            placeholder="e.g. PO-2026-0417" 
            value={po_number}
            onChange={(e) => setPoNumber(e.target.value)}
            disabled={!!receipt_id}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="receiptDate">Receipt Date</Label>
          <Input 
            id="receiptDate" 
            type="date"
            value={receipt_date}
            onChange={(e) => setReceiptDate(e.target.value)}
            disabled={!!receipt_id}
          />
        </div>
      </div>

      {/* Upload Zone (Only show before processing) */}
      {!receipt_id && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-medium text-slate-800 mb-4">Upload Bill</h3>
          
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <input {...getInputProps()} />
            
            {file ? (
              <div className="flex flex-col items-center text-center">
                <FileText className="h-12 w-12 text-blue-500 mb-3" />
                <p className="font-medium text-slate-700">{file.name}</p>
                <p className="text-sm text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <p className="text-xs text-blue-600 mt-3 font-medium">Click or drag to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <UploadCloud className="h-12 w-12 text-slate-400 mb-3" />
                <p className="font-medium text-slate-700">Drag & drop your bill here</p>
                <p className="text-sm text-slate-500 mt-1">or click to select a file (PDF, JPG, PNG)</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <Button 
              onClick={handleProcess} 
              disabled={!file || !vendor_id || ocrMutation.isPending}
              className="w-full sm:w-auto"
            >
              {ocrMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing bill with Gemini Vision...
                </>
              ) : (
                <>Process with AI</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Results Table (Show when processing or done) */}
      {(receipt_id || ocrMutation.isPending) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-medium text-slate-800">Extracted Line Items</h3>
            {receipt_id && (
              <div className="flex items-center text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200">
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Processing Complete
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-auto">
             <OCRResultsTable isLoading={ocrMutation.isPending} />
          </div>

          {receipt_id && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => window.location.reload()}>Cancel</Button>
              <Button 
                onClick={handleConfirm} 
                disabled={confirmMutation.isPending || line_items.length === 0}
              >
                {confirmMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming...</>
                ) : (
                  'Confirm Receipt'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
