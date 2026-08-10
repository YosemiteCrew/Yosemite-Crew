import type { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";

// Stamp the workspace treatment items billed on an invoice as settled so the
// visit workspace stops offering them for further billing.
export const markInvoiceTreatmentItemsSettled = async (
  invoice: { appointmentId: string | null; items: Prisma.JsonValue },
  settledInvoiceId: string,
  settledAt: Date,
) => {
  const invoiceRowIds = (Array.isArray(invoice.items) ? invoice.items : [])
    .map((item) =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      typeof item.id === "string"
        ? item.id
        : null,
    )
    .filter((id): id is string => Boolean(id));
  if (invoiceRowIds.length > 0) {
    await prisma.workspaceTreatmentItem.updateMany({
      where: {
        appointmentId: invoice.appointmentId,
        invoiceRowId: { in: invoiceRowIds },
      },
      data: {
        settledInvoiceId,
        settledAt,
      },
    });
  }
};
