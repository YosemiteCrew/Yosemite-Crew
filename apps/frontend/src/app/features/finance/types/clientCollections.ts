export type ClientPaymentTerms = {
  netDays: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type OverdueClientInvoice = {
  invoiceId: string;
  parentId: string;
  dueAt: string;
  /** The due date as the practice's calendar date, `YYYY-MM-DD`. */
  dueDate: string;
  currency: string;
  balance: number;
  /** The client's current payment terms, in days after finalization. */
  netDays: number;
  reviewedAt: string | null;
  reviewedBy: string | null;
};
