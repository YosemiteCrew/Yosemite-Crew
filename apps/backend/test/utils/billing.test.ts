import {
  currencyForCountry,
  getOrgBillingCurrency,
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

  it("prefers the OrganizationBilling currency over the country fallback", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "gbp",
    });

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("gbp");
    expect(prisma.organizationAddress.findUnique).not.toHaveBeenCalled();
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
