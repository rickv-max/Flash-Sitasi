import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';

export const DOKU_NOTIFICATION_PATH = '/api/doku-webhook';
// Application limits, not a claim about the merchant's approved QRIS limit.
export const DOKU_QRIS = { id: 'qris', name: 'QRIS · DOKU', minAmount: 1000, maxAmount: 5000000, reportedLimits: false };
const invoicePattern = /^[A-Za-z0-9_-]{3,64}$/;
const utc = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const digest = (body) => createHash('sha256').update(body).digest('base64');

export function dokuInvoice(uid, key) {
  return `FS${createHash('sha256').update(JSON.stringify([uid, key])).digest('hex').slice(0, 40)}`;
}

export function dokuSignature({ clientId, requestId, timestamp, target, body, response = false }, secret) {
  const components = [`Client-Id:${clientId}`, `Request-Id:${requestId}`,
    `${response ? 'Response' : 'Request'}-Timestamp:${timestamp}`, `Request-Target:${target}`];
  if (body !== undefined) components.push(`Digest:${digest(body)}`);
  return `HMACSHA256=${createHmac('sha256', secret).update(components.join('\n')).digest('base64')}`;
}

function sameSignature(actual, expected) {
  if (typeof actual !== 'string' || !/^HMACSHA256=[A-Za-z0-9+/]{43}=$/.test(actual)) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function dokuCheckoutURL(value, environment) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.host !== (environment === 'sandbox' ? 'sandbox.doku.com' : 'jokul.doku.com') ||
        url.username || url.password || url.hash || !/^\/checkout(?:\/|-link)/.test(url.pathname)) throw new Error();
    return url.href;
  } catch {
    throw new AppError(502, 'INVALID_CHECKOUT', 'Tautan pembayaran DOKU belum valid. Hubungi pengelola.');
  }
}

function amountOf(value) {
  if (!(typeof value === 'number' || typeof value === 'string' && /^\d+(?:\.0+)?$/.test(value))) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function normalizeDokuStatus(body, invoice, config) {
  const data = body?.response || body;
  if (data?.order?.invoice_number !== invoice || !invoicePattern.test(invoice)) {
    throw new AppError(502, 'INVALID_PAYMENT_STATUS', 'Nomor tagihan DOKU belum dapat diverifikasi.');
  }
  const amount = amountOf(data.order.amount);
  const status = data.transaction?.status;
  const states = { SUCCESS: 'paid', PENDING: 'pending', FAILED: 'pending', TIMEOUT: 'pending', REDIRECT: 'pending',
    EXPIRED: 'expired', CANCELLED: 'cancelled', REFUNDED: 'cancelled' };
  // Checkout can exist before the QRIS channel publishes a transaction record.
  const orderStates = { ORDER_GENERATED: 'pending', ORDER_GENERATE: 'pending', ORDER_RECOVERED: 'pending', ORDER_EXPIRED: 'expired', ORDER_CANCELLED: 'cancelled' };
  const normalized = status === 'SUCCESS' ? 'paid' : ['ORDER_EXPIRED', 'ORDER_CANCELLED'].includes(data.order.status) ? orderStates[data.order.status] : status ? states[status] : orderStates[data.order.status];
  if (!amount || !normalized || data.order.currency && data.order.currency !== 'IDR' ||
      normalized === 'paid' && (data.service?.id !== 'QRIS' || !['QRIS', 'QRIS_DOKU'].includes(data.channel?.id))) {
    throw new AppError(502, 'INVALID_PAYMENT_STATUS', 'Status atau nominal QRIS DOKU belum dapat diverifikasi.');
  }
  return { invoice_id: invoice, amount, final_amount: amount, status: normalized, provider: 'doku',
    environment: config.environment, merchantId: config.clientId };
}

export function verifyDokuNotification(raw, headers, config, now = Date.now()) {
  const clientId = headers['client-id'], requestId = headers['request-id'], timestamp = headers['request-timestamp'];
  if (clientId !== config.clientId || typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(requestId) ||
      typeof timestamp !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(timestamp) ||
      !Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp) > now + 300000 ||
      !sameSignature(headers.signature, dokuSignature({ clientId, requestId, timestamp, target: DOKU_NOTIFICATION_PATH, body: raw }, config.secret))) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Signature notifikasi DOKU tidak valid.');
  }
  // DOKU may retry a delayed notification. Atomic settlement makes replays harmless.
  let body;
  try { body = JSON.parse(raw.toString('utf8')); } catch { throw new AppError(400, 'INVALID_JSON', 'Notifikasi DOKU tidak valid.'); }
  const invoice = body?.order?.invoice_number;
  if (typeof invoice !== 'string' || !invoicePattern.test(invoice)) throw new AppError(400, 'INVALID_INVOICE', 'Nomor tagihan DOKU tidak valid.');
  return normalizeDokuStatus(body, invoice, config);
}

export function createDokuGateway(config, fetcher = fetch) {
  const base = config.environment === 'sandbox' ? 'https://api-sandbox.doku.com' : 'https://api.doku.com';
  async function request(target, { body, requestId = randomUUID() } = {}) {
    const timestamp = utc(), method = body === undefined ? 'GET' : 'POST';
    let response;
    try {
      response = await fetcher(`${base}${target}`, { method, ...(body === undefined ? {} : { body }),
        redirect: 'error', signal: AbortSignal.timeout(15000), headers: {
          'Content-Type': 'application/json', 'Client-Id': config.clientId, 'Request-Id': requestId,
          'Request-Timestamp': timestamp,
          Signature: dokuSignature({ clientId: config.clientId, requestId, timestamp, target, body }, config.secret),
        } });
    } catch (cause) {
      throw new AppError(['AbortError', 'TimeoutError'].includes(cause.name) ? 504 : 502, 'GATEWAY_UNREACHABLE',
        'DOKU belum merespons. Tunggu sebentar lalu periksa tagihan sebelumnya.');
    }
    if (!response.ok) {
      const error = new AppError(response.status === 429 ? 429 : 502, 'GATEWAY_REJECTED',
        [401, 403].includes(response.status) ? 'Koneksi akun DOKU perlu diperiksa pengelola.' :
          response.status === 400 ? 'QRIS atau konfigurasi akun DOKU perlu diperiksa pengelola.' : 'Tagihan belum dapat diproses DOKU. Silakan coba kembali nanti.');
      // A duplicate request may already have created an invoice: never retry its POST.
      error.definitive = response.status >= 400 && response.status < 500 && response.status !== 409;
      error.upstreamStatus = response.status;
      throw error;
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 256000) throw new AppError(502, 'GATEWAY_FORMAT', 'Respons DOKU belum dapat dibaca.');
    const responseTime = response.headers.get('response-timestamp');
    if (!responseTime || !Number.isFinite(Date.parse(responseTime)) ||
        !sameSignature(response.headers.get('signature'), dokuSignature({ clientId: config.clientId, requestId,
          timestamp: responseTime, target, ...(method === 'POST' ? { body: raw } : {}), response: true }, config.secret))) {
      throw new AppError(502, 'INVALID_GATEWAY_SIGNATURE', 'Respons DOKU belum dapat diverifikasi. Hubungi pengelola.');
    }
    try { return JSON.parse(raw); } catch { throw new AppError(502, 'GATEWAY_FORMAT', 'Respons DOKU belum dapat dibaca.'); }
  }
  return {
    async create({ amount, credits, user, packageName, invoice }) {
      if (typeof invoice !== 'string' || !invoicePattern.test(invoice) || !Number.isSafeInteger(amount) || amount < DOKU_QRIS.minAmount || amount > DOKU_QRIS.maxAmount) {
        const error = new AppError(400, 'INVALID_AMOUNT', 'Nominal tagihan belum didukung QRIS DOKU.'); error.definitive = true; throw error;
      }
      const createdAt = Date.now();
      const body = JSON.stringify({ order: { invoice_number: invoice, amount, currency: 'IDR', language: 'ID',
        callback_url: `${config.origin}/?payment=return`, callback_url_result: `${config.origin}/?payment=return`, auto_redirect: true,
        line_items: [{ name: `Flash Sitasi ${packageName && packageName !== 'Satuan' ? `Paket ${packageName}` : `${credits} Kredit`}`, price: amount, quantity: 1 }] },
      payment: { payment_method_types: ['QRIS'], payment_due_date: 60 },
      customer: { name: (user.name || 'Pengguna Flash Sitasi').slice(0, 255), ...(user.email ? { email: user.email.slice(0, 128) } : {}) },
      additional_info: { override_notification_url: `${config.origin}${DOKU_NOTIFICATION_PATH}` } });
      const result = await request('/checkout/v1/payment', { body, requestId: invoice });
      const data = result?.response;
      if (data?.order?.invoice_number !== invoice || amountOf(data.order.amount) !== amount || data.order.currency && data.order.currency !== 'IDR') {
        throw new AppError(502, 'AMOUNT_MISMATCH', 'Tagihan DOKU tidak cocok dengan pesanan. Hubungi pengelola.');
      }
      if (!Array.isArray(data.payment?.payment_method_types) || data.payment.payment_method_types.length !== 1 || data.payment.payment_method_types[0] !== 'QRIS') {
        throw new AppError(502, 'PAYMENT_METHOD_UNAVAILABLE', 'QRIS belum tersedia pada akun DOKU. Hubungi pengelola.');
      }
      return { provider: 'doku', environment: config.environment, merchantId: config.clientId, invoice,
        amount, finalAmount: amount, paymentURL: dokuCheckoutURL(data.payment.url, config.environment),
        status: 'pending', expiresAt: new Date(createdAt + 3600000).toISOString() };
    },
    async check(invoice, payment) {
      if (typeof invoice !== 'string' || !invoicePattern.test(invoice)) throw new AppError(400, 'INVALID_INVOICE', 'Nomor tagihan DOKU tidak valid.');
      try { return normalizeDokuStatus(await request(`/orders/v1/status/${encodeURIComponent(invoice)}`), invoice, config); }
      catch (error) {
        if (error.upstreamStatus === 404 && payment?.invoice === invoice && payment.status === 'pending') {
          return { invoice_id: invoice, amount: payment.amount, final_amount: payment.finalAmount, status: 'pending',
            provider: 'doku', environment: config.environment, merchantId: config.clientId };
        }
        throw error;
      }
    },
  };
}
