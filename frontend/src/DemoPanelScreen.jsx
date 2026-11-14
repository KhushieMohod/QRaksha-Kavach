import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Repeat,
  Radio,
  FileWarning,
  RotateCcw,
  CheckCircle,
  PlayCircle,
  ArrowRight,
  Loader2,
  ShieldAlert,
  Flame,
  Volume2,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { simulateDemoAction } from './api';

export default function DemoPanelScreen({ onNavigateToCheck, onNavigateToMerchant, onNavigateToMetrics }) {
  const [activeShopCode, setActiveShopCode] = useState('KIR-0001');
  const [simResult, setSimResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const runSimulation = async (action) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await simulateDemoAction(action, activeShopCode);
      setSimResult(res);
    } catch (err) {
      setErrorMsg(err.message || 'Simulation error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="p-5 bg-white border-flat shadow-flat space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold tracking-wider uppercase text-terracotta bg-terracotta-light border border-terracotta px-2 py-0.5">
            Evaluator Sandbox
          </span>
          <span className="text-xs font-mono text-forest font-bold">
            Zero Manual DB Edits
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-terracotta" />
          <span>Interactive Attack Simulator</span>
        </h2>
        <p className="text-sm text-stone-700">
          Trigger real-time attack scenarios and verify defense signals live during the presentation or viva evaluation (SPEC Section 8.1 & Section 11).
        </p>
      </div>

      {/* Result notification */}
      {simResult && (
        <div className="p-4 bg-verdict-verified-bg border-flat border-verdict-verified text-ink space-y-1 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-base text-verdict-verified">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>Simulation Completed: {simResult.action}</span>
          </div>
          <p className="text-sm">{simResult.message}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-verdict-danger-bg border-flat border-verdict-danger text-ink">
          <p className="font-bold text-sm">Simulation Failed: {errorMsg}</p>
        </div>
      )}

      {/* The 4 Direct Simulation Cards (SPEC 8.1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: QR Swap */}
        <div className="bg-white p-5 border-flat shadow-flat-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-verdict-danger px-2 py-0.5 bg-verdict-danger-bg border border-verdict-danger">
                Attack 1: Physical Sticker Swap
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <Repeat className="w-5 h-5 text-verdict-danger" />
              <span>Simulate QR Swap at Shop</span>
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Simulates a malicious sticker placed on KIR-0001 counter with{' '}
              <span className="font-mono text-xs text-ink font-bold">scammer.swap@ybl</span>.
            </p>
          </div>

          <button
            onClick={() => runSimulation('qr_swap')}
            disabled={isLoading}
            className="w-full py-3 bg-terracotta text-white font-bold text-sm sm:text-base border-flat shadow-flat-sm hover:bg-terracotta-hover btn-tactile disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span>Trigger QR Swap Alert</span>
          </button>
        </div>

        {/* Card 2: Crowd Payee Drift */}
        <div className="bg-white p-5 border-flat shadow-flat-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-ochre-dark px-2 py-0.5 bg-verdict-caution-bg border border-ochre">
                Attack 2: Street Payee Drift
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <Radio className="w-5 h-5 text-ochre-dark" />
              <span>Simulate Crowd Payee Drift</span>
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Injects 9 baseline scans for a dominant payee at an unregistered spot, then scans a new payee causing CAUTION.
            </p>
          </div>

          <button
            onClick={() => runSimulation('drift')}
            disabled={isLoading}
            className="w-full py-3 bg-paper-dark text-ink font-bold text-sm sm:text-base border-flat shadow-flat-sm hover:bg-paper-sand btn-tactile disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            <span>Inject Baseline & Drift</span>
          </button>
        </div>

        {/* Card 3: Scam Message with Payee */}
        <div className="bg-white p-5 border-flat shadow-flat-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-verdict-danger px-2 py-0.5 bg-verdict-danger-bg border border-verdict-danger">
                Attack 3: Cross-Channel Link
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-verdict-danger" />
              <span>Submit Extortion Scam Message</span>
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Submits a fake CBI digital arrest notice, automatically flagging{' '}
              <span className="font-mono text-xs text-ink font-bold">officer.cbi.investigation@okaxis</span> in DB.
            </p>
          </div>

          <button
            onClick={() => runSimulation('scam_with_payee')}
            disabled={isLoading}
            className="w-full py-3 bg-terracotta text-white font-bold text-sm sm:text-base border-flat shadow-flat-sm hover:bg-terracotta-hover btn-tactile disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileWarning className="w-4 h-4" />}
            <span>Submit Scam & Flag Payee</span>
          </button>
        </div>

        {/* Card 4: Reset Data */}
        <div className="bg-white p-5 border-flat shadow-flat-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-stone-600 px-2 py-0.5 bg-paper-dark border border-stone-400">
                Maintenance: Clean Seed
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-stone-700" />
              <span>Reset Database to Clean State</span>
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Wipes demo scans, alerts, and scam messages, restoring the 20 clean registered kirana shops.
            </p>
          </div>

          <button
            onClick={() => runSimulation('reset')}
            disabled={isLoading}
            className="w-full py-3 bg-stone-800 text-white font-bold text-sm sm:text-base border-flat shadow-flat-sm hover:bg-black btn-tactile disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            <span>Reset Demo Database</span>
          </button>
        </div>
      </div>

      {/* Guided 4-Beat Section 11 Demo Script Walkthrough */}
      <div className="bg-paper-dark border-flat shadow-flat p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-bold text-ink flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-terracotta" />
            <span>Section 11 — 4-Minute Presentation Guide</span>
          </h3>
          <span className="text-xs font-mono bg-paper border px-2 py-0.5 text-ink font-bold">
            Live Script
          </span>
        </div>

        <p className="text-xs sm:text-sm text-stone-700">
          Follow these 4 beats sequentially to present the core defenses to evaluators:
        </p>

        <div className="space-y-3 text-sm">
          {/* Beat 1 */}
          <div className="p-4 bg-white border-flat space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-terracotta">
                Beat 1: Real Shop vs. Swapped Sticker
              </span>
              <button
                onClick={onNavigateToCheck}
                className="text-xs font-bold text-ink hover:text-terracotta flex items-center gap-1 underline"
              >
                <span>Go to Check</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-stone-700 text-xs sm:text-sm leading-relaxed">
              Check genuine QR at <strong>KIR-0001</strong> (shows <strong>VERIFIED</strong> green). Next, trigger <strong>Simulate QR Swap</strong> above. Check again: immediately shows <strong>DANGER</strong> red and raises a tampered sticker alert on the{' '}
              <button onClick={onNavigateToMerchant} className="font-bold underline text-terracotta">
                Merchant Screen
              </button>
              .
            </p>
          </div>

          {/* Beat 2 */}
          <div className="p-4 bg-white border-flat space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-terracotta">
                Beat 2: Cross-Channel Story Linking
              </span>
              <button
                onClick={onNavigateToCheck}
                className="text-xs font-bold text-ink hover:text-terracotta flex items-center gap-1 underline"
              >
                <span>Go to Check</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-stone-700 text-xs sm:text-sm leading-relaxed">
              Click <strong>Submit Extortion Scam Message</strong> above. Then scan a QR using <span className="font-mono font-bold text-ink">officer.cbi.investigation@okaxis</span>: it flags <strong>DANGER</strong> quoting the exact scam message text and date!
            </p>
          </div>

          {/* Beat 3 */}
          <div className="p-4 bg-white border-flat space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-terracotta">
                Beat 3: Multilingual Voice Verdict
              </span>
              <span className="text-xs font-mono text-stone-500">Audio Speech</span>
            </div>
            <p className="text-stone-700 text-xs sm:text-sm leading-relaxed">
              On the Result screen, toggle to <strong>తెలుగు (Telugu)</strong> and click <strong>Listen</strong>. The system plays the pre-recorded Telugu alert tone and speaks aloud actionable safety guidance.
            </p>
          </div>

          {/* Beat 4 */}
          <div className="p-4 bg-white border-flat space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-terracotta">
                Beat 4: Live Evaluation Metrics
              </span>
              <button
                onClick={onNavigateToMetrics}
                className="text-xs font-bold text-ink hover:text-terracotta flex items-center gap-1 underline"
              >
                <span>View Metrics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-stone-700 text-xs sm:text-sm leading-relaxed">
              Review 100% deterministic scenario accuracy (30/30), 95% held-out test message accuracy (0% false positive rate), and sub-50ms rule response latencies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
