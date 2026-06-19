'use strict';

export interface NotificationOptions {
  title: string;
  body: string;
  url?: string;
  silent?: boolean;
}

export interface DndSchedule {
  enabled: boolean;
  start: string;
  end: string;
  // Master toggle. When false, no notifications are shown at all (separate from
  // the DND quiet-hours window). Defaults to true when omitted.
  notificationsEnabled?: boolean;
}

export interface NotificationManager {
  show: (options: NotificationOptions) => boolean;
  isSupported: () => boolean;
  isDndActive: (now?: string) => boolean;
}

interface ManagerDeps {
  isSupported?: () => boolean;
  showNotification?: (title: string, body: string, opts?: { silent?: boolean }) => boolean;
  // Injectable "HH:MM" clock for deterministic tests; defaults to the real time.
  now?: () => string;
}

const parseTime = (time: string): number | null => {
  const parts = time.split(':');
  if (parts.length !== 2) return null;
  const h = Number.parseInt(parts[0] || '', 10);
  const m = Number.parseInt(parts[1] || '', 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const nowMinutes = (now?: string): number => {
  if (now !== undefined) {
    const parsed = parseTime(now);
    if (parsed !== null) return parsed;
    return -1;
  }
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

const isInDndWindow = (start: string, end: string, now?: string): boolean => {
  const startMin = parseTime(start);
  const endMin = parseTime(end);
  if (startMin === null || endMin === null) return false;

  const current = nowMinutes(now);
  if (current < 0) return false;

  if (startMin <= endMin) {
    return current >= startMin && current < endMin;
  }
  return current >= startMin || current < endMin;
};

export const createNotificationManager = (
  dndSchedule: () => DndSchedule,
  deps: ManagerDeps = {}
): NotificationManager => {
  const showNotification = deps.showNotification;
  const isSupported = deps.isSupported || (() => true);

  const show = (options: NotificationOptions): boolean => {
    const schedule = dndSchedule();
    // Master toggle: when desktop notifications are disabled, never show.
    if (schedule.notificationsEnabled === false) return false;
    if (schedule.enabled && isInDndWindow(schedule.start, schedule.end, deps.now?.())) {
      return false;
    }

    if (!isSupported()) return false;

    if (showNotification) {
      return showNotification(options.title, options.body, {
        silent: options.silent,
      });
    }

    return true;
  };

  const isDndActiveFn = (now?: string): boolean => {
    const schedule = dndSchedule();
    if (!schedule.enabled) return false;
    return isInDndWindow(schedule.start, schedule.end, now);
  };

  return { show, isSupported, isDndActive: isDndActiveFn };
};

export const isDndWindow = isInDndWindow;
