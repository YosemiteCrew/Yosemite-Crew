'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getStorageItem, setJsonStorageItem, setStorageItem } from '@/app/lib/browserStorage';

export interface CloudUsersStats {
  /** Localized total signups across the platform, e.g. '346'. */
  totalUsers: string | null;
  /** ISO timestamp of the newest signup. Null when unknown. */
  latestSignupAt: string | null;
}

const EMPTY_STATS: CloudUsersStats = { totalUsers: null, latestSignupAt: null };

const CACHE_KEY = 'yc_cloud_users_v1';
const TS_KEY = 'yc_cloud_users_ts_v1';
const TTL_MS = 5 * 60 * 1000;
const ENDPOINT = '/api/community/cloud-users';

/**
 * Field-level runtime check, applied at both trust boundaries this hook
 * crosses: sessionStorage (writable by anything with script access to the
 * page, e.g. an XSS or a malicious extension) and the fetch response. An
 * unchecked cast here would let a shape-invalid value (say, `totalUsers` as
 * an object) reach CountUp, which calls string methods on it during render
 * with no local error boundary - crashing the whole homepage, not just this
 * tile.
 */
const sanitize = (value: unknown): CloudUsersStats => {
  if (!value || typeof value !== 'object') return EMPTY_STATS;
  const { totalUsers, latestSignupAt } = value as Record<string, unknown>;
  return {
    totalUsers: typeof totalUsers === 'string' ? totalUsers : null,
    latestSignupAt: typeof latestSignupAt === 'string' ? latestSignupAt : null,
  };
};

/**
 * Session-cache subscription, same contract as useGithubStats: writes emit,
 * subscribed instances re-read. Kept as its own store rather than sharing
 * useGithubStats's - this is a different upstream (SuperAdmin, not GitHub/
 * Discord) with its own cache key and TTL.
 */
const listeners = new Set<() => void>();

const subscribe = (onStoreChange: () => void): (() => void) => {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
};

const emitChange = (): void => {
  for (const listener of listeners) listener();
};

let snapshotRaw: string | null = null;
let snapshot: CloudUsersStats = EMPTY_STATS;

const getSnapshot = (): CloudUsersStats => {
  const raw = getStorageItem('session', CACHE_KEY);
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    try {
      snapshot = raw ? sanitize(JSON.parse(raw)) : EMPTY_STATS;
    } catch {
      snapshot = EMPTY_STATS;
    }
  }
  return snapshot;
};

/** SSR (and the hydrating first client render) always shows the loading placeholder. */
const getServerSnapshot = (): CloudUsersStats => EMPTY_STATS;

const isCacheFresh = (): boolean => {
  const raw = getStorageItem('session', TS_KEY);
  if (!raw) return false;
  const savedAt = Number.parseInt(raw, 10);
  return Number.isFinite(savedAt) && Date.now() - savedAt < TTL_MS;
};

let inFlight: Promise<CloudUsersStats> | null = null;

const runFetch = async (): Promise<CloudUsersStats> => {
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) return EMPTY_STATS;
    const fresh = sanitize(await res.json());
    // The route reports an upstream failure as a 200 with a null total (see
    // its own CACHED_HEADERS/UNCACHED_HEADERS choice) rather than a non-OK
    // status, so `res.ok` alone can't distinguish success from failure here.
    // Treating a null total as success would overwrite a good cached value
    // with nulls on every transient upstream outage.
    if (fresh.totalUsers === null) return EMPTY_STATS;
    setJsonStorageItem('session', CACHE_KEY, fresh);
    setStorageItem('session', TS_KEY, String(Date.now()));
    emitChange();
    return fresh;
  } catch {
    return EMPTY_STATS;
  }
};

const load = (): Promise<CloudUsersStats> => {
  inFlight ??= runFetch().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

/**
 * Total platform signups and the newest one, for the marketing "building in
 * public" stats. Same session-cache/dedup shape as useGithubStats: several
 * components can mount this at once without each firing its own request.
 */
export function useCloudUsers(): CloudUsersStats {
  const cached = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!isCacheFresh()) void load();
  }, []);

  return cached;
}
