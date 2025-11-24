import { Request, Response } from "express";
import logger from "../../utils/logger";
import { DocumentAttachmentInput, DocumentCreateContext, DocumentService, DocumentServiceError } from "../../services/document.service";
import { generatePresignedDownloadUrl, generatePresignedUrl } from "src/middlewares/upload";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { AuthUserMobileService } from "src/services/authUserMobile.service";

type UploadUrlBody = { companionId?: string; mimeType?: string };

type DocumentRequestBody = {
  title?: string;
  category?: string;
  subcategory?: string | null;
  attachments?: DocumentAttachmentInput[];
  appointmentId?: string | null;
  visitType?: string | null;
  issuingBusinessName?: string | null;
  issueDate?: string | Date | null;
};

type UpdateDocumentParams = {
  id?: string;
  documentId?: string;
};

type ListDocumentsQuery = {
  category?: string;
  subcategory?: string;
};

type ListPmsQuery = ListDocumentsQuery & {
  appointmentId?: string;
};

type SignedDownloadUrlBody = { key?: string };

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authReq = req as AuthenticatedRequest;
  const headerUserId = req.headers?.["x-user-id"];
  if (typeof headerUserId === "string") return headerUserId;
  return authReq.userId;
};

const getFirstQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string") {
        return entry;
      }
    }
  }
  return undefined;
};

export const DocumentController = {
  // Generate Pre-signed URL for document upload
  getUploadUrl: async (
    req: Request<unknown, unknown, UploadUrlBody>,
    res: Response
  ) => {
    try {
      const { companionId, mimeType } = req.body;

      if (!companionId || !mimeType) {
        return res.status(400).json({ message: "companionId and mimeType are required." });
      }

      const { url, key } = await generatePresignedUrl(mimeType, "companion", companionId)

      return res.status(200).json({ url, key });
    } catch (error) {
      logger.error("Failed to generate upload URL", error);
      return res.status(500).json({ message: "Failed to generate upload URL." });
    }
  },

  // Create Document for Companion
  createDocument: async (
    req: Request<{ companionId?: string }, unknown, DocumentRequestBody>,
    res: Response
  ) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      const companionId = req.params.companionId;

      if (!companionId) {
        return res.status(400).json({ message: "Companion ID is required." });
      }

      if (!authUserId) {
        return res.status(401).json({ message: "User not authenticated." });
      }

      const authUserMobile = await AuthUserMobileService.getByProviderUserId(authUserId);

      if (!authUserMobile?.parentId) {
        return res.status(401).json({ message: "Parent profile not found." });
      }

      const body = req.body;

      const created = await DocumentService.create(
      {
        companionId,
        title: body.title!,
        category: body.category!,
        subcategory: body.subcategory,
        attachments: body.attachments ?? [],
      },
      {
        parentId: authUserMobile.parentId
      });

      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof DocumentServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Mobile: Failed to create document", error);
      return res.status(500).json({ message: "Unable to create document." });
    }
  },

  createDocumentPms: async (
    req: Request<{ companionId?: string }, unknown, DocumentRequestBody>,
    res: Response
  ) => {
    try {
      const pmsUserId = resolveUserIdFromRequest(req);
      const { companionId } = req.params;

      if (!pmsUserId) {
        return res.status(401).json({ message: "PMS user not authenticated." });
      }

      if (!companionId) {
        return res.status(400).json({ message: "Companion ID is required." });
      }

      const body = req.body;
      const created = await DocumentService.create(
        {
          companionId,
          title: body.title!,
          category: body.category!,
          subcategory: body.subcategory,
          attachments: body.attachments ?? [],
          appointmentId: body.appointmentId ?? null
        },
        {
          pmsUserId: pmsUserId
        }
      );

      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof DocumentServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("PMS: Failed to create document", error);
      return res.status(500).json({ message: "Unable to create document." });
    }
  },

  listDocumentsForParent: async (
    req: Request<{ companionId?: string }, unknown, unknown, ListDocumentsQuery>,
    res: Response
  ) => {
    try {
      const { companionId } = req.params;
      const category = req.query.category;
      const subcategory = req.query.subcategory;
      if (!companionId) {
        return res.status(400).json({ message: "Companion ID is required." });
      }

      const docs = await DocumentService.listForParent({
        companionId,
        category,
        subcategory,
      });

      return res.status(200).json(docs);
    } catch (error) {
      if (error instanceof DocumentServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list documents", error);
      return res.status(500).json({ message: "Unable to fetch documents." });
    }
  },

  listForAppointment: async (
    req: Request<{ appointmentId: string }>,
    res: Response
  ) => {
    try {
      const { appointmentId } = req.params;

      const docs = await DocumentService.listForAppointmentParent(appointmentId);
      return res.status(200).json(docs);
    } catch (error) {
      if (error instanceof DocumentServiceError)
        return res.status(error.statusCode).json({ message: error.message });

      logger.error("Failed to fetch appointment documents", error);
      return res.status(500).json({ message: "Unable to fetch documents." });
    }
  },

  // Update Document
  updateDocument: async (
    req: Request<UpdateDocumentParams, unknown, Partial<DocumentRequestBody>>,
    res: Response
  ) => {
    try {
      const userId = resolveUserIdFromRequest(req);
      const documentId = req.params.documentId ?? req.params.id;
      let context: DocumentCreateContext;
      const updates = req.body;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated." });
      }

      if (!documentId) {
        return res.status(400).json({ message: "Document ID is required." });
      }

      const authUserMobile = await AuthUserMobileService.getByProviderUserId(userId);

      if(authUserMobile?.parentId) {
        context = {
          parentId: authUserMobile.parentId
        };
      } else {
        context = {
          pmsUserId: userId
        };
      }

      const updated = await DocumentService.update(documentId, updates, context);

      return res.status(200).json(updated);

    } catch (error) {
      if (error instanceof DocumentServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to update document", error);
      return res.status(500).json({ message: "Unable to update document." });
    }
  },

  listForPms: async (
    req: Request<{ companionId?: string }, unknown, unknown, ListPmsQuery>,
    res: Response
  ) => {
    try {
      const pmsUserId = resolveUserIdFromRequest(req);
      if (!pmsUserId) {
        return res.status(401).json({ message: "Not authenticated as PMS user." });
      }

      const { companionId } = req.params;
      const { category, subcategory, appointmentId } = req.query;

      if (!companionId) {
        return res.status(400).json({ message: "Companion ID is required." });
      }

      const docs = await DocumentService.listForPms({
        companionId,
        category: getFirstQueryValue(category),
        subcategory: getFirstQueryValue(subcategory),
        appointmentId: getFirstQueryValue(appointmentId),
      });

      return res.status(200).json(docs);

    } catch (error) {
      if (error instanceof DocumentServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list documents for PMS", error);
      return res.status(500).json({ message: "Unable to fetch documents." });
    }
  },

  getForParent: async (req: Request<{ id: string }>, res: Response) => {
    try {
      
      const { id } = req.params;
      const doc = await DocumentService.getByIdForParent(id);

      if (!doc) {
        return res.status(404).json({ message: "Document not found." });
      }

      return res.json(doc);

    } catch (error) {
      if (error instanceof DocumentServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to get document", error);
      return res.status(500).json({ message: "Unable to fetch document." });
    }
  },

  getForPms: async (req: Request<{ documentId: string }>, res: Response) => {
    try {
      const { documentId } = req.params;
      const doc = await DocumentService.getByIdForPms(documentId);

      if (!doc) {
        return res.status(404).json({ message: "Document not found." });
      }

      return res.json(doc);

    } catch (error) {
      if (error instanceof DocumentServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to get document (PMS)", error);
      return res.status(500).json({ message: "Unable to fetch document." });
    }
  },

  deleteForParent: async (req: Request<{ documentId: string }>, res: Response) => {
    try {
      const authId = resolveUserIdFromRequest(req);
      if (!authId) {
        return res.status(401).json({ message: "User not authenticated." });
      }

      const authUser = await AuthUserMobileService.getByProviderUserId(authId);
      if(!authUser) {
        return res.status(401).json({ message: "No user found with this authId" });
      }

      const { documentId } = req.params;

      await DocumentService.deleteForParent(documentId, authUser.parentId!);

      return res.status(204).send();

    } catch (error) {
      if (error instanceof DocumentServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to delete document", error);
      return res.status(500).json({ message: "Unable to delete document." });
    }
  },

  getSignedDownloadUrl: async (
    req: Request<unknown, unknown, SignedDownloadUrlBody>,
    res: Response
  ) => {
    try{

      const { key } = req.body;
      if (!key) {
        return res.status(400).json({ message: "Key is required." });
      }

      const url = await generatePresignedDownloadUrl(key);
      return res.status(200).send(url);
    }catch (error) {
      logger.error("Failed to generate signed download URL", error);
      return res.status(500).json({ message: "Unable to generate download link." });
    }
  },

  getDocumentDownloadUrl: async (req: Request, res: Response) => {
    try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({ message: "Document ID is required." });
    }

    const urls = await DocumentService.getAllAttachmentUrls(documentId)

    return res.status(200).json(urls);

  } catch (error) {
    if (error instanceof DocumentServiceError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    logger.error("Failed to get presigned URL", error);
    return res.status(500).json({ message: "Unable to generate download link." });
  }
  }
}
