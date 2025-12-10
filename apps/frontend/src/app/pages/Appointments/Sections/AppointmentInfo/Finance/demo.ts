import { Payment } from "./Details";

export const DemoPayments: Payment[] = [
  {
    appointmentId: "APT-001",
    paymentId: "PAY-1001",
    mode: "Credit Card",
    date: "2025-02-10",
    time: "14:30",
    status: "Completed",
    amount: "120.00"
  },
  {
    appointmentId: "APT-002",
    paymentId: "PAY-1002",
    mode: "UPI",
    date: "2025-02-11",
    time: "10:15",
    status: "Pending",
    amount: "75.50"
  }]