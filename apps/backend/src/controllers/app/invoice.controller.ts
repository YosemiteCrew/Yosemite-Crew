import { InvoiceItem } from "@yosemite-crew/types";
import { Request, Response } from "express";
import {
  InvoiceService,
  InvoiceServiceError,
} from "src/services/invoice.service";
import logger from "src/utils/logger";

type AddChargesBody = {
  items?: unknown;
  currency?: unknown;
};

const isInvoiceItem = (item: unknown): item is InvoiceItem => {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Partial<InvoiceItem>;

  const hasValidDescription =
    candidate.description === undefined ||
    candidate.description === null ||
    typeof candidate.description === "string";

  const hasValidDiscount =
    candidate.discountPercent === undefined ||
    typeof candidate.discountPercent === "number";

  return (
    typeof candidate.name === "string" &&
    typeof candidate.quantity === "number" &&
    typeof candidate.unitPrice === "number" &&
    typeof candidate.total === "number" &&
    hasValidDescription &&
    hasValidDiscount
  );
};

const isInvoiceItemArray = (items: unknown): items is InvoiceItem[] =>
  Array.isArray(items) && items.every(isInvoiceItem);

export const InvoiceController = {
  async listInvoicesForAppointment(this: void, req: Request, res: Response) {
    try {
      const appointmentId = req.params.appointmentId;
      const invoices = await InvoiceService.getByAppointmentId(appointmentId);
      return res.status(200).json(invoices);
    } catch (err) {
      logger.error("Error fetching appointment invoices", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
  async getInvoiceById(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      const invoice = await InvoiceService.getById(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      return res.status(200).json(invoice);
    } catch (err) {
      logger.error("Error fetching invoice by ID", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
  async getInvoiceByPaymentIntentId(this: void, req: Request, res: Response) {
    try {
      const paymentIntentId = req.params.paymentIntentId;
      const invoice =
        await InvoiceService.getByPaymentIntentId(paymentIntentId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      return res.status(200).json(invoice);
    } catch (err) {
      logger.error("Error fetching invoice by Payment Intent ID", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
  async createCheckoutSessionForInvoice(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const result =
        await InvoiceService.createCheckoutSessionAndEmailParent(invoiceId);
      return res.status(200).json(result);
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
      const { items, currency }: AddChargesBody = req.body;

      if (typeof currency !== "string" || currency.trim().length === 0) {
        return res.status(400).json({ message: "Currency is required" });
      }

      if (!isInvoiceItemArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Items are required" });
      }

      const invoice = await InvoiceService.addChargesToAppointment(
        appointmentId,
        items,
        currency,
      );

      return res.status(200).json(invoice);
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
      return res.status(200).json(invoices);
    } catch (err) {
      logger.error("Error fetching appointment invoices", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
