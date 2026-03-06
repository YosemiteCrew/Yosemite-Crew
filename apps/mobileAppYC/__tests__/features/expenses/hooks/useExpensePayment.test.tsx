import {renderHook, act} from '@testing-library/react-native';
import {Alert} from 'react-native';
import * as Redux from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import useExpensePayment from '../../../../src/features/expenses/hooks/useExpensePayment';
import {
  fetchExpenseInvoice,
  fetchExpensePaymentIntent,
  fetchExpensePaymentIntentByInvoice,
} from '../../../../src/features/expenses/thunks';
import {isExpensePaymentPending} from '../../../../src/features/expenses/utils/status';

// --- Mocks ---

// Mock Navigation
const mockNavigate = jest.fn();
const mockGetParent = jest.fn();
const mockGetState = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

// Mock Redux
jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}));

// Mock Thunks
jest.mock('../../../../src/features/expenses/thunks', () => ({
  fetchExpenseInvoice: jest.fn(),
  fetchExpensePaymentIntent: jest.fn(),
  fetchExpensePaymentIntentByInvoice: jest.fn(),
}));

// Mock Utils
jest.mock('../../../../src/features/expenses/utils/status', () => ({
  isExpensePaymentPending: jest.fn(),
}));

describe('useExpensePayment Hook', () => {
  // IMPORTANT: Dispatch must return the action passed to it so .unwrap() can be called on the return value
  const mockDispatch = jest.fn(action => action);

  const mockExpense = {
    id: 'exp-1',
    invoiceId: 'inv-1',
    source: 'inApp',
    companionId: 'comp-1',
    amount: 100,
    status: 'pending',
  };

  const mockInvoice = {
    id: 'inv-1',
    appointmentId: 'appt-1',
    paymentIntent: {paymentIntentId: 'pi_123', clientSecret: 'secret_123'},
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Spy on Alert instead of mocking the whole RN module to avoid TurboModule issues
    jest.spyOn(Alert, 'alert');

    (Redux.useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      getParent: mockGetParent,
      getState: mockGetState,
    });

    // Default Thunk implementations (simulate successful unwrap)
    (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({
      unwrap: jest
        .fn()
        .mockResolvedValue({
          invoice: mockInvoice,
          paymentIntent: mockInvoice.paymentIntent,
        }),
    });
    (fetchExpensePaymentIntent as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({}),
    });
    (
      fetchExpensePaymentIntentByInvoice as unknown as jest.Mock
    ).mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({}),
    });

    // Default Status
    (isExpensePaymentPending as jest.Mock).mockReturnValue(true);
  });

  // ===========================================================================
  // 1. extractAppointmentId Logic (Helper Function)
  // ===========================================================================

  describe('Appointment ID Extraction', () => {
    it('should extract appointmentId directly from property', async () => {
      const invoice = {...mockInvoice, appointmentId: 'appt-direct'};
      const {result} = renderHook(() => useExpensePayment());

      const unwrapInvoice = jest
        .fn()
        .mockResolvedValue({invoice, paymentIntent: null});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapInvoice,
      });

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'Appointments',
        expect.objectContaining({
          params: expect.objectContaining({appointmentId: 'appt-direct'}),
        }),
      );
    });

    it('should extract appointmentId from extension', async () => {
      const invoice = {
        id: 'inv-ext',
        extension: [
          {url: 'http://example/appointment-id', valueString: 'appt-ext'},
        ],
      };
      const {result} = renderHook(() => useExpensePayment());

      const unwrapInvoice = jest
        .fn()
        .mockResolvedValue({invoice, paymentIntent: null});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapInvoice,
      });

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'Appointments',
        expect.objectContaining({
          params: expect.objectContaining({appointmentId: 'appt-ext'}),
        }),
      );
    });

    it('should extract appointmentId from account reference', async () => {
      const invoice = {
        id: 'inv-ref',
        account: {reference: 'Appointment/appt-ref'},
      };
      const {result} = renderHook(() => useExpensePayment());

      const unwrapInvoice = jest
        .fn()
        .mockResolvedValue({invoice, paymentIntent: null});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapInvoice,
      });

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'Appointments',
        expect.objectContaining({
          params: expect.objectContaining({appointmentId: 'appt-ref'}),
        }),
      );
    });

    it('should alert if no appointmentId found', async () => {
      const invoice = {id: 'inv-none'}; // No ID anywhere
      const {result} = renderHook(() => useExpensePayment());

      const unwrapInvoice = jest
        .fn()
        .mockResolvedValue({invoice, paymentIntent: null});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapInvoice,
      });

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Payment unavailable',
        expect.stringContaining(
          'Invoice does not contain appointment reference',
        ),
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 2. Validation Logic
  // ===========================================================================

  describe('Validation', () => {
    it('should prevent processing if already processing', async () => {
      const {result} = renderHook(() => useExpensePayment());

      let resolveFirst: (val: any) => void;
      const pendingPromise = new Promise(resolve => {
        resolveFirst = resolve;
      });
      const unwrapPending = jest.fn().mockReturnValue(pendingPromise);
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapPending,
      });

      // Start first call
      let firstPromise: Promise<void>;
      await act(async () => {
        firstPromise = result.current.openPaymentScreen(mockExpense as any);
      });

      expect(result.current.processingPayment).toBe(true);

      // Attempt second call
      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      // Should be called once (second call ignored)
      expect(fetchExpenseInvoice).toHaveBeenCalledTimes(1);

      // Finish up to prevent leak
      await act(async () => {
        resolveFirst!({invoice: mockInvoice});
        await firstPromise;
      });

      expect(result.current.processingPayment).toBe(false);
    });

    it('should reject non-inApp expenses', async () => {
      const {result} = renderHook(() => useExpensePayment());
      await act(async () => {
        await result.current.openPaymentScreen({
          ...mockExpense,
          source: 'manual',
        } as any);
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Payment unavailable',
        'Only in-app expenses can be paid here.',
      );
      expect(fetchExpenseInvoice).not.toHaveBeenCalled();
    });

    it('should reject expenses without invoiceId', async () => {
      const {result} = renderHook(() => useExpensePayment());
      await act(async () => {
        await result.current.openPaymentScreen({
          ...mockExpense,
          invoiceId: undefined,
        } as any);
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Payment unavailable',
        expect.stringContaining('Invoice not found'),
      );
      expect(fetchExpenseInvoice).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 3. Payment Intent Fetching Logic
  // ===========================================================================

  describe('Payment Intent Fetching', () => {
    it('should fetch invoice if not provided', async () => {
      const {result} = renderHook(() => useExpensePayment());
      const unwrap = jest
        .fn()
        .mockResolvedValue({
          invoice: mockInvoice,
          paymentIntent: {clientSecret: 'cs_1'},
        });
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({unwrap});

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(fetchExpenseInvoice).toHaveBeenCalledWith({invoiceId: 'inv-1'});
    });

    it('should attempt fetchByInvoice if pending and no secret', async () => {
      const {result} = renderHook(() => useExpensePayment());
      (isExpensePaymentPending as jest.Mock).mockReturnValue(true);

      // First fetch (invoice) returns no intent
      const unwrapInvoice = jest
        .fn()
        .mockResolvedValue({invoice: mockInvoice, paymentIntent: null});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapInvoice,
      });

      // Second fetch (by invoice ID) returns intent
      const unwrapIntent = jest
        .fn()
        .mockResolvedValue({clientSecret: 'cs_new'});
      (
        fetchExpensePaymentIntentByInvoice as unknown as jest.Mock
      ).mockReturnValue({unwrap: unwrapIntent});

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(fetchExpensePaymentIntentByInvoice).toHaveBeenCalledWith({
        invoiceId: 'inv-1',
      });
    });

    it('should fallback to fetchPaymentIntent (by intent ID) if fetchByInvoice fails', async () => {
      const {result} = renderHook(() => useExpensePayment());
      (isExpensePaymentPending as jest.Mock).mockReturnValue(true);

      // Invoice has paymentIntentId
      const invoiceWithIntentId = {
        ...mockInvoice,
        paymentIntent: {paymentIntentId: 'pi_old'}, // Triggers the fallback logic
      };

      const unwrapInvoice = jest
        .fn()
        .mockResolvedValue({invoice: invoiceWithIntentId, paymentIntent: null});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapInvoice,
      });

      // fetchByInvoice FAILS
      (
        fetchExpensePaymentIntentByInvoice as unknown as jest.Mock
      ).mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(new Error('Fail')),
      });

      // Fallback fetch (by Intent ID)
      const unwrapFallback = jest
        .fn()
        .mockResolvedValue({clientSecret: 'cs_fallback'});
      (fetchExpensePaymentIntent as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapFallback,
      });

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(fetchExpensePaymentIntentByInvoice).toHaveBeenCalled(); // Tried & failed
      expect(fetchExpensePaymentIntent).toHaveBeenCalledWith({
        paymentIntentId: 'pi_old',
      }); // Fallback used
    });

    it('should handle different invoice structures for intent ID', async () => {
      const {result} = renderHook(() => useExpensePayment());
      (isExpensePaymentPending as jest.Mock).mockReturnValue(false); // Skip fetchByInvoice step

      // Case 1: payment_intent_id (snake_case)
      const invoiceSnake = {
        id: 'i',
        appointmentId: 'a',
        payment_intent_id: 'pi_snake',
      };
      const unwrap1 = jest
        .fn()
        .mockResolvedValue({invoice: invoiceSnake, paymentIntent: null});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValueOnce({
        unwrap: unwrap1,
      });
      (fetchExpensePaymentIntent as unknown as jest.Mock).mockReturnValue({
        unwrap: jest.fn().mockResolvedValue({}),
      });

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });
      expect(fetchExpensePaymentIntent).toHaveBeenLastCalledWith({
        paymentIntentId: 'pi_snake',
      });

      // Case 2: stripePaymentIntentId
      const invoiceStripe = {
        id: 'i',
        appointmentId: 'a',
        stripePaymentIntentId: 'pi_stripe',
      };
      const unwrap2 = jest
        .fn()
        .mockResolvedValue({invoice: invoiceStripe, paymentIntent: null});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValueOnce({
        unwrap: unwrap2,
      });

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });
      expect(fetchExpensePaymentIntent).toHaveBeenLastCalledWith({
        paymentIntentId: 'pi_stripe',
      });
    });
  });

  // ===========================================================================
  // 4. Navigation Logic (Recursion)
  // ===========================================================================

  describe('Navigation Finding', () => {
    it('should use current navigation if no parent', async () => {
      // Setup simple navigation with no parent
      (useNavigation as jest.Mock).mockReturnValue({
        navigate: mockNavigate,
        getParent: () => null, // No parent
      });

      const {result} = renderHook(() => useExpensePayment());

      const unwrap = jest.fn().mockResolvedValue({invoice: mockInvoice});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({unwrap});

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'Appointments',
        expect.anything(),
      );
    });

    it('should find TabNavigation by searching parents (Deep Search)', async () => {
      // Mock a deep hierarchy: Stack -> Stack -> Tab (Appointments) -> Root
      const mockTabNav = {
        navigate: jest.fn(),
        getState: () => ({routeNames: ['Appointments']}),
      };
      const mockStack2 = {getParent: () => mockTabNav, getState: () => ({})};
      const mockStack1 = {getParent: () => mockStack2, getState: () => ({})};

      (useNavigation as jest.Mock).mockReturnValue({
        navigate: jest.fn(), // Should NOT use this one
        getParent: () => mockStack1,
        getState: () => ({}),
      });

      const {result} = renderHook(() => useExpensePayment());

      const unwrap = jest.fn().mockResolvedValue({invoice: mockInvoice});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({unwrap});

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });
    });

    it('should fallback to 3 levels up if "Appointments" route not found explicitly', async () => {
      const rootNav = {navigate: jest.fn()};
      const p2 = {getParent: () => rootNav};
      const p1 = {getParent: () => p2};

      (useNavigation as jest.Mock).mockReturnValue({
        navigate: jest.fn(),
        getParent: () => p1, // 1 level up
      });

      const {result} = renderHook(() => useExpensePayment());
      const unwrap = jest.fn().mockResolvedValue({invoice: mockInvoice});
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({unwrap});

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });
    });
  });

  // ===========================================================================
  // 5. Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle fetch invoice failure', async () => {
      const {result} = renderHook(() => useExpensePayment());
      const unwrap = jest.fn().mockRejectedValue(new Error('Network Error'));
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({unwrap});

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Payment unavailable',
        'Network Error',
      );
      expect(result.current.processingPayment).toBe(false);
    });

    it('should alert if invoice is null', async () => {
      const {result} = renderHook(() => useExpensePayment());
      const unwrap = jest.fn().mockResolvedValue({invoice: null}); // API success but no data
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({unwrap});

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Payment unavailable',
        'Invoice data not found. Please try again.',
      );
    });

    it('should handle generic/string errors', async () => {
      const {result} = renderHook(() => useExpensePayment());
      const unwrap = jest.fn().mockRejectedValue('String Error');
      (fetchExpenseInvoice as unknown as jest.Mock).mockReturnValue({unwrap});

      await act(async () => {
        await result.current.openPaymentScreen(mockExpense as any);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Payment unavailable',
        'Unable to start payment. Please try again.',
      );
    });
  });
});
