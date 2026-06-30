import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class ClinicNoteError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ClinicNoteError";
  }
}

type ClinicNoteSubjectType = "PATIENT" | "CLIENT" | "APPOINTMENT";
type ClinicNoteType =
  | "GENERAL"
  | "BILLING"
  | "COMMUNICATION"
  | "FOLLOW_UP"
  | "ALERT";

export interface CreateNoteParams {
  organisationId: string;
  subjectType: ClinicNoteSubjectType;
  subjectId: string;
  noteType?: ClinicNoteType;
  content: string;
  isPinned?: boolean;
  createdBy?: string;
}

const noteSelect = {
  id: true,
  organisationId: true,
  subjectType: true,
  subjectId: true,
  noteType: true,
  content: true,
  isPinned: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClinicNoteSelect;

const assertNote = async (id: string, organisationId: string) => {
  const note = await prisma.clinicNote.findFirst({
    where: { id, organisationId },
    select: noteSelect,
  });
  if (!note) throw new ClinicNoteError("Clinic note not found.", 404);
  return note;
};

export const ClinicNoteService = {
  async create(params: CreateNoteParams) {
    if (!params.content.trim()) {
      throw new ClinicNoteError("Note content cannot be empty.", 400);
    }

    const note = await prisma.clinicNote.create({
      data: {
        organisationId: params.organisationId,
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        noteType: params.noteType ?? "GENERAL",
        content: params.content,
        isPinned: params.isPinned ?? false,
        createdBy: params.createdBy ?? null,
      },
      select: noteSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: params.subjectType === "PATIENT" ? params.subjectId : "",
      eventType: "CLINIC_NOTE_CREATED",
      actorType: "PMS_USER",
      actorId: params.createdBy ?? null,
      entityType: "COMPANION",
      entityId: params.subjectId,
      metadata: {
        noteId: note.id,
        subjectType: params.subjectType,
        noteType: note.noteType,
        isPinned: note.isPinned,
      },
    });

    return note;
  },

  async get(id: string, organisationId: string) {
    return assertNote(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    subjectType?: ClinicNoteSubjectType;
    subjectId?: string;
    noteType?: ClinicNoteType;
    isPinned?: boolean;
  }) {
    const { organisationId, subjectType, subjectId, noteType, isPinned } =
      params;
    return prisma.clinicNote.findMany({
      where: {
        organisationId,
        ...(subjectType ? { subjectType } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(noteType ? { noteType } : {}),
        ...(isPinned !== undefined ? { isPinned } : {}),
      },
      select: noteSelect,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: {
      content?: string;
      noteType?: ClinicNoteType;
    },
  ) {
    await assertNote(id, organisationId);
    if (params.content !== undefined && !params.content.trim()) {
      throw new ClinicNoteError("Note content cannot be empty.", 400);
    }
    return prisma.clinicNote.update({
      where: { id },
      data: {
        ...(params.content ? { content: params.content } : {}),
        ...(params.noteType ? { noteType: params.noteType } : {}),
      },
      select: noteSelect,
    });
  },

  async pin(id: string, organisationId: string, pinnedBy?: string) {
    await assertNote(id, organisationId);
    const note = await prisma.clinicNote.update({
      where: { id },
      data: { isPinned: true },
      select: noteSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: note.subjectType === "PATIENT" ? note.subjectId : "",
      eventType: "CLINIC_NOTE_PINNED",
      actorType: "PMS_USER",
      actorId: pinnedBy ?? null,
      entityType: "COMPANION",
      entityId: note.subjectId,
      metadata: { noteId: id },
    });

    return note;
  },

  async unpin(id: string, organisationId: string) {
    await assertNote(id, organisationId);
    return prisma.clinicNote.update({
      where: { id },
      data: { isPinned: false },
      select: noteSelect,
    });
  },

  async delete(id: string, organisationId: string) {
    await assertNote(id, organisationId);
    await prisma.clinicNote.delete({ where: { id } });
  },
};
