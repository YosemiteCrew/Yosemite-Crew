import { InvoiceStatus } from "@yosemite-crew/types";
import { StatusOption } from "../pages/Companions/types";

export type InvoiceMetadata = {
  pet: string;
  parent: string;
  petImage: string;
  service: string;
  appointmentId: string;
};

export const InvoiceStatusOptions: InvoiceStatus[] = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];

export const InvoiceStatusFilters: StatusOption[] = [
  {
    name: "All",
    key: "all",
    bg: "#F1D4B0",
    text: "#000",
  },
  {
    name: "Pending",
    key: "pending",
    bg: "#747283",
    text: "#fff",
  },
  {
    name: "Awaiting payment",
    key: "awaiting_payment",
    bg: "#A8A181",
    text: "#fff",
  },
  {
    name: "Paid",
    key: "paid",
    bg: "#D28F9A",
    text: "#fff",
  },
  {
    name: "Failed",
    key: "failed",
    bg: "#5C614B",
    text: "#fff",
  },
  {
    name: "Cancelled",
    key: "cancelled",
    bg: "#D9A488",
    text: "#fff",
  },
  {
    name: "Refunded",
    key: "refunded",
    bg: "#BF9FAA",
    text: "#fff",
  },
];
