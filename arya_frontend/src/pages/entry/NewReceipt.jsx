import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OCRUpload from '@/components/intake/OCRUpload';
import BarcodeScanner from '@/components/intake/BarcodeScanner';

export default function NewReceipt() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="ocr" className="w-full">
        <div className="flex justify-center mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-12">
            <TabsTrigger value="ocr" className="text-sm font-medium">OCR Upload</TabsTrigger>
            <TabsTrigger value="barcode" className="text-sm font-medium">Barcode Scan</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="ocr" className="mt-0 focus-visible:outline-none">
          <OCRUpload />
        </TabsContent>
        
        <TabsContent value="barcode" className="mt-0 focus-visible:outline-none">
          <BarcodeScanner />
        </TabsContent>
      </Tabs>
    </div>
  );
}
