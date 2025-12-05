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
  constructor(message: string, public statusCode = 400) {
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
        throw new ContactServiceError(
          "DSAR declaration must be accepted",
          400,
        );
      }
      input.dsarDetails.declarationAcceptedAt =
        input.dsarDetails.declarationAcceptedAt ?? new Date();
    }

    const doc = await ContactRequestModel.create({
      ...input,
      status: "OPEN",
    });

    // TODO: optionally notify YC support (email / Slack)
    return doc;
  },

  async listRequests(filter: ListContactRequestFilter) {
    const query: RootFilterQuery<ContactRequestMongo> = {};
    if (filter.status) query.status = filter.status;
    if (filter.type) query.type = filter.type;
    if (filter.organisationId) query.organisationId = filter.organisationId;

    return ContactRequestModel.find(query)
      .sort({ createdAt: -1 })
      .limit(100);
  },

  async getById(id: string) {
    return ContactRequestModel.findById(id);
  },

  async updateStatus(id: string, status: ContactStatus) {
    return ContactRequestModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
  },
};
