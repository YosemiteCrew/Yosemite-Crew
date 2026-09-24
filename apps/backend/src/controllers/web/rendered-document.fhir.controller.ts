import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import {
  getPersistedRenderedDocument,
  getPersistedRenderedDocumentPdf,
  getRenderedDocumentSourceAuthorId,
  RenderedDocumentServiceError,
  rerenderPersistedClinicalRenderedDocumentPdf,
  type RenderedDocumentSigning,
  signPersistedRenderedDocument,
  toRenderedDocumentReadDto,
} from "src/services/rendered-document.service";
import { createFhirErrorHandler } from "src/controllers/web/fhir-controller.shared";
import type { OrgRequest } from "src/middlewares/rbac";

const signRenderedDocumentSchema = z.object({
  signatureText: z.string().trim().min(1).optional(),
  signedAt: z.coerce.date().optional(),
});

const handleError = createFhirErrorHandler({
  isServiceError: (error): error is RenderedDocumentServiceError =>
    error instanceof RenderedDocumentServiceError,
  invalidPayloadMessage: "Invalid rendered document payload.",
  logMessage: "Unexpected rendered document error",
});

/**
 * The routes admit any holder of a clinical view permission, but `INVOICE` is a
 * valid rendered-document kind and is financial rather than clinical, so it
 * carries its own gate.
 */
const isPermittedKind = (req: Request, kind: string): boolean =>
  kind !== "INVOICE" ||
  ((req as OrgRequest).userPermissions ?? []).includes("billing:view:any");

const forbidden = (res: Response) =>
  res.status(403).json({ message: "Forbidden – insufficient permissions" });

/**
 * The write routes admit any holder of one of the edit permissions, but signing
 * or re-rendering a document acts on the record it was produced from, so each
 * kind takes the permission that record's own routes take. A prescription needs
 * `prescription:edit:any`, or `prescription:edit:own` on one the caller
 * authored (as on the prescription routes). Every other kind is edited under
 * `forms:edit:any` (as on the form, consent, SOAP note, discharge summary and
 * vital record routes).
 */
const mayEditKind = async (
  req: Request,
  document: Awaited<ReturnType<typeof getPersistedRenderedDocument>>,
): Promise<boolean> => {
  const { userPermissions = [], userId } = req as OrgRequest;

  if (document.kind !== "PRESCRIPTION") {
    return userPermissions.includes("forms:edit:any");
  }
  if (userPermissions.includes("prescription:edit:any")) {
    return true;
  }

  // The verified session only: an authorization outcome never rests on a
  // client-supplied id.
  const actorId = userId?.trim();
  if (!actorId || !userPermissions.includes("prescription:edit:own")) {
    return false;
  }
  return (await getRenderedDocumentSourceAuthorId(document)) === actorId;
};

const resolveSignerProfile = async (userId: string) => {
  const user = (await prisma.user.findUnique({
    where: { userId },
    select: { email: true, firstName: true, lastName: true },
  })) as {
    email: string | null;
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

      if (!isPermittedKind(req, document.kind)) {
        return forbidden(res);
      }

      return res.status(200).json(toRenderedDocumentReadDto(document));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getRenderedDocumentPdf(req: Request, res: Response) {
    try {
      const document = await getPersistedRenderedDocument(
        req.params.renderedDocumentId,
        req.params.organisationId,
      );

      if (!isPermittedKind(req, document.kind)) {
        return forbidden(res);
      }

      const { pdf, filename, contentType } =
        await getPersistedRenderedDocumentPdf(
          req.params.renderedDocumentId,
          req.params.organisationId,
        );

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      return res.status(200).send(pdf);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async rerenderRenderedDocumentPdf(req: Request, res: Response) {
    try {
      const document = await getPersistedRenderedDocument(
        req.params.renderedDocumentId,
        req.params.organisationId,
      );

      if (!(await mayEditKind(req, document))) {
        return forbidden(res);
      }

      const { pdf, filename, contentType } =
        await rerenderPersistedClinicalRenderedDocumentPdf(
          req.params.renderedDocumentId,
          req.params.organisationId,
        );

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      return res.status(200).send(pdf);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async signRenderedDocument(req: Request, res: Response) {
    try {
      const body = signRenderedDocumentSchema.parse(req.body);
      const userId = (req as OrgRequest).userId ?? "";

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated." });
      }

      const existing = await getPersistedRenderedDocument(
        req.params.renderedDocumentId,
        req.params.organisationId,
      );

      if (!(await mayEditKind(req, existing))) {
        return forbidden(res);
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
