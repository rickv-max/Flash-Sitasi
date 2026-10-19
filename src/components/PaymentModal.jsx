import { rupiah } from '../../shared/catalog';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { usePayment } from '../hooks/usePayment';
import Icon from './Icon';
import { Modal, Spinner } from './Primitives';

export default function PaymentModal({ user, demo, onLogin, onClose, notify, settings = DEFAULT_SETTINGS }) {
  const payment = usePayment({ user, notify, settings });
  const { minTopup: MIN_TOPUP, maxTopup: MAX_TOPUP } = settings;
  const packages = [50, 75, 100, 125].filter((value) => value >= MIN_TOPUP && value <= MAX_TOPUP);
  const { credits, setCredits, uncertain, pending, paying, checking, error, setError,
    checkError, count, valid, amount, status, checkoutURL, checkPayment, createPayment, reset } = payment;
  return <Modal title={<span className="flex items-center gap-2"><Icon name="credit" size={20} />Top Up Kredit</span>} onClose={onClose} className="classic-topup-modal">
    <div className="modal-body">
      {(demo || !user) ? <>
        <p className="text-muted text-sm leading-relaxed mb-6">Masuk untuk mengisi kredit dan menyimpan sitasi di akun. Pembayaran tidak tersedia dalam demo.</p>
        <button className="btn-primary w-full" onClick={onLogin}>Masuk dengan Google<Icon name="arrow" size={17} /></button>
      </> : pending ? <>
        <p className="text-muted text-sm leading-relaxed mb-5">{pending.credited ? 'Pembayaran berhasil. Kredit sudah ditambahkan ke akun Anda.' : status === 'pending' ? 'Tagihan siap. Lanjutkan ke bayar.gg, lalu kembali untuk memeriksa status pembayaran.' : 'Tagihan ini sudah tidak aktif. Anda dapat membuat tagihan baru.'}</p>
        <div className={`classic-payment-status ${pending.credited ? 'paid' : ''}`} role="status"><Icon name={pending.credited ? 'check' : 'history'} size={17} /><span>{pending.credited ? 'Pembayaran terverifikasi' : status === 'expired' ? 'Tagihan kedaluwarsa' : status === 'cancelled' ? 'Tagihan dibatalkan' : 'Menunggu pembayaran'}</span></div>
        <dl className="classic-invoice">
          <div><dt>Jumlah kredit</dt><dd>{pending.credits} kredit</dd></div>
          <div><dt>Harga paket</dt><dd>{rupiah(pending.amount)}</dd></div>
          {pending.amount !== pending.finalAmount && <div><dt>Biaya / kode unik penyedia</dt><dd>{rupiah(pending.finalAmount - pending.amount)}</dd></div>}
        </dl>
        <div className="price-tag mb-5"><span className="text-sm font-medium text-muted">Total Pembayaran</span><strong className="text-xl text-main">{rupiah(pending.finalAmount)}</strong></div>
        <p className="classic-invoice-id"><span>No. tagihan</span>{pending.invoice}</p>
        {checkError && <p className="classic-payment-error" role="alert">{checkError}</p>}
        {pending.credited ? <button className="btn-primary w-full" onClick={onClose}>Lanjutkan Menulis<Icon name="arrow" size={17} /></button> : status === 'pending' ? <>
          {checkoutURL && <a className="btn-primary w-full" href={checkoutURL}>Bayar via Bayar.gg<Icon name="diagonal" size={17} /></a>}
          <button className="btn-secondary w-full mt-3" onClick={checkPayment} disabled={checking}>{checking ? <Spinner /> : <Icon name="history" size={16} />}Saya Sudah Membayar, Cek Status</button>
          <p className="classic-payment-note">Status diperiksa setiap 10 detik selama dialog terbuka.</p>
        </> : <button className="btn-primary w-full" onClick={reset}>Buat Tagihan Baru<Icon name="plus" size={17} /></button>}
      </> : <>
        <p className="text-muted text-sm leading-relaxed mb-6">Harga per 1 sitasi sukses {rupiah(settings.pricePerCredit)}. Pilih paket atau tentukan sendiri jumlah kredit Anda.</p>
        {!settings.paymentEnabled && <p className="classic-payment-note">Top up sedang dinonaktifkan pengelola.</p>}
        {!!packages.length && <div className="grid-packages mb-5">{packages.map((number) => <button className={`btn-package ${count === number ? 'active' : ''}`} key={number} onClick={() => { setCredits(String(number)); setError(''); }} disabled={paying || uncertain}>{number} Kredit</button>)}</div>}
        <div className="form-group"><label className="input-label" htmlFor="topup-credit-count">Nominal Custom <span className="text-muted font-normal">({MIN_TOPUP}–{MAX_TOPUP} kredit)</span></label><input id="topup-credit-count" className="input-field-modern" type="number" min={MIN_TOPUP} max={MAX_TOPUP} step="1" inputMode="numeric" value={credits} onChange={(event) => { setCredits(event.target.value); setError(''); }} disabled={paying || uncertain} /></div>
        <div className="price-tag mt-6"><span className="text-muted font-medium text-sm">Total Pembayaran</span><strong className="text-xl text-main">{valid ? rupiah(amount) : '—'}</strong></div>
        {!valid && <p className="classic-payment-error" role="alert">Masukkan {MIN_TOPUP}–{MAX_TOPUP} kredit dalam bilangan bulat.</p>}
        {error && <p className="classic-payment-error" role="alert">{error}</p>}
        {uncertain && !error && <p className="classic-payment-note" role="status">Ada permintaan sebelumnya. Periksa tagihan itu sebelum membuat pembayaran baru.</p>}
        <button className="btn-primary w-full mt-6" onClick={createPayment} disabled={paying || !valid || !settings.paymentEnabled && !uncertain}>{paying ? <><Spinner />Menghubungkan…</> : <>{uncertain ? 'Periksa Tagihan Sebelumnya' : 'Bayar via Bayar.gg'}<Icon name="arrow" size={17} /></>}</button>
        <p className="classic-payment-note"><Icon name="lock" size={12} />Biaya atau kode unik penyedia, jika ada, akan tampil pada tagihan.</p>
      </>}
    </div>
  </Modal>;
}
