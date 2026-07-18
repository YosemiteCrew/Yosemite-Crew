import axios from 'axios';
import dns from 'node:dns';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const LOGO_FETCH_TIMEOUT_MS = 5_000;
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Hosts the renderer is allowed to fetch branding from. Empty means "any public
 * host", which is still guarded by the private-address checks below.
 */
const allowedLogoHosts = (): string[] =>
  (process.env.PDF_LOGO_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const isPrivateIpv4 = (address: string): boolean => {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
    return true;
  }

  const [first, second] = octets as [number, number, number, number];
  if (first === 10 || first === 127 || first === 0) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  // Link-local, which covers the cloud instance metadata endpoint.
  if (first === 169 && second === 254) return true;
  // Carrier-grade NAT and benchmarking ranges.
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  return false;
};

const isPrivateIpv6 = (address: string): boolean => {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  // Unique-local and link-local.
  if (/^f[cd]/.test(normalized)) return true;
  if (normalized.startsWith('fe80')) return true;
  // IPv4-mapped addresses reuse the IPv4 rules.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped?.[1]) return isPrivateIpv4(mapped[1]);
  return false;
};

const isPrivateAddress = (address: string): boolean =>
  net.isIPv4(address) ? isPrivateIpv4(address) : isPrivateIpv6(address);

/**
 * Resolve every address the host maps to and return them only if all are
 * public. Checking all records rather than the first keeps a hostname that
 * mixes public and internal answers from slipping through. Returning the
 * validated addresses (rather than a boolean) lets the caller pin the
 * connection to them.
 */
const resolvePublicAddresses = async (hostname: string): Promise<string[] | null> => {
  if (net.isIP(hostname)) {
    return isPrivateAddress(hostname) ? null : [hostname];
  }

  try {
    const records = await dns.promises.lookup(hostname, { all: true });
    if (records.length === 0) return null;
    if (records.some((record) => isPrivateAddress(record.address))) return null;
    return records.map((record) => record.address);
  } catch {
    return null;
  }
};

/**
 * Build an HTTP(S) agent whose DNS lookup always returns one of the addresses
 * we already validated as public. Pinning the socket to a checked address
 * closes the DNS-rebinding TOCTOU window: without it, the fetch below would
 * re-resolve the hostname and could connect to a loopback / cloud-metadata
 * address that the name was rebound to after the check.
 */
const buildPinnedAgent = (protocol: string, addresses: string[]): http.Agent | https.Agent => {
  const entries: dns.LookupAddress[] = addresses.map((address) => ({
    address,
    family: net.isIPv6(address) ? 6 : 4,
  }));

  const lookup = ((
    _hostname: string,
    options: dns.LookupOneOptions | dns.LookupAllOptions | number,
    callback: (...args: unknown[]) => void
  ): void => {
    if (typeof options === 'object' && options.all) {
      callback(null, entries);
    } else {
      const [first] = entries;
      callback(null, first.address, first.family);
    }
  }) as unknown as net.LookupFunction;

  return protocol === 'https:' ? new https.Agent({ lookup }) : new http.Agent({ lookup });
};

/**
 * Fetch organisation branding for a rendered document.
 *
 * `logoUrl` comes from an organisation record rather than a request body, but it
 * is still operator-supplied, so it is treated as untrusted: the renderer must
 * not become a way to reach internal services, follow redirects into them, or
 * stream an unbounded response into memory.
 */
export const resolveLogoSource = async (
  logoUrl?: string | null
): Promise<string | Buffer | null> => {
  if (!logoUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(logoUrl)) {
    let parsed: URL;
    try {
      parsed = new URL(logoUrl);
    } catch {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();
    const allowlist = allowedLogoHosts();
    if (allowlist.length > 0 && !allowlist.includes(hostname)) {
      return null;
    }

    const publicAddresses = await resolvePublicAddresses(hostname);
    if (!publicAddresses) {
      return null;
    }

    try {
      const pinnedAgent = buildPinnedAgent(parsed.protocol, publicAddresses);
      const response = await axios.get<ArrayBuffer>(parsed.toString(), {
        responseType: 'arraybuffer',
        timeout: LOGO_FETCH_TIMEOUT_MS,
        maxRedirects: 0,
        maxContentLength: LOGO_MAX_BYTES,
        maxBodyLength: LOGO_MAX_BYTES,
        validateStatus: (status) => status >= 200 && status < 300,
        httpAgent: pinnedAgent,
        httpsAgent: pinnedAgent,
      });

      const contentType = String(response.headers?.['content-type'] ?? '').toLowerCase();
      if (contentType && !contentType.startsWith('image/')) {
        return null;
      }

      return Buffer.from(response.data);
    } catch {
      return null;
    }
  }

  // A non-URL value is only ever a bundled asset path shipped with the renderer.
  if (!fs.existsSync(logoUrl)) {
    return null;
  }
  return logoUrl;
};
