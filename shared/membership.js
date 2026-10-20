export const MEMBERSHIP_TIERS = Object.freeze([
  Object.freeze({ id: 'regular', name: 'Reguler', rank: 0 }),
  Object.freeze({ id: 'pro', name: 'Pro', rank: 1 }),
  Object.freeze({ id: 'plus', name: 'Plus', rank: 2 }),
  Object.freeze({ id: 'sultan', name: 'Sultan', rank: 3 }),
]);
export const membershipTier = (id) => MEMBERSHIP_TIERS.find((tier) => tier.id === id) || MEMBERSHIP_TIERS[0];
export const higherMembership = (first, second) => membershipTier(first).rank >= membershipTier(second).rank ? membershipTier(first).id : membershipTier(second).id;
export function paidMembership(profile, packageId, now = Date.now()) {
  if (!MEMBERSHIP_TIERS.some((tier) => tier.id === packageId && tier.rank > 0)) return {};
  const purchasedTier = higherMembership(profile.purchasedTier, packageId);
  const membership = profile.membershipManualOverride ? membershipTier(profile.membershipTier).id : higherMembership(profile.membershipTier, purchasedTier);
  return { purchasedTier, membershipTier: membership, membershipManualOverride: !!profile.membershipManualOverride,
    membershipSource: profile.membershipManualOverride ? 'admin' : 'payment', membershipUpdatedAt: now, membershipVersion: (profile.membershipVersion || 0) + 1 };
}

export const PACKAGE_BENEFITS = Object.freeze({
  pro: Object.freeze(['Badge Pro biru di akun dan profil publik', 'Bingkai profil biru', 'Nama tampilan dan bio di profil publik opsional', 'Foto akun Google opsional', 'Badge tetap melekat setelah kredit digunakan']),
  plus: Object.freeze(['Badge Plus ungu di akun dan profil publik', 'Bingkai profil ungu', 'Nama tampilan dan bio di profil publik opsional', 'Foto akun Google opsional', 'Badge tetap melekat setelah kredit digunakan']),
  sultan: Object.freeze(['Mahkota dan badge Sultan emas', 'Bingkai profil emas dengan animasi halus', 'Prioritas urutan di daftar anggota publik', 'Nama tampilan, bio, dan foto Google opsional', 'Badge tetap melekat setelah kredit digunakan']),
});
