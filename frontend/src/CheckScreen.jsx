import React, { useState } from 'react';
import {
  QrCode,
  MessageSquare,
  Image as ImageIcon,
  Mic,
  Store,
  MapPin,
  Sparkles,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import CameraScannerModal from './CameraScannerModal';
import { checkQR, checkText, checkImage } from './api';

export default function CheckScreen({ onResultReceived, currentLang = 'en' }) {
  const [activeMode, setActiveMode] = useState('menu'); // 'menu' | 'message' | 'screenshot' | 'voice'
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [shopCode, setShopCode] = useState('KIR-0001');
  const [useLocation, setUseLocation] = useState(true);
  const [customLat, setCustomLat] = useState('17.384');
  const [customLng, setCustomLng] = useState('78.486');
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle QR scan decoded from camera or manual modal
  const handleQRScanned = async (qrPayload) => {
    setIsScannerOpen(false);
    setIsLoading(true);
    setErrorMsg('');

    try {
      const lat = useLocation ? parseFloat(customLat) : null;
      const lng = useLocation ? parseFloat(customLng) : null;
      const res = await checkQR(qrPayload, {
        lat,
        lng,
        shopCode: shopCode || null,
      });
      onResultReceived({ ...res, checkType: 'qr', rawInput: qrPayload });
    } catch (err) {
      setErrorMsg(err.message || 'Error checking QR code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle message check submission
  const handleMessageSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim()) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await checkText(messageText.trim());
      onResultReceived({ ...res, checkType: 'text', rawInput: messageText.trim() });
    } catch (err) {
      setErrorMsg(err.message || 'Error checking message.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle screenshot upload submission
  const handleImageSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const lat = useLocation ? parseFloat(customLat) : null;
      const lng = useLocation ? parseFloat(customLng) : null;
      const res = await checkImage(selectedFile, {
        lat,
        lng,
        shopCode: shopCode || null,
      });
      onResultReceived({
        ...res,
        checkType: 'image',
        rawInput: selectedFile.name,
      });
    } catch (err) {
      setErrorMsg(err.message || 'Error checking image.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    }
  };

  // Demo Presets for Section 11 quick walkthrough
  const applyPreset = (type) => {
    if (type === 'genuine_kir0001') {
      setShopCode('KIR-0001');
      setCustomLat('17.384');
      setCustomLng('78.486');
      handleQRScanned('upi://pay?pa=lakshmi.kirana@okaxis&pn=LakshmiStore&am=50.00');
    } else if (type === 'swapped_kir0001') {
      setShopCode('KIR-0001');
      setCustomLat('17.384');
      setCustomLng('78.486');
      handleQRScanned('upi://pay?pa=scammer.swap@ybl&pn=FakeSticker&mc=5411');
    } else if (type === 'lookalike_sbi') {
      setShopCode('');
      handleQRScanned('upi://pay?pa=sbi-support@oksbi&pn=SBIHelpDesk');
    } else if (type === 'digital_arrest') {
      const text =
        'URGENT POLICE NOTICE: CBI Digital Arrest warrant issued against you for illegal money laundering. Transfer penalty Rs 50,000 immediately to officer.cbi.investigation@okaxis or police will arrest you within 2 hours.';
      setMessageText(text);
      setActiveMode('message');
    } else if (type === 'legit_order') {
      const text =
        'Your Amazon package with tracking ID 482910 has been delivered. Thank you for shopping with us.';
      setMessageText(text);
      setActiveMode('message');
    }
  };

  return (
    <div className="space-y-6">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-paper/85 flex flex-col items-center justify-center p-6">
          <div className="bg-white border-flat shadow-flat p-8 max-w-sm w-full text-center space-y-4">
            <Loader2 className="w-12 h-12 text-terracotta animate-spin mx-auto" />
            <h3 className="text-2xl font-bold text-ink">Analyzing Payment</h3>
            <p className="text-base text-stone-600">
              Verifying against registered merchant registry and scanning for scam signals...
            </p>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="p-4 bg-verdict-danger-bg border-flat border-verdict-danger text-ink flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-verdict-danger shrink-0 mt-0.5" />
          <div className="text-base">
            <p className="font-bold">Check Failed</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Mode View: Menu / Main Action Buttons */}
      {activeMode === 'menu' && (
        <div className="space-y-6">
          {/* Main 4 Action Buttons */}
          <div className="grid grid-cols-1 gap-4">
            {/* 1. Scan QR */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="w-full p-5 bg-terracotta text-white border-flat shadow-flat hover:bg-terracotta-hover active:translate-y-1 active:shadow-none flex items-center gap-4 text-left group transition-all"
            >
              <div className="p-3 bg-white/20 border-flat border-white/40">
                <QrCode className="w-9 h-9 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-2xl font-bold block leading-tight">Scan Shop QR Code</span>
                <span className="text-base opacity-90 block mt-1">
                  Point camera at store counter QR to verify genuine merchant.
                </span>
              </div>
            </button>

            {/* 2. Check a message */}
            <button
              onClick={() => setActiveMode('message')}
              className="w-full p-5 bg-paper-dark text-ink border-flat shadow-flat hover:bg-white active:translate-y-1 active:shadow-none flex items-center gap-4 text-left group transition-all"
            >
              <div className="p-3 bg-stone-300 border-flat">
                <MessageSquare className="w-9 h-9 text-ink" />
              </div>
              <div className="flex-1">
                <span className="text-2xl font-bold block leading-tight">Check a Message</span>
                <span className="text-base text-stone-700 block mt-1">
                  Paste suspicious SMS, WhatsApp message, or digital arrest notice.
                </span>
              </div>
            </button>

            {/* 3. Upload screenshot */}
            <button
              onClick={() => setActiveMode('screenshot')}
              className="w-full p-5 bg-paper-dark text-ink border-flat shadow-flat hover:bg-white active:translate-y-1 active:shadow-none flex items-center gap-4 text-left group transition-all"
            >
              <div className="p-3 bg-stone-300 border-flat">
                <ImageIcon className="w-9 h-9 text-ink" />
              </div>
              <div className="flex-1">
                <span className="text-2xl font-bold block leading-tight">Upload Screenshot / Photo</span>
                <span className="text-base text-stone-700 block mt-1">
                  Upload an image of a QR code sticker or a payment chat screen.
                </span>
              </div>
            </button>

            {/* 4. Speak */}
            <button
              onClick={() => setActiveMode('voice')}
              className="w-full p-5 bg-paper-dark text-ink border-flat shadow-flat hover:bg-white active:translate-y-1 active:shadow-none flex items-center gap-4 text-left group transition-all"
            >
              <div className="p-3 bg-stone-300 border-flat">
                <Mic className="w-9 h-9 text-ink" />
              </div>
              <div className="flex-1">
                <span className="text-2xl font-bold block leading-tight">Speak Voice Note (Demo)</span>
                <span className="text-base text-stone-700 block mt-1">
                  Check audio note or spoken warning in Telugu / Hindi / English.
                </span>
              </div>
            </button>
          </div>

          {/* Location & Shop Code Settings Bar */}
          <div className="p-5 bg-white border-flat shadow-flat-sm space-y-3">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <Store className="w-5 h-5 text-terracotta" />
              <span>Registered Shop Binding (Optional)</span>
            </h3>
            <p className="text-base text-stone-700">
              Enter shop code if printed on merchant counter sticker (e.g.{' '}
              <span className="font-mono font-bold">KIR-0001</span>) to ensure QR matches registered
              owner.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-sm font-bold text-ink mb-1">Shop Code</label>
                <input
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value)}
                  placeholder="KIR-0001"
                  className="w-full p-2.5 font-mono text-base border-flat uppercase bg-paper"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink mb-1 flex items-center justify-between">
                  <span>Coarse GPS Cell</span>
                  <span className="text-xs text-stone-500 font-normal">3 decimals (~111m)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    placeholder="Lat 17.385"
                    className="w-1/2 p-2.5 font-mono text-base border-flat bg-paper"
                  />
                  <input
                    type="text"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                    placeholder="Lng 78.487"
                    className="w-1/2 p-2.5 font-mono text-base border-flat bg-paper"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Demo Scenario Presets */}
          <div className="p-5 bg-paper-dark border-flat space-y-3">
            <h3 className="text-base font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-terracotta" />
              <span>Section 11 Demo Presets (1-Click Test)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-base">
              <button
                onClick={() => applyPreset('genuine_kir0001')}
                className="p-3 bg-white border-flat text-left hover:bg-terracotta-light hover:border-terracotta font-medium transition-colors"
              >
                <span className="font-bold block text-verdict-verified">1. Real QR at KIR-0001</span>
                <span className="text-sm text-stone-600">Expected: VERIFIED green</span>
              </button>

              <button
                onClick={() => applyPreset('swapped_kir0001')}
                className="p-3 bg-white border-flat text-left hover:bg-verdict-danger-bg hover:border-verdict-danger font-medium transition-colors"
              >
                <span className="font-bold block text-verdict-danger">2. Swapped Sticker at KIR-0001</span>
                <span className="text-sm text-stone-600">Expected: DANGER + Merchant Alert</span>
              </button>

              <button
                onClick={() => applyPreset('digital_arrest')}
                className="p-3 bg-white border-flat text-left hover:bg-verdict-danger-bg hover:border-verdict-danger font-medium transition-colors"
              >
                <span className="font-bold block text-verdict-danger">3. CBI Digital Arrest Scam</span>
                <span className="text-sm text-stone-600">Expected: Flags payee in DB</span>
              </button>

              <button
                onClick={() => applyPreset('lookalike_sbi')}
                className="p-3 bg-white border-flat text-left hover:bg-verdict-danger-bg hover:border-verdict-danger font-medium transition-colors"
              >
                <span className="font-bold block text-verdict-danger">4. Typo Lookalike (sbi-support)</span>
                <span className="text-sm text-stone-600">Expected: DANGER impersonation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode View: Message Input Screen */}
      {activeMode === 'message' && (
        <div className="bg-white border-flat shadow-flat p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-stone-200 pb-3">
            <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
              <MessageSquare className="w-7 h-7 text-terracotta" />
              <span>Check Suspicious Message</span>
            </h2>
            <button
              onClick={() => setActiveMode('menu')}
              className="text-base font-bold text-stone-600 hover:text-ink underline"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleMessageSubmit} className="space-y-4">
            <div>
              <label className="block text-base font-bold text-ink mb-1">
                Paste SMS, WhatsApp message, or payment demand:
              </label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={5}
                className="w-full p-3 text-lg border-flat bg-paper text-ink focus:outline-none"
                placeholder="e.g. Your electricity bill unpaid. Call 9876543210 or install Bill_Update.apk to avoid power cut..."
              />
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="font-bold text-stone-700 py-1">Quick Sample:</span>
              <button
                type="button"
                onClick={() => applyPreset('digital_arrest')}
                className="px-2.5 py-1 bg-paper border-flat text-stone-800 hover:bg-terracotta-light"
              >
                Digital Arrest Scam
              </button>
              <button
                type="button"
                onClick={() => applyPreset('legit_order')}
                className="px-2.5 py-1 bg-paper border-flat text-stone-800 hover:bg-terracotta-light"
              >
                Harmless Order Note
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={!messageText.trim()}
                className="flex-1 py-3.5 bg-terracotta text-white font-bold text-xl border-flat shadow-flat-sm hover:bg-terracotta-hover active:translate-y-0.5 active:shadow-none disabled:opacity-50"
              >
                Analyze Message
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('menu')}
                className="px-5 py-3.5 bg-paper-dark text-ink font-bold border-flat hover:bg-stone-300"
              >
                Back
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mode View: Screenshot Upload Screen */}
      {activeMode === 'screenshot' && (
        <div className="bg-white border-flat shadow-flat p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-stone-200 pb-3">
            <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
              <ImageIcon className="w-7 h-7 text-terracotta" />
              <span>Upload Screenshot or QR Image</span>
            </h2>
            <button
              onClick={() => setActiveMode('menu')}
              className="text-base font-bold text-stone-600 hover:text-ink underline"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleImageSubmit} className="space-y-4">
            <div>
              <label className="block text-base font-bold text-ink mb-2">
                Choose an image file (PNG / JPEG):
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-base border-flat p-2 bg-paper file:mr-4 file:py-2 file:px-4 file:border-flat file:bg-terracotta file:text-white file:font-bold hover:file:bg-terracotta-hover cursor-pointer"
              />
            </div>

            {filePreview && (
              <div className="border-flat p-2 bg-paper flex items-center justify-center max-h-64 overflow-hidden">
                <img src={filePreview} alt="Upload preview" className="max-h-60 object-contain" />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={!selectedFile}
                className="flex-1 py-3.5 bg-terracotta text-white font-bold text-xl border-flat shadow-flat-sm hover:bg-terracotta-hover active:translate-y-0.5 active:shadow-none disabled:opacity-50"
              >
                Scan Image
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('menu')}
                className="px-5 py-3.5 bg-paper-dark text-ink font-bold border-flat hover:bg-stone-300"
              >
                Back
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mode View: Voice Note Demo Screen */}
      {activeMode === 'voice' && (
        <div className="bg-white border-flat shadow-flat p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-stone-200 pb-3">
            <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
              <Mic className="w-7 h-7 text-terracotta" />
              <span>Spoken Voice Note Check</span>
            </h2>
            <button
              onClick={() => setActiveMode('menu')}
              className="text-base font-bold text-stone-600 hover:text-ink underline"
            >
              Cancel
            </button>
          </div>

          <p className="text-base text-stone-700">
            For elderly and first-time smartphone users who receive suspicious phone calls or voice
            notes, QRaksha-Kavach transcribes voice content and extracts payment risk.
          </p>

          <div className="p-4 bg-paper border-flat space-y-3">
            <span className="font-bold text-sm uppercase text-stone-600 block">
              Demo Sample Voice Note (Telugu / English):
            </span>
            <p className="font-mono text-base bg-white p-3 border-flat">
              "మీ విద్యుత్ బిల్లు చెల్లించలేదు. వెంటనే 9848022338 కి కాల్ చేయండి లేదా మీ కనెక్షన్
              కట్ చేయబడుతుంది."
            </p>
            <p className="text-sm text-stone-600">
              (English: "Your electricity bill is unpaid. Call 9848022338 immediately or power will
              be disconnected.")
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setMessageText(
                  'Your electricity bill unpaid. Call 9848022338 immediately or power disconnected.'
                );
                setActiveMode('message');
              }}
              className="flex-1 py-3.5 bg-terracotta text-white font-bold text-xl border-flat shadow-flat-sm hover:bg-terracotta-hover active:translate-y-0.5 active:shadow-none"
            >
              Analyze This Voice Message
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('menu')}
              className="px-5 py-3.5 bg-paper-dark text-ink font-bold border-flat hover:bg-stone-300"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Camera QR Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleQRScanned}
      />
    </div>
  );
}
