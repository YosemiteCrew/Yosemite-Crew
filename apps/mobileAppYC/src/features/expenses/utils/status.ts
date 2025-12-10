import type {Expense} from '@/features/expenses/types';

const normalize = (status?: string | null) => (status ?? '').toString().toUpperCase();

export const isExpensePaid = (expense: Expense): boolean =>
  normalize(expense.status) === 'PAID';

export const isExpensePaymentPending = (expense: Expense): boolean =>
  expense.source === 'inApp' &&
  !['PAID', 'REFUNDED', 'CANCELLED'].includes(normalize(expense.status));

export const canEditExpense = (expense: Expense): boolean =>
  expense.source === 'external';

export const hasInvoice = (expense: Expense): boolean =>
  Boolean(expense.invoiceId);
