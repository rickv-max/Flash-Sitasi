export class APIError extends Error {
  constructor(code, message, paymentPending = false) { super(message); this.code = code; this.paymentPending = paymentPending; }
}

export async function api(path, { user, method = 'POST', body, key } = {}) {
  let token;
  try { token = await user?.getIdToken(); } catch { throw new APIError('SESSION_EXPIRED', 'Sesi berakhir. Masuk kembali untuk melanjutkan.'); }
  let response;
  try {
    response = await fetch(`/api/${path}`, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }),
      signal: AbortSignal.timeout(55000),
    });
  } catch { throw new APIError('NETWORK_ERROR', 'Koneksi terputus. Periksa internet lalu coba lagi; permintaan yang sama tidak ditagih ulang.', path === 'create-payment'); }
  let payload;
  try { payload = await response.json(); } catch { throw new APIError('API_UNAVAILABLE', 'Layanan belum tersedia. Silakan coba kembali sebentar.', path === 'create-payment'); }
  if (!response.ok || !payload.success) throw new APIError(payload.error?.code || 'API_ERROR', payload.error?.message || 'Proses belum berhasil. Coba lagi sebentar.', !!payload.error?.paymentPending);
  return payload.data;
}

export function readStorage(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function writeStorage(key, value) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
