/**
 * `NEXT_PUBLIC_DISABLE_AUTH_GUARD` lets the app shell render without a real
 * session so UI/styling work needs no login.
 *
 * The flag is `NEXT_PUBLIC_`, so its value is baked into the client bundle: a
 * build that sets it by accident ships that setting to whatever host serves the
 * bundle. The hostname check is what keeps that from mattering - the bypass can
 * only ever take effect on a local origin.
 *
 * Every consumer of the flag has to go through this helper. Reading
 * `process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD` directly re-introduces the
 * unguarded form, which is how the session initializer and the sidebar ended up
 * rendering the private shell on a deployed host while their comments claimed
 * they could not.
 */
export const isLocalGuardBypassEnabled = (): boolean => {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD !== 'true') return false;
  const hostname = (
    process.env.YC_TEST_HOSTNAME ?? globalThis.window?.location?.hostname
  )?.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};
