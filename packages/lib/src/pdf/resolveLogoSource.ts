import axios from 'axios';
import dns from 'node:dns';
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

// Expand any valid IPv6 literal (including `::` compression and an embedded
// dotted-quad tail) to its 16 bytes. Returns null for anything unparseable so
// the caller can fail closed.
const expandIpv6ToBytes = (address: string): number[] | null => {
  let addr = address.toLowerCase().trim();
  const zone = addr.indexOf('%');
  if (zone !== -1) addr = addr.slice(0, zone);

  // Fold a trailing dotted-quad (e.g. `::ffff:1.2.3.4`) into two hextets.
  const dotted = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(addr);
  if (dotted) {
    const quad = [dotted[2], dotted[3], dotted[4], dotted[5]].map(Number);
    if (quad.some((octet) => octet > 255)) return null;
    const [a, b, c, d] = quad as [number, number, number, number];
    addr = dotted[1] + (((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16));
  }

  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let groups: string[];
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const value = parseInt(group, 16);
    bytes.push((value >> 8) & 0xff, value & 0xff);
  }
  return bytes;
};

// Default-deny IPv6 classifier. Only global-unicast space (2000::/3) is treated
// as potentially public; everything else — loopback, unspecified, ULA (fc00::/7),
// link-local (fe80::/10), IPv4-mapped/compatible, and NAT64 (64:ff9b::/96) — is
// private. Within global unicast, the two prefixes that tunnel an IPv4 address
// (6to4 2002::/16 and Teredo 2001:0000::/32) are decoded and re-checked, so a
// hostile AAAA record cannot smuggle a loopback/metadata target past the guard.
const isPrivateIpv6 = (address: string): boolean => {
  const bytes = expandIpv6ToBytes(address);
  if (!bytes) return true;

  const [b0, b1, b2, b3] = bytes as number[];
  if ((b0 & 0xe0) !== 0x20) return true;

  // 6to4: embedded IPv4 sits in bytes 2..5.
  if (b0 === 0x20 && b1 === 0x02) {
    return isPrivateIpv4(`${bytes[2]}.${bytes[3]}.${bytes[4]}.${bytes[5]}`);
  }
  // Teredo: the client IPv4 is the last four bytes XOR 0xff.
  if (b0 === 0x20 && b1 === 0x01 && b2 === 0x00 && b3 === 0x00) {
    const client = [12, 13, 14, 15].map((index) => bytes[index] ^ 0xff);
    return isPrivateIpv4(client.join('.'));
  }
  return false;
};

// Exported for direct security testing of the SSRF address guard.
export const isPrivateAddress = (address: string): boolean =>
  net.isIPv4(address) ? isPrivateIpv4(address) : isPrivateIpv6(address);

/**
 * Resolve every address the host maps to and return them only if all are
 * public. Checking all records rather than the first keeps a hostname that
 * mixes public and internal answers from slipping through. Returning the
 * validated addresses (rather than a boolean) lets the caller pin the
 * connection to them.
 */
export const resolvePublicAddresses = async (hostname: string): Promise<string[] | null> => {
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
export const buildPinnedAgent = (
  protocol: string,
  addresses: string[]
): http.Agent | https.Agent => {
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

  // Only validated remote URLs are fetched. The renderer ships no bundled logo
  // assets and the value comes from an organisation record, so treating a
  // non-URL string as a filesystem path would be an arbitrary-read / file
  // existence-oracle sink. Reject it.
  return null;
};
