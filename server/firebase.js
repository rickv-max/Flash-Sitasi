import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { AppError } from './errors.js';

export function adminServices(env = process.env) {
  if (!getApps().length) {
    try {
      const account = env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) : {
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };
      initializeApp({ credential: cert(account) });
    } catch {
      throw new AppError(503, 'AUTH_CONFIG', 'Layanan akun belum siap. Silakan hubungi pengelola.');
    }
  }
  return { auth: getAuth(), db: getFirestore() };
}

export async function authenticate(req, auth) {
  const match = req.headers.authorization?.match(/^Bearer (\S+)$/i);
  if (!match) throw new AppError(401, 'UNAUTHENTICATED', 'Masuk ke akun untuk melanjutkan.');
  try {
    return await auth.verifyIdToken(match[1], true);
  } catch {
    throw new AppError(401, 'SESSION_EXPIRED', 'Sesi berakhir. Silakan masuk kembali.');
  }
}
