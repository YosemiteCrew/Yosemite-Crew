import { prisma } from "src/config/prisma";
import { encodeKeysetCursor } from "src/services/shared/pagination";
import { BillingReviewService } from "src/services/billing-review.service";

jest.mock("src/config/prisma", () => ({
  prisma: { $queryRaw: jest.fn() },
}));

const queryRaw = prisma.$queryRaw as jest.Mock;
const date = new Date("2026-09-01T10:00:00.000Z");
const row = (id: string) => ({
  id,
  appointmentDate: date,
  patientName: "Biscuit",
  clientName: "Milo Ferraro",
  appointmentType: "Wellness exam",
  invoiceId: null,
  invoiceStatus: null,
  invoiceTotal: null,
  currency: null,
  billingStatus: "MISSING_INVOICE" as const,
});

beforeEach(() => jest.clearAllMocks());

describe("BillingReviewService.list", () => {
  it("returns a bounded page and a cursor from the last visible visit", async () => {
    queryRaw.mockResolvedValue([
      row("00000000-0000-4000-8000-000000000001"),
      row("00000000-0000-4000-8000-000000000002"),
    ]);

    const page = await BillingReviewService.list("org-1", 1);

    expect(page).toEqual({
      items: [row("00000000-0000-4000-8000-000000000001")],
      hasMore: true,
      nextCursor: encodeKeysetCursor({
        createdAt: date,
        id: "00000000-0000-4000-8000-000000000001",
      }),
    });
    const query = queryRaw.mock.calls[0][0];
    expect(query.sql).toContain('a."organisationId" =');
    expect(query.sql).toContain("a.\"status\" = 'COMPLETED'");
    expect(query.values).toContain("org-1");
    expect(query.values).toContain(2);
    expect(query.sql).toContain("LIMIT");
  });

  it("reports only the three incomplete-billing reasons, scoped to the visit's org", async () => {
    queryRaw.mockResolvedValue([]);

    await BillingReviewService.list("org-1", 50);

    const sql: string = queryRaw.mock.calls[0][0].sql;
    expect(sql).toContain(`WHEN i."id" IS NULL THEN 'MISSING_INVOICE'`);
    expect(sql).toContain(`i."visitBillingStage" = 'DRAFT'`);
    expect(sql).toContain(`i."status" NOT IN ('CANCELLED', 'REFUNDED')`);
    expect(sql).toContain("THEN 'UNBILLED_CHARGES'");
    expect(sql).toContain(`t."organisationId" = a."organisationId"`);
    expect(sql).toContain(`t."billingStatus" = 'UNBILLED'`);
    expect(sql).toContain(`i."organisationId" = a."organisationId"`);
    expect(sql).toContain(`visit."billingStatus" IS NOT NULL`);
    expect(sql).not.toContain("READY_FOR_BILLING");
    expect(sql).toContain(`i."currency" AS "currency"`);
    expect(sql).not.toMatch(/\bSUM\s*\(/i);
  });

  it("applies the composite cursor to continue after the last appointment", async () => {
    const cursorId = "00000000-0000-4000-8000-000000000001";
    queryRaw.mockResolvedValue([]);

    await BillingReviewService.list("org-1", 50, {
      createdAt: date,
      id: cursorId,
    });

    const query = queryRaw.mock.calls[0][0];
    expect(query.sql).toContain('a."appointmentDate" <');
    expect(query.sql).toContain('a."id" <');
    expect(query.sql).not.toContain("::uuid");
    // The column holds UTC wall time; the cursor must not shift with the
    // database session time zone.
    expect(query.sql).toContain("::timestamptz AT TIME ZONE 'UTC'");
    expect(query.values).toContain(cursorId);
    expect(query.values).toContain(date);
  });
});
