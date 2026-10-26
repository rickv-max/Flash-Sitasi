import { adminServices, authenticate } from './firebase.js';
import { createRepository } from './repository.js';
import { createAdminRepository } from './admin-repository.js';
import { assertAdmin, assertSession, isOwner, ownerUIDs } from './access.js';
import { AppError, errorResponse } from './errors.js';
import { bodyOf, requestKey, checkOrigin, queryOf, noCache } from './http.js';
import { paymentConfig } from './config.js';
import { gatewayForPayment } from './payment-providers.js';

export function makeAdminHandler(overrides = {}) {
  return async (req, res) => {
    noCache(res);
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST');
      return errorResponse(new AppError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.'), res);
    }
    const env = overrides.env || process.env;
    try {
      checkOrigin(req, env);
      if (!req.headers.authorization) throw new AppError(401, 'UNAUTHENTICATED', 'Masuk ke akun admin untuk melanjutkan.');
      const services = overrides.services || adminServices(env);
      const user = await (overrides.authenticate || authenticate)(req, services.auth);
      const repo = overrides.repo || createRepository(services.db);
      const admin = overrides.admin || createAdminRepository(services.db, env);
      // Role comes only from server-owned data. A browser-supplied role is never used.
      const profile = await repo.ensureProfile(user, { owner: isOwner(user.uid, env), welcomeCredits: 0, signupEnabled: false });
      assertAdmin(profile);
      assertSession(user, profile);
      const query = queryOf(req);
      let data;
      if (req.method === 'GET') {
        switch (query.resource || 'overview') {
          case 'overview': data = await admin.overview(); break;
          case 'users': data = await admin.listUsers(query); break;
          case 'user': {
            data = await admin.userDetail(query.uid);
            data.protected = query.uid === user.uid || isOwner(query.uid, env);
            try {
              const record = await services.auth.getUser(query.uid);
              data.auth = { disabled: record.disabled, emailVerified: record.emailVerified,
                providers: record.providerData.map((provider) => provider.providerId),
                createdAt: record.metadata.creationTime, lastSignInAt: record.metadata.lastSignInTime };
            } catch { data.auth = null; }
            break;
          }
          case 'payments': case 'requests': case 'audit': case 'locations': data = await admin.listRecords(query.resource, query); break;
          case 'settings': data = { ...await admin.settings(), ownerUIDs: ownerUIDs(env) }; break;
          default: throw new AppError(400, 'INVALID_RESOURCE', 'Data admin yang diminta tidak tersedia.');
        }
      } else {
        const input = bodyOf(req); const key = requestKey(req);
        switch (input.action) {
          case 'adjustCredits': data = await admin.adjustCredits(user, key, input); break;
          case 'setMembership': data = await admin.setMembership(user, key, input); break;
          case 'setRole': case 'setStatus': case 'revokeSessions': case 'saveNotes': {
            data = await admin.changeUser(user, key, input.action, input);
            if (input.action === 'setStatus' || input.action === 'revokeSessions') {
              let warning = '';
              try {
                // Always sync the current stored state, including on an idempotent retry.
                const current = await admin.profile(input.uid);
                if (input.action === 'setStatus') await services.auth.updateUser(input.uid, { disabled: current.status === 'blocked' });
                if (input.action === 'revokeSessions' || current.status === 'blocked') await services.auth.revokeRefreshTokens(input.uid);
              } catch { warning = 'Status tersimpan. Sinkronisasi sesi Firebase tertunda; ulangi tindakan untuk mencoba lagi.'; }
              try { await admin.markAuthSync(input.uid, data.operationId, !!warning); }
              catch { warning ||= 'Tindakan tersimpan, tetapi status sinkronisasi belum dapat dicatat. Muat ulang detail pengguna.'; }
              data = { ...data, authSyncWarning: warning };
            }
            break;
          }
          case 'updateSettings': data = await admin.updateSettings(user, key, input); break;
          case 'upsertLocation': data = await admin.upsertLocation(user, key, input); break;
          case 'syncPayment': {
            if (typeof input.invoice !== 'string' || !/^[A-Za-z0-9_-]{3,160}$/.test(input.invoice)) throw new AppError(400, 'INVALID_INVOICE', 'Nomor invoice tidak valid.');
            const stored = await repo.getPayment(input.invoice);
            await admin.auditPayment(user, key, 'syncPayment', input.invoice, input.reason, { invoice: input.invoice });
            const gateway = overrides.gateway || gatewayForPayment(env, stored);
            const verified = await gateway.check(input.invoice, stored);
            const payment = await repo.settlePayment(input.invoice, verified);
            data = { invoice: payment.invoice, status: payment.status, credited: payment.credited, credits: payment.credits };
            break;
          }
          case 'recoverPayment': {
            if (typeof input.invoice !== 'string' || !/^[A-Za-z0-9_-]{3,160}$/.test(input.invoice)) throw new AppError(400, 'INVALID_INVOICE', 'Nomor invoice tidak valid.');
            // Validate required audit fields before making an external status request.
            if (typeof input.reason !== 'string' || input.reason.trim().length < 5) throw new AppError(400, 'REASON_REQUIRED', 'Isi alasan rekonsiliasi minimal lima karakter.');
            const request = await repo.getPaymentRequestById(input.requestID);
            if (request.provider === 'doku' && request.providerInvoice !== input.invoice) throw new AppError(409, 'INVOICE_MISMATCH', 'Gunakan nomor tagihan DOKU yang tercatat pada permintaan ini.');
            const gateway = overrides.gateway || gatewayForPayment(env, request);
            const verified = await gateway.check(input.invoice);
            data = await admin.recoverPayment(user, key, input, verified, request.provider === 'doku' ? '' : paymentConfig(env).checkout);
            const payment = await repo.settlePayment(input.invoice, verified);
            data = { ...data, status: payment.status, credited: payment.credited };
            break;
          }
          default: throw new AppError(400, 'INVALID_ACTION', 'Tindakan admin tidak dikenal.');
        }
      }
      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error.code === 9 || error.code === 'failed-precondition') return errorResponse(new AppError(503, 'INDEX_REQUIRED', 'Indeks database belum siap. Deploy firestore.indexes.json lalu tunggu indeks selesai dibuat.'), res);
      return errorResponse(error, res);
    }
  };
}
