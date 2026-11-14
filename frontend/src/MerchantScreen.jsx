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
    <div className="space-y-6">
      {/* Merchant Selector Bar */}
      <div className="p-5 bg-white border-flat shadow-flat space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-lg font-bold text-ink flex items-center gap-2">
            <Store className="w-6 h-6 text-terracotta" />
            <span>Select Kirana Store (20 Demo Shops):</span>
          </label>
          <button
            onClick={() => {
              if (selectedShopCode) loadAlerts(selectedShopCode);
            }}
            className="p-1.5 bg-paper border-flat hover:bg-stone-200"
            title="Refresh alerts"
          >
            <RefreshCw className="w-5 h-5 text-ink" />
          </button>
        </div>

        <select
          value={selectedShopCode}
          onChange={(e) => setSelectedShopCode(e.target.value)}
          className="w-full p-3 font-mono text-base border-flat bg-paper text-ink font-bold focus:outline-none"
        >
          {merchants.map((m) => (
            <option key={m.shop_code} value={m.shop_code}>
              {m.shop_code} — {m.name} ({m.upi_id})
            </option>
          ))}
        </select>

        {currentMerchant && (
          <div className="grid grid-cols-2 gap-2 text-sm pt-1 font-mono text-stone-700">
            <div>
              <span className="text-stone-500">Registered UPI:</span>{' '}
              <span className="font-bold text-ink">{currentMerchant.upi_id}</span>
            </div>
            <div>
              <span className="text-stone-500">Location:</span>{' '}
              <span className="font-bold text-ink">
                {currentMerchant.coarse_lat}, {currentMerchant.coarse_lng}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* QR Health Status Card (SPEC 8.1: OK or ALERT) */}
      <div
        className={`p-6 border-flat shadow-flat ${
          hasActiveAlert
            ? 'bg-verdict-danger-bg border-verdict-danger animate-pulse'
            : 'bg-verdict-verified-bg border-verdict-verified'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white border-flat shrink-0">
            {hasActiveAlert ? (
              <AlertOctagon className="w-12 h-12 text-verdict-danger" />
            ) : (
              <ShieldCheck className="w-12 h-12 text-verdict-verified" />
            )}
          </div>
          <div className="flex-1">
            <span className="text-sm font-bold uppercase tracking-wider text-stone-600 block">
              Store Counter QR Health
            </span>
            <h2
              className={`text-2xl sm:text-3xl font-extrabold ${
                hasActiveAlert ? 'text-verdict-danger' : 'text-verdict-verified'
              }`}
            >
              {hasActiveAlert
                ? 'ALERT: TAMPERED QR STICKER DETECTED'
                : 'STATUS OK: COUNTER QR SECURE'}
            </h2>
            <p className="text-base font-bold text-ink mt-1">
              {hasActiveAlert
                ? `Warning! ${alerts.length} fraudulent scan attempt(s) detected with mismatched payees near your shop.`
                : 'Scans at your shop location match your registered UPI ID. No sticker swap detected.'}
            </p>
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="bg-white border-flat shadow-flat p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-stone-200 pb-3">
          <h3 className="text-xl font-bold text-ink flex items-center gap-2">
            <Bell className="w-6 h-6 text-terracotta" />
            <span>Merchant Alerts History ({alerts.length})</span>
          </h3>
          {alerts.length > 0 && (
            <span className="px-2.5 py-0.5 bg-verdict-danger text-white font-bold text-sm border-flat">
              {alerts.length} Active
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <p className="text-base text-stone-600 italic py-4 text-center">
            No security alerts recorded for this shop. All scans have matched your registered UPI
            ID.
          </p>
        ) : (
          <div className="space-y-3">
            {alerts.map((al) => (
              <div
                key={al.id}
                className="p-4 border-flat bg-verdict-danger-bg border-verdict-danger space-y-2 text-ink"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono font-bold text-verdict-danger uppercase">
                    Alert #{al.id}: {al.alert_type}
                  </span>
                  <span className="text-xs font-mono text-stone-600">
                    {al.created_at ? new Date(al.created_at).toLocaleTimeString() : 'Recent'}
                  </span>
                </div>
                <p className="text-base font-bold">
                  Fraudulent payee scanned at counter:{' '}
                  <span className="font-mono text-verdict-danger">{al.scanned_upi}</span>
                </p>
                <div className="flex items-center justify-between text-sm text-stone-700 pt-1">
                  <span>
                    Repeated swap attempts within 30 min: <strong>{al.count}</strong>
                  </span>
                  <span className="font-bold text-terracotta">Inspect physical QR sticker now</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register Kirana Form (SPEC 8.1) */}
      <div className="bg-paper-dark border-flat shadow-flat p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-ink flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-terracotta" />
            <span>Register New Merchant</span>
          </h3>
          <button
            onClick={() => setIsRegisterOpen(!isRegisterOpen)}
            className="px-3 py-1.5 bg-white border-flat font-bold text-sm hover:bg-paper"
          >
            {isRegisterOpen ? 'Close Form' : '+ Add Shop'}
          </button>
        </div>

        {regMessage && (
          <div className="p-3 bg-white border-flat text-sm font-bold text-terracotta">
            {regMessage}
          </div>
        )}

        {isRegisterOpen && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3 bg-white p-4 border-flat">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-ink mb-1">Shop Name *</label>
                <input
                  type="text"
                  required
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  placeholder="e.g. Telangana General Store"
                  className="w-full p-2.5 text-base border-flat bg-paper"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-ink mb-1">
                  Registered UPI VPA *
                </label>
                <input
                  type="text"
                  required
                  value={regForm.upi_id}
                  onChange={(e) => setRegForm({ ...regForm, upi_id: e.target.value })}
                  placeholder="e.g. telangana.store@okaxis"
                  className="w-full p-2.5 font-mono text-base border-flat bg-paper"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-bold text-ink mb-1">
                  Shop Code (Optional)
                </label>
                <input
                  type="text"
                  value={regForm.shop_code}
                  onChange={(e) => setRegForm({ ...regForm, shop_code: e.target.value })}
                  placeholder="e.g. KIR-0042"
                  className="w-full p-2.5 font-mono text-base border-flat uppercase bg-paper"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink mb-1">Coarse Latitude</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={regForm.lat}
                  onChange={(e) => setRegForm({ ...regForm, lat: e.target.value })}
                  className="w-full p-2.5 font-mono text-base border-flat bg-paper"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink mb-1">Coarse Longitude</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={regForm.lng}
                  onChange={(e) => setRegForm({ ...regForm, lng: e.target.value })}
                  className="w-full p-2.5 font-mono text-base border-flat bg-paper"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-terracotta text-white font-bold text-lg border-flat shadow-flat-sm hover:bg-terracotta-hover active:translate-y-0.5"
            >
              Register & Bind Location
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
