export const methodSupports = (method, amount) => Number.isSafeInteger(amount) && amount >= method.minAmount && amount <= method.maxAmount;

export function publicPaymentMethods(body, configuredMethod = '') {
  const list = body.data?.payment_methods || body.payment_methods || (Array.isArray(body.data) ? body.data : null);
  if (!Array.isArray(list)) throw new Error('Invalid payment method response');
  return list.filter((item) => item && typeof item.id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(item.id) && item.id !== 'all' &&
    item.enabled !== false && item.available === true && (!configuredMethod || configuredMethod === 'all' || item.id === configuredMethod))
    .slice(0, 40).map((item) => {
      const min = Number(item.min_amount), max = Number(item.max_amount);
      return { id: item.id, name: typeof item.name === 'string' ? item.name.slice(0, 80) : item.id,
        minAmount: Number.isSafeInteger(min) && min > 0 ? min : item.id === 'qris' ? 5000 : 1000,
        maxAmount: Number.isSafeInteger(max) && max > 0 ? max : item.id === 'qris' ? 500000 : 5000000,
        reportedLimits: Number.isSafeInteger(max) && max > 0 };
    }).filter((item) => item.maxAmount >= item.minAmount);
}

export function creditRangeSupported(methods, settings) {
  const { pricePerCredit, minTopup, maxTopup } = settings;
  if (![pricePerCredit, minTopup, maxTopup].every(Number.isSafeInteger) || pricePerCredit <= 0 || minTopup < 1 || maxTopup < minTopup) return false;
  return methods.some((method) => Math.max(minTopup, Math.ceil(method.minAmount / pricePerCredit)) <= Math.min(maxTopup, Math.floor(method.maxAmount / pricePerCredit)));
}
export function paymentAvailability(body, configuredMethod = '') {
  const methods = publicPaymentMethods(body, configuredMethod);
  if (methods.length) return { methods, availability: { state: 'available', message: '' } };
  const unrestricted = publicPaymentMethods(body);
  const restricted = configuredMethod && configuredMethod !== 'all' && unrestricted.length > 0;
  return { methods, availability: restricted ? {
    state: 'method_restricted',
    message: 'Metode pembayaran yang dipilih pengelola belum tersedia. Pengelola perlu memeriksa konfigurasi pembayaran.',
  } : {
    state: 'provider_unavailable',
    message: 'Pembayaran sementara belum tersedia dari penyedia. Silakan cek kembali beberapa saat lagi.',
  } };
}
// Log only method flags. No account status, requirements, balances or provider payloads leave the gateway.
export function paymentMethodDiagnostics(body, configuredMethod = '') {
  const list = body.data?.payment_methods || body.payment_methods || (Array.isArray(body.data) ? body.data : []);
  const flag = (value) => {
    if (typeof value === 'boolean') return value;
    if (value === 0 || value === 1) return value;
    if (typeof value === 'string' && /^(?:true|false|0|1)$/i.test(value.trim())) return value.trim().toLowerCase();
    return value === undefined ? 'missing' : 'unrecognized';
  };
  const valid = list.filter((item) => item && typeof item.id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(item.id)).slice(0, 40);
  const knownIDs = new Set(['qris', 'qris_bayar_gg', 'qris_user', 'qris_livin', 'gopay_qris', 'global_card', 'ovo', 'all']);
  return { event: 'payment_methods_unavailable', configuredRestriction: !!configuredMethod && configuredMethod !== 'all',
    methods: valid.map((item) => ({ id: knownIDs.has(item.id) ? item.id : 'unrecognized', enabled: flag(item.enabled), available: flag(item.available) })) };
}
