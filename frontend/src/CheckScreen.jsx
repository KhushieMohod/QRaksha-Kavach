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
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Volume2,
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
  const [showLocationSettings, setShowLocationSettings] = useState(false);

  // Shop names map for quick UX hint
  const shopNames = {
    'KIR-0001': 'Sri Lakshmi Kirana Store (Charminar)',
    'KIR-0002': 'Balaji Provision Store (Begum Bazar)',
    'KIR-0003': 'Sri Krishna General Store (Ameerpet)',
    'KIR-0004': 'Venkateshwara Traders (Dilsukhnagar)',
    'KIR-0005': 'Sai Ram Kirana & General (Kukatpally)',
  };

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
    } else if (type === 'electricity_bill') {
      const text =
        'Dear Customer, Your electricity power will be disconnected tonight at 9:30 PM because your previous month bill was unpaid. Contact officer immediately on 9848022338.';
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
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-6">
          <div className="bg-paper border-flat shadow-flat-lg p-6 max-w-sm w-full text-center space-y-4">
            <div className="w-14 h-14 bg-terracotta/10 border-flat border-terracotta mx-auto flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-terracotta animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">Analyzing Payment Safety</h3>
              <p className="text-sm text-ink-muted mt-1">
                Checking registered merchant counter registry and scanning for scam signals...
              </p>
            </div>
            <div className="h-1.5 w-full bg-paper-dark border border-ink overflow-hidden">
              <div className="h-full bg-terracotta animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="p-4 bg-verdict-danger-bg border-flat border-verdict-danger text-ink flex items-start gap-3 shadow-flat-sm">
          <AlertTriangle className="w-5 h-5 text-verdict-danger shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-verdict-danger">Check Failed</p>
            <p className="text-ink">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Mode View: Menu / Main Action Buttons */}
      {activeMode === 'menu' && (
        <div className="space-y-5">
          {/* Hero Scan Action Card */}
          <div className="bg-paper-cream p-5 sm:p-6 border-flat shadow-flat relative overflow-hidden">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <span className="text-xs font-mono font-bold tracking-wider uppercase text-terracotta bg-terracotta-light border border-terracotta px-2.5 py-0.5 inline-block">
                  Primary Defense
                </span>
                <span className="text-xs text-stone-500 font-mono flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-forest" />
                  <span>Cell: {customLat}, {customLng}</span>
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-ink leading-tight">
                  Verify Store Counter QR
                </h2>
                <p className="text-sm sm:text-base text-ink-muted mt-1">
                  Scan the shopkeeper's counter sticker to confirm it matches the registered merchant and hasn't been swapped.
                </p>
              </div>

              {/* Primary Scan Button */}
              <button
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-4 px-6 bg-terracotta text-white font-extrabold text-lg sm:text-xl border-flat shadow-flat hover:bg-terracotta-hover btn-tactile flex items-center justify-center gap-3 select-none"
              >
                <QrCode className="w-7 h-7 shrink-0" />
                <span>Open QR Camera Scanner</span>
              </button>
            </div>
          </div>

          {/* Secondary Inspection Grid (3 Modes) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Check a message */}
            <button
              onClick={() => setActiveMode('message')}
              className="p-4 bg-white border-flat shadow-flat-sm hover:bg-paper-cream btn-tactile flex sm:flex-col items-center sm:items-start gap-3 text-left transition-all"
            >
              <div className="p-2.5 bg-paper-dark border-flat shrink-0">
                <MessageSquare className="w-6 h-6 text-ink" />
              </div>
              <div className="flex-1">
                <span className="text-base font-bold text-ink block leading-tight">
                  Check Message
                </span>
                <span className="text-xs text-ink-muted block mt-0.5">
                  SMS, WhatsApp, or extortion threats.
                </span>
              </div>
            </button>

            {/* 2. Upload screenshot */}
            <button
              onClick={() => setActiveMode('screenshot')}
              className="p-4 bg-white border-flat shadow-flat-sm hover:bg-paper-cream btn-tactile flex sm:flex-col items-center sm:items-start gap-3 text-left transition-all"
            >
              <div className="p-2.5 bg-paper-dark border-flat shrink-0">
                <ImageIcon className="w-6 h-6 text-ink" />
              </div>
              <div className="flex-1">
                <span className="text-base font-bold text-ink block leading-tight">
                  Upload Photo
                </span>
                <span className="text-xs text-ink-muted block mt-0.5">
                  QR sticker photo or payment screen.
                </span>
              </div>
            </button>

            {/* 3. Speak Voice Note */}
            <button
              onClick={() => setActiveMode('voice')}
              className="p-4 bg-white border-flat shadow-flat-sm hover:bg-paper-cream btn-tactile flex sm:flex-col items-center sm:items-start gap-3 text-left transition-all"
            >
              <div className="p-2.5 bg-paper-dark border-flat shrink-0">
                <Mic className="w-6 h-6 text-ink" />
              </div>
              <div className="flex-1">
                <span className="text-base font-bold text-ink block leading-tight">
                  Voice Note Check
                </span>
                <span className="text-xs text-ink-muted block mt-0.5">
                  Telugu / Hindi / English spoken audio.
                </span>
              </div>
            </button>
          </div>

          {/* Quick 1-Click Demo Presets Bar */}
          <div className="p-4 sm:p-5 bg-paper-dark border-flat space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-terracotta" />
                <span>1-Click Test Scenarios (Section 11)</span>
              </h3>
              <span className="text-xs text-stone-500 font-mono font-medium">Demo Ready</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <button
                onClick={() => applyPreset('genuine_kir0001')}
                className="p-3 bg-white border-flat text-left hover:border-forest hover:bg-forest-subtle btn-tactile transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-ink">1. Real QR at KIR-0001</span>
                  <span className="text-xs font-mono font-bold px-1.5 py-0.2 bg-verdict-verified-bg text-verdict-verified border border-verdict-verified">
                    VERIFIED
                  </span>
                </div>
                <span className="text-xs text-stone-600 block">
                  lakshmi.kirana@okaxis (genuine counter sticker)
                </span>
              </button>

              <button
                onClick={() => applyPreset('swapped_kir0001')}
                className="p-3 bg-white border-flat text-left hover:border-verdict-danger hover:bg-verdict-danger-bg btn-tactile transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-verdict-danger">2. Swapped Sticker Attack</span>
                  <span className="text-xs font-mono font-bold px-1.5 py-0.2 bg-verdict-danger-bg text-verdict-danger border border-verdict-danger">
                    DANGER
                  </span>
                </div>
                <span className="text-xs text-stone-600 block">
                  scammer.swap@ybl placed at KIR-0001 counter
                </span>
              </button>

              <button
                onClick={() => applyPreset('digital_arrest')}
                className="p-3 bg-white border-flat text-left hover:border-verdict-danger hover:bg-verdict-danger-bg btn-tactile transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-ink">3. Digital Arrest Threat</span>
                  <span className="text-xs font-mono font-bold px-1.5 py-0.2 bg-verdict-danger-bg text-verdict-danger border border-verdict-danger">
                    FLAGS PAYEE
                  </span>
                </div>
                <span className="text-xs text-stone-600 block">
                  Extortion message linking officer.cbi@okaxis
                </span>
              </button>

              <button
                onClick={() => applyPreset('lookalike_sbi')}
                className="p-3 bg-white border-flat text-left hover:border-verdict-danger hover:bg-verdict-danger-bg btn-tactile transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-ink">4. Typo Lookalike Handle</span>
                  <span className="text-xs font-mono font-bold px-1.5 py-0.2 bg-verdict-danger-bg text-verdict-danger border border-verdict-danger">
                    DANGER
                  </span>
                </div>
                <span className="text-xs text-stone-600 block">
                  sbi-support@oksbi (phishing bank handle)
                </span>
              </button>
            </div>
          </div>

          {/* Collapsible Location & Shop Binding Settings */}
          <div className="border-flat bg-white overflow-hidden shadow-flat-sm">
            <button
              onClick={() => setShowLocationSettings(!showLocationSettings)}
              className="w-full p-4 flex items-center justify-between text-left font-bold text-sm sm:text-base bg-paper-cream hover:bg-paper-dark transition-colors"
            >
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-terracotta" />
                <span>Registered Shop Binding & Coarse GPS Cell</span>
                <span className="text-xs font-mono bg-paper border-flat px-2 py-0.5 text-ink">
                  {shopCode || 'Unbound'}
                </span>
              </div>
              {showLocationSettings ? (
                <ChevronUp className="w-5 h-5 text-stone-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-stone-600" />
              )}
            </button>

            {showLocationSettings && (
              <div className="p-4 sm:p-5 space-y-4 border-t-2 border-ink bg-white text-sm">
                <p className="text-stone-700 text-xs sm:text-sm">
                  Stores print their unique Shop Code (e.g. <span className="font-mono font-bold">KIR-0001</span>) on counter stickers. When provided, QRaksha-Kavach validates that the QR payment handle belongs to this registered shop.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1 uppercase tracking-wide">
                      Shop Code
                    </label>
                    <input
                      type="text"
                      value={shopCode}
                      onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                      placeholder="e.g. KIR-0001"
                      className="w-full p-2.5 font-mono text-sm border-flat uppercase bg-paper text-ink"
                    />
                    {shopNames[shopCode] && (
                      <span className="text-xs text-forest font-bold block mt-1">
                        ✓ {shopNames[shopCode]}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1 uppercase tracking-wide flex items-center justify-between">
                      <span>Coarse GPS Cell</span>
                      <span className="text-[11px] text-stone-500 font-normal">3 decimals (~111m)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customLat}
                        onChange={(e) => setCustomLat(e.target.value)}
                        placeholder="Lat"
                        className="w-1/2 p-2.5 font-mono text-sm border-flat bg-paper text-ink"
                      />
                      <input
                        type="text"
                        value={customLng}
                        onChange={(e) => setCustomLng(e.target.value)}
                        placeholder="Lng"
                        className="w-1/2 p-2.5 font-mono text-sm border-flat bg-paper text-ink"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-paper border border-stone-300 text-xs text-stone-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-forest shrink-0" />
                  <span>
                    Privacy Shield: Coordinates are truncated to 3 decimals (~111m grid). Exact GPS is never stored.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode View: Message Input Screen */}
      {activeMode === 'message' && (
        <div className="bg-white border-flat shadow-flat p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-stone-200 pb-3">
            <h2 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-terracotta" />
              <span>Check Suspicious Message</span>
            </h2>
            <button
              onClick={() => setActiveMode('menu')}
              className="text-sm font-bold text-stone-600 hover:text-ink underline"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleMessageSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-ink mb-1">
                Paste SMS, WhatsApp text, or payment demand:
              </label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={5}
                className="w-full p-3 text-base border-flat bg-paper text-ink focus:outline-none leading-relaxed"
                placeholder="e.g. URGENT POLICE NOTICE: CBI Digital Arrest warrant issued against you... or Your electricity bill unpaid. Call 9848022338..."
              />
              <div className="flex justify-between items-center text-xs text-stone-500 mt-1">
                <span>Dual-layer evaluation: Hardcoded regex rules + fallback offline detection</span>
                <span>{messageText.length} chars</span>
              </div>
            </div>

            {/* Quick test message chips */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-stone-700 uppercase">Quick Test Samples:</span>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => applyPreset('digital_arrest')}
                  className="px-2.5 py-1.5 bg-paper-dark border-flat font-bold text-ink hover:bg-verdict-danger-bg hover:border-verdict-danger transition-colors"
                >
                  🚨 CBI Digital Arrest Scam
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('electricity_bill')}
                  className="px-2.5 py-1.5 bg-paper-dark border-flat font-bold text-ink hover:bg-verdict-caution-bg hover:border-ochre transition-colors"
                >
                  ⚡ Electricity Bill Disconnection
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('legit_order')}
                  className="px-2.5 py-1.5 bg-paper-dark border-flat font-bold text-ink hover:bg-verdict-verified-bg hover:border-forest transition-colors"
                >
                  📦 Legitimate Delivery Notice
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={!messageText.trim()}
                className="flex-1 py-3.5 bg-terracotta text-white font-bold text-lg border-flat shadow-flat-sm hover:bg-terracotta-hover btn-tactile disabled:opacity-50"
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
        <div className="bg-white border-flat shadow-flat p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-stone-200 pb-3">
            <h2 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-terracotta" />
              <span>Upload QR Screenshot or Photo</span>
            </h2>
            <button
              onClick={() => setActiveMode('menu')}
              className="text-sm font-bold text-stone-600 hover:text-ink underline"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleImageSubmit} className="space-y-4">
            <div className="border-2 border-dashed border-stone-400 p-6 text-center bg-paper hover:bg-paper-cream transition-colors">
              <label className="cursor-pointer block space-y-2">
                <ImageIcon className="w-10 h-10 text-terracotta mx-auto" />
                <span className="block font-bold text-base text-ink">
                  Click to select image (PNG / JPG)
                </span>
                <span className="block text-xs text-stone-500">
                  Dual-pass OpenCV QR decoding & Tesseract OCR
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {filePreview && (
              <div className="border-flat p-2 bg-paper flex flex-col items-center justify-center">
                <img
                  src={filePreview}
                  alt="Upload preview"
                  className="max-h-56 object-contain border border-stone-300"
                />
                <span className="text-xs font-mono text-stone-600 mt-1">
                  {selectedFile?.name} ({(selectedFile?.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={!selectedFile}
                className="flex-1 py-3.5 bg-terracotta text-white font-bold text-lg border-flat shadow-flat-sm hover:bg-terracotta-hover btn-tactile disabled:opacity-50"
              >
                Scan & Extract Signals
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
        <div className="bg-white border-flat shadow-flat p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-stone-200 pb-3">
            <h2 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
              <Mic className="w-6 h-6 text-terracotta" />
              <span>Spoken Voice Note Triage</span>
            </h2>
            <button
              onClick={() => setActiveMode('menu')}
              className="text-sm font-bold text-stone-600 hover:text-ink underline"
            >
              Cancel
            </button>
          </div>

          <p className="text-sm sm:text-base text-stone-700">
            For senior citizens and vernacular speakers who receive audio notes or suspicious phone calls, QRaksha-Kavach transcribes regional speech and inspects payment fraud indicators.
          </p>

          <div className="p-4 bg-paper-cream border-flat space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase text-terracotta tracking-wide flex items-center gap-1.5">
                <Volume2 className="w-4 h-4" />
                <span>Spoken Sample (Telugu Threat Voice Note):</span>
              </span>
              <span className="text-xs font-mono bg-paper border px-1.5 py-0.5">Telugu + English</span>
            </div>

            <p className="font-mono text-sm sm:text-base bg-white p-3 border-flat text-ink leading-relaxed">
              "మీ విద్యుత్ బిల్లు చెల్లించలేదు. వెంటనే 9848022338 కి కాల్ చేయండి లేదా మీ కనెక్షన్ కట్ చేయబడుతుంది."
            </p>
            <p className="text-xs text-stone-600 italic">
              (English translation: "Your electricity bill is unpaid. Call 9848022338 immediately or your connection will be disconnected.")
            </p>

            {/* Audio Wave Visualizer Simulation */}
            <div className="flex items-center justify-center gap-1 py-2 bg-stone-100 border border-stone-300">
              <div className="w-1.5 bg-terracotta animate-wave-1"></div>
              <div className="w-1.5 bg-terracotta animate-wave-2"></div>
              <div className="w-1.5 bg-terracotta animate-wave-3"></div>
              <div className="w-1.5 bg-terracotta animate-wave-1"></div>
              <div className="w-1.5 bg-terracotta animate-wave-2"></div>
              <div className="w-1.5 bg-terracotta animate-wave-3"></div>
              <span className="text-xs font-mono text-stone-600 ml-2">Voice Waveform Ready</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setMessageText(
                  'Your electricity bill unpaid. Call 9848022338 immediately or power disconnected.'
                );
                setActiveMode('message');
              }}
              className="flex-1 py-3.5 bg-terracotta text-white font-bold text-lg border-flat shadow-flat-sm hover:bg-terracotta-hover btn-tactile"
            >
              Analyze Spoken Voice Note
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
