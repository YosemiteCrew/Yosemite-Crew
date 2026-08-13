import React from 'react';
import {ActivityIndicator} from 'react-native';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react-native';
import {mockTheme} from '../../setup/mockTheme';

const mockFetchPlaceSuggestions = jest.fn();
const mockFetchPlaceDetails = jest.fn();
const mockGetCurrentPosition = jest.fn();

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// A stable `t`, matching real i18next. Returning a fresh function each render
// would make any effect that depends on it re-run forever.
const mockT = (key: string) => key;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: mockT}),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

jest.mock('@/shared/services/maps/googlePlaces', () => ({
  fetchPlaceSuggestions: (...a: unknown[]) => mockFetchPlaceSuggestions(...a),
  fetchPlaceDetails: (...a: unknown[]) => mockFetchPlaceDetails(...a),
}));

jest.mock('@/shared/services/LocationService', () => ({
  __esModule: true,
  default: {getCurrentPosition: () => mockGetCurrentPosition()},
}));

import {RegionSearchSheet} from '@/features/parasiteRisk/components/RegionSearchSheet/RegionSearchSheet';

const onSelect = jest.fn();
const onClose = jest.fn();

const renderSheet = (props = {}) =>
  render(
    <RegionSearchSheet
      visible
      onClose={onClose}
      onSelect={onSelect}
      recentLocations={[]}
      {...props}
    />,
  );

const typeQuery = async (value: string) => {
  fireEvent.changeText(
    screen.getByPlaceholderText('parasiteRisk.search.placeholder'),
    value,
  );
  // Clear the 300ms debounce.
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
};

describe('RegionSearchSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockFetchPlaceSuggestions.mockResolvedValue([
      {placeId: 'p1', primaryText: 'Brisbane', secondaryText: 'QLD, Australia'},
    ]);
    mockFetchPlaceDetails.mockResolvedValue({
      latitude: -27.47,
      longitude: 153.03,
      countryCode: 'AU',
      city: 'Brisbane',
    });
    mockGetCurrentPosition.mockResolvedValue({
      latitude: 41.9,
      longitude: 12.5,
    });
  });

  afterEach(() => jest.useRealTimers());

  it('does not search until the query is long enough', async () => {
    renderSheet();
    await typeQuery('br');

    expect(mockFetchPlaceSuggestions).not.toHaveBeenCalled();
  });

  it('searches once the query is long enough', async () => {
    renderSheet();
    await typeQuery('brisbane');

    await waitFor(() =>
      expect(mockFetchPlaceSuggestions).toHaveBeenCalledWith({
        query: 'brisbane',
      }),
    );
    expect(await screen.findByText('Brisbane')).toBeTruthy();
  });

  it('resolves a suggestion to a coordinate and closes', async () => {
    renderSheet();
    await typeQuery('brisbane');

    fireEvent.press(await screen.findByText('Brisbane'));

    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith({
        label: 'Brisbane',
        lat: -27.47,
        lon: 153.03,
        countryCode: 'AU',
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('reports a place it cannot pin to a coordinate', async () => {
    mockFetchPlaceDetails.mockResolvedValue({city: 'Nowhere'});
    renderSheet();
    await typeQuery('nowhere');

    fireEvent.press(await screen.findByText('Brisbane'));

    expect(
      await screen.findByText('parasiteRisk.search.unresolved'),
    ).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('still resolves a place that has no country component', async () => {
    mockFetchPlaceDetails.mockResolvedValue({
      latitude: 41.9,
      longitude: 12.5,
      city: 'Rome',
    });
    renderSheet();
    await typeQuery('rome');

    fireEvent.press(await screen.findByText('Brisbane'));

    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({label: 'Rome', countryCode: undefined}),
      ),
    );
  });

  it('surfaces a search failure', async () => {
    mockFetchPlaceSuggestions.mockRejectedValue(new Error('network'));
    renderSheet();
    await typeQuery('brisbane');

    expect(await screen.findByText('parasiteRisk.search.error')).toBeTruthy();
  });

  it('surfaces a failure resolving the chosen place', async () => {
    mockFetchPlaceDetails.mockRejectedValue(new Error('network'));
    renderSheet();
    await typeQuery('brisbane');

    fireEvent.press(await screen.findByText('Brisbane'));

    expect(await screen.findByText('parasiteRisk.search.error')).toBeTruthy();
  });

  it('uses the current position without a country code', async () => {
    renderSheet();

    fireEvent.press(screen.getByText('parasiteRisk.search.useCurrentLocation'));

    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith({
        label: 'parasiteRisk.search.currentLocation',
        lat: 41.9,
        lon: 12.5,
      }),
    );
  });

  it('explains when location permission is refused', async () => {
    mockGetCurrentPosition.mockRejectedValue(new Error('denied'));
    renderSheet();

    fireEvent.press(screen.getByText('parasiteRisk.search.useCurrentLocation'));

    expect(
      await screen.findByText('parasiteRisk.search.locationDenied'),
    ).toBeTruthy();
  });

  it('offers recent locations when there is no query', () => {
    renderSheet({
      recentLocations: [
        {label: 'Rome', lat: 41.875, lon: 12.375, countryCode: 'IT'},
      ],
    });

    expect(screen.getByText('parasiteRisk.search.recent')).toBeTruthy();

    fireEvent.press(screen.getByText('Rome'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({label: 'Rome'}),
    );
  });

  it('closes from the header', () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText('common.close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('stops the spinner when the query is shortened before the search runs', async () => {
    renderSheet();
    const input = screen.getByPlaceholderText(
      'parasiteRisk.search.placeholder',
    );

    fireEvent.changeText(input, 'brisbane');
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1);

    // Back below the minimum length before the debounce fires. The pending
    // search is cancelled, so nothing else would turn the spinner off.
    fireEvent.changeText(input, 'br');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    expect(mockFetchPlaceSuggestions).not.toHaveBeenCalled();
  });

  it('clears the query and results when it is closed', async () => {
    const {rerender} = renderSheet();
    await typeQuery('brisbane');
    expect(await screen.findByText('Brisbane')).toBeTruthy();

    rerender(
      <RegionSearchSheet
        visible={false}
        onClose={onClose}
        onSelect={onSelect}
        recentLocations={[]}
      />,
    );
    rerender(
      <RegionSearchSheet
        visible
        onClose={onClose}
        onSelect={onSelect}
        recentLocations={[]}
      />,
    );

    expect(
      screen.getByPlaceholderText('parasiteRisk.search.placeholder').props
        .value,
    ).toBe('');
    expect(screen.queryByText('Brisbane')).toBeNull();
  });
});
