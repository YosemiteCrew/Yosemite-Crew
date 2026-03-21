import { renderHook, waitFor } from '@testing-library/react';
import { useOverviewStats } from '../../../../features/overview/hooks/useOverviewStats';

// Mock the global fetch API
globalThis.fetch = jest.fn();

describe('useOverviewStats Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on console.error and suppress its output so our test terminal stays clean
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('1. successfully fetches, processes, and maps valid JSON data', async () => {
    const mockData = {
      charts: {
        '#clones_total': {
          datasets: { 'data-1': [{ time: '2026-03-20T10:00:00Z', clones_total: 10 }] },
        },
        '#clones_unique': {
          datasets: { 'data-2': [{ time: '2026-03-20T10:00:00Z', clones_unique: 5 }] },
        },
        '#forks': {
          datasets: {
            'data-3': [
              { time: '2026-03-01T10:00:00Z', forks_cumulative: 20 }, // Past date (sets initial 'lastForks')
              { time: '2026-03-10T10:00:00Z', forks_cumulative: 25 }, // Inside the 15-day window
              { time: '2026-03-25T10:00:00Z', forks_cumulative: 30 }, // Future date (triggers the 'else break' branch)
            ],
          },
        },
        '#stargazers': {
          datasets: { 'data-4': [{ time: '2026-03-15T10:00:00Z', stars_cumulative: 100 }] },
        },
      },
    };

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useOverviewStats());

    // Initially loading should be true
    expect(result.current.isLoading).toBe(true);

    // Wait for the async effect to finish
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify it generated exactly 15 days of data
    expect(result.current.combinedChart).toHaveLength(15);

    // Assert a day WITHOUT clone data (hits the ternary false branch: cloneEntry ? ... : 0)
    const firstDay = result.current.combinedChart[0];
    expect(firstDay['Self Hosters (Cumulative)']).toBe(0);
    expect(firstDay['Self Hosters (Unique)']).toBe(0);

    // Assert the last day WITH clone data (hits the ternary true branch)
    const lastDay = result.current.combinedChart[14];
    expect(lastDay['Self Hosters (Cumulative)']).toBe(10); // Running total accumulates to 10
  });

  it('2. returns early when charts data is missing (empty allDates array)', async () => {
    // Mocking an empty JSON response hits the `if (!json?.charts?.[chartKey]?.datasets) return [];` branch
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // If all datasets return [], allDates.length === 0, and the hook returns early
    expect(result.current.combinedChart).toEqual([]);
  });

  it('3. handles malformed datasets correctly using fallback arrays', async () => {
    // Passing an empty datasets object forces `Object.keys(datasets)[0]` to be undefined,
    // which hits the final `return datasets[dataKey] || []` fallback branch.
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        charts: {
          '#clones_total': { datasets: {} },
        },
      }),
    });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.combinedChart).toEqual([]);
  });

  it('4. handles fetch API HTTP errors gracefully', async () => {
    // Hits the `if (!res.ok) throw new Error(...)` branch
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify the catch block was hit and the error was logged
    expect(console.error).toHaveBeenCalledWith('Failed to fetch live JSON', expect.any(Error));
    expect(result.current.combinedChart).toEqual([]);
  });

  it('5. handles fatal network exceptions', async () => {
    // Throws a raw network error to ensure the try/catch traps it
    (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Down'));

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(console.error).toHaveBeenCalledWith('Failed to fetch live JSON', expect.any(Error));
  });
});
