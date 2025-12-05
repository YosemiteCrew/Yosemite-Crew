import {createAsyncThunk} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import expenseApi, {type ExpenseInputPayload} from './services/expenseService';
import type {
  Expense,
  ExpenseAttachment,
  ExpensePaymentStatus,
  ExpenseSummary,
} from './types';
import type {Invoice, PaymentIntentInfo} from '@/features/appointments/types';

const ensureAccessToken = async (): Promise<string> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return accessToken;
};

const resolveCurrencyCode = (state: RootState): string =>
  state.auth.user?.currency && state.auth.user.currency.length > 0
    ? state.auth.user.currency
    : 'USD';

const resolveParentId = (state: RootState): string =>
  (state.auth.user as any)?.parentId ?? state.auth.user?.id ?? '';

export const fetchExpensesForCompanion = createAsyncThunk<
  {companionId: string; expenses: Expense[]; summary: ExpenseSummary},
  {companionId: string},
  {rejectValue: string; state: RootState}
>('expenses/fetchForCompanion', async ({companionId}, {getState, rejectWithValue}) => {
  try {
    if (!companionId) {
      throw new Error('Please select a companion to view expenses.');
    }
    const accessToken = await ensureAccessToken();
    const state = getState();
    const currencyCode = resolveCurrencyCode(state);

    const [expenses, summary] = await Promise.all([
      expenseApi.fetchExpenses({companionId, accessToken}),
      expenseApi.fetchSummary({companionId, accessToken, currencyCode}),
    ]);

    return {companionId, expenses, summary};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch expenses',
    );
  }
});

export const fetchExpenseSummary = createAsyncThunk<
  {companionId: string; summary: ExpenseSummary},
  {companionId: string},
  {rejectValue: string; state: RootState}
>('expenses/fetchSummary', async ({companionId}, {getState, rejectWithValue}) => {
  try {
    if (!companionId) {
      throw new Error('Please select a companion to view expenses.');
    }
    const accessToken = await ensureAccessToken();
    const state = getState();
    const currencyCode = resolveCurrencyCode(state);
    const summary = await expenseApi.fetchSummary({companionId, accessToken, currencyCode});
    return {companionId, summary};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch expense summary',
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
  note?: string;
}

const buildExpenseInput = (
  state: RootState,
  payload: AddExternalExpensePayload,
): ExpenseInputPayload => ({
  companionId: payload.companionId,
  parentId: resolveParentId(state),
  category: payload.category,
  subcategory: payload.subcategory,
  visitType: payload.visitType,
  expenseName: payload.title,
  businessName: payload.providerName ?? '',
  date: payload.date,
  amount: payload.amount,
  currency: resolveCurrencyCode(state),
  attachments: payload.attachments,
  note: payload.note ?? '',
});

export const addExternalExpense = createAsyncThunk<
  Expense,
  AddExternalExpensePayload,
  {rejectValue: string; state: RootState}
>('expenses/addExternalExpense', async (payload, {getState, rejectWithValue}) => {
  try {
    const state = getState();
    const accessToken = await ensureAccessToken();
    const input = buildExpenseInput(state, payload);
    return await expenseApi.createExternal({input, accessToken});
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
      | 'note'
    >
  >;
}

export const updateExternalExpense = createAsyncThunk<
  Expense,
  UpdateExternalExpensePayload,
  {rejectValue: string; state: RootState}
>('expenses/updateExternalExpense', async ({expenseId, updates}, {rejectWithValue, getState}) => {
  try {
    const state = getState();
    const existing = state.expenses.items.find(item => item.id === expenseId);
    if (!existing) {
      throw new Error('Expense not found.');
    }
    if (existing.source !== 'external') {
      throw new Error('Only external expenses can be edited.');
    }

    const accessToken = await ensureAccessToken();
    const input: ExpenseInputPayload = {
      companionId: existing.companionId,
      parentId: resolveParentId(state),
      category: updates.category ?? existing.category,
      subcategory: updates.subcategory ?? existing.subcategory,
      visitType: updates.visitType ?? existing.visitType,
      expenseName: updates.title ?? existing.title,
      businessName:
        updates.providerName ??
        existing.providerName ??
        existing.businessName ??
        '',
      date: updates.date ?? existing.date,
      amount: updates.amount ?? existing.amount,
      currency: resolveCurrencyCode(state),
      attachments: updates.attachments ?? existing.attachments,
      note: updates.note ?? existing.note ?? existing.description ?? '',
    };

    return await expenseApi.updateExternal({expenseId, input, accessToken});
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
    const accessToken = await ensureAccessToken();
    await expenseApi.deleteExpense({expenseId, accessToken});
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
    // Backend status updates are handled via payment flows; this thunk keeps local UI responsive.
    return {expenseId, status};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to update payment status',
    );
  }
});

export const fetchExpenseInvoice = createAsyncThunk<
  {invoice: Invoice | null; paymentIntent: PaymentIntentInfo | null; paymentIntentId: string | null; organistion?: any; organisation?: any},
  {invoiceId: string},
  {rejectValue: string}
>('expenses/fetchInvoice', async ({invoiceId}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    return await expenseApi.fetchInvoice({invoiceId, accessToken});
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch invoice',
    );
  }
});

export const fetchExpensePaymentIntent = createAsyncThunk<
  PaymentIntentInfo,
  {paymentIntentId: string},
  {rejectValue: string}
>('expenses/fetchPaymentIntent', async ({paymentIntentId}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    return await expenseApi.fetchPaymentIntent({paymentIntentId, accessToken});
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch payment intent',
    );
  }
});

export const fetchExpensePaymentIntentByInvoice = createAsyncThunk<
  PaymentIntentInfo,
  {invoiceId: string},
  {rejectValue: string}
>('expenses/fetchPaymentIntentByInvoice', async ({invoiceId}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    return await expenseApi.fetchPaymentIntentByInvoice({invoiceId, accessToken});
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch payment intent',
    );
  }
});

export const fetchExpenseById = createAsyncThunk<
  Expense,
  {expenseId: string},
  {rejectValue: string}
>('expenses/fetchExpenseById', async ({expenseId}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    return await expenseApi.fetchExpenseById({expenseId, accessToken});
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to load expense details',
    );
  }
});
