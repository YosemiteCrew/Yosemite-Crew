import axios from 'axios';

import { buildPinnedAgent, resolvePublicAddresses } from './resolveLogoSource.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

export class GuardedFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuardedFetchError';
  }
}

/**
 * Hosts a guarded fetch is allowed to reach. Empty means "any public host",
 * which is still constrained by the private-address checks in the shared SSRF
 * guard. Mirrors `PDF_LOGO_ALLOWED_HOSTS` so both fetch paths are configured
 * the same way.
 */
const allowedRemoteHosts = (): string[] =>
  (process.env.PDF_REMOTE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export type FetchPublicUrlOptions = {
  timeoutMs?: number;
  maxBytes?: number;
};

/**
 * Fetch a remote URL into a Buffer without letting the caller reach internal
 * services.
 *
 * The URL reaches us from stored records rather than a request body, but it is
 * still operator-supplied, so it is treated as untrusted. The same guarantees
 * as the branding fetch apply: http(s) only, an optional host allowlist, every
 * resolved address must be public, the socket is pinned to those addresses so a
 * DNS rebind cannot swap in a loopback/metadata target, redirects are refused
 * (a 3xx would otherwise re-enter the resolver unchecked), and the response is
 * size-capped.
 */
export const fetchPublicUrlAsBuffer = async (
  url: string,
  options: FetchPublicUrlOptions = {}
): Promise<Buffer> => {
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new GuardedFetchError('Refusing to fetch a malformed URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new GuardedFetchError(`Refusing to fetch unsupported protocol ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowlist = allowedRemoteHosts();
  if (allowlist.length > 0 && !allowlist.includes(hostname)) {
    throw new GuardedFetchError('Refusing to fetch a host outside the allowlist');
  }

  const publicAddresses = await resolvePublicAddresses(hostname);
  if (!publicAddresses) {
    throw new GuardedFetchError('Refusing to fetch a host that resolves to a private address');
  }

  const pinnedAgent = buildPinnedAgent(parsed.protocol, publicAddresses);
  const response = await axios.get<ArrayBuffer>(parsed.toString(), {
    responseType: 'arraybuffer',
    timeout,
    maxRedirects: 0,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    validateStatus: (status) => status >= 200 && status < 300,
    httpAgent: pinnedAgent,
    httpsAgent: pinnedAgent,
  });

  return Buffer.from(response.data);
};
