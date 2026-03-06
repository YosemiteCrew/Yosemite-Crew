import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {ReviewScreen} from '../../../../src/features/appointments/screens/ReviewScreen';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {Alert} from 'react-native';
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
}));

jest.mock(
  '../../../../src/features/appointments/services/appointmentsService',
  () => ({
    appointmentApi: {
      rateOrganisation: jest.fn(),
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
      expect(getByText('Clinic Fallback')).toBeTruthy();
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
  });

  describe('Photo Logic (Google Places Fallback)', () => {
    it('uses existing business photo if valid', () => {
      const {getByText} = renderScreen();
      expect(getByText('Has Photo')).toBeTruthy();
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
  });

  describe('Interactions', () => {
    it('updates review text input', () => {
      const {getByPlaceholderText} = renderScreen();
      const input = getByPlaceholderText('Your review');

      fireEvent.changeText(input, 'Great service!');
      expect(input.props.value).toBe('Great service!');
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
  });

  describe('Submission Logic', () => {
    it('submits rating successfully', async () => {
      const {getByTestId} = renderScreen();
      const submitBtn = getByTestId('submit-btn');

      fireEvent(submitBtn, 'onTouchEnd');

      await waitFor(() => {
        expect(getFreshStoredTokens).toHaveBeenCalled();
        expect(appointmentApi.rateOrganisation).toHaveBeenCalledWith({
          organisationId: 'biz-1',
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
        expect(appointmentApi.rateOrganisation).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to submit'),
          expect.any(Error),
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
        expect(appointmentApi.rateOrganisation).not.toHaveBeenCalled();
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it('handles API submission failure', async () => {
      (appointmentApi.rateOrganisation as jest.Mock).mockRejectedValue(
        new Error('API Fail'),
      );

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('submit-btn'), 'onTouchEnd');

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to submit'),
          expect.any(Error),
        );
        expect(mockGoBack).not.toHaveBeenCalled();
      });
    });
  });
});
