import React, { useState } from 'react';
import {
  ShieldCheck,
  Store,
  Sparkles,
  BarChart3,
  Search,
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

  // Titles in multiple languages
  const titles = {
    en: {
      brand: 'QRaksha-Kavach',
      tagline: 'Check Before You Pay',
      checkTab: 'Check',
      merchantTab: 'Merchant',
      demoTab: 'Demo',
      metricsTab: 'Metrics',
    },
    te: {
      brand: 'క్యూఆర్ రక్షా కవచ్',
      tagline: 'చెల్లించే ముందు తనిఖీ చేయండి',
      checkTab: 'తనిఖీ',
      merchantTab: 'దుకాణం',
      demoTab: 'డెమో',
      metricsTab: 'గణాంకాలు',
    },
    hi: {
      brand: 'क्यूआर रक्षा कवच',
      tagline: 'भुगतान से पहले जांचें',
      checkTab: 'जांचें',
      merchantTab: 'व्यापारी',
      demoTab: 'डेमो',
      metricsTab: 'आंकड़े',
    },
  };

  const t = titles[globalLang] || titles.en;

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink pb-24 sm:pb-8">
      {/* Top Header */}
      <header className="bg-paper-dark border-b-2 border-stone-900 sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => {
              setCurrentResult(null);
              setActiveTab('check');
            }}
          >
            <div className="w-10 h-10 bg-terracotta border-flat flex items-center justify-center text-white shadow-flat-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-xl sm:text-2xl tracking-tight block leading-tight text-ink">
                {t.brand}
              </span>
              <span className="text-xs font-bold text-terracotta uppercase tracking-wider block">
                {t.tagline}
              </span>
            </div>
          </div>

          {/* Global Language Toggle */}
          <div className="flex border-flat bg-white text-sm font-bold shadow-flat-sm">
            <button
              onClick={() => setGlobalLang('en')}
              className={`px-2.5 py-1 ${
                globalLang === 'en' ? 'bg-terracotta text-white' : 'text-ink hover:bg-stone-100'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setGlobalLang('te')}
              className={`px-2.5 py-1 border-l-2 border-r-2 border-stone-900 ${
                globalLang === 'te' ? 'bg-terracotta text-white' : 'text-ink hover:bg-stone-100'
              }`}
            >
              తెలుగు
            </button>
            <button
              onClick={() => setGlobalLang('hi')}
              className={`px-2.5 py-1 ${
                globalLang === 'hi' ? 'bg-terracotta text-white' : 'text-ink hover:bg-stone-100'
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area (Mobile Viewport Optimized) */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6">
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

      {/* Bottom Sticky Navigation Bar for Mobile-first Accessibility */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-stone-900 shadow-flat">
        <div className="max-w-xl mx-auto flex items-center justify-around">
          {/* Tab 1: Check */}
          <button
            onClick={() => {
              setCurrentResult(null);
              setActiveTab('check');
            }}
            className={`flex-1 py-3 flex flex-col items-center justify-center font-bold text-sm transition-colors ${
              activeTab === 'check' || activeTab === 'result'
                ? 'bg-terracotta text-white'
                : 'text-stone-700 hover:bg-paper-dark'
            }`}
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span>{t.checkTab}</span>
          </button>

          {/* Tab 2: Merchant */}
          <button
            onClick={() => setActiveTab('merchant')}
            className={`flex-1 py-3 flex flex-col items-center justify-center font-bold text-sm transition-colors border-l-2 border-r-2 border-stone-900 ${
              activeTab === 'merchant'
                ? 'bg-terracotta text-white'
                : 'text-stone-700 hover:bg-paper-dark'
            }`}
          >
            <Store className="w-5 h-5 mb-0.5" />
            <span>{t.merchantTab}</span>
          </button>

          {/* Tab 3: Demo Panel */}
          <button
            onClick={() => setActiveTab('demo')}
            className={`flex-1 py-3 flex flex-col items-center justify-center font-bold text-sm transition-colors border-r-2 border-stone-900 ${
              activeTab === 'demo'
                ? 'bg-terracotta text-white'
                : 'text-stone-700 hover:bg-paper-dark'
            }`}
          >
            <Sparkles className="w-5 h-5 mb-0.5" />
            <span>{t.demoTab}</span>
          </button>

          {/* Tab 4: Metrics */}
          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex-1 py-3 flex flex-col items-center justify-center font-bold text-sm transition-colors ${
              activeTab === 'metrics'
                ? 'bg-terracotta text-white'
                : 'text-stone-700 hover:bg-paper-dark'
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
