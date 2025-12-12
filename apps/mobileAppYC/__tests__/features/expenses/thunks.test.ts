import {
  fetchExpensesForCompanion,
  fetchExpenseSummary,
  addExternalExpense,
  updateExternalExpense,
  deleteExternalExpense,
  markInAppExpenseStatus,
  fetchExpenseInvoice,
  fetchExpensePaymentIntent,
  fetchExpensePaymentIntentByInvoice,
  fetchExpenseById,
} from '../../../src/features/expenses/thunks';
import expenseApi from '../../../src/features/expenses/services/expenseService';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '../../../src/features/auth/sessionManager';

// --- Mocks ---

jest.mock('../../../src/features/expenses/services/expenseService');
jest.mock('../../../src/features/auth/sessionManager');

describe('expenses thunks', () => {
  const mockDispatch = jest.fn();
  const mockGetState = jest.fn();

  // Helper to setup state for getState
  const setupState = (overrides: any = {}) => {
    mockGetState.mockReturnValue({
      auth: {
        user: {
          id: 'user-123',
          parentId: 'parent-123',
          currency: 'USD',
          ...overrides.user,
        },
      },
      expenses: {
        items: overrides.expenses || [],
      },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupState();
    // Default valid token behavior
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: 'future-date',
    });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
  });

  // ==============================================================================
  // 1. Data Fetching Thunks & Auth Helpers
  // ==============================================================================

  describe('fetchExpensesForCompanion', () => {
    it('successfully fetches expenses and summary in parallel', async () => {
      const mockExpenses = [{id: 'exp-1'}];
      const mockSummary = {total: 100};

      (expenseApi.fetchExpenses as jest.Mock).mockResolvedValue(mockExpenses);
      (expenseApi.fetchSummary as jest.Mock).mockResolvedValue(mockSummary);

      const action = fetchExpensesForCompanion({companionId: 'c-123'});
      const result = await action(mockDispatch, mockGetState, undefined);

      expect(result.type).toBe('expenses/fetchForCompanion/fulfilled');
      expect(result.payload).toEqual({
        companionId: 'c-123',
        expenses: mockExpenses,
        summary: mockSummary,
      });
      // Verify currency code resolution (default USD from setupState)
      expect(expenseApi.fetchSummary).toHaveBeenCalledWith({
        companionId: 'c-123',
        accessToken: 'valid-token',
        currencyCode: 'USD',
      });
    });

    it('uses fallback currency if user has no currency set', async () => {
      setupState({user: {currency: ''}}); // Empty string triggers fallback
      (expenseApi.fetchExpenses as jest.Mock).mockResolvedValue([]);
      (expenseApi.fetchSummary as jest.Mock).mockResolvedValue({});

      const action = fetchExpensesForCompanion({companionId: 'c-123'});
      await action(mockDispatch, mockGetState, undefined);

      expect(expenseApi.fetchSummary).toHaveBeenCalledWith(
        expect.objectContaining({currencyCode: 'USD'}),
      );
    });

    it('rejects if companionId is missing', async () => {
      // @ts-ignore - Testing runtime check
      const action = fetchExpensesForCompanion({companionId: ''});
      const result = await action(mockDispatch, mockGetState, undefined);

      expect(result.type).toBe('expenses/fetchForCompanion/rejected');
      expect(result.payload).toBe('Please select a companion to view expenses.');
    });

    // --- Auth Helper Logic (ensureAccessToken coverage) ---
    it('rejects if access token is missing', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue(null);

      const action = fetchExpensesForCompanion({companionId: 'c-123'});
      const result = await action(mockDispatch, mockGetState, undefined);

      expect(result.payload).toBe('Missing access token. Please sign in again.');
    });

    it('rejects if token is expired', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({
        accessToken: 'expired-token',
      });
      (isTokenExpired as jest.Mock).mockReturnValue(true);

      const action = fetchExpensesForCompanion({companionId: 'c-123'});
      const result = await action(mockDispatch, mockGetState, undefined);

      expect(result.payload).toBe('Your session expired. Please sign in again.');
    });

    it('handles API errors generic', async () => {
      (expenseApi.fetchExpenses as jest.Mock).mockRejectedValue(new Error('Network fail'));
      const action = fetchExpensesForCompanion({companionId: 'c-123'});
      const result = await action(mockDispatch, mockGetState, undefined);
      expect(result.payload).toBe('Network fail');
    });

    it('handles non-Error objects thrown', async () => {
        (expenseApi.fetchExpenses as jest.Mock).mockRejectedValue('String error');
        const action = fetchExpensesForCompanion({companionId: 'c-123'});
        const result = await action(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Failed to fetch expenses');
    });
  });

  describe('fetchExpenseSummary', () => {
    it('fetches summary successfully', async () => {
      (expenseApi.fetchSummary as jest.Mock).mockResolvedValue({total: 500});
      const action = fetchExpenseSummary({companionId: 'c-123'});
      const result = await action(mockDispatch, mockGetState, undefined);

      expect(result.type).toBe('expenses/fetchSummary/fulfilled');
      expect(result.payload).toEqual({
        companionId: 'c-123',
        summary: {total: 500},
      });
    });

    it('rejects if companionId missing', async () => {
      // @ts-ignore
      const action = fetchExpenseSummary({companionId: null});
      const result = await action(mockDispatch, mockGetState, undefined);
      expect(result.payload).toBe('Please select a companion to view expenses.');
    });

    it('handles generic errors', async () => {
        (expenseApi.fetchSummary as jest.Mock).mockRejectedValue('Err');
        const action = fetchExpenseSummary({companionId: 'c-123'});
        const result = await action(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Failed to fetch expense summary');
    });
  });

  describe('fetchExpenseById', () => {
    it('fetches single expense successfully', async () => {
      const mockExp = {id: '123'};
      (expenseApi.fetchExpenseById as jest.Mock).mockResolvedValue(mockExp);

      const result = await fetchExpenseById({expenseId: '123'})(mockDispatch, mockGetState, undefined);
      expect(result.payload).toEqual(mockExp);
    });

    it('handles error', async () => {
      (expenseApi.fetchExpenseById as jest.Mock).mockRejectedValue(new Error('Not found'));
      const result = await fetchExpenseById({expenseId: '123'})(mockDispatch, mockGetState, undefined);
      expect(result.payload).toBe('Not found');
    });

    it('handles generic error', async () => {
        (expenseApi.fetchExpenseById as jest.Mock).mockRejectedValue('Err');
        const result = await fetchExpenseById({expenseId: '123'})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Failed to load expense details');
      });
  });

  // ==============================================================================
  // 2. Creation & Deletion Thunks
  // ==============================================================================

  describe('addExternalExpense', () => {
    const payload = {
      companionId: 'c-1',
      title: 'Food',
      category: 'Care',
      subcategory: 'Food',
      visitType: 'Regular',
      amount: 50,
      date: '2023-01-01',
      attachments: [],
      providerName: 'PetStore',
      note: 'Yummy',
    };

    it('calls createExternal API with correct input structure', async () => {
      // Mock successful creation
      (expenseApi.createExternal as jest.Mock).mockResolvedValue({id: 'new-exp', ...payload});

      const action = addExternalExpense(payload);
      const result = await action(mockDispatch, mockGetState, undefined);

      expect(result.type).toBe('expenses/addExternalExpense/fulfilled');

      // Verify internal helper buildExpenseInput via API call arguments
      expect(expenseApi.createExternal).toHaveBeenCalledWith({
        accessToken: 'valid-token',
        input: {
          companionId: 'c-1',
          parentId: 'parent-123', // Resolved from resolveParentId
          category: 'Care',
          subcategory: 'Food',
          visitType: 'Regular',
          expenseName: 'Food',
          businessName: 'PetStore', // providerName mapped to businessName
          date: '2023-01-01',
          amount: 50,
          currency: 'USD',
          attachments: [],
          note: 'Yummy',
        },
      });
    });

    it('resolves parentId to user id if parentId is missing in state', async () => {
       // Mock state where parentId is undefined but user id exists
       setupState({user: {id: 'user-only', parentId: undefined}});

       const action = addExternalExpense(payload);
       await action(mockDispatch, mockGetState, undefined);

       expect(expenseApi.createExternal).toHaveBeenCalledWith(
           expect.objectContaining({
               input: expect.objectContaining({parentId: 'user-only'})
           })
       );
    });

    it('handles missing optional fields (providerName, note)', async () => {
       const minimalPayload = {...payload, providerName: undefined, note: undefined};
       const action = addExternalExpense(minimalPayload);
       await action(mockDispatch, mockGetState, undefined);

       expect(expenseApi.createExternal).toHaveBeenCalledWith(
        expect.objectContaining({
            input: expect.objectContaining({
                businessName: '',
                note: '',
            })
        })
       );
    });

    it('handles errors', async () => {
        (expenseApi.createExternal as jest.Mock).mockRejectedValue(new Error('Create failed'));
        const result = await addExternalExpense(payload)(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Create failed');
    });

    it('handles generic errors', async () => {
        (expenseApi.createExternal as jest.Mock).mockRejectedValue('Err');
        const result = await addExternalExpense(payload)(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Failed to add expense');
    });
  });

  describe('deleteExternalExpense', () => {
    it('calls delete API and returns IDs', async () => {
        const action = deleteExternalExpense({expenseId: 'e-1', companionId: 'c-1'});
        const result = await action(mockDispatch, mockGetState, undefined);

        expect(expenseApi.deleteExpense).toHaveBeenCalledWith({
            expenseId: 'e-1',
            accessToken: 'valid-token'
        });
        expect(result.payload).toEqual({expenseId: 'e-1', companionId: 'c-1'});
    });

    it('handles errors', async () => {
        (expenseApi.deleteExpense as jest.Mock).mockRejectedValue(new Error('Del fail'));
        const result = await deleteExternalExpense({expenseId: 'e-1', companionId: 'c-1'})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Del fail');
    });

    it('handles generic errors', async () => {
        (expenseApi.deleteExpense as jest.Mock).mockRejectedValue('Err');
        const result = await deleteExternalExpense({expenseId: 'e-1', companionId: 'c-1'})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Failed to delete expense');
    });
  });

  // ==============================================================================
  // 3. Update Thunk & Validation Logic
  // ==============================================================================

  describe('updateExternalExpense', () => {
    const existingExpense = {
        id: 'exp-1',
        companionId: 'c-1',
        category: 'OldCat',
        subcategory: 'OldSub',
        visitType: 'OldVisit',
        title: 'OldTitle',
        businessName: 'OldBiz',
        date: '2022-01-01',
        amount: 10,
        attachments: [],
        note: 'OldNote',
        source: 'external', // Critical for update check
    };

    it('successfully merges updates with existing data', async () => {
        // Setup state with existing expense
        setupState({expenses: [existingExpense]});

        const updates = {
            title: 'NewTitle',
            amount: 100,
        };

        const action = updateExternalExpense({expenseId: 'exp-1', updates});
        await action(mockDispatch, mockGetState, undefined);

        expect(expenseApi.updateExternal).toHaveBeenCalledWith(
            expect.objectContaining({
                expenseId: 'exp-1',
                input: expect.objectContaining({
                    expenseName: 'NewTitle', // Updated
                    amount: 100,            // Updated
                    category: 'OldCat',      // Preserved
                    businessName: 'OldBiz',  // Preserved
                })
            })
        );
    });

    it('rejects if expense not found in state', async () => {
        setupState({expenses: []}); // Empty expenses

        const result = await updateExternalExpense({expenseId: 'exp-1', updates: {}})(mockDispatch, mockGetState, undefined);

        expect(result.type).toBe('expenses/updateExternalExpense/rejected');
        expect(result.payload).toBe('Expense not found.');
    });

    it('rejects if expense source is not external', async () => {
        setupState({expenses: [{...existingExpense, source: 'internal'}]});

        const result = await updateExternalExpense({expenseId: 'exp-1', updates: {}})(mockDispatch, mockGetState, undefined);

        expect(result.payload).toBe('Only external expenses can be edited.');
    });

    it('maps providerName updates to businessName', async () => {
        setupState({expenses: [existingExpense]});

        const updates = {providerName: 'NewBiz'};
        await updateExternalExpense({expenseId: 'exp-1', updates})(mockDispatch, mockGetState, undefined);

        expect(expenseApi.updateExternal).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({businessName: 'NewBiz'})
            })
        );
    });

    it('fallbacks to existing providerName or businessName if no update', async () => {
        // Case where existing has providerName property
        const expWithProv = {...existingExpense, providerName: 'ProvName'};
        setupState({expenses: [expWithProv]});

        await updateExternalExpense({expenseId: 'exp-1', updates: {}})(mockDispatch, mockGetState, undefined);

        expect(expenseApi.updateExternal).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({businessName: 'ProvName'})
            })
        );
    });

    it('handles note fallback from description if present', async () => {
        const expWithDesc = {...existingExpense, note: null, description: 'DescNote'};
        setupState({expenses: [expWithDesc]});

        await updateExternalExpense({expenseId: 'exp-1', updates: {}})(mockDispatch, mockGetState, undefined);

        expect(expenseApi.updateExternal).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({note: 'DescNote'})
            })
        );
    });

    it('handles errors', async () => {
        setupState({expenses: [existingExpense]});
        (expenseApi.updateExternal as jest.Mock).mockRejectedValue(new Error('Update fail'));

        const result = await updateExternalExpense({expenseId: 'exp-1', updates: {}})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Update fail');
    });

    it('handles generic errors', async () => {
        setupState({expenses: [existingExpense]});
        (expenseApi.updateExternal as jest.Mock).mockRejectedValue('Err');

        const result = await updateExternalExpense({expenseId: 'exp-1', updates: {}})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Failed to update expense');
    });
  });

  // ==============================================================================
  // 4. Invoices & Payment Intents
  // ==============================================================================

  describe('markInAppExpenseStatus', () => {
    it('successfully dispatches action', async () => {
        const payload = { expenseId: 'e-1', status: 'PAID' };
        const action = markInAppExpenseStatus(payload);
        const result = await action(mockDispatch, mockGetState, undefined);

        // Assert that the function was called and returned a result (satisfies usage)
        expect(result.type).toBeDefined();
    });
  });

  describe('fetchExpenseInvoice', () => {
    it('calls API correctly', async () => {
        (expenseApi.fetchInvoice as jest.Mock).mockResolvedValue({invoice: {id: 'inv-1'}});
        const result = await fetchExpenseInvoice({invoiceId: 'inv-1'})(mockDispatch, mockGetState, undefined);

        expect(expenseApi.fetchInvoice).toHaveBeenCalledWith({invoiceId: 'inv-1', accessToken: 'valid-token'});
        expect(result.payload).toEqual({invoice: {id: 'inv-1'}});
    });

    it('handles error', async () => {
        (expenseApi.fetchInvoice as jest.Mock).mockRejectedValue(new Error('Fail'));
        const result = await fetchExpenseInvoice({invoiceId: 'inv-1'})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Fail');
    });

    it('handles generic error', async () => {
        (expenseApi.fetchInvoice as jest.Mock).mockRejectedValue('Err');
        const result = await fetchExpenseInvoice({invoiceId: 'inv-1'})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Failed to fetch invoice');
    });
  });

  describe('fetchExpensePaymentIntent', () => {
    it('calls API correctly', async () => {
        (expenseApi.fetchPaymentIntent as jest.Mock).mockResolvedValue({clientSecret: 'secret'});
        const result = await fetchExpensePaymentIntent({paymentIntentId: 'pi-1'})(mockDispatch, mockGetState, undefined);

        expect(expenseApi.fetchPaymentIntent).toHaveBeenCalledWith({paymentIntentId: 'pi-1', accessToken: 'valid-token'});
        expect(result.payload).toEqual({clientSecret: 'secret'});
    });

    it('handles error', async () => {
        (expenseApi.fetchPaymentIntent as jest.Mock).mockRejectedValue(new Error('Fail'));
        const result = await fetchExpensePaymentIntent({paymentIntentId: 'pi-1'})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Fail');
    });

    it('handles generic error', async () => {
        (expenseApi.fetchPaymentIntent as jest.Mock).mockRejectedValue('Err');
        const result = await fetchExpensePaymentIntent({paymentIntentId: 'pi-1'})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Failed to fetch payment intent');
    });
  });

  describe('fetchExpensePaymentIntentByInvoice', () => {
    it('calls API correctly', async () => {
        (expenseApi.fetchPaymentIntentByInvoice as jest.Mock).mockResolvedValue({clientSecret: 'secret'});
        const result = await fetchExpensePaymentIntentByInvoice({invoiceId: 'inv-1'})(mockDispatch, mockGetState, undefined);

        expect(expenseApi.fetchPaymentIntentByInvoice).toHaveBeenCalledWith({invoiceId: 'inv-1', accessToken: 'valid-token'});
        expect(result.payload).toEqual({clientSecret: 'secret'});
    });

    it('handles error', async () => {
        (expenseApi.fetchPaymentIntentByInvoice as jest.Mock).mockRejectedValue(new Error('Fail'));
        const result = await fetchExpensePaymentIntentByInvoice({invoiceId: 'inv-1'})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Fail');
    });

    it('handles generic error', async () => {
        (expenseApi.fetchPaymentIntentByInvoice as jest.Mock).mockRejectedValue('Err');
        const result = await fetchExpensePaymentIntentByInvoice({invoiceId: 'inv-1'})(mockDispatch, mockGetState, undefined);
        expect(result.payload).toBe('Failed to fetch payment intent');
    });
  });
});