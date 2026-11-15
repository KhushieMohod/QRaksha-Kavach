import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { speakVerdict, stopAudio } from './audioPlayer';
import { translate } from './i18n';

// ── High-Contrast Verdict Configuration (SPEC Section 8.1) ─────────────────
const VERDICT_CONFIG = {
  VERIFIED: {
    bg:        'bg-[#ECFDF5]',
    border:    'border-[#86EFAC]',
    textColor: 'text-[#15803D]',
    chipCls:   'chip-verified',
    Icon:      ShieldCheck,
    headline: {
      en: 'VERIFIED — SAFE TO PAY',
      te: 'ధృవీకరించబడింది — చెల్లింపుకు సురక్షితం',
      hi: 'सत्यापित — भुगतान सुरक्षित है',
    },
  },
  UNVERIFIED: {
    bg:        'bg-[#F1F5F9]',
    border:    'border-[#CBD5E1]',
    textColor: 'text-[#475569]',
    chipCls:   'chip-unverified',
    Icon:      HelpCircle,
    headline: {
      en: 'UNVERIFIED — CHECK NAME',
      te: 'ధృవీకరించలేదు — పేరు తనిఖీ చేయండి',
      hi: 'सत्यापित नहीं — नाम जाँचें',
    },
  },
  CAUTION: {
    bg:        'bg-[#FFFBEB]',
    border:    'border-[#FDE68A]',
    textColor: 'text-[#B45309]',
    chipCls:   'chip-caution',
    Icon:      AlertTriangle,
    headline: {
      en: 'CAUTION — VERIFY BEFORE PAYING',
      te: 'జాగ్రత్త — చెల్లించే ముందు నిర్ధారించండి',
      hi: 'सावधानी — भुगतान से पहले पुष्टि करें',
    },
  },
  DANGER: {
    bg:        'bg-[#FEF2F2]',
    border:    'border-[#FCA5A5]',
    textColor: 'text-[#B91C1C]',
    chipCls:   'chip-danger',
    Icon:      ShieldAlert,
    headline: {
      en: 'DANGER — DO NOT PAY',
      te: 'ప్రమాదం — చెల్లించవద్దు',
      hi: 'खतरा — भुगतान न करें',
    },
  },
};

export default function ResultScreen({ result, onBack, lang = 'en' }) {
  const t = (key, vals) => translate(lang, key, vals);

  const [showEvidence, setShowEvidence] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!result) return null;

  const verdict = (result.verdict || 'UNVERIFIED').toUpperCase();
  const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.UNVERIFIED;
  const { Icon } = cfg;
  const headline = cfg.headline[lang] || cfg.headline.en;

  const explanation =
    result.explanation?.[lang] ||
    result.explanation?.en ||
    t('Verify recipient details before entering your UPI PIN');

  const handleListen = () => {
    if (isSpeaking) {
      stopAudio();
      setIsSpeaking(false);
      return;
    }
    const textToSpeak = `${headline}. ${explanation}. ${(result.next_steps || []).join('. ')}`;
    speakVerdict({
      verdict,
      text: textToSpeak,
      lang,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  };

  const listenButtonText = lang === 'te'
    ? 'తెలుగులో వినండి (వాయిస్ సలహా)'
    : lang === 'hi'
    ? 'आवाज़ में सुनें (सुरक्षा सलाह)'
    : 'Listen (Audio Safety Advice)';

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">

      {/* ── Top Bar: Back & Action ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => { stopAudio(); onBack(); }}
          className="btn-secondary text-base flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === 'te' ? 'తిరిగి వెళ్లండి' : lang === 'hi' ? 'वापस जाएँ' : 'Back to Check'}</span>
        </button>

        <span className="text-sm font-mono text-ink-muted">
          {result.latency_ms ? `${result.latency_ms} ms` : ''}
        </span>
      </div>

      {/* ── Big Unmistakable Verdict Banner (SPEC 8.1) ────────────────────── */}
      <div className={`rounded-2xl border-2 p-6 sm:p-8 shadow-sm ${cfg.bg} ${cfg.border} space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-hairline/60">
              <Icon className={`w-8 h-8 ${cfg.textColor}`} />
            </div>
            <div>
              <span className={`${cfg.chipCls} mb-2 block w-fit`}>
                {verdict}
              </span>
              <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight leading-tight ${cfg.textColor}`}>
                {headline}
              </h1>
            </div>
          </div>

          {/* Prominent Audio Listen Button */}
          <button
            onClick={handleListen}
            className={`btn-secondary shrink-0 flex items-center justify-center gap-2.5 px-5 py-3 ${
              isSpeaking ? 'bg-gold-soft border-gold text-gold-dark font-bold' : ''
            }`}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-5 h-5 text-gold-dark" />
                <span>{lang === 'te' ? 'ఆపండి' : lang === 'hi' ? 'रोकें' : 'Stop Audio'}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-5 h-5 text-spruce" />
                <span>{listenButtonText}</span>
              </>
            )}
          </button>
        </div>

        {/* 1-Line Plain Reason */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-hairline/80 shadow-sm">
          <p className="text-lg sm:text-xl font-medium text-ink leading-relaxed">
            {explanation}
          </p>
        </div>
      </div>

      {/* ── Short Numbered Next Steps ─────────────────────────────────────── */}
      <div className="card space-y-4">
        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-spruce" />
          <span>
            {lang === 'te'
              ? 'సిఫార్సు చేసిన తదుపరి చర్యలు'
              : lang === 'hi'
              ? 'अगले सुझाए गए कदम'
              : 'Recommended Next Steps'}
          </span>
        </h2>

        <div className="space-y-3">
          {(result.next_steps?.length
            ? result.next_steps
            : [t('Verify recipient details before entering your UPI PIN')]
          ).map((step, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-canvas border border-hairline"
            >
              <span className="w-7 h-7 rounded-full bg-spruce text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-base sm:text-lg text-ink font-medium leading-snug pt-0.5">
                {t(step) || step}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Expandable Technical Details Accordion ────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-canvas transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-spruce" />
            <span className="text-base sm:text-lg font-bold text-ink">
              {lang === 'te'
                ? `సాంకేతిక వివరాలు & ఆధారాలు (${result.reasons?.length || 0})`
                : lang === 'hi'
                ? `तकनीकी विवरण और प्रमाण (${result.reasons?.length || 0})`
                : `Show Technical Evidence (${result.reasons?.length || 0} signals)`}
            </span>
          </div>
          {showEvidence ? (
            <ChevronUp className="w-5 h-5 text-ink-secondary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-ink-secondary" />
          )}
        </button>

        {showEvidence && (
          <div className="p-6 border-t border-hairline bg-canvas/40 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-white border border-hairline">
                <span className="text-ink-muted block text-xs font-semibold uppercase">
                  {lang === 'te' ? 'అభ్యర్థన ID' : lang === 'hi' ? 'अनुरोध ID' : 'Request ID'}
                </span>
                <span className="font-mono text-ink text-sm font-medium">
                  {result.request_id || 'N/A'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-hairline">
                <span className="text-ink-muted block text-xs font-semibold uppercase">
                  {lang === 'te' ? 'ఇంజిన్ సమయం' : lang === 'hi' ? 'जाँच समय' : 'Engine Latency'}
                </span>
                <span className="font-mono text-ink text-sm font-medium">
                  {result.latency_ms ? `${result.latency_ms} ms` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Detector Findings Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink-secondary">
                {lang === 'te' ? 'గుర్తించిన సంకేతాలు:' : lang === 'hi' ? 'सुरक्षा संकेत:' : 'Security Signal Breakdown:'}
              </h3>
              {result.reasons?.length ? (
                result.reasons.map((r, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-white border border-hairline space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-spruce">
                        {r.detector}
                      </span>
                      <span
                        className={
                          r.severity === 'danger'
                            ? 'chip-danger'
                            : r.severity === 'caution'
                            ? 'chip-caution'
                            : 'chip-unverified'
                        }
                      >
                        {r.severity}
                      </span>
                    </div>
                    {r.evidence?.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-ink-secondary space-y-1">
                        {r.evidence.map((ev, j) => (
                          <li key={j}>{ev}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-muted italic p-3 rounded-xl bg-white border border-hairline">
                  {t('No risk or mismatch signals triggered. Clean payment profile.')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Check Another Button ─────────────────────────────────────────── */}
      <div className="pt-2">
        <button
          onClick={() => { stopAudio(); onBack(); }}
          className="btn-primary w-full py-4 text-lg"
        >
          {t('Check Another Payment QR')}
        </button>
      </div>

    </div>
  );
}
