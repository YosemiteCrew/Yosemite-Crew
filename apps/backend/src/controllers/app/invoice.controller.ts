import { Request, Response } from "express";
import { InvoiceService } from "src/services/invoice.service";
import logger from "src/utils/logger";

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
};
