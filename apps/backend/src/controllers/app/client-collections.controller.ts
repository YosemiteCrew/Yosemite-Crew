import { Request, Response } from "express";
import { z } from "zod";
import { resolveAuthorizedOrganisationId } from "src/middlewares/authorized-organisation";
import { resolveVerifiedUserId } from "src/utils/request";
import {
  ClientCollectionsError,
  ClientCollectionsService,
} from "src/services/finance/client-collections";
import logger from "src/utils/logger";

const ParentIdSchema = z.uuid();
const InvoiceIdSchema = z.uuid();
const PaymentTermsSchema = z.object({
  netDays: z.number().int().min(0).max(365),
});

const respondWithError = (res: Response, error: unknown, message: string) => {
  if (error instanceof ClientCollectionsError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(message, error);
  return res.status(500).json({ message: "Internal server error" });
};

export const ClientCollectionsController = {
  async getPaymentTerms(this: void, req: Request, res: Response) {
    const organisationId = resolveAuthorizedOrganisationId(
      req,
      res,
      req.params.organisationId,
    );
    if (!organisationId) return;
    const parsedParentId = ParentIdSchema.safeParse(req.params.parentId);
    if (!parsedParentId.success) {
      return res.status(400).json({ message: "Invalid client id." });
    }
    try {
      return res.status(200).json({
        data: await ClientCollectionsService.getPaymentTerms(
          organisationId,
          parsedParentId.data,
        ),
        error: null,
      });
    } catch (error) {
      return respondWithError(res, error, "Error reading client payment terms");
    }
  },

  async setPaymentTerms(this: void, req: Request, res: Response) {
    const organisationId = resolveAuthorizedOrganisationId(
      req,
      res,
      req.params.organisationId,
    );
    if (!organisationId) return;
    const actorId = resolveVerifiedUserId(req);
    if (!actorId) return res.status(401).json({ message: "Unauthenticated" });
    const parsedParentId = ParentIdSchema.safeParse(req.params.parentId);
    if (!parsedParentId.success) {
      return res.status(400).json({ message: "Invalid client id." });
    }
    const body = PaymentTermsSchema.safeParse(req.body);
    if (!body.success) {
      return res
        .status(400)
        .json({ message: "Payment terms must be between 0 and 365 days." });
    }
    try {
      return res.status(200).json({
        data: await ClientCollectionsService.setPaymentTerms({
          organisationId,
          parentId: parsedParentId.data,
          netDays: body.data.netDays,
          updatedBy: actorId,
        }),
        error: null,
      });
    } catch (error) {
      return respondWithError(
        res,
        error,
        "Error updating client payment terms",
      );
    }
  },

  async listOverdue(this: void, req: Request, res: Response) {
    const organisationId = resolveAuthorizedOrganisationId(
      req,
      res,
      req.params.organisationId,
    );
    if (!organisationId) return;
    try {
      return res.status(200).json({
        data: await ClientCollectionsService.listOverdue(organisationId),
        error: null,
      });
    } catch (error) {
      return respondWithError(
        res,
        error,
        "Error reading overdue client accounts",
      );
    }
  },

  async markReviewed(this: void, req: Request, res: Response) {
    const organisationId = resolveAuthorizedOrganisationId(
      req,
      res,
      req.params.organisationId,
    );
    if (!organisationId) return;
    const actorId = resolveVerifiedUserId(req);
    if (!actorId) return res.status(401).json({ message: "Unauthenticated" });
    const parsedInvoiceId = InvoiceIdSchema.safeParse(req.params.invoiceId);
    if (!parsedInvoiceId.success) {
      return res.status(400).json({ message: "Invalid invoice id." });
    }
    try {
      return res.status(200).json({
        data: await ClientCollectionsService.markReviewed({
          organisationId,
          invoiceId: parsedInvoiceId.data,
          reviewedBy: actorId,
        }),
        error: null,
      });
    } catch (error) {
      return respondWithError(res, error, "Error reviewing overdue invoice");
    }
  },
};
