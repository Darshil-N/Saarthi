import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { AlertCircle, Camera } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function BarcodeOverlay({ isActive, onDecode }) {
  const videoRef = useRef(null);
  const codeReader = useRef(new BrowserMultiFormatReader());
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isActive || !videoRef.current) return;

    let isComponentMounted = true;
    setError(null);

    const startScanning = async () => {
      try {
        await codeReader.current.decodeFromVideoDevice(
          undefined, // Use default camera
          videoRef.current,
          (result, err) => {
            if (isComponentMounted && result) {
              onDecode(result.getText());
            }
          }
        );
      } catch (err) {
        if (isComponentMounted) {
          console.error("Camera access error:", err);
          setError("Failed to access camera. Please ensure permissions are granted.");
        }
      }
    };

    startScanning();

    return () => {
      isComponentMounted = false;
      codeReader.current.reset();
    };
  }, [isActive, onDecode]);

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Camera Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative w-full max-w-md mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
      {!isActive && (
         <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900/80 z-20">
           <Camera className="h-10 w-10 mb-2 opacity-50" />
           <p className="text-sm font-medium">Scanner Paused</p>
         </div>
      )}
      
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {isActive && (
        <>
          {/* Overlay mask */}
          <div className="absolute inset-0 z-10 pointer-events-none border-[40px] border-black/40" />
          
          {/* Scanning Box */}
          <div className="absolute inset-0 m-auto w-3/4 h-1/2 border-2 border-green-500 rounded z-20 pointer-events-none flex flex-col items-center justify-center">
             {/* Animated scanning line */}
             <div className="w-full h-0.5 bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
          </div>
          
          <div className="absolute bottom-4 left-0 w-full text-center z-20 pointer-events-none">
             <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full font-medium tracking-wide">
               Scanning...
             </span>
          </div>
        </>
      )}
    </div>
  );
}
