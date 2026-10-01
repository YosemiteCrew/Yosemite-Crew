import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {ReviewScreen} from '../../../../src/features/appointments/screens/ReviewScreen';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation, useRoute} from '@react-navigation/native';
import {Alert, Keyboard} from 'react-native';
import {appointmentApi} from '../../../../src/features/appointments/services/appointmentsService';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '../../../../src/features/auth/sessionManager';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '../../../../src/features/linkedBusinesses';
import {fetchBusinesses} from '../../../../src/features/appointments/businessesSlice';

// --- Mocks ---

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock(
  '../../../../src/features/appointments/services/appointmentsService',
  () => ({
    appointmentApi: {
      savePractitionerFeedback: jest.fn(),
    },
  }),
);

jest.mock('../../../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

// Mock Thunks & Actions
jest.mock('../../../../src/features/linkedBusinesses', () => ({
  fetchBusinessDetails: jest.fn(() => ({
    type: 'business/details',
    unwrap: () => Promise.resolve({}),
  })),
  fetchGooglePlacesImage: jest.fn(() => ({
    type: 'business/image',
    unwrap: () => Promise.resolve({}),
  })),
}));

jest.mock('../../../../src/features/appointments/businessesSlice', () => ({
  fetchBusinesses: jest.fn(() => ({type: 'businesses/fetch'})),
}));

// Mock Hooks - CRITICAL FIX: Provide a mock theme to prevent crash in useTheme hook
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
        text: 'black',
        textSecondary: 'gray',
        secondary: 'blue',
        border: 'gray',
        inputBackground: '#f0f0f0',
        error: 'red',
      },
      spacing: {
        '2': 8,
        '3': 12,
        '4': 16,
        '5': 20,
        '6': 24,
        '12': 48,
        '24': 96,
      },
      borderRadius: {
        lg: 8,
      },
      typography: {
        h3: {fontSize: 24, fontWeight: 'bold'},
        body14: {fontSize: 14},
        titleMedium: {fontSize: 16, fontWeight: '500'},
      },
    },
  }),
}));

// Mock UI Components
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
  '../../../../src/shared/components/common/RatingStars/RatingStars',
  () => {
    const {View, Text} = require('react-native');
    return (props: any) => (
      <View testID="rating-stars">
        <Text testID="rating-value">{props.value}</Text>
        <Text onPress={() => props.onChange(5)}>Set Rating 5</Text>
      </View>
    );
  },
);

jest.mock(
  '../../../../src/features/appointments/components/SummaryCards/SummaryCards',
  () => ({
    SummaryCards: ({businessSummary}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View testID="summary-card">
          <Text>{businessSummary.name}</Text>
          <Text>{businessSummary.address}</Text>
          <Text>{businessSummary.photo ? 'Has Photo' : 'No Photo'}</Text>
        </View>
      );
    },
  }),
);

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress, disabled}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View testID="submit-btn" onTouchEnd={!disabled ? onPress : undefined}>
          <Text>{title}</Text>
        </View>
      );
    },
  }),
);

jest.spyOn(Alert, 'alert');
jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('ReviewScreen', () => {
  const mockDispatch = jest.fn();
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();

  const mockState = {
    appointments: {
      items: [
        {
          id: 'appt-1',
          businessId: 'biz-1',
          organisationName: 'Clinic Fallback',
          organisationAddress: 'Address Fallback',
          businessGooglePlacesId: 'gp-1',
          employeeId: 'emp-1',
          employeeName: 'Dr. Smith',
        },
      ],
    },
    businesses: {
      businesses: [
        {
          id: 'biz-1',
          name: 'Vet Clinic',
          address: '123 St',
          googlePlacesId: 'gp-1',
          photo: 'http://photo.jpg',
        },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
      getState: () => ({
        routes: [{params: {appointmentId: 'appt-1'}}],
      }),
    });
    (useRoute as jest.Mock).mockReturnValue({
      params: {appointmentId: 'appt-1'},
    });

    (useSelector as unknown as jest.Mock).mockImplementation(selector =>
      selector(mockState),
    );

    mockDispatch.mockImplementation((action: any) => {
      if (action?.unwrap) return action;
      if (typeof action === 'function')
        return action(mockDispatch, () => mockState, undefined);
      return {unwrap: () => Promise.resolve({})};
    });

    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: Date.now() + 10000,
    });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
  });

  const renderScreen = () => render(<ReviewScreen />);

  describe('Rendering', () => {
    it('renders fallback details if business not found in store', () => {
      const stateNoBusiness = {
        ...mockState,
        businesses: {businesses: []},
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector(stateNoBusiness),
      );

      const {getByText} = renderScreen();
      // Business name is no longer shown as standalone text (design uses the
      // avatar + visit prompt); the fallback business is resolved without crashing.
      expect(getByText('How was your visit with Dr. Smith?')).toBeTruthy();
    });

    it('triggers fetchBusinesses if business is missing but appointment exists', async () => {
      const stateNoBusiness = {
        ...mockState,
        businesses: {businesses: []},
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector(stateNoBusiness),
      );

      renderScreen();

      await waitFor(() => {
        expect(fetchBusinesses).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({type: 'businesses/fetch'}),
        );
      });
    });

    it('logs a failed business fetch instead of leaving it unhandled', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector({...mockState, businesses: {businesses: []}}),
      );
      mockDispatch.mockImplementation((action: any) =>
        action?.type === 'businesses/fetch'
          ? Promise.reject(new Error('businesses failed'))
          : {unwrap: () => Promise.resolve({})},
      );

      renderScreen();

      await waitFor(() =>
        expect(console.warn).toHaveBeenCalledWith(
          '[Background] Task failed',
          expect.stringContaining('Error: businesses failed'),
        ),
      );
    });

    it('renders companion visit prompt and formatted meta line', () => {
      const stateWithCompanion = {
        appointments: {
          items: [
            {
              id: 'appt-1',
              businessId: 'biz-1',
              companionId: 'comp-1',
              organisationName: 'Clinic Fallback',
              organisationAddress: 'Address Fallback',
              businessGooglePlacesId: 'gp-1',
              type: 'Checkup',
              employeeName: 'Dr. Smith',
              date: '2026-07-09',
            },
          ],
        },
        businesses: mockState.businesses,
        companion: {companions: [{id: 'comp-1', name: 'Buddy'}]},
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector(stateWithCompanion),
      );

      const {getByText} = renderScreen();
      // Companion name drives the personalised prompt (ternary + `subjectName`
      // nullish path) and the meta line renders the formatted visit date.
      expect(getByText('How was your visit with Dr. Smith?')).toBeTruthy();
      expect(getByText(/Checkup.*Dr\. Smith/)).toBeTruthy();
    });

    it('renders the meta line when the appointment date is invalid', () => {
      const stateInvalidDate = {
        ...mockState,
        appointments: {
          items: [
            {
              ...mockState.appointments.items[0],
              type: 'Follow-up',
              date: 'not-a-date',
            },
          ],
        },
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector(stateInvalidDate),
      );

      const {getByText} = renderScreen();
      // Invalid date -> formatVisitDate returns '' (NaN guard); the type still
      // renders as the meta line.
      expect(getByText(/Follow-up.*Dr\. Smith/)).toBeTruthy();
    });

    it('prefills saved feedback when opened for editing', () => {
      (useRoute as jest.Mock).mockReturnValue({
        params: {
          appointmentId: 'appt-1',
          isEditing: true,
          existingRating: 2,
          existingReview: 'Please allow more time for questions.',
        },
      });

      const {getByPlaceholderText, getByTestId, getByText} = renderScreen();

      expect(getByTestId('rating-value').props.children).toBe(2);
      expect(getByPlaceholderText('Your review').props.value).toBe(
        'Please allow more time for questions.',
      );
      expect(getByText('Update feedback')).toBeTruthy();
    });

    it('refreshes the form when another appointment opens on the same route', () => {
      const {getByPlaceholderText, getByTestId, rerender} = renderScreen();
      const nextAppointmentState = {
        ...mockState,
        appointments: {
          items: [
            ...mockState.appointments.items,
            {...mockState.appointments.items[0], id: 'appt-2'},
          ],
        },
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector(nextAppointmentState),
      );

      (useRoute as jest.Mock).mockReturnValue({
        params: {
          appointmentId: 'appt-2',
          isEditing: true,
          existingRating: 2,
          existingReview: 'A different completed visit',
        },
      });
      rerender(<ReviewScreen />);

      expect(getByTestId('rating-value').props.children).toBe(2);
      expect(getByPlaceholderText('Your review').props.value).toBe(
        'A different completed visit',
      );
    });
  });

  describe('Photo Logic (Google Places Fallback)', () => {
    it('uses existing business photo if valid', () => {
      renderScreen();
      expect(fetchBusinessDetails).not.toHaveBeenCalled();
    });

    it('fetches business details if photo is missing or dummy', async () => {
      const stateDummyPhoto = {
        ...mockState,
        businesses: {
          businesses: [{...mockState.businesses.businesses[0], photo: null}],
        },
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector(stateDummyPhoto),
      );

      (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
        unwrap: () => Promise.resolve({photoUrl: 'http://new.jpg'}),
      });

      renderScreen();

      await waitFor(() => {
        expect(fetchBusinessDetails).toHaveBeenCalledWith('gp-1');
      });
    });

    it('fetches google places image if details fetch fails', async () => {
      const stateDummyPhoto = {
        ...mockState,
        businesses: {
          businesses: [{...mockState.businesses.businesses[0], photo: null}],
        },
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector(stateDummyPhoto),
      );

      (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
        unwrap: () => Promise.reject('Fail'),
      });
      (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
        unwrap: () => Promise.resolve({photoUrl: 'http://google.jpg'}),
      });

      renderScreen();

      await waitFor(() => {
        expect(fetchGooglePlacesImage).toHaveBeenCalledWith('gp-1');
      });
    });

    it('does not set a fallback photo when the google image lacks a url', async () => {
      const stateDummyPhoto = {
        ...mockState,
        businesses: {
          businesses: [{...mockState.businesses.businesses[0], photo: null}],
        },
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector(stateDummyPhoto),
      );

      (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
        unwrap: () => Promise.reject('Fail'),
      });
      (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
        unwrap: () => Promise.resolve({}),
      });

      renderScreen();

      // Image resolves without a photoUrl -> the `if (img.photoUrl)` guard
      // takes its false path.
      await waitFor(() => {
        expect(fetchGooglePlacesImage).toHaveBeenCalledWith('gp-1');
      });
    });

    it('swallows the error when the google image fetch also fails', async () => {
      const stateDummyPhoto = {
        ...mockState,
        businesses: {
          businesses: [{...mockState.businesses.businesses[0], photo: null}],
        },
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector(stateDummyPhoto),
      );

      (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
        unwrap: () => Promise.reject('Fail'),
      });
      (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
        unwrap: () => Promise.reject('Fail again'),
      });

      renderScreen();

      // Both fetches reject -> the inner `.catch(() => {})` runs without throwing.
      await waitFor(() => {
        expect(fetchGooglePlacesImage).toHaveBeenCalledWith('gp-1');
      });
    });
  });

  describe('Interactions', () => {
    it('updates review text input', () => {
      const {getByPlaceholderText} = renderScreen();
      const input = getByPlaceholderText('Your review');

      fireEvent.changeText(input, 'Great service!');
      expect(input.props.value).toBe('Great service!');
    });

    it('limits the review to the length the server accepts', () => {
      const {getByPlaceholderText} = renderScreen();
      expect(getByPlaceholderText('Your review').props.maxLength).toBe(1000);
    });

    it('updates rating when stars pressed', () => {
      const {getByText} = renderScreen();
      const setRatingText = getByText('Set Rating 5');
      fireEvent.press(setRatingText);
    });

    it('navigates back when header back button pressed', () => {
      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('header-back'), 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('dismisses the keyboard when submit editing is triggered', () => {
      const dismissSpy = jest
        .spyOn(Keyboard, 'dismiss')
        .mockImplementation(() => {});
      const {getByPlaceholderText} = renderScreen();
      fireEvent(getByPlaceholderText('Your review'), 'submitEditing');

      expect(dismissSpy).toHaveBeenCalled();
      dismissSpy.mockRestore();
    });
  });

  describe('Submission Logic', () => {
    it('submits rating successfully', async () => {
      const {getByTestId} = renderScreen();
      const submitBtn = getByTestId('submit-btn');

      fireEvent(submitBtn, 'onTouchEnd');

      await waitFor(() => {
        expect(getFreshStoredTokens).toHaveBeenCalled();
        expect(appointmentApi.savePractitionerFeedback).toHaveBeenCalledWith({
          appointmentId: 'appt-1',
          rating: 4,
          review: '',
          accessToken: 'valid-token',
        });
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it('handles session expiry (token check fails)', async () => {
      (isTokenExpired as jest.Mock).mockReturnValue(true);

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('submit-btn'), 'onTouchEnd');

      await waitFor(() => {
        expect(appointmentApi.savePractitionerFeedback).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to submit'),
          expect.any(String),
        );
        // The user must see this, not just the developer console.
        expect(Alert.alert).toHaveBeenCalledWith(
          'Review not submitted',
          'Session expired. Please sign in again.',
        );
      });
    });

    it('handles missing organisation ID (navigates back)', async () => {
      const stateEmpty = {
        appointments: {items: []},
        businesses: {businesses: []},
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selector =>
        selector(stateEmpty),
      );

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('submit-btn'), 'onTouchEnd');

      await waitFor(() => {
        expect(appointmentApi.savePractitionerFeedback).not.toHaveBeenCalled();
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it('handles API submission failure', async () => {
      (appointmentApi.savePractitionerFeedback as jest.Mock).mockRejectedValue(
        Object.assign(new Error('API Fail'), {
          config: {
            method: 'put',
            url: '/v1/organisation-rating/appointment/apt-1/practitioner-feedback',
            headers: {Authorization: 'Bearer secret-token'},
            data: '{"rating":4,"review":"Private review text"}',
          },
          response: {status: 500},
        }),
      );

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('submit-btn'), 'onTouchEnd');

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to submit'),
          expect.any(String),
        );
        expect(mockGoBack).not.toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith(
          'Review not submitted',
          'API Fail',
        );
        const logged = JSON.stringify((console.warn as jest.Mock).mock.calls);
        expect(logged).not.toContain('secret-token');
        expect(logged).not.toContain('Private review text');
      });
    });

    it('falls back to a generic message when the rejection has no message', async () => {
      (appointmentApi.savePractitionerFeedback as jest.Mock).mockRejectedValue(
        {},
      );

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('submit-btn'), 'onTouchEnd');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Review not submitted',
          'Unable to submit your review. Please try again.',
        );
      });
    });

    it('submits when the token has no expiry (undefined fallback)', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({
        accessToken: 'valid-token',
        expiresAt: null,
      });
      (isTokenExpired as jest.Mock).mockReturnValue(false);

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('submit-btn'), 'onTouchEnd');

      // Null expiry exercises the `tokens?.expiresAt ?? undefined` fallback.
      await waitFor(() => {
        expect(isTokenExpired).toHaveBeenCalledWith(undefined);
        expect(appointmentApi.savePractitionerFeedback).toHaveBeenCalled();
      });
    });

    it('treats a missing access token as a session failure', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue(null);

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('submit-btn'), 'onTouchEnd');

      // `!tokens?.accessToken` short-circuits the guard before isTokenExpired.
      await waitFor(() => {
        expect(isTokenExpired).not.toHaveBeenCalled();
        expect(appointmentApi.savePractitionerFeedback).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to submit'),
          expect.any(String),
        );
      });
    });
  });
});
