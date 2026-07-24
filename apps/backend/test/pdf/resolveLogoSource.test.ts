import { isPrivateAddress } from "../../../../packages/lib/src/pdf/resolveLogoSource";

// Security boundary for the PDF logo fetch (SSRF guard). The address passed to
// isPrivateAddress always comes from dns.lookup or a validated URL host, so it
// is a valid IPv4/IPv6 literal here.
describe("resolveLogoSource isPrivateAddress (SSRF guard)", () => {
  describe("IPv4", () => {
    it.each([
      ["10.0.0.1", true],
      ["127.0.0.1", true],
      ["0.0.0.0", true],
      ["172.16.0.1", true],
      ["172.31.255.255", true],
      ["192.168.1.1", true],
      ["169.254.169.254", true], // cloud metadata
      ["100.64.0.1", true], // CGNAT
      ["198.18.0.1", true], // benchmarking
      ["8.8.8.8", false],
      ["1.1.1.1", false],
      ["172.32.0.1", false], // just outside the private /12
      ["93.184.216.34", false],
    ])("classifies %s as private=%s", (address, expected) => {
      expect(isPrivateAddress(address)).toBe(expected);
    });
  });

  describe("IPv6 default-deny", () => {
    it.each([
      // The NAT64 bypass this guard was hardened against: a hostile AAAA record
      // pointing at 64:ff9b::<metadata> must be rejected.
      ["64:ff9b::a9fe:a9fe", true], // NAT64 -> 169.254.169.254
      ["64:ff9b::808:808", true], // NAT64 (not global unicast either)
      ["::1", true], // loopback
      ["::", true], // unspecified
      ["fc00::1", true], // ULA
      ["fd12:3456::1", true], // ULA
      ["fe80::1", true], // link-local
      ["::ffff:127.0.0.1", true], // v4-mapped loopback
      ["::ffff:169.254.169.254", true], // v4-mapped metadata
      ["::ffff:8.8.8.8", true], // v4-mapped public (denied: not global unicast)
      ["::127.0.0.1", true], // v4-compatible loopback
      ["2002:7f00:1::", true], // 6to4 wrapping 127.0.0.1
      ["2002:a9fe:a9fe::", true], // 6to4 wrapping 169.254.169.254
      ["2001:0:0:0:0:0:f5ff:fffe", true], // Teredo client 10.0.0.1 (XOR 0xff)
      // Genuine global-unicast public addresses must still be allowed.
      ["2002:808:808::", false], // 6to4 wrapping 8.8.8.8 (public)
      ["2606:4700:4700::1111", false], // Cloudflare
      ["2001:4860:4860::8888", false], // Google DNS (2001:4860, not Teredo)
      ["2a00:1450:4009::200e", false], // Google
    ])("classifies %s as private=%s", (address, expected) => {
      expect(isPrivateAddress(address)).toBe(expected);
    });

    it("fails closed on an unparseable address", () => {
      expect(isPrivateAddress("not-an-address")).toBe(true);
      expect(isPrivateAddress("2001::gggg")).toBe(true);
    });
  });
});
