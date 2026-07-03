import {
  currencyForCountry,
  getOrgBillingCurrency,
} from "../../src/utils/billing";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import OrganizationModel from "src/models/organization";
import { OrgBilling } from "src/models/organization.billing";

jest.mock("src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    organizationBilling: { findUnique: jest.fn() },
    organizationAddress: { findUnique: jest.fn() },
  },
}));

jest.mock("src/models/organization", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock("src/models/organization.billing", () => ({
  __esModule: true,
  OrgBilling: { findOne: jest.fn() },
}));

const mockSelectChain = (result: unknown) => ({
  select: jest.fn().mockResolvedValue(result),
});

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

describe("getOrgBillingCurrency (Postgres read path)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (isReadFromPostgres as jest.Mock).mockReturnValue(true);
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

describe("getOrgBillingCurrency (Mongo read path)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (isReadFromPostgres as jest.Mock).mockReturnValue(false);
  });

  it("prefers the OrgBilling currency over the country fallback", async () => {
    (OrgBilling.findOne as jest.Mock).mockResolvedValue({ currency: "aud" });

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("aud");
    expect(OrganizationModel.findById).not.toHaveBeenCalled();
  });

  it("falls back to the org country currency when no billing doc exists", async () => {
    (OrgBilling.findOne as jest.Mock).mockResolvedValue(null);
    (OrganizationModel.findById as jest.Mock).mockReturnValue(
      mockSelectChain({ address: { country: "GB" } }),
    );

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("gbp");
  });

  it("defaults to usd when the org country is unknown", async () => {
    (OrgBilling.findOne as jest.Mock).mockResolvedValue(null);
    (OrganizationModel.findById as jest.Mock).mockReturnValue(
      mockSelectChain({ address: { country: "ZZ" } }),
    );

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("usd");
  });

  it("defaults to usd when the org has no address", async () => {
    (OrgBilling.findOne as jest.Mock).mockResolvedValue(null);
    (OrganizationModel.findById as jest.Mock).mockReturnValue(
      mockSelectChain(null),
    );

    await expect(getOrgBillingCurrency("org_1")).resolves.toBe("usd");
  });
});
