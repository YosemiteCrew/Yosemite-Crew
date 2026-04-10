/**
 * Pricing constants — single source of truth for public plan pricing.
 *
 * All prices are stored as integer units of the display currency (not the
 * smallest sub-unit) to match the existing hardcoded `€10`, `$12`, `£10`
 * style on the marketing site. Actual Stripe billing uses its own `Price`
 * objects and is untouched by this module.
 */

export const SUPPORTED_CURRENCIES = new Set(["USD", "GBP", "EUR"] as const);
export type SupportedCurrency = "USD" | "GBP" | "EUR";

export const DEFAULT_CURRENCY: SupportedCurrency = "USD";

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
};

/**
 * ISO-3166 alpha-2 country code → preferred display currency.
 *
 * Only countries that unambiguously map to USD / GBP / EUR are listed.
 * Anything not in the map defaults to `DEFAULT_CURRENCY` (USD).
 */
export const COUNTRY_TO_CURRENCY: Readonly<Record<string, SupportedCurrency>> =
  Object.freeze({
    // United States + US territories
    US: "USD",
    UM: "USD",
    PR: "USD",
    GU: "USD",
    AS: "USD",
    VI: "USD",
    MP: "USD",

    // United Kingdom + Crown Dependencies
    GB: "GBP",
    IM: "GBP",
    JE: "GBP",
    GG: "GBP",

    // Eurozone members
    AT: "EUR",
    BE: "EUR",
    CY: "EUR",
    DE: "EUR",
    EE: "EUR",
    ES: "EUR",
    FI: "EUR",
    FR: "EUR",
    GR: "EUR",
    HR: "EUR",
    IE: "EUR",
    IT: "EUR",
    LT: "EUR",
    LU: "EUR",
    LV: "EUR",
    MT: "EUR",
    NL: "EUR",
    PT: "EUR",
    SI: "EUR",
    SK: "EUR",
    // Microstates + unilateral euro users
    AD: "EUR",
    MC: "EUR",
    SM: "EUR",
    VA: "EUR",
    ME: "EUR",
    XK: "EUR",
  });

export type PlanId = "free" | "business" | "enterprise";

export interface PlanDTO {
  id: PlanId;
  active: boolean;
  recommended: boolean;
  title: string;
  /** Numeric per-interval amount. `null` for "Coming soon" plans. */
  amount: number | null;
  amountYearly: number | null;
  amountLabel: string;
  description: string;
  buttonText: string;
  buttonSrc: string;
  includes: string[];
}

const COMMON_FEATURES = {
  SCHEDULER: "Yosemite Crew scheduler",
  TEMPLATES: "Templates module",
  DOC_SIGNING: "Document e-signing portal",
  IDEX_INTEGRATION: "IDEXX integration for lab tests and diagnostics",
  MERCK_INTEGRATION:
    "MSD Veterinary Manual integration for veterinary clinical knowledge",
  CHAT: "Internal + companion parent chat",
  SECURITY: "Security & compliance integrations (SOC2, ISO 27001, GDPR)",
} as const;

const FREE_INCLUDES: string[] = [
  "Free for individual usage",
  "120 appointments",
  "200 observational tools",
  COMMON_FEATURES.SCHEDULER,
  COMMON_FEATURES.TEMPLATES,
  COMMON_FEATURES.DOC_SIGNING,
  COMMON_FEATURES.IDEX_INTEGRATION,
  COMMON_FEATURES.MERCK_INTEGRATION,
  COMMON_FEATURES.CHAT,
  COMMON_FEATURES.SECURITY,
];

const BUSINESS_INCLUDES: string[] = [
  "Unlimited appointments",
  "Unlimited observational tools",
  COMMON_FEATURES.SCHEDULER,
  COMMON_FEATURES.TEMPLATES,
  COMMON_FEATURES.DOC_SIGNING,
  COMMON_FEATURES.IDEX_INTEGRATION,
  COMMON_FEATURES.MERCK_INTEGRATION,
  COMMON_FEATURES.CHAT,
  COMMON_FEATURES.SECURITY,
];

const ENTERPRISE_INCLUDES: string[] = [
  "Unlimited usage",
  "Unlimited appointments",
  "Unlimited observational tools",
  COMMON_FEATURES.SCHEDULER,
  COMMON_FEATURES.TEMPLATES,
  COMMON_FEATURES.DOC_SIGNING,
  COMMON_FEATURES.IDEX_INTEGRATION,
  COMMON_FEATURES.MERCK_INTEGRATION,
  COMMON_FEATURES.CHAT,
  COMMON_FEATURES.SECURITY,
];

type PlanPriceTable = Record<
  PlanId,
  { amount: number | null; amountYearly: number | null }
>;

const PRICE_TABLE: Record<SupportedCurrency, PlanPriceTable> = {
  USD: {
    free: { amount: 0, amountYearly: 0 },
    business: { amount: 13, amountYearly: 11 },
    enterprise: { amount: null, amountYearly: null },
  },
  GBP: {
    free: { amount: 0, amountYearly: 0 },
    business: { amount: 10, amountYearly: 8 },
    enterprise: { amount: null, amountYearly: null },
  },
  EUR: {
    free: { amount: 0, amountYearly: 0 },
    business: { amount: 12, amountYearly: 10 },
    enterprise: { amount: null, amountYearly: null },
  },
};

const buildPlansForCurrency = (currency: SupportedCurrency): PlanDTO[] => {
  const prices = PRICE_TABLE[currency];
  return [
    {
      id: "free",
      active: true,
      recommended: false,
      title: "Free plan",
      amount: prices.free.amount,
      amountYearly: prices.free.amountYearly,
      amountLabel: "",
      description:
        "Perfect for new or small pet businesses exploring on their own.",
      buttonText: "Get started",
      buttonSrc: "/signup",
      includes: FREE_INCLUDES,
    },
    {
      id: "business",
      active: true,
      recommended: true,
      title: "Business plan",
      amount: prices.business.amount,
      amountYearly: prices.business.amountYearly,
      amountLabel: "per user / month",
      description:
        "Flexible growth for pet businesses that need to scale on demand.",
      buttonText: "Get started",
      buttonSrc: "/signup",
      includes: BUSINESS_INCLUDES,
    },
    {
      id: "enterprise",
      active: false,
      recommended: false,
      title: "Enterprise plan",
      amount: prices.enterprise.amount,
      amountYearly: prices.enterprise.amountYearly,
      amountLabel: "",
      description:
        "For pet businesses to operate with scalability, control, and security.",
      buttonText: "Notify me",
      buttonSrc: "#",
      includes: ENTERPRISE_INCLUDES,
    },
  ];
};

export const PRICING_PLANS: Record<SupportedCurrency, PlanDTO[]> = {
  USD: buildPlansForCurrency("USD"),
  GBP: buildPlansForCurrency("GBP"),
  EUR: buildPlansForCurrency("EUR"),
};
