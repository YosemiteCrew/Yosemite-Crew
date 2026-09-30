export type BillingReviewStatus = 'MISSING_INVOICE' | 'DRAFT_INVOICE' | 'UNBILLED_CHARGES';

export type BillingReviewItem = {
  id: string;
  appointmentDate: string;
  patientName: string | null;
  clientName: string | null;
  appointmentType: string | null;
  invoiceId: string | null;
  invoiceStatus: string | null;
  invoiceTotal: number | null;
  currency: string | null;
  billingStatus: BillingReviewStatus;
};

export type BillingReviewPage = {
  items: BillingReviewItem[];
  nextCursor: string | null;
  hasMore: boolean;
};
