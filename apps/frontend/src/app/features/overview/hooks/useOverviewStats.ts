'use client';
import { useState, useEffect } from 'react';

export type TrafficDataPoint = {
  dateKey: string;
  month: string;
  'Self Hosters (Unique)': number;
  'Self Hosters (Cumulative)': number;
  'Builders (Unique)': number;
  'Builders (Cumulative)': number;
};

export type StarsDataPoint = {
  dateKey: string;
  month: string;
  'Github Stars': number;
};

const SUMMARY_URL =
  'https://raw.githubusercontent.com/YosemiteCrew/Yosemite-Crew/github-repo-stats/YosemiteCrew/Yosemite-Crew/latest-report/summary.json';
const GITHUB_REPO_URL = 'https://api.github.com/repos/YosemiteCrew/Yosemite-Crew';
const GITHUB_CONTRIBUTORS_URL =
  'https://api.github.com/repos/YosemiteCrew/Yosemite-Crew/contributors?per_page=100&anon=true';
const DISCORD_MEMBERS_COUNT = 169;

const extractChartData = (json: any, chartKey: string) => {
  if (!json?.charts?.[chartKey]?.datasets) return [];
  const datasets = json.charts[chartKey].datasets;
  const dataKey = Object.keys(datasets)[0];
  return datasets[dataKey] || [];
};

const getCumulative = (data: any[], targetTimeMs: number, valKey: string) => {
  const sorted = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  let lastVal = 0;
  for (const d of sorted) {
    if (new Date(d.time).getTime() <= targetTimeMs) {
      lastVal = d[valKey] || d.clones_total || 0;
    } else {
      break;
    }
  }
  return lastVal;
};

const sortByTimeAsc = (data: any[]) =>
  [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

const getLatestCumulativeValue = (data: any[], key: string): number => {
  const last = sortByTimeAsc(data).at(-1);
  return last?.[key] || 0;
};

const generateTrafficData = (
  maxDate: Date,
  clonesData: any[],
  clonesUniqueData: any[],
  forksData: any[]
): TrafficDataPoint[] => {
  const generatedTraffic: TrafficDataPoint[] = [];
  const dayMinus30 = new Date(maxDate);
  dayMinus30.setUTCDate(maxDate.getUTCDate() - 30);
  let lastForks = getCumulative(forksData, dayMinus30.getTime(), 'forks_cumulative');

  for (let i = 29; i >= 0; i--) {
    const targetDate = new Date(maxDate);
    targetDate.setUTCDate(maxDate.getUTCDate() - i);

    const dateString = targetDate.toISOString().split('T')[0];
    const monthLabel = targetDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const cloneEntry = clonesData.find((d: any) => d.time.startsWith(dateString));
    const cloneUniqueEntry = clonesUniqueData.find((d: any) => d.time.startsWith(dateString));
    const clonesTotal = cloneEntry ? cloneEntry.clones_total : 0;
    const clonesUnique = cloneUniqueEntry ? cloneUniqueEntry.clones_unique : 0;

    const targetTimeMs = targetDate.getTime();
    const forksCum = getCumulative(forksData, targetTimeMs, 'forks_cumulative');
    const forksUnique = Math.max(0, forksCum - lastForks);
    lastForks = forksCum;

    generatedTraffic.push({
      month: monthLabel,
      'Self Hosters (Unique)': clonesUnique,
      'Self Hosters (Cumulative)': clonesTotal,
      'Builders (Unique)': forksUnique,
      'Builders (Cumulative)': forksCum,
    });
  }

  return generatedTraffic;
};

const generateStarsData = (sortedStars: any[], maxDate: Date): StarsDataPoint[] => {
  const generatedStars: StarsDataPoint[] = [];
  if (sortedStars.length === 0) return generatedStars;

  const firstDate = new Date(sortedStars[0].time);
  const lastDate = new Date(maxDate);
  let currentMonth = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), 1));
  let currentYearStr = '';

  while (currentMonth <= lastDate) {
    const rawMonth = currentMonth.toLocaleDateString('en-US', {
      month: 'short',
      timeZone: 'UTC',
    });
    const rawYear = currentMonth.toLocaleDateString('en-US', {
      year: 'numeric',
      timeZone: 'UTC',
    });

    let displayLabel = rawMonth;
    if (rawYear !== currentYearStr) {
      displayLabel = `${rawMonth} '${rawYear.slice(-2)}`;
      currentYearStr = rawYear;
    }

    const nextMonth = new Date(
      Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 1)
    );
    const targetTimeMs = nextMonth.getTime() - 1;
    const starsCum = getCumulative(sortedStars, targetTimeMs, 'stars_cumulative');

    generatedStars.push({ month: displayLabel, 'Github Stars': starsCum });
    currentMonth = nextMonth;
  }

  return generatedStars;
};

export const useOverviewStats = () => {
  const [trafficChart, setTrafficChart] = useState<TrafficDataPoint[]>([]);
  const [starsChart, setStarsChart] = useState<StarsDataPoint[]>([]);
  const [totalSelfHosters, setTotalSelfHosters] = useState<number>(0);
  const [totalStars, setTotalStars] = useState<number>(0);
  const [totalForks, setTotalForks] = useState<number>(0);
  const [totalContributors, setTotalContributors] = useState<number>(0);
  const [totalDiscordMembers, setTotalDiscordMembers] = useState<number>(DISCORD_MEMBERS_COUNT);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRepoStats = async () => {
      setIsLoading(true);
      try {
        setTotalDiscordMembers(DISCORD_MEMBERS_COUNT);

        const [summaryRes, repoRes, contributorsRes] = await Promise.all([
          fetch(`${SUMMARY_URL}?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(GITHUB_REPO_URL, {
            headers: { Accept: 'application/vnd.github+json' },
          }),
          fetch(GITHUB_CONTRIBUTORS_URL, {
            headers: { Accept: 'application/vnd.github+json' },
          }),
        ]);

        if (!summaryRes.ok) throw new Error('Failed to load repo stats');

        const json = await summaryRes.json();
        const repoJson = repoRes.ok ? await repoRes.json() : null;
        const contributorsJson = contributorsRes.ok ? await contributorsRes.json() : [];

        const clonesData = extractChartData(json, '#clones_total');
        const clonesUniqueData = extractChartData(json, '#clones_unique');
        const forksData = extractChartData(json, '#forks');
        const starsData = extractChartData(json, '#stargazers');

        const allDates = [...clonesData, ...forksData, ...starsData].map((d) =>
          new Date(d.time).getTime()
        );
        if (allDates.length === 0) return;

        const maxDate = new Date(Math.max(...allDates));
        maxDate.setUTCHours(23, 59, 59, 999);

        // ==========================================
        // 1. EXTRACT TOTALS FOR TOP WIDGETS
        // ==========================================
        setTotalSelfHosters(
          clonesData.reduce(
            (sum: number, dataPoint: any) => sum + Number(dataPoint?.clones_total ?? 0),
            0
          )
        );

        const sortedForks = [...forksData].sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
        );
        if (sortedForks.length > 0) {
          setTotalForks(sortedForks[sortedForks.length - 1].forks_cumulative || 0);
        }

        const sortedStars = [...starsData].sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
        );
        if (sortedStars.length > 0) {
          setTotalStars(sortedStars[sortedStars.length - 1].stars_cumulative || 0);
        }
        if (repoJson && Number.isFinite(Number(repoJson.stargazers_count))) {
          setTotalStars(Number(repoJson.stargazers_count));
        }
        if (Array.isArray(contributorsJson)) {
          setTotalContributors(contributorsJson.length);
        }

        // ==========================================
        // 2. CALCULATE TRAFFIC (FULL DAILY HISTORY)
        // ==========================================
        const generatedTraffic: TrafficDataPoint[] = [];
        const trafficDates = [...clonesData, ...clonesUniqueData, ...forksData].map((d) =>
          new Date(d.time).getTime()
        );

        if (trafficDates.length > 0) {
          const firstTrafficDate = new Date(Math.min(...trafficDates));
          firstTrafficDate.setUTCHours(0, 0, 0, 0);

          const dayBeforeFirstTrafficDate = new Date(firstTrafficDate);
          dayBeforeFirstTrafficDate.setUTCDate(firstTrafficDate.getUTCDate() - 1);
          let lastForks = getCumulative(
            forksData,
            dayBeforeFirstTrafficDate.getTime(),
            'forks_cumulative'
          );

          for (
            let targetDate = new Date(firstTrafficDate);
            targetDate <= maxDate;
            targetDate.setUTCDate(targetDate.getUTCDate() + 1)
          ) {
            const chartDate = new Date(targetDate);

            const dateString = chartDate.toISOString().split('T')[0];
            const monthLabel = chartDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            });

            const cloneEntry = clonesData.find((d: any) => d.time.startsWith(dateString));
            const cloneUniqueEntry = clonesUniqueData.find((d: any) =>
              d.time.startsWith(dateString)
            );

            const clonesTotal = cloneEntry ? cloneEntry.clones_total : 0;
            const clonesUnique = cloneUniqueEntry ? cloneUniqueEntry.clones_unique : 0;

            const targetTimeMs = chartDate.getTime();
            const forksCum = getCumulative(forksData, targetTimeMs, 'forks_cumulative');
            const forksUnique = Math.max(0, forksCum - lastForks);
            lastForks = forksCum;

            generatedTraffic.push({
              dateKey: dateString,
              month: monthLabel,
              'Self Hosters (Unique)': clonesUnique,
              'Self Hosters (Cumulative)': clonesTotal,
              'Builders (Unique)': forksUnique,
              'Builders (Cumulative)': forksCum,
            });
          }
        }

        // ==========================================
        // 3. CALCULATE STARS (ALL-TIME MONTHLY)
        // ==========================================
        const generatedStars: StarsDataPoint[] = [];

        if (sortedStars.length > 0) {
          const firstDate = new Date(sortedStars[0].time);
          const lastDate = new Date(maxDate);

          let currentMonth = new Date(
            Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), 1)
          );
          let currentYearStr = '';

          while (currentMonth <= lastDate) {
            const rawMonth = currentMonth.toLocaleDateString('en-US', {
              month: 'short',
              timeZone: 'UTC',
            });
            const rawYear = currentMonth.toLocaleDateString('en-US', {
              year: 'numeric',
              timeZone: 'UTC',
            });

            let displayLabel = rawMonth;
            if (rawYear !== currentYearStr) {
              displayLabel = `${rawMonth} '${rawYear.slice(-2)}`;
              currentYearStr = rawYear;
            }

            const nextMonth = new Date(
              Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 1)
            );
            const targetTimeMs = nextMonth.getTime() - 1;

            const starsCum = getCumulative(sortedStars, targetTimeMs, 'stars_cumulative');

            generatedStars.push({
              dateKey: currentMonth.toISOString(),
              month: displayLabel,
              'Github Stars': starsCum,
            });

            currentMonth = nextMonth;
          }
        }

        setTrafficChart(generatedTraffic);
        setStarsChart(generatedStars);
      } catch (error) {
        console.error('Failed to fetch live JSON', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepoStats();
  }, []);

  return {
    trafficChart,
    starsChart,
    totalSelfHosters,
    totalStars,
    totalForks,
    totalContributors,
    totalDiscordMembers,
    isLoading,
  };
};
