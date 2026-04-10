export type SupportedCurrency = 'USD' | 'GBP' | 'EUR';

export type PlanId = 'free' | 'business' | 'enterprise';

export type CurrencySource = 'override' | 'ip' | 'default';

export interface PlanDTO {
  id: PlanId;
  active: boolean;
  recommended: boolean;
  title: string;
  amount: number | null;
  amountYearly: number | null;
  amountLabel: string;
  description: string;
  buttonText: string;
  buttonSrc: string;
  includes: string[];
}

export interface PricingResponse {
  currency: SupportedCurrency;
  currencySymbol: string;
  source: CurrencySource;
  plans: PlanDTO[];
}
