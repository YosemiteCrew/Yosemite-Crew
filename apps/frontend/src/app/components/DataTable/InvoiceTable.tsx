import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import { IoEye } from "react-icons/io5";
import InvoiceCard from "../Cards/InvoiceCard";
import { Invoice } from "@yosemite-crew/types";
import { formatDateLabel, formatTimeLabel } from "@/app/utils/forms";

import "./DataTable.css";
import { toTitleCase } from "@/app/utils/validators";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InvoiceTableProps = {
  filteredList: Invoice[];
  setActiveInvoice?: (inventory: Invoice) => void;
  setViewInvoice?: (open: boolean) => void;
};

export const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return { color: "#fff", backgroundColor: "#747283" };
    case "awaiting_payment":
      return { color: "#fff", backgroundColor: "#A8A181" };
    case "paid":
      return { color: "#fff", backgroundColor: "#D28F9A" };
    case "failed":
      return { color: "#fff", backgroundColor: "#5C614B" };
    case "cancelled":
      return { color: "#fff", backgroundColor: "#D9A488" };
    case "refunded":
      return { color: "#fff", backgroundColor: "#BF9FAA" };
    default:
      return { color: "#000", backgroundColor: "#F1D4B0" };
  }
};

const InvoiceTable = ({
  filteredList,
  setActiveInvoice,
  setViewInvoice,
}: InvoiceTableProps) => {
  const handleViewInvoice = (inventory: Invoice) => {
    setActiveInvoice?.(inventory);
    setViewInvoice?.(true);
  };

  const columns: Column<Invoice>[] = [
    {
      label: "Companion",
      key: "companion",
      width: "10%",
      render: (item: Invoice) => (
        <div className="appointment-profile-title truncate">
          {item?.companionId || "-"}
        </div>
      ),
    },
    {
      label: "Appointment ID",
      key: "appointment-id",
      width: "10%",
      render: (item: Invoice) => (
        <div className="appointment-profile-title truncate">
          {item?.appointmentId || "-"}
        </div>
      ),
    },
    {
      label: "Service",
      key: "service",
      width: "10%",
      render: (item: Invoice) => (
        <div className="appointment-profile-title">
          {item?.companionId || "-"}
        </div>
      ),
    },
    {
      label: "Date/Time",
      key: "date/time",
      width: "10%",
      render: (item: Invoice) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">
            {formatDateLabel(item.createdAt)}
          </div>
          <div className="appointment-profile-sub">
            {formatTimeLabel(item.createdAt)}
          </div>
        </div>
      ),
    },
    {
      label: "Sub-total",
      key: "sub-total",
      width: "7.5%",
      render: (item: Invoice) => (
        <div className="appointment-profile-title">{"$ " + item?.subtotal}</div>
      ),
    },
    {
      label: "Tax",
      key: "tax",
      width: "7.5%",
      render: (item: Invoice) => (
        <div className="appointment-profile-title">{"$ " + item?.taxTotal}</div>
      ),
    },
    {
      label: "Total",
      key: "total",
      width: "7.5%",
      render: (item: Invoice) => (
        <div className="appointment-profile-title">
          {"$ " + item?.totalAmount}
        </div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: Invoice) => (
        <div
          className="appointment-status"
          style={getStatusStyle(item?.status)}
        >
          {toTitleCase(item?.status)}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "5%",
      render: (item: Invoice) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewInvoice(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="#302F2E" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="hidden xl:flex">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={5}
        />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((item, i) => (
            <InvoiceCard
              key={item.id || "invoice-key" + i}
              invoice={item}
              handleViewInvoice={handleViewInvoice}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default InvoiceTable;
