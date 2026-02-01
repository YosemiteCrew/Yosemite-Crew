import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {ObservationalToolScreen} from '../../../../../src/features/tasks/screens/ObservationalToolScreen/ObservationalToolScreen';
import {useDispatch, useSelector} from 'react-redux';
import {Alert} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {selectTaskById} from '../../../../../src/features/tasks/selectors';
import {selectAuthUser} from '../../../../../src/features/auth/selectors';

// --- Mocks ---

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('../../../../../src/features/appointments/businessesSlice', () => ({
  fetchBusinesses: jest.fn(() => ({type: 'businesses/fetch'})),
}));

// Mock Selectors
jest.mock('../../../../../src/features/tasks/selectors', () => ({
  selectTaskById: jest.fn(),
}));

jest.mock('../../../../../src/features/auth/selectors', () => ({
  selectAuthUser: jest.fn(),
}));

jest.mock('../../../../../src/features/companion', () => ({
  setSelectedCompanion: jest.fn(),
}));

jest.mock(
  '../../../../../src/features/observationalTools/services/observationToolService',
  () => ({
    observationToolApi: {
      get: jest.fn(),
      submit: jest.fn(),
    },
    getCachedObservationTool: jest.fn(),
    getCachedObservationToolName: jest.fn(),
  }),
);

jest.mock(
  '../../../../../src/features/appointments/hooks/useBusinessPhotoFallback',
  () => ({
    useBusinessPhotoFallback: () => ({
      businessFallbacks: {},
      requestBusinessPhoto: jest.fn(),
      handleAvatarError: jest.fn(),
    }),
  }),
);

// Mock Hooks
jest.mock('../../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
        primary: 'blue',
        secondary: 'black',
        cardBackground: 'white',
        error: 'red',
        placeholder: 'gray',
        lightBlueBackground: 'lightblue',
        borderMuted: 'gray',
        neutralShadow: 'black',
        primaryTint: 'blue',
        white: 'white',
        surface: 'white',
      },
      spacing: {
        '1': 4,
        '2': 8,
        '3': 12,
        '4': 16,
        '6': 24,
        '20': 80,
        '24': 96,
        '32': 128,
        '50': 200,
        '60': 240,
      },
      borderRadius: {full: 999, xl: 20, lg: 16, md: 12},
      typography: {
        h3: {},
        paragraph18Bold: {},
        subtitleRegular14: {},
        bodyMedium: {},
        titleSmall: {},
        body12: {},
        labelXxsBold: {},
        captionBoldSatoshi: {},
        h6Clash: {},
        paragraphBold: {},
        body13: {},
        button: {},
        businessSectionTitle20: {},
      },
      shadows: {base: {}, medium: {}},
    },
  }),
}));

// Mock UI Components
jest.mock('../../../../../src/shared/components/common/Header/Header', () => {
  const {View: MockView, Text: MockText} = require('react-native');
  return {
    Header: ({title, onBack}: any) => (
      <MockView testID="mock-header">
        <MockText testID="header-title">{title}</MockText>
        <MockView testID="header-back" onTouchEnd={onBack} />
      </MockView>
    ),
  };
});

jest.mock(
  '../../../../../src/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View: MockView} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({children, header}: any) => (
        <MockView testID="screen-layout">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </MockView>
      ),
    };
  },
);

jest.mock(
  '../../../../../src/shared/components/common/LiquidGlassCard/LiquidGlassCard',
  () => {
    const {View: MockView} = require('react-native');
    return {
      LiquidGlassCard: ({children, style}: any) => (
        <MockView style={style}>{children}</MockView>
      ),
    };
  },
);

jest.mock(
  '../../../../../src/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {View: MockView} = require('react-native');
    return {
      LiquidGlassButton: ({title, onPress, disabled}: any) => (
        <MockView
          testID={`btn-${title}`}
          onTouchEnd={!disabled ? onPress : undefined}
          accessibilityState={{disabled}}
        />
      ),
    };
  },
);

jest.mock(
  '../../../../../src/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet',
  () => {
    // FIX: Renamed local variable to ReactActual to avoid shadowing global 'React'
    const ReactActual = jest.requireActual('react');
    const {View: MockView} = require('react-native');
    return {
      DiscardChangesBottomSheet: ReactActual.forwardRef(
        (props: any, ref: any) => {
          ReactActual.useImperativeHandle(ref, () => ({
            open: () => props.onDiscard && props.onDiscard(),
            close: jest.fn(),
          }));
          return <MockView testID="discard-sheet" />;
        },
      ),
    };
  },
);

jest.spyOn(Alert, 'alert');

describe('ObservationalToolScreen', () => {
  const mockDispatch = jest.fn();
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockReset = jest.fn();
  const mockGetParent = jest.fn();

  const mockTask = {
    id: 'task-123',
    companionId: 'comp-1',
    observationToolId: 'feline-grimace-scale', // Known static ID
    createdBy: 'user-1',
    details: {toolType: 'feline-grimace-scale'},
  };

  const mockCompanion = {
    id: 'comp-1',
    name: 'Whiskers',
    category: 'cat',
    profileImage: 'http://cat.jpg',
  };

  const mockBusinesses = [
    {id: 'biz-1', name: 'Vet Clinic A', address: '123 St', photo: 'url'},
    {id: 'biz-2', name: 'Vet Clinic B', address: '456 Ave'},
  ];

  const mockServices = [
    {
      id: 'svc-1',
      businessId: 'biz-1',
      name: 'Feline Observation',
      specialty: 'Observation',
    },
    {
      id: 'svc-2',
      businessId: 'biz-2',
      name: 'General Vet',
      specialty: 'Observation',
    },
  ];

  const mockUser = {id: 'user-1'};

  // FIX: Robust state object
  const defaultMockState = {
    companion: {companions: [mockCompanion]},
    businesses: {businesses: mockBusinesses, services: mockServices},
    auth: {user: mockUser},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);

    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
      canGoBack: jest.fn(() => true),
      reset: mockReset,
      getParent: mockGetParent,
      getState: jest.fn(() => ({routes: [{}, {}]})),
    });
    mockGetParent.mockReturnValue({navigate: mockNavigate});

    (useRoute as jest.Mock).mockReturnValue({
      params: {taskId: 'task-123'},
    });

    // Mock Selectors
    (selectTaskById as unknown as jest.Mock).mockReturnValue(() => mockTask);
    (selectAuthUser as unknown as jest.Mock).mockReturnValue(mockUser);

    (useSelector as unknown as jest.Mock).mockImplementation(selector => {
      if (selector === selectAuthUser) return mockUser;

      if (typeof selector === 'function') {
        try {
          const res = selector(defaultMockState);
          // If selector returns undefined (e.g. not found), we respect that.
          return res;
        } catch (e) {
          // Fallback if selector logic crashes on mock state
          return undefined;
        }
      }
      return undefined;
    });
  });

  const renderScreen = () => render(<ObservationalToolScreen />);

  describe('Initialization & Loading', () => {
    it('fetches businesses on mount if empty', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectAuthUser) return mockUser;
        if (typeof selector === 'function') {
          try {
            // Check if it's task selector
            const res = selector(defaultMockState);
            if (res === mockTask) return mockTask;
          } catch (e) {}

          // Return empty businesses
          return selector({
            ...defaultMockState,
            businesses: {businesses: [], services: []},
          });
        }
      });

      renderScreen();
      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({type: 'businesses/fetch'}),
        );
      });
    });

    it('shows error if task not found', () => {
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => null);

      const {getByText} = renderScreen();
      expect(getByText('Task not found')).toBeTruthy();
    });
  });

  describe('Navigation & Exit', () => {
    it('shows discard sheet on header back', () => {
      const {getByTestId} = renderScreen();
      const backBtn = getByTestId('header-back');

      fireEvent(backBtn, 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('resets stack if first in history on safe exit', () => {
      (useNavigation as jest.Mock).mockReturnValue({
        getState: () => ({routes: [{name: 'ObservationalTool'}]}),
        reset: mockReset,
        getParent: mockGetParent,
        // FIX: Ensure goBack exists
        goBack: mockGoBack,
        navigate: mockNavigate,
        canGoBack: jest.fn(() => true),
      });
      mockGetParent.mockReturnValue({navigate: mockNavigate});

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('header-back'), 'onTouchEnd');

      expect(mockReset).toHaveBeenCalledWith(
        expect.objectContaining({index: 0}),
      );
      expect(mockNavigate).toHaveBeenCalledWith('HomeStack', expect.anything());
    });
  });
});
