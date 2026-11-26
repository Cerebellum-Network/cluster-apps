/**
 * When the console registers the account in payment-service: only once a load
 * of THIS account's profile has finished cleanly and found it unregistered.
 * Before its first load a profile reads `data: null, loading: false` too, so
 * "null" alone is not "not registered" — registering then would re-record the
 * terms on every visit.
 */
export function shouldRegister(
  profile: { settled: boolean; error: string | null; data: unknown },
  account: string | null,
  termsVersion: string | undefined,
  alreadyFor: string | null,
): boolean {
  return !!account && !!termsVersion && profile.settled && !profile.error && profile.data === null && alreadyFor !== account;
}
