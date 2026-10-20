import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import MembershipBadge, { MembershipAvatar } from './MembershipBadge';
import { membershipTier } from '../../shared/membership';
import { Modal } from './Primitives';

export function MemberCard({ member, onOpen }) {
  return <button type="button" className={'public-member-card membership-' + membershipTier(member.tier).id} onClick={() => onOpen(member)} aria-label={'Lihat profil ' + member.name}>
    <MembershipAvatar name={member.name} photoURL={member.photoURL} tier={member.tier} /><span className="public-member-info"><strong>{member.name}</strong><MembershipBadge tier={member.tier} /><span>{member.bio || 'Anggota Flash Sitasi'}</span></span>
  </button>;
}
export function MemberProfileDialog({ member, onClose }) {
  return <Modal title="Profil Anggota" className="membership-profile-modal" onClose={onClose}>
    <div className="membership-public-detail"><MembershipAvatar name={member.name} photoURL={member.photoURL} tier={member.tier} /><h3>{member.name}</h3><MembershipBadge tier={member.tier} /><p>{member.bio || 'Anggota Flash Sitasi'}</p></div>
  </Modal>;
}
export default function PublicMembers() {
  const [state, setState] = useState({ items: [], ready: false, error: '' });
  const [expanded, setExpanded] = useState(false), [selected, setSelected] = useState(null);
  const refresh = useCallback(async () => {
    try { const data = await api('members', { method: 'GET' }); setState({ items: data.items, ready: true, error: '' }); }
    catch { setState((value) => ({ ...value, ready: true, error: 'Daftar anggota belum dapat dimuat.' })); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const resume = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('flashcite:members', refresh); window.addEventListener('focus', resume);
    return () => { clearTimeout(timer); window.removeEventListener('flashcite:members', refresh); window.removeEventListener('focus', resume); };
  }, [refresh]);
  return <section className="public-members-section relative z-10" aria-labelledby="public-members-title"><div className="container">
    <div className="public-members-heading"><span className="public-eyebrow">BERSAMA FLASH SITASI</span><h2 id="public-members-title">Kenali anggota kami.</h2><p>Profil pilihan anggota Pro, Plus, dan Sultan yang berbagi semangat menulis dan meneliti.</p></div>
    {!state.ready ? <p className="membership-help" role="status">Memuat anggota…</p> : state.error ? <p className="membership-help" role="status">{state.error} <button type="button" className="payment-method-retry" onClick={refresh}>Coba lagi</button></p> : state.items.length ? <>
      <div className="public-members-grid">{(expanded ? state.items : state.items.slice(0, 6)).map((member) => <MemberCard key={member.publicId} member={member} onOpen={setSelected} />)}</div>
      {state.items.length > 6 && <button className="btn-secondary members-expand" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? 'Tampilkan lebih sedikit' : 'Lihat lebih banyak anggota'}</button>}
    </> : <p className="public-members-empty">Belum ada profil yang dibagikan. Pemilik paket dapat mengaktifkan profil publik melalui Keanggotaan Saya.</p>}
    {selected && <MemberProfileDialog member={selected} onClose={() => setSelected(null)} />}
  </div></section>;
}
