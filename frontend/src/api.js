/**
 * API client for QRaksha-Kavach backend endpoints.
 */

const API_BASE = '';

export async function checkQR(payload, { lat = null, lng = null, shopCode = null } = {}) {
  const body = { payload };
  if (lat !== null && lat !== undefined) body.lat = parseFloat(lat);
  if (lng !== null && lng !== undefined) body.lng = parseFloat(lng);
  if (shopCode) body.shop_code = shopCode.trim();

  const res = await fetch(`${API_BASE}/api/check/qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to check QR code');
  }
  return res.json();
}

export async function checkText(text) {
  const res = await fetch(`${API_BASE}/api/check/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to check text');
  }
  return res.json();
}

export async function checkImage(file, { lat = null, lng = null, shopCode = null } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (lat !== null && lat !== undefined) formData.append('lat', lat);
  if (lng !== null && lng !== undefined) formData.append('lng', lng);
  if (shopCode) formData.append('shop_code', shopCode.trim());

  const res = await fetch(`${API_BASE}/api/check/image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to check image');
  }
  return res.json();
}

export async function getMerchants() {
  const res = await fetch(`${API_BASE}/api/merchants`);
  if (!res.ok) throw new Error('Failed to load merchants');
  return res.json();
}

export async function registerMerchant(merchantData) {
  const res = await fetch(`${API_BASE}/api/merchant/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(merchantData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to register merchant');
  }
  return res.json();
}

export async function getMerchantAlerts(merchantId) {
  const res = await fetch(`${API_BASE}/api/merchant/${merchantId}/alerts`);
  if (!res.ok) throw new Error('Failed to load alerts');
  return res.json();
}

export async function simulateDemoAction(action, shopCode = 'KIR-0001') {
  const res = await fetch(`${API_BASE}/api/demo/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, shop_code: shopCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to simulate demo action');
  }
  return res.json();
}

export async function getMetrics() {
  const res = await fetch(`${API_BASE}/api/metrics`);
  if (!res.ok) throw new Error('Failed to load metrics');
  return res.json();
}

export async function getChatbotAnswer(topic, language) {
  const res = await fetch(`${API_BASE}/api/chatbot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, language }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to load chatbot answer');
  }
  return res.json();
}
