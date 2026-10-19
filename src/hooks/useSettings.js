import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { api } from '../lib/api';

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const refresh = useCallback(async () => {
    try { const data = await api('config', { method: 'GET' }); setSettings(data); }
    catch { /* Keep demo usable before deployment has been configured. */ }
  }, []);
  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const resume = () => { if (document.visibilityState === 'visible') refresh(); };
    const interval = setInterval(resume, 60000);
    document.addEventListener('visibilitychange', resume);
    return () => { clearTimeout(timer); clearInterval(interval); document.removeEventListener('visibilitychange', resume); };
  }, [refresh]);
  return { settings, refresh };
}
