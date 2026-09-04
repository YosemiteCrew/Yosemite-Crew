'use client';

import { useEffect, useState } from 'react';

export const PLATFORM_STATUS_URL = 'https://yosemite-crew.openstatus.dev/';
/* Exported so the stories that stub `fetch` can match on the whole URL. They
   used to test `String(input).includes('openstatus.dev')`, which CodeQL flagged
   as an incomplete URL check - it also matches `openstatus.dev.example.com` -
   and which duplicated a host fragment this module owns. */
export const PLATFORM_STATUS_API_URL = 'https://api.openstatus.dev/public/status/yosemite-crew';

export type PlatformStatus =
  | 'operational'
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage'
  | 'under_maintenance'
  | 'unknown'
  | 'incident';

export type PlatformStatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export type PlatformStatusState = {
  label: string;
  tone: PlatformStatusTone;
};

export const platformStatusByValue: Record<PlatformStatus, PlatformStatusState> = {
  operational: { label: 'All systems operational', tone: 'success' },
  degraded_performance: { label: 'Degraded performance', tone: 'warning' },
  partial_outage: { label: 'Partial outage', tone: 'danger' },
  major_outage: { label: 'Major outage', tone: 'danger' },
  under_maintenance: { label: 'Under maintenance', tone: 'warning' },
  unknown: { label: 'Status unavailable', tone: 'neutral' },
  incident: { label: 'Active incident', tone: 'danger' },
};

export const getPlatformStatusState = (status: unknown): PlatformStatusState => {
  if (typeof status !== 'string') return platformStatusByValue.unknown;
  return platformStatusByValue[status as PlatformStatus] ?? platformStatusByValue.unknown;
};

/**
 * Live platform status from the public status page.
 *
 * Starts at `unknown` rather than `operational`: a green "all systems live"
 * shown before the first response is a claim we have not verified, which is
 * exactly the failure this hook replaces. An unreachable status API also
 * resolves to `unknown`, so the UI degrades to "status unavailable" instead of
 * asserting health it cannot confirm.
 */
export const usePlatformStatus = (): PlatformStatusState => {
  const [platformStatus, setPlatformStatus] = useState<PlatformStatusState>(
    platformStatusByValue.unknown
  );

  useEffect(() => {
    let isMounted = true;

    // No fetch means no way to confirm status, which is exactly `unknown`.
    // Reading it off globalThis without this guard throws in any environment
    // that lacks it rather than degrading.
    if (typeof globalThis.fetch !== 'function') return;

    globalThis
      .fetch(PLATFORM_STATUS_API_URL)
      .then((response) => {
        if (!response.ok) return { status: 'unknown' };
        return response.json() as Promise<{ status?: string }>;
      })
      .then((data) => {
        if (isMounted) setPlatformStatus(getPlatformStatusState(data.status));
      })
      .catch(() => {
        if (isMounted) setPlatformStatus(platformStatusByValue.unknown);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return platformStatus;
};
