import { useId } from 'react';

export function CitySource({ metadata }) {
  let url;
  try { const parsed = new URL(metadata?.citySource?.url); if (parsed.protocol === 'https:') url = parsed.href; } catch { /* Text-only source. */ }
  if (metadata?.cityManual) return <p className="city-note">Kota yang digunakan: {metadata.cityUsed} · diisi manual.</p>;
  if (!metadata?.city) return <p className="city-note">Kota terbit belum ditemukan. Anda dapat melengkapinya secara manual.</p>;
  const source = metadata.citySource;
  return <p className={`city-note ${source?.confidence === 'medium' ? 'needs-review' : ''}`}>
    Kota terbit: <strong>{metadata.city}</strong>{source && <> · {url ? <a href={url} target="_blank" rel="noopener noreferrer">{source.label}</a> : source.label}</>}
    {source?.confidence === 'medium' && ' · Perlu diperiksa: alamat kontak jurnal bisa berbeda dari tempat terbit.'}
  </p>;
}

export default function CityField({ state }) {
  const id = useId();
  let message = state.demo ? 'Pencarian otomatis tersedia setelah masuk. Kota tetap bisa diisi manual di demo.' : !state.enabled ? 'Pencarian otomatis dinonaktifkan pengelola. Isi kota secara manual bila diperlukan.' :
    state.status === 'loading' || state.status === 'waiting' ? 'Mencari kota terbit… pencarian ini tidak mengurangi kredit.' :
      state.status === 'error' ? `${state.error} Anda masih dapat mengisi kota secara manual.` :
        state.status === 'not_found' ? 'Kota belum ditemukan dari sumber yang tersedia. Isi manual bila diperlukan.' : 'Kota dicari otomatis dari DOI, metadata penerbit, dan direktori jurnal. Anda dapat mengoreksinya.';
  if (state.manual) message = 'Koreksi manual akan dipakai pada sitasi ini.';
  return <div className="form-group city-field mb-8">
    <div className="city-label-row"><label className="input-label" htmlFor={id}>Kota Terbit <span className="text-muted font-normal">(Opsional)</span></label>
      {state.manual && <button type="button" className="city-reset" onClick={state.reset}>Gunakan otomatis</button>}</div>
    <input id={id} className="input-field-modern" type="text" maxLength={100} value={state.value} onChange={(event) => state.change(event.target.value)} placeholder="Otomatis jika sumber tersedia, atau isi manual" aria-describedby={`${id}-hint`} />
    <div id={`${id}-hint`} aria-live="polite"><p className="city-note">{message}</p>
      {!state.manual && state.city && <CitySource metadata={{ city: state.city, citySource: state.citySource }} />}</div>
  </div>;
}
