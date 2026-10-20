import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { membershipTier } from '../../shared/membership';
import MembershipBadge, { MembershipAvatar } from './MembershipBadge';
import { Modal, Spinner } from './Primitives';

export default function MembershipProfile({ user, profile, onClose, notify }) {
  const [draft, setDraft] = useState({ name: profile.publicProfile?.name || profile.name || user.displayName || 'Anggota Flash Sitasi', bio: profile.publicProfile?.bio || '', visible: !!profile.publicProfile?.visible, showPhoto: !!profile.publicProfile?.showPhoto });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), tier = membershipTier(profile.membershipTier);
  async function save(event) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await api('profile', { user, body: { action: 'updatePublicProfile', profile: draft } }); window.dispatchEvent(new Event('flashcite:members')); notify('Pengaturan profil keanggotaan berhasil disimpan.', 'success'); onClose(); }
    catch (error) { setError(error.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Modal title="Keanggotaan Saya" className="membership-profile-modal" onClose={() => { if (!lock.current) onClose(); }}>
    <form className="membership-profile-form" onSubmit={save}>
      <div className="membership-profile-heading"><MembershipAvatar name={draft.name} photoURL={draft.showPhoto ? profile.photoURL : ''} tier={tier.id} /><div><strong>{draft.name}</strong><MembershipBadge tier={tier.id} /></div></div>
      <p className="membership-help">Badge tetap melekat setelah kredit digunakan. {profile.membershipManualOverride ? 'Badge Anda ditetapkan oleh pengelola.' : 'Pembelian paket yang lebih tinggi meningkatkan badge secara otomatis.'}</p>
      <label htmlFor="membership-name">Nama tampilan publik<input id="membership-name" minLength={2} maxLength={50} required value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} disabled={busy} /></label>
      <label htmlFor="membership-bio">Bio singkat<textarea id="membership-bio" maxLength={160} rows={3} value={draft.bio} onChange={(event) => setDraft((value) => ({ ...value, bio: event.target.value }))} placeholder="Bidang studi atau hal yang ingin Anda perkenalkan." disabled={busy} /></label>
      <label className="membership-checkbox"><input type="checkbox" checked={draft.showPhoto} onChange={(event) => setDraft((value) => ({ ...value, showPhoto: event.target.checked }))} disabled={busy} />Gunakan foto akun Google di profil publik</label>
      <label className="membership-checkbox"><input type="checkbox" checked={draft.visible} onChange={(event) => setDraft((value) => ({ ...value, visible: event.target.checked }))} disabled={busy} />Tampilkan keanggotaan saya di publik</label>
      <p className="membership-help">Profil Pro, Plus, dan Sultan yang memilih tampil publik dapat dilihat pengunjung di beranda. Informasi yang tampil adalah nama pilihan, bio, badge, dan foto jika diaktifkan. {tier.rank === 0 && 'Simpan pilihan Anda sekarang; profil tampil setelah mendapatkan badge premium.'}</p>
      {error && <p className="membership-error" role="alert">{error}</p>}
      <button className="btn-primary" type="submit" disabled={busy}>{busy ? <><Spinner />Menyimpan…</> : 'Simpan Pengaturan Profil'}</button>
    </form>
  </Modal>;
}
