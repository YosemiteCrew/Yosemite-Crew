import { renderHook, waitFor } from '@testing-library/react';
import { useOverviewStats } from '../../../../features/overview/hooks/useOverviewStats';

globalThis.fetch = jest.fn();

describe('useOverviewStats Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers().setSystemTime(new Date('2026-03-24T12:00:00Z'));
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
    jest.useRealTimers();
  });

  it('1. correctly parses valid repository data, maps daily totals, and monthly stars', async () => {
    const today = new Date('2026-03-24T12:00:00Z');
    const past = new Date('2026-02-15T12:00:00Z');

    const mockJson = {
      charts: {
        '#clones_total': {
          datasets: {
            'data-1': [
              { time: past.toISOString(), clones_total: 100 },
              { time: today.toISOString(), clones_total: 5 },
            ],
          },
        },
        '#clones_unique': {
          datasets: {
            'data-2': [{ time: today.toISOString(), clones_unique: 3 }],
          },
        },
        '#forks': {
          datasets: {
            'data-3': [
              { time: past.toISOString(), forks_cumulative: 20 },
              { time: today.toISOString(), forks_cumulative: 25 },
            ],
          },
        },
        '#stargazers': {
          datasets: {
            'data-4': [
              { time: past.toISOString(), stars_cumulative: 500 },
              { time: today.toISOString(), stars_cumulative: 510 },
              { time: today.toISOString(), clones_total: 999 },
              { time: today.toISOString(), random: 'data' },
            ],
          },
        },
      },
    };

    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockJson,
    });

    const { result } = renderHook(() => useOverviewStats());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trafficChart).toHaveLength(30);

    const todayTraffic = result.current.trafficChart[29];
    expect(todayTraffic['Self Hosters (Unique)']).toBe(3);
    expect(todayTraffic['Self Hosters (Cumulative)']).toBe(5);
    expect(todayTraffic['Builders (Cumulative)']).toBe(25);
    expect(todayTraffic['Builders (Unique)']).toBe(5);

    const emptyDayTraffic = result.current.trafficChart[10];
    expect(emptyDayTraffic['Self Hosters (Unique)']).toBe(0);
    expect(emptyDayTraffic['Self Hosters (Cumulative)']).toBe(0);

    expect(result.current.starsChart.length).toBeGreaterThan(0);
    const febStars = result.current.starsChart.find((s) => s.month.includes('Feb'));
    expect(febStars?.['Github Stars']).toBe(500);
  });

  it('2. handles missing dataset properties smoothly (extractChartData fallbacks)', async () => {
    const mockJson = {
      charts: {
        '#clones_total': {},
        '#clones_unique': { datasets: {} },
      },
    };

    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockJson,
    });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trafficChart).toEqual([]);
    expect(result.current.starsChart).toEqual([]);
  });

  it('3. handles network failures and catches errors', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trafficChart).toEqual([]);
    expect(result.current.starsChart).toEqual([]);
  });

  it('4. handles malformed JSON throws', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('JSON Parsing Error');
      },
    });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
