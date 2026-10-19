import { useEffect, useRef } from 'react';
import Icon from './Icon';

export default function GenerationError({ message, onDismiss, onRetry }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!message) return;
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [message]);
  if (!message) return null;
  return <div ref={ref} className="generation-error" role="alert" tabIndex={-1} aria-labelledby="generation-error-title">
    <span className="generation-error-icon" aria-hidden="true"><Icon name="alert" size={21} /></span>
    <div className="generation-error-content">
      <strong id="generation-error-title">Sitasi belum berhasil dibuat</strong>
      <p>{message}</p>
      {onRetry && <button type="button" className="generation-error-retry" onClick={onRetry}>Coba lagi</button>}
    </div>
    <button type="button" className="generation-error-close" onClick={onDismiss} aria-label="Tutup pesan gagal generate"><Icon name="close" size={18} /></button>
  </div>;
}
