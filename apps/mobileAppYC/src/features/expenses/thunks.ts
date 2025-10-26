import {createAsyncThunk} from '@reduxjs/toolkit';
import {generateId} from '@/utils/helpers';
import type {RootState} from '@/app/store';
import type {
  Expense,
  ExpenseSummary,
  ExpenseAttachment,
  ExpensePaymentStatus,
} from './types';

const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const resolveCurrencyCode = (state: RootState): string => {
  const code = state.auth.user?.currency;
  return code && code.length > 0 ? code : 'USD';
};

const formatDate = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  return date.toISOString();
};

const buildMockAttachments = (): ExpenseAttachment[] => [
  {
    id: `attachment_${generateId()}`,
    name: 'invoice.pdf',
    type: 'application/pdf',
    size: 150_000,
    uri: 'https://yes-s3-public-assets.s3.amazonaws.com/mock/medical-billing-invoice.pdf',
    s3Url: 'https://yes-s3-public-assets.s3.amazonaws.com/mock/medical-billing-invoice.pdf',
  },
];

const createMockExpensesForCompanion = (
  companionId: string,
  currencyCode: string,
): Expense[] => {
  const baseAmount = Math.round(
  (Array.from(companionId).reduce((acc, char) => acc + (char.codePointAt(0) ?? 0), 0) %
      250) +
      120,
  );

  const vaccinationExpense: Expense = {
    id: `expense_${companionId}_vaccination`,
    companionId,
    title: 'Vaccination',
    category: 'health',
    subcategory: 'vaccination-parasite',
    visitType: 'Hospital',
    amount: baseAmount,
    currencyCode,
    status: 'unpaid',
    source: 'inApp',
    date: formatDate(14),
    createdAt: formatDate(14),
    updatedAt: formatDate(14),
    attachments: buildMockAttachments(),
    providerName: 'Concordia Hill Hospital',
  };

  const groomingExpense: Expense = {
    id: `expense_${companionId}_grooming`,
    companionId,
    title: 'Grooming Session',
    category: 'hygiene-maintenance',
    subcategory: 'grooming-visits',
    visitType: 'Groomer',
    amount: baseAmount - 25,
    currencyCode,
    status: 'paid',
    source: 'inApp',
    date: formatDate(38),
    createdAt: formatDate(38),
    updatedAt: formatDate(38),
    attachments: buildMockAttachments(),
    providerName: 'Happy Paws Grooming',
  };

  const wellnessExpense: Expense = {
    id: `expense_${companionId}_wellness`,
    companionId,
    title: 'Wellness Check-up',
    category: 'health',
    subcategory: 'hospital-visits',
    visitType: 'Hospital',
    amount: baseAmount + 32,
    currencyCode,
    status: 'unpaid',
    source: 'inApp',
    date: formatDate(7),
    createdAt: formatDate(7),
    updatedAt: formatDate(7),
    attachments: buildMockAttachments(),
    providerName: 'Skyline Veterinary Clinic',
  };

  const therapyExpense: Expense = {
    id: `expense_${companionId}_therapy`,
    companionId,
    title: 'Hydrotherapy Session',
    category: 'hygiene-maintenance',
    subcategory: 'grooming-visits',
    visitType: 'Groomer',
    amount: baseAmount - 15,
    currencyCode,
    status: 'paid',
    source: 'inApp',
    date: formatDate(20),
    createdAt: formatDate(20),
    updatedAt: formatDate(20),
    attachments: buildMockAttachments(),
    providerName: 'Aqua Paws Rehab',
  };

  const boardingExpense: Expense = {
    id: `expense_${companionId}_boarding`,
    companionId,
    title: 'Boarding for 3 Days',
    category: 'hygiene-maintenance',
    subcategory: 'boarding-records',
    visitType: 'Boarder',
    amount: baseAmount + 42,
    currencyCode,
    status: 'paid',
    source: 'external',
    date: formatDate(62),
    createdAt: formatDate(62),
    updatedAt: formatDate(62),
    attachments: buildMockAttachments(),
    providerName: 'Cozy Pets Boarding',
  };

  const trainingExpense: Expense = {
    id: `expense_${companionId}_training`,
    companionId,
    title: 'Training Refresh Session',
    category: 'hygiene-maintenance',
    subcategory: 'training-behaviour',
    visitType: 'Other',
    amount: baseAmount - 10,
    currencyCode,
    status: 'paid',
    source: 'external',
    date: formatDate(90),
    createdAt: formatDate(90),
    updatedAt: formatDate(90),
    attachments: buildMockAttachments(),
    providerName: 'Peak Performance Trainers',
  };

  return [
    vaccinationExpense,
    groomingExpense,
    wellnessExpense,
    therapyExpense,
    boardingExpense,
    trainingExpense,
  ];
};

const calculateSummary = (expenses: Expense[], currencyCode: string): ExpenseSummary => ({
  total: expenses.reduce((acc, expense) => acc + expense.amount, 0),
  currencyCode,
  lastUpdated: new Date().toISOString(),
});

export const fetchExpensesForCompanion = createAsyncThunk<
  {companionId: string; expenses: Expense[]; summary: ExpenseSummary},
  {companionId: string},
  {rejectValue: string; state: RootState}
>('expenses/fetchForCompanion', async ({companionId}, {getState, rejectWithValue}) => {
  try {
    const state = getState();
    const currencyCode = resolveCurrencyCode(state);

    await mockDelay(600);

    const generated = createMockExpensesForCompanion(companionId, currencyCode);
    const summary = calculateSummary(generated, currencyCode);

    return {
      companionId,
      expenses: generated,
      summary,
    };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch expenses',
    );
  }
});

export interface AddExternalExpensePayload {
  companionId: string;
  title: string;
  category: string;
  subcategory: string;
  visitType: string;
  amount: number;
  date: string;
  attachments: ExpenseAttachment[];
  providerName?: string;
}

export const addExternalExpense = createAsyncThunk<
  Expense,
  AddExternalExpensePayload,
  {rejectValue: string; state: RootState}
>('expenses/addExternalExpense', async (payload, {getState, rejectWithValue}) => {
  try {
    const state = getState();
    const currencyCode = resolveCurrencyCode(state);

    await mockDelay(500);

    const now = new Date().toISOString();

    return {
      id: `expense_${Date.now()}_${generateId()}`,
      companionId: payload.companionId,
      title: payload.title,
      category: payload.category,
      subcategory: payload.subcategory,
      visitType: payload.visitType,
      amount: payload.amount,
      currencyCode,
      status: 'paid',
      source: 'external',
      date: payload.date,
      createdAt: now,
      updatedAt: now,
      attachments: payload.attachments,
      providerName: payload.providerName,
    };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to add expense',
    );
  }
});

export interface UpdateExternalExpensePayload {
  expenseId: string;
  updates: Partial<
    Pick<
      AddExternalExpensePayload,
      | 'title'
      | 'category'
      | 'subcategory'
      | 'visitType'
      | 'amount'
      | 'date'
      | 'attachments'
      | 'providerName'
    >
  >;
}

export const updateExternalExpense = createAsyncThunk<
  {expenseId: string; updates: UpdateExternalExpensePayload['updates']},
  UpdateExternalExpensePayload,
  {rejectValue: string}
>('expenses/updateExternalExpense', async ({expenseId, updates}, {rejectWithValue}) => {
  try {
    await mockDelay(400);

    return {
      expenseId,
      updates: {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to update expense',
    );
  }
});

export const deleteExternalExpense = createAsyncThunk<
  {expenseId: string; companionId: string},
  {expenseId: string; companionId: string},
  {rejectValue: string}
>('expenses/deleteExternalExpense', async ({expenseId, companionId}, {rejectWithValue}) => {
  try {
    await mockDelay(300);
    return {expenseId, companionId};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to delete expense',
    );
  }
});

export const markInAppExpenseStatus = createAsyncThunk<
  {expenseId: string; status: ExpensePaymentStatus},
  {expenseId: string; status: ExpensePaymentStatus},
  {rejectValue: string}
>('expenses/markInAppExpenseStatus', async ({expenseId, status}, {rejectWithValue}) => {
  try {
    await mockDelay(350);
    return {expenseId, status};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to update payment status',
    );
  }
});
