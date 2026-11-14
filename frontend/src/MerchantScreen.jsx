import React, { useEffect, useState } from 'react';
import {
  Store,
  ShieldCheck,
  AlertOctagon,
  Bell,
  History,
  PlusCircle,
  Loader2,
  RefreshCw,
  QrCode,
  MapPin,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { getMerchants, getMerchantAlerts, registerMerchant } from './api';

export default function MerchantScreen() {
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

  // Load merchants on mount
  useEffect(() => {
    loadMerchants();
  }, []);

  // Load alerts whenever selected merchant changes
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
      setRegMessage(`Shop successfully registered: ${res.shop_code} (${res.name})`);
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
    }
  };

  const currentMerchant =
    merchants.find((m) => m.shop_code === selectedShopCode) || merchants[0] || null;

  const hasActiveAlert = alerts.length > 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Merchant Selector Card */}
      <div className="p-5 bg-white border-flat shadow-flat space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
            <Store className="w-5 h-5 text-terracotta" />
            <span>Select Kirana Store (20 Pilot Shops):</span>
          </label>
          <button
            onClick={() => {
              if (selectedShopCode) loadAlerts(selectedShopCode);
            }}
            className="p-1.5 bg-paper-cream border-flat hover:bg-paper-dark btn-tactile"
            title="Refresh alerts"
          >
            <RefreshCw className="w-4 h-4 text-ink" />
          </button>
        </div>

        <select
          value={selectedShopCode}
          onChange={(e) => setSelectedShopCode(e.target.value)}
          className="w-full p-3 font-mono text-sm sm:text-base border-flat bg-paper text-ink font-bold focus:outline-none"
        >
          {merchants.map((m) => (
            <option key={m.shop_code} value={m.shop_code}>
              {m.shop_code} — {m.name} ({m.upi_id})
            </option>
          ))}
        </select>

        {currentMerchant && (
          <div className="p-3 bg-paper-cream border border-stone-300 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-stone-700">
            <div>
              <span className="text-stone-500">Registered VPA:</span>{' '}
              <span className="font-bold text-ink">{currentMerchant.upi_id}</span>
            </div>
            <div>
              <span className="text-stone-500">Coarse GPS Cell:</span>{' '}
              <span className="font-bold text-ink">
                {currentMerchant.coarse_lat}, {currentMerchant.coarse_lng}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* QR Counter Health Banner (SPEC 8.1: OK vs ALERT) */}
      <div
        className={`p-5 sm:p-6 border-flat-thick shadow-flat ${
          hasActiveAlert
            ? 'bg-verdict-danger-bg border-verdict-danger animate-pulse'
            : 'bg-verdict-verified-bg border-verdict-verified'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white border-flat shrink-0 shadow-sm">
            {hasActiveAlert ? (
              <AlertOctagon className="w-10 h-10 sm:w-12 sm:h-12 text-verdict-danger" />
            ) : (
              <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-verdict-verified" />
            )}
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
              Store Counter QR Health Status
            </span>
            <h2
              className={`text-xl sm:text-2xl font-extrabold ${
                hasActiveAlert ? 'text-verdict-danger' : 'text-verdict-verified'
              } leading-tight`}
            >
              {hasActiveAlert
                ? 'ALERT: TAMPERED QR STICKER DETECTED'
                : 'STATUS OK: COUNTER QR SECURE'}
            </h2>
            <p className="text-sm font-bold text-ink mt-1">
              {hasActiveAlert
                ? `Critical Warning! ${alerts.length} fraudulent scan attempt(s) detected with mismatched payee UPI IDs at your counter.`
                : 'All scans at your counter match your registered UPI ID. No sticker swap detected.'}
            </p>
          </div>
        </div>
      </div>

      {/* Merchant Counter QR Reference Card */}
      {currentMerchant && (
        <div className="p-4 bg-paper-cream border-flat space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase text-stone-600 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-terracotta" />
              <span>Genuine Counter QR Payload:</span>
            </span>
            <span className="text-xs font-mono font-bold text-forest bg-forest-light px-2 py-0.5 border border-forest">
              Official Standee
            </span>
          </div>
          <p className="font-mono text-xs sm:text-sm bg-white p-2.5 border-flat text-ink break-all select-all">
            upi://pay?pa={currentMerchant.upi_id}&pn={encodeURIComponent(currentMerchant.name)}&mc=5411
          </p>
          <span className="text-[11px] text-stone-500 block">
            Counter staff should cross-verify this payload if customer scan warnings appear.
          </span>
        </div>
      )}

      {/* Security Alerts History Feed */}
      <div className="bg-white border-flat shadow-flat p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-stone-200 pb-3">
          <h3 className="text-lg sm:text-xl font-bold text-ink flex items-center gap-2">
            <Bell className="w-5 h-5 text-terracotta" />
            <span>Merchant Security Alerts ({alerts.length})</span>
          </h3>
          {alerts.length > 0 && (
            <span className="px-2 py-0.5 bg-verdict-danger text-white font-mono font-bold text-xs border-flat">
              {alerts.length} Active Threat{alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-forest mx-auto" />
            <p className="text-sm font-bold text-ink">Zero Counter Tampering Incidents</p>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              No unauthorized UPI IDs have been detected at this shop's coarse location coordinates.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((al) => (
              <div
                key={al.id}
                className="p-4 border-flat bg-verdict-danger-bg border-verdict-danger space-y-2 text-ink shadow-sm"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-verdict-danger uppercase">
                    Incident #{al.id}: {al.alert_type}
                  </span>
                  <span className="text-xs font-mono text-stone-600">
                    {al.created_at ? new Date(al.created_at).toLocaleTimeString() : 'Recent'}
                  </span>
                </div>
                <p className="text-sm sm:text-base font-bold">
                  Fraudulent payee scanned on counter:{' '}
                  <span className="font-mono text-verdict-danger bg-white px-1.5 py-0.5 border border-verdict-danger">
                    {al.scanned_upi}
                  </span>
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-stone-700 pt-1 border-t border-verdict-danger/30">
                  <span>
                    Tamper attempts in 30 min: <strong>{al.count}</strong>
                  </span>
                  <span className="font-bold text-verdict-danger uppercase">
                    ⚠️ Inspect physical sticker on counter immediately
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register Kirana Form (SPEC 8.1) */}
      <div className="bg-paper-dark border-flat shadow-flat p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-terracotta" />
              <span>Register New Kirana Merchant</span>
            </h3>
            <span className="text-xs text-stone-600">Bind new shop to 100m coarse cell defense</span>
          </div>
          <button
            onClick={() => setIsRegisterOpen(!isRegisterOpen)}
            className="px-3 py-1.5 bg-white border-flat font-bold text-xs sm:text-sm hover:bg-paper btn-tactile"
          >
            {isRegisterOpen ? 'Close Form' : '+ Add Shop'}
          </button>
        </div>

        {regMessage && (
          <div className="p-3 bg-white border-flat text-xs sm:text-sm font-bold text-terracotta">
            {regMessage}
          </div>
        )}

        {isRegisterOpen && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3 bg-white p-4 border-flat">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1 uppercase tracking-wide">
                  Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  placeholder="e.g. Telangana General Store"
                  className="w-full p-2.5 text-sm border-flat bg-paper text-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1 uppercase tracking-wide">
                  Registered UPI VPA *
                </label>
                <input
                  type="text"
                  required
                  value={regForm.upi_id}
                  onChange={(e) => setRegForm({ ...regForm, upi_id: e.target.value })}
                  placeholder="e.g. telangana.store@okaxis"
                  className="w-full p-2.5 font-mono text-sm border-flat bg-paper text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1 uppercase tracking-wide">
                  Shop Code (Optional)
                </label>
                <input
                  type="text"
                  value={regForm.shop_code}
                  onChange={(e) => setRegForm({ ...regForm, shop_code: e.target.value })}
                  placeholder="e.g. KIR-0042"
                  className="w-full p-2.5 font-mono text-sm border-flat uppercase bg-paper text-ink"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1 uppercase tracking-wide">
                  Coarse Latitude
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={regForm.lat}
                  onChange={(e) => setRegForm({ ...regForm, lat: e.target.value })}
                  className="w-full p-2.5 font-mono text-sm border-flat bg-paper text-ink"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1 uppercase tracking-wide">
                  Coarse Longitude
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={regForm.lng}
                  onChange={(e) => setRegForm({ ...regForm, lng: e.target.value })}
                  className="w-full p-2.5 font-mono text-sm border-flat bg-paper text-ink"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-terracotta text-white font-bold text-base border-flat shadow-flat-sm hover:bg-terracotta-hover btn-tactile"
            >
              Register & Bind Location
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
