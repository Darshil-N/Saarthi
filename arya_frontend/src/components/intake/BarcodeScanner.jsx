import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BarcodeOverlay from './BarcodeOverlay';
import ReceiptHeaderForm from './ReceiptHeaderForm';
import { useBarcodeIntake, useConfirmReceipt } from '@/hooks/useIntake';
import { useLocations } from '@/hooks/useMaterials';
import { useIntakeStore } from '@/store/intakeStore';
import { buildConfirmPayload, formatINR, validateLineItems } from '@/lib/intake';
import { getApiErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Package, Plus, CheckCircle, Loader2, Search, FileX2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CNMCBadge from '@/components/materials/CNMCBadge';

export default function BarcodeScanner() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(true);
  const [lastScanned, setLastScanned] = useState(null);
  const [foundItem, setFoundItem] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // Form state for the scanned item
  const [qty, setQty] = useState('1');
  const [quality, setQuality] = useState('');
  const [location, setLocation] = useState('');

  // The camera reports the same code many times a second; only the first one may start a lookup.
  const handlingScan = useRef(false);

  const barcodeMutation = useBarcodeIntake();
  const lookupBarcode = barcodeMutation.mutateAsync;
  const confirmMutation = useConfirmReceipt();
  const { data: locations = [] } = useLocations();
  const { line_items, addLineItem, removeLineItem, vendor_id, receipt_date } = useIntakeStore();
  const { toast } = useToast();

  const resumeScanning = useCallback(() => {
    handlingScan.current = false;
    setFoundItem(null);
    setNotFound(false);
    setLastScanned(null);
    setScanning(true);
  }, []);

  const handleDecode = useCallback(async (text) => {
    if (handlingScan.current) return;
    handlingScan.current = true;
    setScanning(false);
    setLastScanned(text);
    setNotFound(false);
    setQty('1');
    setQuality('');
    setLocation('');

    try {
      const data = await lookupBarcode({ barcode: text });
      if (data.found === false) {
        setNotFound(true);
        setFoundItem(null);
      } else {
        setFoundItem(data);
      }
    } catch (err) {
      handlingScan.current = false;
      setScanning(true);
      toast({ title: 'Scan Failed', description: getApiErrorMessage(err, 'Could not look up the barcode.'), variant: 'destructive' });
    }
  }, [lookupBarcode, toast]);

  const handleAdd = () => {
    const quantity = Number(qty);
    if (!(quantity > 0)) {
      toast({ title: 'Validation Error', description: 'Quantity must be greater than 0.', variant: 'destructive' });
      return;
    }
    if (!location || !quality) {
      toast({ title: 'Validation Error', description: 'Location and Quality are required.', variant: 'destructive' });
      return;
    }

    const unitPrice = Number(foundItem.unit_price) || 0;
    addLineItem({
      line_id: `li_bar_${Date.now()}`,
      barcode: lastScanned,
      description: foundItem.description,
      quantity,
      unit: foundItem.unit,
      unit_price: unitPrice,
      total_price: unitPrice * quantity,
      match_status: 'exact_match',
      matched_material_id: foundItem.matched_material_id,
      cnmc: foundItem.cnmc,
      is_new_material: false,
      confidence: 1,
      quality_grade: quality,
      location_code: location,
      vendor_id,
    });
    toast({ title: 'Added to Receipt', description: 'Item queued for confirmation.' });
    resumeScanning();
  };

  const handleConfirmAll = () => {
    if (line_items.length === 0) return;

    setAttempted(true);
    if (!vendor_id) {
      toast({ title: 'Vendor Required', description: 'Please select a vendor above before confirming.', variant: 'destructive' });
      return;
    }
    if (!receipt_date) {
      toast({ title: 'Receipt Date Required', description: 'Please enter the receipt date.', variant: 'destructive' });
      return;
    }
    const problems = validateLineItems(line_items);
    if (problems.length > 0) {
      toast({ title: 'Please fix the items', description: problems.slice(0, 3).join(' • '), variant: 'destructive' });
      return;
    }

    confirmMutation.mutate(buildConfirmPayload(useIntakeStore.getState()), {
      onSuccess: (data) => {
        setAttempted(false);
        resumeScanning();
        navigate(`/entry/history?id=${data.receipt_id}`);
      },
    });
  };

  const handleToggleScanner = () => {
    if (scanning) {
      setScanning(false);
      setFoundItem(null);
      setNotFound(false);
    } else {
      resumeScanning();
    }
  };

  const totalValue = line_items.reduce((sum, i) => sum + (Number(i.total_price) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <ReceiptHeaderForm attempted={attempted} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Scanner Side */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-800 flex items-center">
                 <Camera className="mr-2 h-5 w-5 text-blue-500" />
                 Barcode Scanner
              </h3>
              <Button variant={scanning ? 'outline' : 'default'} size="sm" onClick={handleToggleScanner}>
                 {scanning ? 'Pause Scanner' : 'Resume Scanning'}
              </Button>
            </div>

            <BarcodeOverlay isActive={scanning} onDecode={handleDecode} />

            {barcodeMutation.isPending && (
               <div className="mt-4 flex items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lookup in progress...
               </div>
            )}
          </div>

          {/* Cart Summary */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-blue-100 p-2 rounded-lg mr-4">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">{line_items.length}</div>
                  <div className="text-sm text-slate-500 font-medium">
                    Items scanned this session{line_items.length > 0 && ` · ${formatINR(totalValue)}`}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleConfirmAll}
                disabled={line_items.length === 0 || confirmMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Confirm All
              </Button>
            </div>

            {line_items.length > 0 && (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {line_items.map((item) => (
                  <li key={item.line_id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 truncate">{item.description}</p>
                      <p className="text-xs text-slate-400">
                        {item.quantity} {item.unit} · <span className="font-mono">{item.location_code || 'no location'}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.line_id)}
                      className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                      aria-label={`Remove ${item.description}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Result/Form Side */}
        <div>
          {!foundItem && !notFound && (
            <div className="h-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-slate-50 min-h-[400px]">
              <Search className="h-12 w-12 mb-4 opacity-30" />
              <p className="font-medium text-slate-600">Waiting for scan...</p>
              <p className="text-sm mt-1">Point your camera at a barcode</p>
            </div>
          )}

          {foundItem && (
            <Card className="border-green-200 shadow-md">
              <CardHeader className="bg-green-50/50 border-b border-green-100 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-green-800 flex items-center">
                     <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
                     Material Found
                  </CardTitle>
                  <span className="text-xs font-mono bg-white px-2 py-1 rounded border text-slate-500">{lastScanned}</span>
                </div>
                <CardDescription className="text-slate-700 mt-2 font-medium text-base">
                  {foundItem.description}
                </CardDescription>
                <div className="mt-2">
                   <CNMCBadge cnmc={foundItem.cnmc} is_new_material={false} />
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity ({foundItem.unit})</Label>
                    <Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Quality Grade</Label>
                    <Select value={quality} onValueChange={setQuality}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Grade A (Good)</SelectItem>
                        <SelectItem value="B">Grade B (Fair)</SelectItem>
                        <SelectItem value="C">Grade C (Poor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Storage Location</Label>
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.code} value={loc.code}>{loc.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t flex justify-end gap-3 rounded-b-lg">
                <Button variant="outline" onClick={resumeScanning}>Cancel</Button>
                <Button onClick={handleAdd}>
                  <Plus className="mr-2 h-4 w-4" /> Add to Receipt
                </Button>
              </CardFooter>
            </Card>
          )}

          {notFound && (
            <Card className="border-amber-200 shadow-md">
              <CardHeader className="bg-amber-50/60 border-b border-amber-100 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-amber-800 flex items-center">
                     <FileX2 className="mr-2 h-5 w-5 text-amber-600" />
                     Not in the catalog
                  </CardTitle>
                  <span className="text-xs font-mono bg-white px-2 py-1 rounded border text-slate-500">{lastScanned}</span>
                </div>
                <CardDescription className="text-slate-600 mt-2">
                  This code does not match any material or legacy code, so stock cannot be booked against it.
                  To register a new material, upload its bill in the OCR Upload tab. Otherwise scan a different code.
                </CardDescription>
              </CardHeader>
              <CardFooter className="bg-slate-50 rounded-b-lg flex justify-end py-4">
                <Button onClick={resumeScanning}>Scan another</Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
