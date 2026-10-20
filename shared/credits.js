// Administrative access is derived from the current trusted profile, never the badge or balance.
export const hasUnlimitedCredits = (profile) => profile?.role === 'admin' && profile.status !== 'blocked' && !profile.archived;
export const canGenerateWithCredits = (profile) => !!profile && profile.status !== 'blocked' && !profile.archived && (hasUnlimitedCredits(profile) || Number.isSafeInteger(profile.credits) && profile.credits > 0);
