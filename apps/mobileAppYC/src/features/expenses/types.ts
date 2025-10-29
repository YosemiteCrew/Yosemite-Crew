import type {DocumentFile} from '@/features/documents/types';

export type ExpenseSource = 'inApp' | 'external';

export type ExpensePaymentStatus = 'paid' | 'unpaid';

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
  source: ExpenseSource;
  date: string;
  createdAt: string;
  updatedAt: string;
  attachments: ExpenseAttachment[];
  providerName?: string;
}

export interface ExpenseSummary {
  total: number;
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
