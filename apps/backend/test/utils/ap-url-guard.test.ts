import { lookup } from "node:dns/promises";
import { lookup as lookupCb } from "node:dns";
import { Agent as HttpsAgent } from "node:https";
import {
  assertPublicHttpsUrl,
  guardedLookup,
  guardedHttpsAgent,
  __testables,
} from "src/utils/ap-url-guard";

jest.mock("node:dns/promises", () => ({
  lookup: jest.fn(),
}));

jest.mock("node:dns", () => ({
  lookup: jest.fn(),
}));

const mockLookup = lookup as unknown as jest.Mock;
const mockLookupCb = lookupCb as unknown as jest.Mock;

function resolvesTo(...addresses: string[]) {
  mockLookup.mockResolvedValue(
    addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    })),
  );
}

describe("assertPublicHttpsUrl", () => {
  beforeEach(() => {
    mockLookup.mockReset();
  });

  it("throws on non-URL garbage", async () => {
    await expect(assertPublicHttpsUrl("not a url")).rejects.toThrow();
  });

  it("rejects non-https protocols", async () => {
    await expect(assertPublicHttpsUrl("http://example.com")).rejects.toThrow(
      /non-https/,
    );
    await expect(assertPublicHttpsUrl("file:///etc/passwd")).rejects.toThrow();
  });

  it("allows a host that resolves to a public address", async () => {
    resolvesTo("93.184.216.34");
    await expect(
      assertPublicHttpsUrl("https://example.com/actor"),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["127.0.0.1", "loopback"],
    ["10.1.2.3", "10/8"],
    ["172.16.5.4", "172.16/12"],
    ["192.168.1.1", "192.168/16"],
    ["169.254.169.254", "metadata"],
    ["0.0.0.0", "this-network"],
    ["224.0.0.1", "multicast"],
  ])("rejects when host resolves to %s (%s)", async (ip) => {
    resolvesTo(ip);
    await expect(
      assertPublicHttpsUrl("https://evil.example.com"),
    ).rejects.toThrow(/disallowed address/);
  });

  it("rejects if ANY resolved address is private", async () => {
    resolvesTo("93.184.216.34", "10.0.0.5");
    await expect(
      assertPublicHttpsUrl("https://evil.example.com"),
    ).rejects.toThrow(/disallowed address/);
  });

  it("rejects IPv6 loopback and ULA and link-local", async () => {
    for (const ip of ["::1", "fc00::1", "fd12::1", "fe80::1"]) {
      resolvesTo(ip);
      await expect(
        assertPublicHttpsUrl("https://evil.example.com"),
      ).rejects.toThrow(/disallowed address/);
    }
  });

  it("unwraps v4-mapped IPv6 and re-checks", async () => {
    resolvesTo("::ffff:169.254.169.254");
    await expect(
      assertPublicHttpsUrl("https://evil.example.com"),
    ).rejects.toThrow(/disallowed address/);
  });

  it("rejects a literal private IP host without DNS lookup", async () => {
    await expect(
      assertPublicHttpsUrl("https://127.0.0.1/inbox"),
    ).rejects.toThrow(/disallowed IP/);
    await expect(assertPublicHttpsUrl("https://[::1]/inbox")).rejects.toThrow(
      /disallowed IP/,
    );
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("allows a literal public IP host", async () => {
    await expect(
      assertPublicHttpsUrl("https://93.184.216.34/inbox"),
    ).resolves.toBeUndefined();
  });

  // Regression: new URL() canonicalizes v4-mapped/-compatible IPv6 literals into
  // hextet form (e.g. [::ffff:127.0.0.1] -> [::ffff:7f00:1]). A string-prefix
  // check misses these; the embedded IPv4 address must still be blocked.
  it.each([
    ["https://[::ffff:127.0.0.1]/inbox", "v4-mapped loopback"],
    ["https://[::ffff:169.254.169.254]/inbox", "v4-mapped metadata"],
    ["https://[::ffff:10.0.0.1]/inbox", "v4-mapped private"],
    ["https://[::127.0.0.1]/inbox", "v4-compatible loopback"],
    ["https://[::169.254.169.254]/inbox", "v4-compatible metadata"],
    ["https://[fec0::1]/inbox", "site-local fec0::/10"],
    ["https://[64:ff9b::7f00:1]/inbox", "NAT64 loopback"],
    ["https://[64:ff9b::a9fe:a9fe]/inbox", "NAT64 metadata"],
  ])("rejects literal IPv6 SSRF bypass %s (%s)", async (url) => {
    await expect(assertPublicHttpsUrl(url)).rejects.toThrow(/disallowed IP/);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("allows a literal public IPv6 host", async () => {
    await expect(
      assertPublicHttpsUrl("https://[2606:4700::1111]/inbox"),
    ).resolves.toBeUndefined();
  });

  it("allows a full-form (no ::) public IPv6 host", async () => {
    // A full 8-hextet address with no compressible zero run: new URL() keeps it
    // in expanded form, exercising the no-"::" expansion path.
    await expect(
      assertPublicHttpsUrl("https://[2606:4700:1:2:3:4:5:6]/inbox"),
    ).resolves.toBeUndefined();
  });

  it("rejects a full-form (no ::) link-local IPv6 literal", async () => {
    // fe80:… stays expanded (no long zero run to compress) and is link-local.
    await expect(
      assertPublicHttpsUrl("https://[fe80:1:2:3:4:5:6:7]/inbox"),
    ).rejects.toThrow(/disallowed IP/);
  });

  it("throws when the host resolves to no addresses", async () => {
    mockLookup.mockResolvedValue([]);
    await expect(
      assertPublicHttpsUrl("https://ghost.example.com"),
    ).rejects.toThrow(/Could not resolve host/);
  });
});

describe("guardedLookup (connect-time SSRF re-check)", () => {
  beforeEach(() => {
    mockLookupCb.mockReset();
  });

  it("passes through when the resolved address is public", (done) => {
    mockLookupCb.mockImplementation((_host, _opts, cb) =>
      cb(null, "93.184.216.34", 4),
    );
    guardedLookup("example.com", {}, (err, address, family) => {
      expect(err).toBeNull();
      expect(address).toBe("93.184.216.34");
      expect(family).toBe(4);
      done();
    });
  });

  it("errors when the resolved address is a blocked private IP (rebinding)", (done) => {
    mockLookupCb.mockImplementation((_host, _opts, cb) =>
      cb(null, "169.254.169.254", 4),
    );
    guardedLookup("evil.example", {}, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/disallowed address/);
      done();
    });
  });

  it("errors when any address in the all:true array is blocked", (done) => {
    mockLookupCb.mockImplementation((_host, _opts, cb) =>
      cb(null, [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.5", family: 4 },
      ]),
    );
    guardedLookup("evil.example", { all: true }, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/disallowed address/);
      done();
    });
  });

  it("passes through when the resolved value is not an IP literal (family 0)", (done) => {
    // A non-IP address string yields isIP() === 0, which isBlockedAddress
    // treats as not-blocked; guardedLookup must forward it unchanged.
    mockLookupCb.mockImplementation((_host, _opts, cb) =>
      cb(null, "not-an-ip", 0),
    );
    guardedLookup("weird.example", {}, (err, address, family) => {
      expect(err).toBeNull();
      expect(address).toBe("not-an-ip");
      expect(family).toBe(0);
      done();
    });
  });

  it("propagates an underlying DNS error unchanged", (done) => {
    const dnsErr = new Error("ENOTFOUND");
    mockLookupCb.mockImplementation((_host, _opts, cb) => cb(dnsErr));
    guardedLookup("missing.example", {}, (err) => {
      expect(err).toBe(dnsErr);
      done();
    });
  });

  it("exposes a guarded https.Agent", () => {
    expect(guardedHttpsAgent).toBeInstanceOf(HttpsAgent);
  });
});

// ─── Internal parsing guards ──────────────────────────────────────────────────
// These defensive null-guards are unreachable through the public API because
// isIP() pre-validates every address, so they are exercised directly.
describe("ap-url-guard internal guards", () => {
  const {
    ipv4ToOctets,
    isBlockedIpv4,
    expandIpv6ToHextets,
    isBlockedIpv6,
    isBlockedAddress,
  } = __testables;

  describe("ipv4ToOctets", () => {
    it("returns null when the dotted quad has the wrong part count", () => {
      expect(ipv4ToOctets("1.2.3")).toBeNull();
      expect(ipv4ToOctets("1.2.3.4.5")).toBeNull();
    });

    it("returns null for out-of-range or non-integer octets", () => {
      expect(ipv4ToOctets("1.2.3.999")).toBeNull();
      expect(ipv4ToOctets("1.2.3.-1")).toBeNull();
      expect(ipv4ToOctets("1.2.3.x")).toBeNull();
    });

    it("returns the octets for a well-formed address", () => {
      expect(ipv4ToOctets("10.0.0.1")).toEqual([10, 0, 0, 1]);
    });
  });

  describe("isBlockedIpv4", () => {
    it("treats an unparseable address as not blocked", () => {
      expect(isBlockedIpv4("nonsense")).toBe(false);
    });
  });

  describe("expandIpv6ToHextets", () => {
    it("returns null when an embedded dotted-quad is malformed", () => {
      expect(expandIpv6ToHextets("::ffff:1.2.3")).toBeNull();
    });

    it("returns null for a full-form address without 8 hextets", () => {
      expect(expandIpv6ToHextets("1:2:3:4:5:6:7")).toBeNull();
    });

    it("returns null when compressed form has too many hextets", () => {
      expect(expandIpv6ToHextets("1:2:3:4:5:6:7:8::9")).toBeNull();
    });

    it("returns null for an out-of-range hextet", () => {
      expect(expandIpv6ToHextets("1:2:3:4:5:6:7:fffff")).toBeNull();
    });

    it("expands an embedded dotted-quad tail", () => {
      expect(expandIpv6ToHextets("::ffff:127.0.0.1")).toEqual([
        0, 0, 0, 0, 0, 0xffff, 0x7f00, 1,
      ]);
    });

    it("expands a compressed address with head and tail parts", () => {
      expect(expandIpv6ToHextets("2606:4700::1111")).toEqual([
        0x2606, 0x4700, 0, 0, 0, 0, 0, 0x1111,
      ]);
    });

    it("expands an address with an empty tail (trailing ::)", () => {
      expect(expandIpv6ToHextets("2606:4700::")).toEqual([
        0x2606, 0x4700, 0, 0, 0, 0, 0, 0,
      ]);
    });

    it("expands an address with an empty head (leading ::)", () => {
      expect(expandIpv6ToHextets("::2606:4700")).toEqual([
        0, 0, 0, 0, 0, 0, 0x2606, 0x4700,
      ]);
    });
  });

  describe("isBlockedIpv6", () => {
    it("treats an unparseable address as not blocked", () => {
      expect(isBlockedIpv6("1:2:3")).toBe(false);
    });

    it("blocks v4-compatible embedded private addresses", () => {
      expect(isBlockedIpv6("::10.0.0.1")).toBe(true);
    });
  });

  describe("isBlockedAddress", () => {
    it("returns false for a non-IP string (family 0)", () => {
      expect(isBlockedAddress("not-an-ip")).toBe(false);
    });
  });
});
