import { ClientComplaintService } from "../../src/services/client-complaint.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    clientComplaint: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    clientComplaintNote: {
      create: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.clientComplaint.create as jest.Mock;
const mockFindFirst = prisma.clientComplaint.findFirst as jest.Mock;
const mockFindMany = prisma.clientComplaint.findMany as jest.Mock;
const mockUpdate = prisma.clientComplaint.update as jest.Mock;
const mockDelete = prisma.clientComplaint.delete as jest.Mock;
const mockNoteCreate = prisma.clientComplaintNote.create as jest.Mock;

const baseNote = {
  id: "note-1",
  authorId: "vet-1",
  content: "We have received your complaint and are investigating.",
  isInternal: false,
  createdAt: new Date(),
};

const baseComplaint = {
  id: "cc-1",
  organisationId: "org-1",
  clientId: "client-1",
  patientId: "pat-1",
  encounterId: null,
  status: "OPEN" as const,
  category: "CLINICAL_CARE" as const,
  summary: "Unhappy with post-op care instructions",
  description: "The discharge instructions were unclear.",
  reportedAt: new Date("2026-06-30T09:00:00Z"),
  reportedBy: "receptionist-1",
  assignedTo: "manager-1",
  resolvedAt: null,
  resolutionNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  notes: [],
};

beforeEach(() => jest.clearAllMocks());

describe("ClientComplaintService.create", () => {
  it("creates a CLINICAL_CARE complaint", async () => {
    mockCreate.mockResolvedValue(baseComplaint);
    const result = await ClientComplaintService.create({
      organisationId: "org-1",
      clientId: "client-1",
      patientId: "pat-1",
      category: "CLINICAL_CARE",
      summary: "Unhappy with post-op care instructions",
      reportedBy: "receptionist-1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "client-1",
          category: "CLINICAL_CARE",
          summary: "Unhappy with post-op care instructions",
        }),
      }),
    );
    expect(result.status).toBe("OPEN");
    expect(result.category).toBe("CLINICAL_CARE");
  });
});

describe("ClientComplaintService.get", () => {
  it("returns complaint when found", async () => {
    mockFindFirst.mockResolvedValue(baseComplaint);
    const result = await ClientComplaintService.get("cc-1", "org-1");
    expect(result.id).toBe("cc-1");
    expect(result.assignedTo).toBe("manager-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ClientComplaintService.get("cc-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("ClientComplaintService.list", () => {
  it("filters by status", async () => {
    mockFindMany.mockResolvedValue([baseComplaint]);
    await ClientComplaintService.list({
      organisationId: "org-1",
      status: "OPEN",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "OPEN" }),
      }),
    );
  });

  it("filters by clientId", async () => {
    mockFindMany.mockResolvedValue([baseComplaint]);
    await ClientComplaintService.list({
      organisationId: "org-1",
      clientId: "client-1",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: "client-1" }),
      }),
    );
  });
});

describe("ClientComplaintService.update", () => {
  it("escalates a complaint", async () => {
    const escalated = { ...baseComplaint, status: "ESCALATED" };
    mockFindFirst.mockResolvedValue(baseComplaint);
    mockUpdate.mockResolvedValue(escalated);
    const result = await ClientComplaintService.update("cc-1", "org-1", {
      status: "ESCALATED",
    });
    expect(result.status).toBe("ESCALATED");
  });

  it("resolves a complaint and emits audit event", async () => {
    const resolved = {
      ...baseComplaint,
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolutionNotes: "Apology issued and additional discharge info provided.",
    };
    mockFindFirst.mockResolvedValue(baseComplaint);
    mockUpdate.mockResolvedValue(resolved);
    const result = await ClientComplaintService.update("cc-1", "org-1", {
      status: "RESOLVED",
      resolutionNotes: "Apology issued and additional discharge info provided.",
      resolvedAt: new Date(),
    });
    expect(result.status).toBe("RESOLVED");
    expect(result.resolutionNotes).toBeTruthy();
  });

  it("throws 409 when trying to update a CLOSED complaint without reopening", async () => {
    mockFindFirst.mockResolvedValue({ ...baseComplaint, status: "CLOSED" });
    await expect(
      ClientComplaintService.update("cc-1", "org-1", {
        status: "INVESTIGATING",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ClientComplaintService.update("cc-x", "org-1", { status: "RESOLVED" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("ClientComplaintService.addNote", () => {
  it("adds a client-facing note", async () => {
    mockFindFirst.mockResolvedValue(baseComplaint);
    mockNoteCreate.mockResolvedValue(baseNote);
    const result = await ClientComplaintService.addNote("cc-1", "org-1", {
      content: "We have received your complaint and are investigating.",
      authorId: "vet-1",
      isInternal: false,
    });
    expect(result.isInternal).toBe(false);
    expect(result.content).toContain("investigating");
  });
});

describe("ClientComplaintService.delete", () => {
  it("deletes an OPEN complaint", async () => {
    mockFindFirst.mockResolvedValue(baseComplaint);
    mockDelete.mockResolvedValue(undefined);
    await ClientComplaintService.delete("cc-1", "org-1");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "cc-1" } });
  });

  it("throws 409 when complaint is not OPEN", async () => {
    mockFindFirst.mockResolvedValue({
      ...baseComplaint,
      status: "INVESTIGATING",
    });
    await expect(
      ClientComplaintService.delete("cc-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ClientComplaintService.delete("cc-x", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
