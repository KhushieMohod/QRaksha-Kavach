import React, { useState } from 'react';
import { ShieldCheck, Store, Sparkles, BarChart3, ScanLine, Shield } from 'lucide-react';
import CheckScreen from './CheckScreen';
import ResultScreen from './ResultScreen';
import MerchantScreen from './MerchantScreen';
import DemoPanelScreen from './DemoPanelScreen';
import MetricsScreen from './MetricsScreen';
import Chatbot from './Chatbot';

const LANG_OPTIONS = [
  { code: 'en', label: 'EN', title: 'English' },
  { code: 'te', label: 'తెలుగు', title: 'Telugu' },
  { code: 'hi', label: 'हिंदी', title: 'Hindi' },
];

const NAV_TABS = [
  { id: 'check',    Icon: ScanLine,  labelKey: 'checkTab'   },
  { id: 'merchant', Icon: Store,     labelKey: 'merchantTab' },
  { id: 'demo',     Icon: Sparkles,  labelKey: 'demoTab'    },
  { id: 'metrics',  Icon: BarChart3, labelKey: 'metricsTab' },
];

const UI_TEXT = {
  en: {
    brand:       'QRaksha-Kavach',
    tagline:     'Check Before You Pay',
    privacyNote: 'QRaksha-Kavach never collects UPI PINs, OTPs, or exact GPS coordinates · 100% offline-ready protection',
    checkTab:    'Check',
    merchantTab: 'Merchant',
    demoTab:     'Demo',
    metricsTab:  'Metrics',
  },
  te: {
    brand:       'క్యూఆర్ రక్షా కవచ్',
    tagline:     'చెల్లించే ముందు తనిఖీ చేయండి',
    privacyNote: 'QRaksha-Kavach మీ UPI PIN, OTP లేదా ఖచ్చితమైన GPS ఎప్పుడూ సేకరించదు · 100% ఆఫ్‌లైన్ రక్షణ',
    checkTab:    'తనిఖీ',
    merchantTab: 'వ్యాపారి',
    demoTab:     'డెమో',
    metricsTab:  'గణాంకాలు',
  },
  hi: {
    brand:       'क्यूआर रक्षा कवच',
    tagline:     'भुगतान से पहले जांचें',
    privacyNote: 'QRaksha-Kavach कभी भी UPI PIN, OTP या सटीक GPS एकत्र नहीं करता · 100% ऑफ़लाइन सुरक्षा',
    checkTab:    'जांचें',
    merchantTab: 'व्यापारी',
    demoTab:     'डेमो',
    metricsTab:  'आंकड़े',
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState('check');
  const [currentResult, setCurrentResult] = useState(null);
  const [lang, setLang] = useState('en');
  const [checkResetKey, setCheckResetKey] = useState(0);

  const t = UI_TEXT[lang] || UI_TEXT.en;

  const navigateToCheckHome = () => {
    setCurrentResult(null);
    setActiveTab('check');
    setCheckResetKey((prev) => prev + 1);
  };

  const handleResultReceived = (resultData) => {
    setCurrentResult(resultData);
    setActiveTab('result');
  };

  const handleBackToCheck = () => {
    setCurrentResult(null);
    setActiveTab('check');
    setCheckResetKey((prev) => prev + 1);
  };

  const isCheckActive = activeTab === 'check' || activeTab === 'result';

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink antialiased">

      {/* ── Top Navigation Bar (Desktop & Mobile Header) ────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-hairline shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">

          {/* Logo & Brand */}
          <button
            onClick={navigateToCheckHome}
            className="flex items-center gap-3 text-left group shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-spruce flex items-center justify-center shrink-0 shadow-sm group-hover:bg-spruce-hover transition-colors">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl sm:text-2xl leading-none tracking-tight text-ink block">
                {t.brand}
              </span>
              <span className="text-xs sm:text-sm font-medium text-ink-secondary leading-tight block mt-0.5">
                {t.tagline}
              </span>
            </div>
          </button>

          {/* Center Navigation Tabs (Desktop only) */}
          <nav className="hidden md:flex items-center gap-1 bg-canvas p-1 rounded-xl border border-hairline">
            {NAV_TABS.map(({ id, Icon, labelKey }) => {
              const isActive = id === 'check' ? isCheckActive : activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    if (id === 'check') {
                      navigateToCheckHome();
                    } else {
                      setCurrentResult(null);
                      setActiveTab(id);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium transition-all ${
                    isActive
                      ? 'bg-white text-spruce shadow-sm font-bold border border-hairline'
                      : 'text-ink-secondary hover:text-ink hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-spruce' : 'text-ink-muted'}`} />
                  <span>{t[labelKey]}</span>
                </button>
              );
            })}
          </nav>

          {/* Language Switcher */}
          <div className="flex items-center bg-canvas p-1 rounded-xl border border-hairline shrink-0">
            {LANG_OPTIONS.map(({ code, label, title }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                title={title}
                className={`px-3 py-1.5 rounded-lg text-sm sm:text-base font-medium transition-all ${
                  lang === code
                    ? 'bg-spruce text-white shadow-sm font-bold'
                    : 'text-ink-secondary hover:text-ink hover:bg-white/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

        </div>
      </header>

      {/* ── Main Responsive Content Area ───────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8">
        {activeTab === 'check'    && <CheckScreen key={checkResetKey} onResultReceived={handleResultReceived} lang={lang} />}
        {activeTab === 'result'   && <ResultScreen result={currentResult} onBack={handleBackToCheck} lang={lang} />}
        {activeTab === 'merchant' && <MerchantScreen lang={lang} />}
        {activeTab === 'demo'     && (
          <DemoPanelScreen
            onNavigateToCheck={navigateToCheckHome}
            onNavigateToMerchant={() => setActiveTab('merchant')}
            onNavigateToMetrics={()  => setActiveTab('metrics')}
            lang={lang}
          />
        )}
        {activeTab === 'metrics'  && <MetricsScreen lang={lang} />}
      </main>

      {/* ── Quiet Privacy Footer ───────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-hairline py-4 px-4 sm:px-8 bg-white/60 text-center text-sm text-ink-muted pb-20 md:pb-4">
        <p className="max-w-4xl mx-auto flex items-center justify-center gap-2">
          <Shield className="w-4 h-4 text-spruce shrink-0 inline" />
          <span>{t.privacyNote}</span>
        </p>
      </footer>

      <Chatbot lang={lang} />

      {/* ── Bottom Navigation — Mobile Only (`md:hidden`) ──────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-hairline shadow-lg md:hidden">
        <div className="max-w-md mx-auto flex">
          {NAV_TABS.map(({ id, Icon, labelKey }) => {
            const isActive = id === 'check' ? isCheckActive : activeTab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (id === 'check') {
                    navigateToCheckHome();
                  } else {
                    setCurrentResult(null);
                    setActiveTab(id);
                  }
                }}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-medium transition-colors ${
                  isActive ? 'text-spruce font-bold' : 'text-ink-secondary hover:text-ink'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-spruce' : 'text-ink-muted'}`} />
                <span>{t[labelKey]}</span>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
