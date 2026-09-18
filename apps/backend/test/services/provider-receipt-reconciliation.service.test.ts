import {
  PLATFORM_MERCHANT_ACCOUNT_REF,
  ProviderReceiptService,
  RECONCILIATION_PAGE_SIZE,
} from "../../src/services/finance/provider-receipt";
import { encodeKeysetCursor } from "../../src/services/shared/pagination";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";

jest.mock("src/config/prisma", () => ({
  prisma: {
    providerReceipt: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockedPrisma = prisma as unknown as {
  providerReceipt: { findMany: jest.Mock };
  organization: { findUnique: jest.Mock; count: jest.Mock };
};
const mockedLogger = logger as unknown as { error: jest.Mock };

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  provider: "STRIPE" as const,
  merchantAccountRef: "acct_org_a",
  paymentRef: "pi_1",
  organisationId: "org-a",
  invoiceId: null,
  appointmentId: null,
  amount: 42.5,
  currency: "gbp",
  capturedAt: new Date("2026-09-18T10:00:00.000Z"),
  status: "UNALLOCATED" as const,
  reason: null,
  refundedAmount: 0,
  version: 0,
  createdAt: new Date("2026-09-18T10:00:01.000Z"),
  ...overrides,
});

/** The AND arm the scope lives in, so a test asserts on the scope not the order. */
const scopeOf = (where: { AND: Array<{ OR?: unknown }> }) =>
  where.AND.find((arm) => "OR" in arm) as { OR: unknown[] };

beforeEach(() => {
  jest.resetAllMocks();
  mockedPrisma.organization.findUnique.mockResolvedValue({
    stripeAccountId: "acct_org_a",
  });
  mockedPrisma.organization.count.mockResolvedValue(1);
  mockedPrisma.providerReceipt.findMany.mockResolvedValue([]);
});

describe("ProviderReceiptService.listForReconciliation", () => {
  it("shows an organisation its own receipts and the unattributed captures in its own merchant account", async () => {
    // The second arm is the reason this endpoint exists. Without it every
    // capture the webhook could not attribute is journalled durably and then
    // seen by nobody, which moves the gap rather than closing it.
    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(scopeOf(where).OR).toEqual([
      { organisationId: "org-a" },
      { organisationId: null, merchantAccountRef: "acct_org_a" },
    ]);
  });

  it("reads the merchant account from the organisation record, not from the caller", async () => {
    // A request-supplied merchant account would let any caller name another
    // tenant's connected account and read its unattributed money.
    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ where, select }] =
      mockedPrisma.organization.findUnique.mock.calls[0];
    expect(where).toEqual({ id: "org-a" });
    expect(select).toEqual({ stripeAccountId: true });
  });

  it("does not put another organisation's connected account in scope", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: "acct_org_b",
    });

    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(scopeOf(where).OR).toContainEqual({
      organisationId: null,
      merchantAccountRef: "acct_org_b",
    });
    expect(scopeOf(where).OR).not.toContainEqual({
      organisationId: null,
      merchantAccountRef: "acct_org_a",
    });
  });

  it("withholds an ambiguous connected account from every queue", async () => {
    // Organization.stripeAccountId carries no unique constraint, so "the
    // organisation that owns this account" is an assumption about the data and
    // not something the database enforces. Two rows sharing one account would
    // put each organisation's unattributed captures in the other's queue -
    // exactly the cross-tenant read the second scope arm exists to make safe.
    mockedPrisma.organization.count.mockResolvedValue(2);

    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(scopeOf(where).OR).toEqual([{ organisationId: "org-a" }]);
    expect(mockedLogger.error).toHaveBeenCalled();
  });

  it("counts the claimants of the account it is about to trust", async () => {
    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ where }] = mockedPrisma.organization.count.mock.calls[0];
    expect(where).toEqual({ stripeAccountId: "acct_org_a" });
  });

  it("does not ask who claims an account when there is none to claim", async () => {
    // A count over `stripeAccountId: null` would match every organisation that
    // has not connected one, so the arm would be dropped for a reason that has
    // nothing to do with ambiguity.
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: null,
    });

    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    expect(mockedPrisma.organization.count).not.toHaveBeenCalled();
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("never scopes an unattributed platform capture to a tenant", async () => {
    // PLATFORM is a sentinel every tenant shares, so matching on it would show
    // one organisation another's money. Such a receipt says nothing about
    // whose it is, and the issue forbids assigning one by guesswork.
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: PLATFORM_MERCHANT_ACCOUNT_REF,
    });

    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(scopeOf(where).OR).toEqual([{ organisationId: "org-a" }]);
  });

  it("falls back to the organisation's own receipts when it has no connected account", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValue({
      stripeAccountId: null,
    });

    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(scopeOf(where).OR).toEqual([{ organisationId: "org-a" }]);
  });

  it("returns no unattributed captures for an organisation that does not exist", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValue(null);

    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-missing",
    });

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(scopeOf(where).OR).toEqual([{ organisationId: "org-missing" }]);
  });

  it("never selects the raw provider payload", async () => {
    // It is the provider's whole object - billing name, email and address
    // among them. A list endpoint returning it would put that on the wire for
    // every row of every page.
    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ select }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(select).not.toHaveProperty("rawProviderPayload");
    expect(select).toMatchObject({ id: true, amount: true, status: true });
  });

  it("returns the refunded figure, without which the row has no residual", async () => {
    // The issue's oracle is captured = applied + unapplied + refunded. A
    // PARTIALLY_REFUNDED status says money went back but not how much, so the
    // operator cannot see what is left to reconcile without this column.
    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ select }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(select).toMatchObject({ refundedAmount: true });
  });

  it("filters by the states the caller asked for and nothing else", async () => {
    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
      statuses: ["UNATTRIBUTED", "UNALLOCATED"],
    });

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(where.AND).toContainEqual({
      status: { in: ["UNATTRIBUTED", "UNALLOCATED"] },
    });
  });

  it("omits the status filter entirely when none was asked for", async () => {
    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
      statuses: [],
    });

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(
      where.AND.some((arm: Record<string, unknown>) => "status" in arm),
    ).toBe(false);
  });

  it("bounds the capture window at both ends when both are given", async () => {
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-09-30T23:59:59.000Z");

    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
      capturedFrom: from,
      capturedTo: to,
    });

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(where.AND).toContainEqual({ capturedAt: { gte: from, lte: to } });
  });

  it("applies a one-sided capture window without inventing the other side", async () => {
    const from = new Date("2026-09-01T00:00:00.000Z");

    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
      capturedFrom: from,
    });

    const [{ where }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(where.AND).toContainEqual({ capturedAt: { gte: from } });
  });

  it("orders by when the receipt was journalled, newest first", async () => {
    // capturedAt comes from the provider and can arrive out of order, or be
    // recovered from a refund event long afterwards. Sorting on it would
    // shuffle rows between pages of a queue an operator is working through.
    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ orderBy }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("continues a page with an exclusive comparison rather than an offset", async () => {
    // Prisma's cursor + skip: 1 is exclusive only while the cursor row is
    // still in the filtered set. Attributing or refunding a receipt takes it
    // out of the status filter being paged on, and the OFFSET then eats a real
    // row while hasMore still claims the list was complete.
    const cursor = {
      createdAt: new Date("2026-09-18T10:00:01.000Z"),
      id: "11111111-1111-4111-8111-111111111111",
    };

    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
      cursor,
    });

    const [args] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(args.where.AND).toContainEqual({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });
    expect(args).not.toHaveProperty("cursor");
    expect(args).not.toHaveProperty("skip");
  });

  it("reads one more row than the page so hasMore needs no second query", async () => {
    const rows = Array.from(
      { length: RECONCILIATION_PAGE_SIZE.maxSize + 1 },
      (_, index) =>
        row({
          id: `11111111-1111-4111-8111-${index.toString().padStart(12, "0")}`,
        }),
    );
    mockedPrisma.providerReceipt.findMany.mockResolvedValue(rows);

    const page = await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
    });

    const [{ take }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(take).toBe(RECONCILIATION_PAGE_SIZE.maxSize + 1);
    expect(page.receipts).toHaveLength(RECONCILIATION_PAGE_SIZE.maxSize);
    expect(page.hasMore).toBe(true);
  });

  it("hands back a cursor carrying the whole sort key of the last row on the page", async () => {
    const last = row({
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-09-18T09:00:00.000Z"),
    });
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([
      row(),
      last,
      row({ id: "33333333-3333-4333-8333-333333333333" }),
    ]);

    const page = await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
      limit: "2",
    });

    expect(page.nextCursor).toBe(
      encodeKeysetCursor({ createdAt: last.createdAt, id: last.id }),
    );
    expect(page.limit).toBe(2);
  });

  it("says the list is complete when the read did not fill the extra row", async () => {
    mockedPrisma.providerReceipt.findMany.mockResolvedValue([row()]);

    const page = await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
      limit: "2",
    });

    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.receipts).toHaveLength(1);
  });

  it("clamps an oversized page rather than returning an unbounded one", async () => {
    await ProviderReceiptService.listForReconciliation({
      organisationId: "org-a",
      limit: "1000",
    });

    const [{ take }] = mockedPrisma.providerReceipt.findMany.mock.calls[0];
    expect(take).toBe(RECONCILIATION_PAGE_SIZE.maxSize + 1);
  });
});
