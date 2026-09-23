import { z } from "zod";
import { resolveVerifiedOrganisationId } from "src/utils/request";
import { Request, Response } from "express";
import {
  InvoiceService,
  InvoiceServiceError,
} from "src/services/invoice.service";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import logger from "src/utils/logger";
import { OrgRequest } from "src/middlewares/rbac";
import { AuthenticatedRequest } from "src/middlewares/auth";

type AddChargesBody = {
  items?: unknown;
};

type UpdatePaymentCollectionMethodBody = {
  paymentCollectionMethod?: unknown;
};

type IssueCreditNoteBody = {
  amount?: unknown;
  reason?: unknown;
  metadata?: unknown;
};

type VoidCreditNoteBody = {
  reason?: unknown;
};

/**
 * Charge lines accepted from a caller.
 *
 * Deliberately declares no `id`, so Zod strips one the caller sent. The line id
 * is the invoice's own identity for that row and is assigned server-side; a
 * caller that could name it could point a new line at an id the settlement path
 * matches against `WorkspaceTreatmentItem.invoiceRowId`, marking a treatment
 * item on that appointment settled without it ever having been billed.
 *
 * This is the same schema the two sibling charge endpoints in
 * `finance.controller.ts` already parse with. This handler was the one that
 * type-guarded `req.body` instead, and a type guard narrows without stripping,
 * so every extra key the caller sent - `id` included - reached the service.
 */
const AddChargesItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  description: z.string().nullish(),
  discountPercent: z.number().optional(),
});

const AddChargesBodySchema = z.object({
  items: z.array(AddChargesItemSchema).min(1),
});

const isCreditNoteMetadata = (
  metadata: unknown,
): metadata is Record<string, string | number | boolean> => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }

  return Object.values(metadata).every(
    (value) =>
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean",
  );
};

const toFinanceEnvelope = <T>(data: T) => ({
  data,
  meta: null,
  error: null,
});

// Web routes are bound to the organisation the RBAC middleware authorized;
// mobile routes fall back to the pet parent linked to the session.
const resolveInvoiceScope = async (req: Request) => {
  const organisationId = (req as OrgRequest).organisationId;
  if (organisationId) {
    return { organisationId, parentId: null };
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.userId) {
    return { organisationId: null, parentId: null };
  }

  const authUser = await AuthUserMobileService.getByProviderUserId(
    authReq.userId,
  );
  return { organisationId: null, parentId: authUser?.parentId ?? null };
};

export const InvoiceController = {
  async listInvoicesForAppointment(this: void, req: Request, res: Response) {
    try {
      const appointmentId = req.params.appointmentId;
      const scope = await resolveInvoiceScope(req);
      if (!scope.organisationId && !scope.parentId) {
        return res.status(403).json({
          message: "Parent account is not linked to this mobile user",
        });
      }

      const invoices = await InvoiceService.getByAppointmentId(
        appointmentId,
        scope,
      );
      return res.status(200).json(toFinanceEnvelope(invoices));
    } catch (err) {
      const statusCode =
        err instanceof InvoiceServiceError ? err.statusCode : 500;
      const message =
        err instanceof InvoiceServiceError
          ? err.message
          : "Internal server error";

      logger.error("Error fetching appointment invoices", err);
      return res.status(statusCode).json({ message });
    }
  },
  async getInvoiceById(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      const scope = await resolveInvoiceScope(req);
      if (!scope.organisationId && !scope.parentId) {
        return res.status(403).json({
          message: "Parent account is not linked to this mobile user",
        });
      }

      const invoice = await InvoiceService.getById(invoiceId, scope);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      return res.status(200).json(toFinanceEnvelope(invoice));
    } catch (err) {
      const statusCode =
        err instanceof InvoiceServiceError ? err.statusCode : 500;
      const message =
        err instanceof InvoiceServiceError
          ? err.message
          : "Internal server error";

      logger.error("Error fetching invoice by ID", err);
      return res.status(statusCode).json({ message });
    }
  },
  async getInvoiceByPaymentIntentId(this: void, req: Request, res: Response) {
    try {
      const paymentIntentId = req.params.paymentIntentId;
      const scope = await resolveInvoiceScope(req);
      if (!scope.organisationId && !scope.parentId) {
        return res.status(403).json({
          message: "Parent account is not linked to this mobile user",
        });
      }

      const invoice = await InvoiceService.getByPaymentIntentId(
        paymentIntentId,
        scope,
      );
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      return res.status(200).json(toFinanceEnvelope(invoice));
    } catch (err) {
      const statusCode =
        err instanceof InvoiceServiceError ? err.statusCode : 500;
      const message =
        err instanceof InvoiceServiceError
          ? err.message
          : "Internal server error";

      logger.error("Error fetching invoice by Payment Intent ID", err);
      return res.status(statusCode).json({ message });
    }
  },
  async createCheckoutSessionForInvoice(
    this: void,
    req: Request,
    res: Response,
  ) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const result =
        await InvoiceService.createCheckoutSessionAndEmailParent(invoiceId);
      return res.status(200).json(toFinanceEnvelope(result));
    } catch (err) {
      logger.error("Error creating invoice checkout session", err);

      const statusCode =
        err instanceof InvoiceServiceError ? err.statusCode : 500;
      const message =
        err instanceof InvoiceServiceError
          ? err.message
          : "Internal server error";

      return res.status(statusCode).json({ message });
    }
  },

  async addChargesToAppointment(
    this: void,
    req: Request<{ appointmentId: string }, unknown, AddChargesBody>,
    res: Response,
  ) {
    try {
      const { appointmentId } = req.params;
      const organisationId = (req as OrgRequest).organisationId;

      const body = AddChargesBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Items are required" });
      }

      const invoice = await InvoiceService.addChargesToAppointment(
        appointmentId,
        body.data.items,
        organisationId,
      );

      return res.status(200).json(toFinanceEnvelope(invoice));
    } catch (err) {
      logger.error("Error adding charges to appointment", err);

      const statusCode =
        err instanceof InvoiceServiceError ? err.statusCode : 500;
      const message =
        err instanceof InvoiceServiceError
          ? err.message
          : "Internal server error";

      return res.status(statusCode).json({ message });
    }
  },

  async listInvoicesForOrganisation(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId)
        return res.status(400).json({ message: "Organisation Id is reqired." });

      const invoices = await InvoiceService.listForOrganisation(organisationId);
      return res.status(200).json(toFinanceEnvelope(invoices));
    } catch (err) {
      logger.error("Error fetching appointment invoices", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async bootstrapInvoiceForAppointment(
    this: void,
    req: Request<{ appointmentId: string }>,
    res: Response,
  ) {
    try {
      const appointmentId = req.params.appointmentId;
      if (!appointmentId) {
        return res.status(400).json({ message: "Appointment Id is required" });
      }

      // `withAppointmentOrgPermissions` already derived the organisation FROM
      // the appointment, so passing it back is a belt-and-braces assertion that
      // the two agree rather than a new check.
      const invoice = await InvoiceService.bootstrapForAppointment(
        appointmentId,
        undefined,
        resolveVerifiedOrganisationId(req),
      );
      return res.status(200).json(toFinanceEnvelope(invoice));
    } catch (err) {
      logger.error("Error bootstrapping appointment invoice", err);

      const statusCode =
        err instanceof InvoiceServiceError ? err.statusCode : 500;
      const message =
        err instanceof InvoiceServiceError
          ? err.message
          : "Internal server error";

      return res.status(statusCode).json({ message });
    }
  },

  async markInvoicePaidManually(this: void, req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId;
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const invoice = await InvoiceService.markInvoicePaidManually(
        invoiceId,
        organisationId,
      );
      if (!invoice) {
        return res.status(409).json({ message: "Invoice already paid." });
      }

      return res.status(200).json(toFinanceEnvelope(invoice));
    } catch (err) {
      logger.error("Error marking invoice paid", err);

      const statusCode =
        err instanceof InvoiceServiceError ? err.statusCode : 500;
      const message =
        err instanceof InvoiceServiceError
          ? err.message
          : "Internal server error";

      return res.status(statusCode).json({ message });
    }
  },

  async updatePaymentCollectionMethod(
    this: void,
    req: Request<
      { invoiceId: string },
      unknown,
      UpdatePaymentCollectionMethodBody
    >,
    res: Response,
  ) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId;
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const { paymentCollectionMethod } = req.body;
      if (typeof paymentCollectionMethod !== "string") {
        return res
          .status(400)
          .json({ message: "paymentCollectionMethod is required" });
      }

      const invoice = await InvoiceService.updatePaymentCollectionMethod(
        invoiceId,
        organisationId,
        paymentCollectionMethod,
      );

      return res.status(200).json(toFinanceEnvelope(invoice));
    } catch (err) {
      logger.error("Error updating payment collection method", err);

      const statusCode =
        err instanceof InvoiceServiceError ? err.statusCode : 500;
      const message =
        err instanceof InvoiceServiceError
          ? err.message
          : "Internal server error";

      return res.status(statusCode).json({ message });
    }
  },

  async issueCreditNote(
    this: void,
    req: Request<{ invoiceId: string }, unknown, IssueCreditNoteBody>,
    res: Response,
  ) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId;
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const amount = req.body.amount;
      if (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return res
          .status(400)
          .json({ message: "Credit note amount is required" });
      }

      const reason =
        typeof req.body.reason === "string" ? req.body.reason : undefined;
      const metadata = isCreditNoteMetadata(req.body.metadata)
        ? req.body.metadata
        : undefined;

      const creditNote = await InvoiceService.issueCreditNote(invoiceId, {
        amount,
        reason,
        metadata,
      });

      return res.status(201).json(toFinanceEnvelope(creditNote));
    } catch (err) {
      logger.error("Error issuing credit note", err);

      const statusCode =
        err instanceof InvoiceServiceError ? err.statusCode : 500;
      const message =
        err instanceof InvoiceServiceError
          ? err.message
          : "Internal server error";

      return res.status(statusCode).json({ message });
    }
  },

  async voidCreditNote(
    this: void,
    req: Request<
      { invoiceId: string; creditNoteId: string },
      unknown,
      VoidCreditNoteBody
    >,
    res: Response,
  ) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId;
      const invoiceId = req.params.invoiceId;
      const creditNoteId = req.params.creditNoteId;

      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      if (!creditNoteId) {
        return res.status(400).json({ message: "Credit note Id is required" });
      }

      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const reason =
        typeof req.body.reason === "string" ? req.body.reason : undefined;
      const creditNote = await InvoiceService.voidCreditNote(
        invoiceId,
        creditNoteId,
        reason,
      );

      return res.status(200).json(toFinanceEnvelope(creditNote));
    } catch (err) {
      logger.error("Error voiding credit note", err);

      const statusCode =
        err instanceof InvoiceServiceError ? err.statusCode : 500;
      const message =
        err instanceof InvoiceServiceError
          ? err.message
          : "Internal server error";

      return res.status(statusCode).json({ message });
    }
  },
};
