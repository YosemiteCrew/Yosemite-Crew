import {renderHook, act} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {usePaymentHandler} from '../../../../src/features/payments/hooks/usePaymentHandler';
import {useStripe} from '@stripe/stripe-react-native';
import {useDispatch} from 'react-redux';
import {recordPayment} from '../../../../src/features/appointments/appointmentsSlice';

// --- Mocks ---

// 1. Mutable Config Mock (Fixes isolateModules crash)
let mockStripeConfig: any = {};

jest.mock('@/config/variables', () => ({
  get STRIPE_CONFIG() {
    return mockStripeConfig;
  },
}));

// 2. Redux & Thunks (Fixes undefined dispatch args)
jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}));

jest.mock('@/features/appointments/appointmentsSlice', () => ({
  recordPayment: Object.assign(
    jest.fn().mockReturnValue({type: 'appointments/recordPayment/pending'}), // Return a dummy action
    {
      rejected: {
        match: jest.fn(),
      },
    },
  ),
}));

// 3. Stripe
jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: jest.fn(),
}));

// 4. React Native Alert
jest.spyOn(Alert, 'alert');

describe('usePaymentHandler', () => {
  const mockDispatch = jest.fn();
  const mockInitPaymentSheet = jest.fn();
  const mockPresentPaymentSheet = jest.fn();
  const mockNavigation = {replace: jest.fn()};

  const defaultProps = {
    clientSecret: 'secret_123',
    businessName: 'Test Vet',
    guardianName: 'John Doe',
    guardianEmail: 'john@example.com',
    appointmentId: 'apt-1',
    companionId: 'comp-1',
    expenseId: 'exp-1',
    navigation: mockNavigation,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset config default state
    mockStripeConfig = {
      merchantDisplayName: 'Yosemite Crew',
      urlScheme: 'yosemite',
    };

    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useStripe as jest.Mock).mockReturnValue({
      initPaymentSheet: mockInitPaymentSheet,
      presentPaymentSheet: mockPresentPaymentSheet,
    });

    // Default happy paths
    mockInitPaymentSheet.mockResolvedValue({error: null});
    mockPresentPaymentSheet.mockResolvedValue({error: null});

    // Make dispatch return the action it was called with (simulate thunk)
    mockDispatch.mockImplementation((action) => Promise.resolve(action));

    // Default recordPayment matching (not rejected)
    (recordPayment.rejected.match as unknown as jest.Mock).mockReturnValue(false);
  });

  // --- 1. Basic Validations ---

  it('alerts if clientSecret is missing', async () => {
    const {result} = renderHook(() =>
      usePaymentHandler({...defaultProps, clientSecret: null}),
    );

    await act(async () => {
      await result.current.handlePayNow();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Payment unavailable',
      expect.stringContaining('No payment intent'),
    );
    expect(mockInitPaymentSheet).not.toHaveBeenCalled();
  });

  // --- 2. Initialization Errors ---

  it('alerts and stops if initPaymentSheet fails', async () => {
    mockInitPaymentSheet.mockResolvedValue({
      error: {message: 'Network error'},
    });

    const {result} = renderHook(() => usePaymentHandler(defaultProps));

    await act(async () => {
      await result.current.handlePayNow();
    });

    // Check loading state flow (true -> false)
    expect(result.current.presentingSheet).toBe(false);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Payment unavailable',
      'Network error',
    );
    expect(mockPresentPaymentSheet).not.toHaveBeenCalled();
  });

  // --- 3. Presentation Errors & Crashes ---

  it('alerts if presentPaymentSheet returns an error', async () => {
    mockPresentPaymentSheet.mockResolvedValue({
      error: {message: 'User cancelled'},
    });

    const {result} = renderHook(() => usePaymentHandler(defaultProps));

    await act(async () => {
      await result.current.handlePayNow();
    });

    expect(result.current.presentingSheet).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Payment failed', 'User cancelled');
    expect(mockDispatch).not.toHaveBeenCalled(); // Should not record payment
  });

  it('catches exceptions during presentation and alerts', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockPresentPaymentSheet.mockRejectedValue(new Error('Crash!'));

    const {result} = renderHook(() => usePaymentHandler(defaultProps));

    await act(async () => {
      await result.current.handlePayNow();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error presenting payment sheet'),
      expect.any(Error),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Payment failed',
      expect.stringContaining('Unable to present'),
    );
    expect(result.current.presentingSheet).toBe(false);

    consoleSpy.mockRestore();
  });

  // --- 4. Success Flow & Redux Logic ---

  it('completes payment successfully, dispatches record, and navigates', async () => {
    const {result} = renderHook(() => usePaymentHandler(defaultProps));

    await act(async () => {
      await result.current.handlePayNow();
    });

    // 1. Init
    expect(mockInitPaymentSheet).toHaveBeenCalled();
    // 2. Present
    expect(mockPresentPaymentSheet).toHaveBeenCalled();
    // 3. Dispatch Record
    // Since recordPayment mock returns an object, mockDispatch is called with that object.
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'appointments/recordPayment/pending'}));
    expect(recordPayment).toHaveBeenCalledWith({appointmentId: 'apt-1'});
    // 4. Navigate
    expect(mockNavigation.replace).toHaveBeenCalledWith('PaymentSuccess', {
      appointmentId: 'apt-1',
      companionId: 'comp-1', // Provided explicit companionId
      expenseId: 'exp-1',
    });
  });

  it('uses aptCompanionId fallback if companionId is missing', async () => {
    const props = {
      ...defaultProps,
      companionId: undefined,
      aptCompanionId: 'apt-comp-1',
    };
    const {result} = renderHook(() => usePaymentHandler(props));

    await act(async () => {
      await result.current.handlePayNow();
    });

    expect(mockNavigation.replace).toHaveBeenCalledWith('PaymentSuccess', {
      appointmentId: 'apt-1',
      companionId: 'apt-comp-1',
      expenseId: 'exp-1',
    });
  });

  it('logs warning if recordPayment is rejected but proceeds to navigation', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Simulate rejection
    (recordPayment.rejected.match as unknown as jest.Mock).mockReturnValue(true);

    const {result} = renderHook(() => usePaymentHandler(defaultProps));

    await act(async () => {
      await result.current.handlePayNow();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to refresh appointment status'),
    );
    // Should still navigate
    expect(mockNavigation.replace).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // --- 5. Configuration Branches (Merchant Name & Config) ---

  it('uses STRIPE_CONFIG merchant name if available', async () => {
    // Set mutable mock config
    mockStripeConfig = {
      merchantDisplayName: 'Config Merchant',
      urlScheme: 'myapp',
    };

    const {result} = renderHook(() => usePaymentHandler(defaultProps));

    await act(async () => {
      await result.current.handlePayNow();
    });

    expect(mockInitPaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantDisplayName: 'Config Merchant',
        returnURL: 'myapp://stripe-redirect',
      }),
    );
  });

  it('falls back to businessName if config name is missing', async () => {
    // Remove merchant name and scheme
    mockStripeConfig = {};

    const {result} = renderHook(() =>
      usePaymentHandler({...defaultProps, businessName: 'Biz Name'}),
    );

    await act(async () => {
      await result.current.handlePayNow();
    });

    expect(mockInitPaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantDisplayName: 'Biz Name',
      }),
    );
    // verify no returnURL property if scheme missing
    const callArgs = mockInitPaymentSheet.mock.calls[0][0];
    expect(callArgs.returnURL).toBeUndefined();
  });

  it('falls back to default "Yosemite Crew" if both config and businessName missing', async () => {
    mockStripeConfig = {};

    const {result} = renderHook(() =>
      usePaymentHandler({...defaultProps, businessName: '   '}), // Empty/Whitespace
    );

    await act(async () => {
      await result.current.handlePayNow();
    });

    expect(mockInitPaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantDisplayName: 'Yosemite Crew',
      }),
    );
  });

  it('handles dash ("—") guardian email by setting it undefined', async () => {
    mockStripeConfig = {};

    const {result} = renderHook(() =>
      usePaymentHandler({...defaultProps, guardianEmail: '—'}),
    );

    await act(async () => {
      await result.current.handlePayNow();
    });

    expect(mockInitPaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultBillingDetails: {
          name: 'John Doe',
          email: undefined, // Should be undefined
        },
      }),
    );
  });
});