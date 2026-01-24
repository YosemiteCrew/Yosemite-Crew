import React from "react";
import {
  getInvoiceItemNames,
  getStatusStyle,
} from "../../DataTable/InvoiceTable";
import { Invoice } from "@yosemite-crew/types";
import { formatDateLabel } from "@/app/utils/forms";
import { Secondary } from "../../Buttons";
import { toTitle } from "@/app/utils/validators";
import { useAppointmentsForPrimaryOrg } from "@/app/hooks/useAppointments";

type InvoiceCardProps = {
  invoice: Invoice;
  handleViewInvoice: any;
};

const InvoiceCard = ({ invoice, handleViewInvoice }: InvoiceCardProps) => {
  const appointments = useAppointmentsForPrimaryOrg();

  const getCompanionName = (appointmentId: string | undefined) => {
    const match = appointments.filter((a) => a.id === appointmentId);
    if (match.length > 0) {
      return match[0].companion.name;
    }
    return "-";
  };

  const getParentName = (appointmentId: string | undefined) => {
    const match = appointments.filter((a) => a.id === appointmentId);
    if (match.length > 0) {
      return match[0].companion.parent.name;
    }
    return "-";
  };

  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-hover bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">
          {getCompanionName(invoice.appointmentId)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Parent:</div>
        <div className="text-caption-1 text-text-primary">
          {getParentName(invoice.appointmentId)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Service:</div>
        <div className="text-caption-1 text-text-primary">
          {getInvoiceItemNames(invoice.items)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Date:</div>
        <div className="text-caption-1 text-text-primary">
          {formatDateLabel(invoice.createdAt)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Sub-total:</div>
        <div className="text-caption-1 text-text-primary">
          {"$ " + invoice?.subtotal}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Discount:</div>
        <div className="text-caption-1 text-text-primary">
          {"$ " + invoice?.discountTotal}
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
          {"$ " + invoice?.totalAmount}
        </div>
      </div>
      <div
        style={getStatusStyle(invoice.status)}
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
      >
        {toTitle(invoice?.status)}
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
