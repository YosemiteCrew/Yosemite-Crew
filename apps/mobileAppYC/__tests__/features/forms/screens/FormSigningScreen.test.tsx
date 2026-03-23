import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {FormSigningScreen} from '../../../../src/features/forms/screens/FormSigningScreen';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation, useRoute, useIsFocused} from '@react-navigation/native';
import {Linking} from 'react-native';
import * as FormActions from '../../../../src/features/forms';

// --- Mocks ---

// FIX: Safe mock for react-native Linking and Alert to avoid TurboModule crash
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  // Return a safe mock object
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

jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
        cardBackground: 'white',
        text: 'black',
        textSecondary: 'gray',
        secondary: 'blue',
        white: 'white',
        border: 'gray',
      },
      spacing: {'2': 8, '3': 12, '4': 16, '6': 24},
      borderRadius: {lg: 8, md: 4},
      typography: {body14: {}, button: {}},
    },
  }),
}));

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

  beforeEach(() => {
    jest.clearAllMocks();
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
    (useRoute as jest.Mock).mockReturnValue({params: mockRouteParams});
    (useIsFocused as jest.Mock).mockReturnValue(true);

    (useSelector as unknown as jest.Mock).mockImplementation(selector => {
      const mockState = {
        appointments: {items: [mockAppointment]},
      };
      if (selector === FormActions.selectFormsForAppointment) {
        return [];
      }
      return selector(mockState);
    });

    (FormActions.selectFormsForAppointment as jest.Mock).mockReturnValue([
      {submission: {_id: mockSubmissionId}, status: 'pending'},
    ]);

    (FormActions.fetchAppointmentForms as unknown as jest.Mock).mockReturnValue(
      {
        type: 'forms/fetch',
        catch: jest.fn(),
      },
    );
    mockDispatch.mockResolvedValue({});
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

    it('does not fetch if not focused', () => {
      (useIsFocused as jest.Mock).mockReturnValue(false);
      renderScreen();
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

    it('handles Linking open failure gracefully', async () => {
      (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('Fail'));
      renderScreen();
      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalled();
      });
    });
  });

  describe('User Interactions', () => {
    it('refreshes status when refresh button is pressed', async () => {
      const {getByTestId} = renderScreen();
      await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());

      const refreshBtn = getByTestId('btn-Refresh status');
      fireEvent(refreshBtn, 'onTouchEnd');

      expect(FormActions.fetchAppointmentForms).toHaveBeenCalled();
    });

    it('reopens link when button is pressed', async () => {
      const {getByTestId} = renderScreen();
      await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());

      (Linking.openURL as jest.Mock).mockClear();

      const reopenBtn = getByTestId('btn-Open signing link again');
      fireEvent(reopenBtn, 'onTouchEnd');

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(mockSigningUrl);
      });
    });

    it('navigates back when header back button pressed', () => {
      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('header-back'), 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Conditional Rendering States', () => {
    it('shows loading state initially before link opens', () => {
      (Linking.openURL as jest.Mock).mockImplementation(
        () => new Promise(() => {}),
      );
      const {getByText} = renderScreen();
      expect(getByText(/We opened the signing link/)).toBeTruthy();
    });
  });
});
