'use client';
import { useState, useEffect } from 'react';

export type ChartDataPoint = {
  month: string;
  'Self Hosters (Unique)': number;
  'Self Hosters (Cumulative)': number;
  'Builders (Unique)': number;
  'Builders (Cumulative)': number;
  Stars: number;
};

const SUMMARY_URL =
  'https://github.com/YosemiteCrew/Yosemite-Crew/blob/github-repo-stats/YosemiteCrew/Yosemite-Crew/latest-report/summary.json';

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
    if (new Date(d.time).getTime() <= targetTimeMs) lastVal = d[valKey];
    else break;
  }
  return lastVal;
};

export const useOverviewStats = () => {
  const [combinedChart, setCombinedChart] = useState<ChartDataPoint[]>([]);
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

        const generatedChart: ChartDataPoint[] = [];

        let runningClones = 0;

        // Grab the forks from 15 days ago so we can calculate the very first "daily unique" diff
        const dayMinus15 = new Date(maxDate);
        dayMinus15.setUTCDate(maxDate.getUTCDate() - 15);
        let lastForks = getCumulative(forksData, dayMinus15.getTime(), 'forks_cumulative');

        // Loop chronologically from 14 days ago up to today
        for (let i = 14; i >= 0; i--) {
          const targetDate = new Date(maxDate);
          targetDate.setUTCDate(maxDate.getUTCDate() - i);

          const dateString = targetDate.toISOString().split('T')[0];
          const monthLabel = targetDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          });

          // Clones Data
          const cloneEntry = clonesData.find((d: any) => d.time.startsWith(dateString));
          const cloneUniqueEntry = clonesUniqueData.find((d: any) => d.time.startsWith(dateString));
          const clonesTotal = cloneEntry ? cloneEntry.clones_total : 0;
          const clonesUnique = cloneUniqueEntry ? cloneUniqueEntry.clones_unique : 0;
          runningClones += clonesTotal;

          // Forks Data (Reverse engineering daily unique from cumulative)
          const targetTimeMs = targetDate.getTime();
          const forksCum = getCumulative(forksData, targetTimeMs, 'forks_cumulative');
          const forksUnique = Math.max(0, forksCum - lastForks);
          lastForks = forksCum;

          // Stars
          const starsCum = getCumulative(starsData, targetTimeMs, 'stars_cumulative');

          generatedChart.push({
            month: monthLabel,
            'Self Hosters (Unique)': clonesUnique,
            'Self Hosters (Cumulative)': runningClones,
            'Builders (Unique)': forksUnique,
            'Builders (Cumulative)': forksCum,
            Stars: starsCum,
          });
        }

        setCombinedChart(generatedChart);
      } catch (error) {
        console.error('Failed to fetch live JSON', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepoStats();
  }, []);

  return { combinedChart, isLoading };
};
