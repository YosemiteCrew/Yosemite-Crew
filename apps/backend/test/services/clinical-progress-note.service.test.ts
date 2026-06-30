import { ClinicalProgressNoteService } from "../../src/services/clinical-progress-note.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    clinicalProgressNote: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.clinicalProgressNote.create as jest.Mock;
const mockFindFirst = prisma.clinicalProgressNote.findFirst as jest.Mock;
const mockFindMany = prisma.clinicalProgressNote.findMany as jest.Mock;
const mockUpdate = prisma.clinicalProgressNote.update as jest.Mock;

const baseNote = {
  id: "cpn-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  noteType: "PROGRESS_NOTE" as const,
  subjectiveFindings: "Patient comfortable",
  objectiveFindings: "HR 80, RR 20",
  assessment: "Post-op day 1, stable",
  plan: "Continue current management",
  freeText: null,
  authorId: "vet-1",
  authorName: "Dr Smith",
  signedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("ClinicalProgressNoteService.create", () => {
  it("creates a note without signing it", async () => {
    mockCreate.mockResolvedValue(baseNote);
    const result = await ClinicalProgressNoteService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      noteType: "PROGRESS_NOTE",
      subjectiveFindings: "Patient comfortable",
      authorId: "vet-1",
      authorName: "Dr Smith",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ noteType: "PROGRESS_NOTE" }),
      }),
    );
    expect(result.signedAt).toBeNull();
  });
});

describe("ClinicalProgressNoteService.get", () => {
  it("returns note when found", async () => {
    mockFindFirst.mockResolvedValue(baseNote);
    const result = await ClinicalProgressNoteService.get("cpn-1", "org-1");
    expect(result.id).toBe("cpn-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      ClinicalProgressNoteService.get("cpn-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("ClinicalProgressNoteService.list", () => {
  it("returns notes for an organisation", async () => {
    mockFindMany.mockResolvedValue([baseNote]);
    const result = await ClinicalProgressNoteService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by noteType when provided", async () => {
    mockFindMany.mockResolvedValue([]);
    await ClinicalProgressNoteService.list({
      organisationId: "org-1",
      noteType: "SHIFT_NOTE",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ noteType: "SHIFT_NOTE" }),
      }),
    );
  });
});

describe("ClinicalProgressNoteService.update", () => {
  it("updates an unsigned note", async () => {
    const updated = { ...baseNote, assessment: "Day 2, improving" };
    mockFindFirst.mockResolvedValue(baseNote);
    mockUpdate.mockResolvedValue(updated);
    const result = await ClinicalProgressNoteService.update("cpn-1", "org-1", {
      assessment: "Day 2, improving",
    });
    expect(result.assessment).toBe("Day 2, improving");
  });

  it("throws 409 when note is already signed", async () => {
    mockFindFirst.mockResolvedValue({ ...baseNote, signedAt: new Date() });
    await expect(
      ClinicalProgressNoteService.update("cpn-1", "org-1", { assessment: "x" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("ClinicalProgressNoteService.sign", () => {
  it("stamps signedAt on an unsigned note", async () => {
    const signed = { ...baseNote, signedAt: new Date() };
    mockFindFirst.mockResolvedValue(baseNote);
    mockUpdate.mockResolvedValue(signed);
    const result = await ClinicalProgressNoteService.sign(
      "cpn-1",
      "org-1",
      "vet-1",
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signedAt: expect.any(Date) }),
      }),
    );
    expect(result.signedAt).toBeDefined();
  });

  it("throws 409 when already signed", async () => {
    mockFindFirst.mockResolvedValue({ ...baseNote, signedAt: new Date() });
    await expect(
      ClinicalProgressNoteService.sign("cpn-1", "org-1", "vet-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
