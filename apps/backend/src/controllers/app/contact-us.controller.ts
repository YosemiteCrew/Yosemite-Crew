// contact.controller.ts
import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import {
  ContactService,
  ContactServiceError,
  type CreateContactRequestInput,
  type CreateWebContactRequestInput,
} from "src/services/contact-us.service";
import {
  ATTACHMENT_MIME_TYPES,
  generatePresignedUrl,
  getURLForKey,
  isAllowedMimeType,
} from "src/middlewares/upload";
import { resolveVerifiedUserId } from "src/utils/request";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { type ContactType, type ContactStatus } from "src/models/contect-us";
import { SuperadminContactService } from "src/services/superadmin-contact.service";
import logger from "src/utils/logger";

// Verified session only. The previous form let the client-supplied `x-user-id`
// header OVERRIDE an established session, so any caller could act as any user.
const resolveMobileUserId = (req: Request): string | undefined =>
  resolveVerifiedUserId(req);

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

const attachmentUploadBodySchema = z.object({
  mimeType: z.string().refine(isAllowedMimeType),
});

type CreateContactRequestBody = CreateContactRequestInput;
/*
 * The wire body carries one field the service input does not: `website`, a
 * honeypot. It is never stored and never forwarded - it exists only to be left
 * empty by a human (#2645).
 */
type CreateWebContactRequestBody = CreateWebContactRequestInput & {
  website?: unknown;
};

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
        patientId,
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
        patientId,
        parentId: parentId ?? bodyParentId,
        userId: userId ?? bodyUserId,
        dsarDetails,
        attachments,
      };

      const doc = await ContactService.createRequest(payload);
      const id = doc.id;
      res.status(201).json({ id });
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
        website,
      } = req.body;

      /*
       * Honeypot. The form renders `website` hidden from people and from
       * assistive technology; a form-filling bot has no way to know that and
       * fills it. Anything non-empty here is discarded.
       *
       * Answered 201 with a plausible id rather than 4xx, deliberately: a bot
       * that learns which submissions were dropped simply stops filling the
       * field, and the run continues undetected. The SuperAdmin panel's own
       * /api/contact has had this field all along - the site form just never
       * rendered one, so nothing was ever filtered (#2645).
       */
      if (typeof website === "string" && website.trim() !== "") {
        logger.warn("Discarded a contact submission that filled the honeypot", {
          source,
          type,
        });
        return res.status(201).json({ id: randomUUID() });
      }

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

      // Mirror the stored submission into the SuperAdmin panel's CRM.
      // Fire-and-forget: the panel being down or unconfigured must never
      // fail the visitor's submission - our database already holds it.
      void SuperadminContactService.forwardWebContact(payload);

      const id = doc.id;
      res.status(201).json({ id });
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
      const parsedBody = attachmentUploadBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res
          .status(400)
          .json({ message: "A supported mimeType is required." });
      }

      // This route is unauthenticated, so it accepts only what a contact form
      // needs rather than the full document set.
      const { url, key } = await generatePresignedUrl(
        parsedBody.data.mimeType,
        "custom",
        "contact-us",
        ATTACHMENT_MIME_TYPES,
      );

      return res.status(200).json({
        uploadUrl: url,
        s3Key: key,
        fileUrl: getURLForKey(key),
      });
    } catch (err) {
      console.error("Error generating contact-us upload URL", err);
      return res.status(500).json({ message: "Unable to generate upload URL" });
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
