import { renderHook, waitFor } from '@testing-library/react';
import { useOverviewStats } from '../../../../features/overview/hooks/useOverviewStats';

// Mock the global fetch API
globalThis.fetch = jest.fn();

describe('useOverviewStats Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock Date.now to prevent cache-busting URL variance in tests
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
    (Date.now as jest.Mock).mockRestore();
  });

  it('1. correctly parses data, maps daily totals, extracts top stats, and formats monthly stars', async () => {
    // Using dates that cross from 2025 into 2026 to test the year-label formatting logic
    const mockJson = {
      charts: {
        '#clones_total': {
          datasets: {
            'data-1': [
              { time: '2026-03-23T00:00:00Z', clones_total: 25 },
              { time: '2026-03-24T00:00:00Z', clones_total: 50 },
            ],
          },
        },
        '#clones_unique': {
          datasets: {
            'data-2': [{ time: '2026-03-24T00:00:00Z', clones_unique: 10 }],
          },
        },
        '#forks': {
          datasets: {
            'data-3': [
              { time: '2025-11-01T00:00:00Z', forks_cumulative: 20 },
              { time: '2026-03-24T00:00:00Z', forks_cumulative: 64 },
            ],
          },
        },
        '#stargazers': {
          datasets: {
            'data-4': [
              { time: '2025-12-15T00:00:00Z', stars_cumulative: 500 }, // Triggers cross-year branch
              { time: '2026-02-15T00:00:00Z', clones_total: 1000 }, // Tests fallback logic to clones_total
              { time: '2026-03-23T00:00:00Z' }, // Tests ultimate fallback to 0
              { time: '2026-03-24T00:00:00Z', stars_cumulative: 2100 },
            ],
          },
        },
      },
    };

    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockJson,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stargazers_count: 2200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
      });

    const { result } = renderHook(() => useOverviewStats());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // 1. Verify Top-Level Widget Totals
    expect(result.current.totalSelfHosters).toBe(75);
    expect(result.current.totalStars).toBe(2200);
    expect(result.current.totalForks).toBe(64);
    expect(result.current.totalContributors).toBe(3);
    expect(result.current.totalDiscordMembers).toBe(169);

    // 2. Verify Traffic Chart now covers the full daily traffic history
    expect(result.current.trafficChart.length).toBeGreaterThan(100);

    const todayTraffic = result.current.trafficChart[result.current.trafficChart.length - 1];
    expect(todayTraffic.dateKey).toBe('2026-03-24');
    expect(todayTraffic['Self Hosters (Unique)']).toBe(10);
    expect(todayTraffic['Self Hosters (Cumulative)']).toBe(50); // Mapped directly, not added!
    expect(todayTraffic['Builders (Cumulative)']).toBe(64);
    expect(todayTraffic['Builders (Unique)']).toBe(44); // 64 - 20 (previous) = 44

    // Verify empty day fallbacks to 0
    const emptyDayTraffic = result.current.trafficChart.find(
      (dataPoint) => dataPoint.dateKey === '2026-03-10'
    );
    expect(emptyDayTraffic).toBeDefined();
    expect(emptyDayTraffic?.['Self Hosters (Unique)']).toBe(0);
    expect(emptyDayTraffic?.['Self Hosters (Cumulative)']).toBe(0);

    // 3. Verify Stars Chart formatting logic and getCumulative loops
    expect(result.current.starsChart.length).toBeGreaterThan(0);

    // Verify cross-year logic
    expect(result.current.starsChart[0].month).toContain("'25"); // Dec '25
    expect(result.current.starsChart[0].dateKey).toBe('2025-12-01T00:00:00.000Z');
    expect(result.current.starsChart[1].month).toContain("'26"); // Jan '26

    const febStars = result.current.starsChart.find((s) => s.month.includes('Feb'));
    expect(febStars?.['Github Stars']).toBe(1000); // Successfully hit the `d.clones_total` fallback
  });

  it('2. handles completely empty datasets seamlessly (allDates.length === 0)', async () => {
    const mockJson = {
      charts: {
        '#clones_total': { datasets: { 'data-1': [] } },
        '#clones_unique': { datasets: { 'data-2': [] } },
        '#forks': { datasets: { 'data-3': [] } },
        '#stargazers': { datasets: { 'data-4': [] } },
      },
    };

    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockJson })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, json: async () => [] });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trafficChart).toEqual([]);
    expect(result.current.starsChart).toEqual([]);
    expect(result.current.totalSelfHosters).toBe(0);
    expect(result.current.totalStars).toBe(0);
    expect(result.current.totalForks).toBe(0);
    expect(result.current.totalContributors).toBe(0);
    expect(result.current.totalDiscordMembers).toBe(169);
  });

  it('3. handles missing dataset properties smoothly (extractChartData fallback)', async () => {
    const mockJson = {
      charts: {
        '#clones_total': {}, // Missing datasets entirely
        '#clones_unique': { datasets: {} }, // Empty datasets object
      },
    };

    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockJson,
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, json: async () => [] });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trafficChart).toEqual([]);
  });

  it('4. catches network failures securely', async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trafficChart).toEqual([]);
    expect(console.error).toHaveBeenCalledWith('Failed to fetch live JSON', expect.any(Error));
  });

  it('5. catches JSON parsing throws securely', async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Parse Crash');
        },
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, json: async () => [] });

    const { result } = renderHook(() => useOverviewStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(console.error).toHaveBeenCalledWith('Failed to fetch live JSON', expect.any(Error));
  });
});
