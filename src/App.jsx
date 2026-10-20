import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAccount } from './hooks/useAccount';
import { api, readStorage, writeStorage } from './lib/api';
import { useSettings } from './hooks/useSettings';
import { useCity } from './hooks/useCity';
import CityField, { CitySource } from './components/CityField';
import { buildCitations, getCitationResults, plainCitation, safeCitationHTML, isDOI, parseAuthor, DEMO_DOI, DEMO_METADATA } from '../shared/citations';
import { RichCitation } from './components/Primitives';
import PaymentModal from './components/PaymentModal';
import AnimatedWorkspaceMock from './components/AnimatedWorkspaceMock';
import GenerationError from './components/GenerationError';
import { MONTHS } from '../shared/publication-date';
import { FAQS, CREATOR } from '../shared/site-content';
import PricingSection from './components/PricingSection';
import SiteFooter from './components/SiteFooter';
import './pages/public-pages.css';
import './App.css';
import './responsive.css';

gsap.registerPlugin(ScrollTrigger);
const AdminPanel = lazy(() => import('./components/AdminPanel'));
function citationForView(item) {
  const results = getCitationResults(item);
  return { ...item.metadata, cityUsed: item.cityUsed, cityManual: item.cityManual, results, authorDafpus: plainCitation(results.bibliography) };
}
const buildFootnote = (meta) => meta.results.footnote;
const buildDafpus = (meta) => meta.results.bibliography;
const buildApaInText = (meta) => meta.results.apaInText;
const buildApaReference = (meta) => meta.results.apaReference;
// Original visual assets and icons.
  const VideoLogo = () => (<video src="/logo.mp4" poster="/logo2.png" autoPlay loop muted playsInline aria-label="FlashCite" className="video-logo-asset" />);
  const CheckIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" height="16" width="16"><polyline points="20 6 9 17 4 12"></polyline></svg>);
  const CopyIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);
  const WarningIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>);
  const CoinIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>);
  const CloseIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="20" width="20"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
  const ArrowRightIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="18" width="18"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>);
  const MenuIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="24" width="24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>);
  const LogoutIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>);
  
  // Custom Sidebar Icons
  const DoiIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>);
  const LinkIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>);
  const BatchIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>);
  const ManualIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>);
  const HistoryIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>);

  // Custom Solid/Artistic Icons for Floating Background
  const FloatBook = () => (<svg width="80" height="80" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bookGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop stopColor="#3b82f6" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient><linearGradient id="pageGrad" x1="0" y1="0" x2="64" y2="64"><stop stopColor="#ffffff" /><stop offset="1" stopColor="#f1f5f9" /></linearGradient><filter id="shadowBook"><feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity="0.15" /></filter></defs><g filter="url(#shadowBook)"><path d="M32 16C24 16 16 20 10 24V56C16 52 24 48 32 48C40 48 48 52 54 56V24C48 20 40 16 32 16Z" fill="url(#pageGrad)" stroke="#e2e8f0" strokeWidth="2"/><path d="M32 16V48" stroke="#cbd5e1" strokeWidth="2"/><path d="M24 16V28" stroke="url(#bookGrad)" strokeWidth="6" strokeLinecap="round"/><rect x="18" y="14" width="8" height="20" fill="#ef4444" rx="2"/></g></svg>);
  const FloatToga = () => (<svg width="90" height="90" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="togaGrad" x1="0" y1="0" x2="64" y2="64"><stop stopColor="#1e1b4b"/><stop offset="1" stopColor="#4c1d95"/></linearGradient><filter id="shadowToga"><feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity="0.2" /></filter></defs><g filter="url(#shadowToga)"><path d="M32 16L8 28L32 40L56 28L32 16Z" fill="url(#togaGrad)" /><path d="M18 33V45C18 45 25 50 32 50C39 50 46 45 46 45V33" fill="none" stroke="url(#togaGrad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><path d="M52 30V44" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round"/><circle cx="52" cy="46" r="4" fill="#f59e0b"/></g></svg>);
  const FloatFlash = () => (<svg width="70" height="70" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="flashGrad" x1="0" y1="0" x2="64" y2="64"><stop stopColor="#fef08a"/><stop offset="1" stopColor="#ea580c"/></linearGradient><filter id="shadowFlash"><feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.25" floodColor="#ea580c" /></filter></defs><path d="M36 4L14 34H32L28 60L50 30H32L36 4Z" fill="url(#flashGrad)" filter="url(#shadowFlash)"/></svg>);

  const ShieldIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="28" width="28"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>);
  const SparklesIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="28" width="28"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path></svg>);
  const ZapIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="28" width="28"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>);

  const SkeletonLoader = () => (
    <div className="card mt-6 glass-panel animate-fade-in bg-white border-0 shadow-premium">
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="skeleton-circle w-10 h-10 rounded-full"></div>
          <div className="skeleton-line w-40"></div>
        </div>
        <div className="skeleton-box h-24 mb-6 rounded-lg"></div>
        <div className="skeleton-line w-48 mb-6"></div>
        <div className="skeleton-box h-20 rounded-lg"></div>
      </div>
    </div>
  );
// The original Flash Sitasi layout, connected to the verified server API.
export default function App({ initialView = 'landing', initialDemo = false }) {
  const returning = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('payment') === 'return';
  const [requestedView, setCurrentView] = useState(returning ? 'tool' : initialView);
  const [demo, setDemo] = useState(initialDemo);
  const [demoHistory, setDemoHistory] = useState(() => readStorage('flashcite:demo-history', []));
  const landingRef = useRef(null);
  const appRef = useRef(null);
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);
  const notifyTimer = useRef();
  const copyTimer = useRef();
  const busyRef = useRef(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const showNotificationMsg = useCallback((message, type = 'info') => {
    clearTimeout(notifyTimer.current);
    setNotification({ show: true, message, type });
    notifyTimer.current = setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), type === 'error' ? 8000 : 4000);
  }, []);
  const account = useAccount(showNotificationMsg);
  const { settings, ready: pricingReady, error: pricingError, refresh: refreshSettings } = useSettings();
  const isAdmin = !demo && account.profile?.role === 'admin' && account.profile?.status !== 'blocked';
  const user = demo ? { uid: 'demo', displayName: 'Demo', email: '' } : account.user;
  const userData = demo ? { credits: 5 } : account.profile || { credits: 0 };
  const history = (demo ? demoHistory : account.history).map((item) => {
    const result = getCitationResults(item);
    return { ...item, footnote: result.footnote, dafpus: result.bibliography, apaInText: result.apaInText, apaRef: result.apaReference };
  });
  const currentView = requestedView === 'tool' && !user ? 'landing' : requestedView;
  const canGenerate = demo || !!account.ready && (!settings.maintenance || isAdmin);
  const [showTopupModal, setShowTopupModal] = useState(returning);
  const [preferredPackageId, setPreferredPackageId] = useState('');
  const [inputMode, setInputMode] = useState('doi');
  const [citationStyle, setCitationStyle] = useState('footnote');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
  const [doiInput, setDoiInput] = useState(initialDemo ? DEMO_DOI : '');
  const [urlInput, setUrlInput] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [kotaInput, setKotaInput] = useState('');
  const [mAuthor, setMAuthor] = useState('');
  const [mTitle, setMTitle] = useState('');
  const [mJournal, setMJournal] = useState('');
  const [mYear, setMYear] = useState('');
  const [mMonth, setMMonth] = useState('');
  const [mVolume, setMVolume] = useState('');
  const [mIssue, setMIssue] = useState('');
  const [mPage, setMPage] = useState('');
  const [mPublisher, setMPublisher] = useState('');
  const [mDOI, setMDOI] = useState('');
  const cityMode = inputMode === 'manual' && isDOI(mDOI) ? 'doi' : inputMode;
  const cityInput = inputMode === 'doi' ? doiInput.trim() : inputMode === 'url' ? urlInput.trim() : inputMode === 'manual' ? (isDOI(mDOI) ? mDOI.trim() : { journal: mJournal, publisher: mPublisher }) : '';
  const city = useCity({ user: account.user, demo, mode: cityMode, input: cityInput, enabled: settings.autoCityEnabled && (!settings.maintenance || isAdmin) });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [footnoteResult, setFootnoteResult] = useState('');
  const [dafpusResult, setDafpusResult] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const requestKeys = useRef(readStorage(`flashcite:citation-requests:${user?.uid || 'guest'}`, {}));

  useEffect(() => () => { clearTimeout(notifyTimer.current); clearTimeout(copyTimer.current); }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const resize = (event) => { setIsMobile(event.matches); if (!event.matches) setIsSidebarOpen(false); };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (!isSidebarOpen || !isMobile) return;
    const oldOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = 'hidden';
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]';
    sidebarRef.current?.querySelector(selector)?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') { setIsSidebarOpen(false); return; }
      if (event.key !== 'Tab') return;
      const items = [...(sidebarRef.current?.querySelectorAll(selector) || [])];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keydown); menuButton?.focus(); };
  }, [isSidebarOpen, isMobile]);
  useEffect(() => {
    if (returning) {
      const url = new URL(window.location.href); url.searchParams.delete('payment');
      window.history.replaceState({}, '', url);
    }
  }, [returning]);

  useEffect(() => {
    if (currentView !== 'landing' || !appRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      gsap.timeline()
        .fromTo('.navbar-wrapper', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: 'power3.out' })
        .fromTo('.hero-badge', { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: .45 }, '-=.3')
        .fromTo('.title-word', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .06, ease: 'power3.out' }, '-=.25')
        .fromTo('.hero-subtitle, .hero-cta', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .55, stagger: .08 }, '-=.3');
      for (const [selector, trigger] of [['.preview-card-anim', '.preview-section'], ['.step-card-anim', '.steps-section'], ['.feature-card-anim', '.features-section'], ['.pricing-card-anim', '.pricing-section']]) {
        gsap.fromTo(selector, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .08, scrollTrigger: { trigger, start: 'top 93%', once: true } });
      }
    }, appRef);
    return () => context.revert();
  }, [currentView]);

  function changeMode(next) {
    if (busyRef.current) return;
    setInputMode(next); setError(''); setMetadata(null); setBatchResults([]); setFootnoteResult(''); setDafpusResult(''); setCopiedId(null);
  }
  function enterDemo() { setDemo(true); setDoiInput(DEMO_DOI); setCurrentView('tool'); window.scrollTo(0, 0); }
  async function handleLoginAndEnter() {
    if (busyRef.current) return;
    if (account.user) { setDemo(false); setCurrentView('tool'); window.scrollTo(0, 0); return; }
    busyRef.current = true; setLoading(true);
    try { const signedIn = await account.login(); if (signedIn) { setDemo(false); setCurrentView('tool'); window.scrollTo(0, 0); } }
    catch (error) { showNotificationMsg(error.message, 'error'); }
    finally { busyRef.current = false; setLoading(false); }
  }
  async function chooseCreditPackage(packageId) {
    if (busyRef.current) return;
    setPreferredPackageId(packageId);
    if (account.user) { setDemo(false); setShowTopupModal(true); return; }
    busyRef.current = true; setLoading(true);
    try {
      const signedIn = await account.login();
      if (signedIn) { setDemo(false); setCurrentView('tool'); setShowTopupModal(true); window.scrollTo(0, 0); }
    } catch (error) { showNotificationMsg(error.message, 'error'); }
    finally { busyRef.current = false; setLoading(false); }
  }
  async function handleLogout() {
    if (busyRef.current) return;
    try { if (!demo) await account.logout(); setDemo(false); setIsSidebarOpen(false); setShowTopupModal(false); setCurrentView('landing'); window.scrollTo(0, 0); }
    catch { showNotificationMsg('Belum berhasil keluar. Coba lagi sebentar.', 'error'); }
  }
  async function makeCitation(mode, input) {
    const chosenCity = inputMode === 'batch' ? kotaInput : city.manualCity;
    if (demo) {
      let meta = DEMO_METADATA;
      if (mode === 'manual') meta = { ...input, authors: input.author.split(';').map((name) => name.trim()).filter(Boolean).map(parseAuthor), source: 'Input manual · Demo', warnings: [] };
      else if (!String(input).toLowerCase().includes('nature14539')) throw new Error(`Gunakan DOI contoh ${DEMO_DOI} di demo, atau masuk untuk memakai sumbermu sendiri.`);
      const item = { id: crypto.randomUUID(), type: mode.toUpperCase(), title: meta.title, input: typeof input === 'string' ? input : meta.title, metadata: meta, results: buildCitations(meta, chosenCity), cityUsed: chosenCity || meta.city || '', cityManual: !!chosenCity, timestamp: Date.now() };
      setDemoHistory((previous) => { const next = [item, ...previous].slice(0, 30); writeStorage('flashcite:demo-history', next); return next; });
      return item;
    }
    const fingerprint = JSON.stringify({ mode, input, city: chosenCity });
    const storageKey = `flashcite:citation-requests:${user.uid}`;
    const restored = readStorage(storageKey, {});
    const key = requestKeys.current[fingerprint] || restored[fingerprint] || crypto.randomUUID();
    requestKeys.current[fingerprint] = key; writeStorage(storageKey, requestKeys.current);
    const item = await api('citations', { user: account.user, body: { mode, input, city: chosenCity }, key });
    delete requestKeys.current[fingerprint]; writeStorage(storageKey, requestKeys.current);
    return item;
  }
  function checkReady() {
    if (!canGenerate) { showNotificationMsg('Tunggu sampai akun dan kredit selesai tersambung.', 'error'); return false; }
    if (!demo && userData.credits < 1) { setShowTopupModal(true); return false; }
    return true;
  }
  async function generateSingle(mode, input) {
    if (busyRef.current || !checkReady()) return;
    setMetadata(null); setError('');
    if (mode === 'doi' && !isDOI(input)) { setError('Format DOI belum valid. Contoh: 10.1038/nature14539.'); return; }
    if (mode === 'url') { try { if (new URL(input).protocol !== 'https:') throw new Error(); } catch { setError('Masukkan tautan HTTPS lengkap ke halaman artikel.'); return; } }
    if (mode === 'manual' && (!input.author.trim() || !input.title.trim() || !/^(1[5-9]\d{2}|20\d{2})$/.test(input.year))) { setError('Nama penulis, judul, dan tahun empat digit wajib diisi.'); return; }
    busyRef.current = true; setLoading(true); setError(''); setMetadata(null);
    try {
      const item = await makeCitation(mode, input); const meta = citationForView(item);
      city.accept(item.metadata || {});
      setMetadata(meta); setFootnoteResult(meta.results.footnote); setDafpusResult(meta.results.bibliography);
    } catch (error) { setError(error.message); if (error.code === 'INSUFFICIENT_CREDITS') setShowTopupModal(true); }
    finally { busyRef.current = false; setLoading(false); }
  }
  const fetchDOI = () => generateSingle('doi', doiInput.trim());
  const fetchURL = () => generateSingle('url', urlInput.trim());
  const handleGenerateManual = () => generateSingle('manual', { author: mAuthor, title: mTitle, journal: mJournal, year: mYear.trim(), month: mMonth, volume: mVolume, issue: mIssue, page: mPage, publisher: mPublisher, doi: mDOI.trim() });
  async function handleBatchGenerate() {
    if (busyRef.current || !checkReady()) return;
    const lines = [...new Set(batchInput.split('\n').map((line) => line.trim()).filter(Boolean))];
    if (!lines.length || lines.length > settings.maxBatch) { setError(`Masukkan 1–${settings.maxBatch} sumber unik, satu sumber per baris.`); return; }
    busyRef.current = true; setLoading(true); setError(''); setMetadata(null); setBatchResults([]);
    const completed = [];
    try {
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        try { completed.push({ status: 'success', line, meta: citationForView(await makeCitation(isDOI(line) ? 'doi' : 'url', line)) }); }
        catch (error) {
          completed.push({ status: 'error', line, error: error.message });
          if (error.code === 'INSUFFICIENT_CREDITS') {
            for (const remaining of lines.slice(index + 1)) completed.push({ status: 'error', line: remaining, error: 'Belum diproses karena kredit habis.' });
            setShowTopupModal(true); break;
          }
        }
        setBatchResults([...completed]);
      }
      setBatchResults(completed);
    } finally { busyRef.current = false; setLoading(false); }
  }
  async function handleCopy(html, id) {
    if (!html) return;
    try {
      const plain = plainCitation(html);
      if (navigator.clipboard?.write && window.ClipboardItem) {
        try { await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([plain], { type: 'text/plain' }), 'text/html': new Blob([safeCitationHTML(html)], { type: 'text/html' }) })]); }
        catch { await navigator.clipboard.writeText(plain); }
      } else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(plain);
      else {
        const field = document.createElement('textarea'); field.value = plain; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.appendChild(field); field.select(); const success = document.execCommand('copy'); field.remove(); if (!success) throw new Error();
      }
      clearTimeout(copyTimer.current); setCopiedId(id); copyTimer.current = setTimeout(() => setCopiedId(null), 2200);
    } catch { showNotificationMsg('Teks belum tersalin. Silakan pilih teks dan salin secara manual.', 'error'); }
  }
  const batchSuccesses = batchResults.filter((item) => item.status === 'success');
  const batchErrors = batchResults.filter((item) => item.status === 'error');
  const sortedBatchDafpus = [...batchSuccesses].sort((a, b) => a.meta.authorDafpus.localeCompare(b.meta.authorDafpus, 'id'));

  return (
    <div className="app-wrapper pattern-bg" ref={appRef}>
      <a className="skip-link" href={currentView === "tool" ? "#workspace-main" : "#hero"}>Lewati ke konten</a>
            {/* MODERN NOTIFICATION TOAST */}
      {notification.show && (
        <div role={notification.type === "error" ? "alert" : "status"} className={`notification-toast animate-slide-up-fade ${notification.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {notification.type === 'error' ? <WarningIcon /> : <CheckIcon />}
          <span>{notification.message}</span>
        </div>
      )}

      {showTopupModal && user && <PaymentModal key={demo ? 'demo' : user.uid} user={demo ? null : user} demo={demo} settings={settings}
        notify={showNotificationMsg} initialPackageId={preferredPackageId} pricingReady={pricingReady} onPricingChange={refreshSettings} onClose={() => setShowTopupModal(false)}
        onLogin={() => { setShowTopupModal(false); handleLoginAndEnter(); }} />}

      {/* --- LANDING PAGE NAVBAR --- */}
      {currentView === "landing" && (
        <div className="navbar-wrapper" aria-label="Navigasi utama">
          <nav className="navbar">
            <div className="nav-container">
              <div className="nav-logo" onClick={() => { setCurrentView("landing"); window.scrollTo(0, 0); }}>
                <div className="logo-icon-wrap"><VideoLogo /></div>
              </div>
              <div className="nav-actions">
                {!user ? (
                  <button onClick={handleLoginAndEnter} className="btn-primary btn-sm" disabled={loading}>
                    {loading ? "Menghubungkan..." : "Buka Ruang Kerja"}
                  </button>
                ) : (
                  <button onClick={handleLoginAndEnter} className="btn-primary btn-sm">Buka Ruang Kerja</button>
                )}
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* --- VIEW 1: LANDING PAGE --- */}
      {currentView === "landing" && (
        <main className="main-content z-10 relative content-padding-top" ref={landingRef}>
          <div className="ambient-background">
             <div className="ambient-blob blob-1"></div>
             <div className="ambient-blob blob-2"></div>
             <div className="ambient-blob blob-3"></div>
          </div>

          <section id="hero" className="hero-section relative">
            <div className="floating-element float-1 hidden-mobile" style={{position: 'absolute', top: '10%', left: '8%', zIndex: 0}}><FloatBook /></div>
            <div className="floating-element float-2 hidden-mobile" style={{position: 'absolute', top: '5%', right: '10%', zIndex: 0}}><FloatToga /></div>
            <div className="floating-element float-3 hidden-mobile" style={{position: 'absolute', top: '40%', left: '12%', zIndex: 0}}><FloatFlash /></div>

            <div className="container text-center relative z-10">
              <div className="hero-badge badge-pill mx-auto mb-6 flex items-center gap-2 w-max">
                <span className="pulse-dot"></span> Tools Sitasi Jurnal Otomatis
              </div>
              
              <h1 className="hero-title" style={{ perspective: "1000px" }}>
                <div className="hero-title-line">
                  <span className="title-word inline-block">Ekstrak</span> <span className="title-word inline-block">Referensi</span> <span className="title-word inline-block">Jurnal</span>
                </div>
                <div className="hero-title-line">
                  <span className="text-gradient title-word inline-block">Dalam</span> <span className="text-gradient title-word inline-block">Hitungan</span> <span className="text-gradient title-word inline-block">Detik.</span>
                </div>
              </h1>
              
              <p className="hero-subtitle mx-auto mt-6">
                Berhenti menyusun daftar pustaka secara manual. Sistem membaca metadata
                dari DOI dan halaman artikel, lalu menyusunnya menjadi sitasi dan daftar pustaka.
              </p>
              
              <div className="hero-cta mt-10">
                <button onClick={handleLoginAndEnter} className="btn-primary btn-lg shadow-glow" disabled={loading}>
                  {loading ? "Memuat Workspace..." : "Mulai Gratis Sekarang"}
                </button>
                <button className="btn-secondary demo-entry mt-4" onClick={enterDemo}>Coba Demo Tanpa Akun</button>
                <div className="hero-trusted mt-6 flex items-center justify-center gap-3">
                  <div className="avatar-group flex"><div className="avatar"></div><div className="avatar"></div><div className="avatar"></div></div>
                  <p className="text-xs text-muted font-medium m-0">Dipercaya oleh Mahasiswa & Akademisi</p>
                </div>
              </div>
            </div>
          </section>

          <section className="preview-section mt-12 pb-24 relative z-20">
            <div className="container preview-card-anim">
               <AnimatedWorkspaceMock />
            </div>
          </section>

          <section className="steps-section py-16 bg-surface-alt border-y border-color relative z-10">
             <div className="container text-center">
                <h2 className="section-title mb-4">Tiga Langkah Mudah</h2>
                <p className="text-muted max-w-md mx-auto mb-12">Otomatisasi referensi Anda dalam hitungan detik. Tanpa format manual yang membingungkan.</p>
                <div className="steps-grid">
                   <div className="step-card-anim step-card"><div className="step-icon">1</div><h4 className="font-bold text-lg mb-2">Salin Tautan</h4><p className="text-sm text-muted">Salin URL jurnal dari browser atau nomor DOI artikel yang dituju.</p></div>
                   <div className="step-card-anim step-connector hidden-mobile"></div>
                   <div className="step-card-anim step-card"><div className="step-icon">2</div><h4 className="font-bold text-lg mb-2">Sistem Memproses</h4><p className="text-sm text-muted">Mesin ekstraksi kami akan memproses PDF/Link dan menarik data penting.</p></div>
                   <div className="step-card-anim step-connector hidden-mobile"></div>
                   <div className="step-card-anim step-card"><div className="step-icon">3</div><h4 className="font-bold text-lg mb-2">Selesai</h4><p className="text-sm text-muted">Dapatkan hasil sitasi sempurna yang siap disalin ke karya ilmiah Anda.</p></div>
                </div>
             </div>
          </section>

          <section id="features" className="features-section pt-20 pb-16 relative z-10">
            <div className="container text-center">
              <h2 className="section-title mb-12">Dibangun untuk Kecepatan & Presisi</h2>
              <div className="grid-3">
                <div className="feature-card-anim feature-card glass-panel group-hover-effect bg-white">
                  <div className="feature-icon-box text-primary"><ShieldIcon /></div>
                  <h3 className="text-lg font-bold">Metadata dari Sumber</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">Baca metadata artikel dari DOI atau halaman penerbit. Jika akses dibatasi, gunakan DOI atau input manual.</p>
                </div>
                <div className="feature-card-anim feature-card glass-panel group-hover-effect bg-white">
                  <div className="feature-icon-box text-primary"><SparklesIcon /></div>
                  <h3 className="text-lg font-bold">Smart Metadata Recovery</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">Jika struktur PDF tidak standar, sistem akan melacak dan mengoreksi metadata dari database jurnal global.</p>
                </div>
                <div className="feature-card-anim feature-card glass-panel group-hover-effect bg-white">
                  <div className="feature-icon-box text-primary"><ZapIcon /></div>
                  <h3 className="text-lg font-bold">Pemrosesan Batch</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">Punya banyak referensi? Tempelkan semua URL sekaligus dan dapatkan daftar pustaka urut abjad seketika.</p>
                </div>
              </div>
            </div>
          </section>

          <PricingSection settings={settings} ready={pricingReady} error={pricingError} onRefresh={refreshSettings} onChoose={chooseCreditPackage} />

          <section className="site-explainer" aria-labelledby="faq-title"><div className="container"><div className="site-explainer-inner">
            <h2 id="faq-title">Kenali cara kerja Flash Sitasi</h2>
            <p className="site-explainer-intro">Dari DOI ke footnote dan daftar pustaka, dengan metadata yang tetap bisa Anda periksa. Berikut hal yang sering ditanyakan sebelum mulai menulis.</p>
            {FAQS.map(({ question, answer }) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
            <p className="site-explainer-credit">Flash Sitasi dibuat oleh <a href={CREATOR.url} rel="author noopener noreferrer" target="_blank">Ricky Maulana</a> untuk membantu proses penulisan referensi akademik.</p>
          </div></div></section>
          <SiteFooter />
        </main>
      )}

      {/* --- VIEW 2: WORKSPACE (DASHBOARD) --- */}
      {currentView === "tool" && user && (
        <div className="dashboard-layout animate-fade-in">
           <div className="mobile-dashboard-header">
              <button ref={menuButtonRef} onClick={() => setIsSidebarOpen(true)} className="mobile-menu-btn" aria-label="Buka menu navigasi" aria-controls="workspace-sidebar" aria-expanded={isSidebarOpen}><MenuIcon /></button>
              <div className="logo-icon-wrap" style={{ height: '24px' }}><VideoLogo /></div>
              <div style={{ width: '24px' }}></div>
           </div>

           {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

           <aside ref={sidebarRef} id="workspace-sidebar" aria-label="Navigasi ruang kerja" inert={isMobile && !isSidebarOpen ? true : undefined} role={isMobile && isSidebarOpen ? "dialog" : undefined} aria-modal={isMobile && isSidebarOpen ? "true" : undefined} className={`dashboard-sidebar ${isSidebarOpen ? 'open' : ''}`}>
              <div className="sidebar-header">
                 <div className="logo-icon-wrap"><VideoLogo /></div>
                 <button className="mobile-close" aria-label="Tutup menu navigasi" onClick={() => setIsSidebarOpen(false)}><CloseIcon /></button>
              </div>
              
              <nav className="sidebar-nav" aria-label="Jenis sumber referensi">
                 <button className={`nav-item ${inputMode === "doi" ? "active" : ""}`} onClick={() => {changeMode("doi"); setIsSidebarOpen(false);}}>
                    <DoiIcon /> Nomor DOI
                 </button>
                 <button className={`nav-item ${inputMode === "url" ? "active" : ""}`} onClick={() => {changeMode("url"); setIsSidebarOpen(false);}}>
                    <LinkIcon /> Link Web/PDF
                 </button>
                 <button className={`nav-item ${inputMode === "batch" ? "active" : ""}`} onClick={() => {changeMode("batch"); setIsSidebarOpen(false);}}>
                    <BatchIcon /> Mode Batch
                 </button>
                 <button className={`nav-item ${inputMode === "manual" ? "active" : ""}`} onClick={() => {changeMode("manual"); setIsSidebarOpen(false);}}>
                    <ManualIcon /> Manual
                 </button>
                 <button className={`nav-item ${inputMode === "history" ? "active" : ""}`} onClick={() => {changeMode("history"); setIsSidebarOpen(false);}}>
                    <HistoryIcon /> Riwayat
                 </button>
                 {isAdmin && <button className={`nav-item ${inputMode === 'admin' ? 'active' : ''}`} onClick={() => { changeMode('admin'); setIsSidebarOpen(false); }}><span className="sidebar-admin-icon"><ShieldIcon /></span> Panel Admin</button>}
              </nav>

              <div className="sidebar-footer">
                 {!demo && <div className="sidebar-account"><strong>{user?.displayName || userData.name || 'Pengguna'}</strong><span>{user?.email}</span>{isAdmin && <small>ADMIN</small>}</div>}
                 <div className="credit-box">
                    <p className="credit-label">{demo ? "Kredit Contoh (Demo)" : "Sisa Kredit"}</p>
                    <div className="credit-amount"><CoinIcon /> <span>{userData.credits || 0}</span></div>
                    <button onClick={() => { setIsSidebarOpen(false); setPreferredPackageId(''); setShowTopupModal(true); }} className="btn-topup">Top Up Token</button>
                 </div>
                 <button onClick={handleLogout} className="btn-logout">
                    <LogoutIcon /> Keluar
                 </button>
                 <nav className="workspace-info-links" aria-label="Kebijakan layanan"><a href="/kebijakan-privasi" target="_blank" rel="noopener noreferrer">Privasi</a><a href="/syarat-ketentuan" target="_blank" rel="noopener noreferrer">Ketentuan</a><a href="/tentang" target="_blank" rel="noopener noreferrer">Ricky Maulana</a></nav>
              </div>
           </aside>

           {/* Main Workspace Content */}
           <main id="workspace-main" className="dashboard-main" inert={isMobile && isSidebarOpen ? true : undefined}>
              <div className={`dashboard-container ${inputMode === 'admin' ? 'admin-workspace' : ''}`}>
                <div className="tool-header mb-8 text-center sm:text-left">
                  <h2 className="section-title m-0 tracking-tight">{inputMode === 'admin' ? 'Panel Admin' : 'Ruang Kerja'}</h2>
                  <p className="text-muted text-sm mt-2 font-medium">{demo ? "Mode demo — gunakan DOI contoh atau input manual." : account.ready ? "Sistem ekstraksi metadata aktif. Masukkan referensi Anda." : "Menghubungkan akun dan saldo kredit…"}</p>
                  {account.error && !demo && <div className="account-sync-error" role="alert"><span>{account.error}</span><button className="btn-secondary" onClick={account.retry}>Coba lagi</button></div>}
                </div>

                {settings.maintenance && !demo && <p className="service-notice" role="status">{settings.maintenanceMessage}{isAdmin && ' Akses admin tetap aktif.'}</p>}
                {inputMode === 'admin' ? isAdmin ? <Suspense fallback={<p className="service-notice">Memuat panel admin…</p>}><AdminPanel user={account.user} notify={showNotificationMsg} onSettingsChange={refreshSettings} /></Suspense> : <p className="service-notice">Panel ini hanya tersedia untuk admin aktif.</p> : <>
                <div className="card glass-panel shadow-premium mb-8 relative z-20 border-0 bg-white rounded-xl">
                  <div className="card-body p-6 sm:p-8">
                    <div className="citation-format-row flex items-center justify-between mb-8 pb-4 border-b border-color flex-col sm:flex-row gap-4 sm:gap-0">
                       <div className="mb-2 sm:mb-0 text-center sm:text-left w-full sm:w-auto">
                         <h3 className="text-base font-bold text-main m-0">Format Sitasi</h3>
                         <p className="text-xs text-muted mt-1 m-0">Pilih gaya output yang dihasilkan</p>
                       </div>
                       <div className="style-toggle w-full sm:w-auto flex justify-center">
                          <button className={`style-toggle-btn flex-1 sm:flex-none justify-center ${citationStyle === "footnote" ? "active" : ""}`} onClick={() => setCitationStyle("footnote")}>📝 Footnote</button>
                          <button className={`style-toggle-btn flex-1 sm:flex-none justify-center ${citationStyle === "apa7" ? "active" : ""}`} onClick={() => setCitationStyle("apa7")}>📑 APA 7</button>
                       </div>
                    </div>

                    {inputMode === "doi" && (
                      <div className="animate-fade-in">
                        <div className="form-group mb-5 relative">
                          <label className="input-label" htmlFor="reference-field-1">Nomor DOI Referensi</label>
                          <input id="reference-field-1" type="text" className="input-field-modern" value={doiInput} onChange={(e) => setDoiInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchDOI()} placeholder="Contoh: 10.1038/s41586..." />
                        </div>
                        {citationStyle === "footnote" && (
                          <CityField state={city} />
                        )}
                        <button className="btn-primary w-full py-3.5 shadow-glow" onClick={fetchDOI} disabled={loading || !doiInput.trim() || !canGenerate}>
                          {loading ? "Mengeksekusi Proses..." : "Generate Sitasi (1 Kredit)"}
                        </button>
                      </div>
                    )}

                    {inputMode === "url" && (
                      <div className="animate-fade-in">
                        <div className="form-group mb-5 relative">
                          <label className="input-label" htmlFor="reference-field-3">Tautan Artikel / PDF</label>
                          <input id="reference-field-3" type="text" className="input-field-modern" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchURL()} placeholder="Paste link Academia, ResearchGate, OJS, dll" />
                        </div>
                        {citationStyle === "footnote" && (
                          <CityField state={city} />
                        )}
                        <button className="btn-primary w-full py-3.5 shadow-glow" onClick={fetchURL} disabled={loading || !urlInput.trim() || !canGenerate}>
                          {loading ? "Menganalisis Tautan..." : "Generate Sitasi (1 Kredit)"}
                        </button>
                      </div>
                    )}

                    {inputMode === "manual" && (
                      <div className="animate-fade-in">
                        <div className="classic-manual-grid grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="manual-span form-group"><label className="input-label" htmlFor="reference-field-5">Nama Penulis Lengkap *</label><input id="reference-field-5" type="text" className="input-field-modern" value={mAuthor} onChange={(e) => setMAuthor(e.target.value)} placeholder="John Doe; Jane Smith (pisahkan dengan ;)" /></div>
                          <div className="manual-span form-group"><label className="input-label" htmlFor="reference-field-6">Judul Artikel *</label><input id="reference-field-6" type="text" className="input-field-modern" value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="Masukkan judul artikel" /></div>
                          <div className="form-group"><label className="input-label" htmlFor="reference-field-7">Nama Jurnal</label><input id="reference-field-7" type="text" className="input-field-modern" value={mJournal} onChange={(e) => setMJournal(e.target.value)} placeholder="Jurnal Internasional" /></div>
                          <div className="form-group"><label className="input-label" htmlFor="reference-field-8">Tahun Terbit *</label><input id="reference-field-8" type="text" className="input-field-modern" value={mYear} onChange={(e) => setMYear(e.target.value)} placeholder="2024" /></div>
                          <div className="form-group"><label className="input-label" htmlFor="manual-month">Bulan Terbit <span className="text-muted font-normal">(Opsional)</span></label><select id="manual-month" className="input-field-modern" value={mMonth} onChange={(e) => setMMonth(e.target.value)}><option value="">Tidak diketahui</option>{MONTHS.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}</select></div>
                          <div className="form-group"><label className="input-label" htmlFor="reference-field-9">Volume</label><input id="reference-field-9" type="text" className="input-field-modern" value={mVolume} onChange={(e) => setMVolume(e.target.value)} placeholder="Misal: 5" /></div>
                          <div className="form-group"><label className="input-label" htmlFor="reference-field-10">Isu / Nomor</label><input id="reference-field-10" type="text" className="input-field-modern" value={mIssue} onChange={(e) => setMIssue(e.target.value)} placeholder="Misal: 2" /></div>
                          <div className="form-group"><label className="input-label" htmlFor="reference-field-11">Halaman</label><input id="reference-field-11" type="text" className="input-field-modern" value={mPage} onChange={(e) => setMPage(e.target.value)} placeholder="Misal: 10-25" /></div>
                          <div className="form-group"><label className="input-label" htmlFor="manual-publisher">Nama Penerbit</label><input id="manual-publisher" className="input-field-modern" value={mPublisher} onChange={(e) => setMPublisher(e.target.value)} placeholder="Penerbit jurnal atau buku" /></div>
                          <div className="manual-span form-group"><label className="input-label" htmlFor="manual-doi">DOI <span className="text-muted font-normal">(Opsional, untuk mencari kota terbit)</span></label><input id="manual-doi" className="input-field-modern" value={mDOI} onChange={(e) => setMDOI(e.target.value)} placeholder="10.1234/..." /></div>
                          {citationStyle === 'footnote' && <div className="manual-span"><CityField state={city} /></div>}
                        </div>
                        <button className="btn-primary w-full mt-8 py-3.5 shadow-glow" onClick={handleGenerateManual} disabled={loading || !canGenerate}>Generate Manual (1 Kredit)</button>
                      </div>
                    )}

                    {inputMode === "batch" && (
                      <div className="animate-fade-in">
                        <div className="form-group mb-5"><label className="input-label" htmlFor="reference-field-13">Daftar Link / DOI</label><textarea id="reference-field-13" className="input-field-modern textarea-field" value={batchInput} onChange={(e) => setBatchInput(e.target.value)} placeholder={`Paste banyak URL atau DOI di sini\n1 Baris = 1 Link/DOI\nMaksimal: ${settings.maxBatch} sumber per proses`} /></div>
                        {citationStyle === "footnote" && (
                          <div className="form-group mb-8 animate-fade-in"><label className="input-label" htmlFor="reference-field-14">Kota Terbit Global <span className="text-muted font-normal">(Opsional)</span></label><input id="reference-field-14" type="text" className="input-field-modern" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} maxLength={100} placeholder="Kosongkan untuk kota otomatis per referensi" /><p className="city-note">Bila dikosongkan, kota dicari untuk masing-masing referensi. Isi hanya jika semua referensi berasal dari kota yang sama.</p></div>
                        )}
                        <button className="btn-primary w-full py-3.5 shadow-glow" onClick={handleBatchGenerate} disabled={loading || !batchInput.trim() || !canGenerate}>
                          {loading ? "Memproses Batch..." : "Generate Semua (1 Kredit/Sukses)"}
                        </button>
                      </div>
                    )}

                    {/* TAB HISTORY */}
                    {inputMode === "history" && (
                      <div className="animate-fade-in history-container custom-scrollbar pr-3">
                        {history.length === 0 ? (
                          <div className="text-center text-muted p-10 flex flex-col items-center bg-slate-50 rounded-xl border border-dashed border-color">
                            <span className="text-4xl mb-3 opacity-30">🗂️</span>
                            <span className="font-semibold text-sm">Ruang riwayat Anda masih kosong.</span>
                          </div>
                        ) : (
                          history.map((item) => {
                            const inTextToCopy = citationStyle === "footnote" ? item.footnote : (item.apaInText || "Data APA 7 belum tersedia.");
                            const refToCopy = citationStyle === "footnote" ? item.dafpus : (item.apaRef || "Data APA 7 belum tersedia.");
                            return (
                              <div key={item.id} className="history-item mb-5 pb-5 border-b border-color last-no-border">
                                <div className="flex justify-between items-center mb-3">
                                  <span className="badge-pill text-xs px-2 py-0.5">{item.type}</span>
                                  <span className="text-xs font-mono text-muted">{new Date(item.timestamp).toLocaleString("id-ID")}</span>
                                </div>
                                <h4 className="m-0 mb-3 font-semibold text-sm leading-snug truncate-2 text-main">{item.title}</h4>
                                <div className="flex gap-2 mt-4 flex-col sm:flex-row">
                                  <button className="btn-secondary btn-sm flex-1 justify-center w-full" onClick={() => handleCopy(inTextToCopy, `hist-in-${item.id}`)}>
                                    {copiedId === `hist-in-${item.id}` ? <><CheckIcon /> Disalin</> : <><CopyIcon /> {citationStyle === 'footnote' ? 'Footnote' : 'In-Text'}</>}
                                  </button>
                                  <button className="btn-secondary btn-sm flex-1 justify-center w-full" onClick={() => handleCopy(refToCopy, `hist-dp-${item.id}`)}>
                                    {copiedId === `hist-dp-${item.id}` ? <><CheckIcon /> Disalin</> : <><CopyIcon /> {citationStyle === 'footnote' ? 'Dafpus' : 'APA 7'}</>}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    <GenerationError message={error} onDismiss={() => setError('')} onRetry={inputMode === 'batch' ? handleBatchGenerate : inputMode === 'manual' ? handleGenerateManual : inputMode === 'url' ? fetchURL : fetchDOI} />
                  </div>
                </div>

                {loading && inputMode !== "batch" && <SkeletonLoader />}
                {loading && inputMode === "batch" && (
                  <><SkeletonLoader /><div style={{ opacity: 0.5, transform: "scale(0.98)" }}><SkeletonLoader /></div></>
                )}

                {/* RESULTS AREA: SINGLE */}
                {!loading && metadata && inputMode !== "batch" && inputMode !== "history" && (
                  <div className="card glass-panel mt-8 animate-slide-up border-t-success relative overflow-hidden bg-white border-0 shadow-premium">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><CheckIcon /></div>
                    <div className="card-body p-6 sm:p-8">
                      {citationStyle === 'footnote' && <CitySource metadata={metadata} />}
                      <div className="result-block bg-slate-50 border-color rounded-lg mb-8">
                        <div className="result-header border-b border-color">
                          <span className="text-slate-500 font-extrabold text-xs tracking-wide">{citationStyle === 'footnote' ? 'CATATAN KAKI (FOOTNOTE)' : 'SITASI DALAM TEKS (IN-TEXT)'}</span>
                          <button className="btn-copy-modern" onClick={() => handleCopy(citationStyle === 'footnote' ? footnoteResult : buildApaInText(metadata), "single-in")}>
                            {copiedId === "single-in" ? <><span className="text-success"><CheckIcon /></span> Disalin</> : <><CopyIcon /> Salin</>}
                          </button>
                        </div>
                        <RichCitation className="result-html text-slate-800 font-medium" html={citationStyle === 'footnote' ? footnoteResult : buildApaInText(metadata)} />
                      </div>
                      <div className="result-block bg-slate-50 border-color rounded-lg">
                        <div className="result-header border-b border-color">
                          <span className="text-slate-500 font-extrabold text-xs tracking-wide">{citationStyle === 'footnote' ? 'DAFTAR PUSTAKA' : 'DAFTAR PUSTAKA (APA 7)'}</span>
                          <button className="btn-copy-modern" onClick={() => handleCopy(citationStyle === 'footnote' ? dafpusResult : buildApaReference(metadata), "single-dp")}>
                            {copiedId === "single-dp" ? <><span className="text-success"><CheckIcon /></span> Disalin</> : <><CopyIcon /> Salin</>}
                          </button>
                        </div>
                        <RichCitation className="result-html text-slate-800 font-medium" html={citationStyle === 'footnote' ? dafpusResult : buildApaReference(metadata)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* RESULTS AREA: BATCH */}
                {!loading && batchResults.length > 0 && inputMode === "batch" && (
                  <div className="card glass-panel mt-8 animate-slide-up border-t-success bg-white border-0 shadow-premium">
                    <div className="card-body p-6 sm:p-8">
                      {batchSuccesses.length > 0 && (
                        <>
                          <div className="flex items-center justify-between mb-4 border-b border-color pb-3">
                            <h3 className="text-base font-bold m-0 text-main">{citationStyle === 'footnote' ? `Catatan Kaki (${batchSuccesses.length})` : `Sitasi Dalam Teks (${batchSuccesses.length})`}</h3>
                          </div>
                          {batchSuccesses.map((r, index) => {
                            const content = citationStyle === 'footnote' ? buildFootnote(r.meta, kotaInput) : buildApaInText(r.meta);
                            const copyId = `batch-in-${index}`;
                            return (
                              <div className="result-block mb-5 bg-slate-50 rounded-lg overflow-hidden border border-color" key={copyId}>
                                <div className="result-header bg-slate-100 border-b border-color">
                                  <span className="truncate font-mono text-xs text-slate-600">{r.line}</span>
                                  <button className="btn-copy-modern btn-sm-padding" onClick={() => handleCopy(content, copyId)}>
                                    {copiedId === copyId ? <span className="text-success"><CheckIcon /></span> : <CopyIcon />}
                                  </button>
                                </div>
                                {citationStyle === 'footnote' && <div className="batch-city-source"><CitySource metadata={r.meta} /></div>}
                                <RichCitation className="result-html text-sm font-medium text-slate-800" html={content} />
                              </div>
                            );
                          })}
                          
                          <div className="flex items-center justify-between mt-10 mb-4 border-b border-color pb-3">
                            <h3 className="text-base font-bold m-0 text-main">{citationStyle === 'footnote' ? `Daftar Pustaka A-Z (${sortedBatchDafpus.length})` : `Daftar Pustaka APA 7 (${sortedBatchDafpus.length})`}</h3>
                          </div>
                          {sortedBatchDafpus.map((r, index) => {
                            const content = citationStyle === 'footnote' ? buildDafpus(r.meta, kotaInput) : buildApaReference(r.meta);
                            const copyId = `batch-dp-${index}`;
                            return (
                              <div className="result-block mb-5 bg-slate-50 rounded-lg overflow-hidden border border-color" key={copyId}>
                                <div className="result-header bg-slate-100 border-b border-color">
                                  <span className="truncate font-mono text-xs text-slate-600">{r.line}</span>
                                  <button className="btn-copy-modern btn-sm-padding" onClick={() => handleCopy(content, copyId)}>
                                    {copiedId === copyId ? <span className="text-success"><CheckIcon /></span> : <CopyIcon />}
                                  </button>
                                </div>
                                {citationStyle === 'footnote' && <div className="batch-city-source"><CitySource metadata={r.meta} /></div>}
                                <RichCitation className="result-html text-sm font-medium text-slate-800" html={content} />
                              </div>
                            );
                          })}
                        </>
                      )}
                      {batchErrors.length > 0 && (
                        <div className="error-alert mt-8 p-5 bg-error-subtle border-error border rounded-lg">
                          <strong className="flex items-center gap-2 mb-3 text-error"><WarningIcon/> Gagal (Kredit Tidak Dipotong):</strong>
                          <ul className="m-0 pl-5 text-error text-sm space-y-2 opacity-90">
                            {batchErrors.map((err, i) => (
                              <li key={i} className="break-all"><span className="font-mono text-xs font-semibold mr-2">{err.line}</span><br className="sm:hidden" />{err.error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </>}
              </div>
            </main>
        </div>
      )}

    </div>
  );
}
