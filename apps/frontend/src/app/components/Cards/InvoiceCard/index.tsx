import React from "react";
import { getStatusStyle } from "../../DataTable/InvoiceTable";
import { Invoice } from "@yosemite-crew/types";
import { formatDateLabel, formatTimeLabel } from "@/app/utils/forms";
import { Secondary } from "../../Buttons";
import { toTitleCase } from "@/app/utils/validators";

type InvoiceCardProps = {
  invoice: Invoice;
  handleViewInvoice: any;
};

const InvoiceCard = ({ invoice, handleViewInvoice }: InvoiceCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-hover bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">
          {invoice?.companionId || "-"}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Appointment ID:</div>
        <div className="text-caption-1 text-text-primary">
          {invoice?.id || "-"}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Service:</div>
        <div className="text-caption-1 text-text-primary">
          {invoice?.id || "-"}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Date / Time:</div>
        <div className="text-caption-1 text-text-primary">
          {formatDateLabel(invoice.createdAt) +
            " / " +
            formatTimeLabel(invoice.createdAt)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Sub-total:</div>
        <div className="text-caption-1 text-text-primary">
          {"$ " + invoice?.subtotal}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Tax:</div>
        <div className="text-caption-1 text-text-primary">
          {"$ " + invoice?.taxTotal}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Total:</div>
        <div className="text-caption-1 text-text-primary">
          {invoice?.totalAmount}
        </div>
      </div>
      <div
        style={getStatusStyle(invoice.status)}
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
      >
        {toTitleCase(invoice?.status)}
      </div>
      <div className="flex gap-3 w-full">
        <Secondary
          href="#"
          onClick={() => handleViewInvoice(invoice)}
          text="View"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default InvoiceCard;
