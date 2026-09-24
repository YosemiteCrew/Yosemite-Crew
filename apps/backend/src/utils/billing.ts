import { prisma } from "src/config/prisma";

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

type BillingCurrencySource = {
  currency: string;
  connectAccountId: string | null;
};

/**
 * The organisation's billing currency from rows already in hand.
 *
 * `OrganizationBilling.currency` is written only by the Stripe Connect
 * `account.updated` webhook. Until an organisation has a Connect account the
 * column holds its schema default, "usd", which states nothing about the
 * clinic; reading it then labelled every clinic without Connect as billing in
 * dollars (#3607). So the column counts only once a Connect account exists,
 * and the organisation's country decides before that.
 */
export const orgBillingCurrency = (
  billing: BillingCurrencySource | null | undefined,
  country: string | null | undefined,
): string =>
  billing?.connectAccountId
    ? billing.currency
    : (currencyForCountry(country) ?? DEFAULT_CURRENCY);

export const getOrgBillingCurrency = async (orgId: OrgId) => {
  if (!orgId) return DEFAULT_CURRENCY;

  const id = typeof orgId === "string" ? orgId : orgId.toString();

  const billing = await prisma.organizationBilling.findUnique({
    where: { orgId: id },
    select: { currency: true, connectAccountId: true },
  });
  // The address is only read when the billing row cannot answer.
  const address = billing?.connectAccountId
    ? null
    : await prisma.organizationAddress.findUnique({
        where: { organizationId: id },
        select: { country: true },
      });
  return orgBillingCurrency(billing, address?.country);
};

/**
 * The currency an estimate or insurance claim is written in: the
 * organisation's billing currency, as an upper-case ISO 4217 code.
 *
 * A caller may send a currency, but only the organisation's own. An estimate
 * converts into an invoice and a claim reclaims one, and invoices are always
 * raised in the billing currency, so a different code can only be a stale or
 * guessed client value - the one that stamped USD on every claim (#3607).
 */
export const resolveOrgDocumentCurrency = async (
  orgId: string,
  requested: string | undefined,
  reject: (message: string) => never,
): Promise<string> => {
  const billingCurrency = (await getOrgBillingCurrency(orgId)).toUpperCase();
  if (
    requested !== undefined &&
    requested.trim().toUpperCase() !== billingCurrency
  ) {
    reject(
      `Currency must be the organisation's billing currency, ${billingCurrency}.`,
    );
  }
  return billingCurrency;
};
