import {
  ContactAttachment,
  ContactSource,
  ContactStatus,
  ContactType,
  DsraDetails,
} from "../models/contect-us";
import { Prisma } from "@prisma/client";
import { CONTACT_MESSAGE_MAX_LENGTH } from "@yosemite-crew/types";
import { prisma } from "../config/prisma";
import { ParentCompanionService } from "./parent-companion.service";

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

/**
 * The refusal for a DSAR request missing what it must carry, if any. An
 * accepted declaration is stamped with when it was accepted.
 */
const dsarDetailsRefusal = (input: {
  type: ContactType;
  dsarDetails?: DsraDetails;
}): ContactServiceError | undefined => {
  if (input.type !== "DSAR") return undefined;
  if (!input.dsarDetails?.requesterType) {
    return new ContactServiceError(
      "DSAR requests must include dsarDetails.requesterType",
      400,
    );
  }
  if (!input.dsarDetails.declarationAccepted) {
    return new ContactServiceError("DSAR declaration must be accepted", 400);
  }
  input.dsarDetails.declarationAcceptedAt =
    input.dsarDetails.declarationAcceptedAt ?? new Date();
  return undefined;
};

const toPrismaJson = <T>(value: T | undefined) =>
  value ? (value as unknown as Prisma.InputJsonValue) : undefined;

const buildComplaintContext = (input: { fullName: string; phone?: string }) =>
  ({
    fullName: input.fullName.trim(),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
  }) as Prisma.InputJsonValue;

/** The refusal a contact request is answered with, if any. */
const contactRequestRefusal = (
  input: CreateContactRequestInput,
): ContactServiceError | undefined => {
  if (!input.subject || !input.message) {
    return new ContactServiceError("subject and message are required", 400);
  }
  return dsarDetailsRefusal(input);
};

/** The refusal a website contact request is answered with, if any. */
const webContactRequestRefusal = (
  input: CreateWebContactRequestInput,
): ContactServiceError | undefined => {
  if (!input.type) {
    return new ContactServiceError("type is required", 400);
  }
  if (!input.message?.trim()) {
    return new ContactServiceError("message is required", 400);
  }
  /* #3361: the stored message is what the mirror POSTs verbatim, and the
     panel's intake refuses a longer one with a permanent 400. Refusing here
     keeps the submission out of the database rather than accepting one that
     can never reach the CRM. The bound is on the trimmed text because that is
     what is stored and forwarded. */
  if (input.message.trim().length > CONTACT_MESSAGE_MAX_LENGTH) {
    return new ContactServiceError(
      `message must be ${CONTACT_MESSAGE_MAX_LENGTH} characters or fewer`,
      400,
    );
  }
  if (!input.fullName?.trim()) {
    return new ContactServiceError("fullName is required", 400);
  }
  if (!input.email?.trim()) {
    return new ContactServiceError("email is required", 400);
  }

  return dsarDetailsRefusal(input);
};

export const ContactService = {
  /**
   * The companion a parent's request may name: one they are actively linked
   * to. Any other companion is left off the request rather than refused.
   */
  async ownCompanionFor(
    parentId: string | undefined,
    patientId: unknown,
  ): Promise<string | undefined> {
    if (!parentId || typeof patientId !== "string" || !patientId) {
      return undefined;
    }
    const own =
      await ParentCompanionService.getActiveCompanionIdsForParent(parentId);
    return own.includes(patientId) ? patientId : undefined;
  },

  createRequest(input: CreateContactRequestInput) {
    const refusal = contactRequestRefusal(input);
    if (refusal) return Promise.reject(refusal);

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

  createWebRequest(input: CreateWebContactRequestInput) {
    const refusal = webContactRequestRefusal(input);
    if (refusal) return Promise.reject(refusal);

    const dsarDetails = toPrismaJson(input.dsarDetails);
    const attachments = toPrismaJson(input.attachments);

    return prisma.contactRequest.create({
      data: {
        type: input.type,
        source: input.source,
        subject: input.type,
        message: input.message.trim(),
        complaintContext: buildComplaintContext({
          fullName: input.fullName,
          phone: input.phone,
        }),
        email: input.email.trim(),
        organisationId: input.organisationId ?? undefined,
        dsarDetails,
        attachments,
        status: "OPEN",
        // Queued in the same insert as the submission, so the two commit
        // together or not at all. Written whether or not the mirror is
        // configured: unconfigured means queued, not lost.
        superadminForward: { create: {} },
      },
    });
  },

  listRequests(filter: ListContactRequestFilter) {
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

  getById(id: string) {
    return prisma.contactRequest.findUnique({ where: { id } });
  },

  updateStatus(id: string, status: ContactStatus) {
    return prisma.contactRequest.update({
      where: { id },
      data: { status },
    });
  },
};
