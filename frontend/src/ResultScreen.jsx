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
  Sparkles,
  AlertOctagon,
  FileText,
} from 'lucide-react';
import { speakVerdict, stopAudio } from './audioPlayer';

export default function ResultScreen({ result, onBack, initialLang = 'en' }) {
  const [lang, setLang] = useState(initialLang); // 'en' | 'te' | 'hi'
  const [showEvidence, setShowEvidence] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!result) return null;

  const verdict = (result.verdict || 'UNVERIFIED').toUpperCase();

  // Style mapping for exact verdict colors & trustworthy styling
  const verdictStyles = {
    VERIFIED: {
      bg: 'bg-verdict-verified-bg',
      border: 'border-verdict-verified',
      text: 'text-verdict-verified',
      badgeBg: 'bg-forest text-white',
      icon: ShieldCheck,
      headline: 'VERIFIED GENUINE',
      label: {
        en: 'VERIFIED — SAFE TO PAY',
        te: 'ధృవీకరించబడింది (VERIFIED)',
        hi: 'सत्यापित — सुरक्षित (VERIFIED)',
      },
    },
    UNVERIFIED: {
      bg: 'bg-verdict-unverified-bg',
      border: 'border-verdict-unverified',
      text: 'text-verdict-unverified',
      badgeBg: 'bg-stone-700 text-white',
      icon: HelpCircle,
      headline: 'UNVERIFIED SPOT',
      label: {
        en: 'UNVERIFIED — CHECK NAME',
        te: 'ధృవీకరించబడలేదు (UNVERIFIED)',
        hi: 'असत्यापित (UNVERIFIED)',
      },
    },
    CAUTION: {
      bg: 'bg-verdict-caution-bg',
      border: 'border-verdict-caution',
      text: 'text-verdict-caution',
      badgeBg: 'bg-ochre-dark text-white',
      icon: AlertTriangle,
      headline: 'CAUTION — PAYEE CHANGED',
      label: {
        en: 'CAUTION — VERIFY BEFORE PAYING',
        te: 'హెచ్చరిక (CAUTION)',
        hi: 'सावधानी (CAUTION)',
      },
    },
    DANGER: {
      bg: 'bg-verdict-danger-bg',
      border: 'border-verdict-danger',
      text: 'text-verdict-danger',
      badgeBg: 'bg-verdict-danger text-white',
      icon: ShieldAlert,
      headline: 'DANGER — DO NOT PAY',
      label: {
        en: 'DANGER — DO NOT PAY',
        te: 'ప్రమాదం — డబ్బు పంపవద్దు (DANGER)',
        hi: 'खतरा — भुगतान न करें (DANGER)',
      },
    },
  };

  const style = verdictStyles[verdict] || verdictStyles.UNVERIFIED;
  const VerdictIcon = style.icon;

  // Multilingual explanation text
  const explanationText =
    result.explanation?.[lang] ||
    result.explanation?.en ||
    'Analysis complete. Check details below.';

  const handleListenClick = () => {
    if (isSpeaking) {
      stopAudio();
      setIsSpeaking(false);
      return;
    }

    const speakText = `${style.label[lang] || verdict}. ${explanationText}. Next steps: ${(
      result.next_steps || []
    ).join('. ')}`;

    speakVerdict({
      verdict,
      text: speakText,
      lang,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Bar with Back & Language Switcher */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => {
            stopAudio();
            onBack();
          }}
          className="flex items-center gap-2 px-3 py-2 bg-paper-cream border-flat font-bold text-ink hover:bg-paper-dark btn-tactile text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Scanner</span>
        </button>

        {/* EN / Telugu / Hindi Toggle */}
        <div className="flex border-flat bg-white text-xs sm:text-sm font-bold shadow-flat-sm overflow-hidden">
          <button
            onClick={() => {
              stopAudio();
              setLang('en');
            }}
            className={`px-3 py-1.5 transition-colors ${
              lang === 'en' ? 'bg-terracotta text-white font-extrabold' : 'text-ink hover:bg-paper-dark'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => {
              stopAudio();
              setLang('te');
            }}
            className={`px-3 py-1.5 border-l-2 border-r-2 border-ink transition-colors ${
              lang === 'te' ? 'bg-terracotta text-white font-extrabold' : 'text-ink hover:bg-paper-dark'
            }`}
          >
            తెలుగు
          </button>
          <button
            onClick={() => {
              stopAudio();
              setLang('hi');
            }}
            className={`px-3 py-1.5 transition-colors ${
              lang === 'hi' ? 'bg-terracotta text-white font-extrabold' : 'text-ink hover:bg-paper-dark'
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* Main Verdict Card */}
      <div className={`p-5 sm:p-6 border-flat-thick ${style.border} ${style.bg} shadow-flat space-y-4`}>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white border-flat shrink-0 shadow-sm">
            <VerdictIcon className={`w-10 h-10 sm:w-12 sm:h-12 ${style.text}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-mono font-extrabold uppercase px-2 py-0.5 border-flat ${style.badgeBg}`}>
                {verdict}
              </span>
              <span className="text-xs text-stone-600 font-mono">
                {result.latency_ms} ms verification
              </span>
            </div>
            <h1 className={`text-2xl sm:text-3xl font-extrabold ${style.text} leading-tight`}>
              {style.label[lang] || verdict}
            </h1>
          </div>
        </div>

        {/* Highlighted Reason Box */}
        <div className="p-4 bg-white/95 border-flat border-ink shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
            Safety Explanation ({lang.toUpperCase()}):
          </span>
          <p className="text-lg sm:text-xl font-bold text-ink leading-snug">
            {explanationText}
          </p>
        </div>

        {/* Audio Player Button */}
        <div>
          <button
            onClick={handleListenClick}
            className={`w-full py-3.5 px-4 font-extrabold text-base sm:text-lg border-flat shadow-flat-sm flex items-center justify-center gap-3 transition-all btn-tactile ${
              isSpeaking
                ? 'bg-ochre-light text-ink border-ochre'
                : 'bg-white hover:bg-paper-cream text-ink'
            }`}
          >
            {isSpeaking ? (
              <>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 bg-terracotta animate-wave-1"></div>
                  <div className="w-1.5 bg-terracotta animate-wave-2"></div>
                  <div className="w-1.5 bg-terracotta animate-wave-3"></div>
                </div>
                <VolumeX className="w-5 h-5 text-terracotta" />
                <span>Stop Listening</span>
              </>
            ) : (
              <>
                <Volume2 className="w-5 h-5 text-terracotta" />
                <span>
                  {lang === 'te'
                    ? 'తెలుగులో వినండి (Listen in Telugu)'
                    : lang === 'hi'
                    ? 'आवाज में सुनें (Listen in Hindi)'
                    : 'Listen Aloud (Speech Advice)'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Actionable Next Steps (SPEC 8.1) */}
      <div className="p-5 sm:p-6 bg-white border-flat shadow-flat space-y-3">
        <h2 className="text-lg sm:text-xl font-bold text-ink flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-forest" />
          <span>Recommended Payer Actions:</span>
        </h2>

        <div className="space-y-2.5">
          {(result.next_steps && result.next_steps.length > 0
            ? result.next_steps
            : ['Verify recipient details before entering your UPI PIN']
          ).map((step, idx) => (
            <div
              key={idx}
              className="p-3 bg-paper-cream border-flat flex items-start gap-3 text-base font-bold text-ink"
            >
              <span className="w-6 h-6 bg-terracotta text-white border-flat flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="pt-0.5 leading-snug">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expandable Technical Evidence & Signal Reports (SPEC 8.1) */}
      <div className="bg-white border-flat shadow-flat overflow-hidden">
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="w-full p-4 flex items-center justify-between text-left font-bold text-base bg-paper-dark hover:bg-paper-sand transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-terracotta" />
            <span>Detector Findings & Security Evidence ({result.reasons?.length || 0})</span>
          </span>
          {showEvidence ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showEvidence && (
          <div className="p-4 sm:p-5 space-y-4 border-t-2 border-ink bg-paper text-sm">
            {/* Metadata Summary Card */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono p-3 bg-white border-flat">
              <div>
                <span className="text-stone-500 block">Request ID:</span>
                <span className="font-bold text-ink truncate block">
                  {result.request_id || 'n/a'}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Engine Latency:
                </span>
                <span className="font-bold text-ink">{result.latency_ms} ms</span>
              </div>
            </div>

            {/* List of detector reasons */}
            <div className="space-y-2.5">
              <span className="font-bold text-stone-700 uppercase tracking-wider text-xs block">
                Signal Inspector Breakdown:
              </span>

              {result.reasons && result.reasons.length > 0 ? (
                result.reasons.map((r, i) => (
                  <div
                    key={i}
                    className={`p-3 border-flat ${
                      r.severity === 'danger'
                        ? 'bg-verdict-danger-bg border-verdict-danger'
                        : r.severity === 'caution'
                        ? 'bg-verdict-caution-bg border-verdict-caution'
                        : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="font-mono text-terracotta">{r.detector}</span>
                      <span
                        className={`uppercase px-2 py-0.5 border-flat text-[11px] font-mono ${
                          r.severity === 'danger'
                            ? 'bg-verdict-danger text-white'
                            : r.severity === 'caution'
                            ? 'bg-ochre-dark text-white'
                            : 'bg-stone-200 text-stone-800'
                        }`}
                      >
                        {r.severity}
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-xs sm:text-sm space-y-1 text-ink">
                      {r.evidence?.map((ev, j) => (
                        <li key={j} className="leading-snug">{ev}</li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-xs text-stone-600 italic p-3 bg-white border-flat">
                  No risk or mismatch signals triggered. Clean payment profile.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Done / Check Another Button */}
      <button
        onClick={() => {
          stopAudio();
          onBack();
        }}
        className="w-full py-4 bg-paper-dark border-flat font-extrabold text-base sm:text-lg hover:bg-paper-sand btn-tactile text-ink"
      >
        Check Another Payment QR
      </button>
    </div>
  );
}
