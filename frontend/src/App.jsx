import React, { useState } from 'react';
import {
  ShieldCheck,
  Store,
  Sparkles,
  BarChart3,
  Search,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import CheckScreen from './CheckScreen';
import ResultScreen from './ResultScreen';
import MerchantScreen from './MerchantScreen';
import DemoPanelScreen from './DemoPanelScreen';
import MetricsScreen from './MetricsScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState('check'); // 'check' | 'merchant' | 'demo' | 'metrics'
  const [currentResult, setCurrentResult] = useState(null);
  const [globalLang, setGlobalLang] = useState('en'); // 'en' | 'te' | 'hi'

  const handleResultReceived = (resultData) => {
    setCurrentResult(resultData);
    setActiveTab('result');
  };

  const handleBackToCheck = () => {
    setCurrentResult(null);
    setActiveTab('check');
  };

  // Multilingual translations
  const titles = {
    en: {
      brand: 'QRaksha-Kavach',
      tagline: 'Check Before You Pay',
      subtitle: 'Verified Kirana & Payment Defense',
      statusReady: 'Offline-Ready Protection',
      checkTab: 'Check',
      merchantTab: 'Merchant',
      demoTab: 'Demo Panel',
      metricsTab: 'Metrics',
      privacyBadge: 'Zero PIN/OTP collection • Privacy-First',
    },
    te: {
      brand: 'క్యూఆర్ రక్షా కవచ్',
      tagline: 'చెల్లించే ముందు తనిఖీ చేయండి',
      subtitle: 'కిరాణా దుకాణం & మోసాల రక్షణ',
      statusReady: 'ఆఫ్‌లైన్ భద్రత సిద్ధం',
      checkTab: 'తనిఖీ',
      merchantTab: 'దుకాణం',
      demoTab: 'డెమో ప్యానెల్',
      metricsTab: 'గణాంకాలు',
      privacyBadge: 'పిన్ / ఓటీపీ తీసుకోము • పూర్తి గోప్యత',
    },
    hi: {
      brand: 'क्यूआर रक्षा कवच',
      tagline: 'भुगतान से पहले जांचें',
      subtitle: 'किराना दुकान एवं भुगतान सुरक्षा',
      statusReady: 'सुरक्षा कवच सक्रिय',
      checkTab: 'जांचें',
      merchantTab: 'व्यापारी',
      demoTab: 'डेमो पैनल',
      metricsTab: 'आंकड़े',
      privacyBadge: 'पिन/ओटीपी कभी न दें • पूर्ण गोपनीयता',
    },
  };

  const t = titles[globalLang] || titles.en;

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink pb-24 sm:pb-10 selection:bg-terracotta selection:text-white">
      {/* Top Header */}
      <header className="bg-paper-cream border-b-2 border-ink sticky top-0 z-40 backdrop-blur-md bg-opacity-95 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none group"
            onClick={() => {
              setCurrentResult(null);
              setActiveTab('check');
            }}
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-terracotta border-flat flex items-center justify-center text-white shadow-flat-sm group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight leading-tight text-ink">
                  {t.brand}
                </span>
              </div>
              <span className="text-xs font-bold text-terracotta tracking-wide uppercase flex items-center gap-1.5">
                <span>{t.tagline}</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-forest animate-pulse"></span>
              </span>
            </div>
          </div>

          {/* Global Language Toggle */}
          <div className="flex border-flat bg-white text-xs sm:text-sm font-bold shadow-flat-sm overflow-hidden">
            <button
              onClick={() => setGlobalLang('en')}
              className={`px-2.5 sm:px-3 py-1 transition-all ${
                globalLang === 'en'
                  ? 'bg-terracotta text-white font-extrabold'
                  : 'text-ink hover:bg-paper-dark'
              }`}
              title="English"
            >
              EN
            </button>
            <button
              onClick={() => setGlobalLang('te')}
              className={`px-2.5 sm:px-3 py-1 border-l-2 border-r-2 border-ink transition-all ${
                globalLang === 'te'
                  ? 'bg-terracotta text-white font-extrabold'
                  : 'text-ink hover:bg-paper-dark'
              }`}
              title="తెలుగు (Telugu)"
            >
              తెలుగు
            </button>
            <button
              onClick={() => setGlobalLang('hi')}
              className={`px-2.5 sm:px-3 py-1 transition-all ${
                globalLang === 'hi'
                  ? 'bg-terracotta text-white font-extrabold'
                  : 'text-ink hover:bg-paper-dark'
              }`}
              title="हिंदी (Hindi)"
            >
              हिंदी
            </button>
          </div>
        </div>

        {/* Reassuring Micro-Badge Bar */}
        <div className="bg-paper-dark border-t border-ink/15 py-1 px-4 text-xs font-mono font-medium text-ink-muted flex items-center justify-between max-w-xl mx-auto">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-forest" />
            <span>{t.privacyBadge}</span>
          </span>
          <span className="flex items-center gap-1 text-forest font-bold">
            <span className="w-2 h-2 rounded-full bg-forest"></span>
            <span>{t.statusReady}</span>
          </span>
        </div>
      </header>

      {/* Main Content Area (Optimized for Mobile & Desktop) */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-5">
        {activeTab === 'check' && (
          <CheckScreen onResultReceived={handleResultReceived} currentLang={globalLang} />
        )}

        {activeTab === 'result' && (
          <ResultScreen
            result={currentResult}
            onBack={handleBackToCheck}
            initialLang={globalLang}
          />
        )}

        {activeTab === 'merchant' && <MerchantScreen />}

        {activeTab === 'demo' && (
          <DemoPanelScreen
            onNavigateToCheck={() => setActiveTab('check')}
            onNavigateToMerchant={() => setActiveTab('merchant')}
            onNavigateToMetrics={() => setActiveTab('metrics')}
          />
        )}

        {activeTab === 'metrics' && <MetricsScreen />}
      </main>

      {/* Bottom Sticky Navigation Bar with Tactile Feedback */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-paper-cream border-t-2 border-ink shadow-flat">
        <div className="max-w-xl mx-auto flex items-center justify-around">
          {/* Tab 1: Check */}
          <button
            onClick={() => {
              setCurrentResult(null);
              setActiveTab('check');
            }}
            className={`flex-1 py-2.5 sm:py-3 flex flex-col items-center justify-center font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'check' || activeTab === 'result'
                ? 'bg-terracotta text-white shadow-inner font-extrabold'
                : 'text-ink-muted hover:text-ink hover:bg-paper-dark'
            }`}
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span>{t.checkTab}</span>
          </button>

          {/* Tab 2: Merchant */}
          <button
            onClick={() => setActiveTab('merchant')}
            className={`flex-1 py-2.5 sm:py-3 flex flex-col items-center justify-center font-bold text-xs sm:text-sm transition-all border-l-2 border-r-2 border-ink ${
              activeTab === 'merchant'
                ? 'bg-terracotta text-white shadow-inner font-extrabold'
                : 'text-ink-muted hover:text-ink hover:bg-paper-dark'
            }`}
          >
            <Store className="w-5 h-5 mb-0.5" />
            <span>{t.merchantTab}</span>
          </button>

          {/* Tab 3: Demo Panel */}
          <button
            onClick={() => setActiveTab('demo')}
            className={`flex-1 py-2.5 sm:py-3 flex flex-col items-center justify-center font-bold text-xs sm:text-sm transition-all border-r-2 border-ink ${
              activeTab === 'demo'
                ? 'bg-terracotta text-white shadow-inner font-extrabold'
                : 'text-ink-muted hover:text-ink hover:bg-paper-dark'
            }`}
          >
            <Sparkles className="w-5 h-5 mb-0.5" />
            <span>{t.demoTab}</span>
          </button>

          {/* Tab 4: Metrics */}
          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex-1 py-2.5 sm:py-3 flex flex-col items-center justify-center font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'metrics'
                ? 'bg-terracotta text-white shadow-inner font-extrabold'
                : 'text-ink-muted hover:text-ink hover:bg-paper-dark'
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-0.5" />
            <span>{t.metricsTab}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
