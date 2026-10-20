import { createHash } from 'node:crypto';
import { purchaseQuote, samePurchase, CREDIT_CATALOG_REVISION } from '../shared/catalog.js';
import { buildCitations } from '../shared/citations.js';
import { AppError, errorResponse } from './errors.js';
import { appURL, paymentConfig, paymentMethodsConfig } from './config.js';
import { adminServices, authenticate } from './firebase.js';
import { createGateway, verifyWebhook } from './gateway.js';
import { createRepository } from './repository.js';
import { resolveMetadata } from './metadata.js';
import { bodyOf, requestKey } from './http.js';
import { allowOperation, assertActive, assertSession, isOwner } from './access.js';
import { DEFAULT_SETTINGS } from '../shared/settings.js';
import { enrichCity } from './city.js';

const METHODS = { profile: 'POST', createPayment: 'POST', paymentStatus: 'GET', paymentOptions: 'GET', members: 'GET', webhook: 'POST', citations: 'POST', config: 'GET', city: 'POST' };
const publicPayment = ({ invoice, amount, finalAmount, credits, packageId, packageName, paymentURL, status, expiresAt, credited }) =>
  ({ invoice, amount, finalAmount, credits, packageId, packageName, paymentURL, status, expiresAt, credited: !!credited });

export function makeHandler(action, overrides = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== METHODS[action]) {
      res.setHeader('Allow', METHODS[action]);
      return errorResponse(new AppError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.'), res);
    }
    const env = overrides.env || process.env;
    try {
      if (action !== 'webhook' && req.headers.origin && env.APP_URL && req.headers.origin !== appURL(env)) {
        throw new AppError(403, 'ORIGIN_DENIED', 'Asal permintaan tidak diizinkan.');
      }
      if (action === 'paymentOptions') {
        const gateway = overrides.gateway || createGateway(paymentMethodsConfig(env));
        return res.status(200).json({ success: true, data: { methods: await gateway.methods() } });
      }
      if (action === 'members') {
        const repo = overrides.repo || createRepository(adminServices(env).db);
        return res.status(200).json({ success: true, data: await repo.publicMembers() });
      }
      if (!['webhook', 'config'].includes(action) && !req.headers.authorization) throw new AppError(401, 'UNAUTHENTICATED', 'Masuk ke akun untuk melanjutkan.');
      const services = overrides.repo ? null : adminServices(env);
      const repo = overrides.repo || createRepository(services.db);
      if (action === 'config') return res.status(200).json({ success: true, data: repo.getSettings ? await repo.getSettings() : DEFAULT_SETTINGS });
      const user = action === 'webhook' ? null : await (overrides.authenticate || authenticate)(req, services?.auth);
      const settings = action === 'webhook' ? DEFAULT_SETTINGS : repo.getSettings ? await repo.getSettings() : DEFAULT_SETTINGS;
      const profile = user ? await repo.ensureProfile(user, { owner: isOwner(user.uid, env), welcomeCredits: settings.welcomeCredits,
        signupEnabled: settings.signupEnabled, markLogin: action === 'profile' }) : null;
      if (profile) { assertActive(profile); assertSession(user, profile); }
      if (action === 'profile') {
        const body = bodyOf(req);
        if (body.action === 'updatePublicProfile') {
          await repo.rateLimit?.(user.uid, 'public-profile', 10);
          return res.status(200).json({ success: true, data: await repo.updatePublicProfile(user.uid, body.profile) });
        }
        return res.status(200).json({ success: true, data: profile });
      }
      if (action === 'createPayment') {
        const body = bodyOf(req);
        const key = requestKey(req);
        const config = paymentConfig(env);
        const previous = await repo.getPaymentRequest?.(user.uid, key);
        if (previous) {
          if (!samePurchase(previous, body)) {
            try { purchaseQuote(body, settings); } catch (error) { throw new AppError(400, 'INVALID_CREDITS', error.message); }
            throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Permintaan ini sudah dipakai untuk pilihan kredit lain.');
          }
          const reservation = await repo.reservePayment(user.uid, key, previous.credits, previous.amount, previous);
          return res.status(200).json({ success: true, data: publicPayment({ ...reservation.existing, credits: previous.credits }) });
        }
        let selection;
        allowOperation(settings, profile, 'payment');
        if (body.packageId === 'sultan' && body.catalogRevision !== CREDIT_CATALOG_REVISION) throw new AppError(409, 'PACKAGE_CHANGED', 'Paket Sultan sekarang 999 kredit seharga Rp500.000. Muat ulang halaman untuk melihat pilihan terbaru sebelum membayar.');
        try { selection = purchaseQuote(body, settings); } catch (error) { throw new AppError(400, 'INVALID_CREDITS', error.message); }
        if (body.expectedCredits !== undefined && body.expectedCredits !== selection.credits) throw new AppError(409, 'PACKAGE_CHANGED', 'Jumlah kredit paket telah diperbarui. Muat ulang halaman sebelum melanjutkan pembayaran.');
        if (body.expectedAmount !== undefined && body.expectedAmount !== selection.amount) throw new AppError(409, 'PRICE_CHANGED', 'Harga telah diperbarui admin. Periksa harga terbaru sebelum melanjutkan pembayaran.');
        const { credits, amount } = selection;
        const reservation = await repo.reservePayment(user.uid, key, credits, amount, selection);
        if (reservation.existing) return res.status(200).json({ success: true, data: publicPayment({ ...reservation.existing, credits }) });
        try {
          const gateway = overrides.gateway || createGateway(config);
          const created = await gateway.create({ amount, credits, user, packageName: selection.packageName });
          const payment = { ...created, packageId: selection.packageId, packageName: selection.packageName };
          await repo.finishPayment(reservation.ref, user.uid, credits, payment);
          return res.status(201).json({ success: true, data: publicPayment({ ...payment, credits }) });
        } catch (error) {
          try { await repo.failPayment(reservation.ref, !!error.definitive); } catch { /* Keep reservation: fail closed. */ }
          error.paymentPending = !error.definitive;
          throw error;
        }
      }
      if (action === 'paymentStatus') {
        const query = req.query || Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
        const invoice = query.invoice;
        if (typeof invoice !== 'string' || !/^[A-Za-z0-9_-]{3,160}$/.test(invoice)) throw new AppError(400, 'INVALID_INVOICE', 'Nomor tagihan tidak valid.');
        const payment = await repo.getPayment(invoice, user.uid);
        if (payment.credited || Date.now() - payment.lastChecked < 5000 || ['expired', 'cancelled'].includes(payment.status)) {
          return res.status(200).json({ success: true, data: publicPayment(payment) });
        }
        const gateway = overrides.gateway || createGateway(paymentConfig(env));
        const verified = await gateway.check(invoice);
        const updated = await repo.settlePayment(invoice, verified);
        return res.status(200).json({ success: true, data: publicPayment(updated) });
      }
      if (action === 'webhook') {
        const body = bodyOf(req);
        const config = paymentConfig(env);
        if (typeof body.invoice_id !== 'string' || !/^[A-Za-z0-9_-]{3,160}$/.test(body.invoice_id)) {
          throw new AppError(400, 'INVALID_INVOICE', 'Nomor tagihan callback tidak valid.');
        }
        // Current docs sign callbacks; older official examples describe unsigned ones.
        // A present signature must be valid. An absent signature never authorizes credit:
        // both paths require an authenticated server-to-server status lookup below.
        if (req.headers['x-webhook-signature'] || req.headers['x-webhook-timestamp']) {
          verifyWebhook(body, req.headers, config.secret);
        }
        const payment = await repo.getPayment(body.invoice_id);
        if (payment.credited) return res.status(200).json({ success: true });
        const gateway = overrides.gateway || createGateway(config);
        const verified = await gateway.check(body.invoice_id);
        if (verified.status !== 'paid') throw new AppError(409, 'PAYMENT_NOT_PAID', 'Pembayaran belum dinyatakan lunas oleh penyedia.');
        if ((body.final_amount != null && Number(body.final_amount) !== Number(verified.final_amount)) ||
            (body.amount != null && Number(body.amount) !== Number(verified.amount)) ||
            (body.paid_amount != null && Number(body.paid_amount) < Number(verified.final_amount))) {
          throw new AppError(409, 'AMOUNT_MISMATCH', 'Nominal callback tidak cocok dengan pembayaran terverifikasi.');
        }
        await repo.settlePayment(body.invoice_id, verified);
        return res.status(200).json({ success: true });
      }
      if (action === 'city') {
        allowOperation(settings, profile, 'city');
        if (!settings.autoCityEnabled) return res.status(200).json({ success: true, data: { city: '', citySource: null, cityStatus: 'disabled' } });
        const { mode, input } = bodyOf(req);
        if (!['doi', 'url', 'manual'].includes(mode) || mode !== 'manual' && (typeof input !== 'string' || !input.trim() || input.length > 2048)) throw new AppError(400, 'INVALID_INPUT', 'Isi DOI, URL artikel, jurnal, atau penerbit untuk mencari kota terbit.');
        if (mode === 'manual' && (!input || typeof input !== 'object' || Array.isArray(input) || ![input.journal, input.publisher].some((value) => typeof value === 'string' && value.trim().length >= 3))) throw new AppError(400, 'INVALID_INPUT', 'Isi nama jurnal atau penerbit minimal tiga karakter.');
        await repo.rateLimit?.(user.uid, 'city', 12);
        const metadata = mode === 'manual' ? await enrichCity({ journal: String(input.journal || '').slice(0, 1000), publisher: String(input.publisher || '').slice(0, 1000) }, { repo }) :
          await (overrides.resolveMetadata || resolveMetadata)(mode, input, { repo, enabled: true });
        return res.status(200).json({ success: true, data: { city: metadata.city || '', citySource: metadata.citySource || null,
          cityStatus: metadata.cityStatus || (metadata.city ? 'found' : 'not_found'), cityCached: !!metadata.cityCached } });
      }
      if (action === 'citations') {
        allowOperation(settings, profile, 'citation');
        const { mode, input, city = '' } = bodyOf(req);
        if (!['doi', 'url', 'manual'].includes(mode) || typeof city !== 'string' || city.length > 100 ||
            (mode !== 'manual' && (typeof input !== 'string' || !input.trim() || input.length > 2048))) {
          throw new AppError(400, 'INVALID_INPUT', 'Lengkapi sumber referensi dengan format yang benar.');
        }
        const key = requestKey(req);
        const fingerprint = createHash('sha256').update(JSON.stringify({ mode, input, city })).digest('hex');
        const existing = await repo.getCitation(user.uid, key);
        if (existing) {
          if (existing.requestHash !== fingerprint) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Permintaan ini sudah dipakai untuk referensi lain.');
          return res.status(200).json({ success: true, data: existing });
        }
        if (profile.credits < 1) throw new AppError(402, 'INSUFFICIENT_CREDITS', 'Kredit habis. Isi ulang untuk melanjutkan.');
        const metadata = await (overrides.resolveMetadata || resolveMetadata)(mode, input, { repo, enabled: settings.autoCityEnabled });
        const citation = await repo.saveCitation(user.uid, key, { metadata, title: metadata.title,
          results: buildCitations(metadata, city), cityUsed: city.trim() || metadata.city || '', cityManual: !!city.trim(), type: mode.toUpperCase(),
          input: mode === 'manual' ? metadata.title : input, requestHash: fingerprint });
        return res.status(200).json({ success: true, data: citation });
      }
      throw new AppError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
    } catch (error) { return errorResponse(error, res); }
  };
}
