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

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;

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
): number => {
  const normalizedValue = normalizePositiveNumber(discountValue);
  if (!normalizedValue) {
    return 0;
  }

  if (discountType === "FIXED_AMOUNT") {
    return roundMoney(Math.min(normalizedValue, grossAmount));
  }

  if (discountType === "PERCENTAGE") {
    return roundMoney(
      Math.min(grossAmount, grossAmount * (normalizedValue / 100)),
    );
  }

  return 0;
};

const calculateInvoiceDiscount = (
  invoiceDiscount: InvoiceDiscountInput | null | undefined,
  baseAmount: number,
): number => {
  if (!invoiceDiscount) {
    return 0;
  }

  const normalizedValue = normalizePositiveNumber(invoiceDiscount.value);
  if (!normalizedValue) {
    return 0;
  }

  if (invoiceDiscount.type === "FIXED_AMOUNT") {
    return roundMoney(Math.min(normalizedValue, baseAmount));
  }

  if (invoiceDiscount.type === "PERCENTAGE") {
    return roundMoney(
      Math.min(baseAmount, baseAmount * (normalizedValue / 100)),
    );
  }

  return 0;
};

const allocateInvoiceDiscountAcrossLines = (
  lineBases: number[],
  invoiceDiscountTotal: number,
): number[] => {
  const totalBaseCents = lineBases.reduce(
    (sum, amount) => sum + Math.round(roundMoney(amount) * MONEY_SCALE),
    0,
  );
  const totalDiscountCents = Math.min(
    Math.round(roundMoney(invoiceDiscountTotal) * MONEY_SCALE),
    totalBaseCents,
  );

  if (!totalBaseCents || !totalDiscountCents) {
    return lineBases.map(() => 0);
  }

  const allocations = lineBases.map((amount) => {
    const cents = Math.round(roundMoney(amount) * MONEY_SCALE);
    return Math.floor((cents * totalDiscountCents) / totalBaseCents);
  });

  const allocatedCents = allocations.reduce((sum, amount) => sum + amount, 0);
  let remainder = totalDiscountCents - allocatedCents;

  for (let index = 0; remainder > 0 && index < allocations.length; index += 1) {
    const lineCents = Math.round(roundMoney(lineBases[index]) * MONEY_SCALE);
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

  return allocations.map((amount) => amount / MONEY_SCALE);
};

export const calculateInvoicePricing = (
  input: InvoicePricingInput,
): InvoicePricingBreakdown => {
  const taxRatePercent = normalizePositiveNumber(input.taxRatePercent);

  let subtotal = 0;
  let lineDiscountTotal = 0;
  let taxableSubtotal = 0;
  let taxTotal = 0;

  const linesBeforeInvoiceDiscount = input.lines.map((line) => {
    const quantity = normalizePositiveNumber(line.quantity);
    const unitAmount = normalizePositiveNumber(line.unitAmount);
    const grossAmount = roundMoney(quantity * unitAmount);
    const lineDiscountAmount = calculateLineDiscount(
      grossAmount,
      line.discountType,
      line.discountValue,
    );
    const netAmount = roundMoney(grossAmount - lineDiscountAmount);

    subtotal = roundMoney(subtotal + grossAmount);
    lineDiscountTotal = roundMoney(lineDiscountTotal + lineDiscountAmount);

    return {
      grossAmount,
      lineDiscountAmount,
      netAmount,
      taxBehavior: line.taxBehavior ?? "EXCLUSIVE",
    };
  });

  const amountBeforeInvoiceDiscount = roundMoney(
    linesBeforeInvoiceDiscount.reduce((sum, line) => sum + line.netAmount, 0),
  );
  const invoiceDiscountTotal = calculateInvoiceDiscount(
    input.invoiceDiscount,
    amountBeforeInvoiceDiscount,
  );

  const invoiceDiscountAllocations = allocateInvoiceDiscountAcrossLines(
    linesBeforeInvoiceDiscount.map((line) => line.netAmount),
    invoiceDiscountTotal,
  );

  const lines = linesBeforeInvoiceDiscount.map((line, index) => {
    const invoiceDiscountAmount = invoiceDiscountAllocations[index] ?? 0;
    const discountedAmount = roundMoney(line.netAmount - invoiceDiscountAmount);
    const taxableAmount =
      line.taxBehavior === "INCLUSIVE" && taxRatePercent > 0
        ? roundMoney(discountedAmount / (1 + taxRatePercent / 100))
        : discountedAmount;

    const taxAmount =
      line.taxBehavior === "INCLUSIVE" && taxRatePercent > 0
        ? roundMoney(discountedAmount - taxableAmount)
        : roundMoney(taxableAmount * (taxRatePercent / 100));

    const totalAmount =
      line.taxBehavior === "INCLUSIVE"
        ? discountedAmount
        : roundMoney(discountedAmount + taxAmount);

    taxableSubtotal = roundMoney(taxableSubtotal + taxableAmount);
    taxTotal = roundMoney(taxTotal + taxAmount);

    return {
      grossAmount: line.grossAmount,
      lineDiscountAmount: line.lineDiscountAmount,
      netAmount: line.netAmount,
      taxableAmount,
      taxAmount,
      totalAmount,
    };
  });

  const totalAmount = roundMoney(taxableSubtotal + taxTotal);

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
