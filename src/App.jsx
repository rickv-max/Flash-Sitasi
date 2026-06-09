import React, { useState, useEffect, useRef } from "react";
import gsap from "https://esm.sh/gsap"; // GANTI INI: import gsap from "gsap";
import { ScrollTrigger } from "https://esm.sh/gsap/ScrollTrigger"; // GANTI INI: import { ScrollTrigger } from "gsap/ScrollTrigger";
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
    <div className="mock-workspace neu-flat rounded-2xl mx-auto max-w-3xl overflow-hidden relative z-20">
      <div className="preview-header px-6 py-4 flex items-center gap-3">
         <div className="flex gap-3">
            <span className="w-3 h-3 rounded-full neu-pressed"></span>
            <span className="w-3 h-3 rounded-full neu-pressed"></span>
            <span className="w-3 h-3 rounded-full neu-pressed"></span>
         </div>
         <span className="text-xs font-bold text-muted font-mono ml-4">demo_ruang_kerja.app</span>
      </div>

      <div className="p-6 sm:p-8 relative z-10">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-neu-divider">
          <div>
            <h3 className="text-base font-extrabold text-main m-0">Format Sitasi</h3>
            <p className="text-xs font-semibold text-muted mt-1 m-0 hidden sm:block">Pilih gaya output</p>
          </div>
          <div className="style-toggle neu-pressed pointer-events-none p-1.5 flex gap-2 rounded-xl">
            <button className="neu-button text-primary px-4 py-2 text-xs active">📝 Footnote</button>
            <button className="text-muted font-bold px-4 py-2 text-xs">📑 APA 7</button>
          </div>
        </div>

        <div className="form-group mb-8">
          <label className="input-label text-xs font-extrabold mb-3 block uppercase tracking-wider text-muted">Nomor DOI Referensi</label>
          <div className="neu-pressed px-5 min-h-[56px] flex items-center rounded-xl">
            <span className="text-main font-bold">{typedText}</span>
            {step >= 2 && step < 4 && <span className="mock-caret"></span>}
            {!typedText && step <= 1 && <span className="text-muted opacity-60 text-sm font-medium">Contoh: 10.1038/s41586...</span>}
          </div>
        </div>

        <button className={`neu-button w-full py-4 text-sm uppercase tracking-wide font-extrabold text-primary ${step >= 4 ? 'active' : ''}`}>
          {step === 5 ? (
            <span className="flex items-center gap-2 justify-center text-primary"><span className="loading-spinner w-4 h-4 border-primary"></span> Mengekstrak...</span>
          ) : "Generate Sitasi (1 Kredit)"}
        </button>

        {/* RESULTS MOCK */}
        <div className={`mock-results-area grid grid-cols-1 sm:grid-cols-2 gap-6 transition-all duration-1000 ease-in-out ${step >= 6 ? 'opacity-100 max-h-[800px] mt-8' : 'opacity-0 max-h-0 mt-0 pointer-events-none'}`}>
          <div className="result-block neu-pressed rounded-xl p-5 relative">
            <div className="flex justify-between items-center border-b border-neu-divider pb-3 mb-4">
              <span className="text-xs font-extrabold text-muted">CATATAN KAKI</span>
              <button className={`neu-button text-xs py-1.5 px-4 font-bold text-primary ${step === 8 ? 'active' : ''}`}>
                {step > 8 ? <><span className="text-success text-xs font-black mr-1">✓</span> Disalin</> : "Salin"}
              </button>
            </div>
            <p className="text-sm m-0 leading-relaxed text-main font-medium">
              Smith, J. (2020) <i>The Architecture of Modern SaaS</i>. Nature. London, hal. 10-15. https://doi.org/10.1038/s41586-020-2649-2
            </p>
          </div>
          <div className="result-block neu-pressed rounded-xl p-5 relative">
            <div className="flex justify-between items-center border-b border-neu-divider pb-3 mb-4">
              <span className="text-xs font-extrabold text-muted">APA 7TH EDITION</span>
              <button className="neu-button text-xs py-1.5 px-4 font-bold text-primary">Salin</button>
            </div>
            <p className="text-sm m-0 leading-relaxed text-main font-medium">
              Smith, J. (2020). The Architecture of Modern SaaS. <i>Nature</i>, 10-15. https://doi.org/10.1038/s41586-020-2649-2
            </p>
          </div>
        </div>
      </div>

      {/* FAKE CURSOR */}
      <div className={`fake-cursor cursor-step-${step}`}>
        <svg width="28" height="34" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.98402 1.54516L9.61053 28.0267C9.91974 29.0999 11.4554 29.1558 11.8152 28.1069L14.7336 19.6146L22.2573 15.656C23.1979 15.1611 23.0116 13.7661 21.9686 13.4925L2.57022 0.354145C1.61111 -0.290886 0.536968 0.697424 1.98402 1.54516Z" fill="#1e293b" stroke="#e0e5ec" strokeWidth="2.5"/>
        </svg>
      </div>

      <style>{`
        .mock-caret { display: inline-block; width: 2px; height: 18px; background: var(--primary); margin-left: 4px; animation: blink 1s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        
        .fake-cursor { position: absolute; z-index: 50; transition: all 0.7s cubic-bezier(0.25, 1, 0.5, 1); pointer-events: none; filter: drop-shadow(4px 4px 8px rgba(163,177,198,0.5)); }
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
          .fromTo(".hero-badge", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.5)" }, "-=0.4")
          .fromTo(".title-word", { opacity: 0, y: 30, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, stagger: 0.08, ease: "power3.out" }, "-=0.3")
          .fromTo(".hero-subtitle", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "-=0.4")
          .fromTo(".hero-cta", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.5)" }, "-=0.4");

        gsap.fromTo(".preview-card-anim", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".preview-section", start: "top 85%" } });
        gsap.fromTo(".step-card-anim", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, stagger: 0.15, ease: "power2.out", scrollTrigger: { trigger: ".steps-section", start: "top 80%" } });
        gsap.fromTo(".feature-card-anim", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: "power2.out", scrollTrigger: { trigger: ".features-section", start: "top 80%" } });
        gsap.fromTo(".pricing-card-anim", { opacity: 0, scale: 0.9, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: "back.out(1.2)", scrollTrigger: { trigger: ".pricing-section", start: "top 85%" } });
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
  const VideoLogo = () => (<video src="/logo.mp4" autoPlay loop muted playsInline className="video-logo-asset" style={{ mixBlendMode: 'multiply' }} />);
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
    <div className="mt-6 neu-flat rounded-2xl">
      <div className="p-6"><div className="skeleton-line w-40 mb-6"></div><div className="skeleton-box h-24 mb-6"></div><div className="skeleton-line w-48 mb-6"></div><div className="skeleton-box h-20"></div></div>
    </div>
  );

  return (
    <div className="app-wrapper" ref={appRef}>
      {!firebaseConfig.apiKey && (
        <div className="env-warning">⚠️ Peringatan: Konfigurasi API Key di file .env belum diset.</div>
      )}

      {notification && (<div className="notification-toast animate-slide-up-fade">{notification}</div>)}

      {showTopupModal && (
        <div className="modal-overlay">
          <div className="modal-box animate-scale-in neu-flat">
            <div className="modal-header">
              <h3 className="m-0 flex items-center gap-2 text-lg font-extrabold text-main"><CoinIcon /> Top Up Kredit</h3>
              <button className="btn-close-modal neu-button" onClick={() => setShowTopupModal(false)}><CloseIcon /></button>
            </div>
            <div className="modal-body">
              <p className="text-muted mb-6 mt-0 text-sm leading-relaxed">Kredit Anda habis. Harga per 1 sitasi sukses hanya Rp 750.</p>
              <div className="grid-packages mb-5">
                {[50, 75, 100, 125].map((amt) => (
                  <button key={amt} className={`neu-button py-3 text-sm font-bold ${topupAmount === amt ? "active text-primary" : "text-muted"}`} onClick={() => setTopupAmount(amt)}>{amt} Kredit</button>
                ))}
              </div>
              <div className="form-group">
                <label className="input-label">Nomor Custom:</label>
                <input type="number" min="1" className="input-field-modern neu-pressed" value={topupAmount} onChange={(e) => setTopupAmount(parseInt(e.target.value) || 0)} />
              </div>
              <div className="price-tag mt-6 neu-pressed p-4 rounded-xl flex justify-between items-center">
                <span className="text-muted font-bold text-sm">Total:</span>
                <span className="font-black text-xl text-primary">Rp {(topupAmount * 750).toLocaleString("id-ID")}</span>
              </div>
              <button className="neu-button w-full mt-8 py-4 text-primary font-extrabold" onClick={processPayment} disabled={isPaying}>
                {isPaying ? "Menghubungkan..." : "Bayar via Bayar.gg"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LANDING PAGE NAVBAR --- */}
      {currentView === "landing" && (
        <div className="navbar-wrapper">
          <nav className="navbar neu-flat rounded-full">
            <div className="nav-container">
              <div className="nav-logo" onClick={() => { setCurrentView("landing"); window.scrollTo(0, 0); }}>
                <div className="logo-icon-wrap"><VideoLogo /></div>
              </div>
              <div className="nav-actions">
                {!user ? (
                  <button onClick={handleLoginAndEnter} className="neu-button px-6 py-2.5 text-sm font-bold text-primary" disabled={loading}>
                    {loading ? "Menghubungkan..." : "Buka Ruang Kerja"}
                  </button>
                ) : (
                  <button onClick={handleLoginAndEnter} className="neu-button px-6 py-2.5 text-sm font-bold text-primary">Buka Ruang Kerja</button>
                )}
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* --- VIEW 1: LANDING PAGE --- */}
      {currentView === "landing" && (
        <main className="main-content z-10 relative content-padding-top" ref={landingRef}>

          {/* Hero Section */}
          <section id="hero" className="hero-section relative">

            <div className="container text-center relative z-10">
              <div className="hero-badge neu-flat mx-auto mb-8 px-5 py-2 rounded-full flex items-center gap-2 w-max text-sm font-bold text-muted">
                <span className="pulse-dot"></span> Tools Sitasi Jurnal Otomatis
              </div>
              
              <h1 className="hero-title" style={{ perspective: "1000px" }}>
                <div className="hero-title-line">
                  <span className="title-word inline-block">Ekstrak</span> <span className="title-word inline-block">Referensi</span> <span className="title-word inline-block">Jurnal</span>
                </div>
                <div className="hero-title-line">
                  <span className="text-primary title-word inline-block">Dalam</span> <span className="text-primary title-word inline-block">Hitungan</span> <span className="text-primary title-word inline-block">Detik.</span>
                </div>
              </h1>
              
              <p className="hero-subtitle mx-auto mt-6 text-muted">
                Berhenti menyusun daftar pustaka secara manual. Sistem mengekstrak metadata
                dari PDF, DOI, Academia, ResearchGate, dan OJS secara instan dengan presisi tinggi.
              </p>
              
              <div className="hero-cta mt-12">
                <button onClick={handleLoginAndEnter} className="neu-button px-8 py-4 text-base font-extrabold text-primary" disabled={loading}>
                  {loading ? "Memuat Workspace..." : "Mulai Gratis Sekarang"}
                </button>
                <div className="hero-trusted mt-8 flex items-center justify-center gap-3">
                  <div className="avatar-group flex"><div className="avatar"></div><div className="avatar"></div><div className="avatar"></div></div>
                  <p className="text-xs text-muted font-bold m-0">Dipercaya oleh Mahasiswa & Akademisi</p>
                </div>
              </div>
            </div>
          </section>

          {/* Animated Mock Workspace (Hero Showcase) */}
          <section className="preview-section mt-16 pb-24 relative z-20">
            <div className="container preview-card-anim">
               <AnimatedWorkspaceMock />
            </div>
          </section>

          {/* How It Works Section */}
          <section className="steps-section py-20 relative z-10">
             <div className="container">
                <h2 className="section-title text-center mb-4">Tiga Langkah Mudah</h2>
                <p className="text-muted font-medium text-center max-w-md mx-auto mb-16">Otomatisasi referensi Anda dalam hitungan detik. Tanpa format manual yang membingungkan.</p>
                
                <div className="flex flex-col gap-8 max-w-3xl mx-auto">
                   <div className="step-card-anim flex items-center p-6 neu-flat rounded-3xl">
                      <div className="step-number neu-pressed rounded-full w-14 h-14 flex items-center justify-center font-black text-xl mr-6 flex-shrink-0 text-primary">1</div>
                      <div className="text-left">
                        <h4 className="font-extrabold text-main text-lg mb-1">Salin Tautan</h4>
                        <p className="text-sm text-muted font-medium">Dapatkan tautan (URL) atau nomor DOI dari jurnal/artikel yang ingin disitasi.</p>
                      </div>
                   </div>
                   <div className="step-card-anim flex items-center p-6 neu-flat rounded-3xl">
                      <div className="step-number neu-pressed rounded-full w-14 h-14 flex items-center justify-center font-black text-xl mr-6 flex-shrink-0 text-primary">2</div>
                      <div className="text-left">
                        <h4 className="font-extrabold text-main text-lg mb-1">Sistem Memproses</h4>
                        <p className="text-sm text-muted font-medium">Tempelkan tautan ke dalam sistem kami, lalu klik tombol Generate.</p>
                      </div>
                   </div>
                   <div className="step-card-anim flex items-center p-6 neu-flat rounded-3xl">
                      <div className="step-number neu-pressed rounded-full w-14 h-14 flex items-center justify-center font-black text-xl mr-6 flex-shrink-0 text-primary">3</div>
                      <div className="text-left">
                        <h4 className="font-extrabold text-main text-lg mb-1">Sitasi Selesai</h4>
                        <p className="text-sm text-muted font-medium">Salin hasil Footnote & Daftar Pustaka (APA 7) yang sudah terformat rapi.</p>
                      </div>
                   </div>
                </div>
             </div>
          </section>

          {/* Features Detail */}
          <section id="features" className="features-section pt-16 pb-20 relative z-10">
            <div className="container text-center">
              <h2 className="section-title mb-16">Dibangun untuk Kecepatan & Presisi</h2>
              <div className="grid-3">
                <div className="feature-card-anim feature-card neu-flat rounded-3xl">
                  <div className="feature-icon-box text-primary neu-pressed"><ShieldIcon /></div>
                  <h3 className="text-lg font-extrabold text-main">Anti-Cloudflare Bypass</h3>
                  <p className="text-muted font-medium mt-3 text-sm leading-relaxed">Mengekstrak data secara otomatis meski web sumber diproteksi sistem keamanan Cloudflare.</p>
                </div>
                <div className="feature-card-anim feature-card neu-flat rounded-3xl">
                  <div className="feature-icon-box text-primary neu-pressed"><SparklesIcon /></div>
                  <h3 className="text-lg font-extrabold text-main">Smart Metadata Recovery</h3>
                  <p className="text-muted font-medium mt-3 text-sm leading-relaxed">Jika struktur PDF berantakan, sistem akan melacak metadata yang tepat dari database global.</p>
                </div>
                <div className="feature-card-anim feature-card neu-flat rounded-3xl">
                  <div className="feature-icon-box text-primary neu-pressed"><ZapIcon /></div>
                  <h3 className="text-lg font-extrabold text-main">Pemrosesan Batch</h3>
                  <p className="text-muted font-medium mt-3 text-sm leading-relaxed">Punya puluhan referensi? Tempelkan semua URL sekaligus dan dapatkan daftar urut abjad seketika.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Pricing & Transparency */}
          <section className="pricing-section pb-32 relative z-10">
            <div className="container text-center">
              <div className="pricing-card-anim pricing-card neu-flat rounded-3xl mx-auto relative overflow-hidden">
                <div className="badge-pill mx-auto mb-6 neu-pressed px-4 py-1.5 rounded-full font-bold text-xs text-primary w-max">Paling Diminati</div>
                <h2 className="m-0 mb-4 text-3xl font-black text-main tracking-tight">Transparan. Pay-As-You-Go.</h2>
                <p className="text-muted font-medium m-0 mb-10 text-sm max-w-sm mx-auto">Tanpa langganan bulanan. Anda hanya membayar apa yang Anda gunakan.</p>
                
                <div className="price-huge text-main mb-8"><span className="currency font-bold">Rp</span>750<span className="suffix font-bold text-muted">/ Sitasi Sukses</span></div>
                
                <ul className="pricing-list mx-auto max-w-sm">
                  <li><div className="icon-wrap neu-pressed text-primary"><CheckIcon /></div><span className="text-main font-semibold">Gratis 5 Kredit untuk pengguna baru.</span></li>
                  <li><div className="icon-wrap neu-pressed text-primary"><CheckIcon /></div><span className="text-main font-semibold">Kredit <strong>TIDAK HANGUS</strong> jika ekstraksi gagal.</span></li>
                  <li><div className="icon-wrap neu-pressed text-primary"><CheckIcon /></div><span className="text-main font-semibold">Mendukung format Footnote & APA 7.</span></li>
                  <li><div className="icon-wrap neu-pressed text-primary"><CheckIcon /></div><span className="text-main font-semibold">Dukungan QRIS, e-Wallet, & VA.</span></li>
                </ul>
                <button onClick={handleLoginAndEnter} className="neu-button w-full flex justify-center items-center gap-3 py-4 mt-10 text-base font-extrabold text-primary">
                  Mulai Ruang Kerja Anda <ArrowRightIcon />
                </button>
              </div>
            </div>
          </section>

          <footer className="footer relative z-20">
            <div className="container footer-content py-8">
              <div className="footer-brand flex flex-col items-center justify-center mb-6">
                <div className="logo-icon-wrap footer-logo"><VideoLogo /></div>
              </div>
              <p className="mt-4 text-sm max-w-md mx-auto text-muted font-medium leading-relaxed">
                Automasi sitasi akademik pintar untuk penulisan karya ilmiah instan. Desain eksklusif. Performa maksimal.
              </p>
              <div className="mt-10 text-xs font-bold text-muted flex flex-wrap justify-center gap-6 uppercase tracking-wider">
                 <span>© {new Date().getFullYear()} FlashCite.</span>
                 <a href="#" className="footer-link">Kebijakan Privasi</a>
                 <a href="#" className="footer-link">Syarat & Ketentuan</a>
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* --- VIEW 2: WORKSPACE (DASHBOARD) --- */}
      {currentView === "tool" && user && (
        <div className="dashboard-layout animate-fade-in">
           {/* Mobile Header */}
           <div className="mobile-dashboard-header hidden sm:hidden neu-flat">
              <button onClick={() => setIsSidebarOpen(true)} className="mobile-menu-btn text-main"><MenuIcon /></button>
              <div className="logo-icon-wrap" style={{ height: '24px', width: 'auto' }}><VideoLogo /></div>
           </div>

           {/* Mobile Sidebar Overlay */}
           {isSidebarOpen && <div className="sidebar-overlay sm:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

           {/* Sidebar */}
           <aside className={`dashboard-sidebar neu-flat ${isSidebarOpen ? 'open' : ''}`}>
              <div className="sidebar-header pb-6 mb-2 border-b border-neu-divider">
                 <div className="logo-icon-wrap h-8"><VideoLogo /></div>
                 <button className="mobile-close sm:hidden neu-button" onClick={() => setIsSidebarOpen(false)}><CloseIcon /></button>
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

              <div className="sidebar-footer pt-6 border-t border-neu-divider">
                 <div className="credit-box neu-pressed p-5 rounded-2xl mb-6">
                    <p className="credit-label text-muted">Sisa Token</p>
                    <div className="credit-amount text-main font-black text-2xl mb-4"><CoinIcon /> <span>{userData.credits || 0}</span></div>
                    <button onClick={() => setShowTopupModal(true)} className="neu-button w-full py-3 text-sm text-primary font-bold">Top Up Token</button>
                 </div>
                 <button onClick={handleLogout} className="btn-logout w-full flex justify-center items-center gap-2 py-3 text-sm font-bold text-muted transition-colors hover:text-error">
                    <LogoutIcon /> Keluar Ruang Kerja
                 </button>
              </div>
           </aside>

           {/* Main Workspace Content */}
           <main className="dashboard-main">
              <div className="dashboard-container">
                <div className="tool-header mb-10 text-center sm:text-left">
                  <h2 className="section-title m-0 tracking-tight text-main">Ruang Kerja</h2>
                  <p className="text-muted text-sm mt-2 font-medium">Sistem ekstraksi metadata aktif. Masukkan referensi Anda.</p>
                </div>

                <div className="card neu-flat rounded-3xl mb-10 relative z-20">
                  <div className="card-body p-6 sm:p-10">
                    {/* TOGGLE CITATION STYLE */}
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-neu-divider flex-col-mobile">
                       <div className="mb-6 sm:mb-0 text-center sm:text-left">
                         <h3 className="text-base font-extrabold text-main m-0">Format Sitasi</h3>
                         <p className="text-xs text-muted mt-1 font-semibold m-0">Pilih gaya output yang dihasilkan</p>
                       </div>
                       <div className="style-toggle neu-pressed rounded-xl p-1.5 w-full sm:w-auto flex gap-2">
                          <button className={`neu-button w-full sm:w-auto px-5 py-2.5 text-sm font-bold ${citationStyle === "footnote" ? "active text-primary" : "text-muted shadow-none"}`} onClick={() => setCitationStyle("footnote")}>📝 Footnote</button>
                          <button className={`neu-button w-full sm:w-auto px-5 py-2.5 text-sm font-bold ${citationStyle === "apa7" ? "active text-primary" : "text-muted shadow-none"}`} onClick={() => setCitationStyle("apa7")}>📑 APA 7</button>
                       </div>
                    </div>

                    {inputMode === "doi" && (
                      <div className="animate-fade-in">
                        <div className="form-group mb-6 relative">
                          <label className="input-label">Nomor DOI Referensi</label>
                          <input type="text" className="input-field-modern neu-pressed" value={doiInput} onChange={(e) => setDoiInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchDOI()} placeholder="Contoh: 10.1038/s41586..." />
                        </div>
                        {citationStyle === "footnote" && (
                          <div className="form-group mb-10 relative animate-fade-in">
                            <label className="input-label">Kota Terbit <span className="opacity-60 font-medium">(Opsional)</span></label>
                            <input type="text" className="input-field-modern neu-pressed" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Masukkan kota terbit jurnal" />
                          </div>
                        )}
                        <button className="neu-button w-full py-4 text-base font-extrabold text-primary" onClick={fetchDOI} disabled={loading || !doiInput}>
                          {loading ? "Mengeksekusi Proses..." : "Generate Sitasi (1 Token)"}
                        </button>
                      </div>
                    )}

                    {inputMode === "url" && (
                      <div className="animate-fade-in">
                        <div className="form-group mb-6 relative">
                          <label className="input-label">Tautan Artikel / PDF</label>
                          <input type="text" className="input-field-modern neu-pressed" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchURL()} placeholder="Paste link Academia, ResearchGate, OJS, dll" />
                        </div>
                        {citationStyle === "footnote" && (
                          <div className="form-group mb-10 relative animate-fade-in">
                            <label className="input-label">Kota Terbit <span className="opacity-60 font-medium">(Opsional)</span></label>
                            <input type="text" className="input-field-modern neu-pressed" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Masukkan kota terbit jurnal" />
                          </div>
                        )}
                        <button className="neu-button w-full py-4 text-base font-extrabold text-primary" onClick={fetchURL} disabled={loading || !urlInput}>
                          {loading ? "Menganalisis Tautan..." : "Generate Sitasi (1 Token)"}
                        </button>
                      </div>
                    )}

                    {inputMode === "manual" && (
                      <div className="animate-fade-in">
                        <div className="grid-2 gap-6">
                          <div className="col-span-2 form-group"><label className="input-label">Nama Penulis Lengkap *</label><input type="text" className="input-field-modern neu-pressed" value={mAuthor} onChange={(e) => setMAuthor(e.target.value)} placeholder="John Doe, Jane Smith" /></div>
                          <div className="col-span-2 form-group"><label className="input-label">Judul Artikel *</label><input type="text" className="input-field-modern neu-pressed" value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="Masukkan judul artikel" /></div>
                          <div className="form-group"><label className="input-label">Nama Jurnal</label><input type="text" className="input-field-modern neu-pressed" value={mJournal} onChange={(e) => setMJournal(e.target.value)} placeholder="Jurnal Internasional" /></div>
                          <div className="form-group"><label className="input-label">Tahun Terbit *</label><input type="text" className="input-field-modern neu-pressed" value={mYear} onChange={(e) => setMYear(e.target.value)} placeholder="2024" /></div>
                          <div className="form-group"><label className="input-label">Volume</label><input type="text" className="input-field-modern neu-pressed" value={mVolume} onChange={(e) => setMVolume(e.target.value)} placeholder="Misal: 5" /></div>
                          <div className="form-group"><label className="input-label">Isu / Nomor</label><input type="text" className="input-field-modern neu-pressed" value={mIssue} onChange={(e) => setMIssue(e.target.value)} placeholder="Misal: 2" /></div>
                          <div className="form-group"><label className="input-label">Halaman</label><input type="text" className="input-field-modern neu-pressed" value={mPage} onChange={(e) => setMPage(e.target.value)} placeholder="Misal: 10-25" /></div>
                          {citationStyle === "footnote" && (
                            <div className="form-group animate-fade-in"><label className="input-label">Kota Terbit</label><input type="text" className="input-field-modern neu-pressed" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Jakarta" /></div>
                          )}
                        </div>
                        <button className="neu-button w-full mt-10 py-4 text-base font-extrabold text-primary" onClick={handleGenerateManual}>Generate Manual (1 Token)</button>
                      </div>
                    )}

                    {inputMode === "batch" && (
                      <div className="animate-fade-in">
                        <div className="form-group mb-6"><label className="input-label">Daftar Link / DOI</label><textarea className="input-field-modern textarea-field neu-pressed" value={batchInput} onChange={(e) => setBatchInput(e.target.value)} placeholder="Paste banyak URL atau DOI di sini&#10;1 Baris = 1 Link/DOI&#10;Maksimal disarankan: 20 baris per proses" /></div>
                        {citationStyle === "footnote" && (
                          <div className="form-group mb-10 animate-fade-in"><label className="input-label">Kota Terbit Global <span className="opacity-60 font-medium">(Opsional)</span></label><input type="text" className="input-field-modern neu-pressed" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Diaplikasikan ke semua referensi" /></div>
                        )}
                        <button className="neu-button w-full py-4 text-base font-extrabold text-primary" onClick={handleBatchGenerate} disabled={loading || !batchInput}>
                          {loading ? "Memproses Batch..." : "Generate Semua (1 Token/Sukses)"}
                        </button>
                      </div>
                    )}

                    {/* TAB HISTORY */}
                    {inputMode === "history" && (
                      <div className="animate-fade-in history-container custom-scrollbar pr-3">
                        {history.length === 0 ? (
                          <div className="text-center text-muted font-bold p-12 flex flex-col items-center">
                            <span className="text-5xl mb-4 opacity-40">🗂️</span> Ruang riwayat Anda masih kosong.
                          </div>
                        ) : (
                          history.map((item) => {
                            const inTextToCopy = citationStyle === "footnote" ? item.footnote : (item.apaInText || "Data APA 7 belum tersedia.");
                            const refToCopy = citationStyle === "footnote" ? item.dafpus : (item.apaRef || "Data APA 7 belum tersedia.");
                            return (
                              <div key={item.id} className="history-item mb-6 pb-6 border-b border-neu-divider last-no-border">
                                <div className="flex justify-between items-center mb-4">
                                  <span className="neu-pressed font-bold text-xs px-3 py-1 rounded-full text-muted">{item.type}</span>
                                  <span className="text-xs font-mono font-bold text-muted">{new Date(item.timestamp).toLocaleString("id-ID")}</span>
                                </div>
                                <h4 className="m-0 mb-5 font-extrabold text-sm leading-snug truncate-2 text-main">{item.title}</h4>
                                <div className="flex gap-4 flex-col-mobile">
                                  <button className="neu-button text-xs py-2.5 flex-1 font-bold text-muted hover:text-primary" onClick={() => handleCopy(inTextToCopy, `hist-in-${item.id}`)}>
                                    {copiedId === `hist-in-${item.id}` ? <><span className="text-success mr-1">✓</span> Disalin</> : <><CopyIcon /> {citationStyle === 'footnote' ? 'Footnote' : 'In-Text'}</>}
                                  </button>
                                  <button className="neu-button text-xs py-2.5 flex-1 font-bold text-muted hover:text-primary" onClick={() => handleCopy(refToCopy, `hist-dp-${item.id}`)}>
                                    {copiedId === `hist-dp-${item.id}` ? <><span className="text-success mr-1">✓</span> Disalin</> : <><CopyIcon /> {citationStyle === 'footnote' ? 'Dafpus' : 'APA 7'}</>}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {error && (
                      <div className="error-alert mt-8 p-5 neu-pressed rounded-xl flex items-start">
                        <div className="mt-0.5 text-error"><WarningIcon /></div> 
                        <span className="leading-relaxed font-bold text-error ml-3">{error}</span>
                      </div>
                    )}
                  </div>
                </div>

                {loading && inputMode !== "batch" && <SkeletonLoader />}
                {loading && inputMode === "batch" && (
                  <><SkeletonLoader /><div className="opacity-50 scale-95 origin-top"><SkeletonLoader /></div></>
                )}

                {/* RESULTS AREA: SINGLE */}
                {!loading && metadata && inputMode !== "batch" && inputMode !== "history" && (
                  <div className="card mt-10 animate-slide-up neu-flat rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-5 opacity-10 pointer-events-none text-main"><CheckIcon /></div>
                    <div className="card-body p-6 sm:p-10">
                      <div className="result-block neu-pressed rounded-2xl p-6 relative">
                        <div className="flex justify-between items-center border-b border-neu-divider pb-4 mb-4">
                          <span className="text-xs font-extrabold text-muted">{citationStyle === 'footnote' ? 'CATATAN KAKI (FOOTNOTE)' : 'SITASI DALAM TEKS (IN-TEXT)'}</span>
                          <button className="neu-button font-bold text-xs py-2 px-4 text-primary" onClick={() => handleCopy(citationStyle === 'footnote' ? footnoteResult : buildApaInText(metadata), "single-in")}>
                            {copiedId === "single-in" ? <><span className="text-success font-black mr-1">✓</span> Disalin</> : "Salin"}
                          </button>
                        </div>
                        <div className="result-html text-main font-medium leading-loose" dangerouslySetInnerHTML={{ __html: citationStyle === 'footnote' ? footnoteResult : buildApaInText(metadata) }} />
                      </div>
                      
                      <div className="result-block mt-8 neu-pressed rounded-2xl p-6 relative">
                        <div className="flex justify-between items-center border-b border-neu-divider pb-4 mb-4">
                          <span className="text-xs font-extrabold text-muted">{citationStyle === 'footnote' ? 'DAFTAR PUSTAKA' : 'DAFTAR PUSTAKA (APA 7)'}</span>
                          <button className="neu-button font-bold text-xs py-2 px-4 text-primary" onClick={() => handleCopy(citationStyle === 'footnote' ? dafpusResult : buildApaReference(metadata), "single-dp")}>
                            {copiedId === "single-dp" ? <><span className="text-success font-black mr-1">✓</span> Disalin</> : "Salin"}
                          </button>
                        </div>
                        <div className="result-html text-main font-medium leading-loose" dangerouslySetInnerHTML={{ __html: citationStyle === 'footnote' ? dafpusResult : buildApaReference(metadata) }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* RESULTS AREA: BATCH */}
                {!loading && batchResults.length > 0 && inputMode === "batch" && (
                  <div className="card mt-10 animate-slide-up neu-flat rounded-3xl">
                    <div className="card-body p-6 sm:p-10">
                      {batchSuccesses.length > 0 && (
                        <>
                          <div className="flex items-center justify-between mb-6 pb-4 border-b border-neu-divider">
                            <h3 className="text-lg font-extrabold m-0 text-main">{citationStyle === 'footnote' ? `Catatan Kaki (${batchSuccesses.length})` : `Sitasi Dalam Teks (${batchSuccesses.length})`}</h3>
                          </div>
                          {batchSuccesses.map((r, index) => {
                            const content = citationStyle === 'footnote' ? buildFootnote(r.meta, kotaInput) : buildApaInText(r.meta);
                            const copyId = `batch-in-${index}`;
                            return (
                              <div className="result-block mb-6 neu-pressed rounded-2xl p-5" key={copyId}>
                                <div className="flex justify-between items-center border-b border-neu-divider pb-3 mb-4">
                                  <span className="truncate font-mono font-bold text-xs text-muted">{r.line}</span>
                                  <button className="neu-button font-bold text-xs py-1.5 px-4 text-primary" onClick={() => handleCopy(content, copyId)}>
                                    {copiedId === copyId ? <span className="text-success font-black">✓</span> : "Salin"}
                                  </button>
                                </div>
                                <div className="result-html text-sm font-medium text-main leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />
                              </div>
                            );
                          })}
                          
                          <div className="flex items-center justify-between mt-12 mb-6 pb-4 border-b border-neu-divider">
                            <h3 className="text-lg font-extrabold m-0 text-main">{citationStyle === 'footnote' ? `Daftar Pustaka A-Z (${sortedBatchDafpus.length})` : `Daftar Pustaka APA 7 (${sortedBatchDafpus.length})`}</h3>
                          </div>
                          {sortedBatchDafpus.map((r, index) => {
                            const content = citationStyle === 'footnote' ? buildDafpus(r.meta, kotaInput) : buildApaReference(r.meta);
                            const copyId = `batch-dp-${index}`;
                            return (
                              <div className="result-block mb-6 neu-pressed rounded-2xl p-5" key={copyId}>
                                <div className="flex justify-between items-center border-b border-neu-divider pb-3 mb-4">
                                  <span className="truncate font-mono font-bold text-xs text-muted">{r.line}</span>
                                  <button className="neu-button font-bold text-xs py-1.5 px-4 text-primary" onClick={() => handleCopy(content, copyId)}>
                                    {copiedId === copyId ? <span className="text-success font-black">✓</span> : "Salin"}
                                  </button>
                                </div>
                                <div className="result-html text-sm font-medium text-main leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />
                              </div>
                            );
                          })}
                        </>
                      )}
                      {batchErrors.length > 0 && (
                        <div className="error-alert mt-8 p-6 neu-pressed rounded-2xl">
                          <strong className="flex items-center gap-2 mb-4 text-error font-extrabold"><WarningIcon/> Gagal (Otomatis Di-Refund):</strong>
                          <ul className="m-0 pl-6 text-error font-medium text-sm space-y-3 opacity-90">
                            {batchErrors.map((err, i) => (
                              <li key={i} className="break-all"><span className="font-mono text-xs font-bold mr-2 opacity-70">{err.line}</span><br className="sm:hidden" />{err.error}</li>
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

      {/* --- CSS STYLING & VARIABLES ISOLATION (NEUMORPHISM) --- */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

        /* ⚠️ FORCE LIGHT MODE ONLY ⚠️ */
        html, body, #root { margin: 0 !important; padding: 0 !important; width: 100%; min-height: 100vh; background-color: var(--bg-body); overflow-x: hidden; scroll-behavior: smooth; }

        .app-wrapper {
          /* Neumorphism Core Palette */
          --bg-body: #ecf0f3;
          --neu-light: #ffffff;
          --neu-dark: #d1d9e6;
          --neu-divider: rgba(209, 217, 230, 0.5);
          
          --text-main: #2d3748;
          --text-muted: #718096;
          
          --primary: #3b82f6; /* Soft Blue CTA */
          --success: #10b981;
          --error: #ef4444;

          --radius-sm: 12px;
          --radius-md: 20px;
          --radius-lg: 30px;
          
          min-height: 100vh;
          background-color: var(--bg-body);
          color: var(--text-main);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* NEUMORPHISM UTILITY CLASSES */
        .neu-flat {
          background: var(--bg-body);
          box-shadow: 10px 10px 20px var(--neu-dark), -10px -10px 20px var(--neu-light);
        }
        
        .neu-pressed {
          background: var(--bg-body);
          box-shadow: inset 6px 6px 12px var(--neu-dark), inset -6px -6px 12px var(--neu-light);
        }
        
        .neu-button {
          background: var(--bg-body);
          box-shadow: 6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light);
          border: none;
          outline: none;
          transition: all 0.2s ease-in-out;
          cursor: pointer;
        }
        
        .neu-button:hover:not(:disabled) {
          box-shadow: 4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light);
        }
        
        .neu-button:active:not(:disabled), .neu-button.active {
          box-shadow: inset 4px 4px 8px var(--neu-dark), inset -4px -4px 8px var(--neu-light);
        }
        
        .neu-button:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: 2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light); }

        * { box-sizing: border-box; }
        .container { max-width: 960px; margin: 0 auto; padding: 0 1.5rem; }

        /* UTILS */
        .text-center { text-align: center; } .text-left { text-align: left; }
        .text-gradient { background: linear-gradient(135deg, var(--text-main) 0%, var(--text-muted) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .flex { display: flex; } .items-center { align-items: center; } .items-start { align-items: flex-start; } .justify-between { justify-content: space-between; } .justify-center { justify-content: center; } .flex-col { flex-direction: column; } .flex-1 { flex: 1; } .flex-shrink-0 { flex-shrink: 0; }
        .gap-1 { gap: 0.25rem; } .gap-2 { gap: 0.5rem; } .gap-3 { gap: 0.75rem; } .gap-4 { gap: 1rem; } .gap-5 { gap: 1.25rem; } .gap-6 { gap: 1.5rem; }
        .m-0 { margin: 0; } .mx-auto { margin-left: auto; margin-right: auto; }
        .mt-0 { margin-top: 0; } .mt-1 { margin-top: 0.25rem; } .mt-2 { margin-top: 0.5rem; } .mt-3 { margin-top: 0.75rem; } .mt-4 { margin-top: 1rem; } .mt-6 { margin-top: 1.5rem; } .mt-8 { margin-top: 2rem; } .mt-10 { margin-top: 2.5rem; } .mt-12 { margin-top: 3rem; } .mt-16 { margin-top: 4rem; }
        .mb-1 { margin-bottom: 0.25rem; } .mb-2 { margin-bottom: 0.5rem; } .mb-3 { margin-bottom: 0.75rem; } .mb-4 { margin-bottom: 1rem; } .mb-5 { margin-bottom: 1.25rem; } .mb-6 { margin-bottom: 1.5rem; } .mb-8 { margin-bottom: 2rem; } .mb-10 { margin-bottom: 2.5rem; } .mb-12 { margin-bottom: 3rem; } .mb-16 { margin-bottom: 4rem; }
        .p-1 { padding: 0.25rem; } .p-1\.5 { padding: 0.375rem; } .p-2 { padding: 0.5rem; } .p-4 { padding: 1rem; } .p-5 { padding: 1.25rem; } .p-6 { padding: 1.5rem; } .p-8 { padding: 2rem; } .p-10 { padding: 2.5rem; } .p-12 { padding: 3rem; }
        .pb-3 { padding-bottom: 0.75rem; } .pb-4 { padding-bottom: 1rem; } .pb-5 { padding-bottom: 1.25rem; } .pb-6 { padding-bottom: 1.5rem; } .pb-16 { padding-bottom: 4rem; } .pb-24 { padding-bottom: 6rem; } .pb-32 { padding-bottom: 8rem; }
        .pt-5 { padding-top: 1.25rem; } .pt-6 { padding-top: 1.5rem; } .pt-8 { padding-top: 2rem; } .pt-16 { padding-top: 4rem; } .pt-20 { padding-top: 5rem; } .py-1\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; } .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; } .py-2\.5 { padding-top: 0.625rem; padding-bottom: 0.625rem; } .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; } .py-4 { padding-top: 1rem; padding-bottom: 1rem; } .py-16 { padding-top: 4rem; padding-bottom: 4rem; } .py-20 { padding-top: 5rem; padding-bottom: 5rem; }
        .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; } .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; } .px-4 { padding-left: 1rem; padding-right: 1rem; } .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; } .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; } .px-8 { padding-left: 2rem; padding-right: 2rem; }
        .w-full { width: 100%; } .w-max { width: max-content; } .w-auto { width: auto; }
        .border-b { border-bottom: 1px solid var(--neu-divider); } .border-t { border-top: 1px solid var(--neu-divider); } .border-y { border-top: 1px solid var(--neu-divider); border-bottom: 1px solid var(--neu-divider); }
        .border-r { border-right: 1px solid var(--neu-divider); }
        .border-none { border: none; } .rounded-md { border-radius: 6px; } .rounded-xl { border-radius: 12px; } .rounded-2xl { border-radius: 16px; } .rounded-3xl { border-radius: 24px; } .rounded-full { border-radius: 9999px; }
        .text-sm { font-size: 0.875rem; } .text-xs { font-size: 0.75rem; } .text-base { font-size: 1rem; } .text-lg { font-size: 1.125rem; } .text-xl { font-size: 1.25rem; } .text-2xl { font-size: 1.5rem; } .text-3xl { font-size: 1.875rem; } .text-4xl { font-size: 2.25rem; } .text-5xl { font-size: 3rem; }
        .text-main { color: var(--text-main); } .text-muted { color: var(--text-muted); } .text-primary { color: var(--primary); } .text-success { color: var(--success); } .text-error { color: var(--error); }
        .font-normal { font-weight: 400; } .font-medium { font-weight: 500; } .font-semibold { font-weight: 600; } .font-bold { font-weight: 700; } .font-extrabold { font-weight: 800; } .font-black { font-weight: 900; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .uppercase { text-transform: uppercase; } .tracking-wide { letter-spacing: 0.05em; } .tracking-wider { letter-spacing: 0.1em; } .tracking-tight { letter-spacing: -0.025em; }
        .leading-snug { line-height: 1.375; } .leading-relaxed { line-height: 1.625; } .leading-loose { line-height: 2; }
        .block { display: block; } .inline-block { display: inline-block; } .relative { position: relative; } .absolute { position: absolute; } .overflow-hidden { overflow: hidden; }
        .z-0 { z-index: 0; } .z-10 { z-index: 10; } .z-20 { z-index: 20; }
        .opacity-0 { opacity: 0; } .opacity-10 { opacity: 0.1; } .opacity-20 { opacity: 0.2; } .opacity-40 { opacity: 0.4; } .opacity-60 { opacity: 0.6; } .opacity-70 { opacity: 0.7; } .opacity-80 { opacity: 0.8; } .opacity-90 { opacity: 0.9; } .opacity-100 { opacity: 1; }
        .pointer-events-none { pointer-events: none; } .pointer-events-auto { pointer-events: auto; }
        .break-all { word-break: break-all; } .truncate { display: inline-block; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .max-w-sm { max-width: 24rem; } .max-w-md { max-width: 28rem; } .max-w-2xl { max-width: 42rem; } .max-w-3xl { max-width: 48rem; }
        .last-no-border:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
        .transition-colors { transition: background-color 0.2s, color 0.2s; } .transition-opacity { transition: opacity 0.2s; } .transition-all { transition: all 0.2s; } .transition-transform { transition: transform 0.2s; }
        .duration-200 { transition-duration: 0.2s; } .duration-700 { transition-duration: 0.7s; } .duration-1000 { transition-duration: 1s; } .ease-in-out { transition-timing-function: ease-in-out; }
        .scale-95 { transform: scale(0.95); } .scale-100 { transform: scale(1); }
        .h-0 { height: 0; } .h-auto { height: auto; } .min-h-\[56px\] { min-height: 56px; }

        /* FIXED NAVBAR LANDING PAGE */
        .navbar-wrapper {
          position: fixed; top: 1.5rem; z-index: 1000; left: 0; right: 0;
          padding: 0 1.5rem; display: flex; justify-content: center;
          pointer-events: none; 
        }
        .navbar {
          pointer-events: auto; 
          width: 100%; max-width: 800px; 
          padding: 0.6rem 0.6rem 0.6rem 1.5rem; 
        }
        .nav-container { display: flex; justify-content: space-between; align-items: center; }
        .nav-logo { cursor: pointer; display: flex; align-items: center; }
        .logo-icon-wrap { height: 36px; width: auto; display: flex; align-items: center; justify-content: flex-start; border-radius: 0; flex-shrink: 0; }
        .footer-logo { height: 64px; justify-content: center; margin-bottom: 1rem; }
        /* Mix Blend Mode Multiply agar background video putih menyatu dengan background abu Neumorphism */
        .video-logo-asset { width: auto; height: 100%; display: block; object-fit: contain; mix-blend-mode: multiply; }
        
        .nav-actions { display: flex; align-items: center; gap: 0.5rem; }

        .content-padding-top { padding-top: 100px; }

        /* HERO SECTION */
        .hero-section { padding: 4rem 0 5rem; }
        .hero-title { font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 900; line-height: 1.1; margin: 0; letter-spacing: -0.05em; position: relative; z-index: 10; color: var(--text-main); }
        .hero-title-line { overflow: hidden; }
        .title-word { display: inline-block; padding-right: 0.2em; }
        .hero-subtitle { font-size: 1.125rem; color: var(--text-muted); line-height: 1.6; max-width: 600px; font-weight: 500; position: relative; z-index: 10; }
        
        /* AVATAR GROUP */
        .avatar-group { display: flex; align-items: center; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--bg-body); background-color: var(--skeleton-bg); margin-left: -10px; background-size: cover; background-position: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .avatar:nth-child(1) { background-image: url('https://i.pravatar.cc/100?img=1'); margin-left: 0; z-index: 3; }
        .avatar:nth-child(2) { background-image: url('https://i.pravatar.cc/100?img=2'); z-index: 2; }
        .avatar:nth-child(3) { background-image: url('https://i.pravatar.cc/100?img=3'); z-index: 1; }

        .loading-spinner { display: inline-block; width: 16px; height: 16px; border: 3px solid var(--neu-dark); border-radius: 50%; border-top-color: var(--primary); animation: spin 0.8s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        /* STEPS SECTION */
        .steps-grid { display: flex; justify-content: space-between; align-items: flex-start; max-width: 800px; margin: 0 auto; position: relative; z-index: 2;}
        .step-card { flex: 1; text-align: center; padding: 0 1rem; z-index: 2; position: relative; }
        .step-icon { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.5rem; margin: 0 auto 1.25rem; color: var(--primary); }
        .step-connector { flex: 1; height: 2px; background: var(--neu-dark); margin-top: 28px; z-index: 1; opacity: 0.5; }

        /* FEATURES SECTION */
        .section-title { font-size: clamp(1.75rem, 3vw, 3rem); font-weight: 900; letter-spacing: -0.04em; position: relative; z-index: 2; color: var(--text-main); }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 2rem; position: relative; z-index: 2;}
        .feature-card { padding: 2.5rem 2rem; text-align: left; }
        .feature-icon-box { width: 64px; height: 64px; border-radius: 100px; display: flex; align-items: center; justify-content: center; margin-bottom: 2rem; }

        /* PRICING SECTION */
        .pricing-card { max-width: 480px; padding: 3rem 2.5rem; z-index: 2; box-sizing: border-box;}
        .price-huge { font-size: 4rem; font-weight: 900; display: flex; justify-content: center; align-items: baseline; letter-spacing: -0.05em; gap: 8px; color: var(--primary); }
        .price-huge .currency { font-size: 1.5rem; letter-spacing: normal; margin-bottom: 0; color: var(--text-main); }
        .price-huge .suffix { font-size: 0.95rem; letter-spacing: normal; white-space: nowrap; font-weight: 600; color: var(--text-muted); }
        .pricing-divider { height: 2px; width: 100%; border-top: 2px dashed var(--neu-dark); margin: 2.5rem 0; opacity: 0.5; }
        .pricing-list { list-style: none; padding: 0; text-align: left; display: flex; flex-direction: column; gap: 20px; }
        .pricing-list li { font-size: 1rem; display: flex; gap: 16px; align-items: flex-start; color: var(--text-main); font-weight: 600; }
        .icon-wrap { border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .icon-wrap svg { width: 14px; height: 14px; stroke-width: 3.5; }

        /* DASHBOARD WORKSPACE */
        .dashboard-layout { display: flex; min-height: 100vh; position: relative; z-index: 10; background: var(--bg-body); }
        
        /* SIDEBAR DESKTOP */
        .dashboard-sidebar { 
           width: 280px;
           display: flex; flex-direction: column; position: fixed; top: 0; bottom: 0; left: 0; z-index: 1000; 
           transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar-header { padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        .sidebar-nav { flex: 1; padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; }
        .nav-item { 
           display: flex; align-items: center; gap: 14px; width: 100%; padding: 1rem 1.25rem;
           text-align: left; font-size: 0.95rem; font-weight: 700; color: var(--text-muted); 
        }
        .nav-item:hover { color: var(--text-main); }
        
        .sidebar-footer { padding: 1.5rem; }
        .credit-box { padding: 1.5rem; border-radius: 20px; margin-bottom: 1.5rem; text-align: center; }
        .credit-label { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 0.75rem; color: var(--text-muted); }
        .credit-amount { display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 2rem; font-weight: 900; margin-bottom: 1.25rem; color: var(--primary); }

        .dashboard-main { flex: 1; margin-left: 280px; padding: 3rem 2.5rem; min-height: 100vh; }
        .dashboard-container { max-width: 800px; margin: 0 auto; }

        /* FORMS MODERN */
        .input-label { display: block; font-size: 0.85rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .input-field-modern { width: 100%; padding: 1.25rem 1.5rem; font-size: 1rem; font-weight: 700; color: var(--text-main); border: none; outline: none; transition: all 0.2s; font-family: inherit; border-radius: 16px; }
        .input-field-modern::placeholder { color: var(--neu-dark); font-weight: 600; }
        .textarea-field { min-height: 140px; resize: vertical; line-height: 1.6; }

        /* HISTORY */
        .history-container { max-height: 600px; overflow-y: auto; padding-right: 1rem; }
        
        /* CUSTOM SCROLLBAR */
        .custom-scrollbar::-webkit-scrollbar { width: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: var(--bg-body); border-radius: 10px; box-shadow: inset 4px 4px 8px var(--neu-dark), inset -4px -4px 8px var(--neu-light); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--neu-dark); border-radius: 10px; border: 2px solid var(--bg-body); }

        /* MODALS & ALERTS */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(224,229,236,0.8); display: flex; align-items: center; justify-content: center; z-index: 1050; padding: 1rem; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
        .modal-box { width: 100%; max-width: 420px; border-radius: var(--radius-lg); overflow: hidden; }
        .modal-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--neu-divider); display: flex; justify-content: space-between; align-items: center; }
        .modal-body { padding: 2rem; }
        .grid-packages { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }

        /* TRUE SHIMMER SKELETON */
        .skeleton-line { height: 16px; background: linear-gradient(90deg, var(--neu-dark) 25%, var(--neu-light) 50%, var(--neu-dark) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; opacity: 0.5; }
        .skeleton-box { background: linear-gradient(90deg, var(--neu-dark) 25%, var(--neu-light) 50%, var(--neu-dark) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-sm); width: 100%; opacity: 0.5; }
        .w-40 { width: 10rem; } .w-48 { width: 12rem; } .h-24 { height: 6rem; } .h-20 { height: 5rem; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        /* FOOTER */
        .footer { padding: 4rem 0 2rem; text-align: center; margin-top: auto; border-top: 1px solid var(--neu-divider); }
        .footer-link { color: var(--text-muted); text-decoration: none; transition: 0.2s; }
        .footer-link:hover { color: var(--text-main); }

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
          .dashboard-sidebar { transform: translateX(-100%); width: 300px; box-shadow: 20px 0 40px rgba(163,177,198,0.3); }
          .dashboard-sidebar.open { transform: translateX(0); }
          .mobile-dashboard-header { display: flex; justify-content: space-between; align-items: center; position: fixed; top: 0; left: 0; right: 0; height: 70px; z-index: 900; padding: 0 1.5rem; }
          .mobile-menu-btn { background: transparent; border: none; color: var(--text-main); padding: 4px; margin-left: -4px; cursor: pointer; }
          .sidebar-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(224,229,236,0.6); z-index: 950; backdrop-filter: blur(4px); }
          
          .hidden-mobile { display: none !important; }
          .grid-2 { grid-template-columns: 1fr; } .col-span-2 { grid-column: span 1; }
          .preview-body { grid-template-columns: 1fr; padding: 1.5rem; } .border-r { border-right: none; border-bottom: 1px solid var(--neu-divider); padding-bottom: 1.5rem; padding-right: 0; } .pl-2 { padding-left: 0; }
          
          /* Landing Page Navbar Mobile Fix */
          .navbar { padding: 0.6rem 0.6rem 0.6rem 1.25rem; border-radius: 100px; }
          .nav-container { padding: 0; }
          .logo-icon-wrap { height: 28px; } 
          .footer-logo { height: 40px; }
          .btn-primary.btn-sm { font-size: 0.8rem; padding: 0 1.25rem !important; height: 36px; border-radius: 100px; }
          
          .pricing-card { padding: 2.5rem 1.5rem; margin: 0; width: 100%; border-radius: var(--radius-lg); box-sizing: border-box; }
          .price-huge { font-size: 3rem; flex-wrap: wrap; text-align: center; }
          .price-huge .suffix { white-space: normal; width: 100%; margin-top: 4px; font-size: 0.9rem; }
          .hero-title { font-size: clamp(2.5rem, 8vw, 3rem); }
          .flex-col-mobile { flex-direction: column; align-items: flex-start; }
          .steps-grid { flex-direction: column; gap: 2rem; }
        }
      `}</style>
    </div>
  );
}

