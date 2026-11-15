import React, { useEffect, useState } from 'react';
import {
  Store,
  ShieldCheck,
  AlertTriangle,
  Bell,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  UserPlus,
} from 'lucide-react';
import { getMerchants, getMerchantAlerts, registerMerchant } from './api';
import { translate } from './i18n';

export default function MerchantScreen({ lang = 'en' }) {
  const t = (key, vals) => translate(lang, key, vals);

  const [merchants, setMerchants] = useState([]);
  const [selectedShopCode, setSelectedShopCode] = useState('KIR-0001');
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    upi_id: '',
    lat: '17.385',
    lng: '78.487',
    shop_code: '',
    category: 'kirana',
  });
  const [regMessage, setRegMessage] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  useEffect(() => {
    loadMerchants();
  }, []);

  useEffect(() => {
    if (selectedShopCode) {
      loadAlerts(selectedShopCode);
    }
  }, [selectedShopCode]);

  const loadMerchants = async () => {
    try {
      const data = await getMerchants();
      setMerchants(data);
      if (data.length > 0 && !selectedShopCode) {
        setSelectedShopCode(data[0].shop_code);
      }
    } catch (err) {
      console.error('Error loading merchants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAlerts = async (code) => {
    try {
      const alertData = await getMerchantAlerts(code);
      setAlerts(alertData);
    } catch (err) {
      console.error('Error loading alerts:', err);
      setAlerts([]);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegMessage('');
    setRegSuccess(false);
    try {
      const payload = {
        name: regForm.name.trim(),
        upi_id: regForm.upi_id.trim().toLowerCase(),
        lat: parseFloat(regForm.lat),
        lng: parseFloat(regForm.lng),
        shop_code: regForm.shop_code ? regForm.shop_code.trim().toUpperCase() : null,
        category: regForm.category,
      };
      const res = await registerMerchant(payload);
      setRegMessage(
        lang === 'te'
          ? `దుకాణం విజయవంతంగా నమోదైంది: ${res.shop_code} (${res.name})`
          : lang === 'hi'
          ? `दुकान सफलतापूर्वक पंजीकृत: ${res.shop_code} (${res.name})`
          : `Shop successfully registered: ${res.shop_code} (${res.name})`
      );
      setRegSuccess(true);
      setIsRegisterOpen(false);
      setRegForm({
        name: '',
        upi_id: '',
        lat: '17.385',
        lng: '78.487',
        shop_code: '',
        category: 'kirana',
      });
      await loadMerchants();
      setSelectedShopCode(res.shop_code);
    } catch (err) {
      setRegMessage(`Registration failed: ${err.message}`);
      setRegSuccess(false);
    }
  };

  const currentMerchant =
    merchants.find((m) => m.shop_code === selectedShopCode) || merchants[0] || null;
  const hasActiveAlert = alerts.length > 0;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Page Header & Shop Selector ───────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Store className="w-6 h-6 text-spruce shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold text-ink">
              {lang === 'te'
                ? 'వ్యాపారి రక్షణ కేంద్రం'
                : lang === 'hi'
                ? 'दुकानदार सुरक्षा केंद्र'
                : 'Merchant Security Portal'}
            </h1>
          </div>
          <button
            onClick={() => { if (selectedShopCode) loadAlerts(selectedShopCode); }}
            className="btn-secondary text-sm py-2 px-3 self-start sm:self-auto flex items-center gap-1.5"
            title="Refresh alerts"
          >
            <RefreshCw className="w-4 h-4 text-ink-secondary" />
            <span>{lang === 'te' ? 'రీఫ్రెష్' : lang === 'hi' ? 'रीफ़्रेश' : 'Refresh'}</span>
          </button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="merchantSelect" className="label text-sm">
            {lang === 'te'
              ? 'కిరాణా దుకాణాన్ని ఎంచుకోండి:'
              : lang === 'hi'
              ? 'किराना दुकान चुनें:'
              : 'Select Kirana Store:'}
          </label>
          <select
            id="merchantSelect"
            value={selectedShopCode}
            onChange={(e) => setSelectedShopCode(e.target.value)}
            className="input font-medium"
          >
            {merchants.map((m) => (
              <option key={m.shop_code} value={m.shop_code}>
                {m.shop_code} — {m.name} ({m.upi_id})
              </option>
            ))}
          </select>
        </div>

        {currentMerchant && (
          <div className="p-4 rounded-xl bg-canvas border border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-base">
            <div>
              <span className="text-ink-secondary font-medium">
                {lang === 'te' ? 'నమోదైన UPI VPA:' : lang === 'hi' ? 'पंजीकृत UPI VPA:' : 'Registered Payee VPA:'}{' '}
              </span>
              <span className="font-mono font-bold text-ink select-all">
                {currentMerchant.upi_id}
              </span>
            </div>
            <div className="text-sm text-ink-muted">
              {lang === 'te' ? 'దుకాణం కోడ్:' : lang === 'hi' ? 'दुकान कोड:' : 'Shop ID:'}{' '}
              <span className="font-mono font-semibold text-ink">{currentMerchant.shop_code}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Balanced 2-Column Desktop Grid for QR Health & Alerts ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Column 1: Bold QR Health Card (OK or ALERT) */}
        <div
          className={`card border-2 flex flex-col justify-between ${
            hasActiveAlert
              ? 'bg-[#FEF2F2] border-[#FCA5A5]'
              : 'bg-[#ECFDF5] border-[#86EFAC]'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  hasActiveAlert ? 'bg-white text-danger' : 'bg-white text-verified'
                }`}
              >
                {hasActiveAlert ? (
                  <AlertTriangle className="w-8 h-8 text-danger" />
                ) : (
                  <ShieldCheck className="w-8 h-8 text-verified" />
                )}
              </div>
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-ink-muted block">
                  {lang === 'te' ? 'కౌంటర్ QR స్థితి' : lang === 'hi' ? 'काउंटर QR स्थिति' : 'Counter QR Health Status'}
                </span>
                <h2
                  className={`text-2xl font-bold tracking-tight ${
                    hasActiveAlert ? 'text-danger' : 'text-verified'
                  }`}
                >
                  {hasActiveAlert
                    ? (lang === 'te' ? 'హెచ్చరిక: QR స్టిక్కర్ మార్చబడింది' : lang === 'hi' ? 'चेतावनी: QR स्टिकर बदला गया है' : 'ALERT: TAMPERED QR DETECTED')
                    : (lang === 'te' ? 'స్థితి బాగుంది: కౌంటర్ QR సురక్షితం' : lang === 'hi' ? 'स्थिति ठीक: काउंटर QR सुरक्षित' : 'STATUS OK: COUNTER QR SECURE')}
                </h2>
              </div>
            </div>

            <p className="text-base sm:text-lg text-ink font-medium leading-relaxed">
              {hasActiveAlert
                ? (lang === 'te'
                    ? `జాగ్రత్త! మీ కౌంటర్ వద్ద సరిపోలని UPI IDతో ${alerts.length} మోసపూరిత స్కాన్ యత్నాలు గుర్తించబడ్డాయి. దయచేసి కౌంటర్ స్టిక్కర్‌ను వెంటనే తనిఖీ చేయండి.`
                    : lang === 'hi'
                    ? `चेतावनी! आपके काउंटर पर भिन्न UPI ID के साथ ${alerts.length} धोखाधड़ी वाले स्कैन पाए गए। कृपया अपने काउंटर स्टिकर की तुरंत जांच करें।`
                    : `Warning: ${alerts.length} scan attempt(s) with mismatched payee IDs detected at your counter. Please inspect your counter standee immediately.`)
                : (lang === 'te'
                    ? `మీ కౌంటర్ వద్ద అన్ని స్కాన్‌లు మీ నమోదైన UPI ID (${currentMerchant?.upi_id || ''}) తో సరిపోలుతున్నాయి. ఎలాంటి స్టిక్కర్ మార్పిడి లేదు.`
                    : lang === 'hi'
                    ? `आपके काउंटर पर सभी स्कैन आपकी पंजीकृत UPI ID (${currentMerchant?.upi_id || ''}) से मेल खाते हैं। कोई छेड़छाड़ नहीं मिली।`
                    : `All customer scans match your registered UPI ID (${currentMerchant?.upi_id || ''}). Standee sticker is secure.`)}
            </p>
          </div>

          <div className="pt-4 mt-6 border-t border-hairline/60 flex items-center justify-between text-sm text-ink-secondary">
            <span>{lang === 'te' ? 'పరిరక్షణ విధానం' : lang === 'hi' ? 'सुरक्षा स्थिति' : 'Protection Mode'}</span>
            <span className="font-semibold text-spruce">
              {lang === 'te' ? 'నిరంతర నిఘా' : lang === 'hi' ? 'सक्रिय निगरानी' : 'Continuous 100m Cell Defense'}
            </span>
          </div>
        </div>

        {/* Column 2: Plain-English Security Alerts Feed */}
        <div className="card space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                <Bell className="w-5 h-5 text-spruce" />
                <span>
                  {lang === 'te'
                    ? `భద్రతా హెచ్చరికలు (${alerts.length})`
                    : lang === 'hi'
                    ? `सुरक्षा चेतावनियाँ (${alerts.length})`
                    : `Security Alerts (${alerts.length})`}
                </span>
              </h2>
              {alerts.length > 0 && (
                <span className="chip-danger">
                  {alerts.length} {lang === 'te' ? 'ముప్పు' : lang === 'hi' ? 'खतरे' : 'Active'}
                </span>
              )}
            </div>

            {alerts.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#ECFDF5] border border-[#86EFAC] flex items-center justify-center mx-auto text-verified">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-bold text-lg text-ink">
                    {lang === 'te'
                      ? 'కౌంటర్ మార్పిడి సంఘటనలు లేవు'
                      : lang === 'hi'
                      ? 'छेड़छाड़ की कोई घटना नहीं'
                      : 'Zero Tampering Incidents'}
                  </p>
                  <p className="text-base text-ink-secondary max-w-xs mx-auto mt-1">
                    {lang === 'te'
                      ? 'ఈ దుకాణంలో అనధికార చెల్లింపు IDలు ఏవీ నమోదు కాలేదు.'
                      : lang === 'hi'
                      ? 'इस दुकान पर कोई अनधिकृत भुगतान ID दर्ज नहीं हुई।'
                      : 'No unauthorized payees detected at this shop location.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {alerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-danger uppercase tracking-wide">
                        {lang === 'te' ? 'స్టిక్కర్ మార్పిడి హెచ్చరిక' : lang === 'hi' ? 'स्टिकर बदलाव चेतावनी' : 'Tampered Sticker Warning'}
                      </span>
                      <span className="text-ink-muted">
                        {al.created_at ? new Date(al.created_at).toLocaleTimeString() : 'Recent'}
                      </span>
                    </div>

                    <p className="text-base font-medium text-ink">
                      {lang === 'te' ? 'గుర్తించిన అనధికార చెల్లింపుదారు: ' : lang === 'hi' ? 'अनाधिकृत प्राप्तकर्ता: ' : 'Mismatched payee scanned: '}
                      <span className="font-mono font-bold text-danger bg-white px-2 py-0.5 rounded border border-[#FCA5A5]">
                        {al.scanned_upi}
                      </span>
                    </p>

                    <p className="text-sm text-danger-dark font-medium">
                      {lang === 'te'
                        ? '⚠️ కౌంటర్‌పై ఉన్న భౌతిక QR స్టిక్కర్‌ను వెంటనే పరిశీలించి తొలగించండి.'
                        : lang === 'hi'
                        ? '⚠️ काउंटर पर लगे QR स्टिकर की तुरंत जांच करें और अनाधिकृत स्टिकर हटाएं।'
                        : '⚠️ Please inspect your physical counter QR standee and remove any unauthorized overlay sticker.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-hairline text-xs text-ink-muted">
            {lang === 'te'
              ? 'గమనిక: కస్టమర్ స్కాన్ హెచ్చరిక వచ్చినప్పుడు కౌంటర్ సిబ్బంది అసలు స్టాండీని సరిచూడాలి.'
              : lang === 'hi'
              ? 'सूचना: ग्राहक द्वारा चेतावनी मिलने पर काउंटर कर्मचारी असली स्टैंडी की पुष्टि करें।'
              : 'Counter staff should verify the physical QR standee whenever a customer reports a mismatch.'}
          </div>
        </div>

      </div>

      {/* ── Clean Register Shop Form (Expandable) ─────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-spruce" />
              <span>
                {lang === 'te'
                  ? 'కొత్త కిరాణా దుకాణాన్ని నమోదు చేయండి'
                  : lang === 'hi'
                  ? 'नई किराना दुकान पंजीकृत करें'
                  : 'Register New Kirana Shop'}
              </span>
            </h2>
            <p className="text-base text-ink-secondary mt-0.5">
              {lang === 'te'
                ? 'దుకాణాన్ని 100 మీటర్ల సుమారు ప్రాంత రక్షణతో జతచేయండి'
                : lang === 'hi'
                ? 'दुकान को 100 मीटर के सुरक्षित क्षेत्र से जोड़ें'
                : 'Bind a shop counter to verified registry defense'}
            </p>
          </div>
          <button
            onClick={() => setIsRegisterOpen(!isRegisterOpen)}
            className="btn-secondary text-base flex items-center gap-1.5"
          >
            {isRegisterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{isRegisterOpen ? (lang === 'te' ? 'మూసివేయండి' : lang === 'hi' ? 'बंद करें' : 'Close') : (lang === 'te' ? '+ జోడించండి' : lang === 'hi' ? '+ जोड़ें' : '+ Add Shop')}</span>
          </button>
        </div>

        {regMessage && (
          <div
            className={`p-4 rounded-xl text-base font-medium ${
              regSuccess
                ? 'bg-[#ECFDF5] text-verified border border-[#86EFAC]'
                : 'bg-[#FEF2F2] text-danger border border-[#FCA5A5]'
            }`}
          >
            {regMessage}
          </div>
        )}

        {isRegisterOpen && (
          <form onSubmit={handleRegisterSubmit} className="space-y-5 pt-3 border-t border-hairline">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('Shop Name *')}</label>
                <input
                  type="text"
                  required
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  placeholder="e.g. Telangana Provision Store"
                  className="input"
                />
              </div>

              <div>
                <label className="label">{t('Registered UPI VPA *')}</label>
                <input
                  type="text"
                  required
                  value={regForm.upi_id}
                  onChange={(e) => setRegForm({ ...regForm, upi_id: e.target.value })}
                  placeholder="e.g. telangana.store@okaxis"
                  className="input font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">{t('Shop Code (Optional)')}</label>
                <input
                  type="text"
                  value={regForm.shop_code}
                  onChange={(e) => setRegForm({ ...regForm, shop_code: e.target.value })}
                  placeholder="e.g. KIR-0042"
                  className="input font-mono uppercase"
                />
              </div>
              <div>
                <label className="label">Latitude (e.g. 17.385)</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={regForm.lat}
                  onChange={(e) => setRegForm({ ...regForm, lat: e.target.value })}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="label">Longitude (e.g. 78.487)</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={regForm.lng}
                  onChange={(e) => setRegForm({ ...regForm, lng: e.target.value })}
                  className="input font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary w-full sm:w-auto px-8">
                <UserPlus className="w-5 h-5 mr-1" />
                <span>{lang === 'te' ? 'నమోదు చేయండి' : lang === 'hi' ? 'पंजीकरण करें' : 'Register Shop'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
}
