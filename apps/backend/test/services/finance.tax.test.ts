import {
  DEFAULT_TAX_PROVIDER,
  __setFinanceTaxStripeClientForTests,
  finalizeInvoiceTaxSnapshot,
  previewInvoiceTaxSnapshot,
  resolveConfiguredTaxProvider,
} from "../../src/services/finance/tax";

describe("finance tax helpers", () => {
  afterEach(() => {
    __setFinanceTaxStripeClientForTests(null);
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("falls back to the default tax provider for unknown config", () => {
    expect(resolveConfiguredTaxProvider("unknown")).toBe(DEFAULT_TAX_PROVIDER);
    expect(resolveConfiguredTaxProvider(undefined)).toBe(DEFAULT_TAX_PROVIDER);
  });

  it("accepts the explicit Stripe tax provider", () => {
    expect(resolveConfiguredTaxProvider("stripe")).toBe("STRIPE");
  });

  it("builds a provider-neutral tax snapshot payload when no customer address exists", async () => {
    const snapshot = await previewInvoiceTaxSnapshot(undefined, {
      provider: DEFAULT_TAX_PROVIDER,
      taxBehavior: "INCLUSIVE",
      taxRatePercent: 18,
      currency: "usd",
      invoiceDiscount: { type: "PERCENTAGE", value: 10 },
      pricing: {
        subtotal: 118,
        lineDiscountTotal: 0,
        taxableSubtotal: 90,
        taxTotal: 16.2,
        invoiceDiscountTotal: 11.8,
        totalAmount: 106.2,
        lines: [
          {
            grossAmount: 118,
            lineDiscountAmount: 0,
            netAmount: 118,
            taxableAmount: 90,
            taxAmount: 16.2,
            totalAmount: 106.2,
          },
        ],
      },
      lineItems: [
        {
          description: "Consultation",
          quantity: 1,
          unitPrice: 118,
          discountPercent: undefined,
        },
      ],
    });

    expect(snapshot.provider).toBe(DEFAULT_TAX_PROVIDER);
    expect(snapshot.taxBehavior).toBe("INCLUSIVE");
    expect(snapshot.taxAmount).toBe(16.2);
    expect(snapshot.rawProviderPayload).toEqual(
      expect.objectContaining({
        provider: DEFAULT_TAX_PROVIDER,
        taxBehavior: "INCLUSIVE",
        calculationMode: "fallback",
      }),
    );
  });

  it("uses Stripe automatic tax when customer address is available", async () => {
    const createPreview = jest.fn().mockResolvedValue({
      id: "upcoming_in_1",
      total_excluding_tax: 11800,
      total_taxes: [
        {
          amount: 1800,
          jurisdiction: {
            country: "US",
            state: "CA",
          },
          tax_rate_details: {
            display_name: "Sales Tax",
            percentage_decimal: "15.2542",
            tax_type: "sales_tax",
          },
          sourcing: "destination",
          taxability_reason: "standard_rated",
          taxable_amount: 11800,
        },
      ],
      automatic_tax: {
        enabled: true,
        disabled_reason: null,
        liability: null,
        provider: "stripe",
      },
    });
    __setFinanceTaxStripeClientForTests({
      invoices: { createPreview } as any,
    } as any);

    const snapshot = await finalizeInvoiceTaxSnapshot(undefined, {
      provider: DEFAULT_TAX_PROVIDER,
      taxBehavior: "EXCLUSIVE",
      taxRatePercent: 0,
      currency: "usd",
      pricing: {
        subtotal: 118,
        lineDiscountTotal: 0,
        taxableSubtotal: 118,
        taxTotal: 0,
        invoiceDiscountTotal: 0,
        totalAmount: 118,
        lines: [
          {
            grossAmount: 118,
            lineDiscountAmount: 0,
            netAmount: 118,
            taxableAmount: 118,
            taxAmount: 0,
            totalAmount: 118,
          },
        ],
      },
      lineItems: [
        {
          description: "Consultation",
          quantity: 1,
          unitPrice: 118,
          discountPercent: undefined,
        },
      ],
      customerAddress: {
        line1: "1 Main St",
        city: "San Francisco",
        state: "CA",
        postal_code: "94105",
        country: "US",
      },
    });

    expect(createPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "usd",
        automatic_tax: expect.objectContaining({ enabled: true }),
        customer_details: expect.objectContaining({
          address: expect.objectContaining({ country: "US" }),
        }),
      }),
    );
    expect(snapshot.providerReferenceId).toBe("upcoming_in_1");
    expect(snapshot.taxAmount).toBe(18);
    expect(snapshot.taxBreakdown).toEqual(
      expect.objectContaining({
        totalTaxes: expect.any(Array),
        invoicePreviewId: "upcoming_in_1",
      }),
    );
  });

  it("uses automatic tax liability accounts and allocates invoice discounts across lines", async () => {
    const createPreview = jest.fn().mockResolvedValue({
      id: "upcoming_in_2",
      total_excluding_tax: 197,
      total_taxes: [
        {
          amount: 300,
          jurisdiction: {
            country: "US",
            state: "CA",
          },
          tax_rate_details: {
            display_name: "Sales Tax",
            percentage_decimal: "15.2542",
            tax_type: "sales_tax",
          },
          sourcing: "destination",
          taxability_reason: "standard_rated",
          taxable_amount: 197,
        },
      ],
      automatic_tax: {
        enabled: true,
        disabled_reason: null,
        liability: {
          type: "account",
          account: "acct_1",
        },
        provider: "stripe",
      },
    });
    __setFinanceTaxStripeClientForTests({
      invoices: { createPreview } as any,
    } as any);
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";

    const snapshot = await previewInvoiceTaxSnapshot(undefined, {
      provider: DEFAULT_TAX_PROVIDER,
      taxBehavior: "EXCLUSIVE",
      taxRatePercent: 15,
      currency: "usd",
      invoiceDiscount: { type: "FIXED_AMOUNT", value: 0.03 },
      pricing: {
        subtotal: 2,
        lineDiscountTotal: 0,
        taxableSubtotal: 1.97,
        taxTotal: 0,
        invoiceDiscountTotal: 0.03,
        totalAmount: 1.97,
        lines: [
          {
            grossAmount: 1,
            lineDiscountAmount: 0,
            netAmount: 1,
            taxableAmount: 1,
            taxAmount: 0,
            totalAmount: 1,
          },
          {
            grossAmount: 1,
            lineDiscountAmount: 0,
            netAmount: 1,
            taxableAmount: 1,
            taxAmount: 0,
            totalAmount: 1,
          },
        ],
      },
      lineItems: [
        {
          description: "Consultation",
          quantity: 1,
          unitPrice: 1,
          discountPercent: undefined,
        },
        {
          description: "Follow-up",
          quantity: 1,
          unitPrice: 1,
          discountPercent: undefined,
        },
      ],
      customerAddress: {
        line1: "1 Main St",
        city: "San Francisco",
        state: "CA",
        postal_code: "94105",
        country: "US",
      },
      liabilityAccountId: "acct_1",
    });

    expect(createPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        issuer: expect.objectContaining({
          type: "account",
          account: "acct_1",
        }),
        automatic_tax: expect.objectContaining({
          liability: expect.objectContaining({
            type: "account",
            account: "acct_1",
          }),
        }),
        invoice_items: expect.arrayContaining([
          expect.objectContaining({ amount: 98 }),
          expect.objectContaining({ amount: 99 }),
        ]),
      }),
    );
    const calledWith = createPreview.mock.calls[0][0];
    expect(calledWith.invoice_items[0]).not.toHaveProperty("quantity");
    expect(calledWith.invoice_items[1]).not.toHaveProperty("quantity");
    expect(calledWith.invoice_items[0]).toMatchObject({ currency: "usd" });
    expect(calledWith.invoice_items[1]).toMatchObject({ currency: "usd" });
    expect(snapshot.providerReferenceId).toBe("upcoming_in_2");
  });

  it("throws when the Stripe secret key is missing for automatic tax previews", async () => {
    await expect(
      previewInvoiceTaxSnapshot(undefined, {
        provider: DEFAULT_TAX_PROVIDER,
        taxBehavior: "EXCLUSIVE",
        taxRatePercent: 15,
        currency: "usd",
        pricing: {
          subtotal: 1,
          lineDiscountTotal: 0,
          taxableSubtotal: 1,
          taxTotal: 0,
          invoiceDiscountTotal: 0,
          totalAmount: 1,
          lines: [
            {
              grossAmount: 1,
              lineDiscountAmount: 0,
              netAmount: 1,
              taxableAmount: 1,
              taxAmount: 0,
              totalAmount: 1,
            },
          ],
        },
        lineItems: [
          {
            description: "Consultation",
            quantity: 1,
            unitPrice: 1,
          },
        ],
        customerAddress: {
          line1: "1 Main St",
          city: "San Francisco",
          state: "CA",
          postal_code: "94105",
          country: "US",
        },
      }),
    ).rejects.toThrow("STRIPE_SECRET_KEY is not configured");
  });
});
