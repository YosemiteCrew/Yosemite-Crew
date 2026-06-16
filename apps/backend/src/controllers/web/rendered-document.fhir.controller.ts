import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import { AuthenticatedRequest } from "src/middlewares/auth";
import UserModel from "src/models/user";
import {
  getPersistedRenderedDocument,
  RenderedDocumentServiceError,
  type RenderedDocumentSigning,
  signPersistedRenderedDocument,
} from "src/services/rendered-document.service";
import logger from "src/utils/logger";

const signRenderedDocumentSchema = z.object({
  signatureText: z.string().trim().min(1).optional(),
  signedAt: z.coerce.date().optional(),
});

const handleError = (error: unknown, res: Response) => {
  if (error instanceof RenderedDocumentServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid rendered document payload.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  logger.error("Unexpected rendered document error", error);
  return res.status(500).json({ message: "Internal Server Error" });
};

const resolveUserId = (req: Request) => {
  const typed = req as AuthenticatedRequest;
  return typeof typed.userId === "string" ? typed.userId : "";
};

const resolveSignerProfile = async (userId: string) => {
  if (isReadFromPostgres()) {
    const user = (await prisma.user.findUnique({
      where: { userId },
      select: { email: true, firstName: true, lastName: true },
    })) as {
      email: string;
      firstName?: string | null;
      lastName?: string | null;
    } | null;

    if (!user) {
      return null;
    }

    return {
      email: user.email,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
    };
  }

  const user = (await UserModel.findOne(
    { userId },
    { email: 1, firstName: 1, lastName: 1 },
    { sanitizeFilter: true },
  ).lean()) as {
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;

  if (!user?.email) {
    return null;
  }

  return {
    email: user.email,
    name:
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
  };
};

export const RenderedDocumentFhirController = {
  async getRenderedDocument(req: Request, res: Response) {
    try {
      const document = await getPersistedRenderedDocument(
        req.params.renderedDocumentId,
        req.params.organisationId,
      );

      return res.status(200).json(document);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async signRenderedDocument(req: Request, res: Response) {
    try {
      const body = signRenderedDocumentSchema.parse(req.body);
      const userId = resolveUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated." });
      }

      const signer = await resolveSignerProfile(userId);
      if (!signer) {
        return res.status(404).json({ message: "Signer profile not found." });
      }

      const document = await signPersistedRenderedDocument({
        renderedDocumentId: req.params.renderedDocumentId,
        organisationId: req.params.organisationId,
        signerId: userId,
        signerType: "PMS_USER",
        signerEmail: signer.email,
        signerName: signer.name,
        signatureText: body.signatureText,
        signedAt: body.signedAt,
      });

      const signing = document.signing as RenderedDocumentSigning | null;

      return res.status(200).json({
        documentId: signing?.documentId ?? null,
        signingUrl: signing?.signingUrl ?? null,
      });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
