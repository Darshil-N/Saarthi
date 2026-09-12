import React, { useState } from 'react';
import BarcodeOverlay from './BarcodeOverlay';
import { useBarcodeIntake, useConfirmReceipt } from '@/hooks/useIntake';
import { useIntakeStore } from '@/store/intakeStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, CheckCircle, Loader2, Search, FileX2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CNMCBadge from '@/components/materials/CNMCBadge';

export default function BarcodeScanner() {
  const [scanning, setScanning] = useState(true);
  const [lastScanned, setLastScanned] = useState(null);
  const [foundItem, setFoundItem] = useState(null);
  const [notFound, setNotFound] = useState(false);
  
  // Form state for editing found/new item
  const [qty, setQty] = useState(1);
  const [quality, setQuality] = useState('');
  const [location, setLocation] = useState('');
  const [desc, setDesc] = useState(''); // for new item
  const [uom, setUom] = useState('EA');
  const [price, setPrice] = useState(0);

  const barcodeMutation = useBarcodeIntake();
  const confirmMutation = useConfirmReceipt();
  const { line_items, addLineItem, vendor_id, receipt_date, po_number } = useIntakeStore();
  const { toast } = useToast();

  const handleDecode = async (text) => {
    if (!scanning) return;
    setScanning(false);
    setLastScanned(text);
    setNotFound(false);
    
    // Reset form
    setQty(1);
    setQuality('');
    setLocation('');
    setDesc('');
    setPrice(0);

    try {
      const data = await barcodeMutation.mutateAsync({ barcode: text });
      if (data.found === false) {
        setNotFound(true);
        setFoundItem(null);
      } else {
        setFoundItem(data);
      }
    } catch (err) {
      setScanning(true);
      toast({ title: 'Scan Failed', description: 'Could not lookup barcode.', variant: 'destructive' });
    }
  };

  const handleAdd = () => {
    if (!location || !quality) {
      toast({ title: 'Validation Error', description: 'Location and Quality are required.', variant: 'destructive' });
      return;
    }

    const newItem = foundItem ? {
      ...foundItem,
      line_id: `li_bar_${Date.now()}`,
      quantity: qty,
      quality_grade: quality,
      location_code: location,
      total_price: (foundItem.unit_price || 0) * qty
    } : {
      line_id: `li_bar_${Date.now()}`,
      barcode: lastScanned,
      description: desc,
      quantity: qty,
      unit: uom,
      unit_price: price,
      total_price: price * qty,
      match_status: 'new_material',
      is_new_material: true,
      cnmc: '',
      quality_grade: quality,
      location_code: location,
      vendor_id: vendor_id
    };

    if (!foundItem && !desc) {
       toast({ title: 'Validation Error', description: 'Description is required for new materials.', variant: 'destructive' });
       return;
    }

    addLineItem(newItem);
    toast({ title: 'Added to Receipt', description: 'Item queued for confirmation.' });
    
    // Resume scanning
    setFoundItem(null);
    setNotFound(false);
    setLastScanned(null);
    setScanning(true);
  };

  const handleConfirmAll = () => {
    if (line_items.length === 0) return;
    if (!vendor_id) {
       toast({ title: 'Vendor Required', description: 'Please select a vendor in the OCR tab before confirming.', variant: 'destructive' });
       return;
    }

    confirmMutation.mutate({
      vendor_id,
      receipt_date,
      po_number,
      bill_image_url: null,
      line_items
    }, {
      onSuccess: () => {
         setScanning(true); // reset state after full confirm
         setFoundItem(null);
         setNotFound(false);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto p-4">
      {/* Scanner Side */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-800 flex items-center">
               <Camera className="mr-2 h-5 w-5 text-blue-500" />
               Barcode Scanner
            </h3>
            <Button 
               variant={scanning ? "outline" : "default"} 
               size="sm"
               onClick={() => { setScanning(!scanning); setFoundItem(null); setNotFound(false); }}
            >
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
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div className="flex items-center">
             <div className="bg-blue-100 p-2 rounded-lg mr-4">
               <Package className="h-6 w-6 text-blue-600" />
             </div>
             <div>
               <div className="text-2xl font-bold text-slate-800">{line_items.length}</div>
               <div className="text-sm text-slate-500 font-medium">Items scanned this session</div>
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
                  <Input type="number" value={qty} onChange={e => setQty(Number(e.target.value) || 1)} min="1" />
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
                <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. WHSE-A-A1-R1" />
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t flex justify-end gap-3 rounded-b-lg">
              <Button variant="outline" onClick={() => { setFoundItem(null); setScanning(true); }}>Cancel</Button>
              <Button onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" /> Add to Receipt
              </Button>
            </CardFooter>
          </Card>
        )}

        {notFound && (
          <Card className="border-blue-200 shadow-md">
            <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
               <div className="flex items-center justify-between">
                <CardTitle className="text-blue-800 flex items-center">
                   <FileX2 className="mr-2 h-5 w-5 text-blue-600" />
                   New Material
                </CardTitle>
                <span className="text-xs font-mono bg-white px-2 py-1 rounded border text-slate-500">{lastScanned}</span>
              </div>
              <CardDescription className="text-slate-600 mt-1">
                Barcode not found in master catalog. Please enter details manually to generate a new CNMC upon approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Full material description" />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Qty</Label>
                  <Input type="number" value={qty} onChange={e => setQty(Number(e.target.value) || 1)} min="1" />
                </div>
                <div className="space-y-2">
                  <Label>UoM</Label>
                  <Input value={uom} onChange={e => setUom(e.target.value)} placeholder="EA" />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (₹)</Label>
                  <Input type="number" value={price} onChange={e => setPrice(Number(e.target.value) || 0)} min="0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                 <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="WHSE-A-A1-R1" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t flex justify-end gap-3 rounded-b-lg">
              <Button variant="outline" onClick={() => { setNotFound(false); setScanning(true); }}>Cancel</Button>
              <Button onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" /> Queue as New Material
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
