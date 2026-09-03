import { REGULATORY_AUTHORITY_SEED } from "src/scripts/regulatory-authority-seed.data";

/*
 * These values ARE the feature. A wrong address here does not throw - it sends
 * a pet owner to a mailbox that does not exist, or dials a mangled number, and
 * nothing surfaces the failure. Three of the five rows that were already in
 * this table had exactly that shape of error (an underscore in
 * vet_safety@hpra.ie, a guessed pharmacovigilance@vmd.gov.uk), which is why
 * the data is guarded rather than trusted.
 */
describe("REGULATORY_AUTHORITY_SEED", () => {
  it("covers every country the mobile reporting flow offers", () => {
    const expected = [
      "AR",
      "AU",
      "CA",
      "DE",
      "DK",
      "ES",
      "FR",
      "GB",
      "IE",
      "IT",
      "JP",
      "KR",
      "MX",
      "NL",
      "NZ",
      "SE",
      "SG",
      "US",
    ];
    const actual = REGULATORY_AUTHORITY_SEED.map((a) => a.iso2).sort((a, b) =>
      a.localeCompare(b),
    );
    expect(actual).toEqual(expected);
  });

  it("has one entry per country", () => {
    const codes = REGULATORY_AUTHORITY_SEED.map((a) => a.iso2);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("names an authority and cites a source for every country", () => {
    for (const authority of REGULATORY_AUTHORITY_SEED) {
      expect(authority.authorityName.trim().length).toBeGreaterThan(3);
      expect(authority.notes.trim().length).toBeGreaterThan(10);
      expect(authority.sourceUrl).toMatch(/^https?:\/\//);
    }
  });

  /*
   * The mobile dialer normalises with `phone.replaceAll(/[^\d+]/g, '')`, so a
   * value carrying an extension, a second number or a parenthetical is silently
   * concatenated into an unreachable string - "0800 008 333 (overseas +64 4 830
   * 1574)" dials "0800008333+6448301574". One number per row, no exceptions.
   */
  it("stores exactly one dialable number per country", () => {
    for (const authority of REGULATORY_AUTHORITY_SEED) {
      expect(authority.phone).toBeTruthy();
      const phone = authority.phone as string;
      expect(phone).not.toMatch(/[(),;]|ext|int\.|\bor\b/i);
      // A leading + is allowed; any other + means two numbers were merged.
      expect(phone.slice(1)).not.toContain("+");
      const dialled = phone.replaceAll(/[^\d+]/g, "");
      expect(dialled.length).toBeGreaterThanOrEqual(7);
      expect(dialled.length).toBeLessThanOrEqual(16);
    }
  });

  it("stores a real address or nothing, never a placeholder", () => {
    for (const authority of REGULATORY_AUTHORITY_SEED) {
      if (authority.email !== null) {
        expect(authority.email).toMatch(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i);
        expect(authority.email).not.toMatch(/example|test|your|todo|tbd/i);
      }
      if (authority.website !== null) {
        expect(authority.website).toMatch(/^https?:\/\//);
      }
      // A row with neither is useless to a reporter.
      expect(authority.email ?? authority.website).toBeTruthy();
    }
  });

  /*
   * Regression guard for the two addresses that were wrong in the table before
   * this seed. Both are one character or one word away from the real thing,
   * which is exactly why they survived: they look right.
   */
  it("uses the verified UK and Ireland addresses, not the plausible ones", () => {
    const gb = REGULATORY_AUTHORITY_SEED.find((a) => a.iso2 === "GB");
    const ie = REGULATORY_AUTHORITY_SEED.find((a) => a.iso2 === "IE");
    expect(gb?.email).toBe("adverse.events@vmd.gov.uk");
    expect(ie?.email).toBe("vetsafety@hpra.ie");
  });

  it("records where an owner may not report directly", () => {
    // Argentina restricts reporting to veterinary professionals by regulation,
    // and Singapore does not accept third-party submission. A reporter in
    // either country must not be told to just send it.
    for (const iso2 of ["AR", "SG"]) {
      const entry = REGULATORY_AUTHORITY_SEED.find((a) => a.iso2 === iso2);
      expect(entry?.notes.toLowerCase()).toMatch(
        /veterinar|not documented|professional|owner/,
      );
    }
  });
});
