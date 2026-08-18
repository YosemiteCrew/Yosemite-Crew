import { SurgicalChecklistService } from "../../src/services/surgical-checklist.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
    surgicalChecklist: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    surgicalChecklistItem: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.surgicalChecklist.create as jest.Mock;
const mockFindFirst = prisma.surgicalChecklist.findFirst as jest.Mock;
const mockFindMany = prisma.surgicalChecklist.findMany as jest.Mock;
const mockUpdate = prisma.surgicalChecklist.update as jest.Mock;
const mockDelete = prisma.surgicalChecklist.delete as jest.Mock;
const mockItemFindFirst = prisma.surgicalChecklistItem.findFirst as jest.Mock;
const mockItemUpdate = prisma.surgicalChecklistItem.update as jest.Mock;

const baseItem = {
  id: "item-1",
  label: "Patient identity confirmed",
  isChecked: false,
  checkedBy: null,
  checkedAt: null,
  notes: null,
  sortOrder: 0,
};

const baseChecklist = {
  id: "sc-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  phase: "SIGN_IN" as const,
  status: "PENDING" as const,
  conductedBy: null,
  completedAt: null,
  notes: null,
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

describe("SurgicalChecklistService.create", () => {
  it("creates a SIGN_IN checklist with items", async () => {
    mockCreate.mockResolvedValue(baseChecklist);
    const result = await SurgicalChecklistService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      phase: "SIGN_IN",
      items: [{ label: "Patient identity confirmed" }],
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encounterId: "enc-1",
          phase: "SIGN_IN",
        }),
      }),
    );
    expect(result.phase).toBe("SIGN_IN");
    expect(result.items).toHaveLength(1);
  });
});

describe("SurgicalChecklistService.get", () => {
  it("returns checklist when found", async () => {
    mockFindFirst.mockResolvedValue(baseChecklist);
    const result = await SurgicalChecklistService.get("sc-1", "org-1");
    expect(result.id).toBe("sc-1");
    expect(result.encounterId).toBe("enc-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      SurgicalChecklistService.get("sc-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("SurgicalChecklistService.list", () => {
  it("filters by encounter", async () => {
    mockFindMany.mockResolvedValue([baseChecklist]);
    await SurgicalChecklistService.list({
      organisationId: "org-1",
      encounterId: "enc-1",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ encounterId: "enc-1" }),
      }),
    );
  });
});

describe("SurgicalChecklistService.update", () => {
  const allChecked = {
    ...baseChecklist,
    items: [{ ...baseItem, isChecked: true }],
  };

  it("advances checklist to COMPLETED and emits audit event", async () => {
    const completed = { ...allChecked, status: "COMPLETED" };
    mockFindFirst.mockResolvedValue(allChecked);
    mockUpdate.mockResolvedValue(completed);
    const result = await SurgicalChecklistService.update("sc-1", "org-1", {
      status: "COMPLETED",
      completedAt: new Date(),
    });
    expect(result.status).toBe("COMPLETED");
  });

  it("refuses completion while any item is unchecked", async () => {
    // A completed checklist is audited and undeletable, so it must not be
    // reachable with 0 of N safety items actually checked.
    mockFindFirst.mockResolvedValue(baseChecklist);
    await expect(
      SurgicalChecklistService.update("sc-1", "org-1", { status: "COMPLETED" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "All checklist items must be checked before completion.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("derives completedAt when none is supplied", async () => {
    mockFindFirst.mockResolvedValue(allChecked);
    mockUpdate.mockResolvedValue({ ...allChecked, status: "COMPLETED" });
    await SurgicalChecklistService.update("sc-1", "org-1", {
      status: "COMPLETED",
    });
    expect(mockUpdate.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
  });

  it("clears completedAt when moving back out of COMPLETED", async () => {
    mockFindFirst.mockResolvedValue({
      ...allChecked,
      status: "COMPLETED",
      completedAt: new Date(),
    });
    mockUpdate.mockResolvedValue({ ...allChecked, status: "IN_PROGRESS" });
    await SurgicalChecklistService.update("sc-1", "org-1", {
      status: "IN_PROGRESS",
    });
    expect(mockUpdate.mock.calls[0][0].data.completedAt).toBeNull();
  });

  it("leaves completedAt alone on a non-status edit", async () => {
    mockFindFirst.mockResolvedValue(baseChecklist);
    mockUpdate.mockResolvedValue({ ...baseChecklist, notes: "n" });
    await SurgicalChecklistService.update("sc-1", "org-1", { notes: "n" });
    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("completedAt");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      SurgicalChecklistService.update("sc-x", "org-1", {
        status: "IN_PROGRESS",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("SurgicalChecklistService.checkItem", () => {
  it("marks item as checked", async () => {
    const checked = { ...baseItem, isChecked: true, checkedBy: "vet-1" };
    mockFindFirst.mockResolvedValue(baseChecklist);
    mockItemFindFirst.mockResolvedValue(baseItem);
    mockItemUpdate.mockResolvedValue(checked);
    const result = await SurgicalChecklistService.checkItem(
      "sc-1",
      "item-1",
      "org-1",
      { checkedBy: "vet-1" },
    );
    expect(result.isChecked).toBe(true);
    expect(result.checkedBy).toBe("vet-1");
  });

  it("throws 404 when checklist item not found", async () => {
    mockFindFirst.mockResolvedValue(baseChecklist);
    mockItemFindFirst.mockResolvedValue(null);
    await expect(
      SurgicalChecklistService.checkItem("sc-1", "item-x", "org-1", {}),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("SurgicalChecklistService.uncheckItem", () => {
  it("unchecks a previously checked item", async () => {
    const unchecked = {
      ...baseItem,
      isChecked: false,
      checkedBy: null,
      checkedAt: null,
    };
    mockFindFirst.mockResolvedValue(baseChecklist);
    mockItemFindFirst.mockResolvedValue({ ...baseItem, isChecked: true });
    mockItemUpdate.mockResolvedValue(unchecked);
    const result = await SurgicalChecklistService.uncheckItem(
      "sc-1",
      "item-1",
      "org-1",
    );
    expect(result.isChecked).toBe(false);
  });
});

describe("SurgicalChecklistService.delete", () => {
  it("deletes a PENDING checklist", async () => {
    mockFindFirst.mockResolvedValue(baseChecklist);
    mockDelete.mockResolvedValue(undefined);
    await SurgicalChecklistService.delete("sc-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "sc-1" } });
  });

  it("throws 409 when checklist is completed", async () => {
    mockFindFirst.mockResolvedValue({ ...baseChecklist, status: "COMPLETED" });
    await expect(
      SurgicalChecklistService.delete("sc-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("SurgicalChecklistService cross-tenant protection", () => {
  it("refuses to write against a companion in another organisation", async () => {
    // The caller is a legitimate member of org-1; the companion is not.
    (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      SurgicalChecklistService.create({
        organisationId: "org-1",
        patientId: "pat-1",
        encounterId: "enc-1",
        phase: "SIGN_IN",
        items: [{ label: "Patient identity confirmed" }],
      }),
    ).rejects.toThrow("Companion not found.");

    // Rejecting is not enough - nothing may be persisted on the way out.
    expect(prisma.surgicalChecklist.create as jest.Mock).not.toHaveBeenCalled();
  });
});
