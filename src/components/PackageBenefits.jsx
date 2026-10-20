import { PACKAGE_BENEFITS, membershipTier } from '../../shared/membership';

export default function PackageBenefits({ packageId, children }) {
  const benefits = PACKAGE_BENEFITS[packageId];
  if (!benefits) return null;
  return <ul className="package-benefits" aria-label={`Benefit paket ${membershipTier(packageId).name}`}>
    {benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}{children}
  </ul>;
}
