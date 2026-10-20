import { CREATOR } from '../../shared/site-content';

export default function SiteFooter() {
  return <footer className="footer site-footer relative z-20">
    <div className="container footer-content">
      <a className="site-footer-brand" href="/" aria-label="Flash Sitasi — beranda"><img src="/logo2.png" alt="" width="72" height="72" loading="lazy" /><span>Flash<span>Sitasi</span><small>Referensi lebih sederhana.</small></span></a>
      <p>Generator sitasi, footnote, dan daftar pustaka dari DOI, tautan artikel, atau input manual.</p>
      <p className="site-creator">Dibuat oleh <a href={CREATOR.url} rel="author noopener noreferrer" target="_blank">{CREATOR.name}</a></p>
      <nav aria-label="Informasi layanan" className="site-footer-links"><a href="/tentang">Tentang & Pembuat</a><a href="/kebijakan-privasi">Kebijakan Privasi</a><a href="/syarat-ketentuan">Syarat & Ketentuan</a></nav>
      <small>© {new Date().getFullYear()} Flash Sitasi · Ricky Maulana.</small>
    </div>
  </footer>;
}
