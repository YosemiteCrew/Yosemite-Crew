export type ClientPaymentTerms = {
  netDays: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type OverdueClientInvoice = {
  invoiceId: string;
  parentId: string;
  dueAt: string;
  currency: string;
  balance: number;
  reviewedAt: string | null;
  reviewedBy: string | null;
};
