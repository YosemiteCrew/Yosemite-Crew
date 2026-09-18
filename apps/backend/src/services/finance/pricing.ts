import {
  fromLedgerMinorUnits,
  quantizeMoney,
  resolveLedgerExponent,
  toLedgerMinorUnits,
} from "./currency";

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export type TaxBehavior = "INCLUSIVE" | "EXCLUSIVE";

export type InvoicePricingLineInput = {
  quantity: number;
  unitAmount: number;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  taxBehavior?: TaxBehavior | null;
};

export type InvoiceDiscountInput = {
  type: DiscountType;
  value: number;
};

export type InvoicePricingInput = {
  lines: InvoicePricingLineInput[];
  taxRatePercent?: number | null;
  invoiceDiscount?: InvoiceDiscountInput | null;
  /**
   * Posted precision comes from this currency. Omitted, every amount is
   * quantized at the legacy two decimals, which is wrong for a zero- or
   * three-decimal currency; an unsupported code is rejected rather than
   * priced at another currency's precision.
   */
  currency?: string | null;
};

export type InvoicePricingLineBreakdown = {
  grossAmount: number;
  lineDiscountAmount: number;
  netAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export type InvoicePricingBreakdown = {
  subtotal: number;
  lineDiscountTotal: number;
  taxableSubtotal: number;
  taxTotal: number;
  invoiceDiscountTotal: number;
  totalAmount: number;
  lines: InvoicePricingLineBreakdown[];
};

const MONEY_SCALE = 100;

/**
 * Rounds at two decimals regardless of currency, on the float scaled by a
 * hundred. Left exactly as it was: the payment, tax and appointment callers
 * this slice does not cover round by it, and `creditNoteService` on the
 * frontend carries a copy that states it matches this one. Invoice pricing
 * rounds by `quantizeMoney` at the invoice currency's own precision instead,
 * which is exact and disagrees with this function wherever scaling the float
 * lands the tie on the wrong side (8.165 posts as 8.17 there, 8.16 here).
 */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;

export const getNetPaymentAmount = (payment: {
  amount: number;
  refunds?: Array<{ amount: number; status: string }>;
}): number => {
  const refunded = roundMoney(
    (payment.refunds ?? [])
      .filter((refund) => refund.status === "SUCCEEDED")
      .reduce((sum, refund) => sum + refund.amount, 0),
  );
  return roundMoney(Math.max(0, payment.amount - refunded));
};

const normalizePositiveNumber = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
};

const calculateLineDiscount = (
  grossAmount: number,
  discountType: DiscountType | null | undefined,
  discountValue: number | null | undefined,
  exponent: number,
): number => {
  const normalizedValue = normalizePositiveNumber(discountValue);
  if (!normalizedValue) {
    return 0;
  }

  if (discountType === "FIXED_AMOUNT") {
    return quantizeMoney(Math.min(normalizedValue, grossAmount), exponent);
  }

  if (discountType === "PERCENTAGE") {
    return quantizeMoney(
      Math.min(grossAmount, grossAmount * (normalizedValue / 100)),
      exponent,
    );
  }

  return 0;
};

const calculateInvoiceDiscount = (
  invoiceDiscount: InvoiceDiscountInput | null | undefined,
  baseAmount: number,
  exponent: number,
): number => {
  if (!invoiceDiscount) {
    return 0;
  }

  const normalizedValue = normalizePositiveNumber(invoiceDiscount.value);
  if (!normalizedValue) {
    return 0;
  }

  if (invoiceDiscount.type === "FIXED_AMOUNT") {
    return quantizeMoney(Math.min(normalizedValue, baseAmount), exponent);
  }

  if (invoiceDiscount.type === "PERCENTAGE") {
    return quantizeMoney(
      Math.min(baseAmount, baseAmount * (normalizedValue / 100)),
      exponent,
    );
  }

  return 0;
};

const allocateInvoiceDiscountAcrossLines = (
  lineBases: number[],
  invoiceDiscountTotal: number,
  exponent: number,
): number[] => {
  const totalBaseCents = lineBases.reduce(
    (sum, amount) => sum + toLedgerMinorUnits(amount, exponent),
    0,
  );
  const totalDiscountCents = Math.min(
    toLedgerMinorUnits(invoiceDiscountTotal, exponent),
    totalBaseCents,
  );

  if (!totalBaseCents || !totalDiscountCents) {
    return lineBases.map(() => 0);
  }

  const allocations = lineBases.map((amount) => {
    const cents = toLedgerMinorUnits(amount, exponent);
    return Math.floor((cents * totalDiscountCents) / totalBaseCents);
  });

  const allocatedCents = allocations.reduce((sum, amount) => sum + amount, 0);
  let remainder = totalDiscountCents - allocatedCents;

  for (let index = 0; remainder > 0 && index < allocations.length; index += 1) {
    const lineCents = toLedgerMinorUnits(lineBases[index], exponent);
    if (allocations[index] >= lineCents) {
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

  return allocations.map((amount) => fromLedgerMinorUnits(amount, exponent));
};

/**
 * Share of the post-line-discount amount that the overall invoice discount
 * takes, expressed as a percentage. Derived from the resolved discount amount
 * rather than the raw input value, so a FIXED_AMOUNT discount is measured on
 * the same scale as a PERCENTAGE one.
 */
export const calculateInvoiceDiscountPercentOfBase = (
  invoiceDiscountTotal: number,
  baseAmount: number,
): number => {
  if (baseAmount <= 0 || invoiceDiscountTotal <= 0) {
    return 0;
  }

  return roundMoney((invoiceDiscountTotal / baseAmount) * 100);
};

export const calculateInvoicePricing = (
  input: InvoicePricingInput,
): InvoicePricingBreakdown => {
  const exponent = resolveLedgerExponent(input.currency);
  const quantize = (value: number): number => quantizeMoney(value, exponent);
  const taxRatePercent = normalizePositiveNumber(input.taxRatePercent);

  let subtotal = 0;
  let lineDiscountTotal = 0;
  let taxableSubtotal = 0;
  let taxTotal = 0;

  const linesBeforeInvoiceDiscount = input.lines.map((line) => {
    const quantity = normalizePositiveNumber(line.quantity);
    const unitAmount = normalizePositiveNumber(line.unitAmount);
    const grossAmount = quantize(quantity * unitAmount);
    const lineDiscountAmount = calculateLineDiscount(
      grossAmount,
      line.discountType,
      line.discountValue,
      exponent,
    );
    const netAmount = quantize(grossAmount - lineDiscountAmount);

    subtotal = quantize(subtotal + grossAmount);
    lineDiscountTotal = quantize(lineDiscountTotal + lineDiscountAmount);

    return {
      grossAmount,
      lineDiscountAmount,
      netAmount,
      taxBehavior: line.taxBehavior ?? "EXCLUSIVE",
    };
  });

  const amountBeforeInvoiceDiscount = quantize(
    linesBeforeInvoiceDiscount.reduce((sum, line) => sum + line.netAmount, 0),
  );
  const invoiceDiscountTotal = calculateInvoiceDiscount(
    input.invoiceDiscount,
    amountBeforeInvoiceDiscount,
    exponent,
  );

  const invoiceDiscountAllocations = allocateInvoiceDiscountAcrossLines(
    linesBeforeInvoiceDiscount.map((line) => line.netAmount),
    invoiceDiscountTotal,
    exponent,
  );

  const lines = linesBeforeInvoiceDiscount.map((line, index) => {
    const invoiceDiscountAmount = invoiceDiscountAllocations[index] ?? 0;
    const discountedAmount = quantize(line.netAmount - invoiceDiscountAmount);
    const taxableAmount =
      line.taxBehavior === "INCLUSIVE" && taxRatePercent > 0
        ? quantize(discountedAmount / (1 + taxRatePercent / 100))
        : discountedAmount;

    const taxAmount =
      line.taxBehavior === "INCLUSIVE" && taxRatePercent > 0
        ? quantize(discountedAmount - taxableAmount)
        : quantize(taxableAmount * (taxRatePercent / 100));

    const totalAmount =
      line.taxBehavior === "INCLUSIVE"
        ? discountedAmount
        : quantize(discountedAmount + taxAmount);

    taxableSubtotal = quantize(taxableSubtotal + taxableAmount);
    taxTotal = quantize(taxTotal + taxAmount);

    return {
      grossAmount: line.grossAmount,
      lineDiscountAmount: line.lineDiscountAmount,
      netAmount: line.netAmount,
      taxableAmount,
      taxAmount,
      totalAmount,
    };
  });

  const totalAmount = quantize(taxableSubtotal + taxTotal);

  return {
    subtotal,
    lineDiscountTotal,
    taxableSubtotal,
    taxTotal,
    invoiceDiscountTotal,
    totalAmount,
    lines,
  };
};
