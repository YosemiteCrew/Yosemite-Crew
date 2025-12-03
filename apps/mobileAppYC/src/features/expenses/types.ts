import type {DocumentFile} from '@/features/documents/types';

export type ExpenseSource = 'inApp' | 'external';

export type ExpensePaymentStatus =
  | 'PAID'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_FAILED'
  | 'NO_PAYMENT'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'UNPAID';

export interface ExpenseAttachment extends DocumentFile {
  /**
   * Optional description to show in preview screens.
   */
  description?: string;
}

export interface Expense {
  id: string;
  companionId: string;
  title: string;
  category: string;
  subcategory: string;
  visitType: string;
  amount: number;
  currencyCode: string;
  status: ExpensePaymentStatus;
  rawStatus?: string | null;
  source: ExpenseSource;
  date: string;
  createdAt: string;
  updatedAt: string;
  attachments: ExpenseAttachment[];
  providerName?: string;
  businessName?: string;
  description?: string;
  invoiceId?: string | null;
  note?: string | null;
  parentId?: string | null;
}

export interface ExpenseSummary {
  total: number;
  invoiceTotal?: number;
  externalTotal?: number;
  currencyCode: string;
  lastUpdated: string;
}

export interface ExpensesState {
  items: Expense[];
  loading: boolean;
  error: string | null;
  summaries: Record<string, ExpenseSummary>;
  hydratedCompanions: Record<string, boolean>;
}
