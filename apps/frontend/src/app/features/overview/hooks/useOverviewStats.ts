'use client';
import { useState, useEffect } from 'react';

export type TrafficDataPoint = {
  month: string;
  'Self Hosters (Unique)': number;
  'Self Hosters (Cumulative)': number;
  'Builders (Unique)': number;
  'Builders (Cumulative)': number;
};

export type StarsDataPoint = {
  month: string;
  'Github Stars': number;
};

const SUMMARY_URL =
  'https://raw.githubusercontent.com/YosemiteCrew/Yosemite-Crew/github-repo-stats/YosemiteCrew/Yosemite-Crew/latest-report/summary.json';

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

export const useOverviewStats = () => {
  const [trafficChart, setTrafficChart] = useState<TrafficDataPoint[]>([]);
  const [starsChart, setStarsChart] = useState<StarsDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRepoStats = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${SUMMARY_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load repo stats');

        const json = await res.json();

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
        // 1. CALCULATE TRAFFIC (LAST 30 DAYS DAILY)
        // ==========================================
        const generatedTraffic: TrafficDataPoint[] = [];

        const dayMinus31 = new Date(maxDate);
        dayMinus31.setUTCDate(maxDate.getUTCDate() - 31);
        let lastForks = getCumulative(forksData, dayMinus31.getTime(), 'forks_cumulative');

        let runningClones = clonesData
          .filter((d: any) => new Date(d.time).getTime() <= dayMinus31.getTime())
          .reduce((sum: number, d: any) => sum + (d.clones_total || 0), 0);

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
          runningClones += clonesTotal;

          const targetTimeMs = targetDate.getTime();
          const forksCum = getCumulative(forksData, targetTimeMs, 'forks_cumulative');
          const forksUnique = Math.max(0, forksCum - lastForks);
          lastForks = forksCum;

          generatedTraffic.push({
            month: monthLabel,
            'Self Hosters (Unique)': clonesUnique,
            'Self Hosters (Cumulative)': runningClones,
            'Builders (Unique)': forksUnique,
            'Builders (Cumulative)': forksCum,
          });
        }

        // ==========================================
        // 2. CALCULATE STARS (ALL-TIME MONTHLY)
        // ==========================================
        const sortedStars = [...starsData].sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
        );
        const monthlyStarsMap = new Map<string, number>();

        sortedStars.forEach((d) => {
          const date = new Date(d.time);
          const label = date.toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          });
          const starsCum =
            getCumulative(sortedStars, date.getTime(), 'stars_cumulative') ||
            d.stars_cumulative ||
            0;
          monthlyStarsMap.set(label, starsCum);
        });

        const generatedStars: StarsDataPoint[] = [];
        monthlyStarsMap.forEach((val, key) => {
          generatedStars.push({ month: key, 'Github Stars': val });
        });

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

  return { trafficChart, starsChart, isLoading };
};
