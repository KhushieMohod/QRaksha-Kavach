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
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 bg-white border-flat shadow-flat space-y-2">
        <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-terracotta" />
          <span>Interactive Demo Control Panel</span>
        </h2>
        <p className="text-base text-stone-700">
          Trigger real-time attack scenarios and verify defense signals with zero manual database
          edits (SPEC Section 8.1 & Section 11).
        </p>
      </div>

      {/* Result notification */}
      {simResult && (
        <div className="p-4 bg-verdict-verified-bg border-flat border-verdict-verified text-ink space-y-1">
          <div className="flex items-center gap-2 font-bold text-lg text-verdict-verified">
            <CheckCircle className="w-6 h-6" />
            <span>Simulation Succeeded: {simResult.action}</span>
          </div>
          <p className="text-base">{simResult.message}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-verdict-danger-bg border-flat border-verdict-danger text-ink">
          <p className="font-bold">Simulation Failed: {errorMsg}</p>
        </div>
      )}

      {/* The 4 Direct Simulation Buttons (SPEC 8.1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Button 1: QR Swap */}
        <div className="bg-white p-5 border-flat shadow-flat-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono font-bold uppercase text-terracotta px-2 py-0.5 bg-paper border-flat">
                Attack 1: Physical Sticker Swap
              </span>
            </div>
            <h3 className="text-xl font-bold text-ink flex items-center gap-2">
              <Repeat className="w-5 h-5 text-verdict-danger" />
              <span>Simulate QR Swap at Shop</span>
            </h3>
            <p className="text-sm text-stone-600 mt-1">
              Simulates a malicious scammer swapping the payment QR on the counter of KIR-0001 with{' '}
              <span className="font-mono text-xs">scammer.swap@ybl</span>.
            </p>
          </div>

          <button
            onClick={() => runSimulation('qr_swap')}
            disabled={isLoading}
            className="w-full py-3 bg-terracotta text-white font-bold text-base border-flat shadow-flat-sm hover:bg-terracotta-hover active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            <span>Trigger QR Swap Alert</span>
          </button>
        </div>

        {/* Button 2: Crowd Payee Drift */}
        <div className="bg-white p-5 border-flat shadow-flat-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono font-bold uppercase text-terracotta px-2 py-0.5 bg-paper border-flat">
                Attack 2: Street Payee Drift
              </span>
            </div>
            <h3 className="text-xl font-bold text-ink flex items-center gap-2">
              <Radio className="w-5 h-5 text-verdict-caution" />
              <span>Simulate Crowd Payee Drift</span>
            </h3>
            <p className="text-sm text-stone-600 mt-1">
              Establishes 9 baseline scans for a dominant payee at an unregistered corner, then scans
              a new payee causing a crowd drift CAUTION.
            </p>
          </div>

          <button
            onClick={() => runSimulation('drift')}
            disabled={isLoading}
            className="w-full py-3 bg-paper-dark text-ink font-bold text-base border-flat shadow-flat-sm hover:bg-stone-300 active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Radio className="w-5 h-5" />}
            <span>Inject Baseline & Drift</span>
          </button>
        </div>

        {/* Button 3: Scam Message with UPI ID */}
        <div className="bg-white p-5 border-flat shadow-flat-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono font-bold uppercase text-terracotta px-2 py-0.5 bg-paper border-flat">
                Attack 3: Cross-Channel Story Link
              </span>
            </div>
            <h3 className="text-xl font-bold text-ink flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-verdict-danger" />
              <span>Submit Scam Message with Payee</span>
            </h3>
            <p className="text-sm text-stone-600 mt-1">
              Submits a fake CBI digital arrest threat message. Flags payee{' '}
              <span className="font-mono text-xs">officer.cbi.investigation@okaxis</span> in the
              database.
            </p>
          </div>

          <button
            onClick={() => runSimulation('scam_with_payee')}
            disabled={isLoading}
            className="w-full py-3 bg-terracotta text-white font-bold text-base border-flat shadow-flat-sm hover:bg-terracotta-hover active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileWarning className="w-5 h-5" />}
            <span>Submit Scam & Flag Payee</span>
          </button>
        </div>

        {/* Button 4: Reset Data */}
        <div className="bg-white p-5 border-flat shadow-flat-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono font-bold uppercase text-stone-600 px-2 py-0.5 bg-paper border-flat">
                Maintenance: Clean State
              </span>
            </div>
            <h3 className="text-xl font-bold text-ink flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-stone-700" />
              <span>Reset Database to Clean Seed</span>
            </h3>
            <p className="text-sm text-stone-600 mt-1">
              Wipes demo scans, alerts, and messages, leaving exactly the 20 clean registered kirana
              shops for a fresh demo run.
            </p>
          </div>

          <button
            onClick={() => runSimulation('reset')}
            disabled={isLoading}
            className="w-full py-3 bg-stone-800 text-white font-bold text-base border-flat shadow-flat-sm hover:bg-black active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
            <span>Reset Demo DB</span>
          </button>
        </div>
      </div>

      {/* Guided 4-Step Section 11 Demo Script Walkthrough */}
      <div className="bg-paper-dark border-flat shadow-flat p-6 space-y-4">
        <h3 className="text-xl font-bold text-ink flex items-center gap-2">
          <PlayCircle className="w-6 h-6 text-terracotta" />
          <span>Section 11 — 4-Minute Live Demo Script</span>
        </h3>
        <p className="text-sm text-stone-700">
          Follow these 4 steps in order to demonstrate QRaksha-Kavach to judges or evaluators:
        </p>

        <div className="space-y-3 text-base">
          {/* Step 1 */}
          <div className="p-4 bg-white border-flat space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-terracotta">Step 1: Real Shop vs. Swapped QR</span>
              <button
                onClick={onNavigateToCheck}
                className="text-sm font-bold text-stone-800 hover:text-terracotta flex items-center gap-1 underline"
              >
                <span>Go to Check</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-stone-800">
              Check genuine QR at <strong>KIR-0001</strong> (shows <strong>VERIFIED</strong> green).
              Next, trigger <strong>Simulate QR Swap</strong> above. Check again: shows{' '}
              <strong>DANGER</strong> red and raises an alert on the{' '}
              <button onClick={onNavigateToMerchant} className="font-bold underline text-terracotta">
                Merchant Screen
              </button>
              .
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 bg-white border-flat space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-terracotta">
                Step 2: Cross-Channel Scam Story Linking
              </span>
              <button
                onClick={onNavigateToCheck}
                className="text-sm font-bold text-stone-800 hover:text-terracotta flex items-center gap-1 underline"
              >
                <span>Go to Check</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-stone-800">
              Click <strong>Submit Scam Message with Payee</strong> above to ingest a digital arrest
              message. Then scan a QR using{' '}
              <span className="font-mono text-xs font-bold">officer.cbi.investigation@okaxis</span>:
              it immediately outputs <strong>DANGER</strong> quoting the exact scam message text and
              date!
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 bg-white border-flat space-y-2">
            <span className="font-bold text-terracotta block">
              Step 3: Multilingual Voice Verdict
            </span>
            <p className="text-stone-800">
              On the Result screen, toggle to <strong>తెలుగు (Telugu)</strong> and click{' '}
              <strong>Listen</strong>. The system plays the pre-recorded Telugu alert tone and
              synthesizes spoken next steps: "Never enter your UPI PIN to receive money; call 1930 if
              lost."
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-4 bg-white border-flat space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-terracotta">Step 4: Live Evaluation Metrics</span>
              <button
                onClick={onNavigateToMetrics}
                className="text-sm font-bold text-stone-800 hover:text-terracotta flex items-center gap-1 underline"
              >
                <span>View Metrics</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-stone-800">
              Review 100% deterministic scenario accuracy, 95% held-out test message accuracy (0%
              false positive rate), and sub-50ms rule response latencies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
