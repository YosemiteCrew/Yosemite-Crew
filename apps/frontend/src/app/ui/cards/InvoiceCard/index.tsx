import React, { useMemo } from "react";
import {
  getInvoiceItemNames,
  getStatusStyle,
} from "@/app/ui/tables/InvoiceTable";
import { Invoice } from "@yosemite-crew/types";
import { formatDateLabel } from "@/app/lib/forms";
import { Secondary } from "@/app/ui/primitives/Buttons";
import { toTitle } from "@/app/lib/validators";
import { useAppointmentsForPrimaryOrg } from "@/app/hooks/useAppointments";
import { useCurrencyForPrimaryOrg } from "@/app/hooks/useBilling";
import { formatMoney } from "@/app/lib/money";
import {
  getCompanionNameFromAppointments,
  getParentNameFromAppointments,
} from "@/app/lib/invoice";

type InvoiceCardProps = {
  invoice: Invoice;
  handleViewInvoice: any;
};

const InvoiceCard = ({ invoice, handleViewInvoice }: InvoiceCardProps) => {
  const appointments = useAppointmentsForPrimaryOrg();
  const currency = useCurrencyForPrimaryOrg();

  const companionName = useMemo(
    () => getCompanionNameFromAppointments(appointments, invoice.appointmentId),
    [appointments, invoice.appointmentId]
  );

  const parentName = useMemo(
    () => getParentNameFromAppointments(appointments, invoice.appointmentId),
    [appointments, invoice.appointmentId]
  );

  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-hover bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">
          {companionName}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Parent:</div>
        <div className="text-caption-1 text-text-primary">
          {parentName}
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
          {formatMoney(invoice.subtotal, currency)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Discount:</div>
        <div className="text-caption-1 text-text-primary">
          {formatMoney(invoice.discountTotal ?? 0, currency)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Tax:</div>
        <div className="text-caption-1 text-text-primary">
          {formatMoney(invoice.taxTotal ?? 0, currency)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Total:</div>
        <div className="text-caption-1 text-text-primary">
          {formatMoney(invoice.totalAmount, currency)}
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
