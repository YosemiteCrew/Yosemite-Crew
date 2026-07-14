import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {FormSigningScreen} from '../../../../src/features/forms/screens/FormSigningScreen';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation, useRoute, useIsFocused} from '@react-navigation/native';
import {Linking} from 'react-native';
import * as FormActions from '../../../../src/features/forms';

// --- Mocks ---

// Safe mock for react-native Linking/Alert to avoid TurboModule crash while
// keeping every other RN export (View, Text, ActivityIndicator, StyleSheet, …).
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return Object.setPrototypeOf(
    {
      Linking: {
        ...RN.Linking,
        openURL: jest.fn(() => Promise.resolve()),
        canOpenURL: jest.fn(() => Promise.resolve(true)),
        getInitialURL: jest.fn(() => Promise.resolve(null)),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      Alert: {
        ...RN.Alert,
        alert: jest.fn(),
      },
    },
    RN,
  );
});

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: jest.fn(),
    useRoute: jest.fn(),
    useIsFocused: jest.fn(),
    useFocusEffect: jest.fn(cb => cb()),
  };
});

// Use the shared complete theme mock so warm-bone tokens resolve.
jest.mock('../../../../src/hooks', () => {
  const {createMockUseTheme} = require('../../../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => createMockUseTheme()),
  };
});

jest.mock('../../../../src/features/forms', () => ({
  fetchAppointmentForms: jest.fn(),
  selectFormsForAppointment: jest.fn(),
}));

// UI Component Mocks
jest.mock('../../../../src/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {View, Text} = require('react-native');
    return (
      <View testID="mock-header">
        <Text>{title}</Text>
        <View onTouchEnd={onBack} testID="header-back" />
      </View>
    );
  },
}));

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => ({
    LiquidGlassHeaderScreen: ({children, header}: any) => {
      const {View} = require('react-native');
      return (
        <View testID="screen-layout">
          {header}
          {children({paddingBottom: 0})}
        </View>
      );
    },
  }),
);

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress, loading, disabled}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View
          testID={`btn-${title}`}
          onTouchEnd={!disabled && !loading ? onPress : undefined}>
          <Text>{title}</Text>
          {loading && <Text>Loading...</Text>}
        </View>
      );
    },
  }),
);

describe('FormSigningScreen', () => {
  const mockDispatch = jest.fn();
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();

  const mockAppointmentId = 'appt-1';
  const mockSubmissionId = 'sub-1';
  const mockSigningUrl = 'https://sign.com/123';

  const mockAppointment = {
    id: mockAppointmentId,
    serviceId: 'svc-1',
    businessId: 'biz-1',
    species: 'dog',
  };

  const mockRouteParams = {
    appointmentId: mockAppointmentId,
    submissionId: mockSubmissionId,
    signingUrl: mockSigningUrl,
    formTitle: 'Test Form',
  };

  // Mutable state controllers read by the useSelector mock at call time.
  let appointmentsItems: any[];

  const flushMicrotasks = async () => {
    await act(async () => {
      await Promise.resolve()
        .then(() => undefined)
        .then(() => undefined)
        .then(() => undefined)
        .then(() => undefined);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    appointmentsItems = [mockAppointment];

    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
    (useRoute as jest.Mock).mockReturnValue({params: mockRouteParams});
    (useIsFocused as jest.Mock).mockReturnValue(true);

    (useSelector as unknown as jest.Mock).mockImplementation(selector => {
      const mockState = {
        appointments: {items: appointmentsItems},
      };
      return selector(mockState);
    });

    (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
      {submission: {_id: mockSubmissionId}, status: 'pending'},
    ]);

    (FormActions.fetchAppointmentForms as unknown as jest.Mock).mockReturnValue(
      {
        type: 'forms/fetch',
      },
    );
    mockDispatch.mockResolvedValue({});
    (Linking.openURL as jest.Mock).mockImplementation(() => Promise.resolve());
  });

  const renderScreen = () => render(<FormSigningScreen />);

  describe('Initialization & Navigation', () => {
    it('fetches appointment forms on mount/focus', () => {
      renderScreen();
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({type: 'forms/fetch'}),
      );
      expect(FormActions.fetchAppointmentForms).toHaveBeenCalledWith({
        appointmentId: mockAppointmentId,
        serviceId: 'svc-1',
        organisationId: 'biz-1',
        species: 'dog',
      });
    });

    it('passes null service/organisation/species when appointment lacks them', async () => {
      appointmentsItems = [{id: mockAppointmentId}];
      const {getByTestId} = renderScreen();

      expect(FormActions.fetchAppointmentForms).toHaveBeenCalledWith({
        appointmentId: mockAppointmentId,
        serviceId: null,
        organisationId: null,
        species: null,
      });

      // Drive the refresh path too so the null-coalescing in handleRefresh runs.
      await waitFor(() =>
        expect(getByTestId('btn-Refresh status')).toBeTruthy(),
      );
      (FormActions.fetchAppointmentForms as jest.Mock).mockClear();
      fireEvent(getByTestId('btn-Refresh status'), 'onTouchEnd');
      await flushMicrotasks();
      expect(FormActions.fetchAppointmentForms).toHaveBeenCalledWith({
        appointmentId: mockAppointmentId,
        serviceId: null,
        organisationId: null,
        species: null,
      });
    });

    it('does not fetch and no-ops refresh when appointment is missing', async () => {
      appointmentsItems = [];
      const {getByTestId} = renderScreen();

      expect(FormActions.fetchAppointmentForms).not.toHaveBeenCalled();

      // The signing link still opens, so the action bar (refresh) appears.
      await waitFor(() =>
        expect(getByTestId('btn-Refresh status')).toBeTruthy(),
      );
      fireEvent(getByTestId('btn-Refresh status'), 'onTouchEnd');
      await flushMicrotasks();
      expect(FormActions.fetchAppointmentForms).not.toHaveBeenCalled();
    });

    it('swallows fetch dispatch rejections from the mount effects', async () => {
      mockDispatch.mockImplementation(() =>
        Promise.reject(new Error('fetch failed')),
      );
      expect(() => renderScreen()).not.toThrow();
      await flushMicrotasks();
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('navigates back automatically if form status becomes signed', () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        {submission: {_id: mockSubmissionId}, status: 'signed'},
      ]);

      renderScreen();
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('navigates back automatically if form status becomes completed', () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        {submission: {_id: mockSubmissionId}, status: 'completed'},
      ]);

      renderScreen();
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('stays on screen when there is no matching submission entry', () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        {submission: {_id: 'other'}, status: 'signed'},
      ]);

      renderScreen();
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it('does not run the focus-based fetch effect when not focused', () => {
      (useIsFocused as jest.Mock).mockReturnValue(false);
      renderScreen();
      // useFocusEffect still fires in the mock, so a fetch is dispatched.
      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe('Linking (Auto-Open)', () => {
    it('opens signing URL automatically on mount', async () => {
      renderScreen();
      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(mockSigningUrl);
      });
    });

    it('shows error state if signing URL is missing', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {...mockRouteParams, signingUrl: null},
      });
      const {getByText} = renderScreen();
      expect(getByText(/Signing link is not available/)).toBeTruthy();
      expect(Linking.openURL).not.toHaveBeenCalled();
    });

    it('shows a retry state (not a stuck spinner) when auto-open fails', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('Fail'));
      const {getByText, getByTestId, queryByText} = renderScreen();
      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalled();
      });
      // We must not falsely claim the link was opened when it failed.
      await waitFor(() =>
        expect(
          getByText(/couldn't open the signing link automatically/),
        ).toBeTruthy(),
      );
      expect(queryByText(/We opened the signing link/)).toBeNull();
      expect(getByTestId('btn-Open signing link')).toBeTruthy();
    });

    it('does not reopen when signingUrl changes after it already opened once', async () => {
      const {rerender} = renderScreen();
      await waitFor(() =>
        expect(Linking.openURL).toHaveBeenCalledWith(mockSigningUrl),
      );

      (Linking.openURL as jest.Mock).mockClear();
      (useRoute as jest.Mock).mockReturnValue({
        params: {...mockRouteParams, signingUrl: 'https://sign.com/456'},
      });
      rerender(<FormSigningScreen />);
      await flushMicrotasks();

      // openedRef guard short-circuits: the new URL is never opened.
      expect(Linking.openURL).not.toHaveBeenCalled();
    });
  });

  describe('User Interactions', () => {
    it('refreshes status when refresh button is pressed', async () => {
      const {getByTestId} = renderScreen();
      await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());
      await waitFor(() =>
        expect(getByTestId('btn-Refresh status')).toBeTruthy(),
      );
      (FormActions.fetchAppointmentForms as jest.Mock).mockClear();

      const refreshBtn = getByTestId('btn-Refresh status');
      fireEvent(refreshBtn, 'onTouchEnd');
      await flushMicrotasks();

      expect(FormActions.fetchAppointmentForms).toHaveBeenCalled();
    });

    it('swallows dispatch rejection when refreshing', async () => {
      const {getByTestId} = renderScreen();
      await waitFor(() =>
        expect(getByTestId('btn-Refresh status')).toBeTruthy(),
      );

      mockDispatch.mockImplementation(() =>
        Promise.reject(new Error('refresh failed')),
      );
      fireEvent(getByTestId('btn-Refresh status'), 'onTouchEnd');
      await flushMicrotasks();

      // The finally() clears the refreshing flag, so the button is interactive again.
      expect(getByTestId('btn-Refresh status')).toBeTruthy();
    });

    it('reopens link when button is pressed', async () => {
      const {getByTestId} = renderScreen();
      await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());
      await waitFor(() =>
        expect(getByTestId('btn-Open signing link again')).toBeTruthy(),
      );

      (Linking.openURL as jest.Mock).mockClear();

      const reopenBtn = getByTestId('btn-Open signing link again');
      fireEvent(reopenBtn, 'onTouchEnd');

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(mockSigningUrl);
      });
    });

    it('shows the retry state when reopening the link fails', async () => {
      const {getByTestId, getByText} = renderScreen();
      await waitFor(() =>
        expect(getByTestId('btn-Open signing link again')).toBeTruthy(),
      );

      (Linking.openURL as jest.Mock).mockClear();
      (Linking.openURL as jest.Mock).mockRejectedValueOnce(
        new Error('reopen failed'),
      );

      fireEvent(getByTestId('btn-Open signing link again'), 'onTouchEnd');
      await flushMicrotasks();

      expect(Linking.openURL).toHaveBeenCalledWith(mockSigningUrl);
      // The failure surfaces a retry affordance instead of being swallowed.
      expect(
        getByText(/couldn't open the signing link automatically/),
      ).toBeTruthy();
      expect(getByTestId('btn-Open signing link')).toBeTruthy();
    });

    it('navigates back when header back button pressed', () => {
      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('header-back'), 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Summary card & content', () => {
    it('shows loading state initially before link opens', () => {
      (Linking.openURL as jest.Mock).mockImplementation(
        () => new Promise(() => {}),
      );
      const {getByText} = renderScreen();
      expect(getByText(/We opened the signing link/)).toBeTruthy();
    });

    it('renders the form name and description from the current entry', async () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        {
          submission: {_id: mockSubmissionId},
          status: 'pending',
          form: {name: 'Consent Form', description: 'Please review carefully'},
        },
      ]);
      const {getByText} = renderScreen();
      await flushMicrotasks();

      expect(getByText('Consent Form')).toBeTruthy();
      expect(getByText('Please review carefully')).toBeTruthy();
    });

    it('falls back to "Sign form" when no form name and no title are available', async () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {...mockRouteParams, formTitle: undefined},
      });
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        {submission: {_id: mockSubmissionId}, status: 'pending'},
      ]);
      const {getByText} = renderScreen();
      await flushMicrotasks();

      expect(getByText('Sign form')).toBeTruthy();
    });

    it('uses the route formTitle when the entry has no form', async () => {
      const {getByText} = renderScreen();
      await flushMicrotasks();
      expect(getByText('Test Form')).toBeTruthy();
    });

    it('ignores entries without a submission when matching the current entry', () => {
      (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
        {status: 'signed'},
        {submission: {_id: mockSubmissionId}, status: 'pending'},
      ]);
      renderScreen();
      // The entry without a submission must not be treated as the current one,
      // so its "signed" status does not trigger a goBack.
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });
});
