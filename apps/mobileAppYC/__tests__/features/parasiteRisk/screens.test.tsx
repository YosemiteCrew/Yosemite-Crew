import React from 'react';
import {Alert, StyleSheet} from 'react-native';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {typography} from '@/theme/typography';
import {mockTheme} from '../../setup/mockTheme';

let mockFakeState: Record<string, unknown> = {};
const mockDispatch = jest.fn();

// Dispatches are asserted by their argument, so the forecast thunk stands in as
// a plain action creator rather than a real createAsyncThunk function.
const mockLoadRiskForLocation = jest.fn((location: unknown) => ({
  type: 'parasiteRisk/loadForLocation/mock',
  payload: location,
}));
const mockLoadSubscriptions = jest.fn(() => ({
  type: 'parasiteRisk/loadSubscriptions/mock',
}));
const mockFollowLocation = jest.fn((payload: unknown) => ({
  type: 'parasiteRisk/follow/mock',
  payload,
}));
const mockUnfollowLocation = jest.fn((id: string) => ({
  type: 'parasiteRisk/unfollow/mock',
  payload: id,
}));

jest.mock('@/features/parasiteRisk/thunks', () => ({
  loadRiskForLocation: (location: unknown) => mockLoadRiskForLocation(location),
  loadSubscriptions: () => mockLoadSubscriptions(),
  followLocation: (payload: unknown) => mockFollowLocation(payload),
  unfollowLocation: (id: string) => mockUnfollowLocation(id),
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
  useAppDispatch: () => mockDispatch,
  // Runs the real selector against a state this test controls, so selector
  // wiring is exercised rather than stubbed away.
  useAppSelector: (selector: (s: unknown) => unknown) =>
    selector(mockFakeState),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
  }),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

// The search sheet has its own test; stub it here so the screen test stays
// about the screen.
jest.mock(
  '@/features/parasiteRisk/components/RegionSearchSheet/RegionSearchSheet',
  () => ({RegionSearchSheet: () => null}),
);

jest.mock('@/features/companion', () => ({
  selectCompanions: (s: any) => s.companions ?? [],
  selectSelectedCompanionId: (s: any) => s.selectedCompanionId ?? null,
}));

jest.mock('@/features/tasks/selectors', () => ({
  selectTasksByCompanion: () => (s: any) => s.tasks ?? [],
  selectHasHydratedCompanion: (companionId: string | null) => (s: any) =>
    companionId ? Boolean(s.tasksHydrated?.[companionId]) : false,
}));

import {ParasiteRiskScreen} from '@/features/parasiteRisk/screens/ParasiteRiskScreen/ParasiteRiskScreen';
import {ParasiteDetailScreen} from '@/features/parasiteRisk/screens/ParasiteDetailScreen/ParasiteDetailScreen';

const readings = [
  {
    parasiteId: 'paralysis_tick',
    group: 'TICK',
    index: 72,
    tier: 'HIGH',
    trend: 'RISING',
  },
  {
    parasiteId: 'flea',
    group: 'FLEA',
    index: 40,
    tier: 'MODERATE',
    trend: 'STEADY',
  },
];

const HOUR_MS = 60 * 60 * 1000;

// Relative to now, because the screen revalidates a reading against its own
// age. A reading an hour old is inside the daily refresh cycle.
const freshComputedAt = () => new Date(Date.now() - HOUR_MS).toISOString();

const baseParasiteRisk = {
  location: {label: 'Brisbane', lat: -27.375, lon: 153.125, countryCode: 'AU'},
  reading: {
    cell: {lat: -27.375, lon: 153.125},
    countryCode: 'AU',
    region: 'AU',
    modelVersion: '2026.07-1',
    computedAt: freshComputedAt(),
    overallTier: 'HIGH',
    degraded: false,
    readings,
  },
  recentLocations: [],
  subscriptions: [],
  loading: false,
  subscriptionsLoading: false,
  error: null,
  disclaimerAcknowledged: true,
};

const parentNavigate = jest.fn();

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({navigate: parentNavigate})),
} as any;

// The account holder: a primary parent holds every permission.
const primaryAccess = {
  accessByCompanionId: {},
  defaultAccess: null,
  lastFetchedRole: 'PRIMARY',
  lastFetchedPermissions: null,
};

const coParentAccess = (permissions: Record<string, boolean>) => ({
  accessByCompanionId: {
    c1: {
      companionId: 'c1',
      parentId: 'p1',
      role: 'CO-PARENT',
      permissions: {
        assignAsPrimaryParent: false,
        emergencyBasedPermissions: false,
        appointments: false,
        companionProfile: false,
        documents: false,
        expenses: false,
        tasks: false,
        chatWithVet: false,
        ...permissions,
      },
    },
  },
  defaultAccess: null,
  lastFetchedRole: 'CO-PARENT',
  lastFetchedPermissions: null,
});

const setState = (
  overrides: Record<string, unknown> = {},
  coParent: Record<string, unknown> = primaryAccess,
) => {
  mockFakeState = {
    parasiteRisk: {...baseParasiteRisk, ...overrides},
    companions: [{id: 'c1', name: 'Milo', breed: {breedName: 'Kelpie'}}],
    selectedCompanionId: 'c1',
    tasks: [],
    tasksHydrated: {c1: true},
    coParent,
  };
};

describe('ParasiteRiskScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    setState();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderScreen = () =>
    render(<ParasiteRiskScreen navigation={navigation} route={{} as any} />);

  it('shows the location and the headline parasite', () => {
    renderScreen();

    expect(screen.getByText('Brisbane')).toBeTruthy();
    expect(
      screen.getByText(
        'parasiteRisk.headline:parasiteRisk.parasite.paralysis_tick.name',
      ),
    ).toBeTruthy();
  });

  it('loads followed locations and exposes the follow action', () => {
    renderScreen();

    expect(mockLoadSubscriptions).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText('parasiteRisk.follow'));
    expect(mockFollowLocation).toHaveBeenCalledWith({
      location: baseParasiteRisk.location,
    });
  });

  it('unfollows the subscription for the current forecast cell', () => {
    setState({
      subscriptions: [
        {
          id: 'sub-1',
          lat: -27.375,
          lon: 153.125,
          countryCode: 'AU',
          label: 'A different display label',
          alertTier: 'HIGH',
          createdAt: freshComputedAt(),
        },
      ],
    });
    renderScreen();

    fireEvent.press(screen.getByLabelText('parasiteRisk.unfollow'));
    expect(mockUnfollowLocation).toHaveBeenCalledWith('sub-1');
  });

  it('lists a card per applicable parasite', () => {
    renderScreen();

    expect(
      screen.getByText('parasiteRisk.parasite.paralysis_tick.name'),
    ).toBeTruthy();
    expect(screen.getByText('parasiteRisk.parasite.flea.name')).toBeTruthy();
  });

  it('always shows the modelled-not-observed disclaimer', () => {
    renderScreen();
    expect(screen.getByText('parasiteRisk.disclaimer')).toBeTruthy();
  });

  it('opens the parasite detail when a card is tapped', () => {
    renderScreen();

    fireEvent.press(
      screen.getByText('parasiteRisk.parasite.paralysis_tick.name'),
    );

    expect(navigation.navigate).toHaveBeenCalledWith('ParasiteDetail', {
      parasiteId: 'paralysis_tick',
    });
  });

  it('prompts for a location when none has been chosen', () => {
    setState({location: null, reading: null});
    renderScreen();

    expect(screen.getByText('parasiteRisk.search.prompt')).toBeTruthy();
  });

  it('surfaces an error when there is no reading to fall back on', () => {
    setState({
      location: null,
      reading: null,
      error: 'parasiteRisk.errors.forecast',
    });
    renderScreen();

    expect(screen.getByText('parasiteRisk.errors.forecast')).toBeTruthy();
  });

  it('surfaces an error while keeping the previous reading visible', () => {
    setState({error: 'parasiteRisk.errors.forecast'});
    renderScreen();

    expect(screen.getByText('parasiteRisk.errors.forecast')).toBeTruthy();
    expect(screen.getByText('Brisbane')).toBeTruthy();
  });

  it('flags a degraded reading', () => {
    setState({
      reading: {...baseParasiteRisk.reading, degraded: true},
    });
    renderScreen();

    expect(screen.getByText('parasiteRisk.degraded')).toBeTruthy();
  });

  it('warns when prevention cover is missing and routes to add one', () => {
    renderScreen();

    // No prevention tasks on the companion, so the banner should appear.
    expect(screen.getByText('parasiteRisk.cover.noneBody:Milo')).toBeTruthy();

    fireEvent.press(screen.getByText('parasiteRisk.cover.addPrevention'));
    expect(parentNavigate).toHaveBeenCalledWith('Tasks', {screen: 'AddTask'});
  });

  it('sends the book-a-visit CTA to the booking flow, not business linking', () => {
    renderScreen();

    fireEvent.press(screen.getByText('parasiteRisk.cover.bookVisit'));

    expect(parentNavigate).toHaveBeenCalledWith('Appointments', {
      screen: 'BrowseBusinesses',
    });
    // BusinessSearch only links a clinic to a companion; it cannot book.
    expect(navigation.navigate).not.toHaveBeenCalledWith(
      'LinkedBusinesses',
      expect.anything(),
    );
  });

  it('withholds the cover warning when local risk is not high', () => {
    setState({
      reading: {
        ...baseParasiteRisk.reading,
        overallTier: 'MODERATE',
        readings: [
          {
            parasiteId: 'flea',
            group: 'FLEA',
            index: 30,
            tier: 'MODERATE',
            trend: 'STEADY',
          },
          {
            parasiteId: 'heartworm',
            group: 'WORM',
            index: 10,
            tier: 'LOW',
            trend: 'FALLING',
          },
        ],
      },
    });
    renderScreen();

    // Cover is still missing, but the banner asserts risk is high right now.
    expect(screen.queryByText('parasiteRisk.cover.noneBody:Milo')).toBeNull();
    expect(screen.queryByText('parasiteRisk.cover.title')).toBeNull();
    // The forecast itself is unaffected.
    expect(screen.getByText('parasiteRisk.parasite.flea.name')).toBeTruthy();
  });

  it('still warns above the high threshold', () => {
    setState({
      reading: {
        ...baseParasiteRisk.reading,
        overallTier: 'EXTREME',
        readings: [{...readings[0], tier: 'EXTREME', index: 91}],
      },
    });
    renderScreen();

    expect(screen.getByText('parasiteRisk.cover.noneBody:Milo')).toBeTruthy();
  });

  it('blocks a co-parent without the tasks permission from adding prevention', () => {
    setState({}, coParentAccess({appointments: true}));
    renderScreen();

    fireEvent.press(screen.getByText('parasiteRisk.cover.addPrevention'));

    expect(parentNavigate).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'parasiteRisk.permission.title',
      'parasiteRisk.permission.message:parasiteRisk.permission.tasks',
    );
  });

  it('blocks a co-parent without the appointments permission from booking', () => {
    setState({}, coParentAccess({tasks: true}));
    renderScreen();

    fireEvent.press(screen.getByText('parasiteRisk.cover.bookVisit'));

    expect(parentNavigate).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'parasiteRisk.permission.title',
      'parasiteRisk.permission.message:parasiteRisk.permission.appointments',
    );
  });

  it('lets a permitted co-parent through both CTAs', () => {
    setState({}, coParentAccess({tasks: true, appointments: true}));
    renderScreen();

    fireEvent.press(screen.getByText('parasiteRisk.cover.addPrevention'));
    fireEvent.press(screen.getByText('parasiteRisk.cover.bookVisit'));

    expect(parentNavigate).toHaveBeenCalledWith('Tasks', {screen: 'AddTask'});
    expect(parentNavigate).toHaveBeenCalledWith('Appointments', {
      screen: 'BrowseBusinesses',
    });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('refetches a rehydrated reading that is past its daily refresh', () => {
    setState({
      reading: {
        ...baseParasiteRisk.reading,
        computedAt: new Date(Date.now() - 72 * HOUR_MS).toISOString(),
      },
    });
    renderScreen();

    expect(mockLoadRiskForLocation).toHaveBeenCalledWith(
      baseParasiteRisk.location,
    );
  });

  it('leaves a reading inside the refresh window alone', () => {
    renderScreen();

    expect(mockLoadRiskForLocation).not.toHaveBeenCalled();
  });

  it('loads a forecast for a location that rehydrated without one', () => {
    setState({reading: null});
    renderScreen();

    expect(mockLoadRiskForLocation).toHaveBeenCalledWith(
      baseParasiteRisk.location,
    );
  });

  it('revalidates only once per open', () => {
    setState({
      reading: {
        ...baseParasiteRisk.reading,
        computedAt: new Date(Date.now() - 72 * HOUR_MS).toISOString(),
      },
    });
    const view = renderScreen();
    view.rerender(
      <ParasiteRiskScreen navigation={navigation} route={{} as any} />,
    );

    expect(mockLoadRiskForLocation).toHaveBeenCalledTimes(1);
  });

  it('says nothing about cover while the pet tasks are still loading', () => {
    setState();
    mockFakeState = {...mockFakeState, tasksHydrated: {}};
    renderScreen();

    // An empty task list before hydration is unknown, not uncovered.
    expect(screen.queryByText('parasiteRisk.cover.title')).toBeNull();
    expect(screen.queryByText('parasiteRisk.cover.noneBody:Milo')).toBeNull();
  });

  it('warns once the tasks have loaded with no prevention on file', () => {
    setState();
    mockFakeState = {...mockFakeState, tasksHydrated: {}};
    const view = renderScreen();
    expect(screen.queryByText('parasiteRisk.cover.noneBody:Milo')).toBeNull();

    mockFakeState = {...mockFakeState, tasksHydrated: {c1: true}};
    view.rerender(
      <ParasiteRiskScreen navigation={navigation} route={{} as any} />,
    );

    expect(screen.getByText('parasiteRisk.cover.noneBody:Milo')).toBeTruthy();
  });

  it('hides the cover banner when there is no selected companion', () => {
    mockFakeState = {
      parasiteRisk: baseParasiteRisk,
      companions: [],
      selectedCompanionId: null,
      tasks: [],
    };
    renderScreen();

    expect(screen.queryByText(/parasiteRisk.cover/)).toBeNull();
  });

  it('goes back from the header', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('common.back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('ParasiteDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setState();
  });

  const renderDetail = (parasiteId = 'paralysis_tick') =>
    render(
      <ParasiteDetailScreen
        navigation={navigation}
        route={{params: {parasiteId}} as any}
      />,
    );

  it('shows the education sections', () => {
    renderDetail();

    expect(screen.getByText('parasiteRisk.detail.about')).toBeTruthy();
    expect(screen.getByText('parasiteRisk.detail.signs')).toBeTruthy();
    expect(screen.getByText('parasiteRisk.detail.prevention')).toBeTruthy();
  });

  it('shows the current tier and trend for that parasite', () => {
    renderDetail();

    expect(screen.getByText('parasiteRisk.tier.high')).toBeTruthy();
    expect(screen.getByText('parasiteRisk.trend.rising')).toBeTruthy();
  });

  it('names the location the reading came from', () => {
    renderDetail();
    expect(screen.getByText('parasiteRisk.detail.near:Brisbane')).toBeTruthy();
  });

  it('renders without a reading for a parasite that is not local', () => {
    renderDetail('lungworm');

    expect(
      screen.getByText('parasiteRisk.parasite.lungworm.name'),
    ).toBeTruthy();
    expect(screen.queryByText('parasiteRisk.tier.high')).toBeNull();
  });

  it('carries the disclaimer too', () => {
    renderDetail();
    expect(screen.getByText('parasiteRisk.disclaimer')).toBeTruthy();
  });

  it('takes its page title from the shared title token, not a raw font', () => {
    renderDetail();

    const title = screen.getByText('parasiteRisk.parasite.paralysis_tick.name');
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      fontFamily: typography.serifTitleSmall.fontFamily,
      fontSize: typography.serifTitleSmall.fontSize,
    });
  });
});
