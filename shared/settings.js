export const DEFAULT_SETTINGS = Object.freeze({
  pricePerCredit: 750, welcomeCredits: 5, minTopup: 10, maxTopup: 500,
  maxBatch: 20, signupEnabled: true, paymentEnabled: true, maintenance: false,
  maintenanceMessage: 'Aplikasi sedang dalam pemeliharaan. Silakan kembali sebentar lagi.',
  autoCityEnabled: true,
});

export function validateSettings(input = {}) {
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(settings)) if (Object.hasOwn(input, key)) settings[key] = input[key];
  for (const [key, min, max] of [
    ['pricePerCredit', 100, 100000], ['welcomeCredits', 0, 10000],
    ['minTopup', 1, 5000], ['maxTopup', 1, 5000], ['maxBatch', 1, 50],
  ]) {
    if (!Number.isSafeInteger(settings[key]) || settings[key] < min || settings[key] > max) throw new Error(`${key} harus bilangan bulat ${min}–${max}.`);
  }
  if (settings.minTopup > settings.maxTopup) throw new Error('Minimal top up tidak boleh melebihi maksimal.');
  if (settings.minTopup * settings.pricePerCredit < 5000 || settings.maxTopup * settings.pricePerCredit > 500000) {
    throw new Error('Rentang nominal top up harus Rp5.000–Rp500.000 agar sesuai batas QRIS Admin.');
  }
  for (const key of ['signupEnabled', 'paymentEnabled', 'maintenance', 'autoCityEnabled']) {
    if (typeof settings[key] !== 'boolean') throw new Error(`${key} harus boolean.`);
  }
  if (typeof settings.maintenanceMessage !== 'string' || settings.maintenanceMessage.length > 300) throw new Error('Pesan pemeliharaan maksimal 300 karakter.');
  settings.maintenanceMessage = settings.maintenanceMessage.trim() || DEFAULT_SETTINGS.maintenanceMessage;
  return settings;
}
