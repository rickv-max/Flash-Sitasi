import React, { useState, useEffect } from "react";

export default function App() {
  // App Routing State (Simulated)
  const [currentView, setCurrentView] = useState("landing"); // "landing" | "tool"

  // Theme State (Dark/Light)
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Mode State (Tabs di dalam Card)
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

  // FAQ State
  const [openFaq, setOpenFaq] = useState(null);

  // --- THEME & INITIALIZATION EFFECT ---
  useEffect(() => {
    // Check system preference on load
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  // Clear states on tab switch
  useEffect(() => {
    setError("");
    setMetadata(null);
    setBatchResults([]);
    setFootnoteResult("");
    setDafpusResult("");
    setCopiedId(null);
  }, [inputMode]);

  const navigateTo = (view) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- LOGIC HELPER FUNCTIONS ---
  const cleanDOI = (input) => input.trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "");

  const capitalize = (str) => {
    if (!str || typeof str !== "string") return "";
    return str.toLowerCase().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
  };

  const extractDoiFromUrl = (url) => {
    const match = url.match(/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
    return match ? match[1].replace(/\.pdf$/i, '') : null;
  };
  
  const normalizeUrl = (url) => {
    let u = url.trim();
    const acaMatch = u.match(/academia\.edu\/download\/(\d+)/i) || u.match(/academia\.edu\/(\d+)/i);
    if (acaMatch) return `https://www.academia.edu/${acaMatch[1]}`;
    const ojsMatch = u.match(/^(.*\/article\/(?:view|download|viewFile)\/\d+)(?:\/.*)?$/i);
    if (ojsMatch) return ojsMatch[1].replace(/\/(download|viewFile)/i, '/view');
    const rgMatch = u.match(/researchgate\.net\/.*publication\/(\d+)/i);
    if (rgMatch) return `https://www.researchgate.net/publication/${rgMatch[1]}`;
    return u;
  };

  const formatAuthorsFootnote = (authors) => {
    if (!authors || !authors.length) return "Penulis Tidak Diketahui";
    let given = authors[0].given || "", family = authors[0].family || "";
    if (!given && family.includes(" ")) {
      const parts = family.split(" ").filter(Boolean);
      if (parts.length > 1) { family = parts.pop(); given = parts.join(" "); }
    }
    family = capitalize(family); given = capitalize(given);
    const firstAuthor = given ? `${given} ${family}`.trim() : family.trim();
    if (authors.length > 1) return `${firstAuthor} <i>et al.</i>`;
    return firstAuthor;
  };

  const formatAuthorsDafpus = (authors) => {
    if (!authors || !authors.length) return "Penulis Tidak Diketahui";
    let given = authors[0].given || "", family = authors[0].family || "";
    if (!given && family.includes(" ")) {
      const parts = family.split(" ").filter(Boolean);
      if (parts.length > 1) { family = parts.pop(); given = parts.join(" "); }
    }
    family = capitalize(family); given = capitalize(given);
    let firstAuthor = given ? `${family}, ${given}` : family;
    if (authors.length > 1) return `${firstAuthor} <i>et al.</i>`;
    return firstAuthor;
  };

  const formatFromSS = (paper) => {
    const year = paper.year?.toString() || "Tahun";
    const title = paper.title || "Judul Artikel";
    const journal = paper.venue || paper.journal?.name || "Nama Jurnal";
    let fn = "Penulis Tidak Diketahui", dp = "Penulis Tidak Diketahui";
    if (paper.authors && paper.authors.length > 0) {
      let firstAuthor = paper.authors[0].name.trim();
      const parts = firstAuthor.split(" ").filter(Boolean);
      let family = "", given = "";
      if (parts.length === 1) { family = parts[0]; given = ""; } 
      else { family = parts.pop(); given = parts.join(" "); }
      fn = given ? `${capitalize(given)} ${capitalize(family)}` : capitalize(family);
      dp = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family);
      if (paper.authors.length > 1) { fn += " <i>et al.</i>"; dp += " <i>et al.</i>"; }
    }
    return {
      authorFootnote: fn, authorDafpus: dp, year, month: "", title,
      journal, page: "", volume: "", issue: "", publisher: "", kotaScraped: "", doiUrl: ""
    };
  };

  const searchByTitleAI = async (rawTitle) => {
    const cleanTitle = rawTitle.replace(/(\s*[-|]\s*Academia\.edu|\s*[-|]\s*ResearchGate|\s*[-|]\s*Google Scholar|\.pdf)/gi, '').trim();
    if (cleanTitle.length < 10) return null;
    try {
        const ssRes = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleanTitle)}&limit=1&fields=title,authors,year,venue,journal`);
        if (ssRes.ok) {
            const ssData = await ssRes.json();
            if (ssData.data?.[0]?.authors?.length > 0) return formatFromSS(ssData.data[0]);
        }
        const crRes = await fetch(`https://api.crossref.org/works?query.title=${encodeURIComponent(cleanTitle)}&rows=1`);
        if (crRes.ok) {
            const crData = await crRes.json();
            if (crData.message.items.length > 0) {
                const item = crData.message.items[0];
                const itemTitle = (item.title?.[0] || "").toLowerCase();
                const searchWords = cleanTitle.toLowerCase().split(' ').filter(w => w.length > 4);
                const matches = searchWords.filter(w => itemTitle.includes(w));
                if (matches.length >= Math.min(2, searchWords.length)) {
                    const yearObj = item["published-print"] || item.issued;
                    const year = yearObj && yearObj["date-parts"] ? yearObj["date-parts"][0][0] : "Tahun";
                    return {
                        authorFootnote: formatAuthorsFootnote(item.author), authorDafpus: formatAuthorsDafpus(item.author),
                        year: year.toString(), month: "", title: item.title?.[0] ?? "Judul Artikel",
                        journal: item["container-title"]?.[0] ?? "Nama Jurnal", page: item.page || "", volume: item.volume || "", 
                        issue: item.issue || "", publisher: item.publisher || "", kotaScraped: item["publisher-location"] || "",
                        doiUrl: item.DOI ? `https://doi.org/${item.DOI}` : ""
                    };
                }
            }
        }
    } catch (e) {}
    return null;
  };

  const processDOI = async (rawDoi) => {
    const cleanedDoi = cleanDOI(rawDoi); 
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanedDoi)}`);
    if (!res.ok) throw new Error("DOI tidak ditemukan atau salah format.");
    const data = await res.json(); const item = data.message;
    const yearObj = item["published-print"] || item.issued;
    const year = yearObj && yearObj["date-parts"] ? yearObj["date-parts"][0][0] : "Tahun";
    const monthNum = yearObj?.["date-parts"]?.[0]?.[1] ?? null;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    return {
      authorFootnote: formatAuthorsFootnote(item.author), authorDafpus: formatAuthorsDafpus(item.author),
      year, month: monthNum ? monthNames[monthNum - 1] : "", title: item.title?.[0] ?? "Judul Artikel",
      journal: item["container-title"]?.[0] ?? "Nama Jurnal", page: item.page || "", volume: item.volume || "", 
      issue: item.issue || "", publisher: item.publisher || "", kotaScraped: item["publisher-location"] || "",
      doiUrl: `https://doi.org/${cleanedDoi}` 
    };
  };

  const processURL = async (rawUrl) => {
    const targetUrl = normalizeUrl(rawUrl);
    const ssUrlsToTry = [targetUrl, rawUrl.trim()];
    for (const u of ssUrlsToTry) {
        try {
            const ssUrlRes = await fetch(`https://api.semanticscholar.org/graph/v1/paper/URL:${encodeURIComponent(u)}?fields=title,authors,year,venue,journal`);
            if (ssUrlRes.ok) {
                const ssData = await ssUrlRes.json();
                if (ssData.title && ssData.authors && ssData.authors.length > 0) return formatFromSS(ssData);
            }
        } catch(e) {} 
    }

    try {
        const mlRes = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}`);
        if (mlRes.ok) {
            const mlData = await mlRes.json();
            const mlTitle = mlData.data?.title || "";
            if (mlTitle && !mlTitle.toLowerCase().includes("just a moment") && !mlTitle.toLowerCase().includes("cloudflare")) {
                const aiResult = await searchByTitleAI(mlTitle);
                if (aiResult) return aiResult;
                let rawAuthor = mlData.data?.author || mlData.data?.publisher || "";
                return {
                    authorFootnote: rawAuthor ? formatAuthorsFootnote([{family: rawAuthor}]) : "Penulis Tidak Diketahui",
                    authorDafpus: rawAuthor ? formatAuthorsDafpus([{family: rawAuthor}]) : "Penulis Tidak Diketahui",
                    year: mlData.data?.date ? new Date(mlData.data.date).getFullYear().toString() : "Tahun",
                    month: "", title: mlTitle.replace(/(\s*[-|]\s*Academia\.edu)/i, '').trim(),
                    journal: mlData.data?.publisher || "Nama Jurnal", page: "", volume: "", issue: "", publisher: "", kotaScraped: "", doiUrl: ""
                };
            }
        }
    } catch(e) {}

    const parseHTML = (html, contentType) => {
        const isBase64Pdf = html.startsWith("JVBERi");
        const isRawPdf = html.trim().startsWith("%PDF-");
        const isPdfType = (contentType||"").toLowerCase().includes("pdf") || (contentType||"").toLowerCase().includes("octet-stream");
        const isPdfUrl = targetUrl.toLowerCase().split('?')[0].endsWith(".pdf");
        if (isPdfType || isRawPdf || isBase64Pdf || isPdfUrl) return { isPdfFile: true };

        const parser = new DOMParser(); const doc = parser.parseFromString(html, "text/html");
        const getMeta = (names) => {
            for (const n of names) {
                const el = doc.querySelector(`meta[name="${n}" i]`) || doc.querySelector(`meta[property="${n}" i]`);
                if (el && el.getAttribute("content")) return el.getAttribute("content").trim();
            }
            return "";
        };

        let title = getMeta(["citation_title", "DC.Title", "og:title"]) || doc.title || "Judul Tidak Diketahui";
        title = title.replace(/(\s*[-|]\s*Academia\.edu|\s*[-|]\s*ResearchGate|\s*[-|]\s*Google Scholar)/i, '').trim();
        const blockedKeywords = ["just a moment", "cloudflare", "attention required", "security check", "robot or human"];
        if (blockedKeywords.some(kw => title.toLowerCase().includes(kw))) return { blocked: true };

        let authors = [];
        doc.querySelectorAll('meta[name="citation_author" i], meta[name="DC.Creator.PersonalName" i], meta[name="DC.Creator" i]').forEach(node => {
            const content = node.getAttribute("content");
            if(content && !authors.includes(content)) authors.push(content);
        });
        if (authors.length === 0 && title !== "Judul Tidak Diketahui") return { incomplete: true, title };

        let fn = "Penulis Tidak Diketahui", dp = "Penulis Tidak Diketahui";
        if (authors.length > 0) {
            let firstAuthor = authors[0].trim(); let family = "", given = "";
            if (firstAuthor.includes(",")) { const parts = firstAuthor.split(","); family = parts[0].trim(); given = parts[1] ? parts[1].trim() : ""; } 
            else { const parts = firstAuthor.split(" ").filter(Boolean); if (parts.length === 1) { family = parts[0]; given = ""; } else { family = parts.pop(); given = parts.join(" "); } }
            fn = given ? `${capitalize(given)} ${capitalize(family)}` : capitalize(family);
            dp = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family);
            if (authors.length > 1) { fn += " <i>et al.</i>"; dp += " <i>et al.</i>"; }
        }

        const dateStr = getMeta(["citation_date", "citation_publication_date", "DC.Date", "DC.Date.issued", "article:published_time"]) || "";
        const year = dateStr ? dateStr.split("/")[0].split("-")[0] : "Tahun";
        const firstPage = getMeta(["citation_firstpage", "DC.Identifier.pageNumber"]);
        const lastPage = getMeta(["citation_lastpage"]);
        return {
            success: true,
            data: {
                authorFootnote: fn, authorDafpus: dp, year, month: "", title,
                journal: getMeta(["citation_journal_title", "DC.Source", "og:site_name"]) || "", 
                page: firstPage ? (lastPage ? `${firstPage}-${lastPage}` : firstPage) : "", 
                volume: getMeta(["citation_volume", "DC.Source.Volume"]) || "",
                issue: getMeta(["citation_issue", "DC.Source.Issue"]) || "", 
                publisher: getMeta(["citation_publisher", "DC.Publisher"]) || "", kotaScraped: ""
            }
        };
    };

    let htmlContent = "", contentType = "", finalUrl = targetUrl;
    const proxies = [
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
    ];

    for (let proxy of proxies) {
        try {
            const res = await fetch(proxy);
            if (!res.ok) continue;
            htmlContent = await res.text(); contentType = res.headers.get("content-type") || "";
            if (!htmlContent.toLowerCase().includes("just a moment") && htmlContent.trim() !== "") break;
        } catch (e) {}
    }

    if (!htmlContent) throw new Error("Gagal mengakses URL web. Pastikan web bersifat publik.");

    let parsed = parseHTML(htmlContent, contentType);
    if (parsed.isPdfFile) {
        const extractedDoi = extractDoiFromUrl(targetUrl);
        if (extractedDoi) return await processDOI(extractedDoi);
        throw new Error("Tautan PDF mentah. Mohon gunakan mode KETIK MANUAL.");
    }

    if (parsed.blocked || parsed.incomplete) {
        try {
            const wbRes = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(targetUrl)}`);
            const wbData = await wbRes.json();
            if (wbData.archived_snapshots?.closest?.url) {
                const snapFetch = await fetch(wbData.archived_snapshots.closest.url.replace(/^http:/, 'https:'));
                if (snapFetch.ok) {
                    const snapParsed = parseHTML(await snapFetch.text(), "text/html");
                    if (snapParsed.success || (snapParsed.incomplete && parsed.blocked)) parsed = snapParsed; 
                }
            }
        } catch(e) {}
    }

    let searchTitle = parsed.incomplete ? parsed.title : "";
    if (parsed.blocked) {
        try {
            const segments = new URL(finalUrl).pathname.split('/').filter(Boolean);
            const last = segments[segments.length - 1];
            if (last && !last.match(/^\d+(\.pdf)?$/i)) searchTitle = decodeURIComponent(last).replace(/[-_]/g, ' ').replace(/\.pdf/i, '').trim();
        } catch(e) {}
    }

    if (searchTitle) {
        const aiResult = await searchByTitleAI(searchTitle);
        if (aiResult) return aiResult;
    }

    if (parsed.success) return parsed.data;
    if (parsed.blocked) throw new Error("Sistem kami diblokir oleh anti-bot dari website. Mohon ketik manual.");
    if (parsed.incomplete) {
        parsed.data = {
            authorFootnote: "Penulis Tidak Diketahui", authorDafpus: "Penulis Tidak Diketahui", year: "Tahun", month: "", 
            title: parsed.title || "Judul Artikel", journal: "", page: "", volume: "", issue: "", publisher: "", kotaScraped: "", doiUrl: ""
        };
        return parsed.data;
    }
    throw new Error("Gagal mengekstrak data dari tautan ini.");
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
    let datePart = m.month ? `${m.month} ` : "";
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
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const fetchURL = async () => {
    if (!urlInput) return;
    setLoading(true); setError(""); setMetadata(null);
    try {
      const meta = await processURL(urlInput);
      setMetadata(meta);
      setFootnoteResult(buildFootnote(meta, kotaInput));
      setDafpusResult(buildDafpus(meta, kotaInput));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const handleGenerateManual = () => {
    setError("");
    if (!mAuthor || !mTitle || !mYear) return setError("Nama Penulis, Judul, dan Tahun wajib diisi.");
    let fn = "Penulis Tidak Diketahui", dp = "Penulis Tidak Diketahui";
    if (mAuthor.trim()) {
      const authors = mAuthor.split(",").map((a) => a.trim()).filter(Boolean);
      const parts = authors[0].split(" ").filter(Boolean);
      let family = "", given = "";
      if (parts.length === 1) { family = parts[0]; } else { family = parts.pop(); given = parts.join(" "); }
      fn = given ? `${capitalize(given)} ${capitalize(family)}` : capitalize(family);
      dp = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family);
      if (authors.length > 1) { fn += " <i>et al.</i>"; dp += " <i>et al.</i>"; }
    }
    const meta = { authorFootnote: fn, authorDafpus: dp, title: mTitle, journal: mJournal, year: mYear, month: "", volume: mVolume, issue: mIssue, page: mPage, publisher: mPublisher, kotaScraped: "" };
    setMetadata(meta); setFootnoteResult(buildFootnote(meta, kotaInput)); setDafpusResult(buildDafpus(meta, kotaInput));
  };

  const handleBatchGenerate = async () => {
    if (!batchInput.trim()) return setError("Masukkan setidaknya 1 baris URL/DOI.");
    setLoading(true); setError(""); setBatchResults([]); setMetadata(null);
    const lines = batchInput.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const results = [];
    for (const line of lines) {
      const isDoi = (line.includes("10.") && !line.includes("http")) || line.includes("doi.org");
      try {
        let meta = isDoi ? await processDOI(line) : await processURL(line);
        results.push({ status: "success", line, meta });
      } catch (err) { results.push({ status: "error", line, error: err.message }); }
    }
    setBatchResults(results); setLoading(false);
  };

  const handleCopy = (htmlString, targetCopyId) => {
    if (!htmlString) return;
    const plainText = htmlString.replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]+>/g, "");
    const div = document.createElement("div"); div.innerHTML = htmlString; div.style.position = "fixed"; div.style.left = "-9999px";
    document.body.appendChild(div);
    const selection = window.getSelection(); const range = document.createRange();
    range.selectNodeContents(div); selection.removeAllRanges(); selection.addRange(range);
    let success = false;
    try { success = document.execCommand("copy"); } catch (err) {}
    selection.removeAllRanges(); document.body.removeChild(div);
    if (!success) { navigator.clipboard.writeText(plainText).then(()=>success=true); }
    if (success) { setCopiedId(targetCopyId); setTimeout(() => setCopiedId(null), 2000); }
  };

  // --- ICONS ---
  const BoltIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="24" width="24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>;
  const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" height="16" width="16"><polyline points="20 6 9 17 4 12"></polyline></svg>;
  const CopyIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;
  const WarningIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
  const SunIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="20" width="20"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>;
  const MoonIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="20" width="20"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>;
  const ArrowLeftIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="18" width="18"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
  const ChevronDownIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><polyline points="6 9 12 15 18 9"></polyline></svg>;

  // Constants
  const batchSuccesses = batchResults.filter(r => r.status === 'success');
  const batchErrors = batchResults.filter(r => r.status === 'error');
  const sortedBatchDafpus = [...batchSuccesses].sort((a, b) => a.meta.authorDafpus.localeCompare(b.meta.authorDafpus));

  // --- SKELETON LOADER COMPONENT ---
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
    <div className="app-wrapper" data-theme={isDarkMode ? 'dark' : 'light'}>
      
      {/* STICKY NAVBAR (Rounded Rectangle / Kapsul) */}
      <div className="navbar-wrapper">
        <nav className="navbar">
          <div className="nav-container">
            <div className="nav-logo" onClick={() => navigateTo("landing")}>
              <BoltIcon /> FlashCite
            </div>
            {currentView === "landing" && (
              <div className="nav-links hidden-mobile">
                <a href="#hero">Beranda</a>
                <a href="#how-it-works">Cara Kerja</a>
                <a href="#features">Fitur</a>
                <a href="#faq">FAQ</a>
              </div>
            )}
            <div className="nav-actions">
              <button className="theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Toggle Dark Mode">
                {isDarkMode ? <SunIcon /> : <MoonIcon />}
              </button>
              {currentView === "landing" && (
                <button onClick={() => navigateTo("tool")} className="btn-primary btn-sm hidden-mobile">Coba Gratis</button>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* --- VIEW 1: LANDING PAGE LENGKAP --- */}
      {currentView === "landing" && (
        <>
          <section id="hero" className="hero-section animate-fade">
            <div className="container text-center">
              <div className="badge-pill mx-auto mb-4">🚀 Generator Sitasi Akademik Tercepat & Paling Cerdas</div>
              <h1 className="hero-title">
                Ubah Tautan Jurnal dan DOI Menjadi <br/>
                <span className="text-gradient">Sitasi Sempurna</span> Seketika.
              </h1>
              <p className="hero-subtitle mx-auto">
                Tinggalkan cara lama mengetik daftar pustaka. FlashCite dengan AI pintar mengekstrak metadata langsung dari PDF, mem-bypass proteksi Cloudflare, dan menyusunnya untuk Anda.
              </p>
              <div className="hero-cta mt-8 flex justify-center gap-4">
                <button onClick={() => navigateTo("tool")} className="btn-primary btn-lg">Buka Ruang Kerja (Gratis)</button>
                <a href="#how-it-works" className="btn-secondary btn-lg hidden-mobile">Pelajari Cara Kerja</a>
              </div>
            </div>
          </section>

          <section className="integrations-section text-center animate-slide-up">
            <div className="container">
              <p className="text-sm text-muted font-semibold mb-4 uppercase tracking-wide">Mendukung Ekstraksi Otomatis Dari Platform Terkemuka</p>
              <div className="flex justify-center items-center gap-6 flex-wrap opacity-70 grayscale">
                <span className="font-bold text-lg">Academia.edu</span>
                <span className="font-bold text-lg">ResearchGate</span>
                <span className="font-bold text-lg">Crossref</span>
                <span className="font-bold text-lg">OJS Platform</span>
                <span className="font-bold text-lg">Semantic Scholar</span>
              </div>
            </div>
          </section>

          <section id="how-it-works" className="steps-section">
            <div className="container">
              <div className="text-center mb-10">
                <h2 className="section-title">Hanya Butuh 3 Langkah Mudah</h2>
                <p className="section-subtitle">Otomatisasi daftar pustaka belum pernah semudah ini.</p>
              </div>
              <div className="grid-3 text-center">
                <div className="step-card">
                  <div className="step-number">1</div>
                  <h3>Salin Tautan (Link/DOI)</h3>
                  <p>Temukan jurnal penelitian Anda di internet, lalu salin URL halaman web, URL unduhan PDF, atau nomor DOI-nya.</p>
                </div>
                <div className="step-card">
                  <div className="step-number">2</div>
                  <h3>Tempel di FlashCite</h3>
                  <p>Buka ruang kerja kami, pilih mode yang sesuai (Link, DOI, atau Batch), lalu tempelkan tautan yang telah disalin.</p>
                </div>
                <div className="step-card">
                  <div className="step-number">3</div>
                  <h3>Salin Sitasi Sempurna</h3>
                  <p>Sistem kami akan menembus proteksi web untuk menarik metadata dan mengubahnya menjadi Catatan Kaki & Daftar Pustaka.</p>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="features-section">
            <div className="container">
               <div className="text-center mb-10">
                <h2 className="section-title">Fitur Kelas Enterprise, Gratis.</h2>
                <p className="section-subtitle">Dibangun dengan teknologi Headless Browser dan AI canggih.</p>
              </div>
              <div className="grid-3">
                <div className="feature-card">
                  <div className="feature-icon bg-blue-100 text-blue-600">🛡️</div>
                  <h3>Anti-Cloudflare Bypass</h3>
                  <p>Tidak perlu khawatir link diblokir. Mesin kami menembus pelindung Captcha otomatis untuk menarik data dari Academia & ResearchGate.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon bg-green-100 text-green-600">🤖</div>
                  <h3>AI Self-Healing</h3>
                  <p>Jika website tujuan tidak memberikan metadata lengkap, AI kami akan melacak judul artikel ke database Semantic Scholar secara cerdas.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon bg-purple-100 text-purple-600">⚡</div>
                  <h3>Pemrosesan Massal (Batch)</h3>
                  <p>Punya 50 referensi jurnal? Paste semua URL sekaligus, dan FlashCite akan memproses semuanya lalu mengurutkannya sesuai abjad.</p>
                </div>
              </div>
            </div>
          </section>

          <section id="faq" className="faq-section">
             <div className="container">
              <div className="text-center mb-10">
                <h2 className="section-title">Pertanyaan Sering Diajukan (FAQ)</h2>
              </div>
              <div className="faq-container mx-auto max-w-2xl">
                
                <div className={`faq-item ${openFaq === 1 ? 'active' : ''}`} onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}>
                  <div className="faq-header">
                    <h4>Apakah FlashCite benar-benar gratis?</h4>
                    <span className="faq-icon"><ChevronDownIcon /></span>
                  </div>
                  <div className="faq-body">
                    <p>Ya, 100% gratis. Sistem ini dibangun untuk mempermudah mahasiswa dan akademisi tanpa ada batasan pemrosesan per hari.</p>
                  </div>
                </div>

                <div className={`faq-item ${openFaq === 2 ? 'active' : ''}`} onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}>
                  <div className="faq-header">
                    <h4>Kenapa ada keterangan "Penulis Tidak Diketahui"?</h4>
                    <span className="faq-icon"><ChevronDownIcon /></span>
                  </div>
                  <div className="faq-body">
                    <p>Beberapa jurnal lama atau website yang tidak diindeks dengan baik mungkin tidak melampirkan metadata terstruktur. Namun, AI kami akan selalu berusaha mencari versi yang lebih baik jika memungkinkan.</p>
                  </div>
                </div>

                <div className={`faq-item ${openFaq === 3 ? 'active' : ''}`} onClick={() => setOpenFaq(openFaq === 3 ? null : 3)}>
                  <div className="faq-header">
                    <h4>Apakah aplikasi ini mendukung format APA/MLA?</h4>
                    <span className="faq-icon"><ChevronDownIcon /></span>
                  </div>
                  <div className="faq-body">
                    <p>Saat ini, mesin generator kami dikonfigurasi khusus untuk standar penulisan hukum dan akademik umum di Indonesia yang memisahkan Catatan Kaki (Footnote) dan Daftar Pustaka.</p>
                  </div>
                </div>

              </div>
             </div>
          </section>

          <section className="cta-section text-center">
            <div className="container">
              <div className="cta-card">
                <h2>Siap menghemat waktu menyusun skripsi?</h2>
                <p className="mb-6">Coba generator cerdas kami sekarang. Tanpa registrasi.</p>
                <button onClick={() => navigateTo("tool")} className="btn-primary btn-lg">Mulai Generate Sitasi</button>
              </div>
            </div>
          </section>

          <footer className="footer">
            <div className="container footer-content">
              <div className="footer-brand">
                <div className="flex items-center gap-2 mb-2 font-bold text-lg"><BoltIcon /> FlashCite</div>
                <p>Automasi sitasi akademik pintar untuk mempermudah penelitian dan penulisan karya ilmiah Anda secara instan dan akurat.</p>
              </div>
              <div className="footer-links">
                <h4>Navigasi</h4>
                <a href="#hero" onClick={(e) => { e.preventDefault(); navigateTo("landing"); }}>Beranda</a>
                <a href="#how-it-works">Cara Kerja</a>
                <a href="#features">Fitur Utama</a>
              </div>
              <div className="footer-links">
                <h4>Produk</h4>
                <a href="#" onClick={(e) => { e.preventDefault(); navigateTo("tool"); }}>Ruang Kerja (App)</a>
                <a href="#faq">Bantuan (FAQ)</a>
              </div>
            </div>
            <div className="container footer-bottom text-center">
              <p>&copy; {new Date().getFullYear()} FlashCite. Dirancang untuk akademisi Indonesia.</p>
            </div>
          </footer>
        </>
      )}

      {/* --- VIEW 2: WORKSPACE APP (Generator Tool) --- */}
      {currentView === "tool" && (
        <section className="tool-section animate-slide-up">
          <div className="container tool-container">
            
            {/* Header Tool */}
            <div className="tool-header flex items-center justify-between mb-6">
              <div>
                <h2 className="section-title text-left m-0">Ruang Kerja</h2>
                <p className="section-subtitle text-left m-0">Tarik metadata dari sumber terpercaya.</p>
              </div>
              <button onClick={() => navigateTo("landing")} className="btn-secondary btn-sm flex items-center gap-2">
                <ArrowLeftIcon /> Beranda
              </button>
            </div>

            {/* Clean Card UI */}
            <div className="card shadow-md">
              {/* Tabs Navigation */}
              <div className="card-tabs">
                <button className={`tab-btn ${inputMode === "doi" ? "active" : ""}`} onClick={() => setInputMode("doi")}>Nomor DOI</button>
                <button className={`tab-btn ${inputMode === "url" ? "active" : ""}`} onClick={() => setInputMode("url")}>Link Web/PDF</button>
                <button className={`tab-btn ${inputMode === "batch" ? "active" : ""}`} onClick={() => setInputMode("batch")}>Mode Batch</button>
                <button className={`tab-btn ${inputMode === "manual" ? "active" : ""}`} onClick={() => setInputMode("manual")}>Manual</button>
              </div>
              
              {/* Card Body - MINIMALIST */}
              <div className="card-body">
                {inputMode === "doi" && (
                  <div className="animate-fade">
                    <div className="form-group">
                      <input type="text" className="input-field" value={doiInput} onChange={(e)=>setDoiInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&fetchDOI()} placeholder="Paste Nomor DOI (Misal: 10.1038/s41586...)" />
                    </div>
                    <div className="form-group mb-6">
                      <input type="text" className="input-field" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Kota Terbit (Opsional)" />
                    </div>
                    <button className="btn-primary w-full" onClick={fetchDOI} disabled={loading || !doiInput}>
                      {loading ? "Menarik Metadata..." : "Generate Sitasi"}
                    </button>
                  </div>
                )}

                {inputMode === "url" && (
                  <div className="animate-fade">
                    <div className="form-group">
                      <input type="text" className="input-field" value={urlInput} onChange={(e)=>setUrlInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&fetchURL()} placeholder="Paste Link Artikel / URL PDF Jurnal" />
                    </div>
                    <div className="form-group mb-6">
                      <input type="text" className="input-field" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Kota Terbit (Opsional)" />
                    </div>
                    <button className="btn-primary w-full" onClick={fetchURL} disabled={loading || !urlInput}>
                      {loading ? "Menganalisis Tautan..." : "Generate Sitasi"}
                    </button>
                  </div>
                )}

                {inputMode === "manual" && (
                  <div className="animate-fade">
                    <div className="grid-2 gap-4">
                      <div className="col-span-2">
                        <input type="text" className="input-field" value={mAuthor} onChange={(e)=>setMAuthor(e.target.value)} placeholder="Nama Penulis Lengkap *" />
                      </div>
                      <div className="col-span-2">
                        <input type="text" className="input-field" value={mTitle} onChange={(e)=>setMTitle(e.target.value)} placeholder="Judul Artikel *" />
                      </div>
                      <div><input type="text" className="input-field" value={mJournal} onChange={(e)=>setMJournal(e.target.value)} placeholder="Nama Jurnal" /></div>
                      <div><input type="text" className="input-field" value={mYear} onChange={(e)=>setMYear(e.target.value)} placeholder="Tahun Terbit *" /></div>
                      <div><input type="text" className="input-field" value={mVolume} onChange={(e)=>setMVolume(e.target.value)} placeholder="Volume" /></div>
                      <div><input type="text" className="input-field" value={mIssue} onChange={(e)=>setMIssue(e.target.value)} placeholder="Isu / Nomor" /></div>
                      <div><input type="text" className="input-field" value={mPage} onChange={(e)=>setMPage(e.target.value)} placeholder="Halaman" /></div>
                      <div><input type="text" className="input-field" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Kota Terbit" /></div>
                    </div>
                    <button className="btn-primary w-full mt-6" onClick={handleGenerateManual}>
                      Generate Sitasi
                    </button>
                  </div>
                )}

                {inputMode === "batch" && (
                  <div className="animate-fade">
                    <div className="form-group">
                      <textarea className="input-field textarea-field" value={batchInput} onChange={(e)=>setBatchInput(e.target.value)} placeholder="Paste banyak URL atau DOI di sini (1 Baris = 1 Link/DOI)" />
                    </div>
                    <div className="form-group mb-6">
                      <input type="text" className="input-field" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Kota Terbit Global (Opsional)" />
                    </div>
                    <button className="btn-primary w-full" onClick={handleBatchGenerate} disabled={loading || !batchInput}>
                      {loading ? "Memproses Batch..." : "Generate Semua"}
                    </button>
                  </div>
                )}

                {error && (
                  <div className="error-alert mt-6 animate-fade">
                    <WarningIcon /> {error}
                  </div>
                )}
              </div>
            </div>

            {/* LOADING SKELETON */}
            {loading && inputMode !== 'batch' && <SkeletonLoader />}
            {loading && inputMode === 'batch' && <><SkeletonLoader /><div style={{opacity:0.5}}><SkeletonLoader /></div></>}

            {/* RESULTS AREA: SINGLE */}
            {!loading && metadata && inputMode !== "batch" && (
              <div className="card shadow-md mt-6 animate-slide-up border-success">
                <div className="card-body">
                  <div className="result-block">
                    <div className="result-header">
                      <span>CATATAN KAKI (FOOTNOTE)</span>
                      <button className="btn-icon" onClick={() => handleCopy(footnoteResult, "single-fn")}>
                        {copiedId === "single-fn" ? <><CheckIcon /> Disalin</> : <><CopyIcon /> Salin</>}
                      </button>
                    </div>
                    <div className="result-html" dangerouslySetInnerHTML={{ __html: footnoteResult }} />
                  </div>

                  <div className="result-block mt-6">
                    <div className="result-header">
                      <span>DAFTAR PUSTAKA</span>
                      <button className="btn-icon" onClick={() => handleCopy(dafpusResult, "single-dp")}>
                        {copiedId === "single-dp" ? <><CheckIcon /> Disalin</> : <><CopyIcon /> Salin</>}
                      </button>
                    </div>
                    <div className="result-html" dangerouslySetInnerHTML={{ __html: dafpusResult }} />
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
                      <h3 className="batch-title">Catatan Kaki ({batchSuccesses.length})</h3>
                      {batchSuccesses.map((r, index) => {
                        const content = buildFootnote(r.meta, kotaInput);
                        const copyId = `batch-fn-${index}`;
                        return (
                          <div className="result-block mb-4" key={copyId}>
                            <div className="result-header">
                              <span className="truncate">{r.line}</span>
                              <button className="btn-icon" onClick={() => handleCopy(content, copyId)}>
                                {copiedId === copyId ? <CheckIcon /> : <CopyIcon />}
                              </button>
                            </div>
                            <div className="result-html" dangerouslySetInnerHTML={{ __html: content }} />
                          </div>
                        )
                      })}

                      <h3 className="batch-title mt-8">Daftar Pustaka A-Z ({sortedBatchDafpus.length})</h3>
                      {sortedBatchDafpus.map((r, index) => {
                        const content = buildDafpus(r.meta, kotaInput);
                        const copyId = `batch-dp-${index}`;
                        return (
                          <div className="result-block mb-4" key={copyId}>
                            <div className="result-header">
                              <span className="truncate">{r.line}</span>
                              <button className="btn-icon" onClick={() => handleCopy(content, copyId)}>
                                {copiedId === copyId ? <CheckIcon /> : <CopyIcon />}
                              </button>
                            </div>
                            <div className="result-html" dangerouslySetInnerHTML={{ __html: content }} />
                          </div>
                        )
                      })}
                    </>
                  )}

                  {batchErrors.length > 0 && (
                    <div className="error-alert mt-8">
                      <strong>Gagal ({batchErrors.length}):</strong>
                      <ul className="mt-2 pl-4 list-disc">
                        {batchErrors.map((err, i) => <li key={i} className="text-sm">{err.line} - {err.error}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div style={{ height: '80px' }}></div>
          </div>
        </section>
      )}

      {/* --- CSS STYLING & VARIABLES --- */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        /* ROOT & APP WRAPPER (ISOLASI TEMA) */
        .app-wrapper {
          --bg-body: #f8fafc;
          --bg-surface: #ffffff;
          --bg-surface-hover: #f1f5f9;
          
          --text-main: #0f172a;
          --text-muted: #64748b;
          --text-light: #ffffff;
          
          --border-color: #e2e8f0;
          --border-focus: #3b82f6;
          
          --primary: #2563eb;
          --primary-hover: #1d4ed8;
          --primary-gradient: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
          
          --success-light: #f0fdf4;
          --success-border: #22c55e;
          --error-bg: #fef2f2;
          --error-text: #b91c1c;

          --nav-bg: rgba(255, 255, 255, 0.85);
          --skeleton-bg: #e2e8f0;

          --radius-sm: 8px;
          --radius-md: 12px;
          --radius-lg: 16px;

          background-color: var(--bg-body);
          color: var(--text-main);
          min-height: 100vh;
          width: 100%;
          font-family: 'Inter', system-ui, sans-serif;
          transition: background-color 0.3s ease, color 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        /* DARK MODE - Murni diterapkan via Data Attribute ke Wrapper */
        .app-wrapper[data-theme="dark"] {
          --bg-body: #020617;        /* Hitam legam / Slate 950 */
          --bg-surface: #0f172a;     /* Slate 900 untuk Card */
          --bg-surface-hover: #1e293b; /* Slate 800 untuk Hover */
          
          --text-main: #f8fafc;      /* Putih bersih */
          --text-muted: #94a3b8;     /* Abu-abu terang */
          
          --border-color: #1e293b;   /* Border nyaris menyatu */
          --border-focus: #3b82f6;

          --primary: #3b82f6;
          --primary-hover: #60a5fa;
          --primary-gradient: linear-gradient(135deg, #3b82f6 0%, #818cf8 100%);
          
          --success-light: rgba(34, 197, 94, 0.1);
          --success-border: #22c55e;
          --error-bg: rgba(239, 68, 68, 0.1);
          --error-text: #fca5a5;

          --nav-bg: rgba(15, 23, 42, 0.85); /* Tembus pandang elegan */
          --skeleton-bg: #1e293b;
        }

        /* GLOBAL RESET DALAM WRAPPER */
        html, body { margin: 0; padding: 0; width: 100%; scroll-behavior: smooth; }
        * { box-sizing: border-box; }

        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }

        /* UTILS */
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-gradient {
          background: var(--primary-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .flex { display: flex; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .gap-2 { gap: 0.5rem; }
        .gap-4 { gap: 1rem; }
        .gap-6 { gap: 1.5rem; }
        .m-0 { margin: 0; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-6 { margin-top: 1.5rem; }
        .mt-8 { margin-top: 2rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mb-10 { margin-bottom: 2.5rem; }
        .w-full { width: 100%; }
        .max-w-2xl { max-width: 42rem; }
        .text-sm { font-size: 0.875rem; }
        .text-lg { font-size: 1.125rem; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .uppercase { text-transform: uppercase; }
        .tracking-wide { letter-spacing: 0.05em; }
        .opacity-70 { opacity: 0.7; }
        .grayscale { filter: grayscale(100%); }
        .flex-wrap { flex-wrap: wrap; }
        .text-muted { color: var(--text-muted); }

        /* NAVBAR (MELAYANG / ROUNDED RECTANGLE) */
        .navbar-wrapper {
          position: sticky;
          top: 0.75rem; /* Jarak Atas Sangat Tipis */
          z-index: 100;
          padding: 0 1rem;
        }
        .navbar {
          background: var(--nav-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--border-color);
          border-radius: 16px; /* Sudut Tumpul Modern */
          padding: 0.75rem 1.5rem; /* Padding seimbang */
          transition: background-color 0.3s ease, border-color 0.3s ease;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
          max-width: 1000px;
          margin: 0 auto;
        }
        .nav-container {
          display: flex; justify-content: space-between; align-items: center;
        }
        .nav-logo {
          font-weight: 800; font-size: 1.25rem; color: var(--text-main);
          display: flex; align-items: center; gap: 6px; cursor: pointer;
        }
        .nav-links { display: flex; gap: 1.5rem; }
        .nav-links a {
          text-decoration: none; color: var(--text-muted); font-weight: 500; font-size: 0.95rem;
          transition: color 0.2s;
        }
        .nav-links a:hover { color: var(--text-main); }
        .nav-actions { display: flex; align-items: center; gap: 1rem; }
        
        .theme-toggle {
          background: transparent; border: none; color: var(--text-muted);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          padding: 6px; border-radius: var(--radius-sm); transition: background 0.2s, color 0.2s;
        }
        .theme-toggle:hover { background: var(--bg-surface-hover); color: var(--text-main); }

        /* BUTTONS */
        .btn-primary {
          background: var(--primary); color: #ffffff;
          border: none; border-radius: var(--radius-sm); font-weight: 600;
          cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;
          transition: all 0.2s ease;
          padding: 0.875rem 1.5rem; /* Tambahkan padding dasar di sini */
          font-size: 1rem;
        }
        .btn-primary:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        
        .btn-secondary {
          background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-color);
          border-radius: var(--radius-sm); font-weight: 600; cursor: pointer; text-decoration: none;
          display: inline-flex; align-items: center; justify-content: center;
          transition: all 0.2s ease;
          padding: 0.875rem 1.5rem; /* Tambahkan padding dasar di sini */
          font-size: 1rem;
        }
        .btn-secondary:hover { background: var(--bg-surface-hover); }

        .btn-sm { padding: 0.5rem 1rem; font-size: 0.85rem; }
        .btn-lg { padding: 1rem 2rem; font-size: 1.1rem; border-radius: var(--radius-md); }

        /* SECTIONS & TYPOGRAPHY */
        .section-title { font-size: 2rem; font-weight: 800; margin: 0 0 0.5rem; color: var(--text-main); }
        .section-subtitle { color: var(--text-muted); margin: 0; font-size: 1.1rem; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem; }

        /* HERO SECTION */
        .hero-section { padding: 5rem 0 3rem; }
        .badge-pill {
          display: inline-block; padding: 6px 14px; font-size: 0.8rem; font-weight: 600;
          background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-muted);
          border-radius: 50px; transition: background-color 0.3s ease, border-color 0.3s ease;
        }
        .hero-title { font-size: 2.75rem; font-weight: 800; line-height: 1.2; margin: 0 0 1.25rem; }
        .hero-subtitle { font-size: 1.1rem; color: var(--text-muted); line-height: 1.6; max-width: 650px; }

        /* INTEGRATIONS & STEPS */
        .integrations-section { padding: 2rem 0 4rem; }
        .steps-section { padding: 4rem 0; background: var(--bg-surface-hover); }
        .step-card { padding: 1.5rem; text-align: center; }
        .step-number {
          width: 48px; height: 48px; background: var(--primary-gradient); color: white;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem; font-weight: 800; margin: 0 auto 1.5rem;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
        }
        .step-card h3 { margin: 0 0 0.75rem; font-size: 1.2rem; color: var(--text-main); }
        .step-card p { margin: 0; color: var(--text-muted); line-height: 1.5; font-size: 0.95rem; }

        /* FEATURES SECTION */
        .features-section { padding: 5rem 0; }
        .feature-card {
          background: var(--bg-surface); border: 1px solid var(--border-color);
          padding: 2rem; border-radius: var(--radius-md); text-align: left;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .feature-card:hover { transform: translateY(-5px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
        .feature-icon {
          width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem; margin-bottom: 1.5rem;
        }
        .bg-blue-100 { background-color: rgba(59, 130, 246, 0.1); }
        .bg-green-100 { background-color: rgba(34, 197, 94, 0.1); }
        .bg-purple-100 { background-color: rgba(168, 85, 247, 0.1); }
        .feature-card h3 { margin: 0 0 0.75rem; font-size: 1.15rem; color: var(--text-main); }
        .feature-card p { margin: 0; color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; }

        /* FAQ SECTION */
        .faq-section { padding: 4rem 0 5rem; background: var(--bg-surface-hover); }
        .faq-item {
          background: var(--bg-surface); border: 1px solid var(--border-color);
          border-radius: var(--radius-md); margin-bottom: 1rem; overflow: hidden;
          transition: all 0.3s ease; cursor: pointer;
        }
        .faq-header {
          padding: 1.5rem; display: flex; justify-content: space-between; align-items: center;
        }
        .faq-header h4 { margin: 0; font-size: 1.05rem; font-weight: 600; color: var(--text-main); }
        .faq-icon { color: var(--text-muted); transition: transform 0.3s ease; }
        .faq-item.active .faq-icon { transform: rotate(180deg); }
        .faq-body {
          padding: 0 1.5rem; max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease;
          color: var(--text-muted); line-height: 1.6;
        }
        .faq-item.active .faq-body { max-height: 200px; padding-bottom: 1.5rem; }

        /* CTA SECTION */
        .cta-section { padding: 5rem 0; }
        .cta-card {
          background: var(--primary-gradient); border-radius: var(--radius-lg);
          padding: 4rem 2rem; color: white; box-shadow: 0 20px 40px -10px rgba(37,99,235,0.3);
        }
        .cta-card h2 { font-size: 2rem; font-weight: 800; margin: 0 0 1rem; color: white; }
        .cta-card p { font-size: 1.1rem; opacity: 0.9; margin: 0 0 2rem; }
        .cta-card .btn-primary { background: white; color: var(--primary); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .cta-card .btn-primary:hover { background: #f8fafc; }

        /* FOOTER */
        .footer {
          background: var(--bg-surface); border-top: 1px solid var(--border-color);
          padding: 4rem 0 2rem; margin-top: auto;
        }
        .footer-content { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 2rem; margin-bottom: 3rem; }
        .footer-brand { max-width: 350px; }
        .footer-brand p { font-size: 0.9rem; color: var(--text-muted); line-height: 1.6; margin: 0; }
        .footer-links h4 { margin: 0 0 1.25rem; font-size: 1rem; color: var(--text-main); font-weight: 700; }
        .footer-links a {
          display: block; color: var(--text-muted); text-decoration: none; margin-bottom: 0.75rem; font-size: 0.9rem;
          transition: color 0.2s;
        }
        .footer-links a:hover { color: var(--primary); }
        .footer-bottom { border-top: 1px solid var(--border-color); padding-top: 2rem; font-size: 0.85rem; color: var(--text-muted); }

        /* TOOL SECTION (WORKSPACE) */
        .tool-section { padding: 2rem 0 6rem; flex: 1; }
        .tool-header { padding-top: 1rem; }

        /* CARDS & TABS (TOOL UI) */
        .card {
          background: var(--bg-surface); border: 1px solid var(--border-color);
          border-radius: var(--radius-md); overflow: hidden;
        }
        .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .border-success { border-top: 4px solid var(--success-border); }
        
        .card-tabs {
          display: flex; border-bottom: 1px solid var(--border-color); background: var(--bg-surface-hover);
        }
        .tab-btn {
          flex: 1; background: transparent; border: none; padding: 1.15rem 0.5rem;
          font-weight: 600; font-size: 0.85rem; color: var(--text-muted); cursor: pointer;
          border-bottom: 2px solid transparent; transition: all 0.2s;
        }
        .tab-btn:hover { color: var(--text-main); background: var(--bg-surface); }
        .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); background: var(--bg-surface); }
        
        .card-body { padding: 2.5rem; }

        /* FORMS */
        .input-field {
          width: 100%; padding: 0.875rem 1rem; font-size: 0.95rem; color: var(--text-main);
          background: var(--bg-body); border: 1px solid var(--border-color);
          border-radius: var(--radius-sm); outline: none; 
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-field::placeholder { color: var(--text-muted); opacity: 0.7; }
        .input-field:focus { border-color: var(--border-focus); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        .textarea-field { min-height: 120px; resize: vertical; line-height: 1.5; }

        /* RESULTS AREA */
        .result-block {
          background: var(--bg-body); border: 1px solid var(--border-color);
          border-radius: var(--radius-sm); overflow: hidden;
        }
        .result-header {
          padding: 0.75rem 1rem; background: var(--bg-surface-hover); border-bottom: 1px solid var(--border-color);
          display: flex; justify-content: space-between; align-items: center;
          font-size: 0.75rem; font-weight: 700; color: var(--text-muted);
        }
        .result-html { padding: 1.25rem; font-size: 0.95rem; line-height: 1.6; word-break: break-word; }
        .batch-title { font-size: 1rem; font-weight: 700; margin: 0 0 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
        .truncate { display: inline-block; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .btn-icon {
          background: transparent; border: 1px solid var(--border-color); border-radius: 4px;
          padding: 4px 8px; font-size: 0.75rem; font-weight: 600; color: var(--text-main);
          cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
          transition: background-color 0.2s;
        }
        .btn-icon:hover { background: var(--bg-surface-hover); }

        /* ALERTS & SKELETON */
        .error-alert {
          background: var(--error-bg); border: 1px solid var(--error-text); color: var(--error-text);
          padding: 1rem; border-radius: var(--radius-sm); font-size: 0.9rem;
          display: flex; gap: 10px; align-items: flex-start;
        }
        .bg-skeleton { background: var(--skeleton-bg); transition: background-color 0.3s ease; }
        .skeleton-pulse { animation: pulse 1.5s infinite ease-in-out; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* ANIMATIONS */
        .animate-fade { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.5s ease; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

        /* RESPONSIVE */
        @media (max-width: 640px) {
          .hidden-mobile { display: none !important; }
          .hero-title { font-size: 2rem; }
          .grid-2 { grid-template-columns: 1fr; }
          .col-span-2 { grid-column: span 1; }
          .card-tabs { flex-wrap: wrap; }
          .tab-btn { flex-basis: 50%; border-bottom: 1px solid var(--border-color); }
          .card-body { padding: 1.5rem; }
          .truncate { max-width: 150px; }
          .footer-content { flex-direction: column; }
          .tool-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .cta-card { padding: 2.5rem 1.5rem; }
        }
      `}</style>
    </div>
  );
}
