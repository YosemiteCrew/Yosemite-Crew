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
    expect(query.sql).toContain("i.\"visitBillingStage\" <> 'SETTLED'");
    expect(query.sql).toContain(
      "i.\"status\" NOT IN ('CANCELLED', 'REFUNDED')",
    );
    expect(query.values).toContain("org-1");
    expect(query.sql).toContain("LIMIT");
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
    expect(query.values).toContain(cursorId);
    expect(query.values).toContain(date);
  });
});
