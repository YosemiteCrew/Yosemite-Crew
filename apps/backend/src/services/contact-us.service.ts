import { RootFilterQuery } from "mongoose";
import ContactRequestModel, {
  ContactAttachment,
  ContactRequestMongo,
  ContactSource,
  ContactStatus,
  ContactType,
  DsraDetails,
} from "../models/contect-us";

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
  companionId?: string;
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

export const ContactService = {
  async createRequest(input: CreateContactRequestInput) {
    // Basic validations
    if (!input.subject || !input.message) {
      throw new ContactServiceError("subject and message are required", 400);
    }

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

    const doc = await ContactRequestModel.create({
      ...input,
      status: "OPEN",
    });
    return doc;
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

    const doc = await ContactRequestModel.create({
      ...input,
      subject: input.type,
      message: input.message.trim(),
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim(),
      status: "OPEN",
    });
    return doc;
  },

  async listRequests(filter: ListContactRequestFilter) {
    const query: RootFilterQuery<ContactRequestMongo> = {};
    if (filter.status) query.status = filter.status;
    if (filter.type) query.type = filter.type;
    if (filter.organisationId) query.organisationId = filter.organisationId;

    return ContactRequestModel.find(query).sort({ createdAt: -1 }).limit(100);
  },

  async getById(id: string) {
    return ContactRequestModel.findById(id);
  },

  async updateStatus(id: string, status: ContactStatus) {
    return ContactRequestModel.findByIdAndUpdate(id, { status }, { new: true });
  },
};
