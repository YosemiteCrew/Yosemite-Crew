import { EstimateService } from "../../src/services/estimate.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
    estimate: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
      delete: jest.fn(),
    },
    invoice: { create: jest.fn(), findFirst: jest.fn() },
    // The interactive form hands the callback a client; the tests run it against
    // the same mocks so the transaction body is genuinely exercised rather than
    // stubbed out.
    $transaction: jest.fn(),
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";
import { AuditTrailService } from "../../src/services/audit-trail.service";

const mockCreate = prisma.estimate.create as jest.Mock;
const mockFindFirst = prisma.estimate.findFirst as jest.Mock;
const mockFindMany = prisma.estimate.findMany as jest.Mock;
const mockUpdate = prisma.estimate.update as jest.Mock;
const mockDelete = prisma.estimate.delete as jest.Mock;
const mockUpdateMany = prisma.estimate.updateMany as jest.Mock;
const mockFindFirstOrThrow = prisma.estimate.findFirstOrThrow as jest.Mock;
const mockInvoiceCreate = prisma.invoice.create as jest.Mock;
const mockInvoiceFindFirst = prisma.invoice.findFirst as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;

const baseItem = {
  id: "item-1",
  description: "Spay procedure",
  quantity: 1,
  unitPrice: 250,
  taxRate: 20,
  lineTotal: 250,
  notes: null,
};

const baseEstimate = {
  id: "est-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  status: "DRAFT" as const,
  validUntil: null,
  subtotal: 250,
  taxAmount: 50,
  total: 300,
  currency: "GBP",
  notes: null,
  approvedBy: null,
  approvedAt: null,
  declinedAt: null,
  declineReason: null,
  convertedToInvoiceId: null,
  createdBy: "vet-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [baseItem],
};

beforeEach(() => {
  jest.clearAllMocks();

  // Default: the companion belongs to the caller's organisation, so every

  // pre-existing case keeps its original meaning. Cross-tenant is asserted

  // explicitly in its own test below.

  (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue({
    id: "patient-org-1",
  });
});

describe("EstimateService.create", () => {
  it("creates estimate and computes totals from items", async () => {
    mockCreate.mockResolvedValue(baseEstimate);
    const result = await EstimateService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      items: [
        {
          description: "Spay procedure",
          quantity: 1,
          unitPrice: 250,
          taxRate: 20,
        },
      ],
      createdBy: "vet-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 250,
          taxAmount: 50,
          total: 300,
        }),
      }),
    );
    expect(result.status).toBe("DRAFT");
    expect(result.items).toHaveLength(1);
  });
});

describe("EstimateService.get", () => {
  it("returns estimate when found", async () => {
    mockFindFirst.mockResolvedValue(baseEstimate);
    const result = await EstimateService.get("est-1", "org-1");
    expect(result.id).toBe("est-1");
    expect(result.total).toBe(300);
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(EstimateService.get("est-x", "org-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("EstimateService.list", () => {
  it("filters by status", async () => {
    mockFindMany.mockResolvedValue([baseEstimate]);
    await EstimateService.list({ organisationId: "org-1", status: "DRAFT" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DRAFT" }),
      }),
    );
  });

  it("filters by patientId", async () => {
    mockFindMany.mockResolvedValue([baseEstimate]);
    await EstimateService.list({ organisationId: "org-1", patientId: "pat-1" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: "pat-1" }),
      }),
    );
  });
});

describe("EstimateService.update", () => {
  it("updates notes and replaces items with recalculated totals", async () => {
    const updated = {
      ...baseEstimate,
      notes: "updated",
      subtotal: 100,
      total: 100,
    };
    mockFindFirst.mockResolvedValue(baseEstimate);
    mockUpdate.mockResolvedValue(updated);
    const result = await EstimateService.update("est-1", "org-1", {
      notes: "updated",
      items: [{ description: "Consult", quantity: 1, unitPrice: 100 }],
    });
    expect(result.notes).toBe("updated");
  });

  it("throws 409 when estimate is approved", async () => {
    mockFindFirst.mockResolvedValue({ ...baseEstimate, status: "APPROVED" });
    await expect(
      EstimateService.update("est-1", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      EstimateService.update("est-x", "org-1", { notes: "x" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("EstimateService.approve", () => {
  it("approves a DRAFT estimate", async () => {
    const approved = {
      ...baseEstimate,
      status: "APPROVED",
      approvedBy: "vet-1",
    };
    mockFindFirst.mockResolvedValue(baseEstimate);
    mockUpdate.mockResolvedValue(approved);
    const result = await EstimateService.approve("est-1", "org-1", "vet-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          approvedBy: "vet-1",
        }),
      }),
    );
    expect(result.status).toBe("APPROVED");
  });

  it("throws 409 when already approved", async () => {
    mockFindFirst.mockResolvedValue({ ...baseEstimate, status: "APPROVED" });
    await expect(
      EstimateService.approve("est-1", "org-1", "vet-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("EstimateService.decline", () => {
  it("declines with a reason", async () => {
    const declined = {
      ...baseEstimate,
      status: "DECLINED",
      declineReason: "Too expensive",
    };
    mockFindFirst.mockResolvedValue({ ...baseEstimate, status: "SENT" });
    mockUpdate.mockResolvedValue(declined);
    const result = await EstimateService.decline(
      "est-1",
      "org-1",
      "owner-1",
      "Too expensive",
    );
    expect(result.declineReason).toBe("Too expensive");
  });
});

describe("EstimateService.markSent", () => {
  it("transitions DRAFT to SENT", async () => {
    mockFindFirst.mockResolvedValue(baseEstimate);
    mockUpdate.mockResolvedValue({ ...baseEstimate, status: "SENT" });
    const result = await EstimateService.markSent("est-1", "org-1");
    expect(result.status).toBe("SENT");
  });

  it("throws 409 when not DRAFT", async () => {
    mockFindFirst.mockResolvedValue({ ...baseEstimate, status: "SENT" });
    await expect(
      EstimateService.markSent("est-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("EstimateService.delete", () => {
  it("deletes a DRAFT estimate", async () => {
    mockFindFirst.mockResolvedValue(baseEstimate);
    mockDelete.mockResolvedValue(undefined);
    await EstimateService.delete("est-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "est-1" } });
  });

  it("throws 409 when estimate is not DRAFT", async () => {
    mockFindFirst.mockResolvedValue({ ...baseEstimate, status: "APPROVED" });
    await expect(
      EstimateService.delete("est-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      EstimateService.delete("est-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("EstimateService cross-tenant protection", () => {
  it("refuses to write against a companion in another organisation", async () => {
    // The caller is a legitimate member of org-1; the companion is not.
    (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      EstimateService.create({
        organisationId: "org-1",
        patientId: "pat-1",
        items: [
          {
            description: "Spay procedure",
            quantity: 1,
            unitPrice: 250,
            taxRate: 20,
          },
        ],
        createdBy: "vet-1",
      }),
    ).rejects.toThrow("Companion not found.");

    // Rejecting is not enough - nothing may be persisted on the way out.
    expect(prisma.estimate.create as jest.Mock).not.toHaveBeenCalled();
  });
});

describe("EstimateService.convert", () => {
  const approved = {
    ...baseEstimate,
    status: "APPROVED",
    convertedToInvoiceId: null,
  };

  beforeEach(() => {
    mockInvoiceCreate.mockResolvedValue({ id: "inv-1" });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindFirstOrThrow.mockResolvedValue({
      ...approved,
      status: "CONVERTED",
      convertedToInvoiceId: "inv-1",
    });
    // Run the transaction body against the same mocks, so the assertions below
    // are about the real sequence rather than a stub.
    mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
  });

  it("creates the invoice and claims the estimate", async () => {
    mockFindFirst.mockResolvedValue(approved);

    const result = await EstimateService.convert("est-1", "org-1", "user-1");

    expect(mockInvoiceCreate).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("CONVERTED");
    expect(result.convertedToInvoiceId).toBe("inv-1");
  });

  it("copies the approved totals instead of recomputing them", async () => {
    // The client agreed to a figure; a later pricing change must not move it.
    mockFindFirst.mockResolvedValue(approved);
    await EstimateService.convert("est-1", "org-1", "user-1");

    const data = mockInvoiceCreate.mock.calls[0][0].data;
    expect(data.subtotal).toBe(approved.subtotal);
    expect(data.taxTotal).toBe(approved.taxAmount);
    expect(data.totalAmount).toBe(approved.total);
    expect(data.currency).toBe(approved.currency);
  });

  it("does not copy the estimate item id onto the invoice line", async () => {
    // An invoice line id is matched against WorkspaceTreatmentItem.invoiceRowId
    // when settling treatment items, so a copied id could settle an unrelated row.
    mockFindFirst.mockResolvedValue(approved);
    await EstimateService.convert("est-1", "org-1", "user-1");

    const items = mockInvoiceCreate.mock.calls[0][0].data.items as Record<
      string,
      unknown
    >[];
    expect(items[0]).not.toHaveProperty("id");
    expect(items[0].total).toBe(baseItem.lineTotal);
  });

  it("never sets appointmentId, which is unique and owned by the appointment", async () => {
    mockFindFirst.mockResolvedValue(approved);
    await EstimateService.convert("est-1", "org-1", "user-1");
    expect(
      mockInvoiceCreate.mock.calls[0][0].data.appointmentId,
    ).toBeUndefined();
  });

  it("links the invoice back to the estimate for the unique constraint", async () => {
    mockFindFirst.mockResolvedValue(approved);
    await EstimateService.convert("est-1", "org-1", "user-1");
    expect(mockInvoiceCreate.mock.calls[0][0].data.estimateId).toBe("est-1");
  });

  it("claims the estimate conditionally, so a concurrent convert cannot win twice", async () => {
    mockFindFirst.mockResolvedValue(approved);
    await EstimateService.convert("est-1", "org-1", "user-1");

    // The guards must be in the WHERE clause. An unconditional update by id is
    // last-write-wins and would mint a second invoice under a double-click.
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "est-1",
          organisationId: "org-1",
          status: "APPROVED",
          convertedToInvoiceId: null,
        },
      }),
    );
  });

  it("throws inside the transaction when the claim matches nothing", async () => {
    mockFindFirst.mockResolvedValue(approved);
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      EstimateService.convert("est-1", "org-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
    // Throwing inside the transaction is what rolls the invoice back, so the
    // loser of the race leaves no orphan behind.
    expect(mockTransaction).toHaveBeenCalled();
  });

  it("replays instead of failing when the estimate is already converted", async () => {
    // A lost response must not push the user into raising a second invoice by hand.
    const already = {
      ...baseEstimate,
      status: "CONVERTED",
      convertedToInvoiceId: "inv-1",
    };
    mockFindFirst.mockResolvedValue(already);
    mockInvoiceFindFirst.mockResolvedValue({ id: "inv-1" });

    const result = await EstimateService.convert("est-1", "org-1", "user-1");

    expect(result).toBe(already);
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });

  it("scopes the replay lookup to the organisation", async () => {
    // convertedToInvoiceId has no foreign key, so the id it holds is not
    // guaranteed to belong to this tenant.
    mockFindFirst.mockResolvedValue({
      ...baseEstimate,
      status: "CONVERTED",
      convertedToInvoiceId: "inv-1",
    });
    mockInvoiceFindFirst.mockResolvedValue({ id: "inv-1" });
    await EstimateService.convert("est-1", "org-1", "user-1");

    expect(mockInvoiceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1", organisationId: "org-1" },
      }),
    );
  });

  it.each([["DRAFT"], ["SENT"], ["DECLINED"], ["EXPIRED"]])(
    "refuses to convert a %s estimate",
    async (status) => {
      mockFindFirst.mockResolvedValue({
        ...baseEstimate,
        status,
        convertedToInvoiceId: null,
      });
      await expect(
        EstimateService.convert("est-1", "org-1", "user-1"),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mockInvoiceCreate).not.toHaveBeenCalled();
    },
  );

  it("refuses to convert an estimate with no items", async () => {
    mockFindFirst.mockResolvedValue({ ...approved, items: [] });
    await expect(
      EstimateService.convert("est-1", "org-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });

  it("404s when the estimate belongs to another organisation", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      EstimateService.convert("est-1", "org-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("records the audit event outside the transaction", async () => {
    mockFindFirst.mockResolvedValue(approved);
    await EstimateService.convert("est-1", "org-1", "user-1");

    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ESTIMATE_CONVERTED",
        actorId: "user-1",
        metadata: expect.objectContaining({ invoiceId: "inv-1" }),
      }),
    );
  });

  it("derives the blended tax percent from the copied totals", async () => {
    mockFindFirst.mockResolvedValue(approved);
    await EstimateService.convert("est-1", "org-1", "user-1");
    const data = mockInvoiceCreate.mock.calls[0][0].data;
    expect(data.taxPercent).toBeCloseTo(
      (approved.taxAmount / approved.subtotal) * 100,
      2,
    );
  });
});
