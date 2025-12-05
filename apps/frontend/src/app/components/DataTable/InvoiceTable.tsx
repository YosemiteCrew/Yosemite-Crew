import { InvoiceProps } from "@/app/types/invoice";
import React from "react";

import "./DataTable.css";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import { IoEye } from "react-icons/io5";
import InvoiceCard from "../Cards/InvoiceCard";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InvoiceTableProps = {
  filteredList: InvoiceProps[];
  setActiveInvoice: (inventory: InvoiceProps) => void;
  setViewInvoice: (open: boolean) => void;
};

export const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "draft":
      return { color: "#F68523", backgroundColor: "#FEF3E9" };
    case "open":
      return { color: "#247AED", backgroundColor: "#EAF3FF" };
    case "paid":
      return { color: "#54B492", backgroundColor: "#E6F4EF" };
    case "uncollectible":
      return { color: "#EA3729", backgroundColor: "#FDEBEA" };
    case "deleted":
      return { color: "#EA3729", backgroundColor: "#FDEBEA" };
    case "void":
      return { color: "#302F2E", backgroundColor: "#EAEAEA" };
    case "all":
      return { color: "#302F2E", backgroundColor: "#fff" };
    default:
      return { color: "#fff", backgroundColor: "#247AED" };
  }
};

const InvoiceTable = ({
  filteredList,
  setActiveInvoice,
  setViewInvoice,
}: InvoiceTableProps) => {
  const handleViewInvoice = (inventory: InvoiceProps) => {
    setActiveInvoice(inventory);
    setViewInvoice(true);
  };

  const columns: Column<InvoiceProps>[] = [
    {
      label: "Companion",
      key: "companion",
      width: "10%",
      render: (item: InvoiceProps) => (
        <div className="appointment-profile">
          <Image
            src={item.metadata.petImage}
            alt=""
            height={40}
            width={40}
            style={{ borderRadius: "50%" }}
          />
          <div className="appointment-profile-two">
            <div className="appointment-profile-title">{item.metadata.pet}</div>
            <div className="appointment-profile-sub">
              {item.metadata.parent.split(" ")[0]}
            </div>
          </div>
        </div>
      ),
    },
    {
      label: "Appointment ID",
      key: "appointment-id",
      width: "10%",
      render: (item: InvoiceProps) => (
        <div className="appointment-profile-title truncate">
          {item.metadata.appointmentId}
        </div>
      ),
    },
    {
      label: "Service",
      key: "service",
      width: "10%",
      render: (item: InvoiceProps) => (
        <div className="appointment-profile-title">{item.metadata.service}</div>
      ),
    },
    {
      label: "Date/Time",
      key: "date/time",
      width: "10%",
      render: (item: InvoiceProps) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{item.date}</div>
          <div className="appointment-profile-sub">{item.time}</div>
        </div>
      ),
    },
    {
      label: "Sub-total",
      key: "sub-total",
      width: "7.5%",
      render: (item: InvoiceProps) => (
        <div className="appointment-profile-title">{"$ " + item.subtotal}</div>
      ),
    },
    {
      label: "Tax",
      key: "tax",
      width: "7.5%",
      render: (item: InvoiceProps) => (
        <div className="appointment-profile-title">{"$ " + item.tax}</div>
      ),
    },
    {
      label: "Total",
      key: "total",
      width: "7.5%",
      render: (item: InvoiceProps) => (
        <div className="appointment-profile-title">{"$ " + item.total}</div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: InvoiceProps) => (
        <div className="appointment-status" style={getStatusStyle(item.status)}>
          {item.status}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "5%",
      render: (item: InvoiceProps) => (
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
        <GenericTable data={filteredList} columns={columns} bordered={false} />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {filteredList.map((item, i) => (
          <InvoiceCard
            key={item.metadata.appointmentId + i}
            invoice={item}
            handleViewInvoice={handleViewInvoice}
          />
        ))}
      </div>
    </div>
  );
};

export default InvoiceTable;
