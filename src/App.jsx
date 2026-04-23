import React, { useState, useEffect } from "react";

export default function App() {
  // Mode State (Diatur oleh Bottom Nav)
  const [inputMode, setInputMode] = useState("doi"); // "doi" | "url" | "manual"

  // Form States
  const [doiInput, setDoiInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
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
  const [footnoteResult, setFootnoteResult] = useState("");
  const [dafpusResult, setDafpusResult] = useState("");
  const [copiedFootnote, setCopiedFootnote] = useState(false);
  const [copiedDafpus, setCopiedDafpus] = useState(false);

  // Clear error saat ganti tab
  useEffect(() => {
    setError("");
  }, [inputMode]);

  const cleanDOI = (input) => input.trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "");

  const capitalize = (str) => {
    if (!str || typeof str !== "string") return "";
    return str.toLowerCase().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
  };

  // --- LOGIC CROSSREF & OJS ---
  const formatAuthorsFootnote = (authors) => {
    if (!authors || !authors.length) return "Penulis Tidak Diketahui";
    const firstAuthor = `${authors[0].given || ""} ${authors[0].family || ""}`.trim();
    if (authors.length > 1) return `${firstAuthor} <i>et al.</i>`;
    return firstAuthor;
  };

  const formatAuthorsDafpus = (authors) => {
    if (!authors || !authors.length) return "Penulis Tidak Diketahui";
    const family = capitalize(authors[0].family || "");
    const given = capitalize(authors[0].given || "");
    let firstAuthor = family && given ? `${family}, ${given}` : family || given;
    if (authors.length > 1) return `${firstAuthor} <i>et al.</i>`;
    return firstAuthor;
  };

  // --- LOGIC MANUAL ---
  const parseManualAuthor = (authorStr) => {
    if (!authorStr.trim()) return { fn: "Penulis Tidak Diketahui", dp: "Penulis Tidak Diketahui" };
    const authors = authorStr.split(",").map((a) => a.trim()).filter((a) => a);
    if (authors.length === 0) return { fn: "Penulis Tidak Diketahui", dp: "Penulis Tidak Diketahui" };

    const firstAuthor = authors[0];
    const parts = firstAuthor.split(" ");
    
    const family = parts.length > 1 ? parts.pop() : firstAuthor;
    const given = parts.length > 0 ? parts.join(" ") : "";

    let fn = capitalize(firstAuthor);
    let dp = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family);

    if (authors.length > 1) {
      fn += " <i>et al.</i>";
      dp += " <i>et al.</i>";
    }
    return { fn, dp };
  };

  const buildFootnote = (m, kota) => {
    const kotaTxt = capitalize(kota) ? `${capitalize(kota)}, ` : "";
    const pageTxt = m.page ? `hal. ${m.page}.` : "";
    return `${m.authorFootnote} (${m.year}) ${capitalize(m.title)}. ${capitalize(m.journal)}. ${kotaTxt}${pageTxt}`;
  };

  const buildDafpus = (m, kota) => {
    const parts = [];
    if (m.journal) parts.push(capitalize(m.journal));
    if (m.publisher) parts.push(capitalize(m.publisher));
    if (kota) parts.push(capitalize(kota));

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

  const updateResults = (meta, kota) => {
    setFootnoteResult(buildFootnote(meta, kota));
    setDafpusResult(buildDafpus(meta, kota));
  };

  // --- HANDLERS ---
  const fetchDOI = async () => {
    if (!doiInput) return;
    setLoading(true); setError(""); setFootnoteResult(""); setDafpusResult(""); setMetadata(null);
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDOI(doiInput))}`);
      if (!res.ok) throw new Error("Aduh, DOI tidak ditemukan. Coba periksa lagi ketikannya.");
      const data = await res.json();
      const item = data.message;
      
      const yearObj = item["published-print"] || item.issued;
      const year = yearObj && yearObj["date-parts"] ? yearObj["date-parts"][0][0] : "Tahun";
      const monthNum = yearObj?.["date-parts"]?.[0]?.[1] ?? null;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
      const monthStr = monthNum ? monthNames[monthNum - 1] : "";

      const meta = {
        authorFootnote: formatAuthorsFootnote(item.author),
        authorDafpus: formatAuthorsDafpus(item.author),
        year, month: monthStr,
        title: item.title?.[0] ?? "Judul Artikel",
        journal: item["container-title"]?.[0] ?? "Nama Jurnal",
        page: item.page || "", volume: item.volume || "", issue: item.issue || "", publisher: item.publisher || "",
      };
      setMetadata(meta); updateResults(meta, kotaInput);
    } catch (e) {
      if (e.message === "Failed to fetch") setError("Koneksi terputus. Pastikan ada internet atau matikan Adblock/VPN sebentar ya.");
      else setError(e.message);
    } finally { setLoading(false); }
  };

  const fetchURL = async () => {
    if (!urlInput) return;
    setLoading(true); setError(""); setFootnoteResult(""); setDafpusResult(""); setMetadata(null);
    let htmlContent = "";
    try {
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(urlInput)}`);
        if (!res.ok) throw new Error("Proxy 1 gagal");
        const data = await res.json(); htmlContent = data.contents;
      } catch (err1) {
        const res2 = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(urlInput)}`);
        if (!res2.ok) throw new Error("Gagal mengakses URL.");
        htmlContent = await res2.text();
      }
      if (!htmlContent) throw new Error("Konten tidak ditemukan di URL ini.");

      const parser = new DOMParser(); const doc = parser.parseFromString(htmlContent, "text/html");
      const getMeta = (name) => {
        const el = doc.querySelector(`meta[name="${name}"]`) || doc.querySelector(`meta[property="${name}"]`);
        return el ? el.getAttribute("content") : "";
      };

      const title = getMeta("citation_title") || doc.title || "Judul Tidak Diketahui";
      const authorNodes = doc.querySelectorAll('meta[name="citation_author"]');
      let authors = [];
      authorNodes.forEach(node => authors.push(node.getAttribute("content")));

      let fn = "Penulis Tidak Diketahui", dp = "Penulis Tidak Diketahui";
      if (authors.length > 0) {
        let firstAuthor = authors[0];
        let family = "", given = "";
        
        if (firstAuthor.includes(",")) {
          const parts = firstAuthor.split(",");
          family = parts[0].trim(); given = parts[1].trim();
          firstAuthor = `${given} ${family}`; 
        } else {
          const parts = firstAuthor.split(" ");
          family = parts.length > 1 ? parts.pop() : firstAuthor;
          given = parts.length > 0 ? parts.join(" ") : "";
        }
        fn = capitalize(firstAuthor);
        dp = given ? `${capitalize(family)}, ${capitalize(given)}` : capitalize(family);
        if (authors.length > 1) { fn += " <i>et al.</i>"; dp += " <i>et al.</i>"; }
      }

      const dateStr = getMeta("citation_date") || getMeta("citation_publication_date") || "";
      const year = dateStr ? dateStr.split("/")[0].split("-")[0] : "Tahun";
      const page = getMeta("citation_firstpage") ? (getMeta("citation_lastpage") ? `${getMeta("citation_firstpage")}-${getMeta("citation_lastpage")}` : getMeta("citation_firstpage")) : "";

      const meta = {
        authorFootnote: fn, authorDafpus: dp, year, month: "", title,
        journal: getMeta("citation_journal_title") || "", page, volume: getMeta("citation_volume") || "",
        issue: getMeta("citation_issue") || "", publisher: getMeta("citation_publisher") || "",
      };

      if (!getMeta("citation_title") && authors.length === 0) {
         setError("Hmm, web ini sepertinya tidak punya metadata jurnal standar. Hasil mungkin kurang akurat.");
      }
      setMetadata(meta); updateResults(meta, kotaInput);
    } catch (e) {
      if (e.message === "Failed to fetch") setError("Koneksi gagal. Coba matikan Adblock/VPN di browser kamu.");
      else setError(e.message || "Terjadi kesalahan saat memproses URL.");
    } finally { setLoading(false); }
  };

  const handleGenerateManual = () => {
    setError("");
    if (!mAuthor || !mTitle || !mYear) return setError("Nama Penulis, Judul, dan Tahun wajib diisi bos!");
    const { fn, dp } = parseManualAuthor(mAuthor);
    const meta = {
      authorFootnote: fn, authorDafpus: dp, title: mTitle, journal: mJournal, year: mYear,
      month: "", volume: mVolume, issue: mIssue, page: mPage, publisher: mPublisher,
    };
    setMetadata(meta); updateResults(meta, kotaInput);
  };

  const handleCopy = (htmlString, type) => {
    if (!htmlString) return;
    const plainText = htmlString.replace(/<[^>]+>/g, "");
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
      if (type === "footnote") { setCopiedFootnote(true); setTimeout(() => setCopiedFootnote(false), 2000); } 
      else { setCopiedDafpus(true); setTimeout(() => setCopiedDafpus(false), 2000); }
    }
  };

  // --- ICONS ---
  const SearchIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="18" width="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
  const LinkIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="18" width="18"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>;
  const EditIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="18" width="18"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
  const MenuIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" height="24" width="24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>;
  const BoltIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" height="24" width="24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>;
  const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" height="16" width="16"><polyline points="20 6 9 17 4 12"></polyline></svg>;
  const CopyIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" height="18" width="18"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;
  const PlayCircleIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" height="20" width="20">
      <circle cx="12" cy="12" r="10" fill="white" />
      <polygon points="10 8 16 12 10 16" fill="var(--c-dark)" />
    </svg>
  );

  return (
    <div className="neo-app">
      
      {/* Top Header (White & Sticky) */}
      <header className="neo-header">
        <div className="neo-logo">
          F l <span className="neo-logo-icon"><BoltIcon /></span> s h
        </div>
        <div className="neo-menu-btn"><MenuIcon /></div>
      </header>

      {/* Hero Section (Dark Blue + Pattern) */}
      <section className="neo-hero">
        <div className="neo-hero-content">
          <div className="neo-badge">GENERATE SITASI OTOMATIS</div>
          <h1>
            Ubah <span className="neo-highlight">DOI</span> atau URL ke<br />
            Format <span className="neo-highlight">Sitasi Jurnal</span>
          </h1>
          <p>Transformasi referensi jurnalmu menjadi format Catatan Kaki & Daftar Pustaka dengan cepat dan akurat.</p>
          
          <button className="neo-btn-primary neo-btn-large" onClick={() => window.scrollTo({top: 450, behavior: 'smooth'})}>
            Mulai Buat Sitasi Sekarang
          </button>
        </div>
      </section>

      {/* Main Content Area (Light Blue/Gray) */}
      <section className="neo-content-area">
        <div className="neo-container">
          
          {/* Input Card */}
          <div className="neo-card">
            <div className="neo-card-header">
              <div className="neo-circle"></div>
              {inputMode === "doi" && "INPUT DATA: NOMOR DOI"}
              {inputMode === "url" && "INPUT DATA: LINK URL"}
              {inputMode === "manual" && "INPUT DATA: KETIK MANUAL"}
            </div>
            
            <div className="neo-card-body">
              {/* DOI MODE */}
              {inputMode === "doi" && (
                <div className="neo-fade-in">
                  <div className="neo-form-group">
                    <label className="neo-label">Masukkan Nomor DOI</label>
                    <input type="text" className="neo-input" value={doiInput} onChange={(e)=>setDoiInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&fetchDOI()} placeholder="10.1038/s41586..." />
                  </div>
                  <div className="neo-form-group">
                    <label className="neo-label">Kota Terbit (Opsional)</label>
                    <input type="text" className="neo-input" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Contoh: Jakarta" />
                  </div>
                  <button className="neo-btn-primary neo-w-full" onClick={fetchDOI} disabled={loading || !doiInput}>
                    {loading ? "MEMPROSES..." : "TARIK DATA"}
                  </button>
                </div>
              )}

              {/* URL MODE */}
              {inputMode === "url" && (
                <div className="neo-fade-in">
                  <div className="neo-form-group">
                    <label className="neo-label">Masukkan Link Jurnal</label>
                    <input type="text" className="neo-input" value={urlInput} onChange={(e)=>setUrlInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&fetchURL()} placeholder="https://jurnal.kampus.ac.id/..." />
                  </div>
                  <div className="neo-form-group">
                    <label className="neo-label">Kota Terbit (Opsional)</label>
                    <input type="text" className="neo-input" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} placeholder="Contoh: Bandung" />
                  </div>
                  <button className="neo-btn-primary neo-w-full" onClick={fetchURL} disabled={loading || !urlInput}>
                    {loading ? "MEMPROSES..." : "TARIK DATA"}
                  </button>
                </div>
              )}

              {/* MANUAL MODE */}
              {inputMode === "manual" && (
                <div className="neo-fade-in">
                  <div className="neo-grid">
                    <div className="neo-form-group neo-span-2">
                      <label className="neo-label">Nama Penulis *</label>
                      <input type="text" className="neo-input" value={mAuthor} onChange={(e)=>setMAuthor(e.target.value)} placeholder="Nadiem Makarim, Budi Santoso" />
                    </div>
                    <div className="neo-form-group neo-span-2">
                      <label className="neo-label">Judul Artikel *</label>
                      <input type="text" className="neo-input" value={mTitle} onChange={(e)=>setMTitle(e.target.value)} placeholder="Pengaruh Teknologi..." />
                    </div>
                    <div className="neo-form-group">
                      <label className="neo-label">Nama Jurnal</label>
                      <input type="text" className="neo-input" value={mJournal} onChange={(e)=>setMJournal(e.target.value)} />
                    </div>
                    <div className="neo-form-group">
                      <label className="neo-label">Tahun *</label>
                      <input type="text" className="neo-input" value={mYear} onChange={(e)=>setMYear(e.target.value)} />
                    </div>
                    <div className="neo-form-group">
                      <label className="neo-label">Volume</label>
                      <input type="text" className="neo-input" value={mVolume} onChange={(e)=>setMVolume(e.target.value)} />
                    </div>
                    <div className="neo-form-group">
                      <label className="neo-label">Isu / Nomor</label>
                      <input type="text" className="neo-input" value={mIssue} onChange={(e)=>setMIssue(e.target.value)} />
                    </div>
                    <div className="neo-form-group">
                      <label className="neo-label">Halaman</label>
                      <input type="text" className="neo-input" value={mPage} onChange={(e)=>setMPage(e.target.value)} placeholder="15-25" />
                    </div>
                    <div className="neo-form-group">
                      <label className="neo-label">Kota Terbit</label>
                      <input type="text" className="neo-input" value={kotaInput} onChange={(e) => setKotaInput(e.target.value)} />
                    </div>
                  </div>
                  <button className="neo-btn-primary neo-w-full" onClick={handleGenerateManual}>
                    GENERATE SITASI
                  </button>
                </div>
              )}

              {/* Error Box */}
              {error && <div className="neo-error-box">{error}</div>}
            </div>
          </div>

          {/* Results Card */}
          {metadata && (
            <div className="neo-card neo-animate-up">
              <div className="neo-card-header neo-bg-teal">
                <div className="neo-circle"></div> HASIL GENERATE
              </div>
              <div className="neo-card-body">
                
                <div className="neo-result-box">
                  <div className="neo-result-header">
                    <span>CATATAN KAKI (FOOTNOTE)</span>
                    <button className="neo-btn-secondary neo-btn-sm" onClick={() => handleCopy(footnoteResult, "footnote")}>
                      {copiedFootnote ? <CheckIcon /> : <CopyIcon />} {copiedFootnote ? "DISALIN" : "COPY"}
                    </button>
                  </div>
                  <div className="neo-result-content" dangerouslySetInnerHTML={{ __html: footnoteResult }} />
                </div>

                <div className="neo-result-box neo-mt-4">
                  <div className="neo-result-header">
                    <span>DAFTAR PUSTAKA</span>
                    <button className="neo-btn-secondary neo-btn-sm" onClick={() => handleCopy(dafpusResult, "dafpus")}>
                      {copiedDafpus ? <CheckIcon /> : <CopyIcon />} {copiedDafpus ? "DISALIN" : "COPY"}
                    </button>
                  </div>
                  <div className="neo-result-content" dangerouslySetInnerHTML={{ __html: dafpusResult }} />
                </div>

                <div className="neo-info-box neo-mt-4">
                  <strong>META:</strong> {metadata.authorFootnote.replace(/<[^>]+>/g, "")} | {metadata.year}
                </div>
              </div>
            </div>
          )}

          {/* Donation Card */}
          <div className="neo-donation-card">
            <h3 className="neo-donation-title">
              <span role="img" aria-label="coffee">☕</span> Dukung pengembangan tool ini!
            </h3>
            <p className="neo-donation-desc">
              Tool ini gratis & open-use. Donasi membantu pengembangan fitur baru dan perawatan server.
            </p>
            <a 
              href="https://saweria.co/rickpipor" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="neo-donation-btn"
            >
              <PlayCircleIcon /> Donasi di Saweria
            </a>
          </div>

          {/* Spacer for bottom nav */}
          <div style={{ height: '90px' }}></div>
        </div>
      </section>

      {/* Floating Bottom Navigation (Neo-brutalism Style) */}
      <nav className="neo-bottom-nav">
        <button className={`neo-nav-item ${inputMode === "doi" ? "active" : ""}`} onClick={() => setInputMode("doi")}>
          <SearchIcon /> <span>DOI</span>
        </button>
        <button className={`neo-nav-item ${inputMode === "url" ? "active" : ""}`} onClick={() => setInputMode("url")}>
          <LinkIcon /> <span>LINK</span>
        </button>
        <button className={`neo-nav-item ${inputMode === "manual" ? "active" : ""}`} onClick={() => setInputMode("manual")}>
          <EditIcon /> <span>MANUAL</span>
        </button>
      </nav>

      {/* STYLES (NEOBRUTALISM CSS) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');

        :root {
          --c-dark: #1E253A;
          --c-yellow: #FDE047;
          --c-teal: #40C4AA;
          --c-bg: #EEF2F6;
          --c-border: #111111;
          --c-white: #FFFFFF;
        }

        html, body, #root {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          text-align: left !important;
          background-color: var(--c-bg);
        }

        * {
          box-sizing: border-box;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .neo-app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* HEADER - STICKY ADDED */
        .neo-header {
          background: var(--c-white);
          padding: 1rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid var(--c-border);
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .neo-logo {
          font-size: 1.5rem;
          font-weight: 900;
          letter-spacing: 4px;
          color: var(--c-dark);
          display: flex;
          align-items: center;
        }

        .neo-logo-icon {
          color: var(--c-teal);
          display: flex;
          align-items: center;
          margin: 0 2px;
        }

        .neo-menu-btn {
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        /* HERO SECTION */
        .neo-hero {
          background-color: var(--c-dark);
          background-image: repeating-linear-gradient(
            -45deg,
            rgba(0, 0, 0, 0.1),
            rgba(0, 0, 0, 0.1) 15px,
            transparent 15px,
            transparent 30px
          );
          padding: 4rem 1.5rem 5rem;
          color: var(--c-white);
          display: flex;
          justify-content: center;
          border-bottom: 3px solid var(--c-border);
        }

        .neo-hero-content {
          max-width: 600px;
          text-align: center;
        }

        .neo-badge {
          display: inline-block;
          border: 2px solid var(--c-teal);
          color: var(--c-teal);
          padding: 6px 16px;
          border-radius: 100px;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 1px;
          margin-bottom: 1.5rem;
        }

        .neo-hero h1 {
          font-size: 2.25rem;
          font-weight: 800;
          line-height: 1.3;
          margin-bottom: 1rem;
        }

        .neo-highlight {
          color: var(--c-yellow);
        }

        .neo-hero p {
          color: #A3B1C6;
          font-size: 0.95rem;
          line-height: 1.6;
          margin-bottom: 2.5rem;
        }

        /* MAIN CONTENT AREA */
        .neo-content-area {
          background-color: var(--c-bg);
          padding: 2.5rem 1rem;
          flex: 1;
        }

        .neo-container {
          width: 90%;
          max-width: 600px;
          margin: 0 auto;
        }

        /* NEOBRUTALISM CARD */
        .neo-card {
          background: var(--c-white);
          border: 3px solid var(--c-border);
          border-radius: 12px;
          box-shadow: 6px 6px 0px var(--c-border);
          margin-bottom: 2rem;
          margin-right: 6px; 
          overflow: hidden;
        }

        .neo-card-header {
          background: var(--c-yellow);
          border-bottom: 3px solid var(--c-border);
          padding: 14px 16px;
          font-weight: 800;
          font-size: 0.85rem;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .neo-bg-teal {
          background: var(--c-teal);
          color: var(--c-dark);
        }

        .neo-circle {
          width: 12px; height: 12px;
          border: 2px solid var(--c-border);
          border-radius: 50%;
          background: var(--c-white);
        }

        .neo-card-body {
          padding: 1.5rem;
        }

        /* DONATION CARD */
        .neo-donation-card {
          background: var(--c-yellow);
          border: 3px solid var(--c-border);
          border-radius: 12px;
          box-shadow: 6px 6px 0px var(--c-border);
          padding: 1.5rem;
          margin-bottom: 2rem;
          margin-right: 6px; 
        }

        .neo-donation-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--c-border);
          margin: 0 0 0.5rem 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .neo-donation-desc {
          font-size: 0.95rem;
          color: #333;
          line-height: 1.5;
          margin-bottom: 1.5rem;
          font-weight: 600;
        }

        .neo-donation-btn {
          background: var(--c-dark);
          color: var(--c-white);
          border: 3px solid var(--c-border);
          border-radius: 8px;
          padding: 12px 20px;
          font-weight: 800;
          font-size: 0.95rem;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          box-shadow: 4px 4px 0px var(--c-border);
          transition: all 0.1s;
        }

        .neo-donation-btn:active {
          transform: translate(4px, 4px);
          box-shadow: 0px 0px 0px var(--c-border);
        }

        /* FORMS */
        .neo-form-group {
          margin-bottom: 1.25rem;
        }

        .neo-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 800;
          color: #555;
          margin-bottom: 8px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .neo-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 0.95rem;
          font-weight: 600;
          border: 2px solid var(--c-border);
          border-radius: 8px;
          background: var(--c-white);
          box-shadow: 3px 3px 0px var(--c-border);
          outline: none;
          transition: all 0.2s ease;
        }

        .neo-input:focus {
          transform: translate(-2px, -2px);
          box-shadow: 5px 5px 0px var(--c-border);
          background: #FAFAFA;
        }

        .neo-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .neo-span-2 {
          grid-column: span 2;
        }

        /* BUTTONS */
        .neo-btn-primary {
          background: var(--c-yellow);
          color: var(--c-border);
          border: 2px solid var(--c-border);
          border-radius: 8px;
          padding: 14px 24px;
          font-weight: 800;
          font-size: 0.9rem;
          letter-spacing: 1px;
          box-shadow: 4px 4px 0px var(--c-border);
          cursor: pointer;
          transition: all 0.1s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-transform: uppercase;
        }

        .neo-btn-primary:active:not(:disabled) {
          transform: translate(4px, 4px);
          box-shadow: 0px 0px 0px var(--c-border);
        }

        .neo-btn-primary:disabled {
          background: #E5E7EB;
          color: #9CA3AF;
          cursor: not-allowed;
        }

        .neo-btn-large {
          font-size: 1rem;
          padding: 16px 32px;
          border: 3px solid var(--c-border);
          box-shadow: 6px 6px 0px var(--c-border);
        }
        
        .neo-btn-large:active {
          transform: translate(6px, 6px);
        }

        .neo-btn-secondary {
          background: var(--c-white);
          color: var(--c-border);
          border: 2px solid var(--c-border);
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 800;
          font-size: 0.75rem;
          box-shadow: 2px 2px 0px var(--c-border);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.1s;
        }

        .neo-btn-secondary:active {
          transform: translate(2px, 2px);
          box-shadow: 0px 0px 0px var(--c-border);
        }

        .neo-btn-sm { padding: 6px 12px; }
        .neo-w-full { width: 100%; margin-top: 0.5rem; }
        .neo-mt-4 { margin-top: 1.5rem; }

        /* RESULTS AREA */
        .neo-result-box {
          border: 2px dashed var(--c-border);
          border-radius: 8px;
          overflow: hidden;
        }

        .neo-result-header {
          background: var(--c-bg);
          padding: 10px 14px;
          border-bottom: 2px dashed var(--c-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 800;
          font-size: 0.75rem;
          color: var(--c-dark);
        }

        .neo-result-content {
          padding: 14px;
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--c-dark);
        }

        .neo-info-box {
          background: var(--c-bg);
          padding: 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          color: #555;
          text-align: center;
          border: 2px solid var(--c-border);
        }

        .neo-error-box {
          margin-top: 1.5rem;
          padding: 12px;
          background: #FECACA;
          border: 2px solid var(--c-border);
          border-radius: 8px;
          color: #B91C1C;
          font-weight: 700;
          font-size: 0.85rem;
          text-align: center;
          box-shadow: 3px 3px 0px var(--c-border);
        }

        /* BOTTOM NAVIGATION - DIRAMPINGKAN */
        .neo-bottom-nav {
          position: fixed;
          bottom: 1.25rem;
          left: 50%;
          transform: translateX(-50%);
          background: var(--c-white);
          border: 3px solid var(--c-border);
          border-radius: 100px;
          display: flex;
          padding: 4px; /* Dikurangi dari 6px */
          gap: 4px; /* Dikurangi dari 6px */
          z-index: 100;
          width: 90%;
          max-width: 450px;
          box-shadow: 4px 4px 0px var(--c-border);
        }

        .neo-nav-item {
          flex: 1;
          padding: 8px 0; /* Dikurangi dari 12px */
          border-radius: 100px;
          border: 2px solid transparent;
          background: transparent;
          font-weight: 800;
          font-size: 0.75rem; /* Sedikit dikecilkan agar proporsional */
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px; /* Disesuaikan */
          cursor: pointer;
          color: #666;
          transition: all 0.2s;
        }

        .neo-nav-item.active {
          background: var(--c-dark);
          color: var(--c-white);
          border-color: var(--c-border);
        }

        /* UTILS & ANIMATIONS */
        .neo-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .neo-animate-up { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        /* RESPONSIVE */
        @media (max-width: 600px) {
          .neo-grid { grid-template-columns: 1fr; }
          .neo-span-2 { grid-column: span 1; }
          .neo-hero h1 { font-size: 1.75rem; }
          .neo-nav-item span { display: none; }
          .neo-nav-item.active span { display: inline-block; }
          
          .neo-card, .neo-donation-card {
             margin-right: 4px; 
          }
        }
      `}</style>
    </div>
  );
}
