import { prisma } from "src/config/prisma";

type OrgId = string | { toString(): string } | null | undefined;

const DEFAULT_CURRENCY = "usd";

// ISO-3166 alpha-2 country -> ISO-4217 currency (lowercased, matching Stripe's
// lowercase convention used throughout billing). Used until Stripe Connect
// confirms the account's currency (see `orgBillingCurrency`), so documents
// default to the org's local currency instead of USD.
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

// The web app stores `OrganizationAddress.country` as the English country
// name (onboarding, the address search and the profile all write the `name` of
// the same country list), not the ISO code the map above is keyed by. The
// names are taken from the runtime's own CLDR region names for exactly those
// codes, so no second hand-kept list can drift from the first; a test pins
// them to the names the web app writes.
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRY_CODE_BY_NAME = new Map(
  Object.keys(COUNTRY_TO_CURRENCY).map((code) => [
    (regionNames.of(code) ?? code).toUpperCase(),
    code,
  ]),
);

/** The currency for a stored country, given as an ISO alpha-2 code or a name. */
export const currencyForCountry = (
  country: string | null | undefined,
): string | undefined => {
  if (!country) return undefined;
  const key = country.trim().toUpperCase();
  return COUNTRY_TO_CURRENCY[COUNTRY_CODE_BY_NAME.get(key) ?? key];
};

type BillingCurrencySource = {
  currency: string;
  connectChargesEnabled: boolean;
};

/**
 * The organisation's billing currency from rows already in hand.
 *
 * `OrganizationBilling.currency` holds its schema default, "usd", until the
 * Stripe Connect `account.updated` webhook writes the account's
 * `default_currency`. Neither a billing row nor a Connect account id proves
 * that happened: every organisation gets the row at creation, and
 * `createOrGetConnectedAccount` stores the account id before onboarding
 * starts, while the account's details, and so its currency, are not settled.
 * The honest signal is `connectChargesEnabled`: the same webhook update writes
 * it alongside the currency, and it is true only once the account can take
 * charges, so its currency is the one Stripe settles in. Until then the
 * organisation's country decides, then "usd" (#3607).
 *
 * ponytail: if Stripe later disables charges, new documents fall back to the
 * country's currency until they are re-enabled; that is the same currency
 * unless the Stripe account is registered in another country. Add a
 * "Connect currency confirmed" column if that case matters.
 */
export const orgBillingCurrency = (
  billing: BillingCurrencySource | null | undefined,
  country: string | null | undefined,
): string =>
  billing?.connectChargesEnabled
    ? billing.currency
    : (currencyForCountry(country) ?? DEFAULT_CURRENCY);

export const getOrgBillingCurrency = async (orgId: OrgId) => {
  if (!orgId) return DEFAULT_CURRENCY;

  const id = typeof orgId === "string" ? orgId : orgId.toString();

  const billing = await prisma.organizationBilling.findUnique({
    where: { orgId: id },
    select: { currency: true, connectChargesEnabled: true },
  });
  // The address is only read when the billing row cannot answer.
  const address = billing?.connectChargesEnabled
    ? null
    : await prisma.organizationAddress.findUnique({
        where: { organizationId: id },
        select: { country: true },
      });
  return orgBillingCurrency(billing, address?.country);
};

/**
 * The currency a document is written in when it must match one already
 * fixed, as an upper-case ISO 4217 code. A caller may send a currency, but
 * only that same one (any case or padding); anything else is refused with the
 * code expected, because it can only be a stale or guessed client value.
 */
export const requireCurrency = (
  expected: string,
  requested: string | undefined,
  reject: (message: string) => never,
  owner: string,
): string => {
  const code = expected.toUpperCase();
  if (requested !== undefined && requested.trim().toUpperCase() !== code) {
    reject(`Currency must be ${owner} currency, ${code}.`);
  }
  return code;
};

/**
 * The currency a document that starts in the organisation's billing
 * currency is written in: a new estimate, which converts into an invoice in
 * that currency, and an insurance claim that reclaims no invoice. A claim
 * against an invoice follows that invoice instead, because invoices keep the
 * currency they were raised in. Sending another currency is refused; that
 * guessed client value stamped USD on every claim (#3607).
 */
export const resolveOrgDocumentCurrency = async (
  orgId: string,
  requested: string | undefined,
  reject: (message: string) => never,
): Promise<string> =>
  requireCurrency(
    await getOrgBillingCurrency(orgId),
    requested,
    reject,
    "the organisation's billing",
  );
