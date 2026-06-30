import { EstimateService } from "../../src/services/estimate.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    estimate: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.estimate.create as jest.Mock;
const mockFindFirst = prisma.estimate.findFirst as jest.Mock;
const mockFindMany = prisma.estimate.findMany as jest.Mock;
const mockUpdate = prisma.estimate.update as jest.Mock;
const mockDelete = prisma.estimate.delete as jest.Mock;

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

beforeEach(() => jest.clearAllMocks());

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
