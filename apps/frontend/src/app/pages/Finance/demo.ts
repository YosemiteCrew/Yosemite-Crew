import { InvoiceProps } from "@/app/types/invoice";

export const demoInvoices: InvoiceProps[] = [
  {
    status: "open",
    metadata: {
      pet: "Bella",
      parent: "John Smith",
      petImage:
        "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
      service: "Full Grooming",
      appointmentId: "APT-1001",
    },
    subtotal: "65.00",
    tax: "5.20",
    total: "70.20",
    date: "2025-02-10",
    time: "10:00 AM",
  },
  {
    status: "draft",
    metadata: {
      pet: "Max",
      parent: "Emily Johnson",
      petImage:
        "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
      service: "Bath & Brush",
      appointmentId: "APT-1002",
    },
    subtotal: "40.00",
    tax: "3.20",
    total: "43.20",
    date: "2025-02-11",
    time: "2:30 PM",
  },
  {
    status: "paid",
    metadata: {
      pet: "Charlie",
      parent: "Michael Green",
      petImage:
        "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
      service: "Nail Trim",
      appointmentId: "APT-1003",
    },
    subtotal: "15.00",
    tax: "1.20",
    total: "16.20",
    date: "2025-01-28",
    time: "4:15 PM",
  },
  {
    status: "uncollectible",
    metadata: {
      pet: "Luna",
      parent: "Sarah Williams",
      petImage:
        "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
      service: "Flea Treatment",
      appointmentId: "APT-1004",
    },
    subtotal: "85.00",
    tax: "6.80",
    total: "91.80",
    date: "2025-02-01",
    time: "11:45 AM",
  },
  {
    status: "deleted",
    metadata: {
      pet: "Cooper",
      parent: "David Miller",
      petImage:
        "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
      service: "Teeth Cleaning",
      appointmentId: "APT-1005",
    },
    subtotal: "120.00",
    tax: "9.60",
    total: "129.60",
    date: "2025-01-15",
    time: "9:30 AM",
  },
  {
    status: "void",
    metadata: {
      pet: "Daisy",
      parent: "Laura Brown",
      petImage:
        "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
      service: "Full Grooming",
      appointmentId: "APT-1006",
    },
    subtotal: "65.00",
    tax: "5.20",
    total: "70.20",
    date: "2025-02-05",
    time: "3:00 PM",
  },
];
