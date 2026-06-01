import React, { useState, useEffect, useRef } from "react";
import gsap from "https://esm.sh/gsap";
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

// ============================================================================
// ⚠️ ENVIRONMENT VARIABLES CONFIGURATION (VITE READY)
// ============================================================================

// Bypass "empty-import-meta" warning in preview environments while keeping Vite compatibility
const env = (import.meta && import.meta.env) || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const BAYAR_GG_API_KEY = env.VITE_BAYAR_GG_API_KEY;

// Initialize Firebase (Safeguard untuk environment lokal yang belum diisi env)
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
// MAIN APPLICATION COMPONENT
// ============================================================================

export default function App() {
  // App Routing & Theme
  const [currentView, setCurrentView] = useState("landing");
  const landingRef = useRef(null);

  // User & Credit State
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({ credits: 0 });
  const [history, setHistory] = useState([]);

  // Payment State
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState(50); // Default 50 credits
  const [isPaying, setIsPaying] = useState(false);

  // Mode State (Tabs & Style)
  const [inputMode, setInputMode] = useState("doi");
  const [citationStyle, setCitationStyle] = useState("footnote"); // "footnote" | "apa7"

  // Form States
  const [doiInput, setDoiInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [kotaInput, setKotaInput] = useState("");

  // Manual States
  const [mAuthor, setMAuthor] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [mJournal, setMJournal] = useState("");
  const [mYear, setMYear] = useState("");
  const [mVolume, setMVolume] = useState("");
  const [mIssue, setMIssue] = useState("");
  const [mPage, setMPage] = useState("");
  const [mPublisher, setMPublisher] = useState("");

  // App Output States
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
    if (currentView === "landing" && landingRef.current) {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline();
        
        // Staggered Animation Sequence
        tl.fromTo(".hero-badge", { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.8, ease: "back.out(1.5)" })
          .fromTo(".hero-title-line", { opacity: 0, y: 40, rotationX: -15 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.8, stagger: 0.15, ease: "power3.out" }, "-=0.4")
          .fromTo(".hero-subtitle", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "-=0.4")
          .fromTo(".hero-cta", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.5)" }, "-=0.4")
          .fromTo(".preview-card-anim", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, "-=0.2")
          .fromTo(".feature-card-anim", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power2.out" }, "-=0.4")
          .fromTo(".pricing-card-anim", { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }, "-=0.2");
      }, landingRef);

      return () => ctx.revert(); // Cleanup GSAP saat berpindah halaman
    }
  }, [currentView]);

  useEffect(() => {
    setError("");
    setMetadata(null);
    setBatchResults([]);
    setFootnoteResult("");
    setDafpusResult("");
    setCopiedId(null);
  }, [inputMode]);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  // --- FIREBASE AUTH & REALTIME DATA ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const profileRef = doc(db, "users", user.uid);
    const unsubProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) setUserData(docSnap.data());
    });

    const historyRef = collection(db, "users", user.uid, "history");
    const unsubHistory = onSnapshot(historyRef, (snapshot) => {
      const histData = [];
      snapshot.forEach((doc) => histData.push({ id: doc.id, ...doc.data() }));
      histData.sort((a, b) => b.timestamp - a.timestamp);
      setHistory(histData);
    });

    return () => {
      unsubProfile();
      unsubHistory();
    };
  }, [user]);

  // --- AUTH HANDLERS ---
  const handleLoginAndEnter = async () => {
    if (user) {
      setCurrentView("tool");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!auth) {
      showNotification(
        "Error: Konfigurasi API Key di .env belum diset dengan benar.",
      );
      return;
    }

    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const loggedUser = result.user;

      const profileRef = doc(db, "users", loggedUser.uid);
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          credits: 5,
          createdAt: Date.now(),
          email: loggedUser.email,
          name: loggedUser.displayName,
        });

        showNotification("Selamat datang! Anda mendapatkan 5 Kredit gratis.");
      } else {
        const existingData = profileSnap.data();

        if (
          existingData.credits === undefined ||
          existingData.credits === null
        ) {
          await updateDoc(profileRef, {
            credits: 5,
          });

          showNotification("Bonus 5 Kredit berhasil ditambahkan.");
        }
      }

      setCurrentView("tool");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError("Login via Google dibatalkan atau gagal.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    setCurrentView("landing");
  };

  // --- PAYMENT HANDLER (BAYAR.GG INTEGRATION) ---
  const processPayment = async () => {
    if (topupAmount < 1) {
      return showNotification("Minimal pembelian 1 kredit.");
    }

    setIsPaying(true);

    const price = topupAmount * 750;

    try {
      const response = await fetch("/api/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: price,
          description: `Top Up ${topupAmount} Kredit FlashCite`,
          customer_name: user.displayName || "Pengguna FlashCite",
          customer_email: user.email || "",
          payment_method: "qris",
          redirect_url: window.location.href,
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.payment_url) {
        window.location.href = data.data.payment_url;
      } else {
        throw new Error(data.message || "Gagal membuat pembayaran");
      }
    } catch (err) {
      console.warn("Bayar.gg error:", err);
      showNotification(err.message || "Error payment.");
    } finally {
      setIsPaying(false);
    }
  };

  // --- CREDIT & HISTORY HELPERS ---
  const deductCredit = async (amount = 1) => {
    if (!user || !db) return false;

    const currentCredits = userData.credits || 0;

    if (currentCredits < amount) {
      setShowTopupModal(true);
      return false;
    }

    const profileRef = doc(db, "users", user.uid);

    await updateDoc(profileRef, {
      credits: increment(-amount),
    });

    return true;
  };

  const refundCredit = async (amount = 1) => {
    if (!user || !db) return;

    const profileRef = doc(db, "users", user.uid);

    await updateDoc(profileRef, {
      credits: increment(amount),
    });
  };

  const saveToHistory = async (meta, fn, dp, apaIn, apaRf, inputVal, type) => {
    if (!user || !db) return;

    const historyRef = collection(db, "users", user.uid, "history");

    await addDoc(historyRef, {
      type,
      input: inputVal,
      title: meta.title,
      footnote: fn,
      dafpus: dp,
      apaInText: apaIn,
      apaRef: apaRf,
      timestamp: Date.now(),
    });
  };

  // --- DATA PARSING & SCRAPING ENGINE ---
  const cleanDOI = (input) =>
    input.trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "");
  const capitalize = (str) => {
    if (!str || typeof str !== "string") return "";
    return str
      .toLowerCase()
      .replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
  };
  const extractDoiFromUrl = (url) => {
    const match = url.match(/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
    return match ? match[1].replace(/\.pdf$/i, "") : null;
  };

  const normalizeUrl = (url) => {
    let u = url.trim();
    const acaMatch =
      u.match(/academia\.edu\/download\/(\d+)/i) ||
      u.match(/academia\.edu\/(\d+)/i);
    if (acaMatch) return `https://www.academia.edu/${acaMatch[1]}`;
    const ojsMatch = u.match(
      /^(.*\/article\/(?:view|download|viewFile)\/\d+)(?:\/.*)?$/i,
    );
    if (ojsMatch) return ojsMatch[1].replace(/\/(download|viewFile)/i, "/view");
    const rgMatch = u.match(/researchgate\.net\/.*publication\/(\d+)/i);
    if (rgMatch)
      return `https://www.researchgate.net/publication/${rgMatch[1]}`;
    return u;
  };

  const formatAuthorsFootnote = (authors) => {
    if (!authors || !authors.length) return "Penulis Tidak Diketahui";
    let given = authors[0].given || "",
      family = authors[0].family || "";
    if (!given && family.includes(" ")) {
      const parts = family.split(" ").filter(Boolean);
      if (parts.length > 1) {
        family = parts.pop();
        given = parts.join(" ");
      }
    }
    family = capitalize(family);
    given = capitalize(given);
    const firstAuthor = given ? `${given} ${family}`.trim() : family.trim();
    if (authors.length > 1) return `${firstAuthor} <i>et al.</i>`;
    return firstAuthor;
  };

  const formatAuthorsDafpus = (authors) => {
    if (!authors || !authors.length) return "Penulis Tidak Diketahui";
    let given = authors[0].given || "",
      family = authors[0].family || "";
    if (!given && family.includes(" ")) {
      const parts = family.split(" ").filter(Boolean);
      if (parts.length > 1) {
        family = parts.pop();
        given = parts.join(" ");
      }
    }
    family = capitalize(family);
    given = capitalize(given);
    let firstAuthor = given ? `${family}, ${given}` : family;
    if (authors.length > 1) return `${firstAuthor} <i>et al.</i>`;
    return firstAuthor;
  };

  const formatFromSS = (paper) => {
    const year = paper.year?.toString() || "Tahun";
    const title = paper.title || "Judul Artikel";
    const journal = paper.venue || paper.journal?.name || "Nama Jurnal";
    let fn = "Penulis Tidak Diketahui",
      dp = "Penulis Tidak Diketahui";
    if (paper.authors && paper.authors.length > 0) {
      let firstAuthor = paper.authors[0].name.trim();
      const parts = firstAuthor.split(" ").filter(Boolean);
      let family = "",
        given = "";
      if (parts.length === 1) {
        family = parts[0];
        given = "";
      } else {
        family = parts.pop();
        given = parts.join(" ");
      }
      fn = given
        ? `${capitalize(given)} ${capitalize(family)}`
        : capitalize(family);
      dp = given
        ? `${capitalize(family)}, ${capitalize(given)}`
        : capitalize(family);
      if (paper.authors.length > 1) {
        fn += " <i>et al.</i>";
        dp += " <i>et al.</i>";
      }
    }
    return {
      authorFootnote: fn,
      authorDafpus: dp,
      year,
      month: "",
      title,
      journal,
      page: "",
      volume: "",
      issue: "",
      publisher: "",
      kotaScraped: "",
      doiUrl: "",
    };
  };

  const searchByTitleAI = async (rawTitle) => {
    const cleanTitle = rawTitle
      .replace(
        /(\s*[-|]\s*Academia\.edu|\s*[-|]\s*ResearchGate|\s*[-|]\s*Google Scholar|\.pdf)/gi,
        "",
      )
      .trim();
    if (cleanTitle.length < 10) return null;
    try {
      const ssRes = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleanTitle)}&limit=1&fields=title,authors,year,venue,journal`,
      );
      if (ssRes.ok) {
        const ssData = await ssRes.json();
        if (ssData.data?.[0]?.authors?.length > 0)
          return formatFromSS(ssData.data[0]);
      }
      const crRes = await fetch(
        `https://api.crossref.org/works?query.title=${encodeURIComponent(cleanTitle)}&rows=1`,
      );
      if (crRes.ok) {
        const crData = await crRes.json();
        if (crData.message.items.length > 0) {
          const item = crData.message.items[0];
          const itemTitle = (item.title?.[0] || "").toLowerCase();
          const searchWords = cleanTitle
            .toLowerCase()
            .split(" ")
            .filter((w) => w.length > 4);
          const matches = searchWords.filter((w) => itemTitle.includes(w));
          if (matches.length >= Math.min(2, searchWords.length)) {
            const yearObj = item["published-print"] || item.issued;
            const year =
              yearObj && yearObj["date-parts"]
                ? yearObj["date-parts"][0][0]
                : "Tahun";
            return {
              authorFootnote: formatAuthorsFootnote(item.author),
              authorDafpus: formatAuthorsDafpus(item.author),
              year: year.toString(),
              month: "",
              title: item.title?.[0] ?? "Judul Artikel",
              journal: item["container-title"]?.[0] ?? "Nama Jurnal",
              page: item.page || "",
              volume: item.volume || "",
              issue: item.issue || "",
              publisher: item.publisher || "",
              kotaScraped: item["publisher-location"] || "",
              doiUrl: item.DOI ? `https://doi.org/${item.DOI}` : "",
            };
          }
        }
      }
    } catch (e) {}
    return null;
  };

  const processDOI = async (rawDoi) => {
    const cleanedDoi = cleanDOI(rawDoi);
    const res = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(cleanedDoi)}`,
    );
    if (!res.ok) throw new Error("DOI tidak ditemukan atau salah format.");
    const data = await res.json();
    const item = data.message;
    const yearObj = item["published-print"] || item.issued;
    const year =
      yearObj && yearObj["date-parts"] ? yearObj["date-parts"][0][0] : "Tahun";
    const monthNum = yearObj?.["date-parts"]?.[0]?.[1] ?? null;
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Ags",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    return {
      authorFootnote: formatAuthorsFootnote(item.author),
      authorDafpus: formatAuthorsDafpus(item.author),
      year,
      month: monthNum ? monthNames[monthNum - 1] : "",
      title: item.title?.[0] ?? "Judul Artikel",
      journal: item["container-title"]?.[0] ?? "Nama Jurnal",
      page: item.page || "",
      volume: item.volume || "",
      issue: item.issue || "",
      publisher: item.publisher || "",
      kotaScraped: item["publisher-location"] || "",
      doiUrl: `https://doi.org/${cleanedDoi}`,
    };
  };

  const processURL = async (rawUrl) => {
    const targetUrl = normalizeUrl(rawUrl);
    const ssUrlsToTry = [targetUrl, rawUrl.trim()];
    for (const u of ssUrlsToTry) {
      try {
        const ssUrlRes = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/URL:${encodeURIComponent(u)}?fields=title,authors,year,venue,journal`,
        );
        if (ssUrlRes.ok) {
          const ssData = await ssUrlRes.json();
          if (ssData.title && ssData.authors && ssData.authors.length > 0)
            return formatFromSS(ssData);
        }
      } catch (e) {}
    }

    try {
      const mlRes = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}`,
      );
      if (mlRes.ok) {
        const mlData = await mlRes.json();
        const mlTitle = mlData.data?.title || "";
        if (
          mlTitle &&
          !mlTitle.toLowerCase().includes("just a moment") &&
          !mlTitle.toLowerCase().includes("cloudflare")
        ) {
          const aiResult = await searchByTitleAI(mlTitle);
          if (aiResult) return aiResult;
          let rawAuthor = mlData.data?.author || mlData.data?.publisher || "";
          return {
            authorFootnote: rawAuthor
              ? formatAuthorsFootnote([{ family: rawAuthor }])
              : "Penulis Tidak Diketahui",
            authorDafpus: rawAuthor
              ? formatAuthorsDafpus([{ family: rawAuthor }])
              : "Penulis Tidak Diketahui",
            year: mlData.data?.date
              ? new Date(mlData.data.date).getFullYear().toString()
              : "Tahun",
            month: "",
            title: mlTitle.replace(/(\s*[-|]\s*Academia\.edu)/i, "").trim(),
            journal: mlData.data?.publisher || "Nama Jurnal",
            page: "",
            volume: "",
            issue: "",
            publisher: "",
            kotaScraped: "",
            doiUrl: "",
          };
        }
      }
    } catch (e) {}

    const parseHTML = (html, contentType) => {
      const isBase64Pdf = html.startsWith("JVBERi");
      const isRawPdf = html.trim().startsWith("%PDF-");
      const isPdfType =
        (contentType || "").toLowerCase().includes("pdf") ||
        (contentType || "").toLowerCase().includes("octet-stream");
      const isPdfUrl = targetUrl.toLowerCase().split("?")[0].endsWith(".pdf");
      if (isPdfType || isRawPdf || isBase64Pdf || isPdfUrl)
        return { isPdfFile: true };

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const getMeta = (names) => {
        for (const n of names) {
          const el =
            doc.querySelector(`meta[name="${n}" i]`) ||
            doc.querySelector(`meta[property="${n}" i]`);
          if (el && el.getAttribute("content"))
            return el.getAttribute("content").trim();
        }
        return "";
      };

      let title =
        getMeta(["citation_title", "DC.Title", "og:title"]) ||
        doc.title ||
        "Judul Tidak Diketahui";
      title = title
        .replace(
          /(\s*[-|]\s*Academia\.edu|\s*[-|]\s*ResearchGate|\s*[-|]\s*Google Scholar)/i,
          "",
        )
        .trim();
      const blockedKeywords = [
        "just a moment",
        "cloudflare",
        "attention required",
        "security check",
        "robot or human",
      ];
      if (blockedKeywords.some((kw) => title.toLowerCase().includes(kw)))
        return { blocked: true };

      let authors = [];
      doc
        .querySelectorAll(
          'meta[name="citation_author" i], meta[name="DC.Creator.PersonalName" i], meta[name="DC.Creator" i]',
        )
        .forEach((node) => {
          const content = node.getAttribute("content");
          if (content && !authors.includes(content)) authors.push(content);
        });
      if (authors.length === 0 && title !== "Judul Tidak Diketahui")
        return { incomplete: true, title };

      let fn = "Penulis Tidak Diketahui",
        dp = "Penulis Tidak Diketahui";
      if (authors.length > 0) {
        let firstAuthor = authors[0].trim();
        let family = "",
          given = "";
        if (firstAuthor.includes(",")) {
          const parts = firstAuthor.split(",");
          family = parts[0].trim();
          given = parts[1] ? parts[1].trim() : "";
        } else {
          const parts = firstAuthor.split(" ").filter(Boolean);
          if (parts.length === 1) {
            family = parts[0];
            given = "";
          } else {
            family = parts.pop();
            given = parts.join(" ");
          }
        }
        fn = given
          ? `${capitalize(given)} ${capitalize(family)}`
          : capitalize(family);
        dp = given
          ? `${capitalize(family)}, ${capitalize(given)}`
          : capitalize(family);
        if (authors.length > 1) {
          fn += " <i>et al.</i>";
          dp += " <i>et al.</i>";
        }
      }

      const dateStr =
        getMeta([
          "citation_date",
          "citation_publication_date",
          "DC.Date",
          "DC.Date.issued",
          "article:published_time",
        ]) || "";
      const year = dateStr ? dateStr.split("/")[0].split("-")[0] : "Tahun";
      const firstPage = getMeta([
        "citation_firstpage",
        "DC.Identifier.pageNumber",
      ]);
      const lastPage = getMeta(["citation_lastpage"]);
      return {
        success: true,
        data: {
          authorFootnote: fn,
          authorDafpus: dp,
          year,
          month: "",
          title,
          journal:
            getMeta(["citation_journal_title", "DC.Source", "og:site_name"]) ||
            "",
          page: firstPage
            ? lastPage
              ? `${firstPage}-${lastPage}`
              : firstPage
            : "",
          volume: getMeta(["citation_volume", "DC.Source.Volume"]) || "",
          issue: getMeta(["citation_issue", "DC.Source.Issue"]) || "",
          publisher: getMeta(["citation_publisher", "DC.Publisher"]) || "",
          kotaScraped: "",
        },
      };
    };

    let htmlContent = "",
      contentType = "",
      finalUrl = targetUrl;
    const proxies = [
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    ];

    for (let proxy of proxies) {
      try {
        const res = await fetch(proxy);
        if (!res.ok) continue;
        htmlContent = await res.text();
        contentType = res.headers.get("content-type") || "";
        if (
          !htmlContent.toLowerCase().includes("just a moment") &&
          htmlContent.trim() !== ""
        )
          break;
      } catch (e) {}
    }

    if (!htmlContent)
      throw new Error("Gagal mengakses URL web. Pastikan web bersifat publik.");

    let parsed = parseHTML(htmlContent, contentType);
    if (parsed.isPdfFile) {
      const extractedDoi = extractDoiFromUrl(targetUrl);
      if (extractedDoi) return await processDOI(extractedDoi);
      throw new Error(
        "Tautan PDF mentah tanpa meta. Silakan salin judul dari PDF dan gunakan mode KETIK MANUAL.",
      );
    }

    if (parsed.blocked || parsed.incomplete) {
      try {
        const wbRes = await fetch(
          `https://archive.org/wayback/available?url=${encodeURIComponent(targetUrl)}`,
        );
        const wbData = await wbRes.json();
        if (wbData.archived_snapshots?.closest?.url) {
          const snapFetch = await fetch(
            wbData.archived_snapshots.closest.url.replace(/^http:/, "https:"),
          );
          if (snapFetch.ok) {
            const snapParsed = parseHTML(await snapFetch.text(), "text/html");
            if (snapParsed.success || (snapParsed.incomplete && parsed.blocked))
              parsed = snapParsed;
          }
        }
      } catch (e) {}
    }

    let searchTitle = parsed.incomplete ? parsed.title : "";
    if (parsed.blocked) {
      try {
        const segments = new URL(finalUrl).pathname.split("/").filter(Boolean);
        const last = segments[segments.length - 1];
        if (last && !last.match(/^\d+(\.pdf)?$/i))
          searchTitle = decodeURIComponent(last)
            .replace(/[-_]/g, " ")
            .replace(/\.pdf/i, "")
            .trim();
      } catch (e) {}
    }

    if (searchTitle) {
      const aiResult = await searchByTitleAI(searchTitle);
      if (aiResult) return aiResult;
    }

    if (parsed.success) return parsed.data;
    if (parsed.blocked)
      throw new Error(
        "Sistem diblokir oleh anti-bot Cloudflare. Mohon ketik manual.",
      );
    if (parsed.incomplete) {
      parsed.data = {
        authorFootnote: "Penulis Tidak Diketahui",
        authorDafpus: "Penulis Tidak Diketahui",
        year: "Tahun",
        month: "",
        title: parsed.title || "Judul Artikel",
        journal: "",
        page: "",
        volume: "",
        issue: "",
        publisher: "",
        kotaScraped: "",
        doiUrl: "",
      };
      return parsed.data;
    }
    throw new Error("Gagal mengekstrak data dari tautan ini.");
  };

  // --- BUILDERS (Footnote & APA 7) ---
  const buildFootnote = (m, kotaManual) => {
    const finalKota = kotaManual.trim() ? kotaManual : m.kotaScraped || "";
    const kotaTxt = capitalize(finalKota) ? `${capitalize(finalKota)}, ` : "";
    const pageTxt = m.page ? `hal. ${m.page}.` : "";
    let baseFootnote = `${m.authorFootnote} (${m.year}) ${capitalize(m.title)}. ${capitalize(m.journal)}. ${kotaTxt}${pageTxt}`;
    baseFootnote = baseFootnote.trim();
    if (!baseFootnote.endsWith(".")) baseFootnote += ".";
    if (m.doiUrl) baseFootnote += ` ${m.doiUrl}`;
    return baseFootnote;
  };

  const buildDafpus = (m, kotaManual) => {
    const finalKota = kotaManual.trim() ? kotaManual : m.kotaScraped || "";
    const parts = [];
    if (m.journal) parts.push(capitalize(m.journal));
    if (m.publisher) parts.push(capitalize(m.publisher));
    if (finalKota) parts.push(capitalize(finalKota));
    let volIssue = "";
    if (m.volume) volIssue += `Vol. ${m.volume}`;
    if (m.issue) volIssue += volIssue ? ` No. ${m.issue}` : `No. ${m.issue}`;
    if (volIssue) parts.push(volIssue);
    let datePart = m.month ? `${m.month} ` : "";
    datePart += m.year;
    parts.push(datePart);
    const journalMeta = parts.join(", ") + ".";
    const authorDot =
      m.authorDafpus.endsWith("</i>") || m.authorDafpus.endsWith(".")
        ? ""
        : ".";
    return `${m.authorDafpus}${authorDot} (${m.year}) "${capitalize(m.title)}". ${journalMeta}`;
  };

  const buildApaInText = (m) => {
    let familyName = m.authorDafpus.split(',')[0].replace(/<i>et al\.<\/i>/ig, '').replace(/et al\./ig, '').trim();
    let hasEtAl = m.authorDafpus.toLowerCase().includes('et al');
    return `(${familyName}${hasEtAl ? ' et al.' : ''}, ${m.year})`;
  };

  const buildApaReference = (m) => {
    let authorPart = m.authorDafpus;
    // Format APA 7 mengubah "Budi Santoso" menjadi "Santoso, B." (menggunakan Inisial)
    if (authorPart && authorPart !== "Penulis Tidak Diketahui") {
       let parts = authorPart.split(',');
       if(parts.length > 1) {
          let family = parts[0].trim();
          let givenRaw = parts[1].replace(/<i>et al\.<\/i>/ig, '').replace(/et al\./ig, '').trim();
          let initials = givenRaw.split(' ').filter(Boolean).map(n => n[0].toUpperCase() + '.').join(' ');
          let hasEtAl = authorPart.toLowerCase().includes('et al');
          authorPart = `${family}, ${initials}${hasEtAl ? ', et al.' : ''}`;
       }
    }

    let ref = `${authorPart} (${m.year}). ${capitalize(m.title)}. `;
    if (m.journal) {
       ref += `<i>${capitalize(m.journal)}</i>`;
       if (m.volume) {
          ref += `, <i>${m.volume}</i>`;
          if (m.issue) ref += `(${m.issue})`;
       }
       if (m.page) ref += `, ${m.page}`;
       ref += `.`;
    } else if (m.publisher) {
       ref += `${capitalize(m.publisher)}.`;
    }
    if (m.doiUrl) ref += ` ${m.doiUrl}`;
    return ref.trim();
  };

  // --- SUBMISSION HANDLERS ---
  const fetchDOI = async () => {
    if (!doiInput) return;
    setError("");

    const canProceed = await deductCredit(1);
    if (!canProceed) return;

    setLoading(true);
    setMetadata(null);
    try {
      const meta = await processDOI(doiInput);
      const fn = buildFootnote(meta, kotaInput);
      const dp = buildDafpus(meta, kotaInput);
      const apaIn = buildApaInText(meta);
      const apaRf = buildApaReference(meta);
      
      setMetadata(meta);
      setFootnoteResult(fn);
      setDafpusResult(dp);
      await saveToHistory(meta, fn, dp, apaIn, apaRf, doiInput, "DOI");
    } catch (e) {
      await refundCredit(1); // Refund on fail
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchURL = async () => {
    if (!urlInput) return;
    setError("");

    const canProceed = await deductCredit(1);
    if (!canProceed) return;

    setLoading(true);
    setMetadata(null);
    try {
      const meta = await processURL(urlInput);
      const fn = buildFootnote(meta, kotaInput);
      const dp = buildDafpus(meta, kotaInput);
      const apaIn = buildApaInText(meta);
      const apaRf = buildApaReference(meta);

      setMetadata(meta);
      setFootnoteResult(fn);
      setDafpusResult(dp);
      await saveToHistory(meta, fn, dp, apaIn, apaRf, urlInput, "URL");
    } catch (e) {
      await refundCredit(1); // Refund on fail
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateManual = async () => {
    setError("");
    if (!mAuthor || !mTitle || !mYear)
      return setError("Nama Penulis, Judul, dan Tahun wajib diisi.");

    const canProceed = await deductCredit(1);
    if (!canProceed) return;

    let fnName = "Penulis Tidak Diketahui",
      dpName = "Penulis Tidak Diketahui";
    if (mAuthor.trim()) {
      const authors = mAuthor
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const parts = authors[0].split(" ").filter(Boolean);
      let family = "",
        given = "";
      if (parts.length === 1) {
        family = parts[0];
      } else {
        family = parts.pop();
        given = parts.join(" ");
      }
      fnName = given
        ? `${capitalize(given)} ${capitalize(family)}`
        : capitalize(family);
      dpName = given
        ? `${capitalize(family)}, ${capitalize(given)}`
        : capitalize(family);
      if (authors.length > 1) {
        fnName += " <i>et al.</i>";
        dpName += " <i>et al.</i>";
      }
    }
    const meta = {
      authorFootnote: fnName,
      authorDafpus: dpName,
      title: mTitle,
      journal: mJournal,
      year: mYear,
      month: "",
      volume: mVolume,
      issue: mIssue,
      page: mPage,
      publisher: mPublisher,
      kotaScraped: "",
    };
    const fn = buildFootnote(meta, kotaInput);
    const dp = buildDafpus(meta, kotaInput);
    const apaIn = buildApaInText(meta);
    const apaRf = buildApaReference(meta);

    setMetadata(meta);
    setFootnoteResult(fn);
    setDafpusResult(dp);
    await saveToHistory(meta, fn, dp, apaIn, apaRf, "Input Manual", "Manual");
  };

  const handleBatchGenerate = async () => {
    if (!batchInput.trim())
      return setError("Masukkan setidaknya 1 baris URL/DOI.");
    const lines = batchInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const currentCredits = userData.credits || 0;
    if (currentCredits <= 0) {
      setShowTopupModal(true);
      return;
    }

    setLoading(true);
    setError("");
    setBatchResults([]);
    setMetadata(null);
    const results = [];
    let successfulParses = 0;

    for (let i = 0; i < lines.length; i++) {
      if (currentCredits - successfulParses <= 0) {
        results.push({
          status: "error",
          line: lines[i],
          error:
            "Kredit habis. Silakan Top Up untuk melanjutkan baris lainnya.",
        });
        break;
      }

      const line = lines[i];
      const isDoi =
        (line.includes("10.") && !line.includes("http")) ||
        line.includes("doi.org");
      try {
        let meta = isDoi ? await processDOI(line) : await processURL(line);
        results.push({ status: "success", line, meta });
        successfulParses++;

        const fn = buildFootnote(meta, kotaInput);
        const dp = buildDafpus(meta, kotaInput);
        const apaIn = buildApaInText(meta);
        const apaRf = buildApaReference(meta);
        await saveToHistory(meta, fn, dp, apaIn, apaRf, line, "Batch");
      } catch (err) {
        results.push({ status: "error", line, error: err.message });
      }
    }

    // Deduct credits only for successful operations
    if (successfulParses > 0) {
      const profileRef = doc(db, "users", user.uid);
      await updateDoc(profileRef, {
        credits: currentCredits - successfulParses,
      });
    }

    setBatchResults(results);
    setLoading(false);
  };

  const handleCopy = (htmlString, targetCopyId) => {
    if (!htmlString) return;
    const plainText = htmlString
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    const div = document.createElement("div");
    div.innerHTML = htmlString;
    div.style.position = "fixed";
    div.style.left = "-9999px";
    document.body.appendChild(div);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(div);
    selection.removeAllRanges();
    selection.addRange(range);
    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (err) {}
    selection.removeAllRanges();
    document.body.removeChild(div);
    if (!success && navigator.clipboard) {
      navigator.clipboard
        .writeText(plainText)
        .then(() => (success = true))
        .catch((e) => {});
    }
    if (success) {
      setCopiedId(targetCopyId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // --- ICONS ---
  // Komponen Logo Baru Menggunakan Video
  const VideoLogo = () => (
    <video
      // GANTI URL DI BAWAH INI DENGAN PATH VIDEO LOGO ANDA, CONTOH: "/logo-kilat.mp4"
      src="/logo.mov" 
      autoPlay
      loop
      muted
      playsInline
      className="video-logo-asset"
    />
  );

  const CheckIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      height="16"
      width="16"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
  const CopyIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      height="18"
      width="18"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  );
  const WarningIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      height="18"
      width="18"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  );
  const CoinIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      height="18"
      width="18"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 8v8"></path>
      <path d="M8 12h8"></path>
    </svg>
  );
  const CloseIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      height="20"
      width="20"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
  const ArrowRightIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      height="18"
      width="18"
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  );

  // Constants
  const batchSuccesses = batchResults.filter((r) => r.status === "success");
  const batchErrors = batchResults.filter((r) => r.status === "error");
  const sortedBatchDafpus = [...batchSuccesses].sort((a, b) =>
    a.meta.authorDafpus.localeCompare(b.meta.authorDafpus),
  );

  const SkeletonLoader = () => (
    <div className="card mt-6 glass-panel animate-fade-in">
      <div className="p-6">
        <div className="skeleton-line w-40 mb-6"></div>
        <div className="skeleton-box h-24 mb-6"></div>
        <div className="skeleton-line w-48 mb-6"></div>
        <div className="skeleton-box h-20"></div>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper">
      <div className="ambient-background">
        <div className="ambient-blob blob-1"></div>
        <div className="ambient-blob blob-2"></div>
      </div>

      {/* Peringatan ketika dibuka di Canvas/Tanpa Env */}
      {!firebaseConfig.apiKey && (
        <div className="env-warning">
          ⚠️ Peringatan: Konfigurasi API Key di file .env belum diset. Pastikan
          Anda mengaturnya di environment lokal.
        </div>
      )}

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="notification-toast animate-slide-up-fade">
          {notification}
        </div>
      )}

      {/* TOPUP MODAL */}
      {showTopupModal && (
        <div className="modal-overlay">
          <div className="modal-box animate-scale-in">
            <div className="modal-header">
              <h3 className="m-0 flex items-center gap-2 text-lg font-bold">
                <CoinIcon /> Top Up Kredit
              </h3>
              <button
                className="btn-close-modal"
                onClick={() => setShowTopupModal(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted mb-6 mt-0 text-sm leading-relaxed">
                Kredit Anda habis. Harga per 1 sitasi sukses hanya Rp 750. Bebas hambatan, bebas stres.
              </p>

              <div className="grid-packages mb-5">
                {[50, 75, 100, 125].map((amt) => (
                  <button
                    key={amt}
                    className={`btn-package ${topupAmount === amt ? "active" : ""}`}
                    onClick={() => setTopupAmount(amt)}
                  >
                    {amt} Kredit
                  </button>
                ))}
              </div>

              <div className="form-group">
                <label className="text-xs font-bold text-muted uppercase tracking-wide mb-2 block">
                  Nominal Custom:
                </label>
                <input
                  type="number"
                  min="1"
                  className="input-field-modern"
                  value={topupAmount}
                  onChange={(e) =>
                    setTopupAmount(parseInt(e.target.value) || 0)
                  }
                />
              </div>

              <div className="price-tag mt-6">
                <span className="text-muted font-medium text-sm">Total Pembayaran</span>
                <span className="font-extrabold text-xl text-main">
                  Rp {(topupAmount * 750).toLocaleString("id-ID")}
                </span>
              </div>

              <button
                className="btn-primary w-full mt-6 py-3.5 shadow-glow"
                onClick={processPayment}
                disabled={isPaying}
              >
                {isPaying ? "Menghubungkan..." : "Bayar via Bayar.gg"}
              </button>
              <p className="text-xs text-muted text-center mt-4">
                Pembayaran Anda aman dan diproses otomatis.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR (Kapsul Melayang) */}
      <div className="navbar-wrapper">
        <nav className="navbar">
          <div className="nav-container">
            <div
              className="nav-logo"
              onClick={() => {
                setCurrentView("landing");
                window.scrollTo(0, 0);
              }}
            >
              <div className="logo-icon-wrap"><VideoLogo /></div>
            </div>

            <div className="nav-actions">
              {user && currentView === "tool" && (
                <div
                  className="credit-badge"
                  onClick={() => setShowTopupModal(true)}
                  title="Top Up Kredit"
                >
                  <CoinIcon /> {userData.credits || 0}
                </div>
              )}

              {!user ? (
                <button
                  onClick={handleLoginAndEnter}
                  className="btn-primary btn-sm hidden-mobile"
                  disabled={loading}
                >
                  {loading ? "Menghubungkan..." : "Buka Ruang Kerja"}
                </button>
              ) : (
                <button
                  onClick={handleLogout}
                  className="btn-secondary btn-sm hidden-mobile"
                >
                  Keluar
                </button>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* --- VIEW 1: LANDING PAGE (SaaS Enterprise Level) --- */}
      {currentView === "landing" && (
        <main className="main-content z-10 relative" ref={landingRef}>
          {/* Hero Section */}
          <section id="hero" className="hero-section">
            <div className="container text-center relative">
              {/* Efek Cahaya Latar (Ambient Glow) */}
              <div className="hero-glow-bg"></div>

              <div className="hero-badge badge-pill mx-auto mb-6 flex items-center gap-2 w-max">
                <span className="pulse-dot"></span> Tools Sitasi Jurnal Cerdas
              </div>
              
              <h1 className="hero-title" style={{ perspective: "1000px" }}>
                <div className="hero-title-line">Ekstrak Referensi Jurnal</div>
                <div className="hero-title-line"><span className="text-gradient">Dalam Hitungan Detik.</span></div>
              </h1>
              
              <p className="hero-subtitle mx-auto mt-6">
                Berhenti menyusun daftar pustaka secara manual. Ekstrak metadata
                dari PDF, DOI, Academia, ResearchGate, dan OJS secara instan dengan tingkat presisi tinggi.
              </p>
              
              <div className="hero-cta mt-10">
                <button
                  onClick={handleLoginAndEnter}
                  className="btn-primary btn-lg shadow-glow"
                  disabled={loading}
                >
                  {loading
                    ? "Memuat Workspace..."
                    : "Mulai Gratis Sekarang"}
                </button>
                <p className="text-xs text-muted mt-4 font-medium">✨ Dapatkan 5 Kredit Gratis Tanpa Kartu Kredit</p>
              </div>
            </div>
          </section>

          {/* Live Preview Section */}
          <section className="preview-section mt-10">
            <div className="container">
              <div className="preview-card-anim preview-card glass-panel shadow-premium-glow">
                <div className="preview-header">
                  <div className="preview-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="text-xs font-semibold text-muted font-mono">
                    demo_output.js
                  </span>
                </div>
                <div className="preview-body grid-2 gap-6">
                  <div className="preview-col border-r pr-4">
                    <span className="text-xs font-bold text-muted uppercase tracking-wide">
                      Input URL / DOI
                    </span>
                    <div className="preview-mock-input mt-3 font-mono text-sm">
                      https://www.academia.edu/download/111297711/214.pdf
                    </div>
                    <div className="mt-6 flex items-center justify-center gap-3 text-sm text-primary font-semibold">
                      <span className="loading-spinner"></span> AI Mengekstrak Metadata...
                    </div>
                  </div>
                  <div className="preview-col pl-2">
                    <span className="text-xs font-bold text-success uppercase tracking-wide flex items-center gap-2">
                      <CheckIcon /> Ekstraksi Berhasil
                    </span>
                    <div className="preview-mock-output mt-3">
                      <strong className="text-xs uppercase text-muted tracking-wide block mb-1">Catatan Kaki:</strong>
                      Budi Santoso (2024) Analisis Pajak PPh 21 Terhadap UMKM.
                      Jurnal Ekonomi Terapan. Jakarta, hal. 12-25.
                    </div>
                    <div className="preview-mock-output mt-3">
                      <strong className="text-xs uppercase text-muted tracking-wide block mb-1">Daftar Pustaka:</strong>
                      Santoso, Budi. (2024) "Analisis Pajak PPh 21 Terhadap
                      UMKM". Jurnal Ekonomi Terapan, Jakarta.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features Detail */}
          <section id="features" className="features-section">
            <div className="container text-center">
              <h2 className="section-title mb-12">Dibangun untuk Kecepatan & Presisi</h2>
              <div className="grid-3">
                <div className="feature-card-anim feature-card glass-panel group-hover-effect">
                  <div className="feature-icon-box">🛡️</div>
                  <h3 className="text-lg font-bold">Anti-Cloudflare Bypass</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">
                    Mengekstrak data otomatis meski web sumber diproteksi sistem
                    keamanan Cloudflare (seperti Academia & ResearchGate).
                  </p>
                </div>
                <div className="feature-card-anim feature-card glass-panel group-hover-effect">
                  <div className="feature-icon-box">🤖</div>
                  <h3 className="text-lg font-bold">AI Self-Healing</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">
                    Jika jurnal PDF rusak, AI Semantic Scholar
                    kami otomatis melacak dan merekonstruksi metadata aslinya.
                  </p>
                </div>
                <div className="feature-card-anim feature-card glass-panel group-hover-effect">
                  <div className="feature-icon-box">⚡</div>
                  <h3 className="text-lg font-bold">Pemrosesan Batch</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">
                    Punya 50 referensi? Paste semua URL sekaligus
                    dan dapatkan daftar pustaka urut abjad seketika.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Pricing & Transparency */}
          <section className="pricing-section">
            <div className="container text-center">
              <div className="pricing-card-anim pricing-card glass-panel relative overflow-hidden shadow-premium-glow">
                <div className="absolute-glow"></div>
                <h2 className="m-0 mb-3 text-2xl font-extrabold relative z-10">Transparan. Pay-As-You-Go.</h2>
                <p className="text-muted m-0 mb-8 relative z-10 text-sm max-w-sm mx-auto">
                  Tanpa langganan bulanan. Anda hanya membayar apa yang Anda gunakan.
                </p>

                <div className="price-huge relative z-10">
                  <span className="currency font-semibold">Rp</span>
                  750
                  <span className="suffix font-medium text-muted">
                    / Sitasi Sukses
                  </span>
                </div>

                <ul className="pricing-list mt-8 mb-8 relative z-10">
                  <li>
                    <div className="icon-wrap"><CheckIcon /></div> 
                    <span>Gratis 5 Kredit untuk pengguna baru.</span>
                  </li>
                  <li>
                    <div className="icon-wrap"><CheckIcon /></div> 
                    <span>Kredit <strong>TIDAK HANGUS</strong> jika ekstraksi gagal.</span>
                  </li>
                  <li>
                    <div className="icon-wrap"><CheckIcon /></div> 
                    <span>Riwayat tersimpan selamanya di Cloud.</span>
                  </li>
                  <li>
                    <div className="icon-wrap"><CheckIcon /></div> 
                    <span>Dukungan QRIS, e-Wallet, & Virtual Account.</span>
                  </li>
                </ul>

                <button
                  onClick={handleLoginAndEnter}
                  className="btn-primary w-full flex justify-center items-center gap-3 relative z-10 py-4 text-base"
                >
                  Mulai Ruang Kerja Anda <ArrowRightIcon />
                </button>
              </div>
            </div>
          </section>

          <footer className="footer">
            <div className="container footer-content">
              <div className="footer-brand flex items-center justify-center mb-4">
                <div className="logo-icon-wrap footer-logo"><VideoLogo /></div>
              </div>
              <p className="mt-0 text-sm max-w-md mx-auto text-muted leading-relaxed">
                Automasi sitasi akademik pintar untuk penulisan karya ilmiah
                instan. Desain eksklusif. Performa maksimal.
              </p>
              <div className="mt-8 text-xs font-medium text-muted opacity-60">
                © {new Date().getFullYear()} FlashCite. All rights reserved.
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* --- VIEW 2: WORKSPACE APP --- */}
      {currentView === "tool" && user && (
        <section className="tool-section animate-fade-in z-10 relative">
          <div className="container tool-container">
            <div className="tool-header mb-8 text-center sm:text-left">
              <h2 className="section-title m-0 tracking-tight">Ruang Kerja</h2>
              <p className="text-muted text-sm mt-2 font-medium">
                Sistem ekstraksi metadata aktif. Masukkan referensi Anda.
              </p>
            </div>

            <div className="card glass-panel shadow-premium">
              <div className="segmented-control-wrapper p-2 border-b border-color">
                <div className="segmented-control scrollable-tabs">
                  <button
                    className={`segmented-btn ${inputMode === "doi" ? "active" : ""}`}
                    onClick={() => setInputMode("doi")}
                  >
                    Nomor DOI
                  </button>
                  <button
                    className={`segmented-btn ${inputMode === "url" ? "active" : ""}`}
                    onClick={() => setInputMode("url")}
                  >
                    Link Web/PDF
                  </button>
                  <button
                    className={`segmented-btn ${inputMode === "batch" ? "active" : ""}`}
                    onClick={() => setInputMode("batch")}
                  >
                    Mode Batch
                  </button>
                  <button
                    className={`segmented-btn ${inputMode === "manual" ? "active" : ""}`}
                    onClick={() => setInputMode("manual")}
                  >
                    Manual
                  </button>
                  <button
                    className={`segmented-btn ${inputMode === "history" ? "active" : ""}`}
                    onClick={() => setInputMode("history")}
                  >
                    Riwayat
                  </button>
                </div>
              </div>

              <div className="card-body p-6 sm:p-8">
                {/* --- TOGGLE CITATION STYLE (GLOBAL SELECTOR) --- */}
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-color">
                   <div>
                     <h3 className="text-base font-bold text-main m-0">Format Sitasi</h3>
                     <p className="text-xs text-muted mt-1 m-0">Pilih gaya output yang dihasilkan</p>
                   </div>
                   <div className="style-toggle">
                      <button
                         className={`style-toggle-btn ${citationStyle === "footnote" ? "active" : ""}`}
                         onClick={() => setCitationStyle("footnote")}
                      >
                         📝 Footnote
                      </button>
                      <button
                         className={`style-toggle-btn ${citationStyle === "apa7" ? "active" : ""}`}
                         onClick={() => setCitationStyle("apa7")}
                      >
                         📑 APA 7
                      </button>
                   </div>
                </div>

                {inputMode === "doi" && (
                  <div className="animate-fade-in">
                    <div className="form-group mb-5 relative">
                      <label className="input-label">Nomor DOI Referensi</label>
                      <input
                        type="text"
                        className="input-field-modern"
                        value={doiInput}
                        onChange={(e) => setDoiInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchDOI()}
                        placeholder="Contoh: 10.1038/s41586..."
                      />
                    </div>
                    {citationStyle === "footnote" && (
                      <div className="form-group mb-8 relative">
                        <label className="input-label">Kota Terbit <span className="text-muted font-normal">(Opsional)</span></label>
                        <input
                          type="text"
                          className="input-field-modern"
                          value={kotaInput}
                          onChange={(e) => setKotaInput(e.target.value)}
                          placeholder="Masukkan kota terbit jurnal"
                        />
                      </div>
                    )}
                    <button
                      className="btn-primary w-full py-3.5 shadow-glow"
                      onClick={fetchDOI}
                      disabled={loading || !doiInput}
                    >
                      {loading
                        ? "Mengeksekusi Proses..."
                        : "Generate Sitasi (1 Kredit)"}
                    </button>
                  </div>
                )}

                {inputMode === "url" && (
                  <div className="animate-fade-in">
                    <div className="form-group mb-5 relative">
                      <label className="input-label">Tautan Artikel / PDF</label>
                      <input
                        type="text"
                        className="input-field-modern"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchURL()}
                        placeholder="Paste link Academia, ResearchGate, OJS, dll"
                      />
                    </div>
                    {citationStyle === "footnote" && (
                      <div className="form-group mb-8 relative">
                        <label className="input-label">Kota Terbit <span className="text-muted font-normal">(Opsional)</span></label>
                        <input
                          type="text"
                          className="input-field-modern"
                          value={kotaInput}
                          onChange={(e) => setKotaInput(e.target.value)}
                          placeholder="Masukkan kota terbit jurnal"
                        />
                      </div>
                    )}
                    <button
                      className="btn-primary w-full py-3.5 shadow-glow"
                      onClick={fetchURL}
                      disabled={loading || !urlInput}
                    >
                      {loading
                        ? "Menganalisis Tautan..."
                        : "Generate Sitasi (1 Kredit)"}
                    </button>
                  </div>
                )}

                {inputMode === "manual" && (
                  <div className="animate-fade-in">
                    <div className="grid-2 gap-5">
                      <div className="col-span-2 form-group">
                        <label className="input-label">Nama Penulis Lengkap *</label>
                        <input
                          type="text"
                          className="input-field-modern"
                          value={mAuthor}
                          onChange={(e) => setMAuthor(e.target.value)}
                          placeholder="John Doe, Jane Smith"
                        />
                      </div>
                      <div className="col-span-2 form-group">
                        <label className="input-label">Judul Artikel *</label>
                        <input
                          type="text"
                          className="input-field-modern"
                          value={mTitle}
                          onChange={(e) => setMTitle(e.target.value)}
                          placeholder="Masukkan judul artikel"
                        />
                      </div>
                      <div className="form-group">
                        <label className="input-label">Nama Jurnal</label>
                        <input
                          type="text"
                          className="input-field-modern"
                          value={mJournal}
                          onChange={(e) => setMJournal(e.target.value)}
                          placeholder="Jurnal Internasional"
                        />
                      </div>
                      <div className="form-group">
                        <label className="input-label">Tahun Terbit *</label>
                        <input
                          type="text"
                          className="input-field-modern"
                          value={mYear}
                          onChange={(e) => setMYear(e.target.value)}
                          placeholder="2024"
                        />
                      </div>
                      <div className="form-group">
                        <label className="input-label">Volume</label>
                        <input
                          type="text"
                          className="input-field-modern"
                          value={mVolume}
                          onChange={(e) => setMVolume(e.target.value)}
                          placeholder="Misal: 5"
                        />
                      </div>
                      <div className="form-group">
                        <label className="input-label">Isu / Nomor</label>
                        <input
                          type="text"
                          className="input-field-modern"
                          value={mIssue}
                          onChange={(e) => setMIssue(e.target.value)}
                          placeholder="Misal: 2"
                        />
                      </div>
                      <div className="form-group">
                        <label className="input-label">Halaman</label>
                        <input
                          type="text"
                          className="input-field-modern"
                          value={mPage}
                          onChange={(e) => setMPage(e.target.value)}
                          placeholder="Misal: 10-25"
                        />
                      </div>
                      {citationStyle === "footnote" && (
                        <div className="form-group">
                          <label className="input-label">Kota Terbit</label>
                          <input
                            type="text"
                            className="input-field-modern"
                            value={kotaInput}
                            onChange={(e) => setKotaInput(e.target.value)}
                            placeholder="Jakarta"
                          />
                        </div>
                      )}
                    </div>
                    <button
                      className="btn-primary w-full mt-8 py-3.5 shadow-glow"
                      onClick={handleGenerateManual}
                    >
                      Generate Manual (1 Kredit)
                    </button>
                  </div>
                )}

                {inputMode === "batch" && (
                  <div className="animate-fade-in">
                    <div className="form-group mb-5">
                      <label className="input-label">Daftar Link / DOI</label>
                      <textarea
                        className="input-field-modern textarea-field"
                        value={batchInput}
                        onChange={(e) => setBatchInput(e.target.value)}
                        placeholder="Paste banyak URL atau DOI di sini&#10;1 Baris = 1 Link/DOI&#10;Maksimal disarankan: 20 baris per proses"
                      />
                    </div>
                    {citationStyle === "footnote" && (
                      <div className="form-group mb-8">
                        <label className="input-label">Kota Terbit Global <span className="text-muted font-normal">(Opsional)</span></label>
                        <input
                          type="text"
                          className="input-field-modern"
                          value={kotaInput}
                          onChange={(e) => setKotaInput(e.target.value)}
                          placeholder="Diaplikasikan ke semua referensi"
                        />
                      </div>
                    )}
                    <button
                      className="btn-primary w-full py-3.5 shadow-glow"
                      onClick={handleBatchGenerate}
                      disabled={loading || !batchInput}
                    >
                      {loading
                        ? "Memproses Batch..."
                        : "Generate Semua (1 Kredit/Sukses)"}
                    </button>
                  </div>
                )}

                {/* TAB HISTORY */}
                {inputMode === "history" && (
                  <div className="animate-fade-in history-container custom-scrollbar pr-3">
                    {history.length === 0 ? (
                      <div className="text-center text-muted p-10 flex flex-col items-center">
                        <span className="text-4xl mb-3 opacity-20">🗂️</span>
                        Ruang riwayat Anda masih kosong.
                      </div>
                    ) : (
                      history.map((item) => {
                        const inTextToCopy = citationStyle === "footnote" ? item.footnote : (item.apaInText || "Data APA 7 belum tersedia untuk riwayat lama. Silakan generate ulang.");
                        const refToCopy = citationStyle === "footnote" ? item.dafpus : (item.apaRef || "Data APA 7 belum tersedia untuk riwayat lama. Silakan generate ulang.");
                        return (
                          <div
                            key={item.id}
                            className="history-item mb-5 pb-5 border-b border-color last-no-border"
                          >
                            <div className="flex justify-between items-center mb-3">
                              <span className="badge-pill text-xs px-2 py-0.5">
                                {item.type}
                              </span>
                              <span className="text-xs font-mono text-muted">
                                {new Date(item.timestamp).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <h4 className="m-0 mb-3 font-semibold text-sm leading-snug truncate-2 text-main">
                              {item.title}
                            </h4>
                            <div className="flex gap-2 mt-4">
                              <button
                                className="btn-secondary btn-sm flex-1 justify-center"
                                onClick={() => handleCopy(inTextToCopy, `hist-in-${item.id}`)}
                              >
                                {copiedId === `hist-in-${item.id}` ? (
                                  <><CheckIcon /> Disalin</>
                                ) : (
                                  <><CopyIcon /> {citationStyle === 'footnote' ? 'Footnote' : 'In-Text'}</>
                                )}
                              </button>
                              <button
                                className="btn-secondary btn-sm flex-1 justify-center"
                                onClick={() => handleCopy(refToCopy, `hist-dp-${item.id}`)}
                              >
                                {copiedId === `hist-dp-${item.id}` ? (
                                  <><CheckIcon /> Disalin</>
                                ) : (
                                  <><CopyIcon /> {citationStyle === 'footnote' ? 'Dafpus' : 'APA 7'}</>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {error && (
                  <div className="error-alert mt-8 animate-slide-up-fade flex items-start">
                    <div className="mt-0.5"><WarningIcon /></div> 
                    <span className="leading-relaxed font-medium">{error}</span>
                  </div>
                )}
              </div>
            </div>

            {loading && inputMode !== "batch" && <SkeletonLoader />}
            {loading && inputMode === "batch" && (
              <>
                <SkeletonLoader />
                <div style={{ opacity: 0.5, transform: "scale(0.98)" }}>
                  <SkeletonLoader />
                </div>
              </>
            )}

            {/* RESULTS AREA: SINGLE */}
            {!loading &&
              metadata &&
              inputMode !== "batch" &&
              inputMode !== "history" && (
                <div className="card glass-panel mt-8 animate-slide-up border-t-success relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <CheckIcon />
                  </div>
                  <div className="card-body p-6 sm:p-8">
                    <div className="result-block">
                      <div className="result-header">
                        <span>{citationStyle === 'footnote' ? 'CATATAN KAKI (FOOTNOTE)' : 'SITASI DALAM TEKS (IN-TEXT)'}</span>
                        <button
                          className="btn-copy-modern"
                          onClick={() => handleCopy(citationStyle === 'footnote' ? footnoteResult : buildApaInText(metadata), "single-in")}
                        >
                          {copiedId === "single-in" ? (
                            <>
                              <span className="text-success"><CheckIcon /></span> Disalin
                            </>
                          ) : (
                            <>
                              <CopyIcon /> Salin
                            </>
                          )}
                        </button>
                      </div>
                      <div
                        className="result-html"
                        dangerouslySetInnerHTML={{ __html: citationStyle === 'footnote' ? footnoteResult : buildApaInText(metadata) }}
                      />
                    </div>
                    <div className="result-block mt-8">
                      <div className="result-header">
                        <span>{citationStyle === 'footnote' ? 'DAFTAR PUSTAKA' : 'DAFTAR PUSTAKA (APA 7)'}</span>
                        <button
                          className="btn-copy-modern"
                          onClick={() => handleCopy(citationStyle === 'footnote' ? dafpusResult : buildApaReference(metadata), "single-dp")}
                        >
                          {copiedId === "single-dp" ? (
                            <>
                              <span className="text-success"><CheckIcon /></span> Disalin
                            </>
                          ) : (
                            <>
                              <CopyIcon /> Salin
                            </>
                          )}
                        </button>
                      </div>
                      <div
                        className="result-html"
                        dangerouslySetInnerHTML={{ __html: citationStyle === 'footnote' ? dafpusResult : buildApaReference(metadata) }}
                      />
                    </div>
                  </div>
                </div>
              )}

            {/* RESULTS AREA: BATCH */}
            {!loading && batchResults.length > 0 && inputMode === "batch" && (
              <div className="card glass-panel mt-8 animate-slide-up border-t-success">
                <div className="card-body p-6 sm:p-8">
                  {batchSuccesses.length > 0 && (
                    <>
                      <div className="flex items-center justify-between mb-4 border-b border-color pb-3">
                        <h3 className="text-base font-bold m-0 text-main">
                          {citationStyle === 'footnote' ? `Catatan Kaki (${batchSuccesses.length})` : `Sitasi Dalam Teks (${batchSuccesses.length})`}
                        </h3>
                      </div>
                      {batchSuccesses.map((r, index) => {
                        const content = citationStyle === 'footnote' ? buildFootnote(r.meta, kotaInput) : buildApaInText(r.meta);
                        const copyId = `batch-in-${index}`;
                        return (
                          <div className="result-block mb-5" key={copyId}>
                            <div className="result-header bg-subtle">
                              <span className="truncate font-mono text-xs">{r.line}</span>
                              <button
                                className="btn-copy-modern btn-sm-padding"
                                onClick={() => handleCopy(content, copyId)}
                              >
                                {copiedId === copyId ? (
                                  <span className="text-success"><CheckIcon /></span>
                                ) : (
                                  <CopyIcon />
                                )}
                              </button>
                            </div>
                            <div
                              className="result-html text-sm"
                              dangerouslySetInnerHTML={{ __html: content }}
                            />
                          </div>
                        );
                      })}
                      
                      <div className="flex items-center justify-between mt-10 mb-4 border-b border-color pb-3">
                        <h3 className="text-base font-bold m-0 text-main">
                          {citationStyle === 'footnote' ? `Daftar Pustaka A-Z (${sortedBatchDafpus.length})` : `Daftar Pustaka APA 7 (${sortedBatchDafpus.length})`}
                        </h3>
                      </div>
                      {sortedBatchDafpus.map((r, index) => {
                        const content = citationStyle === 'footnote' ? buildDafpus(r.meta, kotaInput) : buildApaReference(r.meta);
                        const copyId = `batch-dp-${index}`;
                        return (
                          <div className="result-block mb-5" key={copyId}>
                            <div className="result-header bg-subtle">
                              <span className="truncate font-mono text-xs">{r.line}</span>
                              <button
                                className="btn-copy-modern btn-sm-padding"
                                onClick={() => handleCopy(content, copyId)}
                              >
                                {copiedId === copyId ? (
                                  <span className="text-success"><CheckIcon /></span>
                                ) : (
                                  <CopyIcon />
                                )}
                              </button>
                            </div>
                            <div
                              className="result-html text-sm"
                              dangerouslySetInnerHTML={{ __html: content }}
                            />
                          </div>
                        );
                      })}
                    </>
                  )}
                  {batchErrors.length > 0 && (
                    <div className="error-alert mt-8 p-5 bg-error-subtle border-error border rounded-lg">
                      <strong className="flex items-center gap-2 mb-3 text-error"><WarningIcon/> Gagal (Otomatis Di-Refund):</strong>
                      <ul className="m-0 pl-5 text-error text-sm space-y-2 opacity-90">
                        {batchErrors.map((err, i) => (
                          <li key={i} className="break-all">
                            <span className="font-mono text-xs font-semibold mr-2">{err.line}</span>
                            <br className="sm:hidden" />
                            {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div style={{ height: "80px" }}></div>
          </div>
        </section>
      )}

      {/* --- CSS STYLING & VARIABLES ISOLATION (ENTERPRISE GRADE) --- */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        html, body, #root {
          margin: 0 !important;
          padding: 0 !important;
          width: 100%;
          min-height: 100vh;
          /* Memaksa background body mengikuti warna tema dari app-wrapper */
          background-color: var(--bg-body); 
        }

        .app-wrapper {
          /* LIGHT MODE VARIABLES */
          --bg-body: #fbfbfc;
          --bg-surface: rgba(255, 255, 255, 1);
          --bg-surface-hover: rgba(243, 244, 246, 1);
          --bg-surface-solid: #ffffff;
          
          --text-main: #09090b;
          --text-muted: #71717a;
          
          --border-color: rgba(0, 0, 0, 0.08);
          --border-focus: rgba(24, 24, 27, 0.9);
          
          --primary: #09090b;
          --primary-hover: #27272a;
          --primary-light: #f4f4f5;
          --primary-gradient: linear-gradient(135deg, #09090b 0%, #3f3f46 100%);
          
          --success-light: #f0fdf4;
          --success: #16a34a;
          --success-border: #22c55e;
          --error-bg: #fef2f2;
          --error-text: #dc2626;

          --nav-bg: rgba(255, 255, 255, 1);
          --skeleton-bg: #e4e4e7;
          --skeleton-hl: #f4f4f5;

          --radius-sm: 8px;
          --radius-md: 16px;
          --radius-lg: 24px;
          
          min-height: 100vh;
          background-color: var(--bg-body);
          color: var(--text-main);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          transition: background-color 0.4s ease, color 0.4s ease;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        * { box-sizing: border-box; }
        .container { max-width: 960px; margin: 0 auto; padding: 0 1.5rem; }

        /* AMBIENT BACKGROUND GLOW */
        .ambient-background {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          overflow: hidden; z-index: 0; pointer-events: none;
        }
        .ambient-blob {
          position: absolute; filter: blur(100px); opacity: 0.4;
          border-radius: 50%; animation: floatBlob 20s infinite alternate;
        }
        .blob-1 {
          top: -10%; left: -10%; width: 50vw; height: 50vw;
          background: radial-gradient(circle, rgba(161, 161, 170, 0.2) 0%, transparent 70%);
        }
        .blob-2 {
          bottom: -20%; right: -10%; width: 60vw; height: 60vw;
          background: radial-gradient(circle, rgba(113, 113, 122, 0.15) 0%, transparent 70%);
          animation-delay: -10s;
        }
        
        @keyframes floatBlob {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(5%, 10%) scale(1.1); }
          100% { transform: translate(-5%, -10%) scale(0.9); }
        }

        /* GLASSMORPHISM & SHADOWS */
        .glass-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
        }
        .shadow-premium {
          box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.03), 0 1px 4px -1px rgba(0, 0, 0, 0.02);
        }
        .shadow-glow {
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        }

        /* UTILS */
        .text-center { text-align: center; } .text-left { text-align: left; }
        .text-gradient { background: var(--primary-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .flex { display: flex; } .items-center { align-items: center; } .items-start { align-items: flex-start; } .justify-between { justify-content: space-between; }
        .justify-center { justify-content: center; } .flex-col { flex-direction: column; } .flex-1 { flex: 1; }
        .gap-1 { gap: 0.25rem; } .gap-2 { gap: 0.5rem; } .gap-3 { gap: 0.75rem; } .gap-4 { gap: 1rem; } .gap-5 { gap: 1.25rem; } .gap-6 { gap: 1.5rem; }
        .m-0 { margin: 0; } .mx-auto { margin-left: auto; margin-right: auto; }
        .mt-0 { margin-top: 0; } .mt-1 { margin-top: 0.25rem; } .mt-2 { margin-top: 0.5rem; } .mt-3 { margin-top: 0.75rem; } .mt-4 { margin-top: 1rem; } 
        .mt-6 { margin-top: 1.5rem; } .mt-8 { margin-top: 2rem; } .mt-10 { margin-top: 2.5rem; } .mt-12 { margin-top: 3rem; }
        .mb-1 { margin-bottom: 0.25rem; } .mb-2 { margin-bottom: 0.5rem; } .mb-3 { margin-bottom: 0.75rem; } 
        .mb-4 { margin-bottom: 1rem; } .mb-5 { margin-bottom: 1.25rem; } .mb-6 { margin-bottom: 1.5rem; } .mb-8 { margin-bottom: 2rem; } .mb-12 { margin-bottom: 3rem; }
        .p-1 { padding: 0.25rem; } .p-2 { padding: 0.5rem; } .p-4 { padding: 1rem; } .p-5 { padding: 1.25rem; } .p-6 { padding: 1.5rem; } .p-8 { padding: 2rem; } .p-10 { padding: 2.5rem; }
        .pb-3 { padding-bottom: 0.75rem; } .pb-4 { padding-bottom: 1rem; } .pb-5 { padding-bottom: 1.25rem; } .pt-5 { padding-top: 1.25rem; }
        .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; } .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; } .py-0.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; } .py-1.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; } .py-3.5 { padding-top: 0.875rem; padding-bottom: 0.875rem; } .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
        .pr-3 { padding-right: 0.75rem; } .pr-4 { padding-right: 1rem; } .pl-2 { padding-left: 0.5rem; } .pl-5 { padding-left: 1.25rem; }
        .w-full { width: 100%; } .w-max { width: max-content; }
        .border-b { border-bottom: 1px solid var(--border-color); }
        .border-r { border-right: 1px solid var(--border-color); }
        .border-color { border-color: var(--border-color); }
        .border-none { border: none; } .rounded-md { border-radius: 6px; } .rounded-lg { border-radius: var(--radius-sm); }
        .bg-subtle { background: var(--bg-surface-hover); } .bg-surface-solid { background: var(--bg-surface-solid); } .bg-error-subtle { background: var(--error-bg); } .border-error { border-color: var(--error-text); }
        .bg-primary { background: var(--primary); }
        .text-sm { font-size: 0.875rem; } .text-xs { font-size: 0.75rem; } .text-base { font-size: 1rem; } .text-lg { font-size: 1.125rem; } .text-xl { font-size: 1.25rem; } .text-2xl { font-size: 1.5rem; } .text-4xl { font-size: 2.25rem; }
        .text-main { color: var(--text-main); } .text-muted { color: var(--text-muted); } .text-primary { color: var(--primary); } .text-success { color: var(--success); } .text-error { color: var(--error-text); } .text-body { color: var(--bg-surface-solid); }
        .font-normal { font-weight: 400; } .font-medium { font-weight: 500; } .font-semibold { font-weight: 600; } .font-bold { font-weight: 700; } .font-extrabold { font-weight: 800; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .uppercase { text-transform: uppercase; } .tracking-wide { letter-spacing: 0.05em; } .tracking-tight { letter-spacing: -0.025em; }
        .leading-snug { line-height: 1.375; } .leading-relaxed { line-height: 1.625; }
        .block { display: block; } .inline-block { display: inline-block; } .relative { position: relative; } .absolute { position: absolute; } .overflow-hidden { overflow: hidden; }
        .z-10 { z-index: 10; }
        .opacity-5 { opacity: 0.05; } .opacity-20 { opacity: 0.2; } .opacity-60 { opacity: 0.6; } .opacity-90 { opacity: 0.9; }
        .pointer-events-none { pointer-events: none; }
        .break-all { word-break: break-all; }
        .truncate { display: inline-block; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .max-w-sm { max-width: 24rem; } .max-w-md { max-width: 28rem; }
        .last-no-border:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
        .border-t-success { border-top: 3px solid var(--success-border); }
        .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
        .transition-colors { transition: background-color 0.2s, color 0.2s; }

        /* NAVBAR FLOATING PILL */
        .navbar-wrapper {
          position: sticky; /* Ini yang menahan navbar di atas */
          top: 1.5rem;      /* Jarak dari ujung atas layar */
          z-index: 100;
          padding: 0 1.5rem; 
          display: flex; 
          justify-content: center;
        }
        .navbar {
          width: 100%; max-width: 800px; 
          background: var(--nav-bg); /* Menggunakan warna putih padat */
          border: 1px solid var(--border-color); 
          border-radius: 100px;
          padding: 0.6rem 0.6rem 0.6rem 1.25rem; 
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
        }

        .nav-container { display: flex; justify-content: space-between; align-items: center; }
        .nav-logo { cursor: pointer; display: flex; align-items: center; }
        
        .logo-icon-wrap { height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 4px; overflow: hidden; }
        .footer-logo { height: 24px; }
        .video-logo-asset { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
        
        .nav-actions { display: flex; align-items: center; gap: 0.5rem; }
        
        .credit-badge {
          display: flex; align-items: center; gap: 6px;
          background: var(--bg-surface-hover); color: var(--text-main);
          padding: 0 14px; height: 36px; border-radius: 50px; font-size: 0.85rem; font-weight: 700;
          cursor: pointer; border: 1px solid var(--border-color); transition: 0.2s; font-family: 'JetBrains Mono', monospace;
        }
        .credit-badge:hover { border-color: var(--text-muted); background: var(--bg-surface-solid); }

        /* BUTTONS */
        .btn-primary {
          background: var(--primary); color: var(--bg-body);
          border: 1px solid transparent; border-radius: 100px; font-weight: 600; font-size: 0.95rem;
          padding: 0.875rem 1.75rem !important; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          letter-spacing: -0.01em;
        }
        .btn-primary:hover:not(:disabled) { background: var(--primary-hover); transform: scale(1.02); }
        .btn-primary:active:not(:disabled) { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .btn-secondary {
          background: var(--bg-surface-solid); color: var(--text-main); border: 1px solid var(--border-color);
          border-radius: 100px; font-weight: 600; font-size: 0.85rem;
          padding: 0.6rem 1.25rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: 0.2s;
        }
        .btn-secondary:hover { background: var(--bg-surface-hover); border-color: var(--text-muted); }

        .btn-sm { height: 36px; padding: 0 1.25rem !important; font-size: 0.85rem; }
        .btn-lg { padding: 1.125rem 2.5rem !important; font-size: 1.05rem; }

        /* HERO & FEATURES (ENTERPRISE SAAS) */
        .hero-section { padding: 6rem 0 5rem; }
        .badge-pill { padding: 6px 16px; font-size: 0.8rem; font-weight: 600; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 50px; backdrop-filter: blur(12px); box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .pulse-dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; box-shadow: 0 0 0 rgba(34, 197, 94, 0.4); animation: pulseDot 2s infinite; }
        @keyframes pulseDot { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
        
        .hero-title { font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 800; line-height: 1.1; margin: 0; letter-spacing: -0.03em; position: relative; z-index: 10; }
        .hero-subtitle { font-size: 1.125rem; color: var(--text-muted); line-height: 1.6; max-width: 600px; font-weight: 400; position: relative; z-index: 10; }

        .hero-glow-bg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; height: 300px; background: var(--primary); opacity: 0.12; filter: blur(120px); border-radius: 50%; z-index: 0; pointer-events: none; }

        .shadow-premium-glow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08), 0 0 40px -10px var(--border-color); }

        .preview-card { overflow: hidden; border-radius: var(--radius-lg); }
        .preview-header { background: var(--bg-surface-solid); padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 1rem; }
        .preview-dots span { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: var(--border-color); margin-right: 8px; }
        .preview-dots span:nth-child(1) { background: #ff5f56; } .preview-dots span:nth-child(2) { background: #ffbd2e; } .preview-dots span:nth-child(3) { background: #27c93f; }
        .preview-body { padding: 2rem; text-align: left; }
        .preview-mock-input { background: var(--bg-surface-solid); border: 1px solid var(--border-color); padding: 1rem; border-radius: var(--radius-sm); color: var(--text-muted); word-break: break-all; }
        .preview-mock-output { background: var(--bg-surface-solid); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: var(--radius-sm); font-size: 0.9rem; color: var(--text-main); line-height: 1.6; border-left: 3px solid var(--success-border); }
        
        .loading-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid var(--border-color); border-radius: 50%; border-top-color: var(--primary); animation: spin 0.8s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .features-section { padding: 6rem 0; }
        .section-title { font-size: clamp(1.75rem, 3vw, 2.5rem); font-weight: 800; letter-spacing: -0.02em; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
        .feature-card { padding: 2.5rem 2rem; text-align: left; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); border-radius: var(--radius-lg); position: relative; }
        .group-hover-effect:hover { transform: translateY(-8px); border-color: var(--text-muted); box-shadow: 0 12px 30px -10px rgba(0,0,0,0.1); }
        .feature-icon-box { width: 56px; height: 56px; background: var(--bg-surface-solid); border: 1px solid var(--border-color); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.04); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .group-hover-effect:hover .feature-icon-box { transform: scale(1.1) rotate(-5deg); }

        .pricing-section { padding: 5rem 0 6rem; }
        .pricing-card { max-width: 480px; margin: 0 auto; padding: 3rem 2.5rem; border-radius: var(--radius-lg); }
        .absolute-glow { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 80%; height: 100px; background: radial-gradient(ellipse at top, rgba(161, 161, 170, 0.15), transparent 70%); pointer-events: none; }
        .price-huge { font-size: 4rem; font-weight: 800; color: var(--text-main); display: flex; justify-content: center; align-items: baseline; letter-spacing: -0.04em; gap: 8px; }
        .price-huge .currency { font-size: 1.5rem; letter-spacing: normal; margin-bottom: 0; }
        .price-huge .suffix { font-size: 0.95rem; letter-spacing: normal; white-space: nowrap; }
        .pricing-list { list-style: none; padding: 0; text-align: left; display: flex; flex-direction: column; gap: 12px; }
        .pricing-list li { font-size: 0.95rem; display: flex; gap: 12px; align-items: flex-start; color: var(--text-main); }
        .icon-wrap { background: var(--success-light); color: var(--success-border); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .icon-wrap svg { width: 12px; height: 12px; stroke-width: 4; }

        /* WORKSPACE & CARDS */
        .tool-section { padding: 2rem 0 6rem; flex: 1; }
        .tool-container { max-width: 720px; }
        
        /* CITATION STYLE TOGGLE */
        .style-toggle { background: var(--bg-surface-solid); border: 1px solid var(--border-color); border-radius: 8px; padding: 4px; display: inline-flex; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .style-toggle-btn { background: transparent; border: none; padding: 6px 12px; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); border-radius: 6px; cursor: pointer; transition: 0.2s; font-family: inherit; display: flex; align-items: center; gap: 6px; }
        .style-toggle-btn:hover:not(.active) { color: var(--text-main); background: var(--bg-surface-hover); }
        .style-toggle-btn.active { background: var(--text-main); color: var(--bg-surface-solid); box-shadow: 0 2px 6px rgba(0,0,0,0.1); }

        /* IOS STYLE SEGMENTED CONTROL */
        .segmented-control-wrapper { background: var(--bg-surface-hover); }
        .segmented-control { display: flex; gap: 4px; padding: 4px; background: var(--border-color); border-radius: 12px; }
        .scrollable-tabs { overflow-x: auto; white-space: nowrap; scrollbar-width: none; }
        .scrollable-tabs::-webkit-scrollbar { display: none; }
        .segmented-btn { flex: 1; min-width: 110px; background: transparent; border: none; padding: 0.6rem 0.5rem; font-weight: 600; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; border-radius: 8px; transition: all 0.2s ease; }
        .segmented-btn:hover:not(.active) { color: var(--text-main); }
        .segmented-btn.active { background: var(--bg-surface-solid); color: var(--text-main); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

        /* FORMS MODERN */
        .input-label { display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem; }
        .input-field-modern { width: 100%; padding: 0.875rem 1.25rem; font-size: 0.95rem; color: var(--text-main); background: var(--bg-surface-solid); border: 1px solid var(--border-color); border-radius: var(--radius-sm); outline: none; transition: all 0.2s; font-family: inherit; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .input-field-modern::placeholder { color: var(--text-muted); opacity: 0.6; }
        .input-field-modern:focus { border-color: var(--border-focus); box-shadow: 0 0 0 1px var(--border-focus); }
        .textarea-field { min-height: 140px; resize: vertical; line-height: 1.6; }

        /* RESULTS AREA & HISTORY */
        .result-block { background: var(--bg-surface-solid); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; }
        .result-header { padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); }
        .result-html { padding: 1.25rem; font-size: 0.95rem; line-height: 1.7; word-break: break-word; color: var(--text-main); }
        
        .btn-copy-modern { background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px; font-size: 0.75rem; font-weight: 600; color: var(--text-main); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: 0.2s; font-family: inherit; }
        .btn-copy-modern:hover { background: var(--bg-surface-hover); border-color: var(--text-muted); }
        .btn-sm-padding { padding: 4px; }

        .history-container { max-height: 480px; overflow-y: auto; }
        
        /* CUSTOM SCROLLBAR */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

        /* MODALS & ALERTS */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 1rem; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
        .modal-box { background: var(--bg-surface-solid); width: 100%; max-width: 420px; border-radius: var(--radius-lg); border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.2); overflow: hidden; }
        .modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
        .modal-body { padding: 1.5rem; }

        .btn-close-modal { background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 50%; transition: 0.2s; }
        .btn-close-modal:hover { background: var(--bg-surface-hover); color: var(--text-main); }
        
        .grid-packages { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
        
        .btn-package { background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.875rem 0.5rem; font-weight: 600; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; transition: all 0.2s ease; text-align: center; }
        .btn-package:hover { border-color: var(--border-focus); color: var(--text-main); }
        .btn-package.active { border-color: var(--text-main); background: var(--text-main); color: var(--bg-surface-solid); box-shadow: 0 4px 12px rgba(0,0,0,0.15); transform: translateY(-1px); }
        
        .price-tag { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem; background: var(--bg-surface-hover); border-radius: var(--radius-sm); border: 1px solid var(--border-color); }

        .notification-toast { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: var(--text-main); color: var(--bg-surface-solid); padding: 0.875rem 1.5rem; border-radius: 100px; font-weight: 600; font-size: 0.9rem; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); }
        
        /* TRUE SHIMMER SKELETON */
        .skeleton-line { height: 16px; background: linear-gradient(90deg, var(--skeleton-bg) 25%, var(--skeleton-hl) 50%, var(--skeleton-bg) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
        .skeleton-box { background: linear-gradient(90deg, var(--skeleton-bg) 25%, var(--skeleton-hl) 50%, var(--skeleton-bg) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-sm); width: 100%; }
        .w-40 { width: 10rem; } .w-48 { width: 12rem; } .h-24 { height: 6rem; } .h-20 { height: 5rem; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        /* FOOTER */
        .footer { padding: 4rem 0; text-align: center; border-top: 1px solid var(--border-color); margin-top: auto; }

        /* ANIMATIONS */
        .animate-fade { animation: fadeIn 0.4s ease; } 
        .animate-fade-in { animation: fadeIn 0.3s ease forwards; }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up-delayed { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards; opacity: 0; }
        .animate-slide-up-fade { animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUpFade { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }

        /* RESPONSIVE */
        @media (max-width: 640px) {
          .hidden-mobile { display: none !important; }
          .grid-2 { grid-template-columns: 1fr; } .col-span-2 { grid-column: span 1; }
          .preview-body { grid-template-columns: 1fr; padding: 1.5rem; } .border-r { border-right: none; border-bottom: 1px solid var(--border-color); padding-bottom: 1.5rem; padding-right: 0; } .pl-2 { padding-left: 0; }
          .navbar { border-radius: var(--radius-md); padding: 0.6rem 0.6rem 0.6rem 1rem; }
          .nav-logo span { display: none; }
          .pricing-card { padding: 2rem 1.5rem; border-radius: var(--radius-md); border-left: none; border-right: none; }
          .price-huge { font-size: 3rem; }
          .style-toggle-btn { flex: 1; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
