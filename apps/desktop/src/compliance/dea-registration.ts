'use strict';

import fs from 'node:fs';
import path from 'node:path';

export interface DeaRegistration {
  deaNumber: string;
  registrantName: string;
  registrantAddress: string;
  drugSchedule: string;
  issueDate: string;
  expirationDate: string;
  status: 'active' | 'expired' | 'pending-renewal';
}

export interface RegistrationReminder {
  registrationId: string;
  daysUntilExpiry: number;
  notificationSent: boolean;
  lastNotifiedAt?: number;
}

export interface DeaRegistrationTracker {
  register: (reg: DeaRegistration) => void;
  getRegistration: (deaNumber: string) => DeaRegistration | undefined;
  getAllRegistrations: () => DeaRegistration[];
  removeRegistration: (deaNumber: string) => boolean;
  getExpiringSoon: (withinDays: number) => DeaRegistration[];
  getOverdue: () => DeaRegistration[];
  setCheckInterval: (intervalMs: number) => void;
  getCheckInterval: () => number;
}

interface TrackerDeps {
  now?: () => number;
  storageDir?: string;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  existsSync?: typeof fs.existsSync;
}

const REGISTRATION_FILENAME = 'dea-registrations.json';

export const createDeaRegistrationTracker = (deps: TrackerDeps = {}): DeaRegistrationTracker => {
  const now = deps.now || (() => Date.now());
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;
  const existsSync = deps.existsSync || fs.existsSync;
  const registrations = new Map<string, DeaRegistration>();

  const loadExisting = (source: string): void => {
    try {
      if (!existsSync(source)) return;
      const raw = readFileSync(source, 'utf8');
      const entries: DeaRegistration[] = JSON.parse(raw);
      if (!Array.isArray(entries)) return;
      for (const reg of entries) {
        if (reg.deaNumber && reg.registrantName && reg.expirationDate) {
          registrations.set(reg.deaNumber, reg);
        }
      }
    } catch {
      // corrupt file starts fresh
    }
  };

  let filePath: string | null = null;
  if (deps.storageDir) {
    filePath = path.join(deps.storageDir, REGISTRATION_FILENAME);
    loadExisting(filePath);
  }

  const save = (): void => {
    if (!filePath) return;
    try {
      if (deps.storageDir) mkdirSync(deps.storageDir, { recursive: true });
      writeFileSync(filePath, JSON.stringify(Array.from(registrations.values())), 'utf8');
    } catch {
      // persist must never break the app
    }
  };

  const register = (reg: DeaRegistration): void => {
    registrations.set(reg.deaNumber, { ...reg });
    save();
  };

  const getRegistration = (deaNumber: string): DeaRegistration | undefined =>
    registrations.get(deaNumber);

  const getAllRegistrations = (): DeaRegistration[] => Array.from(registrations.values());

  const removeRegistration = (deaNumber: string): boolean => {
    const removed = registrations.delete(deaNumber);
    if (removed) save();
    return removed;
  };

  const getDaysUntilExpiry = (expirationDate: string): number => {
    const expiry = new Date(expirationDate).getTime();
    const diff = expiry - now();
    return Math.ceil(diff / 86400000);
  };

  const getExpiringSoon = (withinDays: number): DeaRegistration[] =>
    getAllRegistrations().filter((reg) => {
      const days = getDaysUntilExpiry(reg.expirationDate);
      return days >= 0 && days <= withinDays;
    });

  const getOverdue = (): DeaRegistration[] =>
    getAllRegistrations().filter((reg) => getDaysUntilExpiry(reg.expirationDate) < 0);

  let checkInterval = 86400000;

  const setCheckInterval = (intervalMs: number): void => {
    checkInterval = intervalMs;
  };

  return {
    register,
    getRegistration,
    getAllRegistrations,
    removeRegistration,
    getExpiringSoon,
    getOverdue,
    setCheckInterval,
    getCheckInterval: () => checkInterval,
  };
};
