import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, CheckCircle, FileText, Loader2 } from 'lucide-react';
import { useOCRUpload, useConfirmReceipt } from '@/hooks/useIntake';
import { useIntakeStore } from '@/store/intakeStore';
import { buildConfirmPayload, validateLineItems } from '@/lib/intake';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import OCRResultsTable from './OCRResultsTable';
import ReceiptHeaderForm from './ReceiptHeaderForm';

export default function OCRUpload() {
  const navigate = useNavigate();
  const ocrMutation = useOCRUpload();
  const confirmMutation = useConfirmReceipt();
  const { toast } = useToast();

  const { vendor_id, receipt_date, receipt_id, line_items } = useIntakeStore();
  const resetIntake = useIntakeStore((s) => s.resetIntake);

  const [file, setFile] = useState(null);
  const [attempted, setAttempted] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (rejections) => {
      const tooLarge = rejections.some((r) => r.errors.some((e) => e.code === 'file-too-large'));
      toast({
        title: 'File not accepted',
        description: tooLarge ? 'The file is larger than 10 MB.' : 'Upload a JPG, PNG or WebP image, or a PDF.',
        variant: 'destructive',
      });
    },
  });

  const handleProcess = () => {
    setAttempted(true);
    if (!vendor_id) {
      toast({ title: 'Vendor Required', description: 'Please select a vendor first.', variant: 'destructive' });
      return;
    }
    if (!receipt_date) {
      toast({ title: 'Receipt Date Required', description: 'Please enter the receipt date.', variant: 'destructive' });
      return;
    }
    if (!file) {
      toast({ title: 'File Required', description: 'Please upload a bill image.', variant: 'destructive' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('vendor_id', vendor_id);

    ocrMutation.mutate(formData);
  };

  const handleConfirm = () => {
    if (line_items.length === 0) return;

    setAttempted(true);
    if (!vendor_id) {
      toast({ title: 'Vendor Required', description: 'Please select a vendor.', variant: 'destructive' });
      return;
    }
    if (!receipt_date) {
      toast({ title: 'Receipt Date Required', description: 'Please enter the receipt date.', variant: 'destructive' });
      return;
    }

    const problems = validateLineItems(line_items);
    if (problems.length > 0) {
      const shown = problems.slice(0, 3).join(' • ');
      toast({
        title: 'Please fix the highlighted items',
        description: problems.length > 3 ? `${shown} (+${problems.length - 3} more)` : shown,
        variant: 'destructive',
      });
      return;
    }

    // Read the freshest draft from the store rather than this render's snapshot.
    confirmMutation.mutate(buildConfirmPayload(useIntakeStore.getState()), {
      onSuccess: (data) => {
        setFile(null);
        setAttempted(false);
        navigate(`/entry/history?id=${data.receipt_id}`);
      },
    });
  };

  const handleCancel = () => {
    resetIntake();
    setFile(null);
    setAttempted(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      <ReceiptHeaderForm attempted={attempted} vendorLocked={!!receipt_id} />

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
                <p className="text-sm text-slate-500 mt-1">or click to select a file (PDF, JPG, PNG — up to 10 MB)</p>
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
            <OCRResultsTable isLoading={ocrMutation.isPending} attempted={attempted} />
          </div>

          {receipt_id && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex justify-end gap-3">
              <Button variant="outline" onClick={handleCancel} disabled={confirmMutation.isPending}>Cancel</Button>
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
