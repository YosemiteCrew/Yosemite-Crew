import { InvoiceStatus } from "@yosemite-crew/types";

export type InvoicesStatus =
  | "open"
  | "draft"
  | "void"
  | "uncollectible"
  | "deleted"
  | "paid";

export const InvoicesStatus: InvoicesStatus[] = [
  "open",
  "draft",
  "void",
  "uncollectible",
  "deleted",
  "paid",
];

export type InvoiceMetadata = {
  pet: string;
  parent: string;
  petImage: string;
  service: string;
  appointmentId: string;
};

export type InvoiceProps = {
  status: InvoicesStatus;
  metadata: InvoiceMetadata;
  subtotal: string;
  tax: string;
  total: string;
  date: string;
  time: string;
};

export const InvoiceStatusOptions: InvoiceStatus[]  = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];
