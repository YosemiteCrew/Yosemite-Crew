import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import OrganizationModel from "src/models/organization";
import { OrgBilling } from "src/models/organization.billing";

type OrgId = string | { toString(): string } | null | undefined;

const DEFAULT_CURRENCY = "usd";

// ISO-3166 alpha-2 country -> ISO-4217 currency (lowercased, matching Stripe's
// lowercase convention used throughout billing). Used as a fallback when an
// OrganizationBilling row hasn't been created yet (e.g. before Stripe Connect
// onboarding) so invoices default to the org's local currency instead of USD.
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "usd",
  GB: "gbp",
  IN: "inr",
  AU: "aud",
  CA: "cad",
  NZ: "nzd",
  // Eurozone members
  AT: "eur",
  BE: "eur",
  CY: "eur",
  DE: "eur",
  EE: "eur",
  ES: "eur",
  FI: "eur",
  FR: "eur",
  GR: "eur",
  HR: "eur",
  IE: "eur",
  IT: "eur",
  LT: "eur",
  LU: "eur",
  LV: "eur",
  MT: "eur",
  NL: "eur",
  PT: "eur",
  SI: "eur",
  SK: "eur",
};

export const currencyForCountry = (
  country: string | null | undefined,
): string | undefined => {
  if (!country) return undefined;
  return COUNTRY_TO_CURRENCY[country.trim().toUpperCase()];
};

const resolveOrgCountryCurrency = async (id: string): Promise<string> => {
  if (isReadFromPostgres()) {
    const address = await prisma.organizationAddress.findUnique({
      where: { organizationId: id },
      select: { country: true },
    });
    return currencyForCountry(address?.country) ?? DEFAULT_CURRENCY;
  }

  const org = await OrganizationModel.findById(id).select("address.country");
  return currencyForCountry(org?.address?.country) ?? DEFAULT_CURRENCY;
};

export const getOrgBillingCurrency = async (orgId: OrgId) => {
  if (!orgId) return DEFAULT_CURRENCY;

  const id = typeof orgId === "string" ? orgId : orgId.toString();

  if (isReadFromPostgres()) {
    const billing = await prisma.organizationBilling.findUnique({
      where: { orgId: id },
      select: { currency: true },
    });
    // OrganizationBilling.currency (set from Stripe Connect) is the first
    // preference; fall back to the org's country, then "usd" as a last resort.
    return billing?.currency ?? (await resolveOrgCountryCurrency(id));
  }

  const billing = await OrgBilling.findOne({
    orgId,
  });
  return billing?.currency ?? (await resolveOrgCountryCurrency(id));
};
