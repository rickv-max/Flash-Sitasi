import { hasUnlimitedCredits } from '../../shared/credits';
import './credit-balance.css';

export default function CreditBalance({ profile, compact = false }) {
  if (hasUnlimitedCredits(profile)) return <span className={`credit-balance credit-balance-unlimited ${compact ? 'compact' : ''}`} role="img" aria-label="Kredit admin tanpa batas" title="Admin · sitasi tanpa batas">
    <span className="credit-infinity" aria-hidden="true">∞</span>{!compact && <span className="credit-unlimited-label" aria-hidden="true">Tanpa batas</span>}
  </span>;
  const credits = Number.isSafeInteger(profile?.credits) ? profile.credits : 0;
  return <span className="credit-balance">{credits.toLocaleString('id-ID')}</span>;
}
