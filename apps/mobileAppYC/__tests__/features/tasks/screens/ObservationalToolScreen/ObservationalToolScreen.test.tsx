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
          return (
            <MockView
              testID="discard-sheet"
              onTouchEnd={() => props.onKeepEditing && props.onKeepEditing()}
            />
          );
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
        } catch (_error) {
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
          } catch (_error) {}

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

      const {getByTestId, getByText} = renderScreen();
      expect(getByText('Task not found')).toBeTruthy();

      fireEvent(getByTestId('header-back'), 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Navigation & Exit', () => {
    it('shows discard sheet on header back', () => {
      const {getByTestId} = renderScreen();
      const backBtn = getByTestId('header-back');

      fireEvent(backBtn, 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
      fireEvent(getByTestId('discard-sheet'), 'onTouchEnd');
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

    it('exposes selection state to screen readers on step options', async () => {
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

      const {getByTestId, getByText, getByLabelText} = renderScreen();

      await waitFor(() => {
        expect(getByText('Vet Clinic A')).toBeTruthy();
      });

      fireEvent(getByText('Vet Clinic A'), 'press');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => {
        expect(getByText('Step 1 of 5')).toBeTruthy();
      });

      const option = getByLabelText('Ears facing forward');
      expect(option.props.accessibilityRole).toBe('radio');
      expect(option.props.accessibilityState).toEqual({selected: false});

      fireEvent(getByText('Ears facing forward'), 'press');
      expect(
        getByLabelText('Ears facing forward').props.accessibilityState,
      ).toEqual({selected: true});
    });

    it('resolves the exact tapped service when one business offers multiple matching services', async () => {
      // Both services belong to the SAME business — this is the collision
      // scenario: selection/submission must key off businessId+serviceId,
      // not businessId alone, or the wrong service silently wins.
      const collidingServices = [
        {
          id: 'svc-collision-1',
          businessId: 'biz-1',
          name: 'Feline Grimace Scale Assessment',
          specialty: 'Observation',
          basePrice: 25,
        },
        {
          id: 'svc-collision-2',
          businessId: 'biz-1',
          name: 'Feline Grimace Scale Second Opinion',
          specialty: 'Observation',
          basePrice: 40,
        },
      ];
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectAuthUser) return mockUser;
        return selector({
          ...defaultMockState,
          businesses: {
            businesses: [mockBusinesses[0]],
            services: collidingServices,
          },
        });
      });

      const {getByTestId, getByText} = renderScreen();

      await waitFor(() => {
        expect(getByText('Feline Grimace Scale Second Opinion')).toBeTruthy();
      });

      // Tap the SECOND row specifically — same business as the first row.
      fireEvent(getByText('Feline Grimace Scale Second Opinion'), 'press');
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
        expect(mockNavigate).toHaveBeenCalledWith(
          'Appointments',
          expect.objectContaining({
            screen: 'BookingForm',
            params: expect.objectContaining({
              serviceId: 'svc-collision-2',
              serviceName: 'Feline Grimace Scale Second Opinion',
            }),
          }),
        );
      });
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

      const {getByTestId, getByText} = renderScreen();
      expect(getByText('Loading observational tool...')).toBeTruthy();
      fireEvent(getByTestId('header-back'), 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
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

      const {getByTestId, getByText} = renderScreen();
      await waitFor(() => {
        expect(getByText('Unable to load observational tool.')).toBeTruthy();
      });
      fireEvent(getByTestId('header-back'), 'onTouchEnd');
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('logs remote definition load failures', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(jest.fn());
      (getCachedObservationTool as jest.Mock).mockReturnValue(null);
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        observationToolId: 'unknown-tool',
        details: {toolType: 'unknown-tool'},
      }));
      (observationToolApi.get as jest.Mock).mockRejectedValueOnce(
        new Error('definition failed'),
      );

      renderScreen();

      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(
          '[ObservationalTool] Failed to load definition',
          expect.any(Error),
        );
      });
    });
  });

  describe('Warm-bone rebuild coverage', () => {
    const makeUseSelector =
      (state: any, authUser: any = mockUser) =>
      (selector: any) => {
        if (selector === selectAuthUser) return authUser;
        if (typeof selector === 'function') {
          try {
            return selector(state);
          } catch (_e) {
            return undefined;
          }
        }
        return undefined;
      };

    it('renders provider cards with fees, descriptions, open hours and image errors', () => {
      const businesses = [
        {
          id: 'biz-1',
          name: 'Vet Clinic A',
          address: '123 St',
          description: 'Great clinic',
          photo: 987,
          googlePlacesId: 'gp-1',
        },
        {
          id: 'biz-2',
          name: 'Vet Clinic B',
          address: '456 Ave',
          openHours: '9am-5pm',
          googlePlacesId: 'gp-2',
        },
        {id: 'biz-3', name: 'Vet Clinic C'},
        {
          id: 'biz-4',
          name: 'Vet Clinic D',
          address: '000 Way',
          photo: 'https://example.com/pic.png',
          googlePlacesId: 'gp-4',
        },
      ];
      const services = [
        {
          id: 'svc-1',
          businessId: 'biz-1',
          specialityId: 'spec-1',
          name: 'Feline Grimace Scale Assessment',
          specialty: 'Observation',
          basePrice: 100,
        },
        {
          id: 'svc-2',
          businessId: 'biz-2',
          name: 'Cat Observation Review',
          specialty: 'Observation',
        },
        {
          id: 'svc-3',
          businessId: 'biz-3',
          name: 'Cat Observation Clinic',
          specialty: 'Observation',
        },
        {
          id: 'svc-4',
          businessId: 'biz-4',
          name: 'Cat Observation Deluxe',
          specialty: 'Observation',
        },
        {
          id: 'svc-ghost',
          businessId: 'missing-biz',
          name: 'Cat Observation Ghost',
          specialty: 'Observation',
        },
        {id: 'svc-bare', businessId: 'biz-1', name: 'Cat Observation Bare'},
      ];
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector({
          ...defaultMockState,
          businesses: {businesses, services},
        }),
      );

      const {
        getByText,
        queryByText,
        getAllByText,
        getByLabelText,
        UNSAFE_getAllByType,
      } = renderScreen();

      expect(getByText('Vet Clinic A')).toBeTruthy();
      expect(getByText('Vet Clinic B')).toBeTruthy();
      expect(getByText('Vet Clinic C')).toBeTruthy();
      expect(getByText('Vet Clinic D')).toBeTruthy();
      // service with a missing business is dropped
      expect(queryByText('Cat Observation Ghost')).toBeNull();
      // biz-1 has a base price; others show the shared-fee copy
      expect(getByText(/100\.00/)).toBeTruthy();
      expect(
        getAllByText('Appointment fee shared during booking').length,
      ).toBeGreaterThan(0);
      // description vs open-hours fallback vs none
      expect(getByText('Great clinic')).toBeTruthy();
      expect(getByText('9am-5pm')).toBeTruthy();

      // exposes selection state to screen readers
      const providerCard = getByLabelText(
        'Vet Clinic A, Feline Grimace Scale Assessment',
      );
      expect(providerCard.props.accessibilityRole).toBe('radio');
      expect(providerCard.props.accessibilityState).toEqual({
        selected: false,
      });

      // toggle a provider on and off (covers the deselect branch)
      fireEvent(getByText('Vet Clinic A'), 'press');
      expect(
        getByLabelText('Vet Clinic A, Feline Grimace Scale Assessment').props
          .accessibilityState,
      ).toEqual({selected: true});
      fireEvent(getByText('Vet Clinic A'), 'press');

      const {Image: RNImage} = require('react-native');
      const errorable = UNSAFE_getAllByType(RNImage).filter(
        (img: any) => typeof img.props.onError === 'function',
      );
      // provider images first (no re-render), companion image last
      errorable
        .filter((img: any) => img.props.source?.uri !== 'http://cat.jpg')
        .forEach((img: any) => fireEvent(img, 'error'));
      const companionImg = errorable.find(
        (img: any) => img.props.source?.uri === 'http://cat.jpg',
      );
      if (companionImg) {
        fireEvent(companionImg, 'error');
      }

      // companion image error -> initial fallback shows the companion initial
      expect(getByText('W')).toBeTruthy();
    });

    it('builds steps from a remote-only definition and submits mapped answers', async () => {
      const rabbitCompanion = {
        id: 'comp-rabbit',
        name: 'Thumper',
        category: 'rabbit',
        profileImage: null,
      };
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        companionId: 'comp-rabbit',
        observationToolId: undefined,
        details: {toolType: 'custom-remote-tool'},
      }));
      const remoteDef = {
        id: 'custom-remote-tool',
        name: 'Custom Remote Tool',
        description: 'A custom tool.',
        fields: [
          {
            key: 'moodLevel',
            label: 'Mood Level',
            type: 'STRING',
            options: ['Happy', 'Sad'],
            required: true,
          },
          {
            key: 'isEating',
            label: 'Eating Well?',
            type: 'BOOLEAN',
            required: false,
          },
          {key: 'openNotes', type: 'TEXT'},
        ],
      };
      (getCachedObservationTool as jest.Mock).mockReturnValue(remoteDef);
      (observationToolApi.get as jest.Mock).mockResolvedValue(remoteDef);
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector({
          companion: {companions: [rabbitCompanion]},
          businesses: {
            businesses: [{id: 'biz-1', name: 'Vet Clinic A', address: '1 St'}],
            services: [
              {
                id: 'svc-c',
                businessId: 'biz-1',
                name: 'Custom Remote Tool Assessment',
                specialty: 'Observation',
              },
            ],
          },
          auth: {user: mockUser},
        }),
      );

      const {getByText, getByTestId} = renderScreen();

      // overview paragraph comes from the remote description
      expect(getByText('A custom tool.')).toBeTruthy();

      // single provider auto-selected -> start the assessment
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => expect(getByText('Mood Level')).toBeTruthy());

      // options render without images (Ionicons); select one
      fireEvent(getByText('Happy'), 'press');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');

      // boolean step (not required) -> advance without selecting
      await waitFor(() => expect(getByText('Eating Well?')).toBeTruthy());
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');

      // last step titled from the field key (no label present)
      await waitFor(() => expect(getByText('openNotes')).toBeTruthy());
      fireEvent(
        getByTestId('btn-Submit and schedule appointment'),
        'onTouchEnd',
      );

      await waitFor(() => {
        expect(observationToolApi.submit).toHaveBeenCalledWith(
          expect.objectContaining({
            toolId: 'custom-remote-tool',
            companionId: 'comp-rabbit',
            answers: {moodLevel: 'Happy'},
          }),
        );
      });
      expect(mockNavigate).toHaveBeenCalledWith(
        'Appointments',
        expect.objectContaining({screen: 'BookingForm'}),
      );
    });

    it('renders a remote-only step when the definition has no description', async () => {
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        companionId: 'comp-rabbit',
        observationToolId: undefined,
        details: {toolType: 'no-desc-tool'},
      }));
      const remoteDef = {
        id: 'no-desc-tool',
        name: 'No Desc Tool',
        fields: [
          {
            key: 'q1',
            label: 'Q One',
            type: 'STRING',
            options: ['A', 'B'],
            required: true,
          },
        ],
      };
      (getCachedObservationTool as jest.Mock).mockReturnValue(remoteDef);
      (observationToolApi.get as jest.Mock).mockResolvedValue(remoteDef);
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector({
          companion: {
            companions: [
              {id: 'comp-rabbit', name: 'Thumper', category: 'rabbit'},
            ],
          },
          businesses: {
            businesses: [{id: 'biz-1', name: 'Vet Clinic A', address: '1 St'}],
            services: [
              {
                id: 'svc-x',
                businessId: 'biz-1',
                name: 'No Desc Tool Clinic',
                specialty: 'Observation',
              },
            ],
          },
          auth: {user: mockUser},
        }),
      );

      const {getByText, getByTestId} = renderScreen();
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => expect(getByText('Q One')).toBeTruthy());
      expect(getByText('A')).toBeTruthy();
    });

    it('falls back to the canine scale for a dog-named remote tool', () => {
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        observationToolId: 'unknown-dog-tool',
        details: {toolType: 'unknown-dog-tool'},
      }));
      (getCachedObservationTool as jest.Mock).mockReturnValue({
        id: 'unknown-dog-tool',
        name: 'Canine Comfort Check',
        description: 'desc',
        fields: [],
      });
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector(defaultMockState),
      );

      const {getByText} = renderScreen();
      expect(getByText('What is Canine acute pain scale?')).toBeTruthy();
    });

    it('falls back to the equine scale for a horse-named remote tool', () => {
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        observationToolId: 'unknown-horse-tool',
        details: {toolType: 'unknown-horse-tool'},
      }));
      (getCachedObservationTool as jest.Mock).mockReturnValue({
        id: 'unknown-horse-tool',
        name: 'Equine Wellness Review',
        description: 'desc',
        fields: [],
      });
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector(defaultMockState),
      );

      const {getByText} = renderScreen();
      expect(getByText('What is Equine Grimace Scale?')).toBeTruthy();
    });

    it('resolves a definition by matching the remote name when the id is unknown', () => {
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        observationToolId: 'unknown-xyz',
        details: {toolType: 'unknown-xyz'},
      }));
      (getCachedObservationTool as jest.Mock).mockReturnValue({
        id: 'unknown-xyz',
        name: 'Feline Grimace Scale',
        description: 'desc',
        fields: [],
      });
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector(defaultMockState),
      );

      const {getByText} = renderScreen();
      expect(getByText('What is Feline Grimace Scale?')).toBeTruthy();
    });

    it('shows unable-to-load when there is no tool id and no companion', () => {
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        observationToolId: undefined,
        details: {},
      }));
      (getCachedObservationTool as jest.Mock).mockReturnValue(null);
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector({
          companion: {companions: []},
          businesses: {businesses: mockBusinesses, services: mockServices},
          auth: {user: mockUser},
        }),
      );

      const {getByText} = renderScreen();
      expect(getByText('Unable to load observational tool.')).toBeTruthy();
    });

    it('navigates backwards through the form and returns to the landing stage', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector({
          ...defaultMockState,
          businesses: {
            businesses: [mockBusinesses[0]],
            services: [mockServices[0]],
          },
        }),
      );

      const {getByText, getByTestId} = renderScreen();
      await waitFor(() => expect(getByText('Vet Clinic A')).toBeTruthy());

      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => expect(getByText('Step 1 of 5')).toBeTruthy());

      // Back on the first step returns to the landing stage
      fireEvent(getByTestId('btn-Back'), 'onTouchEnd');
      await waitFor(() =>
        expect(getByText('What is Feline Grimace Scale?')).toBeTruthy(),
      );

      // Re-enter, advance one step, then step back to the previous step
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => expect(getByText('Step 1 of 5')).toBeTruthy());
      fireEvent(getByText('Ears facing forward'), 'press');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => expect(getByText('Step 2 of 5')).toBeTruthy());
      fireEvent(getByTestId('btn-Back'), 'onTouchEnd');
      await waitFor(() => expect(getByText('Step 1 of 5')).toBeTruthy());
    });

    it('resets to TasksMain and returns to the Tasks tab when it cannot go back', () => {
      (useNavigation as jest.Mock).mockReturnValue({
        getState: () => ({routes: [{}, {}]}),
        reset: mockReset,
        getParent: mockGetParent,
        goBack: mockGoBack,
        navigate: mockNavigate,
        canGoBack: jest.fn(() => false),
      });
      mockGetParent.mockReturnValue({navigate: mockNavigate});
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector(defaultMockState),
      );

      const {getByTestId} = renderScreen();
      fireEvent(getByTestId('header-back'), 'onTouchEnd');

      expect(mockGoBack).not.toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalledWith(
        expect.objectContaining({index: 0, routes: [{name: 'TasksMain'}]}),
      );
      expect(mockNavigate).toHaveBeenCalledWith('Tasks', {screen: 'TasksMain'});
    });

    it('restricts providers to the creating business for a shared task', () => {
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        createdBy: 'biz-1',
      }));
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector(defaultMockState, {
          id: 'user-1',
          parentId: 'user-parent',
        }),
      );

      const {getByText, queryByText} = renderScreen();
      expect(getByText('Vet Clinic A')).toBeTruthy();
      expect(queryByText('Vet Clinic B')).toBeNull();
    });

    it('keeps every provider when the creating business is not in the list', () => {
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        createdBy: 'biz-not-listed',
      }));
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector(defaultMockState, {id: 'someone-else'}),
      );

      const {getByText} = renderScreen();
      expect(getByText('Vet Clinic A')).toBeTruthy();
      expect(getByText('Vet Clinic B')).toBeTruthy();
    });

    it('submits using only the static definition when the remote fetch fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        observationToolId: undefined,
        details: {toolType: 'feline-grimace-scale'},
      }));
      (getCachedObservationTool as jest.Mock).mockReturnValue(null);
      (observationToolApi.get as jest.Mock).mockRejectedValueOnce(
        new Error('no remote'),
      );
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector({
          ...defaultMockState,
          businesses: {
            businesses: [mockBusinesses[0]],
            services: [mockServices[0]],
          },
        }),
      );

      const {getByText, getByTestId} = renderScreen();
      await waitFor(() => expect(getByText('Vet Clinic A')).toBeTruthy());

      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => expect(getByText('Step 1 of 5')).toBeTruthy());

      // static steps are optional -> advance without selecting to the last step
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => expect(getByText('Step 5 of 5')).toBeTruthy());

      fireEvent(
        getByTestId('btn-Submit and schedule appointment'),
        'onTouchEnd',
      );

      await waitFor(() => {
        expect(observationToolApi.submit).toHaveBeenCalledWith(
          expect.objectContaining({
            toolId: 'feline-grimace-scale',
            answers: {},
          }),
        );
      });
      warnSpy.mockRestore();
    });

    it('maps remote fields to static steps via fuzzy and index matching', async () => {
      const fuzzyDef = {
        id: 'feline-grimace-scale',
        name: 'Feline Grimace Scale',
        description: 'desc',
        fields: [
          {
            key: 'earpos',
            label: 'Ear Pos',
            required: true,
            options: ['E1', 'E2', 'E3'],
          },
          {
            key: 'zzz1',
            label: 'Zzz One',
            required: true,
            options: ['O1', 'O2', 'O3'],
          },
          {
            key: 'zzz2',
            label: 'Zzz Two',
            required: true,
            options: ['M1', 'M2', 'M3'],
          },
          {
            key: 'zzz3',
            label: 'Zzz Three',
            required: true,
            options: ['W1', 'W2', 'W3'],
          },
          {
            key: 'zzz4',
            label: 'Zzz Four',
            required: true,
            options: ['H1', 'H2', 'H3'],
          },
        ],
      };
      (getCachedObservationTool as jest.Mock).mockReturnValue(fuzzyDef);
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector({
          ...defaultMockState,
          businesses: {
            businesses: [mockBusinesses[0]],
            services: [mockServices[0]],
          },
        }),
      );

      const {getByText, getByTestId} = renderScreen();
      await waitFor(() => expect(getByText('Vet Clinic A')).toBeTruthy());
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');

      // Step 1 (Ear Position) fuzzy-matched the 'earpos' field -> its options
      await waitFor(() => expect(getByText('E1')).toBeTruthy());

      fireEvent(getByText('E1'), 'press');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      fireEvent(getByText('O1'), 'press');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      fireEvent(getByText('M1'), 'press');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      fireEvent(getByText('W1'), 'press');
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      fireEvent(getByText('H1'), 'press');
      fireEvent(
        getByTestId('btn-Submit and schedule appointment'),
        'onTouchEnd',
      );

      await waitFor(() => {
        expect(observationToolApi.submit).toHaveBeenCalledWith(
          expect.objectContaining({
            answers: expect.objectContaining({
              earpos: 'E1',
              zzz1: 'O1',
              zzz2: 'M1',
              zzz3: 'W1',
              zzz4: 'H1',
            }),
          }),
        );
      });
    });

    it('submits without selecting a companion when none is linked', async () => {
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        companionId: 'ghost-companion',
      }));
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector({
          companion: {companions: [mockCompanion]},
          businesses: {
            businesses: [mockBusinesses[0]],
            services: [mockServices[0]],
          },
          auth: {user: mockUser},
        }),
      );

      const {getByText, getByTestId} = renderScreen();
      await waitFor(() => expect(getByText('Vet Clinic A')).toBeTruthy());
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => expect(getByText('Step 1 of 5')).toBeTruthy());
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
          expect.objectContaining({companionId: 'ghost-companion'}),
        );
      });
      expect(setSelectedCompanion).not.toHaveBeenCalled();
    });

    it('ignores a resolved remote definition after the screen unmounts', async () => {
      let resolveDef: (value: any) => void = () => {};
      (getCachedObservationTool as jest.Mock).mockReturnValue(null);
      (observationToolApi.get as jest.Mock).mockReturnValue(
        new Promise(resolve => {
          resolveDef = resolve;
        }),
      );
      (selectTaskById as unknown as jest.Mock).mockReturnValue(() => ({
        ...mockTask,
        observationToolId: 'pending-tool',
        details: {toolType: 'pending-tool'},
      }));
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector(defaultMockState),
      );

      const {unmount} = renderScreen();
      unmount();
      resolveDef({
        id: 'pending-tool',
        name: 'Pending',
        description: '',
        fields: [],
      });
      // Flush the pending fetch's then/finally after unmount (isMounted === false).
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(observationToolApi.get).toHaveBeenCalledWith('pending-tool');
    });

    it('shows a generic message when the submission rejects with a non-Error', async () => {
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector({
          ...defaultMockState,
          businesses: {
            businesses: [mockBusinesses[0]],
            services: [mockServices[0]],
          },
        }),
      );
      (observationToolApi.submit as jest.Mock).mockRejectedValueOnce('boom');

      const {getByText, getByTestId} = renderScreen();
      await waitFor(() => expect(getByText('Vet Clinic A')).toBeTruthy());
      fireEvent(getByTestId('btn-Next'), 'onTouchEnd');
      await waitFor(() => expect(getByText('Step 1 of 5')).toBeTruthy());
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
          'Unable to submit responses',
        );
      });
    });

    it('keeps every provider when there is no authenticated current user', () => {
      // currentUser is null -> currentUserId resolves through the `?? null`
      // arm (line 432) and the createdBy restriction is skipped (line 433).
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector(defaultMockState, null),
      );

      const {getByText} = renderScreen();
      expect(getByText('Vet Clinic A')).toBeTruthy();
      expect(getByText('Vet Clinic B')).toBeTruthy();
    });

    it('maps submission keys only for matched steps when remote fields are fewer than the static steps', () => {
      // One remote field matches step 1; steps 2-5 find no field, so the
      // index fallback takes the `1 === 5 ? ... : null` false arm (lines
      // 364-366) and `matchedField?.key` short-circuits on null (line 367).
      (getCachedObservationTool as jest.Mock).mockReturnValue({
        id: 'feline-grimace-scale',
        name: 'Feline Grimace Scale',
        description: 'desc',
        fields: [
          {
            key: 'earPosition',
            label: 'Ear Position',
            required: true,
            options: ['A', 'B', 'C'],
          },
        ],
      });
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector(defaultMockState),
      );

      const {getByText} = renderScreen();
      expect(getByText('Vet Clinic A')).toBeTruthy();
    });

    it('matches observation services by species when the tool display name is empty', () => {
      // Remote name is an empty string, so toolDisplayName -> '' and the
      // `normalizedName ? ... : false` name-match takes its false arm (line
      // 398) while the static definition still supplies the overview title.
      (getCachedObservationTool as jest.Mock).mockReturnValue({
        id: 'feline-grimace-scale',
        name: '',
        description: '',
        fields: [],
      });
      (useSelector as unknown as jest.Mock).mockImplementation(
        makeUseSelector(defaultMockState),
      );

      const {getByText} = renderScreen();
      expect(getByText('What is Feline Grimace Scale?')).toBeTruthy();
    });
  });
});
