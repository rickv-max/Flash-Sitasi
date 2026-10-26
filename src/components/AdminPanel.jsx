import { useEffect, useId, useRef, useState } from 'react';
import { api, readStorage, writeStorage } from '../lib/api';
import { rupiah, CREDIT_PACKAGES } from '../../shared/catalog';
import { publishSettingsChange } from '../hooks/useSettings';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { MEMBERSHIP_TIERS, membershipTier } from '../../shared/membership';
import MembershipBadge from './MembershipBadge';
import CreditBalance from './CreditBalance';
import { hasUnlimitedCredits } from '../../shared/credits';
import { Modal, Spinner } from './Primitives';
import './admin.css';

const tabs = [['overview', 'Ringkasan'], ['users', 'Pengguna'], ['payments', 'Transaksi'], ['requests', 'Rekonsiliasi'], ['locations', 'Direktori Kota'], ['audit', 'Log Audit'], ['settings', 'Pengaturan']];
const paymentName = (row) => row.provider === 'doku' ? row.environment === 'sandbox' ? 'DOKU Sandbox' : 'DOKU' : 'bayar.gg';
const actionNames = { setMembership: 'Ubah badge keanggotaan', adjustCredits: 'Penyesuaian kredit', setRole: 'Ubah peran', setStatus: 'Ubah status akun', revokeSessions: 'Cabut sesi', saveNotes: 'Catatan internal', updateSettings: 'Pengaturan aplikasi', upsertLocation: 'Pemetaan kota', syncPayment: 'Periksa pembayaran', recoverPayment: 'Rekonsiliasi invoice' };
const number = (value) => typeof value === 'number' ? value.toLocaleString('id-ID') : '—';
const date = (value) => value ? new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '—';
const statusLabels = { active: 'Aktif', blocked: 'Diblokir', user: 'Pengguna', admin: 'Admin', pending: 'Menunggu', paid: 'Lunas', expired: 'Kedaluwarsa', cancelled: 'Dibatalkan', unknown: 'Perlu ditelusuri', creating: 'Sedang dibuat', ready: 'Terhubung' };
function Badge({ value }) { return <span className={`admin-badge status-${value}`}>{statusLabels[value] || value || '—'}</span>; }
function Field({ label, children, hint }) { const id = useId(); return <label className="admin-field" htmlFor={id}><span>{label}</span>{typeof children === 'function' ? children(id) : children}{hint && <small>{hint}</small>}</label>; }
function ErrorBox({ message, retry }) { return message ? <div className="admin-alert error" role="alert"><span>{message}</span>{retry && <button className="btn-secondary" onClick={retry}>Coba lagi</button>}</div> : null; }
function Empty({ text = 'Belum ada data yang cocok dengan filter ini.' }) { return <p className="admin-empty">{text}</p>; }
function Table({ headings, children, empty }) { return <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Tabel data, geser mendatar bila diperlukan"><table className="admin-table"><thead><tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead><tbody>{children}</tbody></table>{empty && <Empty />}</div>; }
function useResource(user, resource, params, revision) {
  const paramsJSON = JSON.stringify(params);
  const key = `${resource}:${paramsJSON}:${revision}`;
  const [state, setState] = useState({ key: '', data: null, error: '', loading: true });
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ resource, ...JSON.parse(paramsJSON) });
    const timer = setTimeout(async () => {
      setState((previous) => ({ ...previous, key, loading: true, error: '' }));
      try { const data = await api(`admin?${query}`, { user, method: 'GET' }); if (active) setState({ key, data, loading: false, error: '' }); }
      catch (error) { if (active) setState({ key, data: null, loading: false, error: error.message }); }
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [user, resource, key, paramsJSON]);
  return state.key === key ? state : { data: null, error: '', loading: true };
}

export default function AdminPanel({ user, notify, onSettingsChange, initialTab = 'overview' }) {
  const [tab, setTab] = useState(initialTab);
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState(initialTab === 'requests' ? { status: 'unknown' } : {});
  const [cursor, setCursor] = useState('');
  const [previous, setPrevious] = useState([]);
  const [detailUID, setDetailUID] = useState('');
  const [task, setTask] = useState(null);
  const state = useResource(user, tab, { ...filters, cursor, limit: '25' }, revision);
  const refresh = () => setRevision((value) => value + 1);
  const resetPage = () => { setCursor(''); setPrevious([]); };
  function switchTab(value) { setTab(value); setFilters(value === 'requests' ? { status: 'unknown' } : {}); resetPage(); }
  function changed(result) { refresh(); notify(result.authSyncWarning || 'Perubahan berhasil disimpan dan dicatat di log audit.', result.authSyncWarning ? 'info' : 'success'); if (task?.action === 'updateSettings') { onSettingsChange?.(); publishSettingsChange(); } setTask(null); }
  function exportPage() {
    const data = state.data?.items || [];
    if (!data.length) return;
    const fields = tab === 'users' ? ['uid', 'name', 'email', 'role', 'membershipTier', 'status', 'credits', 'creditAccess', 'createdAt', 'lastSeenAt'] : tab === 'payments' ? ['invoice', 'uid', 'credits', 'amount', 'finalAmount', 'status', 'credited', 'createdAt', 'paidAt'] : tab === 'audit' ? ['actorUID', 'actorEmail', 'action', 'target', 'reason', 'timestamp'] : tab === 'locations' ? ['kind', 'matchValue', 'city', 'sourceURL', 'enabled', 'updatedAt'] : ['id', 'uid', 'credits', 'amount', 'state', 'createdAt'];
    const quote = (value) => `"${String(value ?? '').replace(/^[\s]*([=+\-@])/, "'$1").replaceAll('"', '""')}"`;
    const csv = '\uFEFF' + [fields.join(','), ...data.map((row) => fields.map((field) => quote(field === 'creditAccess' ? hasUnlimitedCredits(row) ? 'Tanpa batas (admin)' : 'Saldo kredit' : row[field])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `flashcite-${tab}-halaman-${previous.length + 1}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const data = state.data;
  const list = data?.items || [];
  return <section className="admin-panel" aria-label="Panel administrasi">
    <div className="admin-intro"><div><p className="admin-eyebrow">ADMINISTRASI</p><h3>Kelola FlashCite</h3><p>Pengguna, layanan, dan transaksi dalam satu tempat.</p></div><button className="btn-secondary" onClick={refresh} disabled={state.loading}>Muat ulang</button></div>
    <nav className="admin-tabs" aria-label="Menu admin">{tabs.map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined} onClick={() => switchTab(value)}>{label}</button>)}</nav>
    {!['overview', 'settings', 'locations'].includes(tab) && <Filters key={tab} tab={tab} onApply={(next) => { setFilters(next); resetPage(); }} />}
    <div className="admin-section-heading"><h4>{tabs.find(([value]) => value === tab)?.[1]}</h4>{['users', 'payments', 'requests', 'locations', 'audit'].includes(tab) && <button className="btn-secondary" disabled={state.loading || !list.length} onClick={exportPage}>Ekspor halaman CSV</button>}{tab === 'locations' && <button className="btn-primary" onClick={() => setTask({ action: 'upsertLocation' })}>Tambah pemetaan</button>}</div>
    <ErrorBox message={state.error} retry={refresh} />
    {state.loading ? <p className="admin-loading" role="status"><Spinner />Memuat data admin…</p> : !state.error && <>
      {tab === 'overview' && <AdminOverview data={data} />}
      {tab === 'users' && <Table headings={['Pengguna', 'Peran', 'Badge', 'Status', 'Kredit', 'Terakhir aktif', 'Tindakan']} empty={!list.length}>{list.map((row) => <tr key={row.uid}><td><strong>{row.name || 'Tanpa nama'}</strong><small>{row.email}</small><code>{row.uid}</code></td><td><Badge value={row.role || 'user'} /></td><td><MembershipBadge tier={row.membershipTier} /></td><td><Badge value={row.status || 'active'} /></td><td><CreditBalance profile={row} compact /></td><td>{date(row.lastSeenAt)}</td><td><button className="admin-text-button" onClick={() => setDetailUID(row.uid)}>Lihat detail</button></td></tr>)}</Table>}
      {tab === 'payments' && <Table headings={['Invoice / Pengguna', 'Kredit', 'Nominal', 'Status', 'Dibuat', 'Tindakan']} empty={!list.length}>{list.map((row) => <tr key={row.id}><td><strong>{row.invoice}</strong><button className="admin-text-button admin-uid" onClick={() => setDetailUID(row.uid)}>{row.uid}</button></td><td>{row.credits}</td><td>{rupiah(row.finalAmount)}<small>Paket {rupiah(row.amount)}</small></td><td><Badge value={row.status} /><small>{row.testPayment ? 'Pembayaran uji · tanpa kredit' : row.credited ? 'Kredit sudah masuk' : 'Belum dikreditkan'}</small></td><td>{date(row.createdAt)}</td><td><button className="admin-text-button" onClick={() => setTask({ action: 'syncPayment', invoice: row.invoice, providerName: paymentName(row) })}>Periksa ke {paymentName(row)}</button></td></tr>)}</Table>}
      {tab === 'requests' && <><p className="admin-help">Telusuri request yang belum terhubung. Cocokkan invoice pada dashboard penyedia pembayaran, lalu hubungkan ke request yang benar. Status dan nominal akan diperiksa ke penyedia.</p><Table headings={['ID Request / Pengguna', 'Paket', 'Status', 'Dibuat', 'Tindakan']} empty={!list.length}>{list.map((row) => <tr key={row.id}><td><code>{row.id}</code>{row.providerInvoice && <small>Invoice {paymentName(row)}: {row.providerInvoice}</small>}<button className="admin-text-button admin-uid" onClick={() => setDetailUID(row.uid)}>{row.uid}</button></td><td>{row.credits} kredit<small>{rupiah(row.amount)}</small></td><td><Badge value={row.state} /></td><td>{date(row.createdAt)}</td><td>{row.state !== 'ready' ? <button className="admin-text-button" onClick={() => setTask({ action: 'recoverPayment', requestID: row.id, uid: row.uid, amount: row.amount, invoice: row.providerInvoice || '', providerName: paymentName(row) })}>Hubungkan invoice</button> : row.payment?.invoice}</td></tr>)}</Table></>}
      {tab === 'audit' && <Table headings={['Waktu / Admin', 'Tindakan', 'Target', 'Alasan', 'Perubahan']} empty={!list.length}>{list.map((row) => <tr key={row.id}><td>{date(row.timestamp)}<small>{row.actorEmail || row.actorUID}</small></td><td>{actionNames[row.action] || row.action}{row.authSync === 'pending' && <small className="text-error">Sinkronisasi sesi tertunda</small>}</td><td><code>{row.target}</code></td><td>{row.reason}</td><td><details><summary>Lihat detail</summary><pre>{JSON.stringify({ sebelum: row.before, sesudah: row.after }, null, 2)}</pre></details></td></tr>)}</Table>}
      {tab === 'locations' && <><p className="admin-help">Pemetaan spesifik ISSN atau jurnal diprioritaskan. Gunakan kota yang tercantum di situs resmi penerbit dan sertakan tautan sumber. Pemetaan nonaktif tidak dipakai saat pencarian.</p><Table headings={['Pencocokan', 'Kota / Sumber', 'Status', 'Diperbarui', 'Tindakan']} empty={!list.length}>{list.map((row) => <tr key={row.id}><td><small>{row.kind}</small><strong>{row.matchValue}</strong></td><td>{row.city}<a href={row.sourceURL} target="_blank" rel="noopener noreferrer" className="admin-source-link">Buka sumber</a></td><td><Badge value={row.enabled ? 'active' : 'blocked'} /></td><td>{date(row.updatedAt)}</td><td><button className="admin-text-button" onClick={() => setTask({ action: 'upsertLocation', location: row })}>Ubah</button></td></tr>)}</Table></>}
      {tab === 'settings' && <Settings key={data?.updatedAt || 'initial'} data={data} onSave={(settings) => setTask({ action: 'updateSettings', settings, expectedUpdatedAt: data.updatedAt })} />}
      {Array.isArray(data?.items) && <div className="admin-pagination"><span>Halaman {previous.length + 1} · {list.length} data</span><div><button className="btn-secondary" disabled={!previous.length} onClick={() => { setCursor(previous.at(-1)); setPrevious((stack) => stack.slice(0, -1)); }}>Sebelumnya</button><button className="btn-secondary" disabled={!data.nextCursor} onClick={() => { setPrevious((stack) => [...stack, cursor]); setCursor(data.nextCursor); }}>Berikutnya</button></div></div>}
    </>}
    {detailUID && <UserDetail key={detailUID} user={user} uid={detailUID} revision={revision} onClose={() => setDetailUID('')} onAction={(next) => { setDetailUID(''); setTask(next); }} />}
    {task && <AdminActionDialog user={user} task={task} onClose={() => setTask(null)} onSuccess={changed} />}
  </section>;
}

function Filters({ tab, onApply }) {
  const [draft, setDraft] = useState({ status: tab === 'requests' ? 'unknown' : 'all', role: 'all', searchBy: 'email', q: '', uid: '', start: '', end: '', auditAction: '' });
  const update = (key) => (event) => setDraft((value) => ({ ...value, [key]: event.target.value }));
  return <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); onApply(Object.fromEntries(Object.entries(draft).filter(([, value]) => value && value !== 'all'))); }}>
    {tab === 'users' ? <><Field label="Cari berdasarkan">{(id) => <select id={id} value={draft.searchBy} onChange={update('searchBy')}><option value="email">Awalan email</option><option value="name">Awalan nama</option><option value="uid">UID persis</option></select>}</Field><Field label="Pencarian">{(id) => <input id={id} value={draft.q} onChange={update('q')} placeholder="Nama, email, atau UID" />}</Field><Field label="Peran">{(id) => <select id={id} value={draft.role} onChange={update('role')}><option value="all">Semua peran</option><option value="user">Pengguna</option><option value="admin">Admin</option></select>}</Field></> : <>
      {tab === 'payments' && <Field label="Invoice persis">{(id) => <input id={id} value={draft.q} onChange={update('q')} placeholder="Nomor invoice" />}</Field>}
      <Field label={tab === 'audit' ? 'UID target' : 'UID pengguna'}>{(id) => <input id={id} value={draft.uid} onChange={update('uid')} placeholder="Semua pengguna" />}</Field>
      {tab === 'audit' && <Field label="Tindakan">{(id) => <select id={id} value={draft.auditAction} onChange={update('auditAction')}><option value="">Semua tindakan</option>{Object.entries(actionNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}</Field>}
      <Field label="Dari tanggal (WIB)">{(id) => <input id={id} type="date" value={draft.start} onChange={update('start')} />}</Field><Field label="Sampai tanggal (WIB)">{(id) => <input id={id} type="date" value={draft.end} onChange={update('end')} />}</Field>
    </>}
    {tab !== 'audit' && <Field label="Status">{(id) => <select id={id} value={draft.status} onChange={update('status')}><option value="all">Semua status</option>{(tab === 'users' ? ['active', 'blocked'] : tab === 'requests' ? ['unknown', 'creating', 'ready'] : ['pending', 'paid', 'expired', 'cancelled']).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select>}</Field>}
    <button className="btn-primary" type="submit">Terapkan filter</button>
  </form>;
}
export function AdminOverview({ data }) {
  const metrics = [['Total pengguna', data.users], ['Admin terdaftar', data.admins], ['Akun diblokir', data.blocked], ['Sitasi tersimpan', data.citations], ['Pembayaran lunas', data.paidPayments], ['Menunggu pembayaran', data.pendingPayments], ['Nilai paket terbayar', rupiah(data.grossRevenue)], ['Kredit beredar', data.outstandingCredits]];
  const maximum = Math.max(1, ...(data.daily || []).map((day) => day.citations));
  return <><div className="admin-metrics">{metrics.map(([label, value]) => <article className="admin-metric" key={label}><p>{label}</p><strong>{typeof value === 'string' ? value : number(value)}</strong></article>)}</div><div className="admin-card"><h4>Aktivitas tujuh hari terakhir</h4><p className="admin-help">Jumlah sitasi yang masih tersimpan dan pembayaran lunas per hari, waktu Jakarta.</p><div className="admin-activity">{data.daily.map((day) => <div className="admin-activity-row" key={day.date}><time>{day.date}</time><div className="admin-activity-track"><span style={{ width: `${day.citations / maximum * 100}%` }} /></div><span>{number(day.citations)} sitasi · {number(day.payments)} pembayaran</span></div>)}</div><p className="admin-help">Data dihitung pada {date(data.generatedAt)}. Nilai paket terbayar belum dikurangi biaya penyedia.</p></div></>;
}
function UserDetail({ user, uid, revision, onClose, onAction }) {
  const state = useResource(user, 'user', { uid }, revision);
  const data = state.data; const profile = data?.profile;
  const task = (action, extra = {}) => onAction({ action, uid, profile, ...extra });
  return <Modal title="Detail pengguna" className="admin-user-modal" onClose={onClose}>
    <ErrorBox message={state.error} />{state.loading ? <p className="admin-loading"><Spinner />Memuat pengguna…</p> : data && <div className="admin-user-detail">
      <div className="admin-user-heading"><h3>{profile.name || 'Tanpa nama'}</h3><p>{profile.email}</p><code>{uid}</code><div><Badge value={profile.role} /> <Badge value={profile.status} /> <MembershipBadge tier={profile.membershipTier} /></div></div>
      <dl className="admin-details"><div><dt>Akses kredit</dt><dd><CreditBalance profile={profile} /></dd></div><div><dt>Akun dibuat</dt><dd>{date(profile.createdAt)}</dd></div><div><dt>Terakhir aktif</dt><dd>{date(profile.lastSeenAt)}</dd></div><div><dt>Provider login</dt><dd>{data.auth?.providers.join(', ') || 'Belum dapat dimuat'}</dd></div></dl>
      {profile.authSyncError && <p className="admin-alert error">{profile.authSyncError}</p>}
      <div className="admin-user-actions"><button className="btn-primary" onClick={() => task('adjustCredits')}>Atur kredit</button><button className="btn-secondary" onClick={() => task('setMembership')}>Ubah badge</button><button className="btn-secondary" disabled={data.protected} onClick={() => task('setStatus', { status: profile.status === 'blocked' ? 'active' : 'blocked' })}>{profile.status === 'blocked' ? 'Aktifkan akun' : 'Blokir akun'}</button><button className="btn-secondary" disabled={data.protected} onClick={() => task('setRole', { role: profile.role === 'admin' ? 'user' : 'admin' })}>{profile.role === 'admin' ? 'Jadikan pengguna' : 'Jadikan admin'}</button><button className="btn-secondary" disabled={data.protected} onClick={() => task('revokeSessions')}>Cabut semua sesi</button><button className="btn-secondary" onClick={() => task('saveNotes', { text: data.notes })}>Ubah catatan internal</button></div>
      {data.protected && <p className="admin-help">Peran dan sesi akun sendiri atau pemilik utama dilindungi.</p>}
      <div className="admin-card"><h4>Catatan internal</h4><p className="admin-notes">{data.notes || 'Belum ada catatan.'}</p></div>
      <h4>Riwayat sitasi terbaru · maksimal 25</h4><Table headings={['Judul', 'Sumber', 'Waktu']} empty={!data.history.length}>{data.history.map((row) => <tr key={row.id}><td>{row.title}</td><td>{row.type}</td><td>{date(row.timestamp)}</td></tr>)}</Table>
      <h4>Mutasi kredit terbaru · maksimal 25</h4><Table headings={['Jenis', 'Perubahan', 'Waktu']} empty={!data.ledger.length}>{data.ledger.map((row) => <tr key={row.id}><td>{row.type === 'topup' ? 'Top up' : row.type === 'citation' ? row.unlimitedCredits ? 'Sitasi admin tanpa batas' : 'Sitasi' : 'Penyesuaian admin'}</td><td>{row.credits > 0 ? '+' : ''}{row.credits}</td><td>{date(row.timestamp)}</td></tr>)}</Table>
      <h4>Transaksi terbaru · maksimal 25</h4><Table headings={['Invoice', 'Nominal', 'Status']} empty={!data.payments.length}>{data.payments.map((row) => <tr key={row.id}><td>{row.invoice}</td><td>{rupiah(row.finalAmount)}</td><td><Badge value={row.status} /></td></tr>)}</Table>
    </div>}
  </Modal>;
}
export function Settings({ data, onSave }) {
  const [draft, setDraft] = useState({ ...DEFAULT_SETTINGS, ...data });
  const numeric = [['pricePerCredit', 'Harga per kredit satuan (Rp)'], ['welcomeCredits', 'Kredit awal akun baru'], ['minTopup', 'Minimal kredit top up satuan'], ['maxTopup', 'Maksimal kredit top up satuan'], ['maxBatch', 'Maksimal sumber per batch']];
  const change = (key) => (event) => setDraft((value) => ({ ...value, [key]: event.target.value === '' ? '' : Number(event.target.value) }));
  return <form className="admin-settings admin-card" onSubmit={(event) => { event.preventDefault(); onSave(Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((key) => [key, draft[key]]))); }}>
    <h3>Tarif satuan & batas penggunaan</h3>
    <div className="admin-form-grid">{numeric.map(([key, label]) => <Field label={label} key={key}>{(id) => <input id={id} type="number" min={key === 'welcomeCredits' ? 0 : 1} step="1" required value={draft[key]} onChange={change(key)} />}</Field>)}</div>
    <p className="admin-help">Harga satuan otomatis dipakai pada informasi harga dan perhitungan top up satuan. Nominal top up aplikasi Rp5.000–Rp5.000.000; ketersediaan metode bayar mengikuti batas penyedia. Invoice yang sudah dibuat mengikuti nominal lamanya.</p>
    <fieldset className="admin-package-prices"><legend>Harga paket kredit</legend><p className="admin-help">Sekali beli, tanpa langganan. Harga berikut berdiri sendiri dan tidak berubah saat tarif satuan diperbarui.</p><div className="admin-form-grid">{CREDIT_PACKAGES.map((item) => <Field key={item.id} label={`Paket ${item.name} · ${number(item.credits)} kredit (Rp)`}>{(id) => <input id={id} type="number" min={5000} max={5000000} step="1" required value={draft[item.priceKey]} onChange={change(item.priceKey)} />}</Field>)}</div></fieldset>
    <div className="admin-toggles">{[['signupEnabled', 'Buka pendaftaran akun baru'], ['paymentEnabled', 'Aktifkan top up'], ['autoCityEnabled', 'Aktifkan pencarian kota otomatis'], ['maintenance', 'Aktifkan mode pemeliharaan']].map(([key, label]) => <label key={key}><input type="checkbox" checked={draft[key]} onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.checked }))} /><span>{label}</span></label>)}</div>
    <Field label="Pesan pemeliharaan">{(id) => <textarea id={id} maxLength={300} value={draft.maintenanceMessage} onChange={(event) => setDraft((value) => ({ ...value, maintenanceMessage: event.target.value }))} />}</Field><p className="admin-help">Admin tetap dapat mengakses panel saat pemeliharaan. Callback pembayaran tetap diproses agar transaksi lunas masuk ke akun.</p><button className="btn-primary" type="submit">Tinjau dan simpan pengaturan</button><p className="admin-help">Pemilik utama: {data.ownerUIDs?.join(', ') || 'Belum dikonfigurasi di server'} · Diperbarui {date(data.updatedAt)}</p>
  </form>;
}
export function AdminActionDialog({ user, task, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState('add');
  const [badgeMode, setBadgeMode] = useState('manual');
  const [badgeTier, setBadgeTier] = useState(membershipTier(task.profile?.membershipTier).id);
  const [amount, setAmount] = useState('');
  const [text, setText] = useState(task.text || '');
  const [invoice, setInvoice] = useState(task.invoice || '');
  const [location, setLocation] = useState(task.location || { kind: 'issn', matchValue: '', city: '', sourceURL: '', enabled: true });
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [error, setError] = useState('');
  const requestStorage = `flashcite:admin-request:${user.uid}`;
  const request = useRef(readStorage(requestStorage));
  const close = () => { if (!busyRef.current) onClose(); };
  async function submit(event) {
    event.preventDefault(); if (busyRef.current) return;
    let body = { action: task.action, reason, uid: task.uid };
    if (task.action === 'adjustCredits') body = { ...body, mode, amount: Number(amount), expectedBalance: task.profile.credits };
    if (task.action === 'setMembership') body = { ...body, tier: badgeTier, mode: badgeMode, expectedVersion: task.profile.membershipVersion || 0 };
    if (task.action === 'setRole') body.role = task.role;
    if (task.action === 'setStatus') body.status = task.status;
    if (task.action === 'saveNotes') body.text = text;
    if (task.action === 'syncPayment') body.invoice = task.invoice;
    if (task.action === 'recoverPayment') body = { ...body, requestID: task.requestID, invoice: invoice.trim() };
    if (task.action === 'upsertLocation') body = { ...body, ...location };
    if (task.action === 'updateSettings') body = { ...body, settings: task.settings, expectedUpdatedAt: task.expectedUpdatedAt };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    writeStorage(requestStorage, request.current);
    busyRef.current = true; setBusy(true); setError('');
    try { const result = await api('admin', { user, body, key: request.current.key }); writeStorage(requestStorage, null); onSuccess(result); }
    catch (error) { setError(error.message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const setLocationValue = (key) => (event) => setLocation((value) => ({ ...value, [key]: event.target.value }));
  return <Modal title={actionNames[task.action]} className="admin-action-modal" onClose={close}><form className="admin-action-form" onSubmit={submit}>
    {task.uid && <div className="admin-action-target"><strong>{task.profile?.name || task.profile?.email || 'Pengguna'}</strong><code>{task.uid}</code></div>}
    {task.action === 'adjustCredits' && <><p className="admin-help">Saldo tersimpan: <strong>{number(task.profile.credits)} kredit</strong>. {hasUnlimitedCredits(task.profile) && 'Admin dapat generate tanpa batas; saldo tersimpan tidak dipotong dan berlaku jika perannya kembali menjadi pengguna.'}</p><div className="admin-form-grid"><Field label="Jenis perubahan">{(id) => <select id={id} value={mode} onChange={(event) => setMode(event.target.value)}><option value="add">Tambah kredit</option><option value="subtract">Kurangi kredit</option><option value="set">Tetapkan saldo akhir</option></select>}</Field><Field label={mode === 'set' ? 'Saldo akhir' : 'Jumlah kredit'}>{(id) => <input id={id} type="number" min={mode === 'set' ? 0 : 1} max={1000000} step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} />}</Field></div><p className="admin-help">Perubahan ini dicatat sebagai mutasi kredit. Tidak memindahkan uang atau mengembalikan pembayaran.</p></>}
    {task.action === 'setMembership' && <><p>Badge saat ini: <MembershipBadge tier={task.profile.membershipTier} /></p><div className="admin-form-grid"><Field label="Pengaturan badge">{(id) => <select id={id} value={badgeMode} onChange={(event) => setBadgeMode(event.target.value)}><option value="manual">Tetapkan badge manual</option><option value="automatic">Ikuti paket yang dibeli (otomatis)</option></select>}</Field><Field label="Badge keanggotaan">{(id) => <select id={id} value={badgeMode === 'automatic' ? membershipTier(task.profile.purchasedTier).id : badgeTier} onChange={(event) => setBadgeTier(event.target.value)} disabled={badgeMode === 'automatic'}>{MEMBERSHIP_TIERS.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select>}</Field></div><p className="admin-help">Mode manual mempertahankan badge pilihan hingga diubah kembali ke otomatis. Mode otomatis mengikuti paket tertinggi yang sudah lunas. Saldo kredit dan peran akun dikelola lewat tindakan masing-masing.</p></>}
    {task.action === 'setRole' && <p>Ubah peran akun menjadi <strong>{task.role === 'admin' ? 'Admin dengan seluruh akses pengelolaan' : 'Pengguna biasa'}</strong>.</p>}
    {task.action === 'setStatus' && <p>{task.status === 'blocked' ? 'Blokir akses aplikasi dan nonaktifkan login akun ini.' : 'Aktifkan kembali akses aplikasi dan login akun ini.'}</p>}
    {task.action === 'revokeSessions' && <p>Sesi akun akan dicabut. Pengguna perlu masuk kembali.</p>}
    {task.action === 'saveNotes' && <Field label="Catatan internal (hanya admin)">{(id) => <textarea id={id} maxLength={4000} rows={6} value={text} onChange={(event) => setText(event.target.value)} />}</Field>}
    {task.action === 'syncPayment' && <p>Periksa status invoice <strong>{task.invoice}</strong> ke {task.providerName || 'penyedia pembayaran'}. Kredit hanya masuk jika penyedia menyatakan lunas dengan nominal yang cocok.</p>}
    {task.action === 'recoverPayment' && <><p>Hubungkan invoice milik pengguna ini ke request <code>{task.requestID}</code> dengan nominal paket <strong>{rupiah(task.amount)}</strong>.</p><Field label={`Invoice dari dashboard ${task.providerName || 'penyedia pembayaran'}`}>{(id) => <input id={id} required value={invoice} onChange={(event) => setInvoice(event.target.value)} placeholder="Pastikan invoice milik pengguna yang benar" />}</Field></>}
    {task.action === 'upsertLocation' && <><Field label="Cocokkan berdasarkan">{(id) => <select id={id} disabled={!!task.location} value={location.kind} onChange={setLocationValue('kind')}><option value="issn">ISSN</option><option value="journal">Nama jurnal persis</option><option value="journal-url">URL utama jurnal OJS</option><option value="publisher">Nama penerbit persis</option></select>}</Field><Field label="Nilai pencocokan">{(id) => <input id={id} disabled={!!task.location} required maxLength={250} value={location.matchValue} onChange={setLocationValue('matchValue')} placeholder={location.kind === 'issn' ? '1234-567X' : location.kind === 'journal-url' ? 'https://jurnal.ac.id/index.php/nama' : 'Nama yang sama dengan metadata'} />}</Field><Field label="Kota terbit">{(id) => <input id={id} required maxLength={100} value={location.city} onChange={setLocationValue('city')} />}</Field><Field label="Tautan sumber resmi">{(id) => <input id={id} type="url" required value={location.sourceURL} onChange={setLocationValue('sourceURL')} placeholder="https://.../about/contact" />}</Field><label className="admin-checkbox"><input type="checkbox" checked={location.enabled} onChange={(event) => setLocation((value) => ({ ...value, enabled: event.target.checked }))} />Gunakan pemetaan ini</label></>}
    {task.action === 'updateSettings' && <dl className="admin-settings-review">{Object.entries(task.settings).map(([key, value]) => <div key={key}><dt>{({ pricePerCredit: 'Harga per kredit satuan', proPackagePrice: 'Harga Paket Pro', plusPackagePrice: 'Harga Paket Plus', sultanPackagePrice: 'Harga Paket Sultan', welcomeCredits: 'Kredit awal', minTopup: 'Minimal top up', maxTopup: 'Maksimal top up', maxBatch: 'Batas batch', signupEnabled: 'Pendaftaran', paymentEnabled: 'Top up', maintenance: 'Pemeliharaan', maintenanceMessage: 'Pesan pemeliharaan', autoCityEnabled: 'Kota otomatis' })[key]}</dt><dd>{typeof value === 'boolean' ? value ? 'Aktif' : 'Nonaktif' : String(value)}</dd></div>)}</dl>}
    <Field label="Alasan tindakan" hint="Wajib diisi dan disimpan di log audit.">{(id) => <textarea id={id} minLength={5} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Jelaskan alasan perubahan ini" />}</Field>
    <ErrorBox message={error} />
    <div className="admin-dialog-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={close}>Batal</button><button type="submit" className="btn-primary" disabled={busy || reason.trim().length < 5}>{busy ? <><Spinner />Menyimpan…</> : 'Konfirmasi tindakan'}</button></div>
  </form></Modal>;
}
