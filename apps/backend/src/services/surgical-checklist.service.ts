import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class SurgicalChecklistError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "SurgicalChecklistError";
  }
}

type ChecklistPhase = "SIGN_IN" | "TIME_OUT" | "SIGN_OUT";
type ChecklistStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export interface ChecklistItemInput {
  label: string;
  sortOrder?: number;
  notes?: string;
}

export interface CreateChecklistParams {
  organisationId: string;
  patientId: string;
  encounterId: string;
  phase?: ChecklistPhase;
  conductedBy?: string;
  notes?: string;
  items?: ChecklistItemInput[];
}

export interface UpdateChecklistParams {
  phase?: ChecklistPhase;
  status?: ChecklistStatus;
  conductedBy?: string;
  notes?: string;
  completedAt?: Date;
}

export interface CheckItemParams {
  checkedBy?: string;
  notes?: string;
}

const checklistSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  phase: true,
  status: true,
  conductedBy: true,
  completedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      label: true,
      isChecked: true,
      checkedBy: true,
      checkedAt: true,
      notes: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.SurgicalChecklistSelect;

const assertChecklist = async (id: string, organisationId: string) => {
  const checklist = await prisma.surgicalChecklist.findFirst({
    where: { id, organisationId },
    select: checklistSelect,
  });
  if (!checklist) {
    throw new SurgicalChecklistError("Surgical checklist not found.", 404);
  }
  return checklist;
};

export const SurgicalChecklistService = {
  async create(params: CreateChecklistParams) {
    const {
      organisationId,
      patientId,
      encounterId,
      items,
      conductedBy,
      ...rest
    } = params;

    const checklist = await prisma.surgicalChecklist.create({
      data: {
        organisationId,
        patientId,
        encounterId,
        phase: rest.phase ?? "SIGN_IN",
        conductedBy: conductedBy ?? null,
        notes: rest.notes ?? null,
        items: items?.length
          ? {
              create: items.map((item, i) => ({
                label: item.label,
                sortOrder: item.sortOrder ?? i,
                notes: item.notes ?? null,
              })),
            }
          : undefined,
      },
      select: checklistSelect,
    });

    return checklist;
  },

  async get(id: string, organisationId: string) {
    return assertChecklist(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    patientId?: string;
    encounterId?: string;
    status?: ChecklistStatus;
  }) {
    const { organisationId, patientId, encounterId, status } = params;
    return prisma.surgicalChecklist.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(encounterId ? { encounterId } : {}),
        ...(status ? { status } : {}),
      },
      select: checklistSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateChecklistParams,
  ) {
    await assertChecklist(id, organisationId);

    const data: Prisma.SurgicalChecklistUpdateInput = {};
    if (params.phase !== undefined) data.phase = params.phase;
    if (params.status !== undefined) data.status = params.status;
    if (params.conductedBy !== undefined) data.conductedBy = params.conductedBy;
    if (params.notes !== undefined) data.notes = params.notes;
    if (params.completedAt !== undefined) data.completedAt = params.completedAt;

    const updated = await prisma.surgicalChecklist.update({
      where: { id },
      data,
      select: checklistSelect,
    });

    if (params.status === "COMPLETED") {
      await AuditTrailService.recordSafely({
        organisationId,
        patientId: updated.patientId,
        eventType: "SURGICAL_CHECKLIST_COMPLETED",
        actorType: "PMS_USER",
        actorId: params.conductedBy ?? null,
        entityType: "COMPANION",
        entityId: id,
        metadata: { phase: updated.phase, encounterId: updated.encounterId },
      });
    }

    return updated;
  },

  async checkItem(
    checklistId: string,
    itemId: string,
    organisationId: string,
    params: CheckItemParams,
  ) {
    await assertChecklist(checklistId, organisationId);

    const item = await prisma.surgicalChecklistItem.findFirst({
      where: { id: itemId, checklistId },
    });
    if (!item) {
      throw new SurgicalChecklistError("Checklist item not found.", 404);
    }

    return prisma.surgicalChecklistItem.update({
      where: { id: itemId },
      data: {
        isChecked: true,
        checkedBy: params.checkedBy ?? null,
        checkedAt: new Date(),
        notes: params.notes ?? null,
      },
      select: {
        id: true,
        label: true,
        isChecked: true,
        checkedBy: true,
        checkedAt: true,
        notes: true,
        sortOrder: true,
      },
    });
  },

  async uncheckItem(
    checklistId: string,
    itemId: string,
    organisationId: string,
  ) {
    await assertChecklist(checklistId, organisationId);

    const item = await prisma.surgicalChecklistItem.findFirst({
      where: { id: itemId, checklistId },
    });
    if (!item) {
      throw new SurgicalChecklistError("Checklist item not found.", 404);
    }

    return prisma.surgicalChecklistItem.update({
      where: { id: itemId },
      data: { isChecked: false, checkedBy: null, checkedAt: null },
      select: {
        id: true,
        label: true,
        isChecked: true,
        checkedBy: true,
        checkedAt: true,
        notes: true,
        sortOrder: true,
      },
    });
  },

  async delete(id: string, organisationId: string) {
    const checklist = await assertChecklist(id, organisationId);
    if (checklist.status === "COMPLETED") {
      throw new SurgicalChecklistError(
        "Cannot delete a completed checklist.",
        409,
      );
    }
    await prisma.surgicalChecklist.delete({ where: { id } });
  },
};
