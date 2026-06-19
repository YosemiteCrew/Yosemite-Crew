'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDeaBiennialReminder } from '../src/compliance/dea-reminder';

describe('createDeaBiennialReminder', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dea-reminder-test-'));
  const storagePath = path.join(tmpDir, 'dea-reminder');

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean up any stored file between tests
    const filePath = path.join(storagePath, 'dea-biennial-reminder.json');
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ok */
    }
  });

  test('recordReportGenerated saves current time', () => {
    const now = 5000000;
    const r = createDeaBiennialReminder({ storagePath, now: () => now });
    r.recordReportGenerated();
    expect(r.getLastReportDate()).toBe(now);
  });

  test('getLastReportDate returns null when no report recorded', () => {
    const r = createDeaBiennialReminder({ storagePath });
    expect(r.getLastReportDate()).toBeNull();
  });

  test('isReportDue returns true when no report recorded', () => {
    const r = createDeaBiennialReminder({ storagePath });
    expect(r.isReportDue()).toBe(true);
  });

  test('isReportDue returns false when report is recent', () => {
    const now = 5000000;
    const r1 = createDeaBiennialReminder({ storagePath, now: () => now });
    r1.recordReportGenerated();
    // Advance 1 year — not yet due
    const r2 = createDeaBiennialReminder({
      storagePath,
      now: () => now + 365 * 86400000,
    });
    expect(r2.isReportDue()).toBe(false);
  });

  test('isReportDue returns true when 2+ years have passed', () => {
    const now = 5000000;
    const r1 = createDeaBiennialReminder({ storagePath, now: () => now });
    r1.recordReportGenerated();
    // Advance 2 years + 1 day
    const r2 = createDeaBiennialReminder({
      storagePath,
      now: () => now + 2 * 365 * 86400000 + 86400000,
    });
    expect(r2.isReportDue()).toBe(true);
  });

  test('getDaysUntilDue returns 0 when no report recorded', () => {
    const r = createDeaBiennialReminder({ storagePath });
    expect(r.getDaysUntilDue()).toBe(0);
  });

  test('getDaysUntilDue returns positive when report is not yet due', () => {
    const now = 5000000;
    const r1 = createDeaBiennialReminder({ storagePath, now: () => now });
    r1.recordReportGenerated();
    const r2 = createDeaBiennialReminder({
      storagePath,
      now: () => now + 365 * 86400000,
    });
    const days = r2.getDaysUntilDue();
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(366);
  });

  test('getDaysUntilDue returns negative when overdue', () => {
    const now = 5000000;
    const r1 = createDeaBiennialReminder({ storagePath, now: () => now });
    r1.recordReportGenerated();
    const r2 = createDeaBiennialReminder({
      storagePath,
      now: () => now + 3 * 365 * 86400000,
    });
    expect(r2.getDaysUntilDue()).toBeLessThan(0);
  });

  test('getReminderMessage returns null when nothing is due soon', () => {
    const now = 5000000;
    const r1 = createDeaBiennialReminder({ storagePath, now: () => now });
    r1.recordReportGenerated();
    // Just 1 day after recording
    const r2 = createDeaBiennialReminder({
      storagePath,
      now: () => now + 86400000,
    });
    expect(r2.getReminderMessage()).toBeNull();
  });

  test('getReminderMessage warns when within 30 days of due', () => {
    const now = 5000000;
    const r1 = createDeaBiennialReminder({ storagePath, now: () => now });
    r1.recordReportGenerated();
    // Advance to 29 days before due
    const twoYears = 2 * 365 * 86400000;
    const r2 = createDeaBiennialReminder({
      storagePath,
      now: () => now + twoYears - 29 * 86400000,
    });
    const msg = r2.getReminderMessage();
    expect(msg).toMatch(/due in \d+ days/);
  });

  test('getReminderMessage says due when overdue', () => {
    const now = 5000000;
    const r1 = createDeaBiennialReminder({ storagePath, now: () => now });
    r1.recordReportGenerated();
    const r2 = createDeaBiennialReminder({
      storagePath,
      now: () => now + 3 * 365 * 86400000,
    });
    expect(r2.getReminderMessage()).toBe(
      'DEA biennial inventory report is due. Please generate and submit.'
    );
  });

  test('persistence across instances', () => {
    const now = 5000000;
    const r1 = createDeaBiennialReminder({ storagePath, now: () => now });
    r1.recordReportGenerated();

    // New instance should read the same data
    const r2 = createDeaBiennialReminder({ storagePath });
    expect(r2.getLastReportDate()).toBe(now);
  });
});
