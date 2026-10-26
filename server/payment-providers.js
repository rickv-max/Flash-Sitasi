import { AppError } from './errors.js';
import { dokuConfig, paymentConfig, paymentMethodsConfig, paymentProvider } from './config.js';
import { createGateway } from './gateway.js';
import { createDokuGateway, DOKU_QRIS } from './doku.js';

// Old records without a provider belong to bayar.gg; credentials must never reroute them.
export function gatewayForPayment(env, payment) {
  const provider = payment ? payment.provider || 'bayar_gg' : paymentProvider(env);
  if (provider === 'bayar_gg') return createGateway(paymentConfig(env));
  if (provider !== 'doku') throw new AppError(503, 'PAYMENT_CONFIG', 'Penyedia tagihan belum dikenali.');
  const config = dokuConfig(env);
  if (payment && (payment.environment !== config.environment || payment.merchantId !== config.clientId)) {
    throw new AppError(409, 'PAYMENT_ACCOUNT_MISMATCH', 'Akun DOKU tagihan berbeda dari konfigurasi saat ini. Hubungi pengelola.');
  }
  return createDokuGateway(config);
}

export async function checkoutOptions(env) {
  if (paymentProvider(env) === 'bayar_gg') return { ...await createGateway(paymentMethodsConfig(env)).options(), provider: 'bayar_gg' };
  try {
    const config = dokuConfig(env);
    return { provider: 'doku', environment: config.environment, methods: [DOKU_QRIS], availability: {
      state: 'configured', message: '',
    } };
  } catch (error) {
    if (error.code !== 'PAYMENT_CONFIG' && error.code !== 'APP_CONFIG') throw error;
    return { provider: 'doku', methods: [], availability: { state: 'not_configured', message: error.message } };
  }
}
