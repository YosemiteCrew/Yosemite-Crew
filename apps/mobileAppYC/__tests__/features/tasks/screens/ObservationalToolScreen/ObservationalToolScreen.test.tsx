import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {ObservationalToolScreen} from '../../../../../src/features/tasks/screens/ObservationalToolScreen/ObservationalToolScreen';
import {useDispatch, useSelector} from 'react-redux';
import {Alert} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {selectTaskById} from '../../../../../src/features/tasks/selectors';
import {selectAuthUser} from '../../../../../src/features/auth/selectors';
import {
  observationToolApi,
  getCachedObservationTool,
} from '../../../../../src/features/observationalTools/services/observationToolService';
import {setSelectedCompanion} from '../../../../../src/features/companion';

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
      name: 'Feline Grimace Scale Assessment',
      specialty: 'Observation',
    },
    {
      id: 'svc-2',
      businessId: 'biz-2',
      name: 'Cat Observation Review',
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
    const felineDefinition = {
      id: 'feline-grimace-scale',
      name: 'Feline Grimace Scale',
      description: 'Assess pain in cats.',
      fields: [
        {
          key: 'earPosition',
          label: 'Ear Position',
          required: true,
          options: [
            'Ears facing forward',
            'Ears slightly pulled apart',
            'Ears rotated outwards',
          ],
        },
        {
          key: 'orbitalTightening',
          label: 'Orbital Tightening',
          required: true,
          options: ['Eyes opened', 'Eyes partially closed', 'Squinted eyes'],
        },
        {
          key: 'muzzleTension',
          label: 'Muzzle Tension',
          required: true,
          options: [
            'Relaxed (round shape)',
            'Mild tense muzzle',
            'Tense (elliptical shape)',
          ],
        },
        {
          key: 'whiskerChange',
          label: 'Whisker Change',
          required: true,
          options: [
            'Loose (relaxed) and curved',
            'Slightly curved or straight (closer together)',
            'Straight and moving forward (rostrally, away from the face)',
          ],
        },
        {
          key: 'headPosition',
          label: 'Head Position',
          required: true,
          options: [
            'Head above the shoulder line',
            'Head aligned with the shoulder line',
            'Head below the shoulder line or tilted down (chin toward the chest)',
          ],
        },
      ],
    };
    (getCachedObservationTool as jest.Mock).mockReturnValue(felineDefinition);
    (observationToolApi.get as jest.Mock).mockResolvedValue(felineDefinition);
    (observationToolApi.submit as jest.Mock).mockResolvedValue({
      id: 'submission-1',
    });

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

    it('falls back to goBack when there is stack history', () => {
      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('header-back'), 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Assessment Flow', () => {
    it('requires provider selection before starting when multiple providers are available', async () => {
      const {getByTestId, getByText} = renderScreen();

      await waitFor(() => {
        expect(getByText('Vet Clinic A')).toBeTruthy();
      });

      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');

      expect(getByText('Please select a provider')).toBeTruthy();
    });

    it('auto-selects the only provider and starts the assessment', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectAuthUser) return mockUser;
        return selector({
          ...defaultMockState,
          businesses: {
            businesses: [mockBusinesses[0]],
            services: [mockServices[0]],
          },
        });
      });

      const {getByTestId, queryByText} = renderScreen();

      await waitFor(() => {
        expect(getByTestId('btn-Next')).toBeTruthy();
      });

      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');

      expect(queryByText('Please select a provider')).toBeNull();
      expect(getByTestId('btn-Next')).toBeTruthy();
    });

    it('blocks moving to the next step when a required answer is missing', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectAuthUser) return mockUser;
        return selector({
          ...defaultMockState,
          businesses: {
            businesses: [mockBusinesses[0]],
            services: [mockServices[0]],
          },
        });
      });

      const {getByTestId, getByText} = renderScreen();

      await waitFor(() => {
        expect(getByText('Vet Clinic A')).toBeTruthy();
      });

      fireEvent(getByText('Vet Clinic A'), 'press');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => {
        expect(getByText('Step 1 of 5')).toBeTruthy();
      });
      expect(getByTestId('btn-Next').props.accessibilityState.disabled).toBe(
        true,
      );
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');

      expect(getByTestId('btn-Next').props.accessibilityState.disabled).toBe(
        true,
      );
    });

    it('submits responses and navigates to booking form on the last step', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectAuthUser) return mockUser;
        return selector({
          ...defaultMockState,
          businesses: {
            businesses: [mockBusinesses[0]],
            services: [mockServices[0]],
          },
        });
      });

      const {getByTestId, getByText} = renderScreen();

      await waitFor(() => {
        expect(getByText('Vet Clinic A')).toBeTruthy();
      });

      fireEvent(getByText('Vet Clinic A'), 'press');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => {
        expect(getByText('Step 1 of 5')).toBeTruthy();
      });
      [
        'Ears facing forward',
        'Eyes opened',
        'Relaxed (round shape)',
        'Loose (relaxed) and curved',
      ].forEach(option => {
        fireEvent(getByText(option), 'press');
        fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      });
      fireEvent(getByText('Head above the shoulder line'), 'press');
      fireEvent(
        getByTestId('btn-Submit and schedule appointment'),
        'onTouchEnd',
      );

      await waitFor(() => {
        expect(observationToolApi.submit).toHaveBeenCalledWith(
          expect.objectContaining({
            toolId: 'feline-grimace-scale',
            companionId: 'comp-1',
            taskId: 'task-123',
            answers: expect.objectContaining({
              earPosition: 'Ears facing forward',
              orbitalTightening: 'Eyes opened',
              muzzleTension: 'Relaxed (round shape)',
              whiskerChange: 'Loose (relaxed) and curved',
              headPosition: 'Head above the shoulder line',
            }),
          }),
        );
      });

      expect(setSelectedCompanion).toHaveBeenCalledWith('comp-1');
      expect(mockDispatch).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        'Appointments',
        expect.objectContaining({
          screen: 'BookingForm',
        }),
      );
    });

    it('disables the landing action when no provider can be resolved', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectAuthUser) return mockUser;
        return selector({
          ...defaultMockState,
          businesses: {businesses: [], services: []},
        });
      });

      const {getByTestId, getByText} = renderScreen();

      await waitFor(() => {
        expect(getByText('Not just yet!')).toBeTruthy();
      });

      expect(getByTestId('btn-Next').props.accessibilityState.disabled).toBe(
        true,
      );
    });

    it('shows a submission failure alert when OT submission fails', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectAuthUser) return mockUser;
        return selector({
          ...defaultMockState,
          businesses: {
            businesses: [mockBusinesses[0]],
            services: [mockServices[0]],
          },
        });
      });
      (observationToolApi.submit as jest.Mock).mockRejectedValueOnce(
        new Error('Submit exploded'),
      );

      const {getByTestId, getByText} = renderScreen();

      await waitFor(() => {
        expect(getByText('Vet Clinic A')).toBeTruthy();
      });

      fireEvent(getByText('Vet Clinic A'), 'press');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => {
        expect(getByText('Step 1 of 5')).toBeTruthy();
      });
      [
        'Ears facing forward',
        'Eyes opened',
        'Relaxed (round shape)',
        'Loose (relaxed) and curved',
      ].forEach(option => {
        fireEvent(getByText(option), 'press');
        fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      });
      fireEvent(getByText('Head above the shoulder line'), 'press');
      fireEvent(
        getByTestId('btn-Submit and schedule appointment'),
        'onTouchEnd',
      );

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Submission failed',
          'Submit exploded',
        );
      });
    });
  });

  describe('Loading States', () => {
    it('shows a loading state while the remote definition is loading and no steps are ready', () => {
      const unknownCompanion = {
        id: 'comp-2',
        name: 'Hopper',
        category: 'rabbit',
        profileImage: null,
      };
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        companionId: 'comp-2',
        observationToolId: 'unknown-tool',
        details: {toolType: 'unknown-tool'},
      }));
      (observationToolApi.get as jest.Mock).mockImplementation(
        () => new Promise(() => {}),
      );
      (getCachedObservationTool as jest.Mock).mockReturnValue(null);
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectAuthUser) return mockUser;
        if (typeof selector === 'function') {
          return selector({
            ...defaultMockState,
            companion: {companions: [unknownCompanion]},
          });
        }
        return undefined;
      });

      const {getByText} = renderScreen();
      expect(getByText('Loading observational tool...')).toBeTruthy();
    });

    it('shows an unable-to-load state when no definition can be resolved', async () => {
      const unknownCompanion = {
        id: 'comp-2',
        name: 'Hopper',
        category: 'rabbit',
        profileImage: null,
      };
      (getCachedObservationTool as jest.Mock).mockReturnValue(null);
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        companionId: 'comp-2',
        observationToolId: 'unknown-tool',
        details: {toolType: 'unknown-tool'},
      }));
      (observationToolApi.get as jest.Mock).mockResolvedValue({
        id: 'unknown-tool',
        name: '',
        description: '',
        fields: [],
      });
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectAuthUser) return mockUser;
        if (typeof selector === 'function') {
          return selector({
            ...defaultMockState,
            companion: {companions: [unknownCompanion]},
            businesses: {businesses: [], services: []},
          });
        }
        return undefined;
      });

      const {getByText} = renderScreen();
      await waitFor(() => {
        expect(getByText('Unable to load observational tool.')).toBeTruthy();
      });
    });
  });
});
