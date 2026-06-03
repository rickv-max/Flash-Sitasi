import React, { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initializeApp } from "firebase/app";
import { increment } from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
} from "firebase/firestore";

// Register GSAP Plugin
gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// ⚠️ ENVIRONMENT VARIABLES CONFIGURATION (VITE READY)
// ============================================================================
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const BAYAR_GG_API_KEY = env.VITE_BAYAR_GG_API_KEY;

// Initialize Firebase
let app, auth, db;
if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.warn("Konfigurasi Firebase gagal dimuat:", error);
  }
} else {
  console.warn("API Key Firebase belum diset di .env");
}

// ============================================================================
// ANIMATED MOCK WORKSPACE COMPONENT (HERO SHOWCASE)
// ============================================================================
const AnimatedWorkspaceMock = () => {
  const [step, setStep] = useState(0);
  const [typedText, setTypedText] = useState("");
  const targetText = "10.1038/s41586-020-2649-2";

  useEffect(() => {
    let timeouts = [];
    const runSequence = () => {
      setStep(0);
      setTypedText("");
      
      timeouts.push(setTimeout(() => setStep(1), 1000));
      timeouts.push(setTimeout(() => setStep(2), 1600));
      timeouts.push(setTimeout(() => {
        let currentText = "";
        let i = 0;
        const typeInterval = setInterval(() => {
          currentText += targetText[i];
          setTypedText(currentText);
          i++;
          if (i === targetText.length) {
            clearInterval(typeInterval);
            timeouts.push(setTimeout(() => setStep(3), 500)); 
            timeouts.push(setTimeout(() => setStep(4), 1200));
            timeouts.push(setTimeout(() => setStep(5), 1400));
            timeouts.push(setTimeout(() => setStep(6), 3500));
            timeouts.push(setTimeout(() => setStep(7), 4500));
            timeouts.push(setTimeout(() => setStep(8), 5100));
            timeouts.push(setTimeout(() => runSequence(), 8000));
          }
        }, 40);
      }, 1900));
    };

    runSequence();
    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <div className="mock-workspace bg-white border-2 border-slate-900 rounded-3xl mx-auto max-w-3xl overflow-hidden relative z-20 app-shadow">
      <div className="preview-header bg-slate-50 border-b-2 border-slate-900 px-5 py-4 flex items-center gap-3">
         <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400 border border-slate-900"></span>
            <span className="w-3 h-3 rounded-full bg-amber-400 border border-slate-900"></span>
            <span className="w-3 h-3 rounded-full bg-green-400 border border-slate-900"></span>
         </div>
         <span className="text-xs font-bold text-slate-500 font-mono ml-2">demo_ruang_kerja.app</span>
      </div>

      <div className="p-6 sm:p-8 relative z-10 bg-white">
        <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 m-0">Format Sitasi</h3>
            <p className="text-xs font-semibold text-slate-500 mt-1 m-0 hidden sm:block">Pilih gaya output</p>
          </div>
          <div className="style-toggle pointer-events-none">
            <button className="style-toggle-btn active">📝 Footnote</button>
            <button className="style-toggle-btn">📑 APA 7</button>
          </div>
        </div>

        <div className="form-group mb-5">
          <label className="input-label text-xs text-slate-900 font-extrabold mb-2 block uppercase tracking-wider">Nomor DOI Referensi</label>
          <div className={`mock-input-wrap ${step >= 2 && step < 5 ? 'focused' : ''}`}>
            <span className="mock-input-text text-slate-900 font-bold">{typedText}</span>
            {step >= 2 && step < 4 && <span className="mock-caret"></span>}
            {!typedText && step <= 1 && <span className="text-slate-400 font-semibold text-sm">Contoh: 10.1038/s41586...</span>}
          </div>
        </div>

        <button className={`btn-primary w-full py-4 text-sm uppercase tracking-wide transition-transform duration-200 ${step === 4 ? 'scale-95' : 'scale-100'}`}>
          {step === 5 ? (
            <span className="flex items-center gap-2 justify-center text-slate-900"><span className="loading-spinner w-4 h-4 border-slate-900"></span> Mengekstrak...</span>
          ) : "Generate Sitasi (1 Kredit)"}
        </button>

        {/* RESULTS MOCK */}
        <div className={`mock-results-area grid grid-cols-1 sm:grid-cols-2 gap-4 transition-all duration-1000 ease-in-out ${step >= 6 ? 'opacity-100 max-h-[800px] mt-6' : 'opacity-0 max-h-0 mt-0 pointer-events-none'}`}>
          <div className="result-block border-2 border-slate-900 rounded-xl p-5 relative bg-white solid-shadow-sm">
            <div className="flex justify-between items-center border-b-2 border-slate-100 pb-3 mb-3">
              <span className="text-xs font-extrabold text-slate-800">CATATAN KAKI</span>
              <button className={`btn-copy-modern text-xs py-1 px-3 transition-transform ${step === 8 ? 'scale-95 bg-lime border-slate-900' : 'scale-100'}`}>
                {step > 8 ? <><span className="text-slate-900 font-bold text-xs mr-1">✓</span><span className="text-slate-900">Disalin</span></> : <span className="text-slate-900">Salin</span>}
              </button>
            </div>
            <p className="text-sm m-0 leading-relaxed text-slate-800 font-medium">
              Smith, J. (2020) <i>The Architecture of Modern SaaS</i>. Nature. London, hal. 10-15. https://doi.org/10.1038/s41586-020-2649-2
            </p>
          </div>
          <div className="result-block border-2 border-slate-900 rounded-xl p-5 relative bg-white solid-shadow-sm">
            <div className="flex justify-between items-center border-b-2 border-slate-100 pb-3 mb-3">
              <span className="text-xs font-extrabold text-slate-800">APA 7TH EDITION</span>
              <button className="btn-copy-modern text-xs py-1 px-3 scale-100 text-slate-800">Salin</button>
            </div>
            <p className="text-sm m-0 leading-relaxed text-slate-800 font-medium">
              Smith, J. (2020). The Architecture of Modern SaaS. <i>Nature</i>, 10-15. https://doi.org/10.1038/s41586-020-2649-2
            </p>
          </div>
        </div>
      </div>

      {/* FAKE CURSOR */}
      <div className={`fake-cursor cursor-step-${step}`}>
        <svg width="28" height="34" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.98402 1.54516L9.61053 28.0267C9.91974 29.0999 11.4554 29.1558 11.8152 28.1069L14.7336 19.6146L22.2573 15.656C23.1979 15.1611 23.0116 13.7661 21.9686 13.4925L2.57022 0.354145C1.61111 -0.290886 0.536968 0.697424 1.98402 1.54516Z" fill="#0f172a" stroke="#ffffff" strokeWidth="2.5"/>
        </svg>
      </div>

      <style>{`
        .mock-input-wrap { width: 100%; padding: 1rem 1.25rem; font-size: 0.95rem; background: #f8fafc; border: 2px solid var(--border-color); border-radius: 12px; min-height: 52px; display: flex; align-items: center; transition: 0.2s; }
        .mock-input-wrap.focused { border-color: var(--primary); background: #ffffff; box-shadow: 0 4px 12px rgba(180, 244, 84, 0.2); }
        .mock-caret { display: inline-block; width: 2px; height: 18px; background: var(--primary); margin-left: 4px; animation: blink 1s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        
        .fake-cursor { position: absolute; z-index: 50; transition: all 0.7s cubic-bezier(0.25, 1, 0.5, 1); pointer-events: none; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2)); }
        .cursor-step-0 { top: 90%; left: 80%; opacity: 0; }
        .cursor-step-1, .cursor-step-2 { top: 38%; left: 25%; opacity: 1; transform: scale(1); }
        .cursor-step-3 { top: 55%; left: 50%; opacity: 1; transform: scale(1); }
        .cursor-step-4, .cursor-step-5 { top: 55%; left: 50%; opacity: 1; transform: scale(0.9); }
        .cursor-step-6, .cursor-step-7 { top: 82%; left: 45%; opacity: 1; transform: scale(1); }
        .cursor-step-8 { top: 82%; left: 45%; opacity: 1; transform: scale(0.9); }
        .cursor-step-9 { top: 85%; left: 80%; opacity: 0; }
        
        @media (max-width: 640px) {
           .cursor-step-1, .cursor-step-2 { top: 25%; left: 35%; }
           .cursor-step-3, .cursor-step-4, .cursor-step-5 { top: 38%; left: 50%; }
           .cursor-step-6, .cursor-step-7, .cursor-step-8 { top: 62%; left: 82%; }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

export default function App() {
  const [currentView, setCurrentView] = useState("landing");
  const landingRef = useRef(null);
  const appRef = useRef(null);

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({ credits: 0 });
  const [history, setHistory] = useState([]);

  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState(50);
  const [isPaying, setIsPaying] = useState(false);

  const [inputMode, setInputMode] = useState("doi");
  const [citationStyle, setCitationStyle] = useState("footnote");
  
  // Dashboard Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Form States
  const [doiInput, setDoiInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [kotaInput, setKotaInput] = useState("");

  const [mAuthor, setMAuthor] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [mJournal, setMJournal] = useState("");
  const [mYear, setMYear] = useState("");
  const [mVolume, setMVolume] = useState("");
  const [mIssue, setMIssue] = useState("");
  const [mPage, setMPage] = useState("");
  const [mPublisher, setMPublisher] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [batchResults, setBatchResults] = useState([]);

  const [footnoteResult, setFootnoteResult] = useState("");
  const [dafpusResult, setDafpusResult] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [notification, setNotification] = useState("");

  // --- GSAP ANIMATIONS ---
  useEffect(() => {
    if (currentView === "landing" && appRef.current) {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline();
        
        tl.fromTo(".navbar-wrapper", { y: -100, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" })
          .fromTo(".hero-badge", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.5)" }, "-=0.4")
          .fromTo(".title-word", { opacity: 0, y: 30, rotationX: 20 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.8, stagger: 0.08, ease: "power3.out" }, "-=0.3")
          .fromTo(".hero-subtitle", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "-=0.4")
          .fromTo(".hero-cta", { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.5)" }, "-=0.4");

        gsap.fromTo(".preview-card-anim", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".preview-section", start: "top 85%" } });
        gsap.fromTo(".step-card-anim", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.2, ease: "power2.out", scrollTrigger: { trigger: ".steps-section", start: "top 80%" } });
        gsap.fromTo(".feature-card-anim", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: "power2.out", scrollTrigger: { trigger: ".features-section", start: "top 80%" } });
        gsap.fromTo(".pricing-card-anim", { opacity: 0, scale: 0.95, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".pricing-section", start: "top 85%" } });
      }, appRef);
      return () => ctx.revert();
    }
  }, [currentView]);

  useEffect(() => {
    setError(""); setMetadata(null); setBatchResults([]); setFootnoteResult(""); setDafpusResult(""); setCopiedId(null);
  }, [inputMode]);

  const showNotification = (msg) => {
    setNotification(msg); setTimeout(() => setNotification(""), 3000);
  };

  // --- FIREBASE AUTH & REALTIME DATA ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const profileRef = doc(db, "users", user.uid);
    const unsubProfile = onSnapshot(profileRef, (docSnap) => { if (docSnap.exists()) setUserData(docSnap.data()); });
    const historyRef = collection(db, "users", user.uid, "history");
    const unsubHistory = onSnapshot(historyRef, (snapshot) => {
      const histData = [];
      snapshot.forEach((doc) => histData.push({ id: doc.id, ...doc.data() }));
      histData.sort((a, b) => b.timestamp - a.timestamp);
      setHistory(histData);
    });
    return () => { unsubProfile(); unsubHistory(); };
  }, [user]);

  // --- AUTH HANDLERS ---
  const handleLoginAndEnter = async () => {
    if (user) { setCurrentView("tool"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (!auth) return showNotification("Error: Konfigurasi API Key di .env belum diset.");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const loggedUser = result.user;
      const profileRef = doc(db, "users", loggedUser.uid);
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        await setDoc(profileRef, { credits: 5, createdAt: Date.now(), email: loggedUser.email, name: loggedUser.displayName });
        showNotification("Selamat datang! Anda mendapatkan 5 Kredit gratis.");
      } else {
        const existingData = profileSnap.data();
        if (existingData.credits === undefined || existingData.credits === null) {
          await updateDoc(profileRef, { credits: 5 });
          showNotification("Bonus 5 Kredit berhasil ditambahkan.");
        }
      }
      setCurrentView("tool"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError("Login via Google dibatalkan atau gagal."); } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    setIsSidebarOpen(false);
    setCurrentView("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- PAYMENT HANDLER ---
  const processPayment = async () => {
    if (topupAmount < 1) return showNotification("Minimal pembelian 1 kredit.");
    setIsPaying(true); const price = topupAmount * 750;
    try {
      const response = await fetch("/api/create-payment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: price, description: `Top Up ${topupAmount} Kredit FlashCite`, customer_name: user.displayName || "Pengguna", customer_email: user.email || "", payment_method: "qris", redirect_url: window.location.href }),
      });
      const data = await response.json();
      if (data.success && data.data?.payment_url) { window.location.href = data.data.payment_url; } 
      else { throw new Error(data.message || "Gagal membuat pembayaran"); }
    } catch (err) { showNotification(err.message || "Error payment."); } finally { setIsPaying(false); }
  };

  const deductCredit = async (amount = 1) => {
    if (!user || !db) return false;
    const currentCredits = userData.credits || 0;
    if (currentCredits < amount) { setShowTopupModal(true); return false; }
    await updateDoc(doc(db, "users", user.uid), { credits: increment(-amount) });
    return true;
  };

  const refundCredit = async (amount = 1) => {
    if (!user || !db) return;
    await updateDoc(doc(db, "users", user.uid), { credits: increment(amount) });
  };

  const saveToHistory = async (meta, fn, dp, apaIn, apaRf, inputVal, type) => {
    if (!user || !db) return;
    await addDoc(collection(db, "users", user.uid, "history"), {
      type, input: inputVal, title: meta.title, footnote: fn, dafpus: dp, apaInText: apaIn, apaRef: apaRf, timestamp: Date.now(),
    });
  };

  // --- SCRAPING ENGINE ---
  const cleanDOI = (input) => input.trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "");
  const capitalize = (str) => { if (!str || typeof str !== "string") return ""; return str.toLowerCase().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1)); };
  const extractDoiFromUrl = (url) => { const match = url.match(/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i); return match ? match[1].replace(/\.pdf$/i, "") : null; };
  const normalizeUrl = (url) => { let u = url.trim(); const acaMatch = u.match(/academia\.edu\/download\/(\d+)/i) || u.match(/academia\.edu\/(\d+)/i); if (acaMatch) return `https://www.academia.edu/${acaMatch[1]}`; const ojsMatch = u.match(/^(.*\/article\/(?:view|download|viewFile)\/\d+)(?:\/.*)?$/i); if (ojsMatch) return ojsMatch[1].replace(/\/(download|viewFile)/i, "/view"); const rgMatch = u.match(/researchgate\.net\/.*publication\/(\d+)/i); if (rgMatch) return `https://www.researchgate.net/publication/${rgMatch[1]}`; return u; };

  const formatAuthorsFootnote = (authors) => {
    if (!authors || !authors.length) return "Penulis Tidak Diketahui";
    let given = authors[0].given || "", family = authors[0].family || "";
    if (!given && family.includes(" ")) { const parts = family.split(" ").filter(Boolean); if (parts.length > 1) { family = parts.pop(); given = parts.join(" "); } }
    family = capitalize(family); given = capitalize(given);
    const firstAuthor = given ? `${given} ${family}`.trim() : family.trim();
    if (authors.length > 1) return `${firstAuthor} <i>et al.</i>`; return firstAuthor;
  };

  const formatAuthorsDafpus = (authors) => {
    if (!authors || !authors.length) return "Penulis Tidak Diketahui";
    let given = authors[0].given || "", family = authors[0].family || "";
    if (!given && family.includes(" ")) { const parts = family.split(" ").filter(Boolean); if (parts.length > 1) { family = parts.pop(); given = parts.join(" "); } }
    family = capitalize(family); given = capitalize(given);
    let firstAuthor = given ? `${family}, ${given}` : family;
    if (authors.length > 1) return `${firstAuthor} <i>et al.</i>`; return firstAuthor;
  };

  const formatFromSS = (paper) => {
    const year = paper.year?.toString() || "Tahun"; const title = paper.title || "Judul Artikel"; const journal = paper.venue || paper.journal?.name || "Nama Jurnal";
    let fn = "Penulis Tidak Diketahui", dp = "Penulis Tidak Diketahui";
    if (paper.authors && paper.authors.length > 0) {
      let firstAuthor = paper.authors[0].name.trim(); const parts = firstAuthor.split(" ").filter(Boolean);
      let family = "", given = "";
      if (parts.length === 1) {
        family = parts[0]; given = "";
      } else {
        family = parts.pop(); given = parts.join(" ");
      }
      fn = given ? `${capitalize(given)} ${capitalize(family)}` : capitalize(family); dp = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family);
      if (paper.authors.length > 1) { fn += " <i>et al.</i>"; dp += " <i>et al.</i>"; }
    }
    return { authorFootnote: fn, authorDafpus: dp, year, month: "", title, journal, page: "", volume: "", issue: "", publisher: "", kotaScraped: "", doiUrl: "" };
  };

  const searchByTitleFallback = async (rawTitle) => {
    const cleanTitle = rawTitle.replace(/(\s*[-|]\s*Academia\.edu|\s*[-|]\s*ResearchGate|\s*[-|]\s*Google Scholar|\.pdf)/gi, "").trim();
    if (cleanTitle.length < 10) return null;
    try {
      const ssRes = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleanTitle)}&limit=1&fields=title,authors,year,venue,journal`);
      if (ssRes.ok) { const ssData = await ssRes.json(); if (ssData.data?.[0]?.authors?.length > 0) return formatFromSS(ssData.data[0]); }
      const crRes = await fetch(`https://api.crossref.org/works?query.title=${encodeURIComponent(cleanTitle)}&rows=1`);
      if (crRes.ok) {
        const crData = await crRes.json();
        if (crData.message.items.length > 0) {
          const item = crData.message.items[0]; const itemTitle = (item.title?.[0] || "").toLowerCase(); const searchWords = cleanTitle.toLowerCase().split(" ").filter((w) => w.length > 4); const matches = searchWords.filter((w) => itemTitle.includes(w));
          if (matches.length >= Math.min(2, searchWords.length)) {
            const yearObj = item["published-print"] || item.issued; const year = yearObj && yearObj["date-parts"] ? yearObj["date-parts"][0][0] : "Tahun";
            return { authorFootnote: formatAuthorsFootnote(item.author), authorDafpus: formatAuthorsDafpus(item.author), year: year.toString(), month: "", title: item.title?.[0] ?? "Judul Artikel", journal: item["container-title"]?.[0] ?? "Nama Jurnal", page: item.page || "", volume: item.volume || "", issue: item.issue || "", publisher: item.publisher || "", kotaScraped: item["publisher-location"] || "", doiUrl: item.DOI ? `https://doi.org/${item.DOI}` : "" };
          }
        }
      }
    } catch (e) {} return null;
  };

  const processDOI = async (rawDoi) => {
    const cleanedDoi = cleanDOI(rawDoi);
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanedDoi)}`);
    if (!res.ok) throw new Error("DOI tidak ditemukan atau salah format.");
    const data = await res.json(); const item = data.message; const yearObj = item["published-print"] || item.issued; const year = yearObj && yearObj["date-parts"] ? yearObj["date-parts"][0][0] : "Tahun";
    const monthNum = yearObj?.["date-parts"]?.[0]?.[1] ?? null; const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    return { authorFootnote: formatAuthorsFootnote(item.author), authorDafpus: formatAuthorsDafpus(item.author), year, month: monthNum ? monthNames[monthNum - 1] : "", title: item.title?.[0] ?? "Judul Artikel", journal: item["container-title"]?.[0] ?? "Nama Jurnal", page: item.page || "", volume: item.volume || "", issue: item.issue || "", publisher: item.publisher || "", kotaScraped: item["publisher-location"] || "", doiUrl: `https://doi.org/${cleanedDoi}` };
  };

  const processURL = async (rawUrl) => {
    const targetUrl = normalizeUrl(rawUrl); const ssUrlsToTry = [targetUrl, rawUrl.trim()];
    for (const u of ssUrlsToTry) { try { const ssUrlRes = await fetch(`https://api.semanticscholar.org/graph/v1/paper/URL:${encodeURIComponent(u)}?fields=title,authors,year,venue,journal`); if (ssUrlRes.ok) { const ssData = await ssUrlRes.json(); if (ssData.title && ssData.authors && ssData.authors.length > 0) return formatFromSS(ssData); } } catch (e) {} }
    try {
      const mlRes = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}`);
      if (mlRes.ok) {
        const mlData = await mlRes.json(); const mlTitle = mlData.data?.title || "";
        if (mlTitle && !mlTitle.toLowerCase().includes("just a moment") && !mlTitle.toLowerCase().includes("cloudflare")) {
          const fallbackResult = await searchByTitleFallback(mlTitle); if (fallbackResult) return fallbackResult;
          let rawAuthor = mlData.data?.author || mlData.data?.publisher || "";
          return { authorFootnote: rawAuthor ? formatAuthorsFootnote([{ family: rawAuthor }]) : "Penulis Tidak Diketahui", authorDafpus: rawAuthor ? formatAuthorsDafpus([{ family: rawAuthor }]) : "Penulis Tidak Diketahui", year: mlData.data?.date ? new Date(mlData.data.date).getFullYear().toString() : "Tahun", month: "", title: mlTitle.replace(/(\s*[-|]\s*Academia\.edu)/i, "").trim(), journal: mlData.data?.publisher || "Nama Jurnal", page: "", volume: "", issue: "", publisher: "", kotaScraped: "", doiUrl: "" };
        }
      }
    } catch (e) {}

    const parseHTML = (html, contentType) => {
      const isBase64Pdf = html.startsWith("JVBERi"); const isRawPdf = html.trim().startsWith("%PDF-"); const isPdfType = (contentType || "").toLowerCase().includes("pdf") || (contentType || "").toLowerCase().includes("octet-stream"); const isPdfUrl = targetUrl.toLowerCase().split("?")[0].endsWith(".pdf");
      if (isPdfType || isRawPdf || isBase64Pdf || isPdfUrl) return { isPdfFile: true };
      const parser = new DOMParser(); const doc = parser.parseFromString(html, "text/html");
      const getMeta = (names) => { for (const n of names) { const el = doc.querySelector(`meta[name="${n}" i]`) || doc.querySelector(`meta[property="${n}" i]`); if (el && el.getAttribute("content")) return el.getAttribute("content").trim(); } return ""; };
      let title = getMeta(["citation_title", "DC.Title", "og:title"]) || doc.title || "Judul Tidak Diketahui"; title = title.replace(/(\s*[-|]\s*Academia\.edu|\s*[-|]\s*ResearchGate|\s*[-|]\s*Google Scholar)/i, "").trim();
      const blockedKeywords = ["just a moment", "cloudflare", "attention required", "security check", "robot or human"]; if (blockedKeywords.some((kw) => title.toLowerCase().includes(kw))) return { blocked: true };
      let authors = []; doc.querySelectorAll('meta[name="citation_author" i], meta[name="DC.Creator.PersonalName" i], meta[name="DC.Creator" i]').forEach((node) => { const content = node.getAttribute("content"); if (content && !authors.includes(content)) authors.push(content); });
      if (authors.length === 0 && title !== "Judul Tidak Diketahui") return { incomplete: true, title };
      let fn = "Penulis Tidak Diketahui", dp = "Penulis Tidak Diketahui";
      if (authors.length > 0) {
        let firstAuthor = authors[0].trim(); let family = "", given = "";
        if (firstAuthor.includes(",")) { const parts = firstAuthor.split(","); family = parts[0].trim(); given = parts[1] ? parts[1].trim() : ""; } 
        else { const parts = firstAuthor.split(" ").filter(Boolean); if (parts.length === 1) { family = parts[0]; given = ""; } else { family = parts.pop(); given = parts.join(" "); } }
        fn = given ? `${capitalize(given)} ${capitalize(family)}` : capitalize(family); dp = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family);
        if (authors.length > 1) { fn += " <i>et al.</i>"; dp += " <i>et al.</i>"; }
      }
      const dateStr = getMeta(["citation_date", "citation_publication_date", "DC.Date", "DC.Date.issued", "article:published_time"]) || ""; const year = dateStr ? dateStr.split("/")[0].split("-")[0] : "Tahun"; const firstPage = getMeta(["citation_firstpage", "DC.Identifier.pageNumber"]); const lastPage = getMeta(["citation_lastpage"]);
      return { success: true, data: { authorFootnote: fn, authorDafpus: dp, year, month: "", title, journal: getMeta(["citation_journal_title", "DC.Source", "og:site_name"]) || "", page: firstPage ? lastPage ? `${firstPage}-${lastPage}` : firstPage : "", volume: getMeta(["citation_volume", "DC.Source.Volume"]) || "", issue: getMeta(["citation_issue", "DC.Source.Issue"]) || "", publisher: getMeta(["citation_publisher", "DC.Publisher"]) || "", kotaScraped: "" } };
    };

    let htmlContent = "", contentType = "", finalUrl = targetUrl;
    const proxies = [ `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}` ];
    for (let proxy of proxies) { try { const res = await fetch(proxy); if (!res.ok) continue; htmlContent = await res.text(); contentType = res.headers.get("content-type") || ""; if (!htmlContent.toLowerCase().includes("just a moment") && htmlContent.trim() !== "") break; } catch (e) {} }
    if (!htmlContent) throw new Error("Gagal mengakses URL web. Pastikan web bersifat publik.");

    let parsed = parseHTML(htmlContent, contentType);
    if (parsed.isPdfFile) { const extractedDoi = extractDoiFromUrl(targetUrl); if (extractedDoi) return await processDOI(extractedDoi); throw new Error("Tautan PDF mentah tanpa meta. Silakan ketik manual."); }
    if (parsed.blocked || parsed.incomplete) {
      try {
        const wbRes = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(targetUrl)}`); const wbData = await wbRes.json();
        if (wbData.archived_snapshots?.closest?.url) { const snapFetch = await fetch(wbData.archived_snapshots.closest.url.replace(/^http:/, "https:")); if (snapFetch.ok) { const snapParsed = parseHTML(await snapFetch.text(), "text/html"); if (snapParsed.success || (snapParsed.incomplete && parsed.blocked)) parsed = snapParsed; } }
      } catch (e) {}
    }
    let searchTitle = parsed.incomplete ? parsed.title : "";
    if (parsed.blocked) { try { const segments = new URL(finalUrl).pathname.split("/").filter(Boolean); const last = segments[segments.length - 1]; if (last && !last.match(/^\d+(\.pdf)?$/i)) searchTitle = decodeURIComponent(last).replace(/[-_]/g, " ").replace(/\.pdf/i, "").trim(); } catch (e) {} }
    if (searchTitle) { const fallbackResult = await searchByTitleFallback(searchTitle); if (fallbackResult) return fallbackResult; }
    if (parsed.success) return parsed.data;
    if (parsed.blocked) throw new Error("Sistem diblokir. Mohon ketik manual.");
    if (parsed.incomplete) { parsed.data = { authorFootnote: "Penulis Tidak Diketahui", authorDafpus: "Penulis Tidak Diketahui", year: "Tahun", month: "", title: parsed.title || "Judul Artikel", journal: "", page: "", volume: "", issue: "", publisher: "", kotaScraped: "", doiUrl: "" }; return parsed.data; }
    throw new Error("Gagal mengekstrak data dari tautan ini.");
  };

  const buildFootnote = (m, kotaManual) => {
    const finalKota = kotaManual.trim() ? kotaManual : m.kotaScraped || ""; const kotaTxt = capitalize(finalKota) ? `${capitalize(finalKota)}, ` : ""; const pageTxt = m.page ? `hal. ${m.page}.` : "";
    let baseFootnote = `${m.authorFootnote} (${m.year}) ${capitalize(m.title)}. ${capitalize(m.journal)}. ${kotaTxt}${pageTxt}`; baseFootnote = baseFootnote.trim(); if (!baseFootnote.endsWith(".")) baseFootnote += "."; if (m.doiUrl) baseFootnote += ` ${m.doiUrl}`; return baseFootnote;
  };
  const buildDafpus = (m, kotaManual) => {
    const finalKota = kotaManual.trim() ? kotaManual : m.kotaScraped || ""; const parts = []; if (m.journal) parts.push(capitalize(m.journal)); if (m.publisher) parts.push(capitalize(m.publisher)); if (finalKota) parts.push(capitalize(finalKota)); let volIssue = ""; if (m.volume) volIssue += `Vol. ${m.volume}`; if (m.issue) volIssue += volIssue ? ` No. ${m.issue}` : `No. ${m.issue}`; if (volIssue) parts.push(volIssue); let datePart = m.month ? `${m.month} ` : ""; datePart += m.year; parts.push(datePart); const journalMeta = parts.join(", ") + "."; const authorDot = m.authorDafpus.endsWith("</i>") || m.authorDafpus.endsWith(".") ? "" : "."; return `${m.authorDafpus}${authorDot} (${m.year}) "${capitalize(m.title)}". ${journalMeta}`;
  };
  const buildApaInText = (m) => { let familyName = m.authorDafpus.split(',')[0].replace(/<i>et al\.<\/i>/ig, '').replace(/et al\./ig, '').trim(); let hasEtAl = m.authorDafpus.toLowerCase().includes('et al'); return `(${familyName}${hasEtAl ? ' et al.' : ''}, ${m.year})`; };
  const buildApaReference = (m) => {
    let authorPart = m.authorDafpus;
    if (authorPart && authorPart !== "Penulis Tidak Diketahui") { let parts = authorPart.split(','); if(parts.length > 1) { let family = parts[0].trim(); let givenRaw = parts[1].replace(/<i>et al\.<\/i>/ig, '').replace(/et al\./ig, '').trim(); let initials = givenRaw.split(' ').filter(Boolean).map(n => n[0].toUpperCase() + '.').join(' '); let hasEtAl = authorPart.toLowerCase().includes('et al'); authorPart = `${family}, ${initials}${hasEtAl ? ', et al.' : ''}`; } }
    let ref = `${authorPart} (${m.year}). ${capitalize(m.title)}. `; if (m.journal) { ref += `<i>${capitalize(m.journal)}</i>`; if (m.volume) { ref += `, <i>${m.volume}</i>`; if (m.issue) ref += `(${m.issue})`; } if (m.page) ref += `, ${m.page}`; ref += `.`; } else if (m.publisher) { ref += `${capitalize(m.publisher)}.`; } if (m.doiUrl) ref += ` ${m.doiUrl}`; return ref.trim();
  };

  const fetchDOI = async () => {
    if (!doiInput) return; setError(""); const canProceed = await deductCredit(1); if (!canProceed) return; setLoading(true); setMetadata(null);
    try { const meta = await processDOI(doiInput); const fn = buildFootnote(meta, kotaInput); const dp = buildDafpus(meta, kotaInput); const apaIn = buildApaInText(meta); const apaRf = buildApaReference(meta); setMetadata(meta); setFootnoteResult(fn); setDafpusResult(dp); await saveToHistory(meta, fn, dp, apaIn, apaRf, doiInput, "DOI"); } catch (e) { await refundCredit(1); setError(e.message); } finally { setLoading(false); }
  };
  const fetchURL = async () => {
    if (!urlInput) return; setError(""); const canProceed = await deductCredit(1); if (!canProceed) return; setLoading(true); setMetadata(null);
    try { const meta = await processURL(urlInput); const fn = buildFootnote(meta, kotaInput); const dp = buildDafpus(meta, kotaInput); const apaIn = buildApaInText(meta); const apaRf = buildApaReference(meta); setMetadata(meta); setFootnoteResult(fn); setDafpusResult(dp); await saveToHistory(meta, fn, dp, apaIn, apaRf, urlInput, "URL"); } catch (e) { await refundCredit(1); setError(e.message); } finally { setLoading(false); }
  };
  const handleGenerateManual = async () => {
    setError(""); if (!mAuthor || !mTitle || !mYear) return setError("Nama Penulis, Judul, dan Tahun wajib diisi."); const canProceed = await deductCredit(1); if (!canProceed) return;
    let fnName = "Penulis Tidak Diketahui", dpName = "Penulis Tidak Diketahui";
    if (mAuthor.trim()) { const authors = mAuthor.split(",").map((a) => a.trim()).filter(Boolean); const parts = authors[0].split(" ").filter(Boolean); let family = "", given = ""; if (parts.length === 1) { family = parts[0]; } else { family = parts.pop(); given = parts.join(" "); } fnName = given ? `${capitalize(given)} ${capitalize(family)}` : capitalize(family); dpName = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family); if (authors.length > 1) { fnName += " <i>et al.</i>"; dpName += " <i>et al.</i>"; } }
    const meta = { authorFootnote: fnName, authorDafpus: dpName, title: mTitle, journal: mJournal, year: mYear, month: "", volume: mVolume, issue: mIssue, page: mPage, publisher: mPublisher, kotaScraped: "" };
    const fn = buildFootnote(meta, kotaInput); const dp = buildDafpus(meta, kotaInput); const apaIn = buildApaInText(meta); const apaRf = buildApaReference(meta);
    setMetadata(meta); setFootnoteResult(fn); setDafpusResult(dp); await saveToHistory(meta, fn, dp, apaIn, apaRf, "Input Manual", "Manual");
  };
  const handleBatchGenerate = async () => {
    if (!batchInput.trim()) return setError("Masukkan setidaknya 1 baris URL/DOI."); const lines = batchInput.split("\n").map((l) => l.trim()).filter((l) => l.length > 0); const currentCredits = userData.credits || 0; if (currentCredits <= 0) return setShowTopupModal(true);
    setLoading(true); setError(""); setBatchResults([]); setMetadata(null); const results = []; let successfulParses = 0;
    for (let i = 0; i < lines.length; i++) {
      if (currentCredits - successfulParses <= 0) { results.push({ status: "error", line: lines[i], error: "Kredit habis." }); break; }
      const line = lines[i]; const isDoi = (line.includes("10.") && !line.includes("http")) || line.includes("doi.org");
      try { let meta = isDoi ? await processDOI(line) : await processURL(line); results.push({ status: "success", line, meta }); successfulParses++; const fn = buildFootnote(meta, kotaInput); const dp = buildDafpus(meta, kotaInput); const apaIn = buildApaInText(meta); const apaRf = buildApaReference(meta); await saveToHistory(meta, fn, dp, apaIn, apaRf, line, "Batch"); } catch (err) { results.push({ status: "error", line, error: err.message }); }
    }
    if (successfulParses > 0) { const profileRef = doc(db, "users", user.uid); await updateDoc(profileRef, { credits: currentCredits - successfulParses }); }
    setBatchResults(results); setLoading(false);
  };

  const handleCopy = (htmlString, targetCopyId) => {
    if (!htmlString) return; const plainText = htmlString.replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]+>/g, "");
    const div = document.createElement("div"); div.innerHTML = htmlString; div.style.position = "fixed"; div.style.left = "-9999px"; document.body.appendChild(div);
    const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(div); selection.removeAllRanges(); selection.addRange(range);
    let success = false; try { success = document.execCommand("copy"); } catch (err) {} selection.removeAllRanges(); document.body.removeChild(div);
    if (!success && navigator.clipboard) { navigator.clipboard.writeText(plainText).then(() => (success = true)).catch((e) => {}); }
    if (success) { setCopiedId(targetCopyId); setTimeout(() => setCopiedId(null), 2000); }
  };

  // --- SVGs & ICONS ---
  const VideoLogo = () => (<video src="/logo.mp4" autoPlay loop muted playsInline className="video-logo-asset" />);
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

  const ShieldIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="28" width="28"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>);
  const SparklesIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="28" width="28"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path></svg>);
  const ZapIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="28" width="28"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>);

  const batchSuccesses = batchResults.filter((r) => r.status === "success");
  const batchErrors = batchResults.filter((r) => r.status === "error");
  const sortedBatchDafpus = [...batchSuccesses].sort((a, b) => a.meta.authorDafpus.localeCompare(b.meta.authorDafpus));

  const SkeletonLoader = () => (
    <div className="card mt-6 glass-panel animate-fade-in">
      <div className="p-6"><div className="skeleton-line w-40 mb-6"></div><div className="skeleton-box h-24 mb-6"></div><div className="skeleton-line w-48 mb-6"></div><div className="skeleton-box h-20"></div></div>
    </div>
  );

  return (
    <div className="app-wrapper pattern-bg" ref={appRef}>
      {!firebaseConfig.apiKey && (
        <div className="env-warning">⚠️ Peringatan: Konfigurasi API Key di file .env belum diset.</div>
      )}

      {notification && (<div className="notification-toast animate-slide-up-fade">{notification}</div>)}

      {showTopupModal && (
        <div className="modal-overlay">
          <div className="modal-box animate-scale-in">
            <div className="modal-header">
              <h3 className="m-0 flex items-center gap-2 text-lg font-bold"><CoinIcon /> Top Up Kredit</h3>
              <button className="btn-close-modal" onClick={() => setShowTopupModal(false)}><CloseIcon /></button>
            </div>
            <div className="modal-body">
              <p className="text-muted mb-6 mt-0 text-sm leading-relaxed">Kredit Anda habis. Harga per 1 sitasi sukses hanya Rp 750. Bebas hambatan, bebas stres.</p>
              <div className="grid-packages mb-5">
                {[50, 75, 100, 125].map((amt) => (
                  <button key={amt} className={`btn-package ${topupAmount === amt ? "active" : ""}`} onClick={() => setTopupAmount(amt)}>{amt} Kredit</button>
                ))}
              </div>
              <div className="form-group">
                <label className="text-xs font-bold text-muted uppercase tracking-wide mb-2 block">Nominal Custom:</label>
                <input type="number" min="1" className="input-field-modern" value={topupAmount} onChange={(e) => setTopupAmount(parseInt(e.target.value) || 0)} />
              </div>
              <div className="price-tag mt-6">
                <span className="text-muted font-medium text-sm">Total Pembayaran</span>
                <span className="font-extrabold text-xl text-main">Rp {(topupAmount * 750).toLocaleString("id-ID")}</span>
              </div>
              <button className="btn-primary w-full mt-6 py-3.5 shadow-glow" onClick={processPayment} disabled={isPaying}>
                {isPaying ? "Menghubungkan..." : "Bayar via Bayar.gg"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LANDING PAGE NAVBAR --- */}
      {currentView === "landing" && (
        <div className="navbar-wrapper">
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
          {/* Topographic Background (Subtle Wavy SVG) */}
          <div className="topo-bg"></div>

          {/* Hero Section */}
          <section id="hero" className="hero-section relative">
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
                Berhenti menyusun daftar pustaka secara manual. Sistem mengekstrak metadata
                dari PDF, DOI, Academia, ResearchGate, dan OJS secara instan dengan presisi tinggi.
              </p>
              
              <div className="hero-cta mt-10">
                <button onClick={handleLoginAndEnter} className="btn-primary btn-lg shadow-glow" disabled={loading}>
                  {loading ? "Memuat Workspace..." : "Mulai Gratis Sekarang"}
                </button>
                <div className="hero-trusted mt-6 flex items-center justify-center gap-3">
                  <div className="avatar-group flex"><div className="avatar"></div><div className="avatar"></div><div className="avatar"></div></div>
                  <p className="text-xs text-muted font-medium m-0">Dipercaya oleh Mahasiswa & Akademisi</p>
                </div>
              </div>
            </div>
          </section>

          {/* Animated Mock Workspace (Hero Showcase) */}
          <section className="preview-section mt-12 pb-24 relative z-20">
            <div className="container preview-card-anim">
               <AnimatedWorkspaceMock />
            </div>
          </section>

          {/* How It Works Section */}
          <section className="steps-section py-16 bg-white border-y-2 border-slate-900 relative z-10">
             <div className="container">
                <h2 className="section-title text-center mb-4">Tiga Langkah Mudah</h2>
                <p className="text-muted text-center max-w-md mx-auto mb-12">Otomatisasi referensi Anda dalam hitungan detik. Tanpa format manual yang membingungkan.</p>
                
                <div className="flex flex-col gap-6 max-w-3xl mx-auto">
                   <div className="step-card-anim flex items-center p-6 bg-pale-yellow border-2 border-slate-900 rounded-2xl solid-shadow-sm">
                      <div className="step-number bg-white border-2 border-slate-900 rounded-full w-12 h-12 flex items-center justify-center font-black text-xl mr-5 flex-shrink-0">1</div>
                      <div className="text-left">
                        <h4 className="font-extrabold text-slate-900 text-lg mb-1">Salin Tautan</h4>
                        <p className="text-sm text-slate-700 font-medium">Dapatkan tautan (URL) atau nomor DOI dari jurnal/artikel yang ingin disitasi.</p>
                      </div>
                   </div>
                   <div className="step-card-anim flex items-center p-6 bg-white border-2 border-slate-900 rounded-2xl solid-shadow-sm">
                      <div className="step-number bg-white border-2 border-slate-900 rounded-full w-12 h-12 flex items-center justify-center font-black text-xl mr-5 flex-shrink-0">2</div>
                      <div className="text-left">
                        <h4 className="font-extrabold text-slate-900 text-lg mb-1">Sistem Memproses</h4>
                        <p className="text-sm text-slate-700 font-medium">Tempelkan tautan ke dalam sistem kami, lalu klik tombol Generate.</p>
                      </div>
                   </div>
                   <div className="step-card-anim flex items-center p-6 bg-white border-2 border-slate-900 rounded-2xl solid-shadow-sm">
                      <div className="step-number bg-white border-2 border-slate-900 rounded-full w-12 h-12 flex items-center justify-center font-black text-xl mr-5 flex-shrink-0">3</div>
                      <div className="text-left">
                        <h4 className="font-extrabold text-slate-900 text-lg mb-1">Sitasi Selesai</h4>
                        <p className="text-sm text-slate-700 font-medium">Salin hasil Footnote & Daftar Pustaka (APA 7) yang sudah terformat rapi.</p>
                      </div>
                   </div>
                </div>
             </div>
          </section>

          {/* Features Detail */}
          <section id="features" className="features-section pt-20 pb-16 relative z-10">
            <div className="container text-center">
              <h2 className="section-title mb-12">Dibangun untuk Kecepatan & Presisi</h2>
              <div className="grid-3">
                <div className="feature-card-anim feature-card bg-lime border-2 border-slate-900 rounded-3xl solid-shadow-sm group-hover-effect">
                  <div className="feature-icon-box text-slate-900 border-2 border-slate-900 bg-white"><ShieldIcon /></div>
                  <h3 className="text-lg font-extrabold text-slate-900">Anti-Cloudflare Bypass</h3>
                  <p className="text-slate-800 font-medium mt-2 text-sm leading-relaxed">Mengekstrak data secara otomatis meski web sumber diproteksi sistem keamanan Cloudflare.</p>
                </div>
                <div className="feature-card-anim feature-card bg-pale-blue border-2 border-slate-900 rounded-3xl solid-shadow-sm group-hover-effect">
                  <div className="feature-icon-box text-slate-900 border-2 border-slate-900 bg-white"><SparklesIcon /></div>
                  <h3 className="text-lg font-extrabold text-slate-900">Smart Metadata Recovery</h3>
                  <p className="text-slate-800 font-medium mt-2 text-sm leading-relaxed">Jika struktur PDF berantakan, sistem akan melacak metadata yang tepat dari database global.</p>
                </div>
                <div className="feature-card-anim feature-card bg-pale-yellow border-2 border-slate-900 rounded-3xl solid-shadow-sm group-hover-effect">
                  <div className="feature-icon-box text-slate-900 border-2 border-slate-900 bg-white"><ZapIcon /></div>
                  <h3 className="text-lg font-extrabold text-slate-900">Pemrosesan Batch</h3>
                  <p className="text-slate-800 font-medium mt-2 text-sm leading-relaxed">Punya puluhan referensi? Tempelkan semua URL sekaligus dan dapatkan daftar urut abjad seketika.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Pricing & Transparency */}
          <section className="pricing-section pb-24 relative z-10">
            <div className="container text-center">
              <div className="pricing-card-anim pricing-card bg-lime border-2 border-slate-900 rounded-3xl solid-shadow-lg mx-auto relative overflow-hidden">
                <div className="badge-pill mx-auto mb-4 bg-white text-slate-900 border-2 border-slate-900 font-bold text-xs relative z-10">Paling Diminati</div>
                <h2 className="m-0 mb-3 text-3xl font-black text-slate-900 relative z-10 tracking-tight">Transparan. Pay-As-You-Go.</h2>
                <p className="text-slate-800 font-medium m-0 mb-8 relative z-10 text-sm max-w-sm mx-auto">Tanpa langganan bulanan. Anda hanya membayar apa yang Anda gunakan.</p>
                <div className="price-huge text-slate-900 relative z-10"><span className="currency font-bold">Rp</span>750<span className="suffix font-bold text-slate-700">/ Sitasi Sukses</span></div>
                
                <div className="pricing-divider border-slate-900 opacity-20 relative z-10"></div>
                
                <ul className="pricing-list relative z-10">
                  <li><div className="icon-wrap bg-white border border-slate-900 text-slate-900"><CheckIcon /></div><span className="text-slate-900 font-semibold">Gratis 5 Kredit untuk pengguna baru.</span></li>
                  <li><div className="icon-wrap bg-white border border-slate-900 text-slate-900"><CheckIcon /></div><span className="text-slate-900 font-semibold">Kredit <strong>TIDAK HANGUS</strong> jika ekstraksi gagal.</span></li>
                  <li><div className="icon-wrap bg-white border border-slate-900 text-slate-900"><CheckIcon /></div><span className="text-slate-900 font-semibold">Mendukung format Footnote & APA 7th Edition.</span></li>
                  <li><div className="icon-wrap bg-white border border-slate-900 text-slate-900"><CheckIcon /></div><span className="text-slate-900 font-semibold">Dukungan otomatis QRIS, e-Wallet, & VA.</span></li>
                </ul>
                <button onClick={handleLoginAndEnter} className="btn-primary bg-slate-900 text-lime w-full flex justify-center items-center gap-3 relative z-10 py-4 mt-8 text-base font-bold transition-transform hover:scale-105 active:scale-95">
                  Mulai Ruang Kerja Anda <ArrowRightIcon />
                </button>
              </div>
            </div>
          </section>

          <footer className="footer bg-white border-t-2 border-slate-900 relative z-20">
            <div className="container footer-content py-8">
              <div className="footer-brand flex flex-col items-center justify-center mb-5">
                <div className="logo-icon-wrap footer-logo"><VideoLogo /></div>
              </div>
              <p className="mt-4 text-sm max-w-md mx-auto text-slate-600 font-medium leading-relaxed">
                Automasi sitasi akademik pintar untuk penulisan karya ilmiah instan. Desain eksklusif. Performa maksimal.
              </p>
              <div className="mt-8 text-xs font-bold text-slate-400 flex flex-wrap justify-center gap-6 uppercase tracking-wider">
                 <span>© {new Date().getFullYear()} FlashCite.</span>
                 <a href="#" className="footer-link hover:text-slate-900 transition-colors">Kebijakan Privasi</a>
                 <a href="#" className="footer-link hover:text-slate-900 transition-colors">Syarat & Ketentuan</a>
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* --- VIEW 2: WORKSPACE (DASHBOARD) --- */}
      {currentView === "tool" && user && (
        <div className="dashboard-layout animate-fade-in bg-slate-50">
           {/* Mobile Header */}
           <div className="mobile-dashboard-header hidden sm:hidden border-b-2 border-slate-900 bg-white">
              <button onClick={() => setIsSidebarOpen(true)} className="mobile-menu-btn text-slate-900"><MenuIcon /></button>
              <div className="logo-icon-wrap" style={{ height: '24px', width: 'auto' }}><VideoLogo /></div>
           </div>

           {/* Mobile Sidebar Overlay */}
           {isSidebarOpen && <div className="sidebar-overlay sm:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

           {/* Sidebar */}
           <aside className={`dashboard-sidebar bg-white border-r-2 border-slate-900 ${isSidebarOpen ? 'open' : ''}`}>
              <div className="sidebar-header border-b-2 border-slate-900">
                 <div className="logo-icon-wrap h-8"><VideoLogo /></div>
                 <button className="mobile-close sm:hidden border-2 border-slate-900" onClick={() => setIsSidebarOpen(false)}><CloseIcon /></button>
              </div>
              
              <nav className="sidebar-nav">
                 <button className={`nav-item ${inputMode === "doi" ? "active" : ""}`} onClick={() => {setInputMode("doi"); setIsSidebarOpen(false);}}>
                    <DoiIcon /> Nomor DOI
                 </button>
                 <button className={`nav-item ${inputMode === "url" ? "active" : ""}`} onClick={() => {setInputMode("url"); setIsSidebarOpen(false);}}>
                    <LinkIcon /> Link Web/PDF
                 </button>
                 <button className={`nav-item ${inputMode === "batch" ? "active" : ""}`} onClick={() => {setInputMode("batch"); setIsSidebarOpen(false);}}>
                    <BatchIcon /> Mode Batch
                 </button>
                 <button className={`nav-item ${inputMode === "manual" ? "active" : ""}`} onClick={() => {setInputMode("manual"); setIsSidebarOpen(false);}}>
                    <ManualIcon /> Manual
                 </button>
                 <button className={`nav-item ${inputMode === "history" ? "active" : ""}`} onClick={() => {setInputMode("history"); setIsSidebarOpen(false);}}>
                    <HistoryIcon /> Riwayat
                 </button>
              </nav>

              <div className="sidebar-footer border-t-2 border-slate-900">
                 <div className="credit-box bg-lime border-2 border-slate-900 solid-shadow-sm">
                    <p className="credit-label text-slate-800">Sisa Token</p>
                    <div className="credit-amount text-slate-900"><CoinIcon /> <span>{userData.credits || 0}</span></div>
                    <button onClick={() => setShowTopupModal(true)} className="btn-topup bg-slate-900 text-lime font-bold border-2 border-slate-900 hover:bg-slate-800 transition-colors">Top Up Token</button>
                 </div>
                 <button onClick={handleLogout} className="btn-logout text-slate-500 font-bold hover:bg-red-50 hover:text-red-600 transition-colors">
                    <LogoutIcon /> Keluar Ruang Kerja
                 </button>
              </div>
           </aside>

           {/* Main Workspace Content */}
           <main className="dashboard-main">
              <div className="dashboard-container">
                <div className="tool-header mb-8 text-center sm:text-left">
                  <h2 className="section-title m-0 tracking-tight text-slate-900">Ruang Kerja</h2>
                  <p className="text-slate-600 text-sm mt-2 font-medium">Sistem ekstraksi metadata aktif. Masukkan referensi Anda.</p>
                </div>

                <div className="card border-2 border-slate-900 rounded-3xl mb-8 relative z-20 bg-white solid-shadow-md">
                  <div className="card-body p-6 sm:p-8">
                    {/* TOGGLE CITATION STYLE */}
                    <div className="flex items-center justify-between mb-8 pb-4 border-b-2 border-slate-100 flex-col-mobile">
                       <div className="mb-4 sm:mb-0 text-center sm:text-left">
                         <h3 className="text-base font-extrabold text-slate-900 m-0">Format Sitasi</h3>
                         <p className="text-xs text-slate-500 mt-1 font-semibold m-0">Pilih gaya output yang dihasilkan</p>
                       </div>
                       <div className="style-toggle bg-slate-100 border-2 border-slate-200 rounded-xl p-1 w-full sm:w-auto flex gap-1">
                          <button className={`style-toggle-btn w-full sm:w-auto ${citationStyle === "footnote" ? "active" : ""}`} onClick={() => setCitationStyle("footnote")}>📝 Footnote</button>
                          <button className={`style-toggle-btn w-full sm:w-auto ${citationStyle === "apa7" ? "active" : ""}`} onClick={() => setCitationStyle("apa7")}>📑 APA 7</button>
                       </div>
                    </div>

                    {inputMode === "doi" && (
                      <div className="animate-fade-in">
                        <div className="form-group mb-5 relative">
                          <label className="input-label text-slate-900 font-bold">Nomor DOI Referensi</label>
                          <input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={doiInput} onChange={(e) => setDoiInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchDOI()} placeholder="Contoh: 10.1038/s41586..." />
                        </div>
                        {citationStyle === "footnote" && (
                          <div className="form-group mb-8 relative animate-fade-in">
                            <label className="input-label text-slate-900 font-bold">Kota Terbit <span className="text-slate-400 font-medium">(Opsional)</span></label>
                            <input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Masukkan kota terbit jurnal" />
                          </div>
                        )}
                        <button className="btn-primary w-full py-4 text-base font-bold bg-slate-900 text-lime border-2 border-slate-900 shadow-glow transition-transform hover:scale-[1.02] active:scale-[0.98]" onClick={fetchDOI} disabled={loading || !doiInput}>
                          {loading ? "Mengeksekusi Proses..." : "Generate Sitasi (1 Token)"}
                        </button>
                      </div>
                    )}

                    {inputMode === "url" && (
                      <div className="animate-fade-in">
                        <div className="form-group mb-5 relative">
                          <label className="input-label text-slate-900 font-bold">Tautan Artikel / PDF</label>
                          <input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchURL()} placeholder="Paste link Academia, ResearchGate, OJS, dll" />
                        </div>
                        {citationStyle === "footnote" && (
                          <div className="form-group mb-8 relative animate-fade-in">
                            <label className="input-label text-slate-900 font-bold">Kota Terbit <span className="text-slate-400 font-medium">(Opsional)</span></label>
                            <input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Masukkan kota terbit jurnal" />
                          </div>
                        )}
                        <button className="btn-primary w-full py-4 text-base font-bold bg-slate-900 text-lime border-2 border-slate-900 shadow-glow transition-transform hover:scale-[1.02] active:scale-[0.98]" onClick={fetchURL} disabled={loading || !urlInput}>
                          {loading ? "Menganalisis Tautan..." : "Generate Sitasi (1 Token)"}
                        </button>
                      </div>
                    )}

                    {inputMode === "manual" && (
                      <div className="animate-fade-in">
                        <div className="grid-2 gap-5">
                          <div className="col-span-2 form-group"><label className="input-label text-slate-900 font-bold">Nama Penulis Lengkap *</label><input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={mAuthor} onChange={(e) => setMAuthor(e.target.value)} placeholder="John Doe, Jane Smith" /></div>
                          <div className="col-span-2 form-group"><label className="input-label text-slate-900 font-bold">Judul Artikel *</label><input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="Masukkan judul artikel" /></div>
                          <div className="form-group"><label className="input-label text-slate-900 font-bold">Nama Jurnal</label><input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={mJournal} onChange={(e) => setMJournal(e.target.value)} placeholder="Jurnal Internasional" /></div>
                          <div className="form-group"><label className="input-label text-slate-900 font-bold">Tahun Terbit *</label><input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={mYear} onChange={(e) => setMYear(e.target.value)} placeholder="2024" /></div>
                          <div className="form-group"><label className="input-label text-slate-900 font-bold">Volume</label><input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={mVolume} onChange={(e) => setMVolume(e.target.value)} placeholder="Misal: 5" /></div>
                          <div className="form-group"><label className="input-label text-slate-900 font-bold">Isu / Nomor</label><input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={mIssue} onChange={(e) => setMIssue(e.target.value)} placeholder="Misal: 2" /></div>
                          <div className="form-group"><label className="input-label text-slate-900 font-bold">Halaman</label><input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={mPage} onChange={(e) => setMPage(e.target.value)} placeholder="Misal: 10-25" /></div>
                          {citationStyle === "footnote" && (
                            <div className="form-group animate-fade-in"><label className="input-label text-slate-900 font-bold">Kota Terbit</label><input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Jakarta" /></div>
                          )}
                        </div>
                        <button className="btn-primary w-full py-4 mt-8 text-base font-bold bg-slate-900 text-lime border-2 border-slate-900 shadow-glow transition-transform hover:scale-[1.02] active:scale-[0.98]" onClick={handleGenerateManual}>Generate Manual (1 Token)</button>
                      </div>
                    )}

                    {inputMode === "batch" && (
                      <div className="animate-fade-in">
                        <div className="form-group mb-5"><label className="input-label text-slate-900 font-bold">Daftar Link / DOI</label><textarea className="input-field-modern textarea-field border-2 border-slate-300 focus:border-slate-900" value={batchInput} onChange={(e) => setBatchInput(e.target.value)} placeholder="Paste banyak URL atau DOI di sini&#10;1 Baris = 1 Link/DOI&#10;Maksimal disarankan: 20 baris per proses" /></div>
                        {citationStyle === "footnote" && (
                          <div className="form-group mb-8 animate-fade-in"><label className="input-label text-slate-900 font-bold">Kota Terbit Global <span className="text-slate-400 font-medium">(Opsional)</span></label><input type="text" className="input-field-modern border-2 border-slate-300 focus:border-slate-900" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Diaplikasikan ke semua referensi" /></div>
                        )}
                        <button className="btn-primary w-full py-4 text-base font-bold bg-slate-900 text-lime border-2 border-slate-900 shadow-glow transition-transform hover:scale-[1.02] active:scale-[0.98]" onClick={handleBatchGenerate} disabled={loading || !batchInput}>
                          {loading ? "Memproses Batch..." : "Generate Semua (1 Token/Sukses)"}
                        </button>
                      </div>
                    )}

                    {/* TAB HISTORY */}
                    {inputMode === "history" && (
                      <div className="animate-fade-in history-container custom-scrollbar pr-3">
                        {history.length === 0 ? (
                          <div className="text-center text-slate-400 font-semibold p-10 flex flex-col items-center">
                            <span className="text-4xl mb-3 opacity-30">🗂️</span> Ruang riwayat Anda masih kosong.
                          </div>
                        ) : (
                          history.map((item) => {
                            const inTextToCopy = citationStyle === "footnote" ? item.footnote : (item.apaInText || "Data APA 7 belum tersedia.");
                            const refToCopy = citationStyle === "footnote" ? item.dafpus : (item.apaRef || "Data APA 7 belum tersedia.");
                            return (
                              <div key={item.id} className="history-item mb-5 pb-5 border-b-2 border-slate-100 last-no-border">
                                <div className="flex justify-between items-center mb-3">
                                  <span className="badge-pill bg-slate-100 text-slate-800 border-none font-bold text-xs px-3 py-1">{item.type}</span>
                                  <span className="text-xs font-mono font-semibold text-slate-400">{new Date(item.timestamp).toLocaleString("id-ID")}</span>
                                </div>
                                <h4 className="m-0 mb-4 font-extrabold text-sm leading-snug truncate-2 text-slate-900">{item.title}</h4>
                                <div className="flex gap-2 mt-4 flex-col-mobile">
                                  <button className="btn-secondary btn-sm flex-1 justify-center w-full border-2 border-slate-200 text-slate-700 hover:border-slate-900 hover:text-slate-900 font-bold" onClick={() => handleCopy(inTextToCopy, `hist-in-${item.id}`)}>
                                    {copiedId === `hist-in-${item.id}` ? <><span className="text-green-600">✓</span> Disalin</> : <><CopyIcon /> {citationStyle === 'footnote' ? 'Footnote' : 'In-Text'}</>}
                                  </button>
                                  <button className="btn-secondary btn-sm flex-1 justify-center w-full border-2 border-slate-200 text-slate-700 hover:border-slate-900 hover:text-slate-900 font-bold" onClick={() => handleCopy(refToCopy, `hist-dp-${item.id}`)}>
                                    {copiedId === `hist-dp-${item.id}` ? <><span className="text-green-600">✓</span> Disalin</> : <><CopyIcon /> {citationStyle === 'footnote' ? 'Dafpus' : 'APA 7'}</>}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {error && (
                      <div className="error-alert mt-8 p-4 bg-red-50 border-2 border-red-500 rounded-xl flex items-start">
                        <div className="mt-0.5 text-red-600"><WarningIcon /></div> 
                        <span className="leading-relaxed font-bold text-red-600 ml-2">{error}</span>
                      </div>
                    )}
                  </div>
                </div>

                {loading && inputMode !== "batch" && <SkeletonLoader />}
                {loading && inputMode === "batch" && (
                  <><SkeletonLoader /><div style={{ opacity: 0.5, transform: "scale(0.98)" }}><SkeletonLoader /></div></>
                )}

                {/* RESULTS AREA: SINGLE */}
                {!loading && metadata && inputMode !== "batch" && inputMode !== "history" && (
                  <div className="card mt-8 animate-slide-up border-2 border-slate-900 rounded-3xl relative overflow-hidden bg-white solid-shadow-md">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-slate-900"><CheckIcon /></div>
                    <div className="card-body p-6 sm:p-8">
                      <div className="result-block bg-slate-50 border-2 border-slate-100 rounded-xl p-5 relative">
                        <div className="flex justify-between items-center border-b-2 border-slate-200 pb-3 mb-3">
                          <span className="text-xs font-extrabold text-slate-500">{citationStyle === 'footnote' ? 'CATATAN KAKI (FOOTNOTE)' : 'SITASI DALAM TEKS (IN-TEXT)'}</span>
                          <button className="btn-copy-modern border-2 border-slate-200 hover:border-slate-900 font-bold text-xs py-1 px-3 bg-white" onClick={() => handleCopy(citationStyle === 'footnote' ? footnoteResult : buildApaInText(metadata), "single-in")}>
                            {copiedId === "single-in" ? <><span className="text-green-600">✓</span> Disalin</> : <><span className="text-slate-800">Salin</span></>}
                          </button>
                        </div>
                        <div className="result-html p-0 text-slate-800 font-medium" dangerouslySetInnerHTML={{ __html: citationStyle === 'footnote' ? footnoteResult : buildApaInText(metadata) }} />
                      </div>
                      <div className="result-block mt-6 bg-slate-50 border-2 border-slate-100 rounded-xl p-5 relative">
                        <div className="flex justify-between items-center border-b-2 border-slate-200 pb-3 mb-3">
                          <span className="text-xs font-extrabold text-slate-500">{citationStyle === 'footnote' ? 'DAFTAR PUSTAKA' : 'DAFTAR PUSTAKA (APA 7)'}</span>
                          <button className="btn-copy-modern border-2 border-slate-200 hover:border-slate-900 font-bold text-xs py-1 px-3 bg-white" onClick={() => handleCopy(citationStyle === 'footnote' ? dafpusResult : buildApaReference(metadata), "single-dp")}>
                            {copiedId === "single-dp" ? <><span className="text-green-600">✓</span> Disalin</> : <><span className="text-slate-800">Salin</span></>}
                          </button>
                        </div>
                        <div className="result-html p-0 text-slate-800 font-medium" dangerouslySetInnerHTML={{ __html: citationStyle === 'footnote' ? dafpusResult : buildApaReference(metadata) }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* RESULTS AREA: BATCH */}
                {!loading && batchResults.length > 0 && inputMode === "batch" && (
                  <div className="card mt-8 animate-slide-up border-2 border-slate-900 rounded-3xl bg-white solid-shadow-md">
                    <div className="card-body p-6 sm:p-8">
                      {batchSuccesses.length > 0 && (
                        <>
                          <div className="flex items-center justify-between mb-4 border-b-2 border-slate-100 pb-3">
                            <h3 className="text-base font-extrabold m-0 text-slate-900">{citationStyle === 'footnote' ? `Catatan Kaki (${batchSuccesses.length})` : `Sitasi Dalam Teks (${batchSuccesses.length})`}</h3>
                          </div>
                          {batchSuccesses.map((r, index) => {
                            const content = citationStyle === 'footnote' ? buildFootnote(r.meta, kotaInput) : buildApaInText(r.meta);
                            const copyId = `batch-in-${index}`;
                            return (
                              <div className="result-block mb-5 bg-slate-50 border-2 border-slate-100 rounded-xl p-4" key={copyId}>
                                <div className="flex justify-between items-center border-b-2 border-slate-200 pb-2 mb-3">
                                  <span className="truncate font-mono font-bold text-xs text-slate-500">{r.line}</span>
                                  <button className="btn-copy-modern border-2 border-slate-200 hover:border-slate-900 font-bold text-xs py-1 px-3 bg-white" onClick={() => handleCopy(content, copyId)}>
                                    {copiedId === copyId ? <span className="text-green-600">✓</span> : <span className="text-slate-800">Salin</span>}
                                  </button>
                                </div>
                                <div className="result-html p-0 text-sm font-medium text-slate-800" dangerouslySetInnerHTML={{ __html: content }} />
                              </div>
                            );
                          })}
                          
                          <div className="flex items-center justify-between mt-10 mb-4 border-b-2 border-slate-100 pb-3">
                            <h3 className="text-base font-extrabold m-0 text-slate-900">{citationStyle === 'footnote' ? `Daftar Pustaka A-Z (${sortedBatchDafpus.length})` : `Daftar Pustaka APA 7 (${sortedBatchDafpus.length})`}</h3>
                          </div>
                          {sortedBatchDafpus.map((r, index) => {
                            const content = citationStyle === 'footnote' ? buildDafpus(r.meta, kotaInput) : buildApaReference(r.meta);
                            const copyId = `batch-dp-${index}`;
                            return (
                              <div className="result-block mb-5 bg-slate-50 border-2 border-slate-100 rounded-xl p-4" key={copyId}>
                                <div className="flex justify-between items-center border-b-2 border-slate-200 pb-2 mb-3">
                                  <span className="truncate font-mono font-bold text-xs text-slate-500">{r.line}</span>
                                  <button className="btn-copy-modern border-2 border-slate-200 hover:border-slate-900 font-bold text-xs py-1 px-3 bg-white" onClick={() => handleCopy(content, copyId)}>
                                    {copiedId === copyId ? <span className="text-green-600">✓</span> : <span className="text-slate-800">Salin</span>}
                                  </button>
                                </div>
                                <div className="result-html p-0 text-sm font-medium text-slate-800" dangerouslySetInnerHTML={{ __html: content }} />
                              </div>
                            );
                          })}
                        </>
                      )}
                      {batchErrors.length > 0 && (
                        <div className="error-alert mt-8 p-5 bg-red-50 border-2 border-red-500 rounded-xl">
                          <strong className="flex items-center gap-2 mb-3 text-red-600 font-bold"><WarningIcon/> Gagal (Otomatis Di-Refund):</strong>
                          <ul className="m-0 pl-5 text-red-600 font-medium text-sm space-y-2 opacity-90">
                            {batchErrors.map((err, i) => (
                              <li key={i} className="break-all"><span className="font-mono text-xs font-bold mr-2">{err.line}</span><br className="sm:hidden" />{err.error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </main>
        </div>
      )}

      {/* --- CSS STYLING & VARIABLES ISOLATION (ENTERPRISE GRADE) --- */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

        /* ⚠️ FORCE LIGHT MODE ONLY ⚠️ */
        html, body, #root { margin: 0 !important; padding: 0 !important; width: 100%; min-height: 100vh; background-color: var(--bg-body); overflow-x: hidden; scroll-behavior: smooth; }

        .app-wrapper {
          --bg-body: #f8fafc;
          --bg-surface-solid: #ffffff;
          --bg-surface-hover: #f1f5f9;
          --bg-surface-alt: #f8fafc;
          
          --text-main: #0f172a;
          --text-muted: #64748b;
          
          --border-color: #0f172a;
          
          --primary: #0f172a;
          --primary-hover: #1e293b;
          
          --lime: #b4f454;
          --pale-blue: #e0f2fe;
          --pale-yellow: #fef9c3;
          --pale-mint: #dcfce7;
          
          --success: #16a34a;
          --error-bg: #fef2f2;
          --error-text: #dc2626;

          --nav-bg: #ffffff; 
          --skeleton-bg: #e2e8f0;
          --skeleton-hl: #f8fafc;

          --radius-sm: 8px;
          --radius-md: 16px;
          --radius-lg: 24px;
          
          min-height: 100vh;
          background-color: var(--bg-body);
          color: var(--text-main);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        * { box-sizing: border-box; }
        .container { max-width: 960px; margin: 0 auto; padding: 0 1.5rem; }

        /* PATTERN & AMBIENT BACKGROUND GLOW */
        .topo-bg {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; pointer-events: none; opacity: 0.4;
          background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23cbd5e1' fill-opacity='0.5' fill-rule='evenodd'/%3E%3C/svg%3E");
        }
        
        .ambient-background { position: fixed; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; z-index: 0; pointer-events: none; }
        .ambient-blob { position: absolute; filter: blur(100px); opacity: 0.6; border-radius: 50%; animation: floatBlob 25s infinite alternate; }
        .blob-1 { top: -5%; left: -5%; width: 55vw; height: 55vw; background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%); }
        .blob-2 { bottom: -10%; right: -5%; width: 65vw; height: 65vw; background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%); animation-delay: -5s; }
        .blob-3 { top: 40%; left: 60%; width: 45vw; height: 45vw; background: radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%); animation-delay: -12s; }
        @keyframes floatBlob { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(8%, 12%) scale(1.15); } 100% { transform: translate(-8%, -12%) scale(0.9); } }

        /* GLASSMORPHISM & SHADOWS */
        .glass-panel { background: var(--bg-surface-solid); border: 2px solid var(--border-color); border-radius: var(--radius-md); }
        .app-shadow { box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .solid-shadow-sm { box-shadow: 4px 4px 0px var(--border-color); }
        .solid-shadow-md { box-shadow: 6px 6px 0px var(--border-color); }
        .solid-shadow-lg { box-shadow: 8px 8px 0px var(--border-color); }

        /* UTILS */
        .bg-lime { background-color: var(--lime); } .text-lime { color: var(--lime); }
        .bg-pale-blue { background-color: var(--pale-blue); } 
        .bg-pale-yellow { background-color: var(--pale-yellow); }
        .bg-pale-mint { background-color: var(--pale-mint); }
        
        .text-center { text-align: center; } .text-left { text-align: left; }
        .text-gradient { background: linear-gradient(135deg, #0f172a 0%, #475569 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .flex { display: flex; } .items-center { align-items: center; } .items-start { align-items: flex-start; } .justify-between { justify-content: space-between; } .justify-center { justify-content: center; } .flex-col { flex-direction: column; } .flex-1 { flex: 1; } .flex-shrink-0 { flex-shrink: 0; }
        .gap-1 { gap: 0.25rem; } .gap-2 { gap: 0.5rem; } .gap-3 { gap: 0.75rem; } .gap-4 { gap: 1rem; } .gap-5 { gap: 1.25rem; } .gap-6 { gap: 1.5rem; }
        .m-0 { margin: 0; } .mx-auto { margin-left: auto; margin-right: auto; }
        .mt-0 { margin-top: 0; } .mt-1 { margin-top: 0.25rem; } .mt-2 { margin-top: 0.5rem; } .mt-3 { margin-top: 0.75rem; } .mt-4 { margin-top: 1rem; } .mt-6 { margin-top: 1.5rem; } .mt-8 { margin-top: 2rem; } .mt-10 { margin-top: 2.5rem; } .mt-12 { margin-top: 3rem; } .mt-16 { margin-top: 4rem; }
        .mb-1 { margin-bottom: 0.25rem; } .mb-2 { margin-bottom: 0.5rem; } .mb-3 { margin-bottom: 0.75rem; } .mb-4 { margin-bottom: 1rem; } .mb-5 { margin-bottom: 1.25rem; } .mb-6 { margin-bottom: 1.5rem; } .mb-8 { margin-bottom: 2rem; } .mb-12 { margin-bottom: 3rem; }
        .p-1 { padding: 0.25rem; } .p-2 { padding: 0.5rem; } .p-4 { padding: 1rem; } .p-5 { padding: 1.25rem; } .p-6 { padding: 1.5rem; } .p-8 { padding: 2rem; } .p-10 { padding: 2.5rem; }
        .pb-3 { padding-bottom: 0.75rem; } .pb-4 { padding-bottom: 1rem; } .pb-5 { padding-bottom: 1.25rem; } .pb-16 { padding-bottom: 4rem; } .pb-24 { padding-bottom: 6rem; }
        .pt-5 { padding-top: 1.25rem; } .pt-8 { padding-top: 2rem; } .pt-20 { padding-top: 5rem; } .py-16 { padding-top: 4rem; padding-bottom: 4rem; }
        .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; } .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; } .py-0.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; } .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; } .py-1.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; } .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; } .py-3.5 { padding-top: 0.875rem; padding-bottom: 0.875rem; } .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
        .w-full { width: 100%; } .w-max { width: max-content; } .w-auto { width: auto; }
        .block { display: block; } .inline-block { display: inline-block; } .relative { position: relative; } .absolute { position: absolute; } .overflow-hidden { overflow: hidden; }
        .z-0 { z-index: 0; } .z-10 { z-index: 10; } .z-20 { z-index: 20; }
        .opacity-0 { opacity: 0; } .opacity-10 { opacity: 0.1; } .opacity-20 { opacity: 0.2; } .opacity-60 { opacity: 0.6; } .opacity-70 { opacity: 0.7; } .opacity-80 { opacity: 0.8; } .opacity-90 { opacity: 0.9; } .opacity-100 { opacity: 1; }
        .pointer-events-none { pointer-events: none; } .pointer-events-auto { pointer-events: auto; }
        .break-all { word-break: break-all; } .truncate { display: inline-block; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .max-w-sm { max-width: 24rem; } .max-w-md { max-width: 28rem; } .max-w-2xl { max-width: 42rem; } .max-w-3xl { max-width: 48rem; }
        .last-no-border:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
        .transition-colors { transition: background-color 0.2s, color 0.2s; } .transition-opacity { transition: opacity 0.2s; } .transition-all { transition: all 0.2s; } .transition-transform { transition: transform 0.2s; }
        .duration-200 { transition-duration: 0.2s; } .duration-700 { transition-duration: 0.7s; } .duration-1000 { transition-duration: 1s; } .ease-in-out { transition-timing-function: ease-in-out; }
        .scale-95 { transform: scale(0.95); } .scale-100 { transform: scale(1); }
        .h-0 { height: 0; } .h-auto { height: auto; }

        /* FIXED NAVBAR LANDING PAGE */
        .navbar-wrapper {
          position: fixed; top: 1.5rem; z-index: 1000; left: 0; right: 0;
          padding: 0 1.5rem; display: flex; justify-content: center;
          pointer-events: none; 
        }
        .navbar {
          pointer-events: auto; 
          width: 100%; max-width: 800px; 
          background: var(--nav-bg); 
          border: 2px solid var(--border-color); 
          border-radius: 100px;
          padding: 0.6rem 0.6rem 0.6rem 1.5rem; 
          box-shadow: 4px 4px 0px var(--border-color);
        }
        .nav-container { display: flex; justify-content: space-between; align-items: center; }
        .nav-logo { cursor: pointer; display: flex; align-items: center; }
        /* LOGO FIX (TIDAK ADA ASPECT RATIO AGAR PROPORSIONAL) */
        .logo-icon-wrap { height: 36px; width: auto; display: flex; align-items: center; justify-content: flex-start; border-radius: 0; flex-shrink: 0; }
        .footer-logo { height: 64px; justify-content: center; }
        .video-logo-asset { width: auto; height: 100%; display: block; object-fit: contain; }
        
        .nav-actions { display: flex; align-items: center; gap: 0.5rem; }
        .credit-badge {
          display: flex; align-items: center; gap: 6px;
          background: var(--bg-surface-hover); color: var(--text-main);
          padding: 0 14px; height: 40px; border-radius: 50px; font-size: 0.85rem; font-weight: 800;
          cursor: pointer; border: 2px solid var(--border-color); transition: 0.2s; font-family: 'JetBrains Mono', monospace;
        }
        .credit-badge:hover { background: var(--bg-surface-solid); box-shadow: 2px 2px 0px var(--border-color); transform: translateY(-2px); }

        .content-padding-top { padding-top: 100px; }

        /* BUTTONS */
        .btn-primary {
          background: var(--primary); color: #ffffff;
          border: 2px solid var(--border-color); border-radius: 100px; font-weight: 800; font-size: 0.95rem;
          padding: 0.875rem 1.75rem !important; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          letter-spacing: 0.02em; box-shadow: 3px 3px 0px var(--border-color);
        }
        .btn-primary:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 5px 5px 0px var(--border-color); }
        .btn-primary:active:not(:disabled) { transform: translate(1px, 1px); box-shadow: 1px 1px 0px var(--border-color); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; transform: none; }
        
        .btn-secondary {
          background: var(--bg-surface-solid); color: var(--text-main); border: 2px solid var(--border-color);
          border-radius: 100px; font-weight: 800; font-size: 0.85rem;
          padding: 0.6rem 1.25rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: 0.2s; box-shadow: 2px 2px 0px var(--border-color);
        }
        .btn-secondary:hover { background: var(--bg-surface-hover); transform: translate(-1px, -1px); box-shadow: 3px 3px 0px var(--border-color); }
        .btn-secondary:active { transform: translate(1px, 1px); box-shadow: 0px 0px 0px var(--border-color); }
        .btn-sm { height: 40px; padding: 0 1.25rem !important; font-size: 0.85rem; }
        .btn-lg { padding: 1.125rem 2.5rem !important; font-size: 1.05rem; }

        /* HERO SECTION */
        .hero-section { padding: 4rem 0 5rem; }
        .badge-pill { padding: 6px 16px; font-size: 0.8rem; font-weight: 800; background: var(--bg-surface-solid); border: 2px solid var(--border-color); color: var(--text-main); border-radius: 50px; box-shadow: 2px 2px 0px var(--border-color); }
        .pulse-dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; box-shadow: 0 0 0 rgba(34, 197, 94, 0.4); animation: pulseDot 2s infinite; }
        @keyframes pulseDot { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
        
        .hero-title { font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 800; line-height: 1.05; margin: 0; letter-spacing: -0.05em; position: relative; z-index: 10; color: var(--slate-900); }
        .hero-title-line { overflow: hidden; }
        .title-word { display: inline-block; padding-right: 0.2em; }
        .hero-subtitle { font-size: 1.125rem; color: var(--text-muted); line-height: 1.6; max-width: 600px; font-weight: 500; position: relative; z-index: 10; }
        
        /* AVATAR GROUP */
        .avatar-group { display: flex; align-items: center; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--bg-surface-solid); background-color: var(--skeleton-bg); margin-left: -10px; background-size: cover; background-position: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .avatar:nth-child(1) { background-image: url('https://i.pravatar.cc/100?img=1'); margin-left: 0; z-index: 3; }
        .avatar:nth-child(2) { background-image: url('https://i.pravatar.cc/100?img=2'); z-index: 2; }
        .avatar:nth-child(3) { background-image: url('https://i.pravatar.cc/100?img=3'); z-index: 1; }

        .loading-spinner { display: inline-block; width: 16px; height: 16px; border: 3px solid var(--border-color); border-radius: 50%; border-top-color: transparent; animation: spin 0.8s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .preview-section { background: transparent; }

        /* STEPS SECTION */
        .steps-grid { display: flex; justify-content: space-between; align-items: flex-start; max-width: 800px; margin: 0 auto; position: relative; z-index: 2;}
        .step-card { flex: 1; text-align: center; padding: 0 1rem; z-index: 2; position: relative; }
        .step-icon { width: 48px; height: 48px; background: var(--bg-surface-solid); border: 2px solid var(--border-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.25rem; margin: 0 auto 1.25rem; color: var(--primary); box-shadow: 3px 3px 0px var(--border-color); }
        .step-connector { flex: 1; height: 2px; background: var(--border-color); margin-top: 24px; z-index: 1; }

        /* FEATURES SECTION */
        .section-title { font-size: clamp(1.75rem, 3vw, 3rem); font-weight: 800; letter-spacing: -0.04em; position: relative; z-index: 2; color: #0f172a; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; position: relative; z-index: 2;}
        .feature-card { padding: 2.5rem 2rem; text-align: left; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
        .group-hover-effect:hover { transform: translateY(-8px); box-shadow: 8px 8px 0px var(--border-color); }
        .feature-icon-box { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); solid-shadow-sm }
        .group-hover-effect:hover .feature-icon-box { transform: scale(1.1) rotate(-5deg); }

        /* PRICING SECTION */
        .pricing-card { max-width: 480px; padding: 3rem 2.5rem; z-index: 2; box-sizing: border-box;}
        .price-huge { font-size: 4rem; font-weight: 800; display: flex; justify-content: center; align-items: baseline; letter-spacing: -0.05em; gap: 8px; }
        .price-huge .currency { font-size: 1.5rem; letter-spacing: normal; margin-bottom: 0; }
        .price-huge .suffix { font-size: 0.95rem; letter-spacing: normal; white-space: nowrap; font-weight: 600; }
        .pricing-divider { height: 2px; width: 100%; border-top: 2px dashed var(--border-color); margin: 2rem 0; opacity: 0.3; }
        .pricing-list { list-style: none; padding: 0; text-align: left; display: flex; flex-direction: column; gap: 16px; }
        .pricing-list li { font-size: 1rem; display: flex; gap: 14px; align-items: flex-start; color: var(--text-main); font-weight: 500; }
        .icon-wrap { border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; box-shadow: 2px 2px 0px var(--border-color); }
        .icon-wrap svg { width: 14px; height: 14px; stroke-width: 3.5; }

        /* DASHBOARD WORKSPACE */
        .dashboard-layout { display: flex; min-height: 100vh; position: relative; z-index: 10; }
        
        /* SIDEBAR DESKTOP */
        .dashboard-sidebar { 
           width: 280px; background: #ffffff; border-right: 2px solid var(--border-color); 
           display: flex; flex-direction: column; position: fixed; top: 0; bottom: 0; left: 0; z-index: 1000; 
           transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar-header { padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; }
        .sidebar-nav { flex: 1; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; }
        .nav-item { 
           display: flex; align-items: center; gap: 12px; width: 100%; padding: 0.875rem 1rem; border: 2px solid transparent; background: transparent; 
           text-align: left; font-size: 0.95rem; font-weight: 700; color: var(--text-muted); border-radius: 12px; cursor: pointer; transition: 0.2s; font-family: inherit;
        }
        .nav-item:hover { background: var(--bg-surface-hover); color: var(--text-main); }
        .nav-item.active { background: var(--lime); border-color: var(--border-color); color: var(--text-main); box-shadow: 3px 3px 0px var(--border-color); transform: translate(-1px, -1px); }
        
        .sidebar-footer { padding: 1.25rem; }
        .credit-box { padding: 1.25rem; border-radius: 16px; margin-bottom: 1rem; text-align: center; }
        .credit-label { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 0.5rem; }
        .credit-amount { display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 1.75rem; font-weight: 800; margin-bottom: 1rem; }
        .btn-topup { width: 100%; padding: 0.875rem; border-radius: 100px; font-size: 0.85rem; font-weight: 800; cursor: pointer; transition: 0.2s; box-shadow: 3px 3px 0px var(--border-color); }
        .btn-topup:hover { transform: translate(-2px, -2px); box-shadow: 5px 5px 0px var(--border-color); }
        .btn-logout { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0.875rem; background: transparent; border: 2px solid transparent; font-size: 0.9rem; font-weight: 700; cursor: pointer; border-radius: 100px; transition: 0.2s; }

        .dashboard-main { flex: 1; margin-left: 280px; padding: 3rem 2.5rem; min-height: 100vh; }
        .dashboard-container { max-width: 800px; margin: 0 auto; }
        
        /* CITATION STYLE TOGGLE */
        .style-toggle-btn { background: transparent; border: 2px solid transparent; padding: 8px 16px; font-size: 0.85rem; font-weight: 800; color: var(--text-muted); border-radius: 8px; cursor: pointer; transition: 0.2s; font-family: inherit; display: flex; align-items: center; gap: 6px; }
        .style-toggle-btn:hover:not(.active) { color: var(--text-main); }
        .style-toggle-btn.active { background: #ffffff; color: var(--text-main); border-color: var(--border-color); box-shadow: 2px 2px 0px var(--border-color); }

        /* FORMS MODERN */
        .input-label { display: block; font-size: 0.85rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.02em; }
        .input-field-modern { width: 100%; padding: 1rem 1.25rem; font-size: 0.95rem; font-weight: 600; color: var(--text-main); background: #ffffff; border-radius: 12px; outline: none; transition: all 0.2s; font-family: inherit; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
        .input-field-modern::placeholder { color: #94a3b8; font-weight: 500; }
        .textarea-field { min-height: 140px; resize: vertical; line-height: 1.6; }

        /* RESULTS AREA & HISTORY */
        .result-block { overflow: hidden; }
        .result-html { padding: 1.25rem 0 0 0; font-size: 0.95rem; line-height: 1.7; word-break: break-word; color: var(--text-main); }
        .btn-copy-modern { cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: 0.2s; font-family: inherit; border-radius: 8px; font-weight: 800;}
        .btn-copy-modern:hover { transform: translate(-1px, -1px); box-shadow: 2px 2px 0px var(--border-color); }
        
        .history-container { max-height: 600px; overflow-y: auto; }
        
        /* CUSTOM SCROLLBAR */
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; border: 2px solid #ffffff; }

        /* MODALS & ALERTS */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 1050; padding: 1rem; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
        .modal-box { background: var(--bg-surface-solid); width: 100%; max-width: 420px; border-radius: var(--radius-lg); border: 2px solid var(--border-color); box-shadow: 8px 8px 0px var(--border-color); overflow: hidden; }
        .modal-header { padding: 1.5rem; border-bottom: 2px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
        .modal-body { padding: 1.5rem; }
        .btn-close-modal { background: var(--bg-surface-hover); border: 2px solid var(--border-color); color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 50%; transition: 0.2s; box-shadow: 2px 2px 0px var(--border-color); }
        .btn-close-modal:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0px var(--border-color); }
        .grid-packages { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
        .btn-package { background: var(--bg-surface-hover); border: 2px solid var(--border-color); border-radius: 12px; padding: 1rem 0.5rem; font-weight: 800; color: var(--text-muted); font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease; text-align: center; box-shadow: 2px 2px 0px var(--border-color); }
        .btn-package:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0px var(--border-color); color: var(--text-main); }
        .btn-package.active { background: var(--lime); color: var(--text-main); transform: translate(1px, 1px); box-shadow: 0px 0px 0px var(--border-color); }
        .price-tag { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem; background: var(--bg-surface-hover); border-radius: 12px; border: 2px solid var(--border-color); }
        .notification-toast { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: var(--text-main); color: var(--bg-surface-solid); padding: 1rem 1.5rem; border-radius: 100px; font-weight: 700; font-size: 0.9rem; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 2px solid var(--border-color); }
        
        /* TRUE SHIMMER SKELETON */
        .skeleton-line { height: 16px; background: linear-gradient(90deg, var(--skeleton-bg) 25%, var(--skeleton-hl) 50%, var(--skeleton-bg) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
        .skeleton-box { background: linear-gradient(90deg, var(--skeleton-bg) 25%, var(--skeleton-hl) 50%, var(--skeleton-bg) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-sm); width: 100%; }
        .w-40 { width: 10rem; } .w-48 { width: 12rem; } .h-24 { height: 6rem; } .h-20 { height: 5rem; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        /* FOOTER */
        .footer { padding: 4rem 0 2rem; text-align: center; margin-top: auto; }
        .footer-link { color: var(--text-muted); text-decoration: none; transition: 0.2s; }
        .footer-link:hover { color: var(--text-main); text-decoration: underline; }

        /* ANIMATIONS */
        .animate-fade-in { animation: fadeIn 0.3s ease forwards; }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up-fade { animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUpFade { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }

        /* MOBILE RESPONSIVE ADJUSTMENTS */
        @media (max-width: 768px) {
          .dashboard-main { margin-left: 0; padding: 1.5rem 1rem; padding-top: 6rem; }
          .dashboard-sidebar { transform: translateX(-100%); width: 300px; box-shadow: 10px 0 30px rgba(0,0,0,0.1); }
          .dashboard-sidebar.open { transform: translateX(0); }
          .mobile-dashboard-header { display: flex; justify-content: space-between; align-items: center; position: fixed; top: 0; left: 0; right: 0; height: 70px; background: #ffffff; z-index: 900; padding: 0 1.5rem; border-bottom: 2px solid var(--border-color); }
          .mobile-menu-btn { background: transparent; border: none; color: var(--text-main); padding: 4px; margin-left: -4px; cursor: pointer; }
          .sidebar-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.4); z-index: 950; backdrop-filter: blur(2px); }
          .mobile-close { background: var(--bg-surface-hover); border: none; padding: 6px; border-radius: 50%; color: var(--text-main); cursor: pointer; }
          
          .hidden-mobile { display: none !important; }
          .grid-2 { grid-template-columns: 1fr; } .col-span-2 { grid-column: span 1; }
          .preview-body { grid-template-columns: 1fr; padding: 1.5rem; } .border-r { border-right: none; border-bottom: 2px solid var(--border-color); padding-bottom: 1.5rem; padding-right: 0; } .pl-2 { padding-left: 0; }
          
          /* Landing Page Navbar Mobile Fix */
          .navbar { padding: 0.6rem 0.6rem 0.6rem 1.25rem; border-radius: 100px; }
          .nav-container { padding: 0; }
          .logo-icon-wrap { height: 28px; } 
          .footer-logo { height: 40px; }
          .btn-primary.btn-sm { font-size: 0.8rem; padding: 0 1.25rem !important; height: 36px; border-radius: 100px; }
          
          .pricing-card { padding: 2.5rem 1.5rem; margin: 0; width: 100%; border-radius: var(--radius-lg); border-left: 2px solid var(--border-color); border-right: 2px solid var(--border-color); box-sizing: border-box; }
          .price-huge { font-size: 3rem; flex-wrap: wrap; text-align: center; }
          .price-huge .suffix { white-space: normal; width: 100%; margin-top: 4px; font-size: 0.9rem; }
          .hero-title { font-size: clamp(2.5rem, 8vw, 3rem); }
          .style-toggle-btn { flex: 1; justify-content: center; }
          .flex-col-mobile { flex-direction: column; align-items: flex-start; }
          .steps-grid { flex-direction: column; gap: 1.5rem; }
        }
      `}</style>
    </div>
  );
}

