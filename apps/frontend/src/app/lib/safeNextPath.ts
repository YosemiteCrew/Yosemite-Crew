// Only same-origin, absolute-path destinations are safe post-auth targets;
// anything else (external URLs, protocol-relative //host) is dropped.
//
// Resolved against a fixed base rather than prefix-matched. A `startsWith('//')`
// style check is defeated by characters browsers strip from a URL before
// navigating: `/\t/evil.com` and `/\n/evil.com` are not literally `//...` but
// become protocol-relative once stripped, which is an open redirect straight off
// the sign-in page. Parsing normalises all of that, and comparing the resolved
// origin to the base is what actually proves the target is same-origin.
const SAME_ORIGIN_BASE = 'https://sanitize-next-path.invalid';

export const sanitizeNextPath = (value: string | null): string | undefined => {
  if (!value) return undefined;
  // Strip the characters a browser would drop, so the parse below sees what the
  // browser would actually navigate to.
  const stripped = value.replace(/[\t\n\r]/g, '');
  if (!stripped.startsWith('/') || stripped.startsWith('//')) return undefined;

  try {
    const url = new URL(stripped, SAME_ORIGIN_BASE);
    if (url.origin !== SAME_ORIGIN_BASE) return undefined;
    const resolved = `${url.pathname}${url.search}${url.hash}`;
    // Re-check the RESOLVED path: `/..//evil.com` parses as same-origin here but
    // normalises to `//evil.com`, which the router would treat as
    // protocol-relative all over again.
    return resolved.startsWith('//') ? undefined : resolved;
  } catch {
    return undefined;
  }
};
