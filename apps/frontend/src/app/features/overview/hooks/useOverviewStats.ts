'use client';
import { useState, useEffect } from 'react';

export type RepoStatsSummary = {
  owner: string;
  repo: string;
  generated_at_utc: string | null;
  views: { unique: number; total: number };
  clones: { unique: number; total: number };
};

export type ChartDataPoint = {
  month: string;
  'Self Hosters'?: number;
  Builders?: number;
  Stars?: number;
};

// Locked to the real URL provided by Harshvardhan
const SUMMARY_URL =
  'https://raw.githubusercontent.com/harshvardhan-yc/Yosemite-Crew/github-repo-stats/YosemiteCrew/Yosemite-Crew/latest-report/summary.json';

// Helper function to extract data from the dynamic hash keys in the JSON (e.g., data-355991c...)
const extractChartData = (json: any, chartKey: string) => {
  if (!json?.charts?.[chartKey]?.datasets) return [];
  const datasets = json.charts[chartKey].datasets;
  const dataKey = Object.keys(datasets)[0];
  return datasets[dataKey] || [];
};

export const useOverviewStats = () => {
  const [data, setData] = useState<RepoStatsSummary | null>(null);
  const [clonesChart, setClonesChart] = useState<ChartDataPoint[]>([]);
  const [forksChart, setForksChart] = useState<ChartDataPoint[]>([]);
  const [starsChart, setStarsChart] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRepoStats = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${SUMMARY_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load repo stats');

        const json = await res.json();

        // 1. Extract the arrays from the complex JSON structure
        const viewsData = extractChartData(json, '#views_total');
        const clonesData = extractChartData(json, '#clones_total');
        const forksData = extractChartData(json, '#forks');
        const starsData = extractChartData(json, '#stargazers');

        // 2. Calculate the exact totals (fixes the 'null' output in the JSON)
        const processedData: RepoStatsSummary = {
          owner: json.owner,
          repo: json.repo,
          generated_at_utc: json.generated_at_utc,
          views: {
            total:
              json.views?.total ||
              viewsData.reduce((acc: number, curr: any) => acc + (curr.views_total || 0), 0),
            unique:
              json.views?.unique ||
              viewsData.reduce((acc: number, curr: any) => acc + (curr.views_unique || 0), 0),
          },
          clones: {
            total:
              json.clones?.total ||
              clonesData.reduce((acc: number, curr: any) => acc + (curr.clones_total || 0), 0),
            unique:
              json.clones?.unique ||
              clonesData.reduce((acc: number, curr: any) => acc + (curr.clones_unique || 0), 0),
          },
        };
        setData(processedData);

        // 3. Format Charts (Sliced to last 30 events for a clean UI timeline)
        setStarsChart(
          starsData.slice(-30).map((d: any) => ({
            month: new Date(d.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            Stars: d.stars_cumulative,
          }))
        );

        setForksChart(
          forksData.slice(-30).map((d: any) => ({
            month: new Date(d.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            Builders: d.forks_cumulative,
          }))
        );

        setClonesChart(
          clonesData.map((d: any) => ({
            month: new Date(d.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            'Self Hosters': d.clones_total,
          }))
        );
      } catch (error) {
        console.error('Failed to fetch live JSON', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepoStats();
  }, []);

  return { data, clonesChart, forksChart, starsChart, isLoading };
};
