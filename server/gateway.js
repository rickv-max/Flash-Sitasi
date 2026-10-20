import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';
import { methodSupports, publicPaymentMethods } from '../shared/payment-methods.js';

let methodsCache;

export function normalizePayment(body, checkout) {
  if (!body || body.success !== true) throw new AppError(502, 'GATEWAY_REJECTED', 'Tagihan belum dapat dibuat. Periksa kembali ketersediaan metode pembayaran.');
  const data = body.data || body.payment || body;
  const paymentURL = data.payment_url || body.payment_url;
  const invoice = data.invoice_id || body.invoice_id;
  try {
    const url = new URL(paymentURL);
    if (url.protocol !== 'https:' || url.origin !== new URL(checkout).origin || url.username || url.password) throw new Error();
  } catch {
    throw new AppError(502, 'INVALID_CHECKOUT', 'Halaman pembayaran dari penyedia belum valid. Hubungi pengelola.');
  }
  if (typeof invoice !== 'string' || !/^[A-Za-z0-9_-]{3,160}$/.test(invoice)) {
    throw new AppError(502, 'INVALID_INVOICE', 'Penyedia belum mengembalikan nomor tagihan yang valid.');
  }
  const amount = Number(data.amount);
  const finalAmount = Number(data.final_amount ?? data.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(finalAmount) || finalAmount < amount) {
    throw new AppError(502, 'INVALID_AMOUNT', 'Nominal tagihan dari penyedia perlu diperiksa.');
  }
  return { invoice, paymentURL, amount, finalAmount, status: 'pending', expiresAt: data.expires_at || null };
}

export function createGateway(config, fetcher = fetch) {
  const request = async (path, options = {}) => {
    let response;
    try {
      response = await fetcher(`https://www.bayar.gg/api/${path}`, {
        ...options, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', 'X-API-Key': config.key },
      });
    } catch (error) {
      throw new AppError(error.name === 'TimeoutError' || error.name === 'AbortError' ? 504 : 502,
        'GATEWAY_UNREACHABLE', 'Penyedia pembayaran belum merespons. Tunggu sebentar sebelum mencoba lagi.');
    }
    let body;
    try { body = await response.json(); } catch {
      throw new AppError(502, 'GATEWAY_FORMAT', 'Penyedia pembayaran mengirim respons yang belum dapat dibaca.');
    }
    if (!response.ok || body.success !== true) {
      let message = 'Tagihan belum dapat diproses penyedia. Silakan coba lagi nanti.';
      if (response.status === 401 || response.status === 403) message = 'Koneksi akun pembayaran perlu diperiksa pengelola.';
      if (response.status === 429) message = 'Terlalu banyak permintaan. Tunggu sebentar lalu coba kembali.';
      if (response.status === 400) message = 'Metode atau konfigurasi checkout belum dapat dipakai. Hubungi pengelola.';
      const error = new AppError(response.status === 429 ? 429 : 502, 'GATEWAY_REJECTED', message);
      error.definitive = (response.status >= 400 && response.status < 500) || (response.ok && body.success === false);
      throw error;
    }
    return body;
  };
  async function methods() {
    if (fetcher === fetch && methodsCache?.key === config.key && methodsCache.method === config.method && methodsCache.expires > Date.now()) return methodsCache.promise;
    const promise = request('get-payment-methods.php').then((body) => {
      try { return publicPaymentMethods(body, config.method); }
      catch { throw new AppError(502, 'GATEWAY_FORMAT', 'Informasi metode pembayaran belum dapat dibaca.'); }
    });
    if (fetcher === fetch) methodsCache = { key: config.key, method: config.method, expires: Date.now() + 60000, promise };
    try { return await promise; } catch (error) { if (fetcher === fetch) methodsCache = null; throw error; }
  }
  return {
    methods,
    async create({ amount, credits, user, packageName }) {
      let selected;
      try {
        selected = (await methods()).find((method) => methodSupports(method, amount));
        if (!selected) throw new AppError(503, 'PAYMENT_METHOD_UNAVAILABLE', 'Belum ada metode pembayaran aktif untuk nominal ini. Hubungi pengelola agar mengaktifkan metode yang mendukung nominal paket.');
      } catch (error) {
        // No create-payment POST has been sent, so clearing its reservation is safe.
        error.definitive = true;
        throw error;
      }
      const body = await request('create-payment.php', { method: 'POST', body: JSON.stringify({
        amount, description: `Top Up ${packageName && packageName !== 'Satuan' ? `Paket ${packageName} · ` : ''}${credits} Kredit FlashCite`,
        customer_name: user.name || 'Pengguna FlashCite', customer_email: user.email || '',
        payment_url: config.checkout,
        payment_method: selected.id,
        callback_url: `${config.origin}/api/payment-webhook`,
        redirect_url: `${config.origin}/?payment=return`,
      }) });
      const payment = normalizePayment(body, config.checkout);
      if (payment.amount !== amount) throw new AppError(502, 'AMOUNT_MISMATCH', 'Nominal tagihan tidak cocok. Hubungi pengelola.');
      return payment;
    },
    async check(invoice) {
      const body = await request(`check-payment.php?invoice=${encodeURIComponent(invoice)}`);
      const data = body.data || body.payment || body;
      if (data.invoice_id !== invoice || !['pending', 'paid', 'expired', 'cancelled'].includes(data.status)) {
        throw new AppError(502, 'INVALID_PAYMENT_STATUS', 'Status tagihan belum dapat diverifikasi.');
      }
      return data;
    },
  };
}

export function verifyWebhook(payload, headers, secret, now = Date.now(), maxAge = 300) {
  const signature = headers['x-webhook-signature'];
  const timestamp = headers['x-webhook-timestamp'];
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature) ||
      typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp) ||
      Math.abs(now / 1000 - Number(timestamp)) > maxAge ||
      (payload.timestamp != null && String(payload.timestamp) !== timestamp)) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Signature webhook tidak valid atau sudah kedaluwarsa.');
  }
  if (typeof payload.invoice_id !== 'string' || !/^[A-Za-z0-9_-]{3,160}$/.test(payload.invoice_id) ||
      !Number.isSafeInteger(Number(payload.final_amount)) || Number(payload.final_amount) <= 0) {
    throw new AppError(400, 'INVALID_WEBHOOK', 'Payload webhook tidak valid.');
  }
  const signed = `${payload.invoice_id}|${payload.status}|${payload.final_amount}|${timestamp}`;
  const expected = createHmac('sha256', secret).update(signed).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Signature webhook tidak valid.');
  }
  return true;
}
