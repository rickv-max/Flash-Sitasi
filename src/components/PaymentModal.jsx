import { creditPackages, rupiah } from '../../shared/catalog';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { usePayment } from '../hooks/usePayment';
import Icon from './Icon';
import { Modal, Spinner } from './Primitives';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { methodSupports } from '../../shared/payment-methods';
import PackageBenefits from './PackageBenefits';
import { membershipTier } from '../../shared/membership';
import './pricing.css';

export default function PaymentModal({ user, membershipProfile, demo, onLogin, onClose, notify, settings = DEFAULT_SETTINGS, initialPackageId = '', pricingReady = true, onPricingChange }) {
  const payment = usePayment({ user, notify, settings, initialPackageId, onPricingChange });
  const { minTopup: MIN_TOPUP, maxTopup: MAX_TOPUP } = settings;
  const packages = [50, 75, 100, 125].filter((value) => value >= MIN_TOPUP && value <= MAX_TOPUP);
  const { credits, setCredits, packageId, setPackageId, uncertain, pending, paying, checking, error, setError,
    checkError, count, valid, amount, status, checkoutURL, checkPayment, createPayment, reset } = payment;
  const methods = usePaymentMethods(!!user && !demo && !pending);
  const supported = methods.ready && methods.methods.some((method) => methodSupports(method, amount));
  const providerName = pending ? pending.provider === 'doku' ? 'DOKU' : 'bayar.gg' : methods.provider === 'bayar_gg' ? 'bayar.gg' : 'DOKU';
  const sandbox = (pending?.environment || methods.environment) === 'sandbox';
  return <Modal title={<span className="flex items-center gap-2"><Icon name="credit" size={20} />Top Up Kredit</span>} onClose={onClose} className="classic-topup-modal">
    <div className="modal-body">
      {sandbox && <p className="classic-payment-note" role="status">Mode uji DOKU. Pembayaran ini tidak menggunakan uang sungguhan dan tidak menambah kredit atau badge.</p>}
      {(demo || !user) ? <>
        <p className="text-muted text-sm leading-relaxed mb-6">Masuk untuk mengisi kredit dan menyimpan sitasi di akun. Pembayaran tidak tersedia dalam demo.</p>
        <button className="btn-primary w-full" onClick={onLogin}>Masuk dengan Google<Icon name="arrow" size={17} /></button>
      </> : pending ? <>
        <p className="text-muted text-sm leading-relaxed mb-5">{pending.credited ? 'Pembayaran berhasil. Kredit sudah ditambahkan ke akun Anda.' : pending.testPayment ? 'Pembayaran uji berhasil. Saldo kredit dan badge Anda tetap.' : status === 'pending' ? `Tagihan siap. Lanjutkan ke ${providerName}, lalu kembali untuk memeriksa status pembayaran.` : 'Tagihan ini sudah tidak aktif. Anda dapat membuat tagihan baru.'}</p>
        <div className={`classic-payment-status ${pending.credited ? 'paid' : ''}`} role="status"><Icon name={pending.credited ? 'check' : 'history'} size={17} /><span>{pending.credited ? 'Pembayaran terverifikasi' : pending.testPayment ? 'Pembayaran uji selesai' : status === 'expired' ? 'Tagihan kedaluwarsa' : status === 'cancelled' ? 'Tagihan dibatalkan' : 'Menunggu pembayaran'}</span></div>
        <dl className="classic-invoice">
          <div><dt>Pilihan</dt><dd>{pending.packageName ? pending.packageName === 'Satuan' ? 'Kredit satuan' : `Paket ${pending.packageName}` : 'Kredit satuan'}</dd></div>
          <div><dt>Jumlah kredit</dt><dd>{pending.credits} kredit</dd></div>
          <div><dt>Harga paket</dt><dd>{rupiah(pending.amount)}</dd></div>
          {pending.amount !== pending.finalAmount && <div><dt>Biaya / kode unik penyedia</dt><dd>{rupiah(pending.finalAmount - pending.amount)}</dd></div>}
        </dl>
        <div className="price-tag mb-5"><span className="text-sm font-medium text-muted">Total Pembayaran</span><strong className="text-xl text-main">{rupiah(pending.finalAmount)}</strong></div>
        <p className="classic-invoice-id"><span>No. tagihan</span>{pending.invoice}</p>
        {checkError && <p className="classic-payment-error" role="alert">{checkError}</p>}
        {pending.credited ? <button className="btn-primary w-full" onClick={onClose}>Lanjutkan Menulis<Icon name="arrow" size={17} /></button> : status === 'pending' ? <>
          {checkoutURL && <a className="btn-primary w-full" href={checkoutURL}>Bayar {providerName === 'DOKU' ? 'QRIS via DOKU' : 'via bayar.gg'}<Icon name="diagonal" size={17} /></a>}
          {!checkoutURL && <p className="classic-payment-note">Tagihan dipulihkan tanpa tautan checkout. Hubungi pengelola dengan nomor tagihan di atas untuk melanjutkan pembayaran.</p>}
          <button className="btn-secondary w-full mt-3" onClick={checkPayment} disabled={checking}>{checking ? <Spinner /> : <Icon name="history" size={16} />}Saya Sudah Membayar, Cek Status</button>
          <p className="classic-payment-note">{providerName === 'DOKU' ? 'Pembayaran terverifikasi otomatis melalui notifikasi DOKU. Pemeriksaan cadangan dilakukan setiap 60 detik selama dialog terbuka.' : 'Status diperiksa setiap 10 detik selama dialog terbuka.'}</p>
        </> : <button className="btn-primary w-full" onClick={reset}>Buat Tagihan Baru<Icon name="plus" size={17} /></button>}
      </> : <>
        <p className="text-muted text-sm leading-relaxed mb-6">{pricingReady ? `Harga satuan ${rupiah(settings.pricePerCredit)} per kredit. ` : 'Menghubungkan harga terbaru… '}Pilih paket kredit atau beli satuan sesuai kebutuhan.</p>
        {!settings.paymentEnabled && <p className="classic-payment-note">Top up sedang dinonaktifkan pengelola.</p>}
        <div className="credit-bundle-options" role="group" aria-label="Pilihan paket kredit">
          <button type="button" aria-pressed={!packageId} className={`credit-bundle-option ${!packageId ? 'active' : ''}`} onClick={() => { setPackageId(''); setError(''); }} disabled={paying || uncertain}><span><strong>Satuan</strong><small>Jumlah kredit fleksibel</small></span><b>{pricingReady ? `${rupiah(settings.pricePerCredit)} / kredit` : '—'}</b></button>
          {creditPackages(settings).map((item) => <button type="button" key={item.id} aria-pressed={packageId === item.id} className={`credit-bundle-option ${packageId === item.id ? 'active' : ''}`} onClick={() => { setPackageId(item.id); setError(''); }} disabled={paying || uncertain}><span><strong>{item.name}</strong><small>{item.credits.toLocaleString('id-ID')} kredit</small></span><b>{pricingReady ? rupiah(item.price) : '—'}</b></button>)}
        </div>
        {!packageId && <>
          {!!packages.length && <div className="grid-packages mb-5">{packages.map((number) => <button className={`btn-package ${count === number ? 'active' : ''}`} key={number} onClick={() => { setCredits(String(number)); setError(''); }} disabled={paying || uncertain}>{number} Kredit</button>)}</div>}
          <div className="form-group"><label className="input-label" htmlFor="topup-credit-count">Jumlah Kredit Satuan <span className="text-muted font-normal">({MIN_TOPUP}–{MAX_TOPUP} kredit)</span></label><input id="topup-credit-count" className="input-field-modern" type="number" min={MIN_TOPUP} max={MAX_TOPUP} step="1" inputMode="numeric" value={credits} onChange={(event) => { setCredits(event.target.value); setError(''); }} disabled={paying || uncertain} /></div>
        </>}
        {packageId && <section className="checkout-benefits" aria-label="Benefit paket yang dipilih">
          <h3>Benefit Paket {membershipTier(packageId).name}</h3>
          <PackageBenefits packageId={packageId} />
          <p className="classic-payment-note">Sekali beli: {count.toLocaleString('id-ID')} kredit. Aktif setelah pembayaran terverifikasi. Profil publik perlu diaktifkan melalui Keanggotaan Saya.</p>
          <p className="classic-payment-note">{membershipProfile?.membershipManualOverride ? 'Badge Anda ditetapkan manual oleh admin. Pembelian ini menambah kredit; hubungi admin untuk mengubah badge.' : 'Badge mengikuti paket tertinggi yang sudah lunas dan tetap melekat setelah kredit digunakan.'}</p>
        </section>}
        <div className="price-tag mt-6"><span className="text-muted font-medium text-sm">Total Pembayaran</span><strong className="text-xl text-main">{valid && (pricingReady || uncertain) ? rupiah(amount) : '—'}</strong></div>
        {!valid && <p className="classic-payment-error" role="alert">Masukkan {MIN_TOPUP}–{MAX_TOPUP} kredit dalam bilangan bulat.</p>}
        {error && <p className="classic-payment-error" role="alert">{error}</p>}
        {uncertain && !error && <p className="classic-payment-note" role="status">Ada permintaan sebelumnya. Periksa tagihan itu sebelum membuat pembayaran baru.</p>}
        {!uncertain && pricingReady && <>
          {!methods.ready && !methods.error && <p className="classic-payment-note" role="status">Memeriksa metode pembayaran…</p>}
          {methods.error && <p className="classic-payment-error" role="alert">{methods.error} <button type="button" className="payment-method-retry" onClick={methods.refresh}>Coba lagi</button></p>}
          {methods.ready && valid && !supported && <p className="classic-payment-error" role="alert">{methods.methods.length ? 'Nominal ini belum didukung oleh metode pembayaran yang aktif.' : methods.availability?.message || 'Pembayaran sementara belum tersedia dari penyedia. Silakan cek kembali beberapa saat lagi.'} <button type="button" className="payment-method-retry" onClick={methods.refresh} disabled={methods.loading}>{methods.loading ? 'Memeriksa…' : 'Cek ulang'}</button></p>}
        </>}
        <button className="btn-primary w-full mt-6" onClick={createPayment} disabled={paying || !valid || !uncertain && (!settings.paymentEnabled || !pricingReady || !supported)}>{paying ? <><Spinner />Menghubungkan…</> : <>{uncertain ? 'Periksa Tagihan Sebelumnya' : providerName === 'DOKU' ? 'Bayar QRIS via DOKU' : 'Bayar via bayar.gg'}<Icon name="arrow" size={17} /></>}</button>
        <p className="classic-payment-note"><Icon name="lock" size={12} />Biaya atau kode unik penyedia, jika ada, akan tampil pada tagihan.</p>
      </>}
    </div>
  </Modal>;
}
