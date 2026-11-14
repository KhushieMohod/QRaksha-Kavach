import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Keyboard, AlertCircle } from 'lucide-react';

export default function CameraScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [manualPayload, setManualPayload] = useState('upi://pay?pa=charminar.kirana@okaxis&pn=CharminarStore&am=50.00');
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef(null);
  const isRunningRef = useRef(false);

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
        { fps: 10, qrbox: { width: 250, height: 250 } },
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
        setErrorMsg('Camera access unavailable or blocked. You can paste the QR payload below.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-paper border-flat shadow-flat w-full max-w-md p-6 relative rounded-none">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-paper-dark border-flat hover:bg-terracotta-light"
          aria-label="Close scanner"
        >
          <X className="w-6 h-6 text-ink" />
        </button>

        <h2 className="text-2xl font-bold text-ink mb-3 flex items-center gap-2">
          <Camera className="w-7 h-7 text-terracotta" />
          <span>Scan UPI QR Code</span>
        </h2>

        {/* Tab switcher */}
        <div className="flex border-flat mb-4 bg-paper-dark">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 font-bold text-center flex items-center justify-center gap-2 ${
              activeTab === 'camera' ? 'bg-terracotta text-white' : 'text-ink hover:bg-paper'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span>Camera</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 font-bold text-center flex items-center justify-center gap-2 ${
              activeTab === 'manual' ? 'bg-terracotta text-white' : 'text-ink hover:bg-paper'
            }`}
          >
            <Keyboard className="w-5 h-5" />
            <span>Paste URI</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-verdict-caution-bg border-flat border-verdict-caution text-ink flex items-start gap-2 text-base">
            <AlertCircle className="w-5 h-5 text-verdict-caution shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {activeTab === 'camera' ? (
          <div>
            <div
              id="qr-reader-container"
              className="w-full h-64 bg-stone-900 border-flat overflow-hidden flex items-center justify-center"
            ></div>
            <p className="text-center text-sm text-stone-600 mt-2">
              Point camera at Kirana UPI QR code to scan instantly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-ink mb-1">
                UPI QR String / Payload
              </label>
              <textarea
                value={manualPayload}
                onChange={(e) => setManualPayload(e.target.value)}
                rows={4}
                className="w-full p-3 font-mono text-base border-flat bg-white text-ink focus:outline-none"
                placeholder="upi://pay?pa=name@okaxis&pn=ShopName..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="w-full py-3 bg-terracotta text-white font-bold border-flat shadow-flat-sm hover:bg-terracotta-hover active:translate-y-0.5 active:shadow-none"
              >
                Check This QR Code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
