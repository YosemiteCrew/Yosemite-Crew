import {
  HISTORICAL_AUDIT_PAGE_SIZE,
  ProviderReceiptAuditService,
} from "../../src/services/finance/provider-receipt-audit";
import { prisma } from "src/config/prisma";
import { encodeKeysetCursor } from "src/services/shared/pagination";

jest.mock("src/config/prisma", () => ({
  prisma: {
    payment: {
      findMany: jest.fn(),
      // Never called. Present so that a repair added to the audit later is a
      // failing test rather than a silent change of what this module is.
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    providerReceipt: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  payment: {
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  providerReceipt: {
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  organization: {
    findUnique: jest.Mock;
    count: jest.Mock;
  };
};

const ORG = "org_audited";

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  invoiceId: "invoice-1",
  provider: "STRIPE" as const,
  status: "SUCCEEDED" as const,
  providerPaymentId: "pi_captured",
  amount: 42.5,
  currency: "gbp",
  paidAt: new Date("2026-09-18T10:00:00.000Z"),
  createdAt: new Date("2026-09-18T10:00:01.000Z"),
  ...overrides,
});

const receipt = (overrides: Record<string, unknown> = {}) => ({
  id: "receipt-1",
  provider: "STRIPE" as const,
  paymentRef: "pi_captured",
  amount: 42.5,
  currency: "gbp",
  ...overrides,
});

/** The population and the journal rows the audit will read for one window. */
const given = (payments: unknown[], receipts: unknown[]) => {
  mockedPrisma.payment.findMany.mockResolvedValue(payments);
  mockedPrisma.providerReceipt.findMany.mockResolvedValue(receipts);
};

const audit = (input: Record<string, unknown> = {}) =>
  ProviderReceiptAuditService.auditHistoricalMismatches({
    organisationId: ORG,
    ...input,
  });

beforeEach(() => {
  jest.resetAllMocks();
  mockedPrisma.organization.findUnique.mockResolvedValue({
    stripeAccountId: "acct_audited",
  });
  mockedPrisma.organization.count.mockResolvedValue(1);
});

describe("ProviderReceiptAuditService.auditHistoricalMismatches - classification", () => {
  it("reports nothing about a payment the journal corroborates", async () => {
    given([payment()], [receipt()]);

    const result = await audit();

    expect(result.mismatches).toEqual([]);
    expect(result.examined).toBe(1);
    expect(result.matched).toBe(1);
  });

  it("reports a captured payment no journal row carries", async () => {
    // The pre-journal population. The journal only holds what was captured
    // after it was deployed, so this is the class the audit exists to size -
    // and it is a finding rather than an error.
    given([payment()], []);

    const result = await audit();

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toMatchObject({
      kind: "NOT_JOURNALLED",
      paymentId: "11111111-1111-4111-8111-111111111111",
      paymentRef: "pi_captured",
      recordedAmount: 42.5,
      recordedCurrency: "gbp",
      journalledReceiptIds: [],
      journalledAmount: null,
      journalledCurrency: null,
    });
    expect(result.matched).toBe(0);
  });

  it("reports a payment taken through a provider that kept no reference", async () => {
    // Distinct from NOT_JOURNALLED on purpose: this one can never be matched
    // to a provider record by anybody, so it is not a gap the journal could
    // close later.
    given([payment({ providerPaymentId: null })], []);

    const result = await audit();

    expect(result.mismatches[0]).toMatchObject({
      kind: "REFERENCE_MISSING",
      paymentRef: null,
      journalledReceiptIds: [],
    });
  });

  it("does not look a payment with no reference up in the journal", async () => {
    // A `paymentRef: { in: [] }` read is a query that can only return rows the
    // audit would then have to discard, and it would be one per window.
    given([payment({ providerPaymentId: null })], []);

    await audit();

    expect(mockedPrisma.providerReceipt.findMany).not.toHaveBeenCalled();
  });

  it("refuses to choose between two journal rows carrying one reference", async () => {
    // Reachable: the same intent journalled once against the platform sentinel
    // and once against a connected account is two rows under one reference.
    // Picking either would be the guess the issue forbids.
    given(
      [payment()],
      [
        receipt({ id: "receipt-platform" }),
        receipt({ id: "receipt-connected" }),
      ],
    );

    const result = await audit();

    expect(result.mismatches[0]).toMatchObject({
      kind: "AMBIGUOUS_JOURNAL_MATCH",
      journalledReceiptIds: ["receipt-platform", "receipt-connected"],
      journalledAmount: null,
      journalledCurrency: null,
    });
  });

  it("reports a differing amount against the figure the journal holds", async () => {
    given([payment({ amount: 42.5 })], [receipt({ amount: 40 })]);

    const result = await audit();

    expect(result.mismatches[0]).toMatchObject({
      kind: "AMOUNT_DIFFERS",
      recordedAmount: 42.5,
      journalledAmount: 40,
      journalledReceiptIds: ["receipt-1"],
    });
  });

  it("calls a differing currency not comparable rather than a differing amount", async () => {
    // The amounts here are EQUAL as numbers, which is exactly when dropping
    // the currency check looks like a clean match. Two figures in different
    // currencies have not been compared at all.
    given(
      [payment({ amount: 42.5, currency: "gbp" })],
      [receipt({ amount: 42.5, currency: "usd" })],
    );

    const result = await audit();

    expect(result.mismatches[0]).toMatchObject({
      kind: "CURRENCY_DIFFERS",
      recordedCurrency: "gbp",
      journalledCurrency: "usd",
    });
  });

  it("reports the currency before the amount when both differ", async () => {
    given(
      [payment({ amount: 42.5, currency: "gbp" })],
      [receipt({ amount: 40, currency: "usd" })],
    );

    const result = await audit();

    expect(result.mismatches[0].kind).toBe("CURRENCY_DIFFERS");
  });

  it("does not match a reference journalled against a different provider", async () => {
    // The journal's identity includes the provider. Matching on the reference
    // alone would report a mismatch as a match, which is the one direction
    // this audit must not be wrong in.
    given(
      [payment({ provider: "STRIPE" })],
      [receipt({ provider: "MANUAL", amount: 42.5, currency: "gbp" })],
    );

    const result = await audit();

    expect(result.mismatches[0].kind).toBe("NOT_JOURNALLED");
  });

  it("keeps two references in one window apart", async () => {
    given(
      [
        payment({
          id: "22222222-2222-4222-8222-222222222222",
          providerPaymentId: "pi_one",
        }),
        payment({
          id: "33333333-3333-4333-8333-333333333333",
          providerPaymentId: "pi_two",
          amount: 10,
        }),
      ],
      [
        receipt({ id: "receipt-one", paymentRef: "pi_one", amount: 42.5 }),
        receipt({ id: "receipt-two", paymentRef: "pi_two", amount: 99 }),
      ],
    );

    const result = await audit();

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toMatchObject({
      kind: "AMOUNT_DIFFERS",
      paymentId: "33333333-3333-4333-8333-333333333333",
      journalledReceiptIds: ["receipt-two"],
      journalledAmount: 99,
    });
  });

  it("counts matched as the window minus the findings", async () => {
    // Each payment yields at most one finding, which is what makes this
    // subtraction a count rather than an estimate.
    given(
      [
        payment({ id: "44444444-4444-4444-8444-444444444444" }),
        payment({
          id: "55555555-5555-4555-8555-555555555555",
          providerPaymentId: "pi_missing",
        }),
        payment({
          id: "66666666-6666-4666-8666-666666666666",
          providerPaymentId: "pi_also_missing",
        }),
      ],
      [receipt()],
    );

    const result = await audit();

    expect(result.examined).toBe(3);
    expect(result.mismatches).toHaveLength(2);
    expect(result.matched).toBe(1);
  });
});

describe("ProviderReceiptAuditService.auditHistoricalMismatches - population", () => {
  const whereOf = () =>
    mockedPrisma.payment.findMany.mock.calls[0][0].where as unknown as {
      AND: Record<string, unknown>[];
    };

  it("audits only the payment states in which money was actually taken", async () => {
    // A refunded payment still had a capture, so the journal still owes a row
    // for it. A pending or failed one never reached a capture, so reporting a
    // missing row for it would bury the real findings.
    given([], []);

    await audit();

    expect(whereOf().AND).toContainEqual({
      status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] },
    });
  });

  it("audits only providers the journal is supposed to hold captures for", async () => {
    // Cash taken at the desk has no provider reference to journal and never
    // will, so auditing it would report every one of them forever.
    given([], []);

    await audit();

    expect(whereOf().AND).toContainEqual({ provider: { in: ["STRIPE"] } });
  });

  it("scopes the population to the organisation's own invoices", async () => {
    given([], []);

    await audit();

    expect(whereOf().AND).toContainEqual({
      invoice: { organisationId: ORG },
    });
  });

  it("scopes the journal lookup to this organisation's rows and unattributed ones", async () => {
    // A reference journalled only under another organisation must not be
    // matched here, and its receipt id must not reach this report.
    given([payment()], []);

    await audit();

    expect(mockedPrisma.providerReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          paymentRef: { in: ["pi_captured"] },
          OR: [
            { organisationId: ORG },
            {
              organisationId: null,
              merchantAccountRef: "acct_audited",
            },
          ],
        },
      }),
    );
  });

  it("never reads unattributed receipts from another merchant account", async () => {
    given([payment()], []);

    await audit();

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(where.OR).not.toContainEqual({ organisationId: null });
    expect(where.OR).not.toContainEqual(
      expect.objectContaining({ merchantAccountRef: "acct_other" }),
    );
  });

  it("windows on when the payment was recorded, which is the field it sorts on", async () => {
    // Not paidAt: it is nullable, so a window built from it would silently
    // drop every settled payment that has none.
    given([], []);

    await audit({
      recordedFrom: new Date("2026-09-01T00:00:00.000Z"),
      recordedTo: new Date("2026-09-30T23:59:59.000Z"),
    });

    expect(whereOf().AND).toContainEqual({
      createdAt: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lte: new Date("2026-09-30T23:59:59.000Z"),
      },
    });
  });

  it("leaves a window open at the end the caller left open", async () => {
    // Auditing everything since a date is the ordinary request - the journal
    // was deployed on one - and pairing an absent bound with an invented one
    // would quietly truncate the answer at whatever that invention was.
    given([], []);

    await audit({ recordedFrom: new Date("2026-09-01T00:00:00.000Z") });

    expect(whereOf().AND).toContainEqual({
      createdAt: { gte: new Date("2026-09-01T00:00:00.000Z") },
    });
  });

  it("leaves a window open at the start the caller left open", async () => {
    given([], []);

    await audit({ recordedTo: new Date("2026-09-30T23:59:59.000Z") });

    expect(whereOf().AND).toContainEqual({
      createdAt: { lte: new Date("2026-09-30T23:59:59.000Z") },
    });
  });

  it("applies no date filter when the caller named no window", async () => {
    given([], []);

    await audit();

    expect(whereOf().AND).not.toContainEqual(
      expect.objectContaining({ createdAt: expect.anything() }),
    );
  });

  it("reports paidAt on a finding even though it does not window on it", async () => {
    given([payment({ paidAt: null })], []);

    const result = await audit();

    expect(result.mismatches[0]).toMatchObject({
      paidAt: null,
      recordedAt: new Date("2026-09-18T10:00:01.000Z"),
    });
  });
});

describe("ProviderReceiptAuditService.auditHistoricalMismatches - windowing", () => {
  it("reads one more row than the window so hasMore needs no second query", async () => {
    given([], []);

    await audit({ limit: "2" });

    expect(mockedPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });

  it("reports coverage of the window rather than of the read", async () => {
    const rows = [
      payment({ id: "77777777-7777-4777-8777-777777777777" }),
      payment({ id: "88888888-8888-4888-8888-888888888888" }),
      payment({ id: "99999999-9999-4999-8999-999999999999" }),
    ];
    given(rows, [receipt()]);

    const result = await audit({ limit: "2" });

    expect(result.examined).toBe(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe(
      encodeKeysetCursor({
        createdAt: new Date("2026-09-18T10:00:01.000Z"),
        id: "88888888-8888-4888-8888-888888888888",
      }),
    );
  });

  it("ends the paging when the read did not overrun the window", async () => {
    given([payment()], [receipt()]);

    const result = await audit({ limit: "2" });

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("continues a window with an exclusive comparison rather than an offset", async () => {
    // Prisma's cursor + skip: 1 is exclusive only while the cursor row is
    // still in the filtered set; a payment moved out of the status filter
    // between windows makes the OFFSET eat a real one.
    const cursor = {
      createdAt: new Date("2026-09-18T10:00:01.000Z"),
      id: "11111111-1111-4111-8111-111111111111",
    };
    given([], []);

    await audit({ cursor });

    expect(
      (
        mockedPrisma.payment.findMany.mock.calls[0][0].where as unknown as {
          AND: Record<string, unknown>[];
        }
      ).AND,
    ).toContainEqual({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });
    expect(mockedPrisma.payment.findMany.mock.calls[0][0].skip).toBeUndefined();
  });

  it("clamps a window the caller asked to be larger than the ceiling", async () => {
    given([], []);

    const result = await audit({ limit: "5000" });

    // The numbers are written out rather than read back from the constant:
    // asserting the ceiling against itself holds for any value it is ever
    // changed to, which is not a bound at all.
    expect(result.limit).toBe(200);
    expect(HISTORICAL_AUDIT_PAGE_SIZE.maxSize).toBe(200);
    expect(mockedPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 201 }),
    );
  });

  it("uses the default window when the caller named none", async () => {
    given([], []);

    const result = await audit();

    expect(result.limit).toBe(100);
    expect(HISTORICAL_AUDIT_PAGE_SIZE.defaultSize).toBe(100);
  });

  it("orders newest first on the same key the cursor carries", async () => {
    given([], []);

    await audit();

    expect(mockedPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });
});

describe("ProviderReceiptAuditService.auditHistoricalMismatches - no repair", () => {
  it("writes nothing while reporting a mismatch of every kind it can find", async () => {
    // The issue is explicit that this audit performs no automatic guessed
    // repair. A correction of a financial record taken on the audit's own
    // reading is not recoverable by running the audit again, so the absence of
    // a write is the behaviour and not an implementation detail.
    given(
      [
        payment({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          providerPaymentId: null,
        }),
        payment({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          providerPaymentId: "pi_unjournalled",
        }),
        payment({
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          providerPaymentId: "pi_captured",
          amount: 1,
        }),
      ],
      [receipt()],
    );

    const result = await audit();

    expect(result.mismatches.map((found) => found.kind)).toEqual([
      "REFERENCE_MISSING",
      "NOT_JOURNALLED",
      "AMOUNT_DIFFERS",
    ]);
    for (const model of [mockedPrisma.payment, mockedPrisma.providerReceipt]) {
      expect(model.update).not.toHaveBeenCalled();
      expect(model.updateMany).not.toHaveBeenCalled();
      expect(model.create).not.toHaveBeenCalled();
      expect(model.delete).not.toHaveBeenCalled();
    }
  });
});
