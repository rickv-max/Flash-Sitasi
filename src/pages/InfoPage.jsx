import SiteFooter from '../components/SiteFooter';
import { CONTENT_UPDATED, CREATOR } from '../../shared/site-content';
import './public-pages.css';

export default function InfoPage({ page }) {
  return <div className="public-page app-wrapper pattern-bg">
    <a className="skip-link" href="#page-content">Lewati ke konten</a>
    <header className="public-header"><a href="/" className="public-brand">Flash<span>Sitasi</span></a><a href="/" className="btn-secondary">Kembali ke beranda <span aria-hidden="true">↗</span></a></header>
    <main id="page-content" className="public-main">
      <nav className="public-breadcrumb" aria-label="Breadcrumb"><a href="/">Beranda</a><span aria-hidden="true">/</span><span>{page.label}</span></nav>
      <article>
        <header className="public-intro"><p className="public-eyebrow">{page.label}</p><h1>{page.heading}</h1><p className="public-lead">{page.intro}</p><p className="public-updated">Diperbarui <time dateTime={CONTENT_UPDATED}>19 Oktober 2026</time></p></header>
        <div className="public-content-layout">
          <nav className="public-toc" aria-label="Daftar isi"><strong>Di halaman ini</strong>{page.sections.map((section, index) => <a key={section.title} href={`#bagian-${index + 1}`}>{section.title}</a>)}</nav>
          <div className="public-sections">{page.sections.map((section, index) => <section key={section.title} id={`bagian-${index + 1}`}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
            <aside className="public-contact"><h2>Profil resmi pembuat</h2><p><strong>{CREATOR.name}</strong><br />{CREATOR.alternateName}</p><a href={CREATOR.url} rel="noopener noreferrer" target="_blank">Profil GitHub Ricky Maulana <span aria-hidden="true">↗</span></a><p className="public-contact-note">Gunakan informasi kontak pada profil resmi untuk permintaan pribadi. Jangan membagikan data akun atau pembayaran di issue publik.</p></aside>
            <nav className="public-related" aria-label="Baca juga"><a href="/tentang">Tentang Flash Sitasi</a><a href="/kebijakan-privasi">Kebijakan Privasi</a><a href="/syarat-ketentuan">Syarat & Ketentuan</a></nav>
          </div>
        </div>
      </article>
    </main>
    <SiteFooter />
  </div>;
}
