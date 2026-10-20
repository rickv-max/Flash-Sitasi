import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { isDOI } from '../../shared/citations';

export function useCity({ user, demo, mode, input, enabled = true }) {
  const key = JSON.stringify({ uid: user?.uid || '', demo, mode, input, enabled });
  const [automatic, setAutomatic] = useState({ key: '', city: '', status: 'idle', citySource: null });
  const [override, setOverride] = useState({ key: '', value: '' });
  let valid = false;
  if (mode === 'doi') valid = isDOI(input || '');
  if (mode === 'url') { try { valid = ['https:', 'http:'].includes(new URL(input).protocol); } catch { /* Incomplete input. */ } }
  if (mode === 'manual') valid = !!(input?.journal?.trim().length >= 3 || input?.publisher?.trim().length >= 3);
  const inputJSON = JSON.stringify(input);
  useEffect(() => {
    if (!valid || !enabled || demo || !user) return;
    let active = true;
    const timer = setTimeout(async () => {
      setAutomatic({ key, city: '', status: 'loading', citySource: null });
      try {
        const data = await api('city', { user, body: { mode, input: JSON.parse(inputJSON) } });
        if (active) setAutomatic({ ...data, key, status: data.city ? 'found' : data.cityStatus || 'not_found' });
      } catch (error) {
        if (active) setAutomatic({ key, city: '', status: 'error', citySource: null, error: error.message });
      }
    }, 1000);
    return () => { active = false; clearTimeout(timer); };
  }, [key, valid, enabled, demo, user, mode, inputJSON]);
  const manual = override.key === key && !!override.value.trim();
  const current = automatic.key === key ? automatic : { city: '', citySource: null, status: valid && enabled && !demo && user ? 'waiting' : 'idle' };
  return { ...current, value: manual ? override.value : current.city || '', manual,
    manualCity: manual ? override.value.trim() : '', valid, enabled, demo,
    change: (value) => setOverride({ key, value }), reset: () => setOverride({ key: '', value: '' }),
    accept: (metadata) => setAutomatic({ key, city: metadata.city || '', citySource: metadata.citySource || null,
      status: metadata.city ? 'found' : metadata.cityStatus || 'not_found' }) };
}
