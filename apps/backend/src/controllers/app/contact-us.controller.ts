// contact.controller.ts
import { Request, Response } from "express";
import {
  ContactService,
  ContactServiceError,
  type CreateContactRequestInput,
  type CreateWebContactRequestInput,
} from "src/services/contact-us.service";
import { generatePresignedUrl, getURLForKey } from "src/middlewares/upload";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { type ContactType, type ContactStatus } from "src/models/contect-us";

const resolveMobileUserId = (req: Request): string | undefined => {
  const authReq = req as AuthenticatedRequest;
  const headerUserId = req.headers?.["x-user-id"];
  if (typeof headerUserId === "string") return headerUserId;

  return authReq.userId;
};

const CONTACT_STATUSES = new Set<ContactStatus>([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

const CONTACT_TYPES = new Set<ContactType>([
  "GENERAL_ENQUIRY",
  "FEATURE_REQUEST",
  "DSAR",
  "COMPLAINT",
]);

const toContactStatus = (value: unknown): ContactStatus | undefined =>
  typeof value === "string" && CONTACT_STATUSES.has(value as ContactStatus)
    ? (value as ContactStatus)
    : undefined;

const toContactType = (value: unknown): ContactType | undefined =>
  typeof value === "string" && CONTACT_TYPES.has(value as ContactType)
    ? (value as ContactType)
    : undefined;

type CreateContactRequestBody = CreateContactRequestInput;
type CreateWebContactRequestBody = CreateWebContactRequestInput;

type ListContactQuery = {
  status?: ContactStatus;
  type?: ContactType;
  organisationId?: string;
};

type UpdateContactStatusBody = {
  status: ContactStatus;
};

export const ContactController = {
  async create(
    this: void,
    req: Request<unknown, unknown, CreateContactRequestBody>,
    res: Response,
  ) {
    try {
      const userId = resolveMobileUserId(req as Request);

      let parentId: string | undefined;
      if (userId) {
        const authUser =
          await AuthUserMobileService.getByProviderUserId(userId);
        if (!authUser) {
          return res
            .status(404)
            .json({ message: "User not found for provided userId." });
        }
        parentId = authUser.parentId?.toString();
      }

      const {
        type,
        source,
        subject,
        message,
        email,
        organisationId,
        companionId,
        parentId: bodyParentId,
        dsarDetails,
        attachments,
        userId: bodyUserId,
      } = req.body;

      const payload = {
        type,
        source,
        subject,
        message,
        email,
        organisationId,
        companionId,
        parentId: parentId ?? bodyParentId,
        userId: userId ?? bodyUserId,
        dsarDetails,
        attachments,
      };

      const doc = await ContactService.createRequest(payload);
      res.status(201).json({ id: doc._id.toString() });
    } catch (err) {
      if (err instanceof ContactServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Error creating contact request", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  async createWeb(
    this: void,
    req: Request<unknown, unknown, CreateWebContactRequestBody>,
    res: Response,
  ) {
    try {
      const {
        type,
        source,
        message,
        fullName,
        email,
        phone,
        organisationId,
        dsarDetails,
        attachments,
      } = req.body;

      const payload = {
        type,
        source,
        message,
        fullName,
        email,
        phone,
        organisationId,
        dsarDetails,
        attachments,
      };

      const doc = await ContactService.createWebRequest(payload);
      res.status(201).json({ id: doc._id.toString() });
    } catch (err) {
      if (err instanceof ContactServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Error creating web contact request", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  async getAttachmentUploadUrl(this: void, req: Request, res: Response) {
    try {
      const rawBody: unknown = req.body;
      const mimeType =
        typeof rawBody === "object" && rawBody !== null && "mimeType" in rawBody
          ? (rawBody as { mimeType?: unknown }).mimeType
          : undefined;

      if (typeof mimeType !== "string" || !mimeType) {
        return res
          .status(400)
          .json({ message: "mimeType is required in the request body." });
      }

      const { url, key } = await generatePresignedUrl(
        mimeType,
        "custom",
        "contact-us",
      );

      return res.status(200).json({
        uploadUrl: url,
        s3Key: key,
        fileUrl: getURLForKey(key),
      });
    } catch (err) {
      console.error("Error generating contact-us upload URL", err);
      return res
        .status(500)
        .json({ message: "Unable to generate upload URL" });
    }
  },

  async list(
    this: void,
    req: Request<unknown, unknown, unknown, ListContactQuery>,
    res: Response,
  ) {
    try {
      const status = toContactStatus(req.query.status);
      const type = toContactType(req.query.type);
      const organisationId =
        typeof req.query.organisationId === "string"
          ? req.query.organisationId
          : undefined;
      const docs = await ContactService.listRequests({
        status,
        type,
        organisationId,
      });
      res.json(docs);
    } catch (err) {
      console.error("Error listing contact requests", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  async getById(this: void, req: Request, res: Response) {
    const doc = await ContactService.getById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  },

  async updateStatus(
    this: void,
    req: Request<{ id: string }, unknown, UpdateContactStatusBody>,
    res: Response,
  ) {
    try {
      const status = toContactStatus(req.body.status);
      if (!status) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      const updated = await ContactService.updateStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating contact request status", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};
