export const CREDIT_PRICE = 750;
export const MIN_TOPUP = 10;
export const MAX_TOPUP = 500;
export const WELCOME_CREDITS = 5;
export const TOPUP_PACKAGES = [10, 50, 100];
export const MAX_BATCH = 20;

export function topupPrice(credits, settings = { minTopup: MIN_TOPUP, maxTopup: MAX_TOPUP, pricePerCredit: CREDIT_PRICE }) {
  if (!Number.isInteger(credits) || credits < settings.minTopup || credits > settings.maxTopup) {
    throw new Error(`Pilih ${settings.minTopup}–${settings.maxTopup} kredit dalam bilangan bulat.`);
  }
  return credits * settings.pricePerCredit;
}

export const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value);
