'use strict';

import fs from 'node:fs';
import path from 'node:path';

export interface DeaBiennialReminder {
  recordReportGenerated: () => void;
  getLastReportDate: () => number | null;
  isReportDue: () => boolean;
  getDaysUntilDue: () => number;
  getReminderMessage: () => string | null;
}

interface ReminderDeps {
  storagePath: string;
  now?: () => number;
}

interface ReminderData {
  lastReportDate: number;
}

const REMINDER_FILENAME = 'dea-biennial-reminder.json';

export const createDeaBiennialReminder = (deps: ReminderDeps): DeaBiennialReminder => {
  const now = deps.now || (() => Date.now());
  const filePath = path.join(deps.storagePath, REMINDER_FILENAME);

  const load = (): ReminderData | null => {
    try {
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as ReminderData;
    } catch {
      return null;
    }
  };

  const save = (data: ReminderData): void => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch {
      // Silently fail on write errors
    }
  };

  const recordReportGenerated = (): void => {
    save({ lastReportDate: now() });
  };

  const getLastReportDate = (): number | null => {
    const data = load();
    return data?.lastReportDate ?? null;
  };

  const isReportDue = (): boolean => {
    const last = getLastReportDate();
    if (last === null) return true;
    const twoYears = 2 * 365 * 86400000;
    return now() - last >= twoYears;
  };

  const getDaysUntilDue = (): number => {
    const last = getLastReportDate();
    if (last === null) return 0;
    const twoYears = 2 * 365 * 86400000;
    const dueDate = last + twoYears;
    const diff = dueDate - now();
    return Math.ceil(diff / 86400000);
  };

  const getReminderMessage = (): string | null => {
    if (isReportDue()) return 'DEA biennial inventory report is due. Please generate and submit.';
    const days = getDaysUntilDue();
    if (days <= 30) return `DEA biennial inventory report is due in ${days} days.`;
    return null;
  };

  return {
    recordReportGenerated,
    getLastReportDate,
    isReportDue,
    getDaysUntilDue,
    getReminderMessage,
  };
};
