import { creditPackages, rupiah } from '../../shared/catalog';
import { methodSupports } from '../../shared/payment-methods';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import PackageBenefits from './PackageBenefits';
import './pricing.css';

export default function PricingSection({ settings, ready, error, onRefresh, onChoose }) {
  const options = usePaymentMethods(ready);
  return <section className="pricing-section credit-pricing-section" id="harga" aria-labelledby="pricing-title">
    <div className="container">
      <header className="credit-pricing-heading"><span className="public-eyebrow">PILIH SESUAI KEBUTUHAN</span><h2 id="pricing-title">Satuan atau paket kredit. Anda yang pilih.</h2><p>Sekali beli, gunakan sesuai kebutuhan. Tanpa biaya langganan atau perpanjangan otomatis.</p></header>
      {!ready && <p className="pricing-load-note" role="status">{error || 'Menghubungkan harga terbaru…'}{error && <button className="btn-secondary" onClick={onRefresh}>Coba lagi</button>}</p>}
      <div className="credit-pricing-grid">
        <article className="credit-plan credit-plan-unit pricing-card-anim"><span className="credit-plan-label">FLEKSIBEL</span><h3>Satuan</h3><p className="credit-plan-description">Tentukan sendiri jumlah kredit.</p><div className="credit-plan-price">{ready ? rupiah(settings.pricePerCredit) : '—'}<span>/ kredit</span></div><p className="credit-plan-quota">1 kredit untuk 1 sitasi sukses</p><ul><li>Pilih {settings.minTopup}–{settings.maxTopup} kredit</li><li>Tarif mengikuti harga satuan terbaru</li><li>Saldo kredit tetap dapat digunakan</li></ul><button type="button" className="btn-secondary" disabled={!ready} onClick={() => onChoose('')}>Beli Satuan</button></article>
        {creditPackages(settings).map((item) => {
          const savings = item.credits * settings.pricePerCredit - item.price;
          const unavailable = options.ready && !options.methods.some((method) => methodSupports(method, item.price));
          return <article key={item.id} className={`credit-plan credit-plan-${item.id} pricing-card-anim`}>
            <span className="credit-plan-label">PAKET KREDIT</span><h3>{item.name}</h3><p className="credit-plan-description">{item.id === 'pro' ? 'Untuk referensi tugas dan tulisan Anda.' : item.id === 'plus' ? 'Lebih banyak ruang untuk riset Anda.' : 'Untuk kebutuhan referensi yang lebih besar.'}</p>
            <div className="credit-plan-price">{ready ? rupiah(item.price) : '—'}<span>/ paket</span></div><p className="credit-plan-quota">{item.credits.toLocaleString('id-ID')} kredit</p>
            <PackageBenefits packageId={item.id}><li>{ready && savings > 0 ? `Hemat ${rupiah(savings)} dari satuan` : 'Gunakan saldo sesuai kebutuhan'}</li></PackageBenefits>
            <button type="button" className="btn-primary" disabled={!ready || unavailable} onClick={() => onChoose(item.id)}>{unavailable ? 'Metode Bayar Belum Tersedia' : `Pilih ${item.name}`}</button>
            {unavailable && <p className="credit-plan-unavailable">Pengelola perlu mengaktifkan metode bayar untuk nominal ini.</p>}
          </article>;
        })}
      </div>
      <p className="credit-pricing-note">Semua pilihan mendukung footnote, daftar pustaka, APA 7, pencarian kota terbit otomatis, input DOI/tautan/manual/batch, dan riwayat sitasi. Satu kredit dipakai untuk satu sitasi yang berhasil dibuat.</p>
      <p className="credit-pricing-note">Profil publik perlu diaktifkan melalui Keanggotaan Saya. Badge otomatis mengikuti paket tertinggi yang sudah lunas, kecuali ditetapkan manual oleh admin. Biaya penyedia, jika ada, ditampilkan pada tagihan.</p>
    </div>
  </section>;
}
