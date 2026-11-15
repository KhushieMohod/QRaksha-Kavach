import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Keyboard, AlertTriangle, ArrowRight } from 'lucide-react';
import { translate } from './i18n';

const PRESETS = [
  { label: 'Genuine Kirana (KIR-0001)',     payload: 'upi://pay?pa=lakshmi.kirana@okaxis&pn=LakshmiStore&am=50.00' },
  { label: 'Swapped Sticker (Scammer)',      payload: 'upi://pay?pa=scammer.swap@ybl&pn=FakeSticker&mc=5411'       },
  { label: 'Lookalike Handle (sbi-support)', payload: 'upi://pay?pa=sbi-support@oksbi&pn=SBIHelpDesk'              },
  { label: 'CBI Extortion Payee (flagged)',  payload: 'upi://pay?pa=officer.cbi.investigation@okaxis&pn=CBIAlert'  },
];

export default function CameraScannerModal({ isOpen, onClose, onScanSuccess, lang = 'en' }) {
  const t = (key) => translate(lang, key);

  const [tab, setTab] = useState('camera');
  const [manualPayload, setManualPayload] = useState('upi://pay?pa=lakshmi.kirana@okaxis&pn=LakshmiStore&am=50.00');
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef(null);
  const isRunningRef = useRef(false);

  // ── Body Scroll Lock & Escape Key Listener ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Lock background scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Close on Escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // ── Camera Scanner Lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || tab !== 'camera') {
      stopScanner();
      return;
    }
    const qr = new Html5Qrcode('qr-reader-box');
    scannerRef.current = qr;
    qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (txt) => stopScanner().then(() => onScanSuccess(txt)),
      () => {}
    )
      .then(() => {
        isRunningRef.current = true;
        setErrorMsg('');
      })
      .catch(() => {
        setErrorMsg(
          lang === 'te'
            ? 'ఈ పరికరంలో కెమెరా అందుబాటులో లేదు — దయచేసి మాన్యువల్ ట్యాబ్‌ని ఉపయోగించండి.'
            : lang === 'hi'
            ? 'इस डिवाइस पर कैमरा उपलब्ध नहीं है — कृपया नीचे दिए गए मैनुअल टैब का उपयोग करें।'
            : 'Camera unavailable on this device — please use the Manual Payload tab below.'
        );
        setTab('manual');
      });

    return () => {
      stopScanner();
    };
  }, [isOpen, tab, lang, onScanSuccess]);

  const stopScanner = async () => {
    if (scannerRef.current && isRunningRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {}
      isRunningRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        // Clicking backdrop closes modal
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-surface border border-hairline shadow-2xl rounded-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Fixed Header (Always visible at top) ─────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline bg-canvas shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-spruce-subtle flex items-center justify-center text-spruce">
              <Camera className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-ink">
              {t('Scan Store Counter QR')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-secondary hover:text-ink hover:bg-white border border-hairline/60 transition-colors"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Fixed Tab Switcher ───────────────────────────────────────────── */}
        <div className="flex border-b border-hairline text-base font-medium bg-canvas/40 shrink-0">
          <button
            onClick={() => setTab('camera')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors border-b-2 ${
              tab === 'camera'
                ? 'border-spruce text-spruce font-bold bg-white'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{t('Camera Viewfinder')}</span>
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors border-b-2 ${
              tab === 'manual'
                ? 'border-spruce text-spruce font-bold bg-white'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>{t('Manual Payload')}</span>
          </button>
        </div>

        {/* ── Scrollable Body Area (Internal scroll, never background) ─────── */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4 overscroll-contain">

          {/* Camera Error / Notice */}
          {errorMsg && (
            <div className="p-3.5 bg-caution-bg border border-caution-border rounded-xl flex items-start gap-2.5 text-sm text-caution-dark">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-caution" />
              <div className="space-y-1">
                <span className="font-medium block">{errorMsg}</span>
                {tab === 'camera' && (
                  <button
                    type="button"
                    onClick={() => setTab('manual')}
                    className="text-spruce font-bold underline text-sm"
                  >
                    {lang === 'te' ? 'మాన్యువల్ ట్యాబ్‌కు మారండి' : lang === 'hi' ? 'मैनुअल टैब पर जाएँ' : 'Switch to Manual Test Tab'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tab 1: Camera Viewfinder */}
          {tab === 'camera' && (
            <div className="space-y-4">
              <div className="relative bg-ink rounded-xl overflow-hidden aspect-square border border-hairline max-w-xs mx-auto">
                <div id="qr-reader-box" className="w-full h-full" />
                {/* Visual reticle */}
                <div className="absolute inset-6 pointer-events-none">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
                </div>
              </div>
              <p className="text-center text-sm text-ink-muted">
                {t('Align counter QR sticker within the viewfinder target box.')}
              </p>
            </div>
          )}

          {/* Tab 2: Manual Payload */}
          {tab === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="label text-sm font-semibold">
                  {t('Paste UPI QR URL / String:')}
                </label>
                <textarea
                  rows={3}
                  value={manualPayload}
                  onChange={(e) => setManualPayload(e.target.value)}
                  className="input upi-id text-sm resize-none"
                  placeholder="upi://pay?pa=shop@bank&pn=ShopName"
                />
              </div>

              <div className="space-y-2">
                <span className="text-xs uppercase font-bold text-ink-muted tracking-wider block">
                  {t('Quick Test Payloads:')}
                </span>
                <div className="space-y-2">
                  {PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setManualPayload(p.payload)}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                        manualPayload === p.payload
                          ? 'bg-spruce-subtle border-spruce text-spruce font-semibold shadow-sm'
                          : 'bg-white border-hairline text-ink hover:bg-canvas'
                      }`}
                    >
                      <div className="font-semibold text-ink">{p.label}</div>
                      <div className="font-mono text-xs text-ink-muted truncate mt-0.5">{p.payload}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Fixed Footer (Always visible at bottom) ───────────────────────── */}
        <div className="px-6 py-4 border-t border-hairline bg-canvas flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-2.5 px-5 text-base"
          >
            {lang === 'te' ? 'రద్దు చేయండి' : lang === 'hi' ? 'रद्द करें' : 'Cancel & Close'}
          </button>

          {tab === 'manual' ? (
            <button
              type="button"
              onClick={() => onScanSuccess(manualPayload.trim())}
              disabled={!manualPayload.trim()}
              className="btn-primary py-2.5 px-6 text-base"
            >
              <span>{t('Verify This QR Code')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setTab('manual')}
              className="btn-secondary py-2.5 px-5 text-base"
            >
              <span>{lang === 'te' ? 'మాన్యువల్ కోడ్' : lang === 'hi' ? 'मैनुअल कोड' : 'Manual Code'}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
