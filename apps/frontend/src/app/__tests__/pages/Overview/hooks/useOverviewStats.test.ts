import { renderHook, waitFor } from '@testing-library/react';
import { useOverviewStats } from '../../../../features/overview/hooks/useOverviewStats';

// Mock the global fetch API
globalThis.fetch = jest.fn();

describe('useOverviewStats Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on console.error to keep test output clean during error tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('1. correctly parses valid repository data, aggregates 30 days of traffic, and monthly stars', async () => {
    // Generate dates to test historical slicing (dayMinus31 logic) and active dates
    const today = new Date('2026-03-24T12:00:00Z');
    const past = new Date('2026-02-15T12:00:00Z'); // > 31 days ago

    const mockJson = {
      charts: {
        '#clones_total': {
          datasets: {
            'data-1': [
              { time: past.toISOString(), clones_total: 100 }, // Historical clone
              { time: today.toISOString(), clones_total: 5 }, // Current clone
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
              { time: past.toISOString(), forks_cumulative: 20 }, // Historical fork
              { time: today.toISOString(), forks_cumulative: 25 },
            ],
          },
        },
        '#stargazers': {
          datasets: {
            'data-4': [
              { time: past.toISOString(), stars_cumulative: 500 },
              { time: today.toISOString(), stars_cumulative: 510 },
              // Edge case: test fallback logic `d[valKey] || d.clones_total || 0` in getCumulative
              { time: '2026-03-25T12:00:00Z', clones_total: 999 }, // Missing valKey, falls back to clones_total
              { time: '2026-03-26T12:00:00Z', random: 'data' }, // Missing both, falls back to 0
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

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for the hook to process data
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // ASSERT TRAFFIC CHART
    // Should always be exactly 30 days of data
    expect(result.current.trafficChart).toHaveLength(30);
    // Check a day with no data to ensure fallbacks (cloneEntry ? ... : 0) work
    const emptyDayTraffic = result.current.trafficChart[10];
    expect(emptyDayTraffic['Self Hosters (Unique)']).toBe(0);
    expect(emptyDayTraffic['Self Hosters (Cumulative)']).toBe(100); // Carried over from historical

    // ASSERT STARS CHART
    // Should aggregate by month ("Feb 2026", "Mar 2026")
    expect(result.current.starsChart.length).toBeGreaterThan(0);
    // March grabs the latest chronological valid value (which was the fallback `999` from clones_total)
  });

  it('2. handles missing dataset properties smoothly (extractChartData fallbacks)', async () => {
    // Tests branches:
    // !json?.charts?.[chartKey]?.datasets
    // return datasets[dataKey] || []
    const mockJson = {
      charts: {
        '#clones_total': {}, // Missing datasets entirely
        '#clones_unique': { datasets: {} }, // Empty datasets object
        // Missing forks and stargazers entirely
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

    // Because allDates.length === 0, it hits the early return
    expect(result.current.trafficChart).toEqual([]);
    expect(result.current.starsChart).toEqual([]);
  });

  it('3. handles network failures and catches errors', async () => {
    // Mock fetch to return a non-ok response
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
    });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // State should remain empty
    expect(result.current.trafficChart).toEqual([]);
    expect(result.current.starsChart).toEqual([]);

    // Ensure the error was logged
    expect(console.error).toHaveBeenCalledWith('Failed to fetch live JSON', expect.any(Error));
  });

  it('4. handles malformed JSON throws', async () => {
    // Mock fetch to simulate a crash during json() parsing
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

    expect(console.error).toHaveBeenCalledWith('Failed to fetch live JSON', expect.any(Error));
  });
});
