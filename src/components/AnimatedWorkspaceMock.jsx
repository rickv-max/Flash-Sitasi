import { useState, useEffect } from 'react';
import { DEMO_DOI, DEMO_METADATA, buildCitations } from '../../shared/citations';
import { RichCitation } from './Primitives';
const DEMO_RESULTS = buildCitations(DEMO_METADATA);

export default function AnimatedWorkspaceMock() {
  const [step, setStep] = useState(9);
  const [typedText, setTypedText] = useState(DEMO_DOI);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers = new Set();
    let disposed = false;
    const later = (callback, delay) => {
      const timer = setTimeout(() => { timers.delete(timer); if (!disposed) callback(); }, delay);
      timers.add(timer);
    };
    const run = () => {
      setStep(0); setTypedText('');
      later(() => setStep(1), 700);
      later(() => setStep(2), 1200);
      const type = (index) => {
        setTypedText(DEMO_DOI.slice(0, index));
        if (index < DEMO_DOI.length) later(() => type(index + 1), 50);
      };
      later(() => type(1), 1500);
      later(() => setStep(3), 3100);
      later(() => setStep(4), 3600);
      later(() => setStep(5), 3900);
      later(() => setStep(6), 4900);
      later(() => setStep(8), 6200);
      later(() => setStep(9), 6500);
      later(run, 11000);
    };
    later(run, 300);
    return () => { disposed = true; timers.forEach(clearTimeout); };
  }, []);

  return (
    <div className="mock-workspace glass-panel relative text-left bg-surface-solid border border-color rounded-xl shadow-premium-glow mx-auto max-w-3xl overflow-hidden z-20">
      <div className="preview-header bg-surface-alt border-b border-color px-4 py-3 flex items-center gap-3">
         <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400"></span>
            <span className="w-3 h-3 rounded-full bg-amber-400"></span>
            <span className="w-3 h-3 rounded-full bg-green-400"></span>
         </div>
         <span className="text-xs font-semibold text-muted font-mono ml-2">demo_ruang_kerja.app</span>
      </div>

      <div className="p-6 sm:p-8 relative z-10 bg-white">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-color flex-col sm:flex-row gap-4 sm:gap-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 m-0">Format Sitasi</h3>
            <p className="text-xs text-slate-500 mt-1 m-0 hidden sm:block">Pilih gaya output</p>
          </div>
          <div className="style-toggle pointer-events-none w-full sm:w-auto flex justify-center">
            <button className="style-toggle-btn active flex-1 sm:flex-none justify-center">📝 Footnote</button>
            <button className="style-toggle-btn flex-1 sm:flex-none justify-center">📑 APA 7</button>
          </div>
        </div>

        <div className="form-group mb-5">
          <label className="input-label text-xs text-slate-900 font-bold mb-2 block">Nomor DOI Referensi</label>
          <div className={`mock-input-wrap ${step >= 2 && step < 5 ? 'focused' : ''}`}>
            <span className="mock-input-text text-slate-900 font-medium">{typedText}</span>
            {step >= 2 && step < 4 && <span className="mock-caret"></span>}
            {!typedText && step <= 1 && <span className="text-slate-400 opacity-80 text-sm">Contoh: 10.1038/s41586...</span>}
          </div>
        </div>

        <button className={`btn-primary w-full py-3 shadow-glow transition-transform duration-200 ${step === 4 ? 'scale-95' : 'scale-100'}`}>
          {step === 5 ? (
            <span className="flex items-center gap-2 justify-center text-white"><span className="loading-spinner w-4 h-4 border-white"></span> Mengekstrak Metadata...</span>
          ) : "Generate Sitasi (1 Kredit)"}
        </button>

        <div className={`mock-results-area grid grid-cols-1 sm:grid-cols-2 gap-4 transition-all duration-1000 ease-in-out ${step >= 6 ? 'mock-results-visible' : 'mock-results-hidden'}`}>
          <div className="result-block border border-color rounded-md p-4 relative bg-slate-50">
            <div className="flex justify-between items-center border-b border-color pb-2 mb-3">
              <span className="text-xs font-extrabold text-slate-500">CATATAN KAKI</span>
              <button className={`btn-copy-modern text-xs py-1 px-2 transition-transform ${step === 8 ? 'scale-95 bg-white border-slate-800' : 'scale-100'}`}>
                {step > 8 ? <><span className="text-green-600 font-bold text-xs mr-1">✓</span><span className="text-slate-800">Disalin</span></> : <span className="text-slate-800">Salin</span>}
              </button>
            </div>
            <RichCitation className="text-sm m-0 leading-relaxed text-slate-800 font-medium" html={DEMO_RESULTS.footnote} />
          </div>
          <div className="result-block border border-color rounded-md p-4 relative bg-slate-50">
            <div className="flex justify-between items-center border-b border-color pb-2 mb-3">
              <span className="text-xs font-extrabold text-slate-500">APA 7TH EDITION</span>
              <button className="btn-copy-modern text-xs py-1 px-2 scale-100 text-slate-800">Salin</button>
            </div>
            <RichCitation className="text-sm m-0 leading-relaxed text-slate-800 font-medium" html={DEMO_RESULTS.apaReference} />
          </div>
        </div>
      </div>

      <div className={`fake-cursor cursor-step-${step} hidden sm:block`}>
        <svg width="28" height="34" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.98402 1.54516L9.61053 28.0267C9.91974 29.0999 11.4554 29.1558 11.8152 28.1069L14.7336 19.6146L22.2573 15.656C23.1979 15.1611 23.0116 13.7661 21.9686 13.4925L2.57022 0.354145C1.61111 -0.290886 0.536968 0.697424 1.98402 1.54516Z" fill="#0f172a" stroke="#ffffff" strokeWidth="2.5"/>
        </svg>
      </div>

      <style>{`
        .mock-input-wrap { width: 100%; padding: 0.875rem 1.25rem; font-size: 0.95rem; background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); min-height: 52px; display: flex; align-items: center; transition: 0.2s; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); }
        .mock-input-wrap.focused { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
        .mock-caret { display: inline-block; width: 2px; height: 18px; background: var(--primary); margin-left: 4px; animation: blink 1s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .fake-cursor { position: absolute; z-index: 50; transition: all 0.7s cubic-bezier(0.25, 1, 0.5, 1); pointer-events: none; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2)); }
        .cursor-step-0 { top: 90%; left: 80%; opacity: 0; }
        .cursor-step-1, .cursor-step-2 { top: 35%; left: 25%; opacity: 1; transform: scale(1); }
        .cursor-step-3 { top: 52%; left: 50%; opacity: 1; transform: scale(1); }
        .cursor-step-4, .cursor-step-5 { top: 52%; left: 50%; opacity: 1; transform: scale(0.9); }
        .cursor-step-6, .cursor-step-7 { top: 80%; left: 45%; opacity: 1; transform: scale(1); }
        .cursor-step-8 { top: 80%; left: 45%; opacity: 1; transform: scale(0.9); }
        .cursor-step-9 { top: 85%; left: 80%; opacity: 0; }
      `}</style>
    </div>
  );
};
