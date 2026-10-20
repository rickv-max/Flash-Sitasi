import { membershipTier } from '../../shared/membership';
import './membership.css';

export default function MembershipBadge({ tier = 'regular' }) {
  const level = membershipTier(tier);
  return <span className={'membership-badge membership-' + level.id} aria-label={'Keanggotaan ' + level.name}>
    <span aria-hidden="true">{level.id === 'sultan' ? '♛' : level.id === 'plus' ? '✦' : level.id === 'pro' ? '◆' : '○'}</span>{level.name}
  </span>;
}
export function MembershipAvatar({ name, photoURL, tier = 'regular' }) {
  const initials = String(name || 'Anggota').trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return <span className={'membership-avatar membership-' + membershipTier(tier).id}>{photoURL ? <img src={photoURL} alt="" width="56" height="56" loading="lazy" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{initials}</span>}</span>;
}
