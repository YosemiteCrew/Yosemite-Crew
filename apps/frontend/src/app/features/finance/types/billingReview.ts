export type BillingReviewStatus = 'MISSING_INVOICE' | 'DRAFT_INVOICE' | 'READY_FOR_BILLING';

export type BillingReviewItem = {
  id: string;
  appointmentDate: string;
  patientName: string | null;
  clientName: string | null;
  appointmentType: string | null;
  invoiceId: string | null;
  invoiceStatus: string | null;
  billingStatus: BillingReviewStatus;
};

export type BillingReviewPage = {
  items: BillingReviewItem[];
  nextCursor: string | null;
  hasMore: boolean;
};
