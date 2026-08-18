import {
  ClinicNoteService,
  ClinicNoteError,
} from "../../src/services/clinic-note.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    clinicNote: {
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
import { AuditTrailService } from "../../src/services/audit-trail.service";

const mockCreate = prisma.clinicNote.create as jest.Mock;
const mockFindFirst = prisma.clinicNote.findFirst as jest.Mock;
const mockFindMany = prisma.clinicNote.findMany as jest.Mock;
const mockUpdate = prisma.clinicNote.update as jest.Mock;
const mockDelete = prisma.clinicNote.delete as jest.Mock;
const mockAudit = AuditTrailService.recordSafely as jest.Mock;

const baseNote = {
  id: "note-1",
  organisationId: "org-1",
  subjectType: "PATIENT" as const,
  subjectId: "pat-1",
  noteType: "GENERAL" as const,
  content: "Owner called about the limp",
  isPinned: false,
  createdBy: "user-1",
  createdAt: new Date("2026-03-01T09:00:00.000Z"),
  updatedAt: new Date("2026-03-01T09:00:00.000Z"),
};

beforeEach(() => jest.clearAllMocks());

describe("ClinicNoteService.create", () => {
  it("defaults the note type, pin state and author, then records an audit event", async () => {
    mockCreate.mockResolvedValue(baseNote);

    const result = await ClinicNoteService.create({
      organisationId: "org-1",
      subjectType: "PATIENT",
      subjectId: "pat-1",
      content: "Owner called about the limp",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        organisationId: "org-1",
        subjectType: "PATIENT",
        subjectId: "pat-1",
        noteType: "GENERAL",
        content: "Owner called about the limp",
        isPinned: false,
        createdBy: null,
      },
      select: expect.objectContaining({ id: true, content: true }),
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        patientId: "pat-1",
        eventType: "CLINIC_NOTE_CREATED",
        actorType: "PMS_USER",
        actorId: null,
        entityType: "COMPANION",
        entityId: "pat-1",
        metadata: {
          noteId: "note-1",
          subjectType: "PATIENT",
          noteType: "GENERAL",
          isPinned: false,
        },
      }),
    );
    expect(result).toBe(baseNote);
  });

  it("keeps the caller's note type, pin state and author", async () => {
    mockCreate.mockResolvedValue({
      ...baseNote,
      noteType: "BILLING",
      isPinned: true,
    });

    await ClinicNoteService.create({
      organisationId: "org-1",
      subjectType: "CLIENT",
      subjectId: "client-9",
      noteType: "BILLING",
      content: "Payment plan agreed",
      isPinned: true,
      createdBy: "user-7",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subjectType: "CLIENT",
          noteType: "BILLING",
          isPinned: true,
          createdBy: "user-7",
        }),
      }),
    );
  });

  it("leaves the audit patientId blank for non-patient subjects", async () => {
    mockCreate.mockResolvedValue({ ...baseNote, subjectType: "APPOINTMENT" });

    await ClinicNoteService.create({
      organisationId: "org-1",
      subjectType: "APPOINTMENT",
      subjectId: "appt-3",
      content: "Rebooked for Friday",
    });

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "", entityId: "appt-3" }),
    );
  });

  it("rejects whitespace-only content before touching the database", async () => {
    await expect(
      ClinicNoteService.create({
        organisationId: "org-1",
        subjectType: "PATIENT",
        subjectId: "pat-1",
        content: "   ",
      }),
    ).rejects.toMatchObject({
      name: "ClinicNoteError",
      statusCode: 400,
      message: "Note content cannot be empty.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });
});

describe("ClinicNoteService.get", () => {
  it("scopes the lookup to the organisation", async () => {
    mockFindFirst.mockResolvedValue(baseNote);

    await expect(ClinicNoteService.get("note-1", "org-1")).resolves.toBe(
      baseNote,
    );
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "note-1", organisationId: "org-1" },
      select: expect.objectContaining({ id: true }),
    });
  });

  it("throws a 404 when the note belongs to another organisation", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      ClinicNoteService.get("note-1", "org-2"),
    ).rejects.toBeInstanceOf(ClinicNoteError);
    await expect(
      ClinicNoteService.get("note-1", "org-2"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Clinic note not found.",
    });
  });
});

describe("ClinicNoteService.list", () => {
  it("applies every supplied filter and pins first", async () => {
    mockFindMany.mockResolvedValue([baseNote]);

    await ClinicNoteService.list({
      organisationId: "org-1",
      subjectType: "PATIENT",
      subjectId: "pat-1",
      noteType: "ALERT",
      isPinned: false,
    });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        subjectType: "PATIENT",
        subjectId: "pat-1",
        noteType: "ALERT",
        isPinned: false,
      },
      select: expect.objectContaining({ id: true }),
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
  });

  it("omits filters that were not supplied", async () => {
    mockFindMany.mockResolvedValue([]);

    await ClinicNoteService.list({ organisationId: "org-1" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId: "org-1" } }),
    );
  });
});

describe("ClinicNoteService.update", () => {
  it("updates only the fields that were supplied", async () => {
    mockFindFirst.mockResolvedValue(baseNote);
    mockUpdate.mockResolvedValue({ ...baseNote, noteType: "FOLLOW_UP" });

    await ClinicNoteService.update("note-1", "org-1", {
      noteType: "FOLLOW_UP",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "note-1" },
      data: { noteType: "FOLLOW_UP" },
      select: expect.objectContaining({ id: true }),
    });
  });

  it("writes new content through when it is supplied", async () => {
    mockFindFirst.mockResolvedValue(baseNote);
    mockUpdate.mockResolvedValue({ ...baseNote, content: "Limp resolved" });

    const result = await ClinicNoteService.update("note-1", "org-1", {
      content: "Limp resolved",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "note-1" },
      data: { content: "Limp resolved" },
      select: expect.objectContaining({ id: true }),
    });
    expect(result.content).toBe("Limp resolved");
  });

  it("rejects blanking out the content", async () => {
    mockFindFirst.mockResolvedValue(baseNote);

    await expect(
      ClinicNoteService.update("note-1", "org-1", { content: "  " }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Note content cannot be empty.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuses to update a note from another organisation", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      ClinicNoteService.update("note-1", "org-2", { content: "Hello" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("ClinicNoteService.pin / unpin", () => {
  it("pins the note and records who pinned it", async () => {
    mockFindFirst.mockResolvedValue(baseNote);
    mockUpdate.mockResolvedValue({ ...baseNote, isPinned: true });

    const result = await ClinicNoteService.pin("note-1", "org-1", "user-4");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "note-1" },
      data: { isPinned: true },
      select: expect.objectContaining({ id: true }),
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CLINIC_NOTE_PINNED",
        patientId: "pat-1",
        actorId: "user-4",
        metadata: { noteId: "note-1" },
      }),
    );
    expect(result.isPinned).toBe(true);
  });

  it("records a null actor and blank patient when pinning an appointment note anonymously", async () => {
    const appointmentNote = {
      ...baseNote,
      subjectType: "APPOINTMENT" as const,
      subjectId: "appt-3",
    };
    mockFindFirst.mockResolvedValue(appointmentNote);
    mockUpdate.mockResolvedValue({ ...appointmentNote, isPinned: true });

    await ClinicNoteService.pin("note-1", "org-1");

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        patientId: "",
        entityId: "appt-3",
      }),
    );
  });

  it("unpins without writing an audit event", async () => {
    mockFindFirst.mockResolvedValue({ ...baseNote, isPinned: true });
    mockUpdate.mockResolvedValue({ ...baseNote, isPinned: false });

    const result = await ClinicNoteService.unpin("note-1", "org-1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "note-1" },
      data: { isPinned: false },
      select: expect.objectContaining({ id: true }),
    });
    expect(mockAudit).not.toHaveBeenCalled();
    expect(result.isPinned).toBe(false);
  });

  it("refuses to pin a note from another organisation", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      ClinicNoteService.pin("note-1", "org-2"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("ClinicNoteService.delete", () => {
  it("deletes an in-scope note", async () => {
    mockFindFirst.mockResolvedValue(baseNote);
    mockDelete.mockResolvedValue(baseNote);

    await expect(
      ClinicNoteService.delete("note-1", "org-1"),
    ).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "note-1" } });
  });

  it("refuses to delete a note from another organisation", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      ClinicNoteService.delete("note-1", "org-2"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
