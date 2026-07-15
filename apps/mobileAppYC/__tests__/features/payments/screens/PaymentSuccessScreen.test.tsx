import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {PaymentSuccessScreen} from '../../../../src/features/payments/screens/PaymentSuccessScreen';
// ✅ FIX 2: Remove unused 'useDispatch' from import
import {useSelector} from 'react-redux';
// ✅ FIX 2: Remove unused 'useNavigation' (keep useRoute if used in tests, or mocks)
import {useRoute} from '@react-navigation/native';
import {setSelectedCompanion} from '@/features/companion';
import {markInAppExpenseStatus} from '@/features/expenses';
import {Linking} from 'react-native';
// --- Mocks ---

const mockDispatch = jest.fn();
const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockGetParent = jest.fn();

// 1. Mock Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    reset: mockReset,
    getParent: mockGetParent,
  }),
  useRoute: jest.fn(),
}));

// 2. Mock Redux
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: jest.fn(),
}));

// 3. Mock Actions
jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn(id => ({type: 'SET_COMPANION', payload: id})),
}));

jest.mock('@/features/expenses', () => ({
  markInAppExpenseStatus: jest.fn(payload => ({
    type: 'MARK_EXPENSE_STATUS',
    payload,
  })),
}));

jest.mock('@/features/appointments/appointmentsSlice', () => ({
  fetchInvoiceForAppointment: jest.fn(payload => ({
    type: 'FETCH_INVOICE',
    payload,
  })),
}));

// 4. Mock Theme & Assets
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    successPayment: {uri: 'success-img'},
    downloadInvoice: {uri: 'download-icon'},
  },
}));

// 5. Mock Components to avoid hoisting issues
jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity onPress={onPress} testID="dashboard-btn">
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: () => {
    const {View} = require('react-native');
    return <View testID="mock-header" />;
  },
}));

jest.mock('@/shared/components/common', () => ({
  SafeArea: ({children}: any) => {
    const {View} = require('react-native');
    return <View>{children}</View>;
  },
}));

// --- Helper Data ---
const mockState = {
  appointments: {
    items: [
      {id: 'apt-1', companionId: 'comp-1'},
      {id: 'apt-2', companionId: null}, // For null branch testing
      {
        id: 'apt-start',
        companionId: 'comp-1',
        start: '2025-08-15T10:30:00Z',
      },
      {
        id: 'apt-date-time',
        companionId: 'comp-1',
        date: '2025-08-15',
        time: '10:30',
      },
    ],
    invoices: [
      {
        id: 'inv-1',
        appointmentId: 'apt-1',
        invoiceNumber: 'BDY024474',
        invoiceDate: '2025-08-15T10:30:00Z',
        downloadUrl: 'https://example.com/invoice.pdf',
        paymentIntent: {},
      },
    ],
  },
};

describe('PaymentSuccessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default Selector Implementation
    (useSelector as unknown as jest.Mock).mockImplementation(selectorFn => {
      return selectorFn(mockState);
    });

    // Default Parent Navigation
    mockGetParent.mockReturnValue({
      navigate: mockNavigate,
    });
  });

  describe('UI Rendering', () => {
    beforeEach(() => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {appointmentId: 'apt-1'},
      });
    });

    it('renders the success message and invoice details correctly', () => {
      render(<PaymentSuccessScreen />);

      expect(screen.getByText('Thank you')).toBeTruthy();
      expect(
        screen.getByText('You have Successfully made Payment'),
      ).toBeTruthy();
      expect(screen.getByText('BDY024474')).toBeTruthy(); // Invoice number
      // Date format may vary, just check for month/day/year
      expect(screen.queryByText(/Aug.*2025/)).toBeTruthy();
    });

    it('renders the Dashboard button', () => {
      render(<PaymentSuccessScreen />);
      expect(screen.getByTestId('dashboard-btn')).toBeTruthy();
    });
  });

  describe('Logic & Interactions', () => {
    // Branch 1: companionId provided in Route
    it('dispatches selected companion from route params and navigates', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {appointmentId: 'apt-1', companionId: 'comp-99'},
      });

      render(<PaymentSuccessScreen />);

      // Clear any dispatch calls that happened during render
      mockDispatch.mockClear();

      const btn = screen.getByTestId('dashboard-btn');
      fireEvent.press(btn);

      // 1. Check Dispatch
      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(setSelectedCompanion).toHaveBeenCalledWith('comp-99');

      // 2. Check Navigation
      expect(mockGetParent).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('Appointments', {
        screen: 'MyAppointments',
      });
    });

    // Branch 2: companionId NOT in route, but found in Appointment
    it('dispatches selected companion from appointment lookup and navigates', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {appointmentId: 'apt-1'}, // No companionId param
      });
      // Store has apt-1 linked to comp-1 (set in mockState above)

      render(<PaymentSuccessScreen />);

      // Clear any dispatch calls that happened during render
      mockDispatch.mockClear();

      const btn = screen.getByTestId('dashboard-btn');
      fireEvent.press(btn);

      // Should resolve to 'comp-1' from Redux store
      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(setSelectedCompanion).toHaveBeenCalledWith('comp-1');
      expect(mockNavigate).toHaveBeenCalledWith('Appointments', {
        screen: 'MyAppointments',
      });
    });

    // Branch 3: No companionId in route OR appointment (Null Branch)
    it('does NOT dispatch setCompanion if resolved ID is null, but still navigates', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {appointmentId: 'apt-2'}, // apt-2 has null companionId in mockState
      });

      render(<PaymentSuccessScreen />);

      // Clear any dispatch calls that happened during render
      mockDispatch.mockClear();

      const btn = screen.getByTestId('dashboard-btn');
      fireEvent.press(btn);

      // Dispatch should NOT happen because resolvedCompanionId is null
      expect(mockDispatch).not.toHaveBeenCalled();

      // Navigation should still happen
      expect(mockNavigate).toHaveBeenCalledWith('Appointments', {
        screen: 'MyAppointments',
      });
    });

    // Branch 4: Tab Navigation (getParent) returns null (Safety check)
    it('handles missing parent navigator gracefully', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {appointmentId: 'apt-1'},
      });

      mockGetParent.mockReturnValue(null); // Simulate no parent tabs

      render(<PaymentSuccessScreen />);

      const btn = screen.getByTestId('dashboard-btn');
      fireEvent.press(btn);

      // No tab navigation -> should not navigate
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('formats the appointment date/time from a valid "start" field', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {appointmentId: 'apt-start'},
      });

      render(<PaymentSuccessScreen />);

      expect(screen.queryByText(/Aug.*2025/)).toBeTruthy();
    });

    it('formats the appointment date/time by combining "date" and "time" fields', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {appointmentId: 'apt-date-time'},
      });

      render(<PaymentSuccessScreen />);

      expect(screen.queryByText(/Aug.*2025/)).toBeTruthy();
    });

    it('dispatches markInAppExpenseStatus and navigates to Expenses when expenseId is present', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {appointmentId: 'apt-1', expenseId: 'exp-1'},
      });

      render(<PaymentSuccessScreen />);

      expect(markInAppExpenseStatus).toHaveBeenCalledWith({
        expenseId: 'exp-1',
        status: 'PAID',
      });

      mockDispatch.mockClear();
      fireEvent.press(screen.getByTestId('dashboard-btn'));

      expect(mockNavigate).toHaveBeenCalledWith('HomeStack', {
        screen: 'ExpensesStack',
        params: {screen: 'ExpensesMain'},
      });
    });

    it('opens the invoice URL when the view invoice link is pressed', () => {
      const openURLSpy = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined as any);
      (useRoute as jest.Mock).mockReturnValue({
        params: {appointmentId: 'apt-1'},
      });

      render(<PaymentSuccessScreen />);
      fireEvent.press(screen.getByText('View invoice'));

      expect(openURLSpy).toHaveBeenCalledWith(
        'https://example.com/invoice.pdf',
      );
      openURLSpy.mockRestore();
    });

    it('logs a warning when opening the invoice URL fails', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const openURLSpy = jest
        .spyOn(Linking, 'openURL')
        .mockRejectedValue(new Error('cannot open'));
      (useRoute as jest.Mock).mockReturnValue({
        params: {appointmentId: 'apt-1'},
      });

      render(<PaymentSuccessScreen />);
      fireEvent.press(screen.getByText('View invoice'));

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[PaymentSuccess] Failed to open invoice URL',
        expect.any(Error),
      );
      openURLSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});
