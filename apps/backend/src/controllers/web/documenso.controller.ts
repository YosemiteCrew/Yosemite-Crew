import { Request, Response } from "express";
import crypto from "node:crypto";
import { HydratedDocument } from "mongoose";
import { FormSubmissionDocument, FormSubmissionModel } from "src/models/form";
import UserModel from "src/models/user";
import UserOrganizationModel from "src/models/user-organization";
import { DocumensoExternalRole, DocumensoService } from "src/services/documenso.service";
import { OrganizationService } from "src/services/organization.service";
import type { AuthenticatedRequest } from "src/middlewares/auth";
import logger from "src/utils/logger";

interface DocumensoWebhookBody {
  event?: string;
  payload?: {
    id?: string | number;
  };
}

function verifySignature(
  payload: Buffer,
  signature: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export const DocumensoWebhookController = {
  async handle(req: Request, res: Response) {
    try {
      const rawBody = req.body as Buffer;

      const signature = req.headers["x-documenso-signature"] as
        | string
        | undefined;
      if (process.env.DOCUMENSO_WEBHOOK_SECRET) {
        if (!signature) return res.status(401).end();

        const valid = verifySignature(
          rawBody,
          signature,
          process.env.DOCUMENSO_WEBHOOK_SECRET,
        );

        if (!valid) return res.status(401).end();
      }

      const body = JSON.parse(rawBody.toString("utf8")) as DocumensoWebhookBody;
      const { event: eventType, payload } = body;

      const documentId = payload?.id;

      if (!eventType || documentId === undefined || documentId === null) {
        console.error("[DocumensoWebhook] Invalid payload", body);
        return res.status(400).json({ message: "Invalid payload" });
      }

      const submission = await FormSubmissionModel.findOne({
        "signing.documentId": String(documentId),
      });

      if (!submission) {
        console.warn(
          "[DocumensoWebhook] No submission found for document",
          documentId,
        );
        return res.status(200).json({ received: true });
      }

      switch (eventType) {
        case "DOCUMENT_COMPLETED":
          await handleDocumentCompleted(submission);
          break;

        case "DOCUMENT_DELETED":
          await handleDocumentDeleted(submission);
          break;

        // case "DOCUMENT_EXPIRED":
        //   await handleDocumentExpired(submission);
        //   break;

        // case "RECIPIENT_SIGNED":
        //   await handleRecipientSigned(submission);
        //   break;

        // case "RECIPIENT_REJECTED":
        //   await handleRecipientRejected(submission, body);
        //   break;

        // case "RECIPIENT_REMOVED":
        //   await handleRecipientRemoved(submission);
        //   break;

        default:
          // Ignore unknown events
          break;
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("[DocumensoWebhook] Error", err);
      return res.status(500).json({ message: "Webhook failed" });
    }
  },
};

const buildDisplayName = (user: {
  firstName?: string;
  lastName?: string;
  email: string;
}) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email;
};

const mapRoleToDocumenso = (roleCode?: string): DocumensoExternalRole => {
  switch (roleCode?.toUpperCase()) {
    case "OWNER":
    case "ADMIN":
      return "ADMIN";
    case "SUPERVISOR":
    case "VETERINARIAN":
      return "MANAGER";
    default:
      return "MEMBER";
  }
};

export const DocumensoAuthController = {
  async createRedirectUrl(req: Request<{ orgId: string }>, res: Response) {
    try {
      const authRequest = req as AuthenticatedRequest;
      const { orgId } = req.params;
      const userId = authRequest.userId;

      if (!userId || !orgId) {
        return res.status(400).json({
          message: "Missing userId or orgId.",
        });
      }

      const user = await UserModel.findOne(
        { userId },
        { email: 1, firstName: 1, lastName: 1 },
        { sanitizeFilter: true },
      ).lean();

      if (!user?.email) {
        return res.status(404).json({ message: "User not found." });
      }

      const organisation = await OrganizationService.getById(orgId);

      if (!organisation?.name) {
        return res.status(404).json({ message: "Organisation not found." });
      }

      const mapping = await UserOrganizationModel.findOne(
        {
          practitionerReference: userId,
          $or: [
            { organizationReference: orgId },
            { organizationReference: `Organization/${orgId}` },
          ],
        },
        { roleCode: 1 },
        { sanitizeFilter: true },
      ).lean();

      const role = mapRoleToDocumenso(mapping?.roleCode);

      const redirectUrl = await DocumensoService.generateExternalRedirectUrl({
        email: user.email,
        name: buildDisplayName(user),
        businessId: organisation.id ?? orgId,
        businessName: organisation.name,
        role,
      });

      return res.status(200).json({ redirectUrl });
    } catch (error) {
      logger.error("Documenso redirect error:", error);
      return res.status(500).json({
        message: "Failed to generate Documenso redirect.",
      });
    }
  },
};

async function handleDocumentCompleted(
  submission: HydratedDocument<FormSubmissionDocument>,
) {
  if (!submission.signing) return;
  if (submission.signing.status === "SIGNED") return;

  const signedDocument = await DocumensoService.downloadSignedDocument(
    Number.parseInt(submission.signing.documentId!, 10),
  );

  if (signedDocument) {
    submission.signing.pdf = {
      url: signedDocument.downloadUrl,
    };
  }
  submission.signing.status = "SIGNED";

  await submission.save();
}

async function handleDocumentDeleted(
  submission: HydratedDocument<FormSubmissionDocument>,
) {
  if (!submission.signing) return;
  if (submission.signing.status === "SIGNED") return;

  submission.signing = {
    ...submission.signing,
    status: "NOT_STARTED",
  };

  await submission.save();
}
