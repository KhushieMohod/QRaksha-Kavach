import React, { useEffect, useState } from 'react';
import {
  QrCode,
  MessageSquare,
  Image as ImageIcon,
  Mic,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Upload,
  Volume2,
  ArrowLeft,
} from 'lucide-react';
import CameraScannerModal from './CameraScannerModal';
import { checkQR, checkText, checkImage } from './api';
import { translate } from './i18n';

export default function CheckScreen({ onResultReceived, lang = 'en' }) {
  const t = (key, vals) => translate(lang, key, vals);

  const [mode, setMode] = useState('overview'); // 'overview' | 'message' | 'screenshot' | 'voice'
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [shopCode, setShopCode] = useState('KIR-0001');
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Escape Key Listener to Return to Overview ─────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mode !== 'overview') {
        setMode('overview');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  // Default coarse coordinates for pilot shops (17.384, 78.486)
  const defaultLat = 17.384;
  const defaultLng = 78.486;

  const callAPI = async (apiFn, extraData) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFn();
      onResultReceived({ ...res, ...extraData });
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Please check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQRScanned = (payload) => {
    setIsScannerOpen(false);
    callAPI(
      () => checkQR(payload, { lat: defaultLat, lng: defaultLng, shopCode: shopCode.trim() || null }),
      { checkType: 'qr', rawInput: payload }
    );
  };

  const handleMessageSubmit = (e) => {
    e?.preventDefault();
    if (!messageText.trim()) return;
    callAPI(
      () => checkText(messageText.trim()),
      { checkType: 'text', rawInput: messageText.trim() }
    );
  };

  const handleImageSubmit = (e) => {
    e?.preventDefault();
    if (!selectedFile) return;
    callAPI(
      () => checkImage(selectedFile, { lat: defaultLat, lng: defaultLng, shopCode: shopCode.trim() || null }),
      { checkType: 'image', rawInput: selectedFile.name }
    );
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelectedFile(f);
    setFilePreview(URL.createObjectURL(f));
  };

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Welcoming Hero Section ────────────────────────────────────────── */}
      <section className="text-center md:text-left space-y-2 pt-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
          {lang === 'te'
            ? 'చెల్లించే ముందు తనిఖీ చేయండి'
            : lang === 'hi'
            ? 'भुगतान से पहले जांचें'
            : 'Check before you pay'}
        </h1>
        <p className="text-lg sm:text-xl text-ink-secondary max-w-2xl">
          {lang === 'te'
            ? 'దుకాణం QR కోడ్, అనుమానాస్పద సందేశం లేదా స్క్రీన్‌షాట్‌ను క్షణాల్లో తనిఖీ చేయండి.'
            : lang === 'hi'
            ? 'दुकान का QR कोड, संदिग्ध संदेश या स्क्रीनशॉट कुछ ही सेकंड में जांचें।'
            : 'Verify a shop QR code, message, or screenshot in seconds.'}
        </p>
      </section>

      {/* ── Error Notification ────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-danger-bg border border-danger-border flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div className="text-base text-danger-dark font-medium">
            {errorMsg}
          </div>
        </div>
      )}

      {/* ── Loading Overlay ───────────────────────────────────────────────── */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-surface rounded-2xl border border-hairline shadow-lg p-8 max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-spruce-subtle flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-spruce animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">
                {t('Analyzing Payment Safety')}
              </h2>
              <p className="text-base text-ink-secondary mt-1">
                {t('Checking registered merchant counter registry and scanning for scam signals...')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── OVERVIEW MODE: Primary Action + Secondary Cards ───────────────── */}
      {mode === 'overview' && (
        <div className="space-y-6">

          {/* Primary Action Card: Scan Store QR */}
          <div className="card space-y-5 bg-gradient-to-br from-white to-[#F9F7F2]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold bg-spruce-subtle text-spruce">
                  <Shield className="w-4 h-4" />
                  <span>
                    {lang === 'te' ? 'కౌంటర్ QR రక్షణ' : lang === 'hi' ? 'काउंटर QR सुरक्षा' : 'Counter QR Protection'}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-ink">
                  {t('Verify Store Counter QR')}
                </h2>
                <p className="text-base sm:text-lg text-ink-secondary leading-relaxed">
                  {t("Scan the shopkeeper's counter sticker to confirm it matches the registered merchant and hasn't been swapped.")}
                </p>
              </div>

              {/* Scan Button */}
              <button
                onClick={() => setIsScannerOpen(true)}
                className="btn-primary text-lg sm:text-xl px-8 py-4 shrink-0 shadow-md flex items-center justify-center gap-3"
              >
                <QrCode className="w-6 h-6" />
                <span>{t('Open QR Camera Scanner')}</span>
              </button>
            </div>

            {/* Optional Shop Code Input */}
            <div className="pt-4 border-t border-hairline/80 flex flex-col sm:flex-row sm:items-center gap-3">
              <label htmlFor="shopCodeInput" className="text-base font-medium text-ink-secondary shrink-0">
                {lang === 'te'
                  ? 'దుకాణం కోడ్ (ఐచ్ఛికం):'
                  : lang === 'hi'
                  ? 'दुकान कोड (वैकल्पिक):'
                  : 'Shop Code (Optional):'}
              </label>
              <div className="flex-1 max-w-xs">
                <input
                  id="shopCodeInput"
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                  placeholder="e.g. KIR-0001"
                  className="input font-mono uppercase text-base py-2.5"
                />
              </div>
              <span className="text-sm text-ink-muted">
                {lang === 'te'
                  ? 'కౌంటర్ స్టిక్కర్‌పై ఉన్న కోడ్‌తో సరిపోల్చుతుంది.'
                  : lang === 'hi'
                  ? 'काउंटर स्टिकर पर छपे कोड से जांचता है।'
                  : 'Validates payee against shop code on counter standee.'}
              </span>
            </div>
          </div>

          {/* 3 Secondary Action Cards Grid */}
          <div>
            <h2 className="text-xl font-bold text-ink mb-4">
              {lang === 'te' ? 'ఇతర తనిఖీ మార్గాలు' : lang === 'hi' ? 'अन्य जांच विकल्प' : 'Other Ways to Verify'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Card 1: Check Message */}
              <div
                onClick={() => setMode('message')}
                className="card-interactive flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-canvas border border-hairline flex items-center justify-center text-spruce group-hover:bg-spruce group-hover:text-white transition-colors">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-ink">
                    {t('Check Message')}
                  </h3>
                  <p className="text-base text-ink-secondary leading-relaxed">
                    {t('SMS, WhatsApp, or extortion threats.')}
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-hairline flex items-center text-spruce font-semibold text-base group-hover:translate-x-1 transition-transform">
                  <span>{lang === 'te' ? 'సందేశం తనిఖీ' : lang === 'hi' ? 'संदेश जांचें' : 'Paste Text'}</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </div>
              </div>

              {/* Card 2: Upload Screenshot */}
              <div
                onClick={() => setMode('screenshot')}
                className="card-interactive flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-canvas border border-hairline flex items-center justify-center text-spruce group-hover:bg-spruce group-hover:text-white transition-colors">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-ink">
                    {t('Upload Photo')}
                  </h3>
                  <p className="text-base text-ink-secondary leading-relaxed">
                    {t('QR sticker photo or payment screen.')}
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-hairline flex items-center text-spruce font-semibold text-base group-hover:translate-x-1 transition-transform">
                  <span>{lang === 'te' ? 'ఫోటో అప్‌లోడ్' : lang === 'hi' ? 'फ़ोटो अपलोड' : 'Upload Image'}</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </div>
              </div>

              {/* Card 3: Voice Note */}
              <div
                onClick={() => setMode('voice')}
                className="card-interactive flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-canvas border border-hairline flex items-center justify-center text-spruce group-hover:bg-spruce group-hover:text-white transition-colors">
                    <Mic className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-ink">
                    {t('Voice Note Check')}
                  </h3>
                  <p className="text-base text-ink-secondary leading-relaxed">
                    {t('Telugu / Hindi / English spoken audio.')}
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-hairline flex items-center text-spruce font-semibold text-base group-hover:translate-x-1 transition-transform">
                  <span>{lang === 'te' ? 'ఆడియో పరీక్ష' : lang === 'hi' ? 'ऑडियो जांच' : 'Check Audio'}</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ── MODE: Check a Message ─────────────────────────────────────────── */}
      {mode === 'message' && (
        <div className="card space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-hairline">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-spruce-subtle flex items-center justify-center text-spruce">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-ink">
                  {t('Check Suspicious Message')}
                </h2>
                <p className="text-base text-ink-secondary">
                  {t('Paste SMS, WhatsApp text, or payment demand:')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setMode('overview')}
              className="btn-ghost flex items-center gap-1.5 text-base"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('Back')}</span>
            </button>
          </div>

          <form onSubmit={handleMessageSubmit} className="space-y-5">
            <textarea
              rows={5}
              required
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="e.g. URGENT POLICE NOTICE: CBI Digital Arrest warrant issued against you. Transfer penalty Rs 50,000 to officer.cbi.investigation@okaxis to avoid arrest."
              className="input resize-none"
            />

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode('overview')}
                className="btn-secondary w-full sm:w-auto"
              >
                {t('Cancel')}
              </button>
              <button
                type="submit"
                disabled={isLoading || !messageText.trim()}
                className="btn-primary w-full sm:w-auto"
              >
                {t('Analyze Message')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODE: Upload Screenshot ───────────────────────────────────────── */}
      {mode === 'screenshot' && (
        <div className="card space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-hairline">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-spruce-subtle flex items-center justify-center text-spruce">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-ink">
                  {t('Upload QR Screenshot or Photo')}
                </h2>
                <p className="text-base text-ink-secondary">
                  {t('Click to select image (PNG / JPG)')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setMode('overview')}
              className="btn-ghost flex items-center gap-1.5 text-base"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('Back')}</span>
            </button>
          </div>

          <form onSubmit={handleImageSubmit} className="space-y-5">
            <label className="border-2 border-dashed border-hairline hover:border-spruce rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-canvas/50 hover:bg-spruce-subtle/20 transition-all text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {filePreview ? (
                <div className="space-y-3">
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="max-h-56 mx-auto rounded-xl object-contain border border-hairline"
                  />
                  <p className="text-base text-ink font-medium">{selectedFile?.name}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto text-spruce">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink">
                      {t('Click to select image (PNG / JPG)')}
                    </p>
                    <p className="text-base text-ink-secondary mt-1">
                      {lang === 'te'
                        ? 'QR స్టిక్కర్ ఫోటో లేదా చెల్లింపు స్క్రీన్‌షాట్'
                        : lang === 'hi'
                        ? 'QR स्टिकर या भुगतान स्क्रीनशॉट'
                        : 'Store counter QR photo or payment confirmation screen'}
                    </p>
                  </div>
                </div>
              )}
            </label>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode('overview')}
                className="btn-secondary w-full sm:w-auto"
              >
                {t('Cancel')}
              </button>
              <button
                type="submit"
                disabled={isLoading || !selectedFile}
                className="btn-primary w-full sm:w-auto"
              >
                {t('Scan & Extract Signals')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODE: Voice Note ──────────────────────────────────────────────── */}
      {mode === 'voice' && (
        <div className="card space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-hairline">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-spruce-subtle flex items-center justify-center text-spruce">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-ink">
                  {t('Spoken Voice Note Triage')}
                </h2>
                <p className="text-base text-ink-secondary">
                  {lang === 'te'
                    ? 'తెలుగు, హిందీ లేదా ఆంగ్లంలో వాయిస్ సందేశం'
                    : lang === 'hi'
                    ? 'तेलुगु, हिंदी या अंग्रेज़ी में वॉइस नोट'
                    : 'Telugu, Hindi, or English spoken scam audio note'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setMode('overview')}
              className="btn-ghost flex items-center gap-1.5 text-base"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('Back')}</span>
            </button>
          </div>

          <div className="bg-canvas p-6 rounded-2xl border border-hairline space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto text-spruce">
              <Volume2 className="w-8 h-8" />
            </div>
            <p className="text-base text-ink-secondary max-w-lg mx-auto">
              {lang === 'te'
                ? 'ఉదాహరణ: "మీ విద్యుత్ బిల్లు బకాయి ఉంది. వెంటనే చెల్లించకపోతే విద్యుత్ నిలిపివేయబడుతుంది."'
                : lang === 'hi'
                ? 'उदाहरण: "आपका बिजली बिल बकाया है। यदि तुरंत भुगतान नहीं किया तो बिजली काट दी जाएगी।"'
                : 'Example: "Your electricity bill unpaid. Call 9848022338 immediately or power disconnected."'}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => {
                  setMessageText('Your electricity bill unpaid. Call 9848022338 immediately or power disconnected.');
                  setMode('message');
                }}
                className="btn-primary"
              >
                {t('Analyze Spoken Voice Note')}
              </button>
              <button
                onClick={() => setMode('overview')}
                className="btn-secondary"
              >
                {t('Back')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Camera Scanner Modal ──────────────────────────────────────────── */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleQRScanned}
        lang={lang}
      />

    </div>
  );
}
