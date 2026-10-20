import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { api, readStorage, writeStorage } from '../lib/api';
import { purchaseQuote, samePurchase } from '../../shared/catalog';

export function usePayment({ user, notify, settings = DEFAULT_SETTINGS, initialPackageId = '', onPricingChange }) {
  const storageKey = `flashcite:payment:${user?.uid || 'guest'}`;
  const requestStorage = `flashcite:payment-request:${user?.uid || 'guest'}`;
  const savedRequest = useRef(readStorage(requestStorage));
  const [credits, setCredits] = useState(String(savedRequest.current?.credits || Math.min(settings.maxTopup, Math.max(settings.minTopup, 50))));
  const [packageId, setPackageId] = useState(savedRequest.current ? savedRequest.current.packageId || '' : initialPackageId);
  const [uncertain, setUncertain] = useState(!!savedRequest.current);
  const [pending, setPending] = useState(() => readStorage(storageKey));
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [checkError, setCheckError] = useState('');
  const payingRef = useRef(false);
  const checkingRef = useRef(false);
  let quote;
  try { quote = purchaseQuote(packageId ? { packageId } : { credits: Number(credits) }, settings); } catch { /* Keep invalid input editable. */ }
  const valid = !!quote || uncertain && !!savedRequest.current;
  const count = uncertain && savedRequest.current ? savedRequest.current.credits : quote?.credits || 0;
  const amount = uncertain && savedRequest.current ? savedRequest.current.amount : quote?.amount || 0;
  const invoice = pending?.invoice;
  const status = pending?.status;
  let checkoutURL;
  try {
    const url = new URL(pending?.paymentURL);
    if (url.protocol === 'https:' && !url.username && !url.password) checkoutURL = url.href;
  } catch { /* A corrupted saved payment must never produce an unsafe link. */ }

  const checkPayment = useCallback(async () => {
    if (!user || !invoice || checkingRef.current) return;
    checkingRef.current = true; setChecking(true);
    try {
      const next = await api(`payment-status?invoice=${encodeURIComponent(invoice)}`, { user, method: 'GET' });
      writeStorage(storageKey, next); setPending(next); setCheckError('');
      if (next.credited) { writeStorage(requestStorage, null); notify(`${next.credits} kredit sudah masuk. Selamat melanjutkan tulisanmu.`, 'success'); }
    } catch (error) { setCheckError(error.message); }
    finally { checkingRef.current = false; setChecking(false); }
  }, [user, invoice, storageKey, requestStorage, notify]);

  useEffect(() => {
    if (!invoice || !user || status !== 'pending') return;
    const run = () => { if (document.visibilityState !== 'hidden') checkPayment(); };
    const first = setTimeout(run, 0);
    const timer = setInterval(run, 10000);
    document.addEventListener('visibilitychange', run);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener('visibilitychange', run); };
  }, [invoice, user, status, checkPayment]);

  async function createPayment() {
    if (!valid || payingRef.current) return;
    payingRef.current = true; setPaying(true); setError('');
    const input = packageId ? { packageId } : { credits: count };
    const request = savedRequest.current && samePurchase(savedRequest.current, input) ? savedRequest.current : { key: crypto.randomUUID(), credits: count, packageId, amount };
    savedRequest.current = request;
    writeStorage(requestStorage, request);
    try {
      const next = await api('create-payment', { user, body: { ...(request.packageId ? { packageId: request.packageId } : { credits: request.credits }), expectedAmount: request.amount }, key: request.key });
      writeStorage(storageKey, next); setPending(next); setUncertain(false);
    } catch (error) {
      setError(error.message); setUncertain(!!error.paymentPending);
      if (!error.paymentPending) { savedRequest.current = null; writeStorage(requestStorage, null); }
      if (error.code === 'PRICE_CHANGED') await onPricingChange?.();
    }
    finally { payingRef.current = false; setPaying(false); }
  }

  function reset() {
    writeStorage(storageKey, null); writeStorage(requestStorage, null);
    savedRequest.current = null; setPending(null); setError(''); setCheckError(''); setUncertain(false);
  }

  return { credits, setCredits, packageId, setPackageId, uncertain, pending, paying, checking, error, setError, checkError, count, valid, amount, status, checkoutURL, checkPayment, createPayment, reset };
}
