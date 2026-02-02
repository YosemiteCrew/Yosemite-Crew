import { InvoiceStatus } from "@yosemite-crew/types";
import { StatusOption, status } from "@/app/features/companions/pages/Companions/types";

export const InvoiceStatusOptions: InvoiceStatus[] = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];

export const InvoiceStatusFilters: StatusOption[] = [
  status("All", "all", "#F1D4B0", "#000"),
  status("Pending", "pending", "#747283"),
  status("Awaiting payment", "awaiting_payment", "#A8A181"),
  status("Paid", "paid", "#D28F9A"),
  status("Failed", "failed", "#5C614B"),
  status("Cancelled", "cancelled", "#D9A488"),
  status("Refunded", "refunded", "#BF9FAA"),
];
