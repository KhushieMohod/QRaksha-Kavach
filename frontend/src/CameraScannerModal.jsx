import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Keyboard, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

export default function CameraScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [manualPayload, setManualPayload] = useState('upi://pay?pa=lakshmi.kirana@okaxis&pn=LakshmiStore&am=50.00');
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef(null);
  const isRunningRef = useRef(false);

  // Quick preset payloads for fast testing
  const presets = [
    {
      label: 'Genuine Kirana (KIR-0001)',
      payload: 'upi://pay?pa=lakshmi.kirana@okaxis&pn=LakshmiStore&am=50.00',
    },
    {
      label: 'Swapped Sticker (Scammer)',
      payload: 'upi://pay?pa=scammer.swap@ybl&pn=FakeSticker&mc=5411',
    },
    {
      label: 'Lookalike Handle (sbi-support)',
      payload: 'upi://pay?pa=sbi-support@oksbi&pn=SBIHelpDesk',
    },
    {
      label: 'Extortion Payee (CBI Impersonation)',
      payload: 'upi://pay?pa=officer.cbi.investigation@okaxis&pn=CBIAlert',
    },
  ];

  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') {
      stopScanner();
      return;
    }

    const html5QrCode = new Html5Qrcode('qr-reader-container');
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          stopScanner().then(() => {
            onScanSuccess(decodedText);
          });
        },
        () => {
          // Ignore per-frame decode errors
        }
      )
      .then(() => {
        isRunningRef.current = true;
        setErrorMsg('');
      })
      .catch((err) => {
        console.warn('Camera failed to start:', err);
        setErrorMsg('Camera access is unavailable on this device. Use the Manual Input tab below to test any QR payload.');
        setActiveTab('manual');
      });

    return () => {
      stopScanner();
    };
  }, [isOpen, activeTab]);

  const stopScanner = async () => {
    if (scannerRef.current && isRunningRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        // Ignored
      }
      isRunningRef.current = false;
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualPayload.trim()) return;
    onScanSuccess(manualPayload.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-paper border-flat shadow-flat-lg w-full max-w-md p-5 sm:p-6 relative rounded-none">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-paper-dark border-flat hover:bg-terracotta hover:text-white transition-colors"
          aria-label="Close scanner"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl sm:text-2xl font-bold text-ink mb-3 flex items-center gap-2">
          <Camera className="w-6 h-6 text-terracotta" />
          <span>Scan Store Counter QR</span>
        </h2>

        {/* Tab switcher */}
        <div className="flex border-flat mb-4 bg-paper-dark text-sm font-bold">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 font-bold text-center flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'camera' ? 'bg-terracotta text-white' : 'text-ink hover:bg-paper'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Camera Viewfinder</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 font-bold text-center flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'manual' ? 'bg-terracotta text-white' : 'text-ink hover:bg-paper'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Manual Payload</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-verdict-caution-bg border-flat border-ochre text-ink text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-ochre shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Live Camera Viewfinder */}
        {activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="relative border-flat bg-stone-900 rounded-none overflow-hidden aspect-square flex items-center justify-center">
              <div id="qr-reader-container" className="w-full h-full"></div>

              {/* Viewfinder Target Reticle Frame Overlay */}
              <div className="absolute inset-8 pointer-events-none border border-white/30 flex flex-col justify-between p-2">
                {/* Laser scan animation */}
                <div className="absolute left-2 right-2 h-0.5 bg-terracotta shadow-[0_0_8px_#C05621] animate-laser"></div>

                {/* 4 Corner brackets */}
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-4 border-l-4 border-terracotta"></div>
                  <div className="w-6 h-6 border-t-4 border-r-4 border-terracotta"></div>
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-4 border-l-4 border-terracotta"></div>
                  <div className="w-6 h-6 border-b-4 border-r-4 border-terracotta"></div>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-stone-600 font-mono">
              Align counter QR sticker within the viewfinder target box.
            </p>
          </div>
        )}

        {/* Tab 2: Manual Payload Input */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-ink mb-1">
                Paste UPI QR URL / String:
              </label>
              <textarea
                value={manualPayload}
                onChange={(e) => setManualPayload(e.target.value)}
                rows={3}
                className="w-full p-2.5 font-mono text-sm border-flat bg-white text-ink focus:outline-none"
                placeholder="upi://pay?pa=shop@bank&pn=ShopName..."
              />
            </div>

            {/* Quick 1-click test buttons */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-stone-600 uppercase flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-terracotta" />
                <span>Quick Test Payloads:</span>
              </span>
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setManualPayload(p.payload)}
                    className="p-2 bg-paper-dark border-flat text-left hover:bg-terracotta-light hover:border-terracotta flex items-center justify-between transition-colors"
                  >
                    <span className="font-bold text-ink">{p.label}</span>
                    <span className="font-mono text-stone-600 truncate max-w-[160px]">
                      {p.payload.replace('upi://pay?', '')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-terracotta text-white font-bold text-base border-flat shadow-flat-sm hover:bg-terracotta-hover active:translate-y-0.5"
            >
              Verify This QR Code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
