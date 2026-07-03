import { isIP, type LookupFunction } from "node:net";
import { lookup } from "node:dns/promises";
import {
  lookup as lookupCb,
  type LookupAddress,
  type LookupOptions,
} from "node:dns";
import { Agent as HttpsAgent } from "node:https";

function ipv4ToOctets(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
  return octets;
}

function isBlockedIpv4(ip: string): boolean {
  const octets = ipv4ToOctets(ip);
  if (!octets) return false;
  const [a, b] = octets;

  // 0.0.0.0 and 0.0.0.0/8 ("this network")
  if (a === 0) return true;
  // 127.0.0.0/8 loopback
  if (a === 127) return true;
  // 10.0.0.0/8 private
  if (a === 10) return true;
  // 169.254.0.0/16 link-local (incl. 169.254.169.254 metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 private
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 private
  if (a === 192 && b === 168) return true;
  // >= 224.0.0.0 multicast / reserved
  if (a >= 224) return true;

  return false;
}

function isBlockedIpv4Bits(hi: number, lo: number): boolean {
  const a = (hi >> 8) & 0xff;
  const b = hi & 0xff;
  const c = (lo >> 8) & 0xff;
  const d = lo & 0xff;
  return isBlockedIpv4(`${a}.${b}.${c}.${d}`);
}

/**
 * Expands any valid IPv6 string (compressed `::`, embedded dotted-quad, or full)
 * into its eight 16-bit hextets. Working on the numeric address rather than the
 * textual form means canonicalization by `new URL()` (e.g. `::ffff:127.0.0.1`
 * becoming `::ffff:7f00:1`) cannot slip an embedded IPv4 address past the checks.
 */
function expandIpv6ToHextets(rawIp: string): number[] | null {
  let ip = rawIp.toLowerCase().replace(/^\[|\]$/g, "");

  // Fold a trailing dotted-quad (::ffff:127.0.0.1) into two hextets.
  const lastColon = ip.lastIndexOf(":");
  if (lastColon !== -1 && ip.slice(lastColon + 1).includes(".")) {
    const octets = ipv4ToOctets(ip.slice(lastColon + 1));
    if (!octets) return null;
    const hi = (octets[0] << 8) | octets[1];
    const lo = (octets[2] << 8) | octets[3];
    ip = `${ip.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }

  const dblIdx = ip.indexOf("::");
  let headParts: string[];
  let tailParts: string[];
  if (dblIdx === -1) {
    headParts = ip.split(":");
    tailParts = [];
    if (headParts.length !== 8) return null;
  } else {
    const head = ip.slice(0, dblIdx);
    const rest = ip.slice(dblIdx + 2);
    headParts = head.length ? head.split(":") : [];
    tailParts = rest.length ? rest.split(":") : [];
  }

  const missing = 8 - (headParts.length + tailParts.length);
  if (missing < 0) return null;

  const hextets = [
    ...headParts.map((p) => Number.parseInt(p || "0", 16)),
    ...new Array<number>(missing).fill(0),
    ...tailParts.map((p) => Number.parseInt(p || "0", 16)),
  ];
  if (hextets.length !== 8) return null;
  if (hextets.some((h) => !Number.isInteger(h) || h < 0 || h > 0xffff)) {
    return null;
  }
  return hextets;
}

function isBlockedIpv6(rawIp: string): boolean {
  const h = expandIpv6ToHextets(rawIp);
  if (!h) return false;

  const highSixZero = h.slice(0, 6).every((x) => x === 0);
  // Unspecified :: and loopback ::1
  if (highSixZero && h[6] === 0 && (h[7] === 0 || h[7] === 1)) return true;
  // v4-mapped ::ffff:0:0/96 — check the embedded IPv4 address
  if (
    h[0] === 0 &&
    h[1] === 0 &&
    h[2] === 0 &&
    h[3] === 0 &&
    h[4] === 0 &&
    h[5] === 0xffff
  ) {
    return isBlockedIpv4Bits(h[6], h[7]);
  }
  // NAT64 well-known prefix 64:ff9b::/96 (RFC 6052) — a NAT64 gateway translates
  // the embedded IPv4 address, so apply the same private/loopback checks.
  if (
    h[0] === 0x0064 &&
    h[1] === 0xff9b &&
    h[2] === 0 &&
    h[3] === 0 &&
    h[4] === 0 &&
    h[5] === 0
  ) {
    return isBlockedIpv4Bits(h[6], h[7]);
  }
  // v4-compatible ::/96 (deprecated but still routable) — check embedded IPv4
  if (highSixZero) return isBlockedIpv4Bits(h[6], h[7]);
  // fc00::/7 unique-local
  if ((h[0] & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfe80) return true;
  // fec0::/10 site-local (deprecated but still resolvable on some networks)
  if ((h[0] & 0xffc0) === 0xfec0) return true;

  return false;
}

function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return false;
}

/**
 * Guards against SSRF: parses the URL, requires https, and rejects any host
 * that resolves to (or is literally) a loopback/private/link-local/ULA/metadata
 * address. Throws on any violation.
 */
export async function assertPublicHttpsUrl(raw: string): Promise<void> {
  const url = new URL(raw);

  if (url.protocol !== "https:") {
    throw new Error(`Refusing non-https URL: ${url.protocol}`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  // Literal IP in the host — check directly.
  if (isIP(host) !== 0) {
    if (isBlockedAddress(host)) {
      throw new Error(`Refusing request to disallowed IP: ${host}`);
    }
    return;
  }

  const resolved = await lookup(host, { all: true });
  if (resolved.length === 0) {
    throw new Error(`Could not resolve host: ${host}`);
  }
  for (const { address } of resolved) {
    if (isBlockedAddress(address)) {
      throw new Error(
        `Refusing request to ${host}: resolves to disallowed address ${address}`,
      );
    }
  }
}

/**
 * A DNS lookup for use at socket-connect time. It re-runs the SSRF address
 * check on the address actually resolved for the connection. Paired with the
 * pre-flight assertPublicHttpsUrl, this closes the DNS-rebinding window where a
 * host resolves to a public address during validation but to an internal one
 * when the socket actually connects.
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  lookupCb(
    hostname,
    options as LookupOptions,
    (
      err: NodeJS.ErrnoException | null,
      address: string | LookupAddress[],
      family: number,
    ) => {
      if (err) {
        callback(err, address as string, family);
        return;
      }
      const entries: LookupAddress[] = Array.isArray(address)
        ? address
        : [{ address, family }];
      const blocked = entries.find((entry) => isBlockedAddress(entry.address));
      if (blocked) {
        callback(
          new Error(
            `Refusing connection to ${hostname}: resolves to disallowed address ${blocked.address}`,
          ),
          "",
          0,
        );
        return;
      }
      callback(err, address as string, family);
    },
  );
};

/**
 * Shared HTTPS agent that validates the resolved IP at connect time via
 * guardedLookup. Use for every outbound request to a remote-controlled URL.
 */
export const guardedHttpsAgent = new HttpsAgent({ lookup: guardedLookup });

/**
 * Internal helpers exported solely so tests can exercise the defensive
 * malformed-input guards that the public API's `isIP()` pre-validation makes
 * otherwise unreachable. Not part of the module's supported surface.
 */
export const __testables = {
  ipv4ToOctets,
  isBlockedIpv4,
  expandIpv6ToHextets,
  isBlockedIpv6,
  isBlockedAddress,
};
