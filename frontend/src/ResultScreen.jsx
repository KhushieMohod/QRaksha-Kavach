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

export default function ResultScreen({ result, onBack, initialLang = 'en' }) {
  const [lang, setLang] = useState(initialLang); // 'en' | 'te' | 'hi'
  const [showEvidence, setShowEvidence] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!result) return null;

  const verdict = (result.verdict || 'UNVERIFIED').toUpperCase();

  // Style mapping for exact verdict colors
  const verdictStyles = {
    VERIFIED: {
      bg: 'bg-verdict-verified-bg',
      border: 'border-verdict-verified',
      text: 'text-verdict-verified',
      icon: ShieldCheck,
      label: {
        en: 'VERIFIED',
        te: 'ధృవీకరించబడింది (VERIFIED)',
        hi: 'सत्यापित (VERIFIED)',
      },
    },
    UNVERIFIED: {
      bg: 'bg-verdict-unverified-bg',
      border: 'border-verdict-unverified',
      text: 'text-verdict-unverified',
      icon: HelpCircle,
      label: {
        en: 'UNVERIFIED',
        te: 'ధృవీకరించబడలేదు (UNVERIFIED)',
        hi: 'असत्यापित (UNVERIFIED)',
      },
    },
    CAUTION: {
      bg: 'bg-verdict-caution-bg',
      border: 'border-verdict-caution',
      text: 'text-verdict-caution',
      icon: AlertTriangle,
      label: {
        en: 'CAUTION',
        te: 'హెచ్చరిక (CAUTION)',
        hi: 'सावधानी (CAUTION)',
      },
    },
    DANGER: {
      bg: 'bg-verdict-danger-bg',
      border: 'border-verdict-danger',
      text: 'text-verdict-danger',
      icon: ShieldAlert,
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
    <div className="space-y-6">
      {/* Top Bar with Back & Language Switcher */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => {
            stopAudio();
            onBack();
          }}
          className="flex items-center gap-2 px-3 py-2 bg-paper-dark border-flat font-bold text-ink hover:bg-white active:translate-y-0.5"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* EN / Telugu / Hindi Toggle */}
        <div className="flex border-flat bg-paper-dark text-base font-bold overflow-hidden shadow-flat-sm">
          <button
            onClick={() => {
              stopAudio();
              setLang('en');
            }}
            className={`px-3 py-1.5 transition-colors ${
              lang === 'en' ? 'bg-terracotta text-white' : 'text-ink hover:bg-white'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => {
              stopAudio();
              setLang('te');
            }}
            className={`px-3 py-1.5 border-l-2 border-r-2 border-stone-800 transition-colors ${
              lang === 'te' ? 'bg-terracotta text-white' : 'text-ink hover:bg-white'
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
              lang === 'hi' ? 'bg-terracotta text-white' : 'text-ink hover:bg-white'
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* Big Coloured Verdict Banner */}
      <div className={`p-6 border-flat ${style.border} ${style.bg} shadow-flat text-ink space-y-4`}>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white border-flat shrink-0">
            <VerdictIcon className={`w-12 h-12 ${style.text}`} />
          </div>
          <div className="flex-1">
            <span className="text-sm font-bold uppercase tracking-wider text-stone-600 block">
              Safety Verdict
            </span>
            <h1 className={`text-3xl font-extrabold ${style.text} leading-tight`}>
              {style.label[lang] || verdict}
            </h1>
          </div>
        </div>

        {/* One-Line Reason Title */}
        <div className="p-4 bg-white/80 border-flat border-stone-800">
          <p className="text-xl font-bold text-ink leading-snug">{explanationText}</p>
        </div>

        {/* Listen Button (Audio feedback) */}
        <div className="pt-1">
          <button
            onClick={handleListenClick}
            className={`w-full py-3 px-4 font-bold text-lg border-flat shadow-flat-sm flex items-center justify-center gap-3 transition-colors ${
              isSpeaking
                ? 'bg-amber-400 text-ink animate-pulse'
                : 'bg-white hover:bg-paper-dark text-ink'
            }`}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-6 h-6 text-terracotta" />
                <span>Stop Listening</span>
              </>
            ) : (
              <>
                <Volume2 className="w-6 h-6 text-terracotta" />
                <span>
                  Listen ({lang === 'te' ? 'తెలుగులో వినండి' : lang === 'hi' ? 'सुनिए' : 'Listen aloud'}
                  )
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Actionable Next Steps (SPEC 8.1) */}
      <div className="p-6 bg-white border-flat shadow-flat space-y-4">
        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-terracotta" />
          <span>Recommended Next Steps:</span>
        </h2>

        <ol className="space-y-3">
          {(result.next_steps && result.next_steps.length > 0
            ? result.next_steps
            : ['Verify recipient details before entering your PIN']
          ).map((step, idx) => (
            <li
              key={idx}
              className="p-3 bg-paper border-flat flex items-start gap-3 text-lg font-bold text-ink"
            >
              <span className="w-7 h-7 bg-terracotta text-white rounded-none border-flat border-stone-900 flex items-center justify-center text-sm shrink-0">
                {idx + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Expandable Evidence Section (SPEC 8.1) */}
      <div className="bg-white border-flat shadow-flat overflow-hidden">
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="w-full p-4 flex items-center justify-between text-left font-bold text-lg bg-paper-dark hover:bg-stone-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-terracotta" />
            <span>Detector Findings & Technical Evidence ({result.reasons?.length || 0})</span>
          </span>
          {showEvidence ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
        </button>

        {showEvidence && (
          <div className="p-5 space-y-4 text-base border-t-2 border-stone-900 bg-paper">
            {/* Metadata summary */}
            <div className="grid grid-cols-2 gap-2 text-sm font-mono p-3 bg-white border-flat">
              <div>
                <span className="text-stone-500 block">Request ID:</span>
                <span className="font-bold">{result.request_id || 'n/a'}</span>
              </div>
              <div>
                <span className="text-stone-500 block flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Latency:
                </span>
                <span className="font-bold">{result.latency_ms} ms</span>
              </div>
            </div>

            {/* List of reasons */}
            <div className="space-y-3">
              <span className="font-bold text-stone-700 uppercase tracking-wider text-xs block">
                Individual Signal Reports:
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
                    <div className="flex items-center justify-between text-sm font-bold mb-1">
                      <span className="font-mono text-terracotta">{r.detector}</span>
                      <span className="uppercase px-2 py-0.5 border-flat bg-white text-xs">
                        {r.severity}
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-sm space-y-1 text-stone-800">
                      {r.evidence?.map((ev, j) => (
                        <li key={j}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-sm text-stone-600 italic p-3 bg-white border-flat">
                  No risk or mismatch flags triggered.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Done Button */}
      <button
        onClick={() => {
          stopAudio();
          onBack();
        }}
        className="w-full py-3.5 bg-paper-dark border-flat font-bold text-lg hover:bg-stone-300 active:translate-y-0.5"
      >
        Check Another Payment
      </button>
    </div>
  );
}
