import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class ClinicalProgressNoteError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ClinicalProgressNoteError";
  }
}

type ClinicalNoteType =
  | "SHIFT_NOTE"
  | "PROGRESS_NOTE"
  | "NURSE_NOTE"
  | "SPECIALIST_NOTE"
  | "DISCHARGE_SUMMARY"
  | "OTHER";

export interface CreateNoteParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  noteType: ClinicalNoteType;
  subjectiveFindings?: string;
  objectiveFindings?: string;
  assessment?: string;
  plan?: string;
  freeText?: string;
  authorId?: string;
  authorName?: string;
}

export interface UpdateNoteParams {
  subjectiveFindings?: string;
  objectiveFindings?: string;
  assessment?: string;
  plan?: string;
  freeText?: string;
}

export interface ListNotesParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  noteType?: ClinicalNoteType;
}

const noteSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  noteType: true,
  subjectiveFindings: true,
  objectiveFindings: true,
  assessment: true,
  plan: true,
  freeText: true,
  authorId: true,
  authorName: true,
  signedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClinicalProgressNoteSelect;

const assertNote = async (id: string, organisationId: string) => {
  const record = await prisma.clinicalProgressNote.findFirst({
    where: { id, organisationId },
    select: noteSelect,
  });
  if (!record) {
    throw new ClinicalProgressNoteError("Clinical note not found.", 404);
  }
  return record;
};

export const ClinicalProgressNoteService = {
  async create(params: CreateNoteParams) {
    const { organisationId, patientId, authorId, authorName, ...rest } = params;

    const note = await prisma.clinicalProgressNote.create({
      data: {
        organisationId,
        patientId,
        encounterId: rest.encounterId ?? null,
        noteType: rest.noteType,
        subjectiveFindings: rest.subjectiveFindings ?? null,
        objectiveFindings: rest.objectiveFindings ?? null,
        assessment: rest.assessment ?? null,
        plan: rest.plan ?? null,
        freeText: rest.freeText ?? null,
        authorId: authorId ?? null,
        authorName: authorName ?? null,
      },
      select: noteSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "CLINICAL_NOTE_CREATED",
      actorType: "PMS_USER",
      actorId: authorId ?? null,
      entityType: "COMPANION",
      entityId: note.id,
      metadata: { noteType: rest.noteType },
    });

    return note;
  },

  async get(id: string, organisationId: string) {
    return assertNote(id, organisationId);
  },

  async list(params: ListNotesParams) {
    const { organisationId, patientId, encounterId, noteType } = params;
    return prisma.clinicalProgressNote.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(noteType ? { noteType } : {}),
      },
      select: noteSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(id: string, organisationId: string, params: UpdateNoteParams) {
    const existing = await assertNote(id, organisationId);
    if (existing.signedAt) {
      throw new ClinicalProgressNoteError(
        "Cannot edit a signed clinical note.",
        409,
      );
    }

    const data: Prisma.ClinicalProgressNoteUpdateInput = {};
    if (params.subjectiveFindings !== undefined)
      data.subjectiveFindings = params.subjectiveFindings;
    if (params.objectiveFindings !== undefined)
      data.objectiveFindings = params.objectiveFindings;
    if (params.assessment !== undefined) data.assessment = params.assessment;
    if (params.plan !== undefined) data.plan = params.plan;
    if (params.freeText !== undefined) data.freeText = params.freeText;

    return prisma.clinicalProgressNote.update({
      where: { id },
      data,
      select: noteSelect,
    });
  },

  async sign(id: string, organisationId: string, signedBy: string) {
    const existing = await assertNote(id, organisationId);
    if (existing.signedAt) {
      throw new ClinicalProgressNoteError("Note is already signed.", 409);
    }

    const updated = await prisma.clinicalProgressNote.update({
      where: { id },
      data: {
        signedAt: new Date(),
        authorId: existing.authorId ?? signedBy,
      },
      select: noteSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: existing.patientId,
      eventType: "CLINICAL_NOTE_SIGNED",
      actorType: "PMS_USER",
      actorId: signedBy,
      entityType: "COMPANION",
      entityId: id,
      metadata: { noteType: existing.noteType },
    });

    return updated;
  },
};
