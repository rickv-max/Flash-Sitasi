import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { citationParts, plainCitation, safeCitationHTML } from '../../shared/citations';
import Icon from './Icon';

export function RichCitation({ html, className = '' }) {
  return <p className={`citation-text ${className}`}>{citationParts(html).map(({ text, italic }, index) =>
    italic ? <em key={index}>{text}</em> : <span key={index}>{text}</span>)}</p>;
}

export function CopyButton({ value, label = 'Salin', notify, compact = false }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    const plain = plainCitation(value);
    try {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({
            'text/plain': new Blob([plain], { type: 'text/plain' }),
            'text/html': new Blob([safeCitationHTML(value)], { type: 'text/html' }),
          })]);
        } catch { await navigator.clipboard.writeText(plain); }
      } else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(plain);
      else {
        const input = document.createElement('textarea');
        input.value = plain; input.style.position = 'fixed'; input.style.opacity = '0';
        document.body.appendChild(input); input.select();
        const success = document.execCommand('copy'); input.remove();
        if (!success) throw new Error('Copy failed');
      }
      setCopied(true); clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    } catch { notify?.('Teks belum tersalin. Pilih teks lalu salin secara manual.', 'error'); }
  }
  return <button type="button" className={`copy-button ${copied ? 'is-copied' : ''} ${compact ? 'compact' : ''}`} onClick={copy} disabled={!value} aria-label={copied ? 'Sitasi berhasil disalin' : label}>
    <Icon name={copied ? 'check' : 'copy'} size={15} /><span>{copied ? 'Tersalin' : label}</span>
  </button>;
}

// Hydration starts with the server markup, then moves dialogs outside page stacking contexts.
const subscribeToDOM = () => () => {};
const clientDOMReady = () => true;
const serverDOMReady = () => false;

export function Modal({ title, children, onClose, className = '' }) {
  const portalReady = useSyncExternalStore(subscribeToDOM, clientDOMReady, serverDOMReady);
  const id = useId();
  const ref = useRef();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!portalReady) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
    ref.current.querySelector(selector)?.focus();
    function keydown(event) {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const items = [...ref.current.querySelectorAll(selector)];
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [portalReady]);
  const dialog = <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={id}>
      <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Tutup dialog"><Icon name="close" /></button>
      <h2 id={id}>{title}</h2>{children}
    </section>
  </div>;
  return portalReady ? createPortal(dialog, document.body) : dialog;
}

export function Segmented({ options, value, onChange, label, disabled = false, className = '' }) {
  const ref = useRef();
  const id = useId();
  return <div className={`segmented ${className}`} role="tablist" aria-label={label} ref={ref}
    onKeyDown={(event) => {
      const index = options.findIndex((option) => option.value === value);
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % options.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + options.length) % options.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = options.length - 1;
      if (next !== undefined && !disabled) { event.preventDefault(); onChange(options[next].value); ref.current.children[next]?.focus(); }
    }}>
    {options.map((option) => <button id={`${id}-${option.value}`} key={option.value} role="tab" type="button" aria-selected={value === option.value} tabIndex={value === option.value ? 0 : -1}
      className={value === option.value ? 'active' : ''} disabled={disabled} onClick={() => onChange(option.value)}>
      {option.icon && <Icon name={option.icon} size={16} />}{option.label}
    </button>)}
  </div>;
}

export function Spinner({ label = 'Memproses' }) { return <span className="spinner" role="status" aria-label={label} />; }

