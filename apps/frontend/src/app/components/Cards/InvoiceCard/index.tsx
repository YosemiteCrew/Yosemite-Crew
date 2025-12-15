import React from "react";
import { getStatusStyle } from "../../DataTable/InvoiceTable";
import { Invoice } from "@yosemite-crew/types";
import { formatDateLabel, formatTimeLabel } from "@/app/utils/forms";

type InvoiceCardProps = {
  invoice: Invoice;
  handleViewInvoice: any;
};

const InvoiceCard = ({ invoice, handleViewInvoice }: InvoiceCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-[23px] font-satoshi font-bold text-black-text">
          {invoice?.companionId || "-"}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Appointment ID:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {invoice?.id || "-"}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Service:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {invoice?.id || "-"}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Date / Time:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {formatDateLabel(invoice.createdAt) +
            " / " +
            formatTimeLabel(invoice.createdAt)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Sub-total:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {"$ " + invoice?.subtotal}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Tax:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {"$ " + invoice?.taxTotal}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Total:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {invoice?.totalAmount}
        </div>
      </div>
      <div
        style={getStatusStyle(invoice.status)}
        className="w-full rounded-lg h-9 flex items-center justify-center text-[15px] font-satoshi font-bold"
      >
        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => handleViewInvoice(invoice)}
          className="w-full border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          View
        </button>
      </div>
    </div>
  );
};

export default InvoiceCard;
