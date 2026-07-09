import {
  ContactAttachment,
  ContactSource,
  ContactStatus,
  ContactType,
  DsraDetails,
} from "../models/contect-us";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export class ContactServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "ContactServiceError";
  }
}

export type CreateContactRequestInput = {
  type: ContactType;
  source: ContactSource;
  subject: string;
  message: string;
  userId?: string;
  email?: string;
  organisationId?: string;
  patientId?: string;
  parentId?: string;
  dsarDetails?: DsraDetails;
  attachments?: ContactAttachment[];
};

export type CreateWebContactRequestInput = {
  type: ContactType;
  source: "PMS_WEB" | "MARKETING_SITE";
  message: string;
  fullName: string;
  email: string;
  phone?: string;
  organisationId?: string;
  dsarDetails?: DsraDetails;
  attachments?: ContactAttachment[];
};

export type ListContactRequestFilter = {
  status?: ContactStatus;
  type?: ContactType;
  organisationId?: string;
};

const ensureDsarDetails = (input: {
  type: ContactType;
  dsarDetails?: DsraDetails;
}) => {
  if (input.type === "DSAR") {
    if (!input.dsarDetails?.requesterType) {
      throw new ContactServiceError(
        "DSAR requests must include dsarDetails.requesterType",
        400,
      );
    }
    if (!input.dsarDetails.declarationAccepted) {
      throw new ContactServiceError("DSAR declaration must be accepted", 400);
    }
    input.dsarDetails.declarationAcceptedAt =
      input.dsarDetails.declarationAcceptedAt ?? new Date();
  }
};

const toPrismaJson = <T>(value: T | undefined) =>
  value ? (value as unknown as Prisma.InputJsonValue) : undefined;

export const ContactService = {
  async createRequest(input: CreateContactRequestInput) {
    // Basic validations
    if (!input.subject || !input.message) {
      throw new ContactServiceError("subject and message are required", 400);
    }

    ensureDsarDetails(input);

    const dsarDetails = toPrismaJson(input.dsarDetails);
    const attachments = toPrismaJson(input.attachments);

    return prisma.contactRequest.create({
      data: {
        type: input.type,
        source: input.source,
        subject: input.subject,
        message: input.message,
        userId: input.userId ?? undefined,
        email: input.email ?? undefined,
        organisationId: input.organisationId ?? undefined,
        patientId: input.patientId ?? undefined,
        parentId: input.parentId ?? undefined,
        dsarDetails,
        complaintContext: undefined,
        attachments,
        status: "OPEN",
        internalNotes: undefined,
      },
    });
  },

  async createWebRequest(input: CreateWebContactRequestInput) {
    if (!input.type) {
      throw new ContactServiceError("type is required", 400);
    }
    if (!input.message?.trim()) {
      throw new ContactServiceError("message is required", 400);
    }
    if (!input.fullName?.trim()) {
      throw new ContactServiceError("fullName is required", 400);
    }
    if (!input.email?.trim()) {
      throw new ContactServiceError("email is required", 400);
    }

    ensureDsarDetails(input);

    const dsarDetails = toPrismaJson(input.dsarDetails);
    const attachments = toPrismaJson(input.attachments);

    return prisma.contactRequest.create({
      data: {
        type: input.type,
        source: input.source,
        subject: input.type,
        message: input.message.trim(),
        email: input.email.trim(),
        dsarDetails,
        attachments,
        status: "OPEN",
      },
    });
  },

  async listRequests(filter: ListContactRequestFilter) {
    return prisma.contactRequest.findMany({
      where: {
        status: filter.status ?? undefined,
        type: filter.type ?? undefined,
        organisationId: filter.organisationId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async getById(id: string) {
    return prisma.contactRequest.findUnique({ where: { id } });
  },

  async updateStatus(id: string, status: ContactStatus) {
    return prisma.contactRequest.update({
      where: { id },
      data: { status },
    });
  },
};
