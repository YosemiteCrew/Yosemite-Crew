import Stripe from "stripe";
import {
  Prisma,
  TaxBehavior as PrismaTaxBehavior,
  TaxProvider as PrismaTaxProvider,
} from "@prisma/client";
import {
  fromStripeMinorUnits,
  toStripeMinorUnits,
} from "src/utils/stripe-minor-units";

import type { InvoiceDiscountInput, InvoicePricingBreakdown } from "./pricing";
import { roundMoney } from "./pricing";

export type InvoiceTaxSnapshotInput = {
  provider: PrismaTaxProvider;
  providerReferenceId?: string | null;
  jurisdictionCountry?: string | null;
  jurisdictionState?: string | null;
  taxBehavior?: PrismaTaxBehavior | null;
  taxableSubtotal: number;
  taxAmount: number;
  taxBreakdown: Prisma.InputJsonValue;
  rawProviderPayload: Prisma.InputJsonValue;
  calculatedAt: Date;
};

export const DEFAULT_TAX_PROVIDER: PrismaTaxProvider = PrismaTaxProvider.STRIPE;

export const DEFAULT_TAX_BEHAVIOR: PrismaTaxBehavior = "EXCLUSIVE";

export const resolveConfiguredTaxProvider = (
  provider?: string | null,
): PrismaTaxProvider => {
  const normalized = provider?.trim().toUpperCase();
  if (normalized === PrismaTaxProvider.STRIPE) {
    return PrismaTaxProvider.STRIPE;
  }

  return DEFAULT_TAX_PROVIDER;
};

type TaxSnapshotMode = "preview" | "finalize";

export type InvoiceTaxProviderInput = {
  provider?: PrismaTaxProvider | null;
  taxBehavior?: PrismaTaxBehavior | null;
  taxRatePercent: number;
  currency: string;
  invoiceDiscount?: InvoiceDiscountInput;
  pricing: InvoicePricingBreakdown;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
  }>;
  customerAddress?: Stripe.AddressParam | null;
  liabilityAccountId?: string | null;
};

export interface InvoiceTaxProviderAdapter {
  provider: PrismaTaxProvider;
  preview(input: InvoiceTaxProviderInput): Promise<InvoiceTaxSnapshotInput>;
  finalize(input: InvoiceTaxProviderInput): Promise<InvoiceTaxSnapshotInput>;
}

type AutoTaxPreviewLineItem = {
  amount: number;
  description: string;
  currency: string;
  tax_behavior: "exclusive" | "inclusive";
};

const resolveStripeInvoiceIssuer = (
  liabilityAccountId?: string | null,
): Stripe.InvoiceCreatePreviewParams.Issuer => {
  if (liabilityAccountId) {
    return {
      type: "account",
      account: liabilityAccountId,
    };
  }

  return {
    type: "self",
  };
};

let stripeClient: Stripe | null = null;

export const __setFinanceTaxStripeClientForTests = (client: Stripe | null) => {
  stripeClient = client;
};

const getStripeClient = () => {
  if (stripeClient) return stripeClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  stripeClient = new Stripe(apiKey, { apiVersion: "2026-07-29.dahlia" });
  return stripeClient;
};

const buildFallbackInvoiceTaxSnapshot = (
  input: {
    provider?: PrismaTaxProvider | null;
    taxBehavior?: PrismaTaxBehavior | null;
    taxRatePercent: number;
    currency: string;
    invoiceDiscount?: InvoiceDiscountInput;
    mode: TaxSnapshotMode;
  },
  pricing: InvoicePricingBreakdown,
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
  }>,
): InvoiceTaxSnapshotInput => {
  const provider = input.provider ?? DEFAULT_TAX_PROVIDER;
  const taxBehavior = input.taxBehavior ?? DEFAULT_TAX_BEHAVIOR;

  return {
    provider,
    providerReferenceId: null,
    jurisdictionCountry: null,
    jurisdictionState: null,
    taxBehavior,
    taxableSubtotal: pricing.taxableSubtotal,
    taxAmount: pricing.taxTotal,
    taxBreakdown: {
      subtotal: pricing.subtotal,
      lineDiscountTotal: pricing.lineDiscountTotal,
      taxableSubtotal: pricing.taxableSubtotal,
      taxTotal: pricing.taxTotal,
      invoiceDiscountTotal: pricing.invoiceDiscountTotal,
      totalAmount: pricing.totalAmount,
      lines: pricing.lines,
      mode: input.mode,
    },
    rawProviderPayload: {
      provider,
      taxBehavior,
      taxRatePercent: input.taxRatePercent,
      currency: input.currency,
      invoiceDiscount: input.invoiceDiscount ?? null,
      lineItems,
      mode: input.mode,
      calculationMode: "fallback",
    },
    calculatedAt: new Date(),
  };
};

const allocateInvoiceDiscountAcrossLines = (
  netAmounts: number[],
  invoiceDiscountTotal: number,
  currency: string,
): number[] => {
  const lineBases = netAmounts.map((amount) => Math.max(0, roundMoney(amount)));
  const totalBaseMinorUnits = lineBases.reduce(
    (sum, amount) => sum + toStripeMinorUnits(amount, currency),
    0,
  );
  const totalDiscountMinorUnits = Math.min(
    toStripeMinorUnits(roundMoney(invoiceDiscountTotal), currency),
    totalBaseMinorUnits,
  );

  if (!totalBaseMinorUnits || !totalDiscountMinorUnits) {
    return lineBases.map(() => 0);
  }

  const allocations = lineBases.map((amount) => {
    const minorUnits = toStripeMinorUnits(amount, currency);
    return Math.floor(
      (minorUnits * totalDiscountMinorUnits) / totalBaseMinorUnits,
    );
  });

  const allocatedMinorUnits = allocations.reduce(
    (sum, amount) => sum + amount,
    0,
  );
  let remainder = totalDiscountMinorUnits - allocatedMinorUnits;

  for (let index = 0; remainder > 0 && index < allocations.length; index += 1) {
    const lineMinorUnits = toStripeMinorUnits(lineBases[index], currency);
    if (allocations[index] >= lineMinorUnits) {
      continue;
    }
    allocations[index] += 1;
    remainder -= 1;
  }

  if (remainder > 0) {
    for (
      let index = 0;
      remainder > 0 && index < allocations.length;
      index += 1
    ) {
      allocations[index] += 1;
      remainder -= 1;
    }
  }

  return allocations.map((amount) => fromStripeMinorUnits(amount, currency));
};

const buildAutomaticTaxLineItems = (
  pricing: InvoicePricingBreakdown,
  input: InvoiceTaxProviderInput,
): AutoTaxPreviewLineItem[] => {
  const netAmounts = pricing.lines.map((line) => line.netAmount);
  const invoiceDiscountAllocations = allocateInvoiceDiscountAcrossLines(
    netAmounts,
    pricing.invoiceDiscountTotal,
    input.currency,
  );

  return pricing.lines.map((line, index) => {
    const discountedAmount = roundMoney(
      Math.max(0, line.netAmount - (invoiceDiscountAllocations[index] ?? 0)),
    );

    return {
      amount: toStripeMinorUnits(discountedAmount, input.currency),
      description: input.lineItems[index]?.description ?? `Line ${index + 1}`,
      currency: input.currency,
      tax_behavior:
        (input.taxBehavior ?? DEFAULT_TAX_BEHAVIOR) === "INCLUSIVE"
          ? "inclusive"
          : "exclusive",
    };
  });
};

const buildAutomaticTaxSnapshot = async (
  input: {
    provider?: PrismaTaxProvider | null;
    taxBehavior?: PrismaTaxBehavior | null;
    taxRatePercent: number;
    currency: string;
    invoiceDiscount?: InvoiceDiscountInput;
    mode: TaxSnapshotMode;
    customerAddress?: Stripe.AddressParam | null;
    liabilityAccountId?: string | null;
  },
  pricing: InvoicePricingBreakdown,
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
  }>,
): Promise<InvoiceTaxSnapshotInput> => {
  const provider = input.provider ?? DEFAULT_TAX_PROVIDER;
  const taxBehavior = input.taxBehavior ?? DEFAULT_TAX_BEHAVIOR;

  if (!input.customerAddress) {
    return buildFallbackInvoiceTaxSnapshot(
      {
        provider,
        taxBehavior,
        taxRatePercent: input.taxRatePercent,
        currency: input.currency,
        invoiceDiscount: input.invoiceDiscount,
        mode: input.mode,
      },
      pricing,
      lineItems,
    );
  }

  const stripe = getStripeClient();
  const issuer = resolveStripeInvoiceIssuer(input.liabilityAccountId ?? null);
  const preview = await stripe.invoices.createPreview({
    currency: input.currency,
    issuer,
    automatic_tax: {
      enabled: true,
      liability: input.liabilityAccountId
        ? {
            type: "account",
            account: input.liabilityAccountId,
          }
        : {
            type: "self",
          },
    },
    customer_details: {
      address: input.customerAddress,
    },
    invoice_items: buildAutomaticTaxLineItems(pricing, {
      provider,
      taxBehavior,
      taxRatePercent: input.taxRatePercent,
      currency: input.currency,
      invoiceDiscount: input.invoiceDiscount,
      pricing,
      lineItems,
      customerAddress: input.customerAddress,
      liabilityAccountId: input.liabilityAccountId,
    }),
  });

  const totalTaxes = preview.total_taxes ?? [];
  const taxAmount = roundMoney(
    fromStripeMinorUnits(
      totalTaxes.reduce((sum, tax) => sum + tax.amount, 0),
      input.currency,
    ),
  );
  const taxableSubtotal = roundMoney(
    fromStripeMinorUnits(
      preview.total_excluding_tax ??
        toStripeMinorUnits(pricing.totalAmount, input.currency),
      input.currency,
    ),
  );
  const jurisdictionCountry = input.customerAddress?.country ?? null;
  const jurisdictionState = input.customerAddress?.state ?? null;

  return {
    provider,
    providerReferenceId: preview.id,
    jurisdictionCountry,
    jurisdictionState,
    taxBehavior,
    taxableSubtotal,
    taxAmount,
    taxBreakdown: {
      subtotal: pricing.subtotal,
      lineDiscountTotal: pricing.lineDiscountTotal,
      taxableSubtotal,
      taxTotal: taxAmount,
      invoiceDiscountTotal: pricing.invoiceDiscountTotal,
      totalAmount: roundMoney(taxableSubtotal + taxAmount),
      totalTaxes,
      invoicePreviewId: preview.id,
      automaticTax: preview.automatic_tax,
    } as unknown as Prisma.InputJsonValue,
    rawProviderPayload: {
      provider,
      taxBehavior,
      taxRatePercent: input.taxRatePercent,
      currency: input.currency,
      invoiceDiscount: input.invoiceDiscount ?? null,
      lineItems,
      mode: input.mode,
      issuer,
      previewId: preview.id,
      totalExcludingTax: preview.total_excluding_tax,
      totalTaxes,
      customerAddress: input.customerAddress,
      liabilityAccountId: input.liabilityAccountId ?? null,
    } as unknown as Prisma.InputJsonValue,
    calculatedAt: new Date(),
  };
};

const createStripeAutomaticTaxProviderAdapter =
  (): InvoiceTaxProviderAdapter => ({
    provider: DEFAULT_TAX_PROVIDER,
    preview: async (input) =>
      buildAutomaticTaxSnapshot(
        {
          provider: input.provider ?? DEFAULT_TAX_PROVIDER,
          taxBehavior: input.taxBehavior ?? DEFAULT_TAX_BEHAVIOR,
          taxRatePercent: input.taxRatePercent,
          currency: input.currency,
          invoiceDiscount: input.invoiceDiscount,
          mode: "preview",
          customerAddress: input.customerAddress ?? null,
          liabilityAccountId: input.liabilityAccountId ?? null,
        },
        input.pricing,
        input.lineItems,
      ),
    finalize: async (input) =>
      buildAutomaticTaxSnapshot(
        {
          provider: input.provider ?? DEFAULT_TAX_PROVIDER,
          taxBehavior: input.taxBehavior ?? DEFAULT_TAX_BEHAVIOR,
          taxRatePercent: input.taxRatePercent,
          currency: input.currency,
          invoiceDiscount: input.invoiceDiscount,
          mode: "finalize",
          customerAddress: input.customerAddress ?? null,
          liabilityAccountId: input.liabilityAccountId ?? null,
        },
        input.pricing,
        input.lineItems,
      ),
  });

const TAX_PROVIDER_ADAPTER_FACTORIES: Record<
  PrismaTaxProvider,
  () => InvoiceTaxProviderAdapter
> = {
  STRIPE: createStripeAutomaticTaxProviderAdapter,
};

export const getInvoiceTaxProviderAdapter = (
  provider?: string | null,
): InvoiceTaxProviderAdapter =>
  TAX_PROVIDER_ADAPTER_FACTORIES[resolveConfiguredTaxProvider(provider)]();

export const previewInvoiceTaxSnapshot = async (
  provider: string | null | undefined,
  input: InvoiceTaxProviderInput,
): Promise<InvoiceTaxSnapshotInput> =>
  getInvoiceTaxProviderAdapter(provider).preview({
    ...input,
    provider: resolveConfiguredTaxProvider(provider),
  });

export const finalizeInvoiceTaxSnapshot = async (
  provider: string | null | undefined,
  input: InvoiceTaxProviderInput,
): Promise<InvoiceTaxSnapshotInput> =>
  getInvoiceTaxProviderAdapter(provider).finalize({
    ...input,
    provider: resolveConfiguredTaxProvider(provider),
  });
