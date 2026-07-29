import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../setup/mockTheme';

let mockFakeState: Record<string, unknown> = {};
const mockDispatch = jest.fn();

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

const baseParasiteRisk = {
  location: {label: 'Brisbane', lat: -27.375, lon: 153.125, countryCode: 'AU'},
  reading: {
    cell: {lat: -27.375, lon: 153.125},
    countryCode: 'AU',
    region: 'AU',
    modelVersion: '2026.07-1',
    computedAt: '2026-07-29T00:00:00.000Z',
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

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getParent: jest.fn(() => ({navigate: jest.fn()})),
} as any;

const setState = (overrides: Record<string, unknown> = {}) => {
  mockFakeState = {
    parasiteRisk: {...baseParasiteRisk, ...overrides},
    companions: [{id: 'c1', name: 'Milo', breed: {breedName: 'Kelpie'}}],
    selectedCompanionId: 'c1',
    tasks: [],
  };
};

describe('ParasiteRiskScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setState();
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
    setState({location: null, reading: null, error: 'offline'});
    renderScreen();

    expect(screen.getByText('offline')).toBeTruthy();
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
    expect(navigation.getParent).toHaveBeenCalled();
  });

  it('routes to booking with the selected companion', () => {
    renderScreen();

    fireEvent.press(screen.getByText('parasiteRisk.cover.bookVisit'));

    expect(navigation.navigate).toHaveBeenCalledWith('LinkedBusinesses', {
      screen: 'BusinessSearch',
      params: expect.objectContaining({
        companionId: 'c1',
        companionName: 'Milo',
      }),
    });
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
});
