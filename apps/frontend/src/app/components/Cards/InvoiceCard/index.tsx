import Image from "next/image";
import React from "react";
import { InvoiceProps } from "@/app/types/invoice";
import { getStatusStyle } from "../../DataTable/InvoiceTable";

type InvoiceCardProps = {
  invoice: InvoiceProps;
  handleViewInvoice: any;
};

const InvoiceCard = ({ invoice, handleViewInvoice }: InvoiceCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-2 items-center">
        <Image
          alt={invoice.metadata.pet}
          src={invoice.metadata.petImage}
          height={40}
          width={40}
          style={{ borderRadius: "50%" }}
          className="h-10 w-10 rounded-full"
        />
        <div className="flex flex-col gap-0">
          <div className="text-[13px] font-satoshi font-bold text-black-text">
            {invoice.metadata.pet}
          </div>
          <div className="text-[13px] font-satoshi font-bold text-grey-noti">
            {invoice.metadata.parent}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Appointment ID:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {invoice.metadata.appointmentId}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Service:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {invoice.metadata.service}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Date / Time:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {invoice.date + " / " + invoice.time}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Sub-total:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {"$ " + invoice.subtotal}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Tax:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {"$ " + invoice.tax}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Total:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {invoice.total}
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
