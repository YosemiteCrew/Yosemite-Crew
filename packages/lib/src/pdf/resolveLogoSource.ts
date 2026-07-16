import axios from 'axios';
import dns from 'node:dns';
import fs from 'node:fs';
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
 * Resolve every address the host maps to and reject if any is private. Checking
 * all records rather than the first keeps a hostname that mixes public and
 * internal answers from slipping through.
 */
const resolvesToPublicAddress = async (hostname: string): Promise<boolean> => {
  if (net.isIP(hostname)) {
    return !isPrivateAddress(hostname);
  }

  try {
    const records = await dns.promises.lookup(hostname, { all: true });
    return records.length > 0 && records.every((record) => !isPrivateAddress(record.address));
  } catch {
    return false;
  }
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

    if (!(await resolvesToPublicAddress(hostname))) {
      return null;
    }

    try {
      const response = await axios.get<ArrayBuffer>(parsed.toString(), {
        responseType: 'arraybuffer',
        timeout: LOGO_FETCH_TIMEOUT_MS,
        maxRedirects: 0,
        maxContentLength: LOGO_MAX_BYTES,
        maxBodyLength: LOGO_MAX_BYTES,
        validateStatus: (status) => status >= 200 && status < 300,
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
