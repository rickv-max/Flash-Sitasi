import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export function usePaymentMethods(enabled = true) {
  const [state, setState] = useState({ methods: [], availability: null, ready: false, loading: false, error: '' });
  const refresh = useCallback(async () => {
    setState((value) => ({ ...value, loading: true }));
    try { const data = await api('payment-options', { method: 'GET' }); setState({ methods: data.methods, availability: data.availability || null, ready: true, loading: false, error: '' }); }
    catch (error) { setState((value) => ({ ...value, ready: false, loading: false, error: error.message })); }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(refresh, 0);
    const resume = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', resume); window.addEventListener('online', resume);
    return () => { clearTimeout(timer); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); };
  }, [enabled, refresh]);
  useEffect(() => {
    if (!enabled || state.ready && state.methods.length) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30000);
    return () => clearInterval(timer);
  }, [enabled, refresh, state.ready, state.methods.length]);
  return { ...state, refresh };
}
