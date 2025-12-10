import { Request, Response } from "express";
import { stringify } from "querystring";
import { generatePresignedUrl } from "src/middlewares/upload";
import { OrgDocumentCategory } from "src/models/organisation-document";
import {
  CreateOrgDocumentInput,
  OrganizationDocumentService,
  OrgDocumentServiceError,
  UpdateOrgDocumentInput,
} from "src/services/organisation-document.service";
import logger from "src/utils/logger";

type CreateOrgDocumentBody = Omit<CreateOrgDocumentInput, "organisationId">;
type UpsertPolicyBody = Omit<CreateOrgDocumentInput, "organisationId">;
type UpdateOrgDocumentBody = UpdateOrgDocumentInput;
type DocumentQuery = {
  category?: OrgDocumentCategory;
  visibility?: "INTERNAL" | "PUBLIC" | "ALL";
};
type PublicDocumentQuery = {
  category?: string;
  visibility?: string;
};

const isOrgDocumentCategory = (value: string): value is OrgDocumentCategory =>
  [
    "TERMS_AND_CONDITIONS",
    "PRIVACY_POLICY",
    "CANCELLATION_POLICY",
    "FIRE_SAFETY",
    "GENERAL",
  ].includes(value as OrgDocumentCategory);

const isVisibilityFilter = (
  value: string,
): value is "INTERNAL" | "PUBLIC" | "ALL" =>
  value === "INTERNAL" || value === "PUBLIC" || value === "ALL";

export const OrganizationDocumentController = {
  /** PMS: Create a document */
  create: async (
    req: Request<{ orgId: string }, unknown, CreateOrgDocumentBody>,
    res: Response,
  ) => {
    try {
      const organisationId = req.params.orgId;
      const body = req.body;

      const doc = await OrganizationDocumentService.createDocument({
        ...body,
        organisationId,
      });

      res.status(201).json({ data: doc });
    } catch (err) {
      if (err instanceof OrgDocumentServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  /** PMS: Update a document */
  update: async (
    req: Request<
      { orgId: string; documentId: string },
      unknown,
      UpdateOrgDocumentBody
    >,
    res: Response,
  ) => {
    try {
      const documentId = req.params.documentId;
      const updates = req.body;

      const doc = await OrganizationDocumentService.updateDocument(
        documentId,
        updates,
      );

      res.status(200).json({ data: doc });
    } catch (err) {
      if (err instanceof OrgDocumentServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  /** PMS: Delete document */
  remove: async (req: Request<{ documentId: string }>, res: Response) => {
    try {
      const documentId = req.params.documentId;

      await OrganizationDocumentService.deleteDocument(documentId);

      res.status(204).send();
    } catch (err) {
      if (err instanceof OrgDocumentServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  /** PMS: Get one document */
  getById: async (req: Request<{ documentId: string }>, res: Response) => {
    try {
      const documentId = req.params.documentId;

      const doc = await OrganizationDocumentService.getDocumentById(documentId);

      res.status(200).json({ data: doc });
    } catch (err) {
      if (err instanceof OrgDocumentServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  /** PMS: List all documents */
  list: async (
    req: Request<{ orgId: string }, unknown, unknown, DocumentQuery>,
    res: Response,
  ) => {
    try {
      const organisationId = req.params.orgId;
      const category =
        typeof req.query.category === "string" &&
        isOrgDocumentCategory(req.query.category)
          ? req.query.category
          : undefined;
      const visibility =
        typeof req.query.visibility === "string" &&
        isVisibilityFilter(req.query.visibility)
          ? req.query.visibility
          : undefined;

      const docs =
        await OrganizationDocumentService.listDocumentsForOrganisation({
          organisationId,
          category,
          visibility,
        });

      res.status(200).json({ data: docs });
    } catch (err) {
      if (err instanceof OrgDocumentServiceError)
        return res.status(err.statusCode).json({ message: err.message });

      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  /** MOBILE: list only public documents */
  listPublic: async (
    req: Request<{ orgId: string }, unknown, unknown, PublicDocumentQuery>,
    res: Response,
  ) => {
    try {
      const organisationId = req.params.orgId;
      const category =
        typeof req.query.category === "string" ? req.query.category : undefined;
      const visibility =
        typeof req.query.visibility === "string"
          ? req.query.visibility
          : undefined;
      const filter: {
        organisationId: string;
        category?: string;
        visibility?: string;
      } = {
        organisationId,
      };

      if (category) filter.category = category;
      if (visibility) filter.visibility = visibility;

      const docs =
        await OrganizationDocumentService.listPublicDocumentsForOrganisation(
          filter,
        );

      res.status(200).json({ data: docs });
    } catch (err) {
      if (err instanceof OrgDocumentServiceError)
        return res.status(err.statusCode).json({ message: err.message });

      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  /** PMS: upsert (T&C, privacy policy, cancellation policy) */
  upsertPolicy: async (
    req: Request<{ orgId: string }, unknown, UpsertPolicyBody>,
    res: Response,
  ) => {
    try {
      const organisationId = req.params.orgId;
      const body = req.body;

      const doc = await OrganizationDocumentService.upsertPolicyDocument({
        ...body,
        organisationId,
        visibility: "PUBLIC", // policy docs must be public
      });

      res.status(200).json({ data: doc });
    } catch (err) {
      if (err instanceof OrgDocumentServiceError)
        return res.status(err.statusCode).json({ message: err.message });

      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  uploadFile: async (req: Request, res: Response) => {
    try {
      const rawBody: unknown = req.body;
      const orgId = req.params;
      const mimeType =
        typeof rawBody === "object" && rawBody !== null && "mimeType" in rawBody
          ? (rawBody as { mimeType?: unknown }).mimeType
          : undefined;

      if (typeof mimeType !== "string" || !mimeType) {
        res
          .status(400)
          .json({ message: "MIME type is required in the request body." });
        return;
      }
      if (orgId) {
        const { url, key } = await generatePresignedUrl(
          mimeType,
          "org",
          stringify(orgId),
        );
        res.status(200).json({ uploadUrl: url, s3Key: key });
      } else {
        const { url, key } = await generatePresignedUrl(mimeType, "temp");
        res.status(200).json({ uploadUrl: url, s3Key: key });
      }
    } catch (error) {
      logger.error("Failed to generate logo upload URL", error);
      res.status(500).json({ message: "Unable to generate logo upload URL." });
    }
  },
};
