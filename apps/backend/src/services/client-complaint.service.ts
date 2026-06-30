import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class ClientComplaintError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ClientComplaintError";
  }
}

type ComplaintStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "PENDING_RESPONSE"
  | "RESOLVED"
  | "CLOSED"
  | "ESCALATED";

type ComplaintCategory =
  | "CLINICAL_CARE"
  | "COMMUNICATION"
  | "BILLING"
  | "WAIT_TIMES"
  | "FACILITIES"
  | "STAFF_CONDUCT"
  | "OUTCOME_CONCERN"
  | "OTHER";

export interface CreateComplaintParams {
  organisationId: string;
  clientId: string;
  patientId?: string;
  encounterId?: string;
  category?: ComplaintCategory;
  summary: string;
  description?: string;
  reportedAt?: Date;
  reportedBy?: string;
  assignedTo?: string;
}

export interface UpdateComplaintParams {
  status?: ComplaintStatus;
  category?: ComplaintCategory;
  summary?: string;
  description?: string;
  assignedTo?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface AddNoteParams {
  content: string;
  authorId?: string;
  isInternal?: boolean;
}

const complaintSelect = {
  id: true,
  organisationId: true,
  clientId: true,
  patientId: true,
  encounterId: true,
  status: true,
  category: true,
  summary: true,
  description: true,
  reportedAt: true,
  reportedBy: true,
  assignedTo: true,
  resolvedAt: true,
  resolutionNotes: true,
  createdAt: true,
  updatedAt: true,
  notes: {
    select: {
      id: true,
      authorId: true,
      content: true,
      isInternal: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.ClientComplaintSelect;

const assertComplaint = async (id: string, organisationId: string) => {
  const complaint = await prisma.clientComplaint.findFirst({
    where: { id, organisationId },
    select: complaintSelect,
  });
  if (!complaint) {
    throw new ClientComplaintError("Complaint not found.", 404);
  }
  return complaint;
};

export const ClientComplaintService = {
  async create(params: CreateComplaintParams) {
    const { organisationId, reportedBy, ...rest } = params;

    const complaint = await prisma.clientComplaint.create({
      data: {
        organisationId,
        clientId: rest.clientId,
        patientId: rest.patientId ?? null,
        encounterId: rest.encounterId ?? null,
        category: rest.category ?? "OTHER",
        summary: rest.summary,
        description: rest.description ?? null,
        reportedAt: rest.reportedAt ?? new Date(),
        reportedBy: reportedBy ?? null,
        assignedTo: rest.assignedTo ?? null,
      },
      select: complaintSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: rest.patientId ?? "",
      eventType: "CLIENT_COMPLAINT_OPENED",
      actorType: "PMS_USER",
      actorId: reportedBy ?? null,
      entityType: "COMPANION",
      entityId: complaint.id,
      metadata: { category: rest.category ?? "OTHER", clientId: rest.clientId },
    });

    return complaint;
  },

  async get(id: string, organisationId: string) {
    return assertComplaint(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    clientId?: string;
    status?: ComplaintStatus;
    category?: ComplaintCategory;
  }) {
    const { organisationId, clientId, status, category } = params;
    return prisma.clientComplaint.findMany({
      where: {
        organisationId,
        ...(clientId ? { clientId } : {}),
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
      },
      select: complaintSelect,
      orderBy: { reportedAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateComplaintParams,
  ) {
    const existing = await assertComplaint(id, organisationId);
    if (existing.status === "CLOSED" && params.status !== "OPEN") {
      throw new ClientComplaintError(
        "Cannot update a closed complaint without reopening it.",
        409,
      );
    }

    const data: Prisma.ClientComplaintUpdateInput = {};
    if (params.status !== undefined) data.status = params.status;
    if (params.category !== undefined) data.category = params.category;
    if (params.summary !== undefined) data.summary = params.summary;
    if (params.description !== undefined) data.description = params.description;
    if (params.assignedTo !== undefined) data.assignedTo = params.assignedTo;
    if (params.resolvedAt !== undefined) data.resolvedAt = params.resolvedAt;
    if (params.resolutionNotes !== undefined)
      data.resolutionNotes = params.resolutionNotes;

    const updated = await prisma.clientComplaint.update({
      where: { id },
      data,
      select: complaintSelect,
    });

    if (params.status === "RESOLVED") {
      await AuditTrailService.recordSafely({
        organisationId,
        patientId: existing.patientId ?? "",
        eventType: "CLIENT_COMPLAINT_RESOLVED",
        actorType: "PMS_USER",
        actorId: existing.assignedTo ?? null,
        entityType: "COMPANION",
        entityId: id,
        metadata: { resolutionNotes: params.resolutionNotes ?? null },
      });
    }

    return updated;
  },

  async addNote(id: string, organisationId: string, params: AddNoteParams) {
    await assertComplaint(id, organisationId);

    return prisma.clientComplaintNote.create({
      data: {
        complaintId: id,
        content: params.content,
        authorId: params.authorId ?? null,
        isInternal: params.isInternal ?? true,
      },
      select: {
        id: true,
        authorId: true,
        content: true,
        isInternal: true,
        createdAt: true,
      },
    });
  },

  async delete(id: string, organisationId: string) {
    const complaint = await assertComplaint(id, organisationId);
    if (complaint.status !== "OPEN") {
      throw new ClientComplaintError(
        "Only OPEN complaints can be deleted.",
        409,
      );
    }
    await prisma.clientComplaint.delete({ where: { id } });
  },
};
