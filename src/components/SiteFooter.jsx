import { CREATOR } from '../../shared/site-content';

export default function SiteFooter() {
  return <footer className="footer site-footer relative z-20">
    <div className="container footer-content">
      <a className="site-footer-brand" href="/" aria-label="Flash Sitasi — beranda"><img src="/logo2.png" alt="Flash Sitasi (FlashCite)" width="140" height="140" loading="lazy" /></a>
      <p>Generator sitasi, footnote, dan daftar pustaka dari DOI, tautan artikel, atau input manual.</p>
      <p className="site-creator">Dibuat oleh <a href="/tentang" rel="author">{CREATOR.name}</a> <span>· Lumajang, Indonesia</span></p>
      <nav aria-label="Informasi layanan" className="site-footer-links"><a href="/tentang">Tentang & Pembuat</a><a href="/kebijakan-privasi">Kebijakan Privasi</a><a href="/syarat-ketentuan">Syarat & Ketentuan</a></nav>
      <small>© {new Date().getFullYear()} Flash Sitasi · Ricky Maulana.</small>
    </div>
  </footer>;
}
