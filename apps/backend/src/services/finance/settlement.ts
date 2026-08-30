import type { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";

// The subset of the client this needs, so a caller inside an interactive
// transaction can hand in its `tx` and have this write commit or roll back with
// the rest of the settlement rather than on a separate connection.
type TreatmentItemWriter = {
  workspaceTreatmentItem: {
    updateMany: (typeof prisma)["workspaceTreatmentItem"]["updateMany"];
  };
};

// Stamp the workspace treatment items billed on an invoice as settled so the
// visit workspace stops offering them for further billing.
export const markInvoiceTreatmentItemsSettled = async (
  invoice: { appointmentId: string | null; items: Prisma.JsonValue },
  settledInvoiceId: string,
  settledAt: Date,
  client: TreatmentItemWriter = prisma,
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
    await client.workspaceTreatmentItem.updateMany({
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
