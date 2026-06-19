import {
  calculateInvoicePricing,
  roundMoney,
} from "../../src/services/finance/pricing";

describe("finance/pricing", () => {
  it("rounds money deterministically", () => {
    expect(roundMoney(10.004)).toBe(10);
    expect(roundMoney(10.005)).toBe(10.01);
  });

  it("calculates exclusive tax, line discounts, and invoice discounts", () => {
    const pricing = calculateInvoicePricing({
      lines: [
        {
          quantity: 2,
          unitAmount: 100,
          discountType: "PERCENTAGE",
          discountValue: 10,
        },
        {
          quantity: 1,
          unitAmount: 50,
        },
      ],
      taxRatePercent: 18,
      invoiceDiscount: {
        type: "PERCENTAGE",
        value: 5,
      },
    });

    expect(pricing.subtotal).toBe(250);
    expect(pricing.lineDiscountTotal).toBe(20);
    expect(pricing.taxableSubtotal).toBe(218.5);
    expect(pricing.taxTotal).toBe(39.33);
    expect(pricing.invoiceDiscountTotal).toBe(11.5);
    expect(pricing.totalAmount).toBe(257.83);
    expect(pricing.lines).toEqual([
      {
        grossAmount: 200,
        lineDiscountAmount: 20,
        netAmount: 180,
        taxableAmount: 171,
        taxAmount: 30.78,
        totalAmount: 201.78,
      },
      {
        grossAmount: 50,
        lineDiscountAmount: 0,
        netAmount: 50,
        taxableAmount: 47.5,
        taxAmount: 8.55,
        totalAmount: 56.05,
      },
    ]);
  });

  it("caps fixed discounts at the amount being discounted", () => {
    const pricing = calculateInvoicePricing({
      lines: [
        {
          quantity: 1,
          unitAmount: 40,
          discountType: "FIXED_AMOUNT",
          discountValue: 60,
        },
      ],
      invoiceDiscount: {
        type: "FIXED_AMOUNT",
        value: 100,
      },
    });

    expect(pricing.subtotal).toBe(40);
    expect(pricing.lineDiscountTotal).toBe(40);
    expect(pricing.taxTotal).toBe(0);
    expect(pricing.invoiceDiscountTotal).toBe(0);
    expect(pricing.totalAmount).toBe(0);
  });

  it("supports inclusive tax and ignores non-positive inputs", () => {
    const pricing = calculateInvoicePricing({
      lines: [
        {
          quantity: 1,
          unitAmount: 110,
          taxBehavior: "INCLUSIVE",
        },
        {
          quantity: -1,
          unitAmount: 999,
          discountType: "PERCENTAGE",
          discountValue: 25,
        },
      ],
      taxRatePercent: 10,
    });

    expect(pricing.subtotal).toBe(110);
    expect(pricing.lineDiscountTotal).toBe(0);
    expect(pricing.taxableSubtotal).toBe(100);
    expect(pricing.taxTotal).toBe(10);
    expect(pricing.totalAmount).toBe(110);
    expect(pricing.lines[0]).toEqual({
      grossAmount: 110,
      lineDiscountAmount: 0,
      netAmount: 110,
      taxableAmount: 100,
      taxAmount: 10,
      totalAmount: 110,
    });
    expect(pricing.lines[1]).toEqual({
      grossAmount: 0,
      lineDiscountAmount: 0,
      netAmount: 0,
      taxableAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
    });
  });
});
