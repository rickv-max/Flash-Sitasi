import React, { useState, useEffect } from "react";

export default function App() {
  // Mode State
  const [inputMode, setInputMode] = useState("doi"); // "doi" | "url" | "manual" | "batch"

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

  // App States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState(null); 
  const [batchResults, setBatchResults] = useState([]); 
  
  // Single Results
  const [footnoteResult, setFootnoteResult] = useState("");
  const [dafpusResult, setDafpusResult] = useState("");
  
  // Unified Copy State
  const [copiedId, setCopiedId] = useState(null);

  // Clear states on tab switch
  useEffect(() => {
    setError("");
    setMetadata(null);
    setBatchResults([]);
    setFootnoteResult("");
    setDafpusResult("");
    setCopiedId(null);
  }, [inputMode]);

  const cleanDOI = (input) => input.trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "");

  const capitalize = (str) => {
    if (!str || typeof str !== "string") return "";
    return str.toLowerCase().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
  };

  const extractDoiFromUrl = (url) => {
    const match = url.match(/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
    return match ? match[1].replace(/\.pdf$/i, '') : null;
  };

  // --- LOGIC CROSSREF & URL NORMALIZER ---
  
  const normalizeUrl = (url) => {
    let u = url.trim();
    
    // 1. Academia.edu (Ubah link PDF download ke halaman dokumen inti)
    const acaMatch = u.match(/academia\.edu\/download\/(\d+)/i) || u.match(/academia\.edu\/(\d+)/i);
    if (acaMatch) {
      return `https://www.academia.edu/${acaMatch[1]}`;
    }
    
    // 2. OJS (Ubah link PDF download ke halaman abstrak/view)
    const ojsMatch = u.match(/^(.*\/article\/(?:view|download|viewFile)\/\d+)(?:\/.*)?$/i);
    if (ojsMatch) {
      return ojsMatch[1].replace(/\/(download|viewFile)/i, '/view');
    }

    // 3. ResearchGate (Ubah link PDF/profile aneh ke halaman rilis publik)
    const rgMatch = u.match(/researchgate\.net\/.*publication\/(\d+)/i);
    if (rgMatch) {
      return `https://www.researchgate.net/publication/${rgMatch[1]}`;
    }

    return u;
  };

  const formatAuthorsFootnote = (authors) => {
    if (!authors || !authors.length) return "Penulis Tidak Diketahui";
    let given = authors[0].given || "";
    let family = authors[0].family || "";
    
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
    let given = authors[0].given || "";
    let family = authors[0].family || "";
    
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

  // --- SEMANTIC SCHOLAR AI FALLBACK (Self-Healing Metadata) ---
  const formatFromSS = (paper) => {
    const year = paper.year?.toString() || "Tahun";
    const title = paper.title || "Judul Artikel";
    const journal = paper.venue || paper.journal?.name || "Nama Jurnal";
    
    let fn = "Penulis Tidak Diketahui", dp = "Penulis Tidak Diketahui";
    if (paper.authors && paper.authors.length > 0) {
      let firstAuthor = paper.authors[0].name.trim();
      const parts = firstAuthor.split(" ").filter(Boolean);
      let family = "", given = "";
      
      if (parts.length === 1) {
        family = parts[0]; given = "";
      } else {
        family = parts.pop(); given = parts.join(" ");
      }
      
      fn = given ? `${capitalize(given)} ${capitalize(family)}` : capitalize(family);
      dp = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family);
      if (paper.authors.length > 1) { fn += " <i>et al.</i>"; dp += " <i>et al.</i>"; }
    }

    return {
      authorFootnote: fn, authorDafpus: dp, year, month: "", title,
      journal, page: "", volume: "", issue: "", publisher: "", kotaScraped: "", doiUrl: ""
    };
  };

  // --- CORE FETCHING ---
  const processDOI = async (rawDoi) => {
    const cleanedDoi = cleanDOI(rawDoi); 
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanedDoi)}`);
    if (!res.ok) throw new Error("DOI tidak ditemukan atau salah format.");
    const data = await res.json();
    const item = data.message;
    
    const yearObj = item["published-print"] || item.issued;
    const year = yearObj && yearObj["date-parts"] ? yearObj["date-parts"][0][0] : "Tahun";
    const monthNum = yearObj?.["date-parts"]?.[0]?.[1] ?? null;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    const monthStr = monthNum ? monthNames[monthNum - 1] : "";

    const kotaScraped = item["publisher-location"] || "";

    return {
      authorFootnote: formatAuthorsFootnote(item.author),
      authorDafpus: formatAuthorsDafpus(item.author),
      year, month: monthStr,
      title: item.title?.[0] ?? "Judul Artikel",
      journal: item["container-title"]?.[0] ?? "Nama Jurnal",
      page: item.page || "", volume: item.volume || "", issue: item.issue || "", publisher: item.publisher || "",
      kotaScraped,
      doiUrl: `https://doi.org/${cleanedDoi}` 
    };
  };

  const processURL = async (rawUrl) => {
    const targetUrl = normalizeUrl(rawUrl);

    // 1. QUICK WIN: Uji coba URL lookup di Semantic Scholar
    try {
      const ssUrlRes = await fetch(`https://api.semanticscholar.org/graph/v1/paper/URL:${encodeURIComponent(targetUrl)}?fields=title,authors,year,venue,journal`);
      if (ssUrlRes.ok) {
        const ssData = await ssUrlRes.json();
        if (ssData.title && ssData.authors && ssData.authors.length > 0) {
          return formatFromSS(ssData); // Jika sukses, langsung lewati semua proses scrapping
        }
      }
    } catch (e) { /* Lanjut jika gagal */ }

    // 2. SCRAPING HTML VIA PROXY
    let htmlContent = "";
    let contentType = "";

    try {
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
      if (!res.ok) throw new Error("Proxy 1 gagal");
      const data = await res.json(); 
      htmlContent = data.contents;
      contentType = data.status?.content_type || "";
    } catch (err1) {
      const res2 = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);
      if (!res2.ok) throw new Error("Gagal mengakses URL. Pastikan web dapat diakses publik.");
      htmlContent = await res2.text();
      contentType = res2.headers.get("content-type") || "";
    }

    if (!htmlContent) throw new Error("Konten tidak ditemukan.");

    // 3. FALLBACK PDF BINER
    const isBase64Pdf = htmlContent.startsWith("JVBERi");
    const isRawPdf = htmlContent.trim().startsWith("%PDF-");
    const isPdfContentType = contentType.toLowerCase().includes("pdf") || contentType.toLowerCase().includes("octet-stream");
    const isPdfUrl = targetUrl.toLowerCase().split('?')[0].endsWith(".pdf");

    if (isPdfContentType || isRawPdf || isBase64Pdf || isPdfUrl) {
      const extractedDoi = extractDoiFromUrl(targetUrl);
      if (extractedDoi) return await processDOI(extractedDoi);
      throw new Error("Tautan ini mengarah persis ke file PDF statis, sehingga struktur penulis tidak bisa dibaca otomatis. Mohon gunakan fitur KETIK MANUAL.");
    }

    // 4. PARSING DOM METADATA
    const parser = new DOMParser(); 
    const doc = parser.parseFromString(htmlContent, "text/html");
    
    const getMeta = (nameList) => {
      for (const name of nameList) {
        const el = doc.querySelector(`meta[name="${name}" i]`) || doc.querySelector(`meta[property="${name}" i]`);
        if (el && el.getAttribute("content")) return el.getAttribute("content").trim();
      }
      return "";
    };

    let title = getMeta(["citation_title", "DC.Title", "og:title"]) || doc.title || "Judul Tidak Diketahui";
    title = title.replace(/(\s*[-|]\s*Academia\.edu|\s*[-|]\s*ResearchGate|\s*[-|]\s*Google Scholar)/i, '').trim(); // Bersihkan imbuhan

    const isBlocked = title.toLowerCase().includes("just a moment") || title.toLowerCase().includes("cloudflare") || title.toLowerCase().includes("attention required");

    let authors = [];
    const authorNodes = doc.querySelectorAll('meta[name="citation_author" i], meta[name="DC.Creator.PersonalName" i], meta[name="DC.Creator" i]');
    authorNodes.forEach(node => {
      const content = node.getAttribute("content");
      if(content && !authors.includes(content)) authors.push(content);
    });

    // 5. SELF-HEALING: Jika terblokir Cloudflare / Data Penulis Kosong, lacak Judul via AI
    if ((authors.length === 0 || isBlocked) && title !== "Judul Tidak Diketahui") {
      try {
        const cleanTitleSearch = title.replace(/\|.*/, '').trim(); 
        const ssSearchRes = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleanTitleSearch)}&limit=1&fields=title,authors,year,venue,journal`);
        if (ssSearchRes.ok) {
          const ssData = await ssSearchRes.json();
          if (ssData.data && ssData.data.length > 0 && ssData.data[0].authors?.length > 0) {
            return formatFromSS(ssData.data[0]); // Berhasil diselamatkan oleh AI
          }
        }
      } catch (e) { /* Skip jika gagal */ }
    }

    if (isBlocked) {
      throw new Error("Sistem kami diblokir oleh anti-bot (Cloudflare/Captcha) dari website tersebut. Mohon gunakan input DOI atau ketik manual.");
    }

    let fn = "Penulis Tidak Diketahui", dp = "Penulis Tidak Diketahui";
    if (authors.length > 0) {
      let firstAuthor = authors[0].trim();
      let family = "", given = "";
      
      if (firstAuthor.includes(",")) {
        const parts = firstAuthor.split(",");
        family = parts[0].trim(); 
        given = parts[1] ? parts[1].trim() : "";
      } else {
        const parts = firstAuthor.split(" ").filter(Boolean);
        if (parts.length === 1) {
          family = parts[0]; given = "";
        } else {
          family = parts.pop(); given = parts.join(" ");
        }
      }
      
      fn = given ? `${capitalize(given)} ${capitalize(family)}` : capitalize(family);
      dp = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family);
      if (authors.length > 1) { fn += " <i>et al.</i>"; dp += " <i>et al.</i>"; }
    }

    const dateStr = getMeta(["citation_date", "citation_publication_date", "DC.Date", "DC.Date.issued", "article:published_time"]) || "";
    const year = dateStr ? dateStr.split("/")[0].split("-")[0] : "Tahun";
    
    const firstPage = getMeta(["citation_firstpage", "DC.Identifier.pageNumber"]);
    const lastPage = getMeta(["citation_lastpage"]);
    const page = firstPage ? (lastPage ? `${firstPage}-${lastPage}` : firstPage) : "";

    return {
      authorFootnote: fn, authorDafpus: dp, year, month: "", title,
      journal: getMeta(["citation_journal_title", "DC.Source", "og:site_name"]) || "", 
      page, 
      volume: getMeta(["citation_volume", "DC.Source.Volume"]) || "",
      issue: getMeta(["citation_issue", "DC.Source.Issue"]) || "", 
      publisher: getMeta(["citation_publisher", "DC.Publisher"]) || "",
      kotaScraped: ""
    };
  };

  const buildFootnote = (m, kotaManual) => {
    const finalKota = kotaManual.trim() ? kotaManual : (m.kotaScraped || "");
    const kotaTxt = capitalize(finalKota) ? `${capitalize(finalKota)}, ` : "";
    const pageTxt = m.page ? `hal. ${m.page}.` : "";
    
    let baseFootnote = `${m.authorFootnote} (${m.year}) ${capitalize(m.title)}. ${capitalize(m.journal)}. ${kotaTxt}${pageTxt}`;
    baseFootnote = baseFootnote.trim();
    if (!baseFootnote.endsWith(".")) baseFootnote += ".";
    if (m.doiUrl) baseFootnote += ` ${m.doiUrl}`;

    return baseFootnote;
  };

  const buildDafpus = (m, kotaManual) => {
    const finalKota = kotaManual.trim() ? kotaManual : (m.kotaScraped || "");
    const parts = [];
    if (m.journal) parts.push(capitalize(m.journal));
    if (m.publisher) parts.push(capitalize(m.publisher));
    if (finalKota) parts.push(capitalize(finalKota));

    let volIssue = "";
    if (m.volume) volIssue += `Vol. ${m.volume}`;
    if (m.issue) volIssue += volIssue ? ` No. ${m.issue}` : `No. ${m.issue}`;
    if (volIssue) parts.push(volIssue);

    let datePart = "";
    if (m.month) datePart += `${m.month} `;
    datePart += m.year;
    parts.push(datePart);

    const journalMeta = parts.join(", ") + ".";
    const authorDot = m.authorDafpus.endsWith("</i>") || m.authorDafpus.endsWith(".") ? "" : ".";

    return `${m.authorDafpus}${authorDot} (${m.year}) "${capitalize(m.title)}". ${journalMeta}`;
  };

  // --- HANDLERS ---
  const fetchDOI = async () => {
    if (!doiInput) return;
    setLoading(true); setError(""); setMetadata(null);
    try {
      const meta = await processDOI(doiInput);
      setMetadata(meta); 
      setFootnoteResult(buildFootnote(meta, kotaInput));
      setDafpusResult(buildDafpus(meta, kotaInput));
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Koneksi terputus. Pastikan koneksi internet stabil." : e.message);
    } finally { setLoading(false); }
  };

  const fetchURL = async () => {
    if (!urlInput) return;
    setLoading(true); setError(""); setMetadata(null);
    try {
      const meta = await processURL(urlInput);
      if (meta.authorFootnote === "Penulis Tidak Diketahui") {
         setError("Info: Tautan tidak menyediakan metadata yang cukup. Hasil mungkin tidak sempurna.");
      }
      setMetadata(meta);
      setFootnoteResult(buildFootnote(meta, kotaInput));
      setDafpusResult(buildDafpus(meta, kotaInput));
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Koneksi gagal." : e.message);
    } finally { setLoading(false); }
  };

  const parseManualAuthor = (authorStr) => {
    if (!authorStr.trim()) return { fn: "Penulis Tidak Diketahui", dp: "Penulis Tidak Diketahui" };
    const authors = authorStr.split(",").map((a) => a.trim()).filter(Boolean);
    if (authors.length === 0) return { fn: "Penulis Tidak Diketahui", dp: "Penulis Tidak Diketahui" };

    const firstAuthor = authors[0];
    const parts = firstAuthor.split(" ").filter(Boolean);
    
    let family = "", given = "";
    if (parts.length === 1) {
      family = parts[0]; given = "";
    } else {
      family = parts.pop(); given = parts.join(" ");
    }

    let fn = given ? `${capitalize(given)} ${capitalize(family)}` : capitalize(family);
    let dp = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family);

    if (authors.length > 1) { fn += " <i>et al.</i>"; dp += " <i>et al.</i>"; }
    return { fn, dp };
  };

  const handleGenerateManual = () => {
    setError("");
    if (!mAuthor || !mTitle || !mYear) return setError("Nama Penulis, Judul, dan Tahun wajib diisi.");
    const { fn, dp } = parseManualAuthor(mAuthor);
    const meta = {
      authorFootnote: fn, authorDafpus: dp, title: mTitle, journal: mJournal, year: mYear,
      month: "", volume: mVolume, issue: mIssue, page: mPage, publisher: mPublisher, kotaScraped: ""
    };
    setMetadata(meta);
    setFootnoteResult(buildFootnote(meta, kotaInput));
    setDafpusResult(buildDafpus(meta, kotaInput));
  };

  const handleBatchGenerate = async () => {
    if (!batchInput.trim()) return setError("Masukkan setidaknya 1 link atau DOI.");
    setLoading(true); setError(""); setBatchResults([]); setMetadata(null);

    const lines = batchInput.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const results = [];

    for (const line of lines) {
      const isDoi = (line.includes("10.") && !line.includes("http")) || line.includes("doi.org") || line.includes("dx.doi.org");
      try {
        let meta;
        if (isDoi) meta = await processDOI(line);
        else meta = await processURL(line);
        results.push({ status: "success", line, meta });
      } catch (err) {
        results.push({ status: "error", line, error: err.message });
      }
    }
    setBatchResults(results);
    setLoading(false);
  };

  const handleCopy = (htmlString, targetCopyId) => {
    if (!htmlString) return;
    const plainText = htmlString.replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]+>/g, "");
    
    const div = document.createElement("div");
    div.innerHTML = htmlString; div.style.position = "fixed"; div.style.left = "-9999px";
    document.body.appendChild(div);
    const selection = window.getSelection(); const range = document.createRange();
    range.selectNodeContents(div); selection.removeAllRanges(); selection.addRange(range);
    
    let success = false;
    try { success = document.execCommand("copy"); } catch (err) {}
    selection.removeAllRanges(); document.body.removeChild(div);
    
    if (!success) {
      const textarea = document.createElement("textarea");
      textarea.value = plainText; textarea.style.position = "fixed"; textarea.style.left = "-9999px";
      document.body.appendChild(textarea); textarea.select();
      try { success = document.execCommand("copy"); } catch(e){}
      document.body.removeChild(textarea);
    }
    
    if (success) {
      setCopiedId(targetCopyId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // --- ICONS ---
  const SearchIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="18" width="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
  const LinkIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="18" width="18"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>;
  const EditIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="18" width="18"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
  const ListIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="18" width="18"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
  const BoltIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="24" width="24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>;
  const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" height="16" width="16"><polyline points="20 6 9 17 4 12"></polyline></svg>;
  const CopyIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;
  const WarningIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;

  // Constants
  const batchSuccesses = batchResults.filter(r => r.status === 'success');
  const batchErrors = batchResults.filter(r => r.status === 'error');
  const sortedBatchDafpus = [...batchSuccesses].sort((a, b) => a.meta.authorDafpus.localeCompare(b.meta.authorDafpus));

  // --- SKELETON LOADER COMPONENT ---
  const SkeletonLoader = () => (
    <div className="card animate-fade-in mt-6">
      <div className="card-header bg-skeleton-header border-b border-gray-100 flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full skeleton-pulse" style={{ backgroundColor: '#cbd5e1' }}></div>
        <div className="h-4 w-40 rounded skeleton-pulse" style={{ backgroundColor: '#cbd5e1' }}></div>
      </div>
      <div className="p-6">
        <div className="mb-8">
          <div className="h-3 w-48 rounded mb-4 skeleton-pulse" style={{ backgroundColor: '#e2e8f0' }}></div>
          <div className="h-16 w-full rounded-md skeleton-pulse" style={{ backgroundColor: '#f1f5f9' }}></div>
        </div>
        <div>
          <div className="h-3 w-48 rounded mb-4 skeleton-pulse" style={{ backgroundColor: '#e2e8f0' }}></div>
          <div className="h-16 w-full rounded-md skeleton-pulse" style={{ backgroundColor: '#f1f5f9' }}></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <span className="logo-text">Fl<span className="logo-icon"><BoltIcon /></span>sh</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="badge">GENERATOR SITASI CERDAS</div>
          <h1>
            Solusi Pintar Ekstrak <span className="highlight-text">DOI & Link PDF</span><br />
            ke Format Sitasi Akademik
          </h1>
          <p className="hero-description">Transformasi referensi jurnalmu menjadi format Catatan Kaki (Footnote) dan Daftar Pustaka secara instan. Mendukung ekstraksi tautan PDF dan OJS.</p>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="main-content">
        <div className="container">
          
          {/* Form Card */}
          <div className="card shadow-sm">
            <div className="card-header border-b border-gray-100">
              <div className="circle-indicator bg-primary"></div>
              <h2 className="card-title">
                {inputMode === "doi" && "MODE: NOMOR DOI"}
                {inputMode === "url" && "MODE: LINK URL & PDF"}
                {inputMode === "manual" && "MODE: KETIK MANUAL"}
                {inputMode === "batch" && "MODE: BATCH (BANYAK LINK)"}
              </h2>
            </div>
            
            <div className="p-6 md:p-8">
              {/* DOI MODE */}
              {inputMode === "doi" && (
                <div className="animate-fade-in">
                  <div className="form-group">
                    <label className="form-label">Nomor DOI Artikel</label>
                    <input type="text" className="form-input" value={doiInput} onChange={(e)=>setDoiInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&fetchDOI()} placeholder="Contoh: 10.1038/s41586..." />
                  </div>
                  <div className="form-group mb-6">
                    <label className="form-label">Kota Terbit <span className="label-optional">(Opsional)</span></label>
                    <input type="text" className="form-input" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Contoh: Jakarta" />
                  </div>
                  <button className="btn-primary w-full" onClick={fetchDOI} disabled={loading || !doiInput}>
                    {loading ? "Menarik Data..." : "Generate Sitasi"}
                  </button>
                </div>
              )}

              {/* URL MODE */}
              {inputMode === "url" && (
                <div className="animate-fade-in">
                  <div className="form-group">
                    <label className="form-label">Link Jurnal atau PDF</label>
                    <input type="text" className="form-input" value={urlInput} onChange={(e)=>setUrlInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&fetchURL()} placeholder="https://jurnal.kampus.ac.id/.../pdf" />
                    <p className="form-helper">Otomatis mereparasi link PDF dari Academia.edu, OJS, dan ResearchGate.</p>
                  </div>
                  <div className="form-group mb-6">
                    <label className="form-label">Kota Terbit <span className="label-optional">(Opsional)</span></label>
                    <input type="text" className="form-input" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Contoh: Yogyakarta" />
                  </div>
                  <button className="btn-primary w-full" onClick={fetchURL} disabled={loading || !urlInput}>
                    {loading ? "Menganalisis Link..." : "Generate Sitasi"}
                  </button>
                </div>
              )}

              {/* MANUAL MODE */}
              {inputMode === "manual" && (
                <div className="animate-fade-in">
                  <div className="form-grid">
                    <div className="form-group col-span-2">
                      <label className="form-label">Nama Penulis <span className="text-red-500">*</span></label>
                      <input type="text" className="form-input" value={mAuthor} onChange={(e)=>setMAuthor(e.target.value)} placeholder="Ricky, Budi Santoso" />
                    </div>
                    <div className="form-group col-span-2">
                      <label className="form-label">Judul Artikel <span className="text-red-500">*</span></label>
                      <input type="text" className="form-input" value={mTitle} onChange={(e)=>setMTitle(e.target.value)} placeholder="Pengaruh Teknologi Terhadap..." />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nama Jurnal</label>
                      <input type="text" className="form-input" value={mJournal} onChange={(e)=>setMJournal(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tahun <span className="text-red-500">*</span></label>
                      <input type="text" className="form-input" value={mYear} onChange={(e)=>setMYear(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Volume</label>
                      <input type="text" className="form-input" value={mVolume} onChange={(e)=>setMVolume(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Isu / Nomor</label>
                      <input type="text" className="form-input" value={mIssue} onChange={(e)=>setMIssue(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Halaman</label>
                      <input type="text" className="form-input" value={mPage} onChange={(e)=>setMPage(e.target.value)} placeholder="15-25" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kota Terbit</label>
                      <input type="text" className="form-input" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} />
                    </div>
                  </div>
                  <button className="btn-primary w-full mt-6" onClick={handleGenerateManual}>
                    Generate Sitasi Manual
                  </button>
                </div>
              )}

              {/* BATCH MODE */}
              {inputMode === "batch" && (
                <div className="animate-fade-in">
                  <div className="form-group">
                    <label className="form-label">Daftar Link atau DOI</label>
                    <textarea 
                      className="form-input textarea" 
                      value={batchInput} 
                      onChange={(e)=>setBatchInput(e.target.value)} 
                      placeholder="Masukkan URL atau DOI di sini (Satu baris untuk setiap referensi)&#10;https://jurnal.kampus.ac.id/...&#10;10.1038/s41586..." 
                    />
                  </div>
                  <div className="form-group mb-6">
                    <label className="form-label">Kota Terbit <span className="label-optional">(Opsional, berlaku untuk semua)</span></label>
                    <input type="text" className="form-input" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Contoh: Jakarta" />
                  </div>
                  <button className="btn-primary w-full" onClick={handleBatchGenerate} disabled={loading || !batchInput}>
                    {loading ? "Memproses Data Secara Masal..." : "Generate Sekaligus"}
                  </button>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="alert-error mt-6 animate-fade-in">
                  <WarningIcon />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* SKELETON SCREEN (Tampil Saat Memproses) */}
          {loading && inputMode !== 'batch' && <SkeletonLoader />}
          {loading && inputMode === 'batch' && (
             <>
               <SkeletonLoader />
               <div style={{opacity: 0.5}}><SkeletonLoader /></div>
             </>
          )}

          {/* Results Card (Single & Manual) */}
          {!loading && metadata && inputMode !== "batch" && (
            <div className="card shadow-sm mt-6 animate-slide-up">
              <div className="card-header bg-success-light border-b border-success-border">
                <div className="circle-indicator bg-success"></div>
                <h2 className="card-title text-success-dark">HASIL EKSTRAKSI</h2>
              </div>
              <div className="p-6 md:p-8">
                
                <div className="result-container">
                  <div className="result-header">
                    <span className="result-label">CATATAN KAKI (FOOTNOTE)</span>
                    <button className="btn-icon" onClick={() => handleCopy(footnoteResult, "single-fn")}>
                      {copiedId === "single-fn" ? <><CheckIcon /> Disalin</> : <><CopyIcon /> Copy</>}
                    </button>
                  </div>
                  <div className="result-content" dangerouslySetInnerHTML={{ __html: footnoteResult }} />
                </div>

                <div className="result-container mt-6">
                  <div className="result-header">
                    <span className="result-label">DAFTAR PUSTAKA</span>
                    <button className="btn-icon" onClick={() => handleCopy(dafpusResult, "single-dp")}>
                      {copiedId === "single-dp" ? <><CheckIcon /> Disalin</> : <><CopyIcon /> Copy</>}
                    </button>
                  </div>
                  <div className="result-content" dangerouslySetInnerHTML={{ __html: dafpusResult }} />
                </div>

                <div className="meta-footer mt-6">
                  <span className="meta-badge">Info Data</span>
                  Ekstraksi {metadata.authorFootnote.replace(/<[^>]+>/g, "")} ({metadata.year})
                </div>
              </div>
            </div>
          )}

          {/* Results Card (Batch) */}
          {!loading && batchResults.length > 0 && inputMode === "batch" && (
            <div className="card shadow-sm mt-6 animate-slide-up">
              <div className="card-header bg-success-light border-b border-success-border">
                <div className="circle-indicator bg-success"></div>
                <h2 className="card-title text-success-dark">BERHASIL DIPROSES ({batchSuccesses.length})</h2>
              </div>
              <div className="p-6 md:p-8">
                
                {batchSuccesses.length > 0 && (
                  <>
                    <h4 className="section-heading mt-0">Catatan Kaki (Footnote)</h4>
                    <div className="batch-list">
                      {batchSuccesses.map((r, index) => {
                        const content = buildFootnote(r.meta, kotaInput);
                        const copyId = `batch-fn-${index}`;
                        return (
                          <div className="result-container mb-4" key={copyId}>
                            <div className="result-header">
                              <span className="truncate-text" title={r.line}>{r.line}</span>
                              <button className="btn-icon" onClick={() => handleCopy(content, copyId)}>
                                {copiedId === copyId ? <><CheckIcon /> Disalin</> : <><CopyIcon /> Copy</>}
                              </button>
                            </div>
                            <div className="result-content" dangerouslySetInnerHTML={{ __html: content }} />
                          </div>
                        )
                      })}
                    </div>

                    <h4 className="section-heading mt-10">Daftar Pustaka (Urut Abjad)</h4>
                    <div className="batch-list">
                      {sortedBatchDafpus.map((r, index) => {
                        const content = buildDafpus(r.meta, kotaInput);
                        const copyId = `batch-dp-${index}`;
                        return (
                          <div className="result-container mb-4" key={copyId}>
                            <div className="result-header">
                              <span className="truncate-text" title={r.line}>{r.line}</span>
                              <button className="btn-icon" onClick={() => handleCopy(content, copyId)}>
                                {copiedId === copyId ? <><CheckIcon /> Disalin</> : <><CopyIcon /> Copy</>}
                              </button>
                            </div>
                            <div className="result-content" dangerouslySetInnerHTML={{ __html: content }} />
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {batchErrors.length > 0 && (
                  <div className="alert-error mt-8">
                    <div className="flex items-center gap-2 mb-2 font-semibold">
                      <WarningIcon/> Gagal Memproses ({batchErrors.length})
                    </div>
                    <ul className="error-list">
                      {batchErrors.map((err, i) => (
                        <li key={i}>
                          <strong>{err.line}</strong><br/>
                          <span className="text-sm opacity-90">{err.error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
              </div>
            </div>
          )}

          <div className="spacer-bottom"></div>
        </div>
      </section>

      {/* Floating Modern Bottom Navigation */}
      <nav className="bottom-nav-container">
        <div className="bottom-nav">
          <button className={`nav-item ${inputMode === "doi" ? "active" : ""}`} onClick={() => setInputMode("doi")}>
            <SearchIcon /> <span>DOI</span>
          </button>
          <button className={`nav-item ${inputMode === "url" ? "active" : ""}`} onClick={() => setInputMode("url")}>
            <LinkIcon /> <span>Tautan</span>
          </button>
          <button className={`nav-item ${inputMode === "batch" ? "active" : ""}`} onClick={() => setInputMode("batch")}>
            <ListIcon /> <span>Batch</span>
          </button>
          <button className={`nav-item ${inputMode === "manual" ? "active" : ""}`} onClick={() => setInputMode("manual")}>
            <EditIcon /> <span>Manual</span>
          </button>
        </div>
      </nav>

      {/* STYLES (Clean, Modern, Enterprise UI) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        :root {
          --primary: #2563eb;
          --primary-hover: #1d4ed8;
          --primary-light: #eff6ff;
          
          --bg-body: #f8fafc;
          --bg-surface: #ffffff;
          
          --text-main: #0f172a;
          --text-muted: #64748b;
          
          --border-color: #e2e8f0;
          --border-focus: #93c5fd;
          
          --success: #10b981;
          --success-light: #f0fdf4;
          --success-border: #bbf7d0;
          --success-dark: #166534;
          
          --error: #ef4444;
          --error-light: #fef2f2;
          --error-border: #fecaca;
        }

        html, body, #root {
          width: 100%;
          margin: 0;
          padding: 0;
          background-color: var(--bg-body);
          color: var(--text-main);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        .app-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* HEADER */
        .header {
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 50;
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
        }

        .logo-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-text {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: var(--text-main);
          display: flex;
          align-items: center;
        }

        .logo-icon {
          color: var(--primary);
          display: flex;
          align-items: center;
          margin: 0 2px;
        }

        /* HERO */
        .hero {
          background-color: var(--text-main);
          padding: 4rem 1.5rem;
          text-align: center;
          display: flex;
          justify-content: center;
        }

        .hero-content {
          max-width: 680px;
        }

        .badge {
          display: inline-block;
          background: rgba(255,255,255,0.1);
          color: #e2e8f0;
          padding: 0.35rem 1rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255,255,255,0.2);
        }

        .hero h1 {
          color: #ffffff;
          font-size: 2.25rem;
          font-weight: 800;
          line-height: 1.25;
          margin: 0 0 1.25rem 0;
          letter-spacing: -0.5px;
        }

        .highlight-text {
          color: #60a5fa;
        }

        .hero-description {
          color: #94a3b8;
          font-size: 1.05rem;
          line-height: 1.6;
          margin: 0;
          font-weight: 400;
        }

        /* MAIN CONTENT & CONTAINERS */
        .main-content {
          padding: 2rem 1.5rem;
          flex: 1;
        }

        .container {
          max-width: 680px;
          margin: 0 auto;
          position: relative;
          top: -3.5rem; /* Overlap hero */
        }

        /* CARDS */
        .card {
          background: var(--bg-surface);
          border-radius: 16px;
          border: 1px solid var(--border-color);
          overflow: hidden;
        }

        .shadow-sm {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
        }

        .card-header {
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 12px;
          background: #fcfcfd;
        }

        .bg-success-light { background: var(--success-light); }
        .border-success-border { border-color: var(--success-border); }

        .circle-indicator {
          width: 10px; height: 10px;
          border-radius: 50%;
        }
        .bg-primary { background: var(--primary); }
        .bg-success { background: var(--success); }

        .card-title {
          font-size: 0.85rem;
          font-weight: 700;
          margin: 0;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .text-success-dark { color: var(--success-dark); }

        .p-6 { padding: 1.5rem; }
        .md\\:p-8 { padding: 2rem; }
        
        /* FORMS */
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        .form-group { margin-bottom: 1.25rem; }
        .col-span-2 { grid-column: span 2; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mt-6 { margin-top: 1.5rem; }
        .mt-10 { margin-top: 2.5rem; }
        .mb-4 { margin-bottom: 1rem; }

        .form-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 0.5rem;
        }

        .label-optional {
          color: var(--text-muted);
          font-weight: 400;
          font-size: 0.8rem;
        }

        .form-input {
          width: 100%;
          padding: 0.875rem 1rem;
          font-size: 0.95rem;
          color: var(--text-main);
          background-color: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          transition: all 0.2s ease;
          outline: none;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.01);
        }

        .form-input::placeholder { color: #94a3b8; }
        .form-input:focus {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .textarea {
          resize: vertical;
          min-height: 120px;
          line-height: 1.5;
        }

        .form-helper {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin: 0.5rem 0 0 0;
        }

        /* BUTTONS */
        .btn-primary {
          background-color: var(--primary);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 0.875rem 1.5rem;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
        }

        .btn-primary:hover:not(:disabled) {
          background-color: var(--primary-hover);
          transform: translateY(-1px);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-primary:disabled {
          background-color: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }

        .w-full { width: 100%; }

        /* RESULTS UI */
        .result-container {
          background: #f8fafc;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          overflow: hidden;
        }

        .result-header {
          padding: 0.75rem 1.25rem;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .result-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }

        .btn-icon {
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 0.4rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-main);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          transition: all 0.15s;
        }

        .btn-icon:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .result-content {
          padding: 1.25rem;
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--text-main);
          word-break: break-word;
        }

        .section-heading {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 1rem;
        }

        .truncate-text {
          max-width: 280px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 0.8rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .meta-footer {
          font-size: 0.85rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding-top: 1.5rem;
          border-top: 1px dashed var(--border-color);
        }

        .meta-badge {
          background: var(--border-color);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-main);
        }

        /* ALERTS */
        .alert-error {
          background: var(--error-light);
          border: 1px solid var(--error-border);
          color: var(--error);
          padding: 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          line-height: 1.5;
        }

        .error-list {
          margin: 0;
          padding-left: 1.5rem;
          font-size: 0.85rem;
        }

        .error-list li { margin-bottom: 0.5rem; }

        /* SKELETON LOADER ANIMATIONS */
        .bg-skeleton-header { background: #f8fafc; }
        .skeleton-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }

        /* BOTTOM NAVIGATION */
        .spacer-bottom { height: 100px; }

        .bottom-nav-container {
          position: fixed;
          bottom: 1.5rem;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          z-index: 100;
          pointer-events: none;
        }

        .bottom-nav {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 9999px;
          display: flex;
          padding: 0.35rem;
          gap: 0.25rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          pointer-events: auto;
          backdrop-filter: blur(8px);
          background-color: rgba(255, 255, 255, 0.95);
        }

        .nav-item {
          background: transparent;
          border: none;
          padding: 0.65rem 1.25rem;
          border-radius: 9999px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .nav-item:hover { color: var(--text-main); }
        .nav-item.active {
          background: var(--primary);
          color: #ffffff;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
        }

        /* UTILS */
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* RESPONSIVE */
        @media (max-width: 640px) {
          .hero h1 { font-size: 1.75rem; }
          .hero { padding: 3rem 1.25rem 4rem 1.25rem; }
          .container { top: -2rem; }
          .form-grid { grid-template-columns: 1fr; }
          .col-span-2 { grid-column: span 1; }
          .truncate-text { max-width: 140px; }
          
          .bottom-nav { width: 92%; max-width: 400px; justify-content: space-between; }
          .nav-item { padding: 0.65rem; flex: 1; justify-content: center; }
          .nav-item span { display: none; }
          .nav-item.active span { display: inline-block; }
        }
      `}</style>
    </div>
  );
}
