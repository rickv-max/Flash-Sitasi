import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { api } from '../lib/api';

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { const data = await api('config', { method: 'GET' }); setSettings({ ...DEFAULT_SETTINGS, ...data }); setReady(true); setError(''); return data; }
    catch { setError('Harga terbaru belum tersambung. Coba muat ulang informasi harga.'); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const resume = () => { if (document.visibilityState === 'visible') refresh(); };
    const interval = setInterval(resume, 20000);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('flashcite:settings') : null;
    if (channel) channel.onmessage = refresh;
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => { clearTimeout(timer); clearInterval(interval); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); channel?.close(); };
  }, [refresh]);
  return { settings, ready, error, refresh };
}

export function publishSettingsChange() {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('flashcite:settings'); channel.postMessage('updated'); channel.close();
}
