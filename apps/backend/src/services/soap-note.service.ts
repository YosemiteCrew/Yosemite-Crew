import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class SOAPNoteError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "SOAPNoteError";
  }
}

export interface CreateSOAPNoteParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  authorId?: string;
  noteDate: Date;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface UpdateSOAPNoteParams {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface AmendSOAPNoteParams {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  amendedReason: string;
}

export interface ListSOAPNotesParams {
  organisationId: string;
  patientId?: string;
  encounterId?: string;
  authorId?: string;
}

const noteSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  authorId: true,
  noteDate: true,
  subjective: true,
  objective: true,
  assessment: true,
  plan: true,
  signedAt: true,
  signedBy: true,
  isAmended: true,
  amendedReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SOAPNoteSelect;

const assertNote = async (id: string, organisationId: string) => {
  const record = await prisma.sOAPNote.findFirst({
    where: { id, organisationId },
    select: noteSelect,
  });
  if (!record) {
    throw new SOAPNoteError("SOAP note not found.", 404);
  }
  return record;
};

export const SOAPNoteService = {
  async create(params: CreateSOAPNoteParams) {
    const { organisationId, patientId, authorId, ...rest } = params;

    const record = await prisma.sOAPNote.create({
      data: {
        organisationId,
        patientId,
        authorId: authorId ?? null,
        encounterId: rest.encounterId ?? null,
        noteDate: rest.noteDate,
        subjective: rest.subjective ?? null,
        objective: rest.objective ?? null,
        assessment: rest.assessment ?? null,
        plan: rest.plan ?? null,
      },
      select: noteSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "SOAP_NOTE_CREATED",
      actorType: "PMS_USER",
      actorId: authorId ?? null,
      entityType: "COMPANION",
      entityId: record.id,
      metadata: { encounterId: rest.encounterId ?? null },
    });

    return record;
  },

  async get(id: string, organisationId: string) {
    return assertNote(id, organisationId);
  },

  async list(params: ListSOAPNotesParams) {
    const { organisationId, patientId, encounterId, authorId } = params;
    return prisma.sOAPNote.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(authorId ? { authorId } : {}),
      },
      select: noteSelect,
      orderBy: { noteDate: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateSOAPNoteParams,
  ) {
    const record = await assertNote(id, organisationId);
    if (record.signedAt) {
      throw new SOAPNoteError(
        "Signed notes cannot be edited directly. Use amend instead.",
        409,
      );
    }

    const data: Prisma.SOAPNoteUpdateInput = {};
    if (params.subjective !== undefined) data.subjective = params.subjective;
    if (params.objective !== undefined) data.objective = params.objective;
    if (params.assessment !== undefined) data.assessment = params.assessment;
    if (params.plan !== undefined) data.plan = params.plan;

    return prisma.sOAPNote.update({
      where: { id },
      data,
      select: noteSelect,
    });
  },

  async sign(id: string, organisationId: string, signedBy: string) {
    const record = await assertNote(id, organisationId);
    if (record.signedAt) {
      throw new SOAPNoteError("Note is already signed.", 409);
    }

    const updated = await prisma.sOAPNote.update({
      where: { id },
      data: { signedAt: new Date(), signedBy },
      select: noteSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: record.patientId,
      eventType: "SOAP_NOTE_SIGNED",
      actorType: "PMS_USER",
      actorId: signedBy,
      entityType: "COMPANION",
      entityId: id,
      metadata: { encounterId: record.encounterId },
    });

    return updated;
  },

  async amend(
    id: string,
    organisationId: string,
    params: AmendSOAPNoteParams,
    amendedBy?: string,
  ) {
    const record = await assertNote(id, organisationId);
    if (!record.signedAt) {
      throw new SOAPNoteError(
        "Only signed notes can be amended. Use update for unsigned notes.",
        409,
      );
    }

    const data: Prisma.SOAPNoteUpdateInput = {
      isAmended: true,
      amendedReason: params.amendedReason,
    };
    if (params.subjective !== undefined) data.subjective = params.subjective;
    if (params.objective !== undefined) data.objective = params.objective;
    if (params.assessment !== undefined) data.assessment = params.assessment;
    if (params.plan !== undefined) data.plan = params.plan;

    const updated = await prisma.sOAPNote.update({
      where: { id },
      data,
      select: noteSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: record.patientId,
      eventType: "SOAP_NOTE_AMENDED",
      actorType: "PMS_USER",
      actorId: amendedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { amendedReason: params.amendedReason },
    });

    return updated;
  },
};
