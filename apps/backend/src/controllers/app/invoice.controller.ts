import { Request, Response } from "express";
import { InvoiceService } from "src/services/invoice.service";
import logger from "src/utils/logger";

export const InvoiceController = {
  async listInvoicesForAppointment(req: Request, res: Response) {
    try {
      const appointmentId = req.params.appointmentId;
      const invoices = await InvoiceService.getByAppointmentId(appointmentId);
      return res.status(200).json(invoices);
    } catch (err) {
      logger.error("Error fetching appointment invoices", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
