export const CREDIT_CATALOG_REVISION = 2;
export const CREDIT_PRICE = 750;
export const MIN_TOPUP = 10;
export const MAX_TOPUP = 500;
export const WELCOME_CREDITS = 5;
export const TOPUP_PACKAGES = [10, 50, 100];
export const MAX_BATCH = 20;
export const MIN_PAYMENT_AMOUNT = 5000;
export const MAX_PAYMENT_AMOUNT = 5000000;
export const CREDIT_PACKAGES = Object.freeze([
  Object.freeze({ id: 'pro', name: 'Pro', credits: 199, priceKey: 'proPackagePrice', price: 115000 }),
  Object.freeze({ id: 'plus', name: 'Plus', credits: 499, priceKey: 'plusPackagePrice', price: 299000 }),
  Object.freeze({ id: 'sultan', name: 'Sultan', credits: 999, priceKey: 'sultanPackagePrice', price: 500000 }),
]);

export const creditPackages = (settings = {}) => CREDIT_PACKAGES.map((item) => ({ ...item, price: settings[item.priceKey] ?? item.price }));

export function purchaseQuote(input, settings) {
  if (input.packageId !== undefined && input.packageId !== '') {
    const item = creditPackages(settings).find((item) => item.id === input.packageId);
    if (!item || input.credits !== undefined) throw new Error('Pilih paket yang tersedia atau jumlah kredit satuan, bukan keduanya.');
    if (!Number.isSafeInteger(item.price) || item.price < MIN_PAYMENT_AMOUNT || item.price > MAX_PAYMENT_AMOUNT) throw new Error('Harga paket belum valid. Hubungi pengelola.');
    return { credits: item.credits, amount: item.price, packageId: item.id, packageName: item.name };
  }
  return { credits: input.credits, amount: topupPrice(input.credits, settings), packageId: '', packageName: 'Satuan' };
}

export function samePurchase(previous, input) {
  return previous.packageId ? previous.packageId === input.packageId && input.credits === undefined :
    !input.packageId && previous.credits === input.credits;
}

export function topupPrice(credits, settings = { minTopup: MIN_TOPUP, maxTopup: MAX_TOPUP, pricePerCredit: CREDIT_PRICE }) {
  if (!Number.isInteger(credits) || credits < settings.minTopup || credits > settings.maxTopup) {
    throw new Error(`Pilih ${settings.minTopup}–${settings.maxTopup} kredit dalam bilangan bulat.`);
  }
  const amount = credits * settings.pricePerCredit;
  if (!Number.isSafeInteger(amount) || amount < MIN_PAYMENT_AMOUNT || amount > MAX_PAYMENT_AMOUNT) throw new Error('Nominal top up harus Rp5.000–Rp5.000.000. Sesuaikan jumlah kredit.');
  return amount;
}

export const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value);
