import { Request, Response } from "express";
import crypto from "node:crypto";
import { HydratedDocument, Types } from "mongoose";
import {
  FormModel,
  FormSubmissionDocument,
  FormSubmissionModel,
} from "src/models/form";
import OrganizationModel from "src/models/organization";
import UserModel from "src/models/user";
import UserOrganizationModel from "src/models/user-organization";
import {
  DocumensoExternalRole,
  DocumensoService,
} from "src/services/documenso.service";
import { FormAssignmentService } from "src/services/form-assignment.service";
import { completePersistedRenderedDocumentSigning } from "src/services/rendered-document.service";
import { OrganizationService } from "src/services/organization.service";
import { WorkspaceDocumentPacketService } from "src/services/workspace-document-packet.service";
import type { AuthenticatedRequest } from "src/middlewares/auth";
import logger from "src/utils/logger";
import { prisma } from "src/config/prisma";
import { Prisma } from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

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

function parseWebhookBody(rawBody: Buffer) {
  return JSON.parse(rawBody.toString("utf8")) as DocumensoWebhookBody;
}

function parseWebhookEvent(body: DocumensoWebhookBody) {
  const eventType = body.event;
  const documentId = body.payload?.id;

  if (!eventType || documentId === undefined || documentId === null) {
    return null;
  }

  return { eventType, documentId: String(documentId) };
}

const normalizeObjectIdString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (value && typeof value === "object") {
    const candidate = value as { toHexString?: () => string };
    if (typeof candidate.toHexString === "function") {
      const hex = candidate.toHexString();
      if (typeof hex === "string" && hex.trim().length > 0) {
        return hex.trim();
      }
    }
  }

  return null;
};

async function findWebhookSubmission(documentId: string) {
  return isReadFromPostgres()
    ? prisma.formSubmission.findFirst({
        where: {
          signing: {
            path: ["documentId"],
            equals: documentId,
          } as Prisma.JsonFilter,
        },
      })
    : FormSubmissionModel.findOne({
        "signing.documentId": documentId,
      });
}

async function handleSubmissionEvent(
  eventType: string,
  submission:
    | HydratedDocument<FormSubmissionDocument>
    | Awaited<ReturnType<typeof prisma.formSubmission.findFirst>>
    | null,
) {
  if (!submission) {
    logger.warn("[DocumensoWebhook] No submission found for document");
    return false;
  }

  if (eventType === "DOCUMENT_COMPLETED") {
    if (isReadFromPostgres()) {
      await handleDocumentCompletedPrisma(
        submission as Parameters<typeof handleDocumentCompletedPrisma>[0],
      );
    } else {
      await handleDocumentCompleted(
        submission as HydratedDocument<FormSubmissionDocument>,
      );
    }
    return true;
  }

  if (eventType === "DOCUMENT_DELETED") {
    if (isReadFromPostgres()) {
      await handleDocumentDeletedPrisma(
        submission as Parameters<typeof handleDocumentDeletedPrisma>[0],
      );
    } else {
      await handleDocumentDeleted(
        submission as HydratedDocument<FormSubmissionDocument>,
      );
    }
  }

  return true;
}

async function findWebhookPacket(documentId: string) {
  return prisma.workspaceDocumentPacket.findFirst({
    where: {
      signing: {
        path: ["documentId"],
        equals: documentId,
      } as Prisma.JsonFilter,
    },
    select: { id: true },
  });
}

async function handlePacketEvent(
  eventType: string,
  packet: { id: string } | null,
) {
  if (!packet) {
    return;
  }

  if (eventType === "DOCUMENT_COMPLETED") {
    await WorkspaceDocumentPacketService.completeSigning(packet.id);
  } else if (eventType === "DOCUMENT_DELETED") {
    await WorkspaceDocumentPacketService.resetSigning(packet.id);
  }
}

async function handleRenderedDocumentEvent(
  eventType: string,
  renderedDocument: { id: string } | null,
) {
  if (!renderedDocument) {
    return;
  }

  if (eventType === "DOCUMENT_COMPLETED") {
    await handleRenderedDocumentCompletedPrisma(renderedDocument.id);
  } else if (eventType === "DOCUMENT_DELETED") {
    await handleRenderedDocumentDeletedPrisma(renderedDocument.id);
  }
}

async function persistDocumensoApiKey(
  orgId: string,
  apiToken: string,
): Promise<{ stored: boolean; notFound: boolean }> {
  if (isReadFromPostgres()) {
    const organisation = await prisma.organization.findFirst({
      where: { OR: [{ id: orgId }, { fhirId: orgId }] },
    });

    if (!organisation) {
      return { stored: false, notFound: true };
    }

    if (organisation.documensoApiKey) {
      return { stored: true, notFound: false };
    }

    await prisma.organization.updateMany({
      where: { id: organisation.id },
      data: { documensoApiKey: apiToken },
    });
    return { stored: true, notFound: false };
  }

  const query = buildOrganizationLookupQuery(orgId);
  if (!query) {
    return { stored: false, notFound: true };
  }

  const organisation = await OrganizationModel.findOne(query).lean();

  if (!organisation) {
    return { stored: false, notFound: true };
  }

  if (organisation.documensoApiKey) {
    return { stored: true, notFound: false };
  }

  await OrganizationModel.updateOne(
    { _id: organisation._id },
    { $set: { documensoApiKey: apiToken } },
  );
  return { stored: true, notFound: false };
}

const isDocumensoWebhookSignatureValid = (
  rawBody: Buffer,
  signature?: string,
) => {
  if (!process.env.DOCUMENSO_WEBHOOK_SECRET) {
    return true;
  }

  if (!signature) {
    return false;
  }

  return verifySignature(
    rawBody,
    signature,
    process.env.DOCUMENSO_WEBHOOK_SECRET,
  );
};

const resolveDocumensoRedirectUser = async (userId: string) => {
  return isReadFromPostgres()
    ? prisma.user.findFirst({
        where: { userId },
        select: { email: true, firstName: true, lastName: true },
      })
    : UserModel.findOne(
        { userId },
        { email: 1, firstName: 1, lastName: 1 },
        { sanitizeFilter: true },
      ).lean();
};

const resolveDocumensoRedirectMapping = async (
  userId: string,
  orgId: string,
) => {
  return isReadFromPostgres()
    ? prisma.userOrganization.findFirst({
        where: {
          practitionerReference: userId,
          OR: [
            { organizationReference: orgId },
            { organizationReference: `Organization/${orgId}` },
          ],
        },
        select: { roleCode: true },
      })
    : UserOrganizationModel.findOne(
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
};

export const DocumensoWebhookController = {
  async handle(req: Request, res: Response) {
    try {
      const rawBody = req.body as Buffer;

      const signature = req.headers["x-documenso-signature"] as
        | string
        | undefined;
      if (!isDocumensoWebhookSignatureValid(rawBody, signature)) {
        return res.status(401).end();
      }

      const event = parseWebhookEvent(parseWebhookBody(rawBody));

      if (!event) {
        logger.error("[DocumensoWebhook] Invalid payload");
        return res.status(400).json({ message: "Invalid payload" });
      }

      const submission = await findWebhookSubmission(event.documentId);
      const handled = await handleSubmissionEvent(event.eventType, submission);
      if (!handled) {
        // Packet signing stores the Documenso document id on the workspace
        // document packet (not a FormSubmission), so route packet completions
        // to packet finalization when no submission matches.
        const packet = await findWebhookPacket(event.documentId);
        await handlePacketEvent(event.eventType, packet);
        return res.status(200).json({ received: true });
      }

      const renderedDocument = await prisma.renderedDocument.findFirst({
        where: {
          signing: {
            path: ["documentId"],
            equals: event.documentId,
          } as Prisma.JsonFilter,
        },
      });

      await handleRenderedDocumentEvent(event.eventType, renderedDocument);
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

      return res.status(200).json({ received: true });
    } catch (err) {
      logger.error("[DocumensoWebhook] Error", err);
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
  createRedirectUrl: async (req: Request<{ orgId: string }>, res: Response) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      const { orgId } = req.params;
      const userId = authRequest.userId;

      if (!userId || !orgId) {
        return res.status(400).json({
          message: "Missing userId or orgId.",
        });
      }

      const resolvedUser = await resolveDocumensoRedirectUser(userId);
      if (!resolvedUser?.email) {
        return res.status(404).json({ message: "User not found." });
      }

      const organisation = await OrganizationService.getById(orgId);

      if (!organisation?.name) {
        return res.status(404).json({ message: "Organisation not found." });
      }

      const mapping = await resolveDocumensoRedirectMapping(userId, orgId);

      const role = mapRoleToDocumenso(mapping?.roleCode);

      const redirectUrl = await DocumensoService.generateExternalRedirectUrl({
        email: resolvedUser.email,
        name: buildDisplayName({
          email: resolvedUser.email,
          firstName: resolvedUser.firstName ?? undefined,
          lastName: resolvedUser.lastName ?? undefined,
        }),
        businessId:
          "id" in organisation && typeof organisation.id === "string"
            ? organisation.id
            : orgId,
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

const buildOrganizationLookupQuery = (reference: string) => {
  const queries: Array<Record<string, string>> = [];

  if (Types.ObjectId.isValid(reference)) {
    queries.push({ _id: reference });
  }

  if (/^[A-Za-z0-9\-.]{1,64}$/.test(reference)) {
    queries.push({ fhirId: reference });
  }

  if (!queries.length) {
    return null;
  }

  return queries.length === 1 ? queries[0] : { $or: queries };
};

export const DocumensoKeyController = {
  async storeApiKey(req: Request<{ orgId: string }>, res: Response) {
    try {
      logger.info("Getting Webhook request from documenso");
      const signature = req.headers["x-documenso-signature"] as
        | string
        | undefined;
      const secret = process.env.DOCUMENSO_PMS_WEBHOOK_SECRET;

      if (!secret) {
        logger.error("Documenso key webhook secret missing");
        return res.status(500).json({
          message: "DOCUMENSO_PMS_WEBHOOK_SECRET is not configured.",
        });
      }

      if (!signature) {
        logger.warn("Documenso key webhook signature missing");
        return res.status(401).json({ message: "Signature missing." });
      }

      const payload = JSON.stringify(req.body ?? {});

      const expected = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      if (
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
      ) {
        logger.warn("Documenso key webhook signature invalid");
        return res.status(401).json({ message: "Invalid signature." });
      }

      const body = req.body as { apiToken?: string };

      if (!body?.apiToken) {
        logger.warn("Documenso key webhook missing apiToken");
        return res.status(400).json({ message: "apiToken is required." });
      }

      const { orgId } = req.params;
      if (!buildOrganizationLookupQuery(orgId)) {
        logger.warn("Documenso key webhook invalid org id", { orgId });
        return res.status(400).json({ message: "Invalid organisation id." });
      }

      const result = await persistDocumensoApiKey(orgId, body.apiToken);

      if (result.notFound) {
        logger.warn("Documenso key webhook org not found", { orgId });
        return res.status(404).json({ message: "Organisation not found." });
      }

      if (result.stored) {
        logger.info("Documenso API key stored", { orgId });
        return res.status(200).json({ success: true });
      }

      return res.status(500).json({
        message: "Failed to store Documenso API key.",
      });
    } catch (error) {
      logger.error("Documenso API key store error:", error);
      return res.status(500).json({
        message: "Failed to store Documenso API key.",
      });
    }
  },
};

async function handleDocumentCompleted(
  submission: HydratedDocument<FormSubmissionDocument>,
) {
  if (!submission.signing) return;
  if (submission.signing.status === "SIGNED") return;

  const form = await FormModel.findById(submission.formId).lean();

  if (!form) {
    throw new Error("Form not found");
  }

  const documensoApiKey = await DocumensoService.resolveOrganisationApiKey(
    form.orgId,
  );

  if (!documensoApiKey) {
    throw new Error("Documenso API key not configured for organisation");
  }

  const signedDocument = await DocumensoService.downloadSignedDocument({
    documentId: Number.parseInt(submission.signing.documentId!, 10),
    apiKey: documensoApiKey,
  });

  if (signedDocument) {
    submission.signing.pdf = {
      url: signedDocument.downloadUrl,
    };
  }
  submission.signing.status = "SIGNED";

  await submission.save();

  try {
    const formId = normalizeObjectIdString(submission.formId);
    if (!formId) {
      throw new Error("Form id missing");
    }
    await FormAssignmentService.markSignedFromSubmission({
      organisationId: String(form.orgId),
      templateId: formId,
      templateVersion: submission.formVersion,
      appointmentId: submission.appointmentId ?? undefined,
      companionId: submission.patientId ?? undefined,
      parentId: submission.parentId ?? undefined,
    });
  } catch (error) {
    logger.warn(
      "[DocumensoWebhook] Failed to sync form assignment signed status",
      {
        error,
        submissionId:
          normalizeObjectIdString((submission as { _id?: unknown })._id) ??
          normalizeObjectIdString((submission as { id?: unknown }).id) ??
          "unknown",
      },
    );
  }
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

async function handleDocumentCompletedPrisma(submission: {
  id: string;
  formId: string;
  formVersion: number;
  appointmentId: string | null;
  patientId: string | null;
  parentId: string | null;
  signing: Prisma.JsonValue | null;
}) {
  const signing = submission.signing as {
    status?: string;
    documentId?: string;
    pdf?: { url?: string };
  } | null;
  if (!signing) return;
  if (signing.status === "SIGNED") return;

  const form = await prisma.form.findUnique({
    where: { id: submission.formId },
    select: { orgId: true },
  });

  if (!form) {
    throw new Error("Form not found");
  }

  const documensoApiKey = await DocumensoService.resolveOrganisationApiKey(
    form.orgId,
  );

  if (!documensoApiKey) {
    throw new Error("Documenso API key not configured for organisation");
  }

  const documentId = signing.documentId;
  if (!documentId) {
    throw new Error("Documenso document id missing");
  }

  const signedDocument = await DocumensoService.downloadSignedDocument({
    documentId: Number.parseInt(documentId, 10),
    apiKey: documensoApiKey,
  });

  if (signedDocument) {
    signing.pdf = {
      url: signedDocument.downloadUrl,
    };
  }
  signing.status = "SIGNED";

  await prisma.formSubmission.update({
    where: { id: submission.id },
    data: { signing: signing as unknown as Prisma.InputJsonValue },
  });

  try {
    await FormAssignmentService.markSignedFromSubmission({
      organisationId: String(form.orgId),
      templateId: submission.formId,
      templateVersion: submission.formVersion,
      appointmentId: submission.appointmentId ?? undefined,
      companionId: submission.patientId ?? undefined,
      parentId: submission.parentId ?? undefined,
    });
  } catch (error) {
    logger.warn(
      "[DocumensoWebhook] Failed to sync form assignment signed status",
      {
        error,
        submissionId: submission.id,
      },
    );
  }
}

async function handleDocumentDeletedPrisma(submission: {
  id: string;
  signing: Prisma.JsonValue | null;
}) {
  const signing = submission.signing as {
    status?: string;
    documentId?: string;
    pdf?: { url?: string };
  } | null;
  if (!signing) return;
  if (signing.status === "SIGNED") return;

  signing.status = "NOT_STARTED";

  await prisma.formSubmission.update({
    where: { id: submission.id },
    data: { signing: signing as unknown as Prisma.InputJsonValue },
  });
}

async function handleRenderedDocumentCompletedPrisma(
  renderedDocumentId: string,
) {
  await completePersistedRenderedDocumentSigning(renderedDocumentId);
}

async function handleRenderedDocumentDeletedPrisma(renderedDocumentId: string) {
  const renderedDocument = await prisma.renderedDocument.findUnique({
    where: { id: renderedDocumentId },
    select: { signing: true },
  });

  const signing = renderedDocument?.signing as {
    status?: string;
  } | null;

  if (!signing || signing.status === "SIGNED") {
    return;
  }

  signing.status = "NOT_STARTED";

  await prisma.renderedDocument.update({
    where: { id: renderedDocumentId },
    data: { signing: signing as unknown as Prisma.InputJsonValue },
  });
}
