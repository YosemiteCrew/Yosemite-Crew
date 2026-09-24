import {
  currencyForCountry,
  getOrgBillingCurrency,
  orgBillingCurrency,
  resolveOrgDocumentCurrency,
} from "../../src/utils/billing";
import { prisma } from "src/config/prisma";

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

  it("prefers the Connect-written OrganizationBilling currency over the country", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "gbp",
      connectAccountId: "acct_1",
    });

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("gbp");
    expect(prisma.organizationBilling.findUnique).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      select: { currency: true, connectAccountId: true },
    });
    expect(prisma.organizationAddress.findUnique).not.toHaveBeenCalled();
  });

  // Every organisation gets a billing row at creation, so its currency column
  // holds the schema default "usd" until Stripe Connect writes a real one.
  // Reading that default labelled a UK clinic without Connect as USD (#3607).
  it("ignores the schema-default billing currency until a Connect account exists", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "usd",
      connectAccountId: null,
    });
    (prisma.organizationAddress.findUnique as jest.Mock).mockResolvedValue({
      country: "GB",
    });

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("gbp");
  });

  it("falls back to the org country currency when no billing row exists", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.organizationAddress.findUnique as jest.Mock).mockResolvedValue({
      country: "IN",
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
  it("uses the billing row's currency once a Connect account exists", () => {
    expect(
      orgBillingCurrency({ currency: "eur", connectAccountId: "acct_1" }, "GB"),
    ).toBe("eur");
  });

  it("uses the country's currency before Connect, whatever the column says", () => {
    expect(
      orgBillingCurrency({ currency: "usd", connectAccountId: null }, "IN"),
    ).toBe("inr");
    expect(orgBillingCurrency(null, "AU")).toBe("aud");
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
      country: "DE",
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
