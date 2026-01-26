import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import { IoEye } from "react-icons/io5";
import InvoiceCard from "../Cards/InvoiceCard";
import { Invoice, InvoiceItem } from "@yosemite-crew/types";
import { formatDateLabel } from "@/app/utils/forms";
import { toTitle } from "@/app/utils/validators";

import "./DataTable.css";
import { useAppointmentsForPrimaryOrg } from "@/app/hooks/useAppointments";

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

export const getInvoiceItemNames = (items: InvoiceItem[]): string => {
  return items
    .map((item) => item.name?.trim())
    .filter(Boolean)
    .join(", ");
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
  const appointments = useAppointmentsForPrimaryOrg();

  const handleViewInvoice = (inventory: Invoice) => {
    setActiveInvoice?.(inventory);
    setViewInvoice?.(true);
  };

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

  const columns: Column<Invoice>[] = [
    {
      label: "Appointment Info",
      key: "appointment-id",
      width: "10%",
      render: (item: Invoice) => (
        <div className="appointment-profile truncate">
          <div className="appointment-profile-two">
            <div className="appointment-profile-title">
              {getCompanionName(item.appointmentId)}
            </div>
            <div className="appointment-profile-sub truncate">
              {getParentName(item.appointmentId)}
            </div>
          </div>
        </div>
      ),
    },
    {
      label: "Service",
      key: "service",
      width: "15%",
      render: (item: Invoice) => (
        <div className="appointment-profile-title">
          {getInvoiceItemNames(item.items)}
        </div>
      ),
    },
    {
      label: "Date",
      key: "date",
      width: "10%",
      render: (item: Invoice) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">
            {formatDateLabel(item.createdAt)}
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
      label: "Discount",
      key: "discount",
      width: "7.5%",
      render: (item: Invoice) => (
        <div className="appointment-profile-title">
          {"$ " + item?.discountTotal}
        </div>
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
          {toTitle(item?.status)}
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
          pageSize={10}
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
