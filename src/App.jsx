import React, { useState } from "react";
import logo from "./assets/logo.png";

export default function App() {
  const [doiInput, setDoiInput] = useState("");
  const [kotaInput, setKotaInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [footnoteResult, setFootnoteResult] = useState("");
  const [dafpusResult, setDafpusResult] = useState("");
  const [copiedFootnote, setCopiedFootnote] = useState(false);
  const [copiedDafpus, setCopiedDafpus] = useState(false);

  const cleanDOI = (input) =>
    input.trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "");

  const capitalize = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
  };

  const formatAuthorsFootnote = (authors) => {
    if (!authors || !authors.length) return "Penulis Tidak Diketahui";
    const firstAuthor =
      `${authors[0].given || ""} ${authors[0].family || ""}`.trim();
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
    if (m.volume) volIssue += `Volume ${m.volume}`;
    if (m.issue)
      volIssue += volIssue ? ` Nomor ${m.issue}` : `Nomor ${m.issue}`;
    if (volIssue) parts.push(volIssue);

    let datePart = "";
    if (m.month) datePart += `${m.month} `;
    datePart += m.year;
    parts.push(datePart);

    const journalMeta = parts.join(", ") + ".";
    const authorDot =
      m.authorDafpus.endsWith("</i>") || m.authorDafpus.endsWith(".")
        ? ""
        : ".";

    return `${m.authorDafpus}${authorDot} (${m.year}) "${capitalize(m.title)}". ${journalMeta}`;
  };

  const updateResults = (meta, kota) => {
    setFootnoteResult(buildFootnote(meta, kota));
    setDafpusResult(buildDafpus(meta, kota));
  };

  const fetchDOI = async () => {
    if (!doiInput) return;
    setLoading(true);
    setError("");
    setFootnoteResult("");
    setDafpusResult("");
    setMetadata(null);
    const doi = cleanDOI(doiInput);
    try {
      const res = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      );
      if (!res.ok)
        throw new Error(
          "Gagal mengambil data. Pastikan nomor DOI valid dan coba lagi.",
        );
      const data = await res.json();
      const item = data.message;

      const yearObj = item["published-print"] || item.issued;
      const year =
        yearObj && yearObj["date-parts"]
          ? yearObj["date-parts"][0][0]
          : "Tahun";
      const monthNum = yearObj?.["date-parts"]?.[0]?.[1] ?? null;
      const monthNames = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      const monthStr = monthNum ? monthNames[monthNum - 1] : "";

      const meta = {
        authorFootnote: formatAuthorsFootnote(item.author),
        authorDafpus: formatAuthorsDafpus(item.author),
        year,
        month: monthStr,
        title: item.title?.[0] ?? "Judul Artikel",
        journal: item["container-title"]?.[0] ?? "Nama Jurnal",
        page: item.page || "",
        volume: item.volume || "",
        issue: item.issue || "",
        publisher: item.publisher || "",
      };
      setMetadata(meta);
      updateResults(meta, kotaInput);
    } catch (e) {
      setError(e.message || "Terjadi kesalahan koneksi ke server Crossref.");
    } finally {
      setLoading(false);
    }
  };

  const handleKotaChange = (e) => {
    const val = e.target.value;
    setKotaInput(val);
    if (metadata) updateResults(metadata, val);
  };

  const handleCopy = async (htmlString, type) => {
    if (!htmlString) return;
    let success = false;
    const plainText = htmlString.replace(/<[^>]+>/g, "");

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

    try {
      success = document.execCommand("copy");
    } catch (err) {
      console.warn("execCommand failed, fallback triggered");
    }

    selection.removeAllRanges();
    document.body.removeChild(div);

    if (!success) {
      try {
        if (window.ClipboardItem) {
          const item = new ClipboardItem({
            "text/html": new Blob([htmlString], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          });
          await navigator.clipboard.write([item]);
          success = true;
        } else {
          await navigator.clipboard.writeText(plainText);
          success = true;
        }
      } catch (e) {
        await navigator.clipboard.writeText(plainText).catch(() => {});
        success = true;
      }
    }

    if (success) {
      if (type === "footnote") {
        setCopiedFootnote(true);
        setTimeout(() => setCopiedFootnote(false), 2000);
      } else {
        setCopiedDafpus(true);
        setTimeout(() => setCopiedDafpus(false), 2000);
      }
    }
  };

  return (
    <div className="app-container">
      {/* Sticky Navbar */}
      <nav className="navbar">
        <div className="navbar-content">
          <div className="brand">
            <img src={logo} alt="Flash Sitasi Logo" className="logo-img" />
          </div>
        </div>
      </nav>

      <main className="main-content">
        <header className="page-header">
          <h1 className="title">Generator Sitasi Jurnal</h1>
          <p className="subtitle">
            Ekstrak metadata dari DOI Crossref untuk menghasilkan Footnote dan
            Daftar Pustaka format Indonesia secara otomatis.
          </p>
        </header>

        {/* Section 1: Input */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">1. Masukkan Data Artikel</h2>
          </div>
          <div className="card-body">
            <div className="input-grid">
              <div className="form-group doi-group">
                <label>
                  Nomor DOI <span className="required">*</span>
                </label>
                <div className="input-action-wrapper">
                  <input
                    type="text"
                    className="input-control font-mono"
                    value={doiInput}
                    onChange={(e) => setDoiInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchDOI()}
                    placeholder="10.1038/s41586-020-2649-2"
                  />
                  <button
                    className="btn btn-primary"
                    onClick={fetchDOI}
                    disabled={loading || !doiInput}
                  >
                    {loading ? (
                      <span className="flex-center">
                        <svg
                          className="spinner"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 2a10 10 0 0 1 10 10"></path>
                        </svg>
                        Memproses...
                      </span>
                    ) : (
                      "Ekstrak Data"
                    )}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>
                  Kota Terbit <span className="optional">(Opsional)</span>
                </label>
                <input
                  type="text"
                  className="input-control"
                  value={kotaInput}
                  onChange={handleKotaChange}
                  placeholder="Contoh: Jakarta"
                />
              </div>
            </div>

            {error && (
              <div className="alert alert-error">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {error}
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Metadata */}
        {metadata && (
          <section className="card fade-in">
            <div className="card-header">
              <h2 className="card-title">2. Metadata Jurnal</h2>
            </div>
            <div className="card-body bg-slate-50">
              <dl className="metadata-list">
                <div className="meta-item full-width">
                  <dt>Judul Artikel</dt>
                  <dd>{metadata.title}</dd>
                </div>
                <div className="meta-item full-width">
                  <dt>Nama Jurnal</dt>
                  <dd>{metadata.journal}</dd>
                </div>
                <div className="meta-item full-width">
                  <dt>Penulis Utama</dt>
                  <dd>{metadata.authorFootnote.replace(/<[^>]+>/g, "")}</dd>
                </div>
                <div className="meta-item">
                  <dt>Waktu Terbit</dt>
                  <dd>{`${metadata.month} ${metadata.year}`.trim()}</dd>
                </div>
                <div className="meta-item">
                  <dt>Volume / Nomor</dt>
                  <dd>{`${metadata.volume ? `Vol. ${metadata.volume}` : "-"} / ${metadata.issue ? `No. ${metadata.issue}` : "-"}`}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}

        {/* Section 3: Hasil */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">3. Hasil Format Sitasi</h2>
          </div>
          <div className="card-body">
            {/* Footnote Result */}
            <div className="result-group">
              <div className="result-header">
                <h3>Catatan Kaki (Footnote)</h3>
                <button
                  className={`btn btn-sm ${copiedFootnote ? "btn-success" : "btn-outline"}`}
                  onClick={() => handleCopy(footnoteResult, "footnote")}
                  disabled={!footnoteResult}
                >
                  {copiedFootnote ? (
                    <span className="flex-center gap-1">
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>{" "}
                      Tersalin
                    </span>
                  ) : (
                    "Salin ke Word"
                  )}
                </button>
              </div>
              <div
                className={`result-box ${!footnoteResult ? "empty-state" : ""}`}
                dangerouslySetInnerHTML={{
                  __html: footnoteResult
                    ? footnoteResult
                    : "Hasil format catatan kaki akan muncul di sini...",
                }}
              />
            </div>

            <div className="divider"></div>

            {/* Dafpus Result */}
            <div className="result-group">
              <div className="result-header">
                <h3>Daftar Pustaka</h3>
                <button
                  className={`btn btn-sm ${copiedDafpus ? "btn-success" : "btn-outline"}`}
                  onClick={() => handleCopy(dafpusResult, "dafpus")}
                  disabled={!dafpusResult}
                >
                  {copiedDafpus ? (
                    <span className="flex-center gap-1">
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>{" "}
                      Tersalin
                    </span>
                  ) : (
                    "Salin ke Word"
                  )}
                </button>
              </div>
              <div
                className={`result-box ${!dafpusResult ? "empty-state" : ""}`}
                dangerouslySetInnerHTML={{
                  __html: dafpusResult
                    ? dafpusResult
                    : "Hasil format daftar pustaka akan muncul di sini...",
                }}
              />
            </div>
          </div>
        </section>

        <footer className="footer">
          <p>
            Flash Sitasi &copy; {new Date().getFullYear()} &middot; Ditenagai
            oleh Crossref API
          </p>
        </footer>
      </main>

      <style>{`
        /* Reset Default Vite/CRA Styles yang mengunci layout */
        #root {
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          text-align: left !important;
        }

        :root {
          /* Modern SaaS Palette (Tailwind-inspired Slate & Blue) */
          --slate-50: #f8fafc;
          --slate-100: #f1f5f9;
          --slate-200: #e2e8f0;
          --slate-300: #cbd5e1;
          --slate-400: #94a3b8;
          --slate-500: #64748b;
          --slate-600: #475569;
          --slate-700: #334155;
          --slate-800: #1e293b;
          --slate-900: #0f172a;
          
          --blue-500: #3b82f6;
          --blue-600: #2563eb;
          --blue-700: #1d4ed8;

          --red-50: #fef2f2;
          --red-500: #ef4444;
          --red-700: #b91c1c;

          --emerald-500: #10b981;
          --emerald-600: #059669;

          --font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          --font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
          
          --radius-md: 0.5rem;
          --radius-lg: 0.75rem;
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html, body {
          width: 100%;
          min-height: 100vh;
          background-color: var(--slate-50);
          color: var(--slate-900);
          font-family: var(--font-sans);
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
        }

        .app-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Navbar Sticky Glassmorphism */
        .navbar {
          position: sticky;
          top: 0;
          z-index: 50;
          background-color: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--slate-200);
        }

        .navbar-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 0.6rem 1.5rem; /* lebih kecil & balance */
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo-img {
          height: 28px;
          width: auto;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        

        .nav-links a {
          color: var(--slate-500);
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          transition: color 0.2s;
        }

        .nav-links a:hover {
          color: var(--slate-900);
        }

        /* Layout */
        .main-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 2.5rem 1.5rem;
          width: 100%;
        }

        .page-header {
          margin-bottom: 2.5rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .title {
          font-size: 1.875rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: var(--slate-900);
          margin-bottom: 0.5rem;
        }

        .subtitle {
          font-size: 1rem;
          color: var(--slate-500);
          max-width: 600px;
          text-align: center;
        }

        /* Cards */
        .card {
          background-color: #ffffff;
          border: 1px solid var(--slate-200);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          margin-bottom: 1.5rem;
          overflow: hidden;
          text-align: left; /* Memastikan isi card rata kiri */
        }

        .card-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--slate-200);
          background-color: #ffffff;
        }

        .card-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--slate-900);
        }

        .card-body {
          padding: 1.5rem;
        }

        .bg-slate-50 {
          background-color: var(--slate-50);
        }

        /* Forms */
        .input-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--slate-700);
          display: inline-flex;
          align-items: center;
        }

        .required { color: var(--red-500); margin-left: 0.25rem; }
        .optional { color: var(--slate-400); font-size: 0.75rem; font-weight: 400; margin-left: 0.35rem; }

        .input-action-wrapper {
          display: flex;
          gap: 0.75rem;
        }

        .input-control {
          width: 100%;
          height: 42px;
          padding: 0 1rem;
          font-family: var(--font-sans);
          font-size: 0.9375rem;
          color: var(--slate-900);
          background-color: #ffffff;
          border: 1px solid var(--slate-300);
          border-radius: var(--radius-md);
          transition: all 0.15s ease-in-out;
          outline: none;
        }

        .input-control::placeholder {
          color: var(--slate-400);
        }

        .input-control:focus {
          border-color: var(--blue-500);
          box-shadow: 0 0 0 1px var(--blue-500);
        }

        .font-mono {
          font-family: var(--font-mono);
          letter-spacing: -0.025em;
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 42px;
          padding: 0 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background-color: var(--blue-600);
          color: #ffffff;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: var(--blue-700);
        }

        .btn-outline {
          background-color: #ffffff;
          color: var(--slate-700);
          border-color: var(--slate-300);
          box-shadow: var(--shadow-sm);
        }

        .btn-outline:hover:not(:disabled) {
          background-color: var(--slate-50);
          color: var(--slate-900);
        }

        .btn-success {
          background-color: var(--emerald-500);
          color: #ffffff;
        }

        .btn-sm {
          height: 32px;
          padding: 0 0.875rem;
          font-size: 0.8125rem;
        }

        .flex-center {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gap-1 { gap: 0.25rem; }

        .spinner {
          animation: spin 1s linear infinite;
          width: 1rem;
          height: 1rem;
          margin-right: 0.5rem;
        }

        /* Metadata List (Definition List Grid) */
        .metadata-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.25rem;
        }

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .meta-item.full-width {
          grid-column: 1 / -1;
        }

        .meta-item dt {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          color: var(--slate-500);
        }

        .meta-item dd {
          font-size: 0.9375rem;
          color: var(--slate-900);
          line-height: 1.5;
        }

        /* Results Area */
        .result-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .result-header h3 {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--slate-800);
        }

        .result-box {
          padding: 1rem 1.25rem;
          background-color: var(--slate-50);
          border: 1px solid var(--slate-200);
          border-radius: var(--radius-md);
          min-height: 72px;
          font-size: 0.9375rem;
          line-height: 1.6;
          color: var(--slate-900);
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .empty-state {
          color: var(--slate-400);
          font-style: italic;
        }

        .divider {
          height: 1px;
          background-color: var(--slate-200);
          margin: 1.5rem 0;
        }

        /* Alerts */
        .alert {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
          margin-top: 1.25rem;
        }

        .alert svg {
          width: 18px; height: 18px; flex-shrink: 0;
        }

        .alert-error {
          background-color: var(--red-50);
          color: var(--red-700);
          border: 1px solid #fecaca;
        }

        /* Footer */
        .footer {
          text-align: center;
          padding: 2rem 0;
          color: var(--slate-500);
          font-size: 0.875rem;
        }

        /* Animations */
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Responsive */
        @media (max-width: 640px) {
          .input-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          .input-action-wrapper {
            flex-direction: column;
          }
          .btn-primary {
            width: 100%;
          }
          .metadata-list {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
