import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
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

// Fungsi pembantu agar tidak crash di lingkungan pratinjau (Canvas).
// SAAT DI VS CODE (VITE): Anda bisa langsung mengganti getEnv(key) dengan import.meta.env[key]
const getEnv = (key) => {
  try {
    return typeof process !== "undefined" && process.env
      ? process.env[key]
      : "";
  } catch (e) {
    return "";
  }
};

// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID"),
};

// 2. BAYAR.GG CONFIGURATION
const BAYAR_GG_API_KEY = getEnv("VITE_BAYAR_GG_API_KEY");

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
  const [isDarkMode, setIsDarkMode] = useState(false);

  // User & Credit State
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({ credits: 0 });
  const [history, setHistory] = useState([]);

  // Payment State
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState(50); // Default 50 credits
  const [isPaying, setIsPaying] = useState(false);

  // Mode State (Tabs)
  const [inputMode, setInputMode] = useState("doi");

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

  // --- THEME & INITIALIZATION ---
  useEffect(() => {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    )
      setIsDarkMode(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light",
    );
  }, [isDarkMode]);

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
    if (topupAmount < 1) return showNotification("Minimal pembelian 1 kredit.");
    if (!BAYAR_GG_API_KEY)
      return showNotification(
        "API Key Bayar.gg belum disetting di file env lokal Anda!",
      );

    setIsPaying(true);
    const price = topupAmount * 750;

    try {
      // ⚠️ Peringatan: API Call ini idealnya dilakukan dari backend agar key benar-benar aman.
      const response = await fetch("https://api.bayar.gg/v1/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${BAYAR_GG_API_KEY}`,
        },
        body: JSON.stringify({
          amount: price,
          customer_name: user.displayName || "Pengguna FlashCite",
          customer_email: user.email || "",
          reference_id: `TOPUP_${user.uid}_${Date.now()}`,
          description: `Top Up ${topupAmount} Kredit FlashCite`,
          return_url: window.location.href,
        }),
      });

      const data = await response.json();

      if (response.ok && data.data && data.data.checkout_url) {
        // Simulasi tambah kredit langsung (di produksi, ganti ini dengan webhook Bayar.gg)
        const profileRef = doc(db, "users", user.uid);
        await updateDoc(profileRef, {
          credits: (userData.credits || 0) + topupAmount,
        });
        window.location.href = data.data.checkout_url;
      } else {
        throw new Error(data.message || "Gagal membuat sesi pembayaran.");
      }
    } catch (err) {
      console.warn("Bayar.gg error:", err);
      showNotification(err.message || "Error menghubungkan ke Bayar.gg.");
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
    await updateDoc(profileRef, { credits: currentCredits - amount });
    return true;
  };

  const refundCredit = async (amount = 1) => {
    if (!user || !db) return;
    const currentCredits = userData.credits || 0;
    const profileRef = doc(db, "users", user.uid);
    await updateDoc(profileRef, { credits: currentCredits + amount });
  };

  const saveToHistory = async (meta, fn, dp, inputVal, type) => {
    if (!user || !db) return;
    const historyRef = collection(db, "users", user.uid, "history");
    await addDoc(historyRef, {
      type,
      input: inputVal,
      title: meta.title,
      footnote: fn,
      dafpus: dp,
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
      setMetadata(meta);
      setFootnoteResult(fn);
      setDafpusResult(dp);
      await saveToHistory(meta, fn, dp, doiInput, "DOI");
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
      setMetadata(meta);
      setFootnoteResult(fn);
      setDafpusResult(dp);
      await saveToHistory(meta, fn, dp, urlInput, "URL");
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

    setMetadata(meta);
    setFootnoteResult(fn);
    setDafpusResult(dp);
    await saveToHistory(meta, fn, dp, "Input Manual", "Manual");
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
        await saveToHistory(meta, fn, dp, line, "Batch");
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
  const BoltIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      height="24"
      width="24"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
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
  const SunIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      height="20"
      width="20"
    >
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  );
  const MoonIcon = () => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      height="20"
      width="20"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
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
    <div className="card mt-6">
      <div className="p-6 skeleton-pulse">
        <div className="h-4 w-48 rounded bg-skeleton mb-6"></div>
        <div className="h-16 w-full rounded bg-skeleton mb-6"></div>
        <div className="h-4 w-48 rounded bg-skeleton mb-6"></div>
        <div className="h-16 w-full rounded bg-skeleton"></div>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper">
      {/* Peringatan ketika dibuka di Canvas/Tanpa Env */}
      {!firebaseConfig.apiKey && (
        <div
          style={{
            padding: "0.5rem",
            textAlign: "center",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: "0.85rem",
          }}
        >
          ⚠️ Peringatan: Konfigurasi API Key di file .env belum diset. Pastikan
          Anda mengaturnya di environment lokal.
        </div>
      )}

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="notification-toast animate-fade">{notification}</div>
      )}

      {/* TOPUP MODAL */}
      {showTopupModal && (
        <div className="modal-overlay">
          <div className="modal-box animate-slide-up">
            <div className="modal-header">
              <h3 className="m-0 flex items-center gap-2">
                <CoinIcon /> Top Up Kredit
              </h3>
              <button
                className="btn-icon border-none"
                onClick={() => setShowTopupModal(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted mb-4 mt-0 text-sm">
                Kredit Anda habis. Harga per 1 sitasi sukses hanya Rp 750.
              </p>

              <div className="grid-2 gap-2 mb-4">
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
                <label className="text-sm font-semibold mb-2 block">
                  Nominal Custom:
                </label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={topupAmount}
                  onChange={(e) =>
                    setTopupAmount(parseInt(e.target.value) || 0)
                  }
                />
              </div>

              <div className="price-tag mt-6">
                <span>Total Bayar:</span>
                <span className="font-bold text-lg text-primary">
                  Rp {(topupAmount * 750).toLocaleString("id-ID")}
                </span>
              </div>

              <button
                className="btn-primary w-full mt-4"
                onClick={processPayment}
                disabled={isPaying}
              >
                {isPaying ? "Menghubungkan API..." : "Bayar via Bayar.gg"}
              </button>
              <p className="text-xs text-muted text-center mt-3">
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
              <BoltIcon /> FlashCite
            </div>

            <div className="nav-actions">
              {user && currentView === "tool" && (
                <div
                  className="credit-badge"
                  onClick={() => setShowTopupModal(true)}
                >
                  <CoinIcon /> {userData.credits || 0}
                </div>
              )}

              <button
                className="theme-toggle"
                onClick={() => setIsDarkMode(!isDarkMode)}
              >
                {isDarkMode ? <SunIcon /> : <MoonIcon />}
              </button>

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
                  Logout
                </button>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* --- VIEW 1: LANDING PAGE (SaaS Enterprise Level) --- */}
      {currentView === "landing" && (
        <>
          {/* Hero Section */}
          <section id="hero" className="hero-section animate-fade">
            <div className="container text-center">
              <div className="badge-pill mx-auto mb-4">
                🚀 Tools Sitasi Jurnal AI Terbaik di Indonesia
              </div>
              <h1 className="hero-title">
                Ubah Link PDF dan DOI Menjadi <br />
                <span className="text-gradient">Sitasi Sempurna</span> Seketika.
              </h1>
              <p className="hero-subtitle mx-auto">
                Berhenti menyusun daftar pustaka secara manual. Ekstrak metadata
                dari Academia, ResearchGate, dan sistem OJS hanya dalam hitungan
                detik.
              </p>
              <div className="hero-cta mt-8">
                <button
                  onClick={handleLoginAndEnter}
                  className="btn-primary btn-lg"
                  disabled={loading}
                >
                  {loading
                    ? "Memuat Workspace..."
                    : "Mulai Gratis Sekarang (Dapat 5 Kredit)"}
                </button>
              </div>
            </div>
          </section>

          {/* Live Preview Section */}
          <section className="preview-section animate-fade mt-8">
            <div className="container">
              <div className="preview-card">
                <div className="preview-header">
                  <div className="preview-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="text-xs font-semibold text-muted">
                    Contoh Hasil Otomatis (Demo)
                  </span>
                </div>
                <div className="preview-body grid-2 gap-4">
                  <div className="preview-col border-r">
                    <span className="text-xs font-bold text-muted uppercase tracking-wide">
                      Input: Link Jurnal/PDF
                    </span>
                    <div className="preview-mock-input mt-2">
                      https://www.academia.edu/download/111297711/214.pdf
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-primary font-semibold">
                      <span className="loading-spinner"></span> AI Membedah
                      PDF...
                    </div>
                  </div>
                  <div className="preview-col">
                    <span className="text-xs font-bold text-success uppercase tracking-wide flex items-center gap-1">
                      <CheckIcon /> Output: Berhasil
                    </span>
                    <div className="preview-mock-output mt-2">
                      <strong>Catatan Kaki:</strong>
                      <br />
                      Budi Santoso (2024) Analisis Pajak PPh 21 Terhadap UMKM.
                      Jurnal Ekonomi Terapan. Jakarta, hal. 12-25.
                    </div>
                    <div className="preview-mock-output mt-2">
                      <strong>Daftar Pustaka:</strong>
                      <br />
                      Santoso, Budi. (2024) "Analisis Pajak PPh 21 Terhadap
                      UMKM". Jurnal Ekonomi Terapan, Jakarta.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works (Langkah) */}
          <section className="steps-section animate-fade">
            <div className="container text-center">
              <h2 className="section-title">Semudah Copy & Paste</h2>
              <p className="section-subtitle mx-auto mb-8">
                Hemat berjam-jam waktu penulisan skripsi atau jurnal Anda dengan
                3 langkah sederhana.
              </p>

              <div className="grid-3">
                <div className="step-card">
                  <div className="step-number">1</div>
                  <h3>Salin Tautan</h3>
                  <p>
                    Salin URL jurnal, link PDF, atau nomor DOI artikel yang
                    ingin Anda sitasi.
                  </p>
                </div>
                <div className="step-card">
                  <div className="step-number">2</div>
                  <h3>AI Bekerja</h3>
                  <p>
                    Mesin Bypass kami akan menembus proteksi web dan mengekstrak
                    Penulis, Judul, serta Tahun otomatis.
                  </p>
                </div>
                <div className="step-card">
                  <div className="step-number">3</div>
                  <h3>Selesai</h3>
                  <p>
                    Dapatkan format Catatan Kaki (Footnote) dan Daftar Pustaka
                    yang siap disalin ke Word.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Features Detail */}
          <section id="features" className="features-section animate-fade">
            <div className="container">
              <div className="grid-3">
                <div className="feature-card">
                  <div className="feature-icon">🛡️</div>
                  <h3>Anti-Cloudflare Bypass</h3>
                  <p>
                    Mengekstrak data otomatis meski web sumber diproteksi sistem
                    keamanan Cloudflare (seperti Academia & ResearchGate).
                  </p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🤖</div>
                  <h3>AI Self-Healing</h3>
                  <p>
                    Jika jurnal PDF rusak/tidak terbaca, AI Semantic Scholar
                    kami otomatis menyembuhkan dan melacak metadata aslinya.
                  </p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">⚡</div>
                  <h3>Sistem Batch Super</h3>
                  <p>
                    Punya 50 daftar referensi jurnal? Paste semua URL sekaligus
                    dan dapatkan daftar pustaka urut abjad seketika.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Pricing & Transparency */}
          <section className="pricing-section animate-fade">
            <div className="container text-center">
              <div className="pricing-card">
                <h2 className="m-0 mb-2">Harga yang Sangat Transparan</h2>
                <p className="text-muted m-0 mb-6">
                  Kami tidak menggunakan sistem langganan bulanan. Anda hanya
                  membayar apa yang Anda gunakan (Pay-As-You-Go).
                </p>

                <div className="price-huge">
                  Rp 750{" "}
                  <span className="text-sm font-normal text-muted">
                    / Sitasi Sukses
                  </span>
                </div>

                <ul className="pricing-list mt-6 mb-6">
                  <li>
                    <CheckIcon /> Gratis 5 Kredit untuk pengguna baru.
                  </li>
                  <li>
                    <CheckIcon /> Kredit <strong>TIDAK AKAN HANGUS</strong> /
                    berkurang jika link rusak atau gagal diekstrak.
                  </li>
                  <li>
                    <CheckIcon /> Riwayat sitasi tersimpan selamanya di Cloud.
                  </li>
                  <li>
                    <CheckIcon /> Pembayaran instan via QRIS, GoPay, OVO, dll.
                  </li>
                </ul>

                <button
                  onClick={handleLoginAndEnter}
                  className="btn-primary w-full flex justify-center gap-2"
                >
                  Mulai Pengalaman Bebas Stres <ArrowRightIcon />
                </button>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="faq-section animate-fade mb-8">
            <div className="container">
              <h2 className="text-center mb-6">Pertanyaan Umum (FAQ)</h2>
              <div className="grid-2 gap-4">
                <div className="faq-item">
                  <h4>Apakah semua link PDF bisa terbaca?</h4>
                  <p className="text-sm text-muted">
                    Sebagian besar PDF jurnal modern (OJS) bisa. Namun jika PDF
                    tersebut adalah hasil *scan* gambar fisik tanpa OCR, AI kami
                    akan mencoba melacak judulnya via database global.
                  </p>
                </div>
                <div className="faq-item">
                  <h4>Bagaimana jika gagal, apakah saldo terpotong?</h4>
                  <p className="text-sm text-muted">
                    Tidak. Jika sistem mendeteksi kegagalan ekstraksi atau link
                    rusak, sistem akan otomatis melakukan *Refund* 1 Kredit ke
                    akun Anda dalam hitungan detik.
                  </p>
                </div>
                <div className="faq-item">
                  <h4>Metode pembayaran apa saja yang didukung?</h4>
                  <p className="text-sm text-muted">
                    Kami terintegrasi dengan Bayar.gg yang mendukung pembayaran
                    QRIS, e-Wallet (OVO, Dana, ShopeePay), dan Virtual Account
                    berbagai bank.
                  </p>
                </div>
                <div className="faq-item">
                  <h4>Apakah saya bisa mengedit hasil sitasi?</h4>
                  <p className="text-sm text-muted">
                    Bisa. Jika ada detail kecil yang meleset, Anda bisa
                    meng-copy hasilnya ke Word dan menyesuaikannya secara
                    manual, atau gunakan mode 'Manual' di aplikasi kami.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <footer className="footer animate-fade">
            <div className="container footer-content">
              <div className="footer-brand">
                <BoltIcon /> FlashCite
                <p className="mt-2 text-sm max-w-sm mx-auto">
                  Automasi sitasi akademik pintar untuk penulisan karya ilmiah
                  instan. Hemat waktu Anda untuk penelitian, bukan untuk format
                  referensi.
                </p>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* --- VIEW 2: WORKSPACE APP --- */}
      {currentView === "tool" && user && (
        <section className="tool-section animate-slide-up">
          <div className="container tool-container">
            <div className="tool-header flex items-center justify-between mb-6">
              <div>
                <h2 className="section-title text-left m-0">Ruang Kerja</h2>
                <p className="section-subtitle text-left m-0">
                  Ekstrak metadata instan dengan presisi tinggi.
                </p>
              </div>
            </div>

            <div className="card shadow-md">
              <div className="card-tabs scrollable-tabs">
                <button
                  className={`tab-btn ${inputMode === "doi" ? "active" : ""}`}
                  onClick={() => setInputMode("doi")}
                >
                  Nomor DOI
                </button>
                <button
                  className={`tab-btn ${inputMode === "url" ? "active" : ""}`}
                  onClick={() => setInputMode("url")}
                >
                  Link Web/PDF
                </button>
                <button
                  className={`tab-btn ${inputMode === "batch" ? "active" : ""}`}
                  onClick={() => setInputMode("batch")}
                >
                  Mode Batch
                </button>
                <button
                  className={`tab-btn ${inputMode === "manual" ? "active" : ""}`}
                  onClick={() => setInputMode("manual")}
                >
                  Manual
                </button>
                <button
                  className={`tab-btn ${inputMode === "history" ? "active" : ""}`}
                  onClick={() => setInputMode("history")}
                >
                  Riwayat
                </button>
              </div>

              <div className="card-body">
                {inputMode === "doi" && (
                  <div className="animate-fade">
                    <div className="form-group">
                      <input
                        type="text"
                        className="input-field"
                        value={doiInput}
                        onChange={(e) => setDoiInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchDOI()}
                        placeholder="Paste Nomor DOI (Misal: 10.1038/s41586...)"
                      />
                    </div>
                    <div className="form-group mb-6">
                      <input
                        type="text"
                        className="input-field"
                        value={kotaInput}
                        onChange={(e) => setKotaInput(e.target.value)}
                        placeholder="Kota Terbit (Opsional)"
                      />
                    </div>
                    <button
                      className="btn-primary w-full"
                      onClick={fetchDOI}
                      disabled={loading || !doiInput}
                    >
                      {loading
                        ? "Memproses (1 Kredit)..."
                        : "Generate Sitasi (1 Kredit)"}
                    </button>
                  </div>
                )}

                {inputMode === "url" && (
                  <div className="animate-fade">
                    <div className="form-group">
                      <input
                        type="text"
                        className="input-field"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchURL()}
                        placeholder="Paste Link Artikel / URL PDF Jurnal"
                      />
                    </div>
                    <div className="form-group mb-6">
                      <input
                        type="text"
                        className="input-field"
                        value={kotaInput}
                        onChange={(e) => setKotaInput(e.target.value)}
                        placeholder="Kota Terbit (Opsional)"
                      />
                    </div>
                    <button
                      className="btn-primary w-full"
                      onClick={fetchURL}
                      disabled={loading || !urlInput}
                    >
                      {loading
                        ? "Menganalisis Tautan (1 Kredit)..."
                        : "Generate Sitasi (1 Kredit)"}
                    </button>
                  </div>
                )}

                {inputMode === "manual" && (
                  <div className="animate-fade">
                    <div className="grid-2 gap-4">
                      <div className="col-span-2">
                        <input
                          type="text"
                          className="input-field"
                          value={mAuthor}
                          onChange={(e) => setMAuthor(e.target.value)}
                          placeholder="Nama Penulis Lengkap *"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          className="input-field"
                          value={mTitle}
                          onChange={(e) => setMTitle(e.target.value)}
                          placeholder="Judul Artikel *"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          className="input-field"
                          value={mJournal}
                          onChange={(e) => setMJournal(e.target.value)}
                          placeholder="Nama Jurnal"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          className="input-field"
                          value={mYear}
                          onChange={(e) => setMYear(e.target.value)}
                          placeholder="Tahun Terbit *"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          className="input-field"
                          value={mVolume}
                          onChange={(e) => setMVolume(e.target.value)}
                          placeholder="Volume"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          className="input-field"
                          value={mIssue}
                          onChange={(e) => setMIssue(e.target.value)}
                          placeholder="Isu / Nomor"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          className="input-field"
                          value={mPage}
                          onChange={(e) => setMPage(e.target.value)}
                          placeholder="Halaman"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          className="input-field"
                          value={kotaInput}
                          onChange={(e) => setKotaInput(e.target.value)}
                          placeholder="Kota Terbit"
                        />
                      </div>
                    </div>
                    <button
                      className="btn-primary w-full mt-6"
                      onClick={handleGenerateManual}
                    >
                      Generate Manual (1 Kredit)
                    </button>
                  </div>
                )}

                {inputMode === "batch" && (
                  <div className="animate-fade">
                    <div className="form-group">
                      <textarea
                        className="input-field textarea-field"
                        value={batchInput}
                        onChange={(e) => setBatchInput(e.target.value)}
                        placeholder="Paste banyak URL atau DOI di sini (1 Baris = 1 Link/DOI)"
                      />
                    </div>
                    <div className="form-group mb-6">
                      <input
                        type="text"
                        className="input-field"
                        value={kotaInput}
                        onChange={(e) => setKotaInput(e.target.value)}
                        placeholder="Kota Terbit Global (Opsional)"
                      />
                    </div>
                    <button
                      className="btn-primary w-full"
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
                  <div className="animate-fade history-container">
                    {history.length === 0 ? (
                      <div className="text-center text-muted p-6">
                        Riwayat sitasi masih kosong.
                      </div>
                    ) : (
                      history.map((item) => (
                        <div
                          key={item.id}
                          className="history-item mb-4 border-b pb-4"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="badge-pill text-xs">
                              {item.type}
                            </span>
                            <span className="text-xs text-muted">
                              {new Date(item.timestamp).toLocaleDateString(
                                "id-ID",
                              )}
                            </span>
                          </div>
                          <h4 className="m-0 mb-2 font-semibold text-sm truncate-2">
                            {item.title}
                          </h4>
                          <div className="flex gap-2 mt-3">
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() =>
                                handleCopy(item.footnote, `hist-fn-${item.id}`)
                              }
                            >
                              {copiedId === `hist-fn-${item.id}` ? (
                                <CheckIcon />
                              ) : (
                                <CopyIcon />
                              )}{" "}
                              Footnote
                            </button>
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() =>
                                handleCopy(item.dafpus, `hist-dp-${item.id}`)
                              }
                            >
                              {copiedId === `hist-dp-${item.id}` ? (
                                <CheckIcon />
                              ) : (
                                <CopyIcon />
                              )}{" "}
                              Dafpus
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {error && (
                  <div className="error-alert mt-6 animate-fade">
                    <WarningIcon /> {error}
                  </div>
                )}
              </div>
            </div>

            {loading && inputMode !== "batch" && <SkeletonLoader />}
            {loading && inputMode === "batch" && (
              <>
                <SkeletonLoader />
                <div style={{ opacity: 0.5 }}>
                  <SkeletonLoader />
                </div>
              </>
            )}

            {/* RESULTS AREA: SINGLE */}
            {!loading &&
              metadata &&
              inputMode !== "batch" &&
              inputMode !== "history" && (
                <div className="card shadow-md mt-6 animate-slide-up border-success">
                  <div className="card-body">
                    <div className="result-block">
                      <div className="result-header">
                        <span>CATATAN KAKI (FOOTNOTE)</span>
                        <button
                          className="btn-icon"
                          onClick={() =>
                            handleCopy(footnoteResult, "single-fn")
                          }
                        >
                          {copiedId === "single-fn" ? (
                            <>
                              <CheckIcon /> Disalin
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
                        dangerouslySetInnerHTML={{ __html: footnoteResult }}
                      />
                    </div>
                    <div className="result-block mt-6">
                      <div className="result-header">
                        <span>DAFTAR PUSTAKA</span>
                        <button
                          className="btn-icon"
                          onClick={() => handleCopy(dafpusResult, "single-dp")}
                        >
                          {copiedId === "single-dp" ? (
                            <>
                              <CheckIcon /> Disalin
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
                        dangerouslySetInnerHTML={{ __html: dafpusResult }}
                      />
                    </div>
                  </div>
                </div>
              )}

            {/* RESULTS AREA: BATCH */}
            {!loading && batchResults.length > 0 && inputMode === "batch" && (
              <div className="card shadow-md mt-6 animate-slide-up border-success">
                <div className="card-body">
                  {batchSuccesses.length > 0 && (
                    <>
                      <h3 className="batch-title">
                        Catatan Kaki ({batchSuccesses.length})
                      </h3>
                      {batchSuccesses.map((r, index) => {
                        const content = buildFootnote(r.meta, kotaInput);
                        const copyId = `batch-fn-${index}`;
                        return (
                          <div className="result-block mb-4" key={copyId}>
                            <div className="result-header">
                              <span className="truncate">{r.line}</span>
                              <button
                                className="btn-icon"
                                onClick={() => handleCopy(content, copyId)}
                              >
                                {copiedId === copyId ? (
                                  <CheckIcon />
                                ) : (
                                  <CopyIcon />
                                )}
                              </button>
                            </div>
                            <div
                              className="result-html"
                              dangerouslySetInnerHTML={{ __html: content }}
                            />
                          </div>
                        );
                      })}
                      <h3 className="batch-title mt-8">
                        Daftar Pustaka A-Z ({sortedBatchDafpus.length})
                      </h3>
                      {sortedBatchDafpus.map((r, index) => {
                        const content = buildDafpus(r.meta, kotaInput);
                        const copyId = `batch-dp-${index}`;
                        return (
                          <div className="result-block mb-4" key={copyId}>
                            <div className="result-header">
                              <span className="truncate">{r.line}</span>
                              <button
                                className="btn-icon"
                                onClick={() => handleCopy(content, copyId)}
                              >
                                {copiedId === copyId ? (
                                  <CheckIcon />
                                ) : (
                                  <CopyIcon />
                                )}
                              </button>
                            </div>
                            <div
                              className="result-html"
                              dangerouslySetInnerHTML={{ __html: content }}
                            />
                          </div>
                        );
                      })}
                    </>
                  )}
                  {batchErrors.length > 0 && (
                    <div className="error-alert mt-8">
                      <strong>Gagal (Otomatis Di-Refund):</strong>
                      <ul className="mt-2 pl-4 list-disc">
                        {batchErrors.map((err, i) => (
                          <li key={i} className="text-sm">
                            {err.line} - {err.error}
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

      {/* --- CSS STYLING & VARIABLES ISOLATION --- */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .app-wrapper {
          --bg-body: #f8fafc;
          --bg-surface: #ffffff;
          --bg-surface-hover: #f1f5f9;
          
          --text-main: #0f172a;
          --text-muted: #64748b;
          
          --border-color: #e2e8f0;
          --border-focus: #3b82f6;
          
          --primary: #2563eb;
          --primary-hover: #1d4ed8;
          --primary-gradient: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
          
          --success-light: #f0fdf4;
          --success: #22c55e;
          --success-border: #22c55e;
          --error-bg: #fef2f2;
          --error-text: #b91c1c;

          --nav-bg: rgba(255, 255, 255, 0.85);
          --skeleton-bg: #e2e8f0;

          --radius-sm: 8px;
          --radius-md: 12px;
          
          min-height: 100vh;
          background-color: var(--bg-body);
          color: var(--text-main);
          font-family: 'Inter', system-ui, sans-serif;
          transition: background-color 0.3s ease, color 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        html[data-theme="dark"] .app-wrapper,
        [data-theme="dark"] .app-wrapper {
          --bg-body: #0b1120;
          --bg-surface: #1e293b;
          --bg-surface-hover: #334155;
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --border-color: #334155;
          --border-focus: #60a5fa;
          --primary: #3b82f6;
          --primary-hover: #60a5fa;
          --primary-gradient: linear-gradient(135deg, #3b82f6 0%, #818cf8 100%);
          --success-light: rgba(34, 197, 94, 0.1);
          --success: #4ade80;
          --success-border: #22c55e;
          --error-bg: rgba(239, 68, 68, 0.1);
          --error-text: #fca5a5;
          --nav-bg: rgba(30, 41, 59, 0.85);
          --skeleton-bg: #334155;
        }

        * { box-sizing: border-box; }
        .container { max-width: 900px; margin: 0 auto; padding: 0 1.5rem; }

        /* UTILS */
        .text-center { text-align: center; } .text-left { text-align: left; }
        .text-gradient { background: var(--primary-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }
        .justify-center { justify-content: center; }
        .gap-1 { gap: 0.25rem; } .gap-2 { gap: 0.5rem; } .gap-4 { gap: 1rem; }
        .m-0 { margin: 0; } .mx-auto { margin-left: auto; margin-right: auto; }
        .mt-2 { margin-top: 0.5rem; } .mt-3 { margin-top: 0.75rem; } .mt-4 { margin-top: 1rem; } 
        .mt-6 { margin-top: 1.5rem; } .mt-8 { margin-top: 2rem; }
        .mb-2 { margin-bottom: 0.5rem; } .mb-4 { margin-bottom: 1rem; } .mb-6 { margin-bottom: 1.5rem; } .mb-8 { margin-bottom: 2rem; }
        .pb-4 { padding-bottom: 1rem; } 
        .border-b { border-bottom: 1px solid var(--border-color); }
        .border-r { border-right: 1px solid var(--border-color); }
        .text-sm { font-size: 0.875rem; } .text-xs { font-size: 0.75rem; } .text-muted { color: var(--text-muted); }
        .text-success { color: var(--success); }
        .font-normal { font-weight: 400; } .font-semibold { font-weight: 600; } .font-bold { font-weight: 700; } 
        .text-primary { color: var(--primary); }
        .uppercase { text-transform: uppercase; } .tracking-wide { letter-spacing: 0.05em; }
        .max-w-sm { max-width: 24rem; }
        
        .truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        /* NAVBAR KAPSUL */
        .navbar-wrapper {
          position: sticky; top: 16px; z-index: 100;
          padding: 0 1.5rem; display: flex; justify-content: center;
        }
        .navbar {
          width: 100%; max-width: 900px; background: var(--nav-bg);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--border-color); border-radius: 100px;
          padding: 0.75rem 1.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
        }
        .nav-container { display: flex; justify-content: space-between; align-items: center; }
        .nav-logo { font-weight: 800; font-size: 1.25rem; color: var(--text-main); display: flex; align-items: center; gap: 6px; cursor: pointer; }
        .nav-actions { display: flex; align-items: center; gap: 0.75rem; }
        .theme-toggle { background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: var(--radius-sm); transition: 0.2s; }
        .theme-toggle:hover { background: var(--bg-surface-hover); color: var(--text-main); }
        
        .credit-badge {
          display: flex; align-items: center; gap: 4px;
          background: var(--bg-surface-hover); color: var(--text-main);
          padding: 6px 12px; border-radius: 50px; font-size: 0.85rem; font-weight: 600;
          cursor: pointer; border: 1px solid var(--border-color); transition: 0.2s;
        }
        .credit-badge:hover { border-color: var(--primary); }

        /* BUTTONS */
        .btn-primary {
          background: var(--primary); color: #fff;
          border: none; border-radius: var(--radius-sm); font-weight: 600; font-size: 0.95rem;
          padding: 0.875rem 1.5rem !important; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;
        }
        .btn-primary:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        
        .btn-secondary {
          background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-color);
          border-radius: var(--radius-sm); font-weight: 600; font-size: 0.85rem;
          padding: 0.6rem 1rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: 0.2s;
        }
        .btn-secondary:hover { background: var(--bg-surface-hover); }

        .btn-sm { padding: 0.5rem 1rem !important; font-size: 0.85rem; }
        .btn-lg { padding: 1rem 2rem !important; font-size: 1rem; border-radius: var(--radius-md); }
        .w-full { width: 100%; }

        /* HERO & FEATURES (ENHANCED SAAS) */
        .hero-section { padding: 5rem 0 4rem; }
        .badge-pill { display: inline-block; padding: 6px 14px; font-size: 0.8rem; font-weight: 600; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-muted); border-radius: 50px; transition: 0.3s; }
        .hero-title { font-size: 2.75rem; font-weight: 800; line-height: 1.2; margin: 0 0 1.25rem; }
        .hero-subtitle { font-size: 1.1rem; color: var(--text-muted); line-height: 1.6; max-width: 600px; }

        .preview-section { margin-top: 1rem; }
        .preview-card { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
        .preview-header { background: var(--bg-surface-hover); padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 1rem; }
        .preview-dots span { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--border-color); margin-right: 6px; }
        .preview-body { padding: 1.5rem; text-align: left; }
        .preview-mock-input { background: var(--bg-body); border: 1px solid var(--border-color); padding: 0.875rem; border-radius: var(--radius-sm); font-family: monospace; font-size: 0.85rem; color: var(--text-main); word-break: break-all; }
        .preview-mock-output { background: var(--success-light); border: 1px solid var(--success-border); padding: 1rem; border-radius: var(--radius-sm); font-size: 0.9rem; color: var(--text-main); line-height: 1.6; }
        .loading-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--primary); border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .steps-section { padding: 5rem 0; background: var(--bg-surface-hover); margin-top: 4rem; }
        .step-card { padding: 1.5rem; text-align: center; }
        .step-number { width: 40px; height: 40px; background: var(--primary); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.25rem; margin: 0 auto 1rem; }
        .step-card h3 { margin: 0 0 0.5rem; font-size: 1.1rem; }
        .step-card p { margin: 0; color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; }

        .features-section { padding: 4rem 0; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
        .feature-card { background: var(--bg-surface); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: var(--radius-md); text-align: left; transition: transform 0.2s; }
        .feature-card:hover { transform: translateY(-5px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
        .feature-icon { font-size: 2rem; margin-bottom: 1rem; }
        .feature-card h3 { margin: 0 0 0.5rem; font-size: 1.1rem; }
        .feature-card p { margin: 0; color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; }

        .pricing-section { padding: 4rem 0; }
        .pricing-card { max-width: 500px; margin: 0 auto; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 2rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
        .price-huge { font-size: 3rem; font-weight: 800; color: var(--text-main); display: flex; justify-content: center; align-items: baseline; gap: 0.5rem; }
        .pricing-list { list-style: none; padding: 0; margin: 0; text-align: left; }
        .pricing-list li { margin-bottom: 0.75rem; font-size: 0.95rem; display: flex; gap: 8px; align-items: flex-start; }
        .pricing-list li svg { color: var(--success-border); flex-shrink: 0; margin-top: 2px; }

        .faq-section { padding: 3rem 0; }
        .faq-item { background: var(--bg-surface); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: var(--radius-sm); }
        .faq-item h4 { margin: 0 0 0.5rem; font-size: 1rem; color: var(--text-main); }

        /* WORKSPACE & CARDS */
        .tool-section { padding: 2rem 0 6rem; flex: 1; }
        .tool-container { max-width: 700px; }
        .section-title { font-size: 1.75rem; font-weight: 800; margin: 0 0 0.5rem; }
        .section-subtitle { color: var(--text-muted); margin: 0; }

        .card { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; transition: background-color 0.3s ease, border-color 0.3s ease; }
        .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .border-success { border-top: 4px solid var(--success-border); }
        
        .card-tabs { display: flex; border-bottom: 1px solid var(--border-color); background: var(--bg-surface-hover); }
        .scrollable-tabs { overflow-x: auto; white-space: nowrap; }
        .scrollable-tabs::-webkit-scrollbar { display: none; }
        .tab-btn { flex: 1; min-width: 100px; background: transparent; border: none; padding: 1rem 0.5rem; font-weight: 600; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; transition: 0.2s; }
        .tab-btn:hover { color: var(--text-main); background: var(--bg-surface); }
        .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); background: var(--bg-surface); }
        
        .card-body { padding: 1.5rem; }

        /* FORMS */
        .form-group { margin-bottom: 1rem; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
        .input-field { width: 100%; padding: 0.875rem 1rem; font-size: 0.95rem; color: var(--text-main); background: var(--bg-body); border: 1px solid var(--border-color); border-radius: var(--radius-sm); outline: none; transition: 0.2s; }
        .input-field::placeholder { color: var(--text-muted); opacity: 0.7; }
        .input-field:focus { border-color: var(--border-focus); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        .textarea-field { min-height: 120px; resize: vertical; line-height: 1.5; }

        /* RESULTS AREA & HISTORY */
        .result-block { background: var(--bg-body); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; }
        .result-header { padding: 0.75rem 1rem; background: var(--bg-surface-hover); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); }
        .result-html { padding: 1.25rem; font-size: 0.95rem; line-height: 1.6; word-break: break-word; }
        .batch-title { font-size: 1rem; font-weight: 700; margin: 0 0 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
        .truncate { display: inline-block; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .btn-icon { background: transparent; border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; font-weight: 600; color: var(--text-main); cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: 0.2s; }
        .btn-icon:hover { background: var(--bg-surface-hover); border-color: var(--text-muted); }

        .history-container { max-height: 400px; overflow-y: auto; padding-right: 0.5rem; }

        /* MODALS & ALERTS */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 1rem; backdrop-filter: blur(4px); }
        .modal-box { background: var(--bg-surface); width: 100%; max-width: 400px; border-radius: var(--radius-md); border: 1px solid var(--border-color); box-shadow: 0 10px 25px rgba(0,0,0,0.2); overflow: hidden; }
        .modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); background: var(--bg-surface-hover); display: flex; justify-content: space-between; align-items: center; }
        .modal-body { padding: 1.5rem; }
        .btn-package { background: var(--bg-body); border: 2px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem; font-weight: 600; color: var(--text-main); cursor: pointer; transition: 0.2s; }
        .btn-package:hover { border-color: var(--border-focus); }
        .btn-package.active { border-color: var(--primary); background: var(--primary-light); color: var(--primary); }
        .price-tag { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-body); border-radius: var(--radius-sm); }
        .border-none { border: none; }

        .error-alert { background: var(--error-bg); border: 1px solid var(--error-text); color: var(--error-text); padding: 1rem; border-radius: var(--radius-sm); font-size: 0.9rem; display: flex; gap: 10px; align-items: flex-start; }
        .notification-toast { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: var(--text-main); color: var(--bg-surface); padding: 0.75rem 1.5rem; border-radius: 50px; font-weight: 600; font-size: 0.9rem; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        
        .bg-skeleton { background: var(--skeleton-bg); transition: 0.3s; }
        .skeleton-pulse { animation: pulse 1.5s infinite ease-in-out; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* FOOTER */
        .footer { padding: 3rem 0; text-align: center; color: var(--text-muted); font-size: 0.9rem; }

        /* ANIMATIONS */
        .animate-fade { animation: fadeIn 0.3s ease; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.4s ease; } @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* RESPONSIVE */
        @media (max-width: 640px) {
          .hidden-mobile { display: none !important; }
          .hero-title { font-size: 2rem; }
          .grid-2 { grid-template-columns: 1fr; } .col-span-2 { grid-column: span 1; }
          .card-body { padding: 1.25rem; } .truncate { max-width: 150px; }
          .nav-logo { font-size: 1.1rem; } .credit-badge { padding: 6px 10px; font-size: 0.75rem; }
          .preview-body { grid-template-columns: 1fr; } .border-r { border-right: none; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; }
        }
      `}</style>
    </div>
  );
}
