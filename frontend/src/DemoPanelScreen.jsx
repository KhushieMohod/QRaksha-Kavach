import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Repeat,
  Radio,
  FileWarning,
  RotateCcw,
  CheckCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { simulateDemoAction } from './api';
import { translate } from './i18n';

export default function DemoPanelScreen({ lang = 'en' }) {
  const t = (key) => translate(lang, key);

  const [simResult, setSimResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const runSimulation = async (action) => {
    setIsLoading(true);
    setErrorMsg('');
    setSimResult(null);
    try {
      const res = await simulateDemoAction(action, 'KIR-0001');
      setSimResult(res);
    } catch (err) {
      setErrorMsg(err.message || 'Simulation error');
    } finally {
      setIsLoading(false);
    }
  };

  const simCards = [
    {
      action: 'qr_swap',
      title: lang === 'te'
        ? 'దుకాణంలో QR మార్పిడిని అనుకరించండి'
        : lang === 'hi'
        ? 'दुकान पर QR बदलाव का अनुकरण करें'
        : 'Simulate QR Swap at Shop',
      desc: lang === 'te'
        ? 'KIR-0001 కౌంటర్‌పై scammer.swap@ybl అనే నకిలీ స్టిక్కర్ ఉన్నట్లు అనుకరిస్తుంది.'
        : lang === 'hi'
        ? 'KIR-0001 काउंटर पर scammer.swap@ybl नकली स्टिकर लगाने का अनुकरण करता है।'
        : 'Simulates a malicious sticker placed on KIR-0001 counter with scammer.swap@ybl.',
      btnLabel: lang === 'te' ? 'QR మార్పిడిని పరీక్షించండి' : lang === 'hi' ? 'QR बदलाव जांचें' : 'Trigger QR Swap',
      icon: <Repeat className="w-6 h-6 text-danger" />,
      btnCls: 'btn-primary bg-danger hover:bg-danger-dark',
    },
    {
      action: 'drift',
      title: lang === 'te'
        ? 'చెల్లింపుదారు మార్పును అనుకరించండి'
        : lang === 'hi'
        ? 'भुगतानकर्ता बदलाव का अनुकरण करें'
        : 'Simulate Payee Change',
      desc: lang === 'te'
        ? 'నమోదుకాని ప్రదేశంలో సాధారణ స్కాన్‌ల తర్వాత కొత్త చెల్లింపుదారుతో మార్పును చూపిస్తుంది.'
        : lang === 'hi'
        ? 'अपंजीकृत स्थान पर नियमित स्कैन के बाद अचानक नए प्राप्तकर्ता का बदलाव दिखाता है।'
        : 'Simulates a sudden payee change at an unregistered spot after steady baseline scans.',
      btnLabel: lang === 'te' ? 'మార్పును పరీక్షించండి' : lang === 'hi' ? 'बदलाव जांचें' : 'Simulate Drift',
      icon: <Radio className="w-6 h-6 text-caution" />,
      btnCls: 'btn-secondary',
    },
    {
      action: 'scam_with_payee',
      title: lang === 'te'
        ? 'UPI ID ఉన్న మోస సందేశం పంపండి'
        : lang === 'hi'
        ? 'UPI ID वाला धोखाधड़ी संदेश भेजें'
        : 'Send Scam Message with UPI ID',
      desc: lang === 'te'
        ? 'నకిలీ CBI డిజిటల్ అరెస్ట్ నోటీసును సమర్పించి, scam payeeని డేటాబేస్‌లో గుర్తిస్తుంది.'
        : lang === 'hi'
        ? 'नकली डिजिटल अरेस्ट नोटिस दर्ज कर scam payee को डेटाबेस में चिह्नित करता है।'
        : 'Submits a fake digital arrest extortion SMS flagging officer.cbi.investigation@okaxis in DB.',
      btnLabel: lang === 'te' ? 'మోస సందేశం పంపండి' : lang === 'hi' ? 'संदेश भेजें' : 'Submit Scam Message',
      icon: <FileWarning className="w-6 h-6 text-danger" />,
      btnCls: 'btn-primary bg-danger hover:bg-danger-dark',
    },
    {
      action: 'reset',
      title: lang === 'te'
        ? 'డెమో డేటాను రీసెట్ చేయండి'
        : lang === 'hi'
        ? 'डेमो डेटा रीसेट करें'
        : 'Reset Demo Data',
      desc: lang === 'te'
        ? 'డెమో స్కాన్‌లు, హెచ్చరికలు తొలగించి, 20 నమోదైన దుకాణాలను పునరుద్ధరిస్తుంది.'
        : lang === 'hi'
        ? 'डेमो स्कैन और अलर्ट हटाकर 20 पंजीकृत किराना दुकानों को पुनर्स्थापित करता है।'
        : 'Restores clean baseline database with 20 registered kirana shops.',
      btnLabel: lang === 'te' ? 'డేటా రీసెట్' : lang === 'hi' ? 'डेटा रीसेट' : 'Reset Database',
      icon: <RotateCcw className="w-6 h-6 text-ink-secondary" />,
      btnCls: 'btn-secondary',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="card space-y-2">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-6 h-6 text-spruce shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">
            {lang === 'te'
              ? 'దాడి మరియు రక్షణ అనుకరణ'
              : lang === 'hi'
              ? 'हमला और सुरक्षा सिमुलेशन'
              : 'Interactive Attack Simulator'}
          </h1>
        </div>
        <p className="text-base sm:text-lg text-ink-secondary max-w-2xl">
          {lang === 'te'
            ? 'వివిధ మోసపూరిత దృశ్యాలను పరీక్షించి, రక్షణ వ్యవస్థ ఎలా స్పందిస్తుందో ప్రత్యక్షంగా చూడండి.'
            : lang === 'hi'
            ? 'विभिन्न धोखाधड़ी परिदृश्यों का परीक्षण करें और देखें कि सुरक्षा प्रणाली कैसे प्रतिक्रिया देती है।'
            : 'Test real-time attack scenarios and verify defense signals live without manual database edits.'}
        </p>
      </div>

      {/* ── Feedback Notification ─────────────────────────────────────────── */}
      {simResult && (
        <div className="p-5 rounded-2xl bg-[#ECFDF5] border border-[#86EFAC] space-y-1.5 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 font-bold text-lg text-verified">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>
              {lang === 'te' ? 'అనుకరణ పూర్తయింది' : lang === 'hi' ? 'सिमुलेशन संपन्न' : 'Simulation Completed'}
            </span>
          </div>
          <p className="text-base text-ink font-medium leading-relaxed">
            {simResult.message}
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="p-5 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-1 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 font-bold text-lg text-danger">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              {lang === 'te' ? 'అనుకరణ విఫలమైంది' : lang === 'hi' ? 'सिमुलेशन विफल' : 'Simulation Failed'}
            </span>
          </div>
          <p className="text-base text-danger-dark font-medium">
            {errorMsg}
          </p>
        </div>
      )}

      {/* ── Clean 2x2 Grid of 4 Simulation Buttons ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {simCards.map((card) => (
          <div
            key={card.action}
            className="card flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-canvas border border-hairline flex items-center justify-center">
                {card.icon}
              </div>
              <h2 className="text-xl font-bold text-ink">
                {card.title}
              </h2>
              <p className="text-base sm:text-lg text-ink-secondary leading-relaxed">
                {card.desc}
              </p>
            </div>

            <button
              onClick={() => runSimulation(card.action)}
              disabled={isLoading}
              className={`${card.btnCls} w-full py-3.5 text-base sm:text-lg font-medium flex items-center justify-center gap-2`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              <span>{card.btnLabel}</span>
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
