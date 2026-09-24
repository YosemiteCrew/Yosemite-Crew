import {
  currencyForCountry,
  getOrgBillingCurrency,
  orgBillingCurrency,
  requireCurrency,
  resolveOrgDocumentCurrency,
} from "../../src/utils/billing";
import { prisma } from "src/config/prisma";
import fs from "node:fs";
import path from "node:path";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organizationBilling: { findUnique: jest.fn() },
    organizationAddress: { findUnique: jest.fn() },
  },
}));

describe("currencyForCountry", () => {
  it("maps known countries to their ISO-4217 currency (lowercased)", () => {
    expect(currencyForCountry("US")).toBe("usd");
    expect(currencyForCountry("GB")).toBe("gbp");
    expect(currencyForCountry("IN")).toBe("inr");
    expect(currencyForCountry("AU")).toBe("aud");
    expect(currencyForCountry("CA")).toBe("cad");
    expect(currencyForCountry("NZ")).toBe("nzd");
  });

  it("maps eurozone members to eur", () => {
    expect(currencyForCountry("DE")).toBe("eur");
    expect(currencyForCountry("FR")).toBe("eur");
    expect(currencyForCountry("ES")).toBe("eur");
    expect(currencyForCountry("IT")).toBe("eur");
    expect(currencyForCountry("NL")).toBe("eur");
    expect(currencyForCountry("IE")).toBe("eur");
    expect(currencyForCountry("PT")).toBe("eur");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(currencyForCountry(" gb ")).toBe("gbp");
    expect(currencyForCountry("de")).toBe("eur");
  });

  // OrganizationAddress.country holds the English name on every web write
  // path (onboarding, the address search, the profile), so an ISO-only lookup
  // never matched and every clinic without Connect fell through to usd.
  it("maps the country names the web app stores", () => {
    expect(currencyForCountry("United Kingdom")).toBe("gbp");
    expect(currencyForCountry("Germany")).toBe("eur");
    expect(currencyForCountry("India")).toBe("inr");
    expect(currencyForCountry("United States")).toBe("usd");
    expect(currencyForCountry(" united kingdom ")).toBe("gbp");
  });

  it("returns undefined for a name it has no currency for", () => {
    expect(currencyForCountry("Switzerland")).toBeUndefined();
    expect(currencyForCountry("Narnia")).toBeUndefined();
  });

  // The names are derived from the runtime's region names, not typed by hand,
  // so pin them to the list the web app actually writes from: every entry must
  // resolve by name exactly as it does by code.
  it("resolves every country in the web app's list by name as by code", () => {
    const countries = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../../../frontend/src/app/lib/data/countryList.json",
        ),
        "utf8",
      ),
    ) as { name: string; code: string }[];

    const mismatches = countries.filter(
      ({ name, code }) => currencyForCountry(name) !== currencyForCountry(code),
    );
    const priced = countries.filter(({ name }) => currencyForCountry(name));

    expect(mismatches).toEqual([]);
    expect(priced).toHaveLength(26);
  });

  it("returns undefined for unknown or missing countries", () => {
    expect(currencyForCountry("ZZ")).toBeUndefined();
    expect(currencyForCountry("")).toBeUndefined();
    expect(currencyForCountry(null)).toBeUndefined();
    expect(currencyForCountry(undefined)).toBeUndefined();
  });
});

describe("getOrgBillingCurrency", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns usd for a missing org id without hitting the database", async () => {
    await expect(getOrgBillingCurrency(null)).resolves.toBe("usd");
    expect(prisma.organizationBilling.findUnique).not.toHaveBeenCalled();
  });

  it("prefers the Connect currency once the account can take charges", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "gbp",
      connectChargesEnabled: true,
    });

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("gbp");
    expect(prisma.organizationBilling.findUnique).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      select: { currency: true, connectChargesEnabled: true },
    });
    expect(prisma.organizationAddress.findUnique).not.toHaveBeenCalled();
  });

  // Every organisation gets a billing row at creation, and a Connect account
  // id is stored before onboarding, so the column can still hold its schema
  // default "usd" with an account attached. Reading it labelled a UK clinic
  // as USD (#3607); the stored country name decides until charges are on.
  it("ignores the billing currency until the Connect account can take charges", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "usd",
      connectChargesEnabled: false,
    });
    (prisma.organizationAddress.findUnique as jest.Mock).mockResolvedValue({
      country: "United Kingdom",
    });

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("gbp");
  });

  it("falls back to the org country currency when no billing row exists", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.organizationAddress.findUnique as jest.Mock).mockResolvedValue({
      country: "India",
    });

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("inr");
    expect(prisma.organizationAddress.findUnique).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      select: { country: true },
    });
  });

  it("defaults to usd when neither billing nor a known country is available", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.organizationAddress.findUnique as jest.Mock).mockResolvedValue({
      country: "ZZ",
    });

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("usd");
  });

  it("defaults to usd when there is no address row at all", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.organizationAddress.findUnique as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("usd");
  });
});

describe("orgBillingCurrency", () => {
  it("uses the billing row's currency once Connect can take charges", () => {
    expect(
      orgBillingCurrency(
        { currency: "eur", connectChargesEnabled: true },
        "United Kingdom",
      ),
    ).toBe("eur");
  });

  it("uses the country's currency until then, whatever the column says", () => {
    expect(
      orgBillingCurrency(
        { currency: "usd", connectChargesEnabled: false },
        "IN",
      ),
    ).toBe("inr");
    expect(orgBillingCurrency(null, "Australia")).toBe("aud");
  });

  it("defaults to usd when neither source can answer", () => {
    expect(orgBillingCurrency(undefined, null)).toBe("usd");
  });
});

describe("resolveOrgDocumentCurrency", () => {
  const reject = (message: string): never => {
    throw new Error(message);
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.organizationAddress.findUnique as jest.Mock).mockResolvedValue({
      country: "Germany",
    });
  });

  it("answers the organisation's billing currency in upper case when none is sent", async () => {
    await expect(
      resolveOrgDocumentCurrency("org_1", undefined, reject),
    ).resolves.toBe("EUR");
  });

  it("accepts the organisation's own currency whatever its case or padding", async () => {
    await expect(
      resolveOrgDocumentCurrency("org_1", " eur ", reject),
    ).resolves.toBe("EUR");
  });

  it("refuses any other currency and names the one it expects", async () => {
    await expect(
      resolveOrgDocumentCurrency("org_1", "USD", reject),
    ).rejects.toThrow(
      "Currency must be the organisation's billing currency, EUR.",
    );
  });
});

describe("requireCurrency", () => {
  const reject = (message: string): never => {
    throw new Error(message);
  };

  it("answers the fixed currency in upper case when none is sent", () => {
    expect(requireCurrency("gbp", undefined, reject, "the invoice's")).toBe(
      "GBP",
    );
  });

  it("accepts the same currency whatever its case or padding", () => {
    expect(requireCurrency("GBP", " gbp ", reject, "the invoice's")).toBe(
      "GBP",
    );
  });

  it("refuses any other currency and names whose it expects", () => {
    expect(() =>
      requireCurrency("gbp", "EUR", reject, "the invoice's"),
    ).toThrow("Currency must be the invoice's currency, GBP.");
  });
});
