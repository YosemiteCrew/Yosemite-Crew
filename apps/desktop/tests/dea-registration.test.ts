import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDeaRegistrationTracker, DeaRegistration } from '../src/compliance/dea-registration';

describe('createDeaRegistrationTracker', () => {
  const activeReg: DeaRegistration = {
    deaNumber: 'DEA-12345',
    registrantName: 'Dr. Smith',
    registrantAddress: '123 Main St',
    drugSchedule: 'II,III,IV',
    issueDate: '2024-01-15',
    expirationDate: '2027-01-14',
    status: 'active',
  };

  test('register and getRegistration work', () => {
    const tracker = createDeaRegistrationTracker();
    tracker.register(activeReg);

    const retrieved = tracker.getRegistration('DEA-12345');
    expect(retrieved).toBeDefined();
    expect(retrieved!.deaNumber).toBe('DEA-12345');
    expect(retrieved!.registrantName).toBe('Dr. Smith');
  });

  test('getAllRegistrations returns all registrations', () => {
    const tracker = createDeaRegistrationTracker();
    tracker.register(activeReg);
    tracker.register({
      ...activeReg,
      deaNumber: 'DEA-67890',
      registrantName: 'Dr. Jones',
    });

    expect(tracker.getAllRegistrations()).toHaveLength(2);
  });

  test('removeRegistration removes by DEA number', () => {
    const tracker = createDeaRegistrationTracker();
    tracker.register(activeReg);

    expect(tracker.removeRegistration('DEA-12345')).toBe(true);
    expect(tracker.getRegistration('DEA-12345')).toBeUndefined();
  });

  test('removeRegistration returns false for unknown', () => {
    const tracker = createDeaRegistrationTracker();
    expect(tracker.removeRegistration('DEA-NONEXISTENT')).toBe(false);
  });

  test('getExpiringSoon finds registrations expiring within days', () => {
    const nowMs = new Date('2026-06-01').getTime();
    const tracker = createDeaRegistrationTracker({ now: () => nowMs });

    tracker.register({
      ...activeReg,
      deaNumber: 'DEA-001',
      expirationDate: '2026-06-10',
    }); // 9 days
    tracker.register({
      ...activeReg,
      deaNumber: 'DEA-002',
      expirationDate: '2026-07-15',
    }); // 44 days
    tracker.register({
      ...activeReg,
      deaNumber: 'DEA-003',
      expirationDate: '2027-01-01',
    }); // 214 days

    const expiring = tracker.getExpiringSoon(30);
    expect(expiring).toHaveLength(1);
    expect(expiring[0].deaNumber).toBe('DEA-001');
  });

  test('getOverdue finds expired registrations', () => {
    const nowMs = new Date('2026-06-15').getTime();
    const tracker = createDeaRegistrationTracker({ now: () => nowMs });

    tracker.register({
      ...activeReg,
      deaNumber: 'DEA-001',
      expirationDate: '2026-01-15',
    }); // expired
    tracker.register({
      ...activeReg,
      deaNumber: 'DEA-002',
      expirationDate: '2027-01-14',
    }); // not expired

    const overdue = tracker.getOverdue();
    expect(overdue).toHaveLength(1);
    expect(overdue[0].deaNumber).toBe('DEA-001');
  });

  test('setCheckInterval and getCheckInterval work', () => {
    const tracker = createDeaRegistrationTracker();
    expect(tracker.getCheckInterval()).toBe(86400000);
    tracker.setCheckInterval(3600000);
    expect(tracker.getCheckInterval()).toBe(3600000);
  });

  describe('persistence', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dea-reg-persist-'));

    afterAll(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('persists registrations to disk and reloads them', () => {
      const tracker1 = createDeaRegistrationTracker({ storageDir: tmpDir });
      tracker1.register(activeReg);
      tracker1.register({
        ...activeReg,
        deaNumber: 'DEA-67890',
        registrantName: 'Dr. Jones',
      });

      // New instance reads from disk
      const tracker2 = createDeaRegistrationTracker({ storageDir: tmpDir });
      expect(tracker2.getAllRegistrations()).toHaveLength(2);
      expect(tracker2.getRegistration('DEA-12345')?.registrantName).toBe('Dr. Smith');
      expect(tracker2.getRegistration('DEA-67890')?.registrantName).toBe('Dr. Jones');
    });

    test('removeRegistration persists removal', () => {
      const tracker1 = createDeaRegistrationTracker({ storageDir: tmpDir });
      tracker1.register(activeReg);
      tracker1.removeRegistration('DEA-12345');

      const tracker2 = createDeaRegistrationTracker({ storageDir: tmpDir });
      expect(tracker2.getRegistration('DEA-12345')).toBeUndefined();
    });

    test('handles corrupt file gracefully', () => {
      const filePath = path.join(tmpDir, 'dea-registrations.json');
      fs.writeFileSync(filePath, 'not-json', 'utf8');

      const tracker = createDeaRegistrationTracker({ storageDir: tmpDir });
      expect(tracker.getAllRegistrations()).toEqual([]);
    });

    test('in-memory mode when no storageDir', () => {
      const tracker = createDeaRegistrationTracker();
      tracker.register(activeReg);
      expect(tracker.getAllRegistrations()).toHaveLength(1);
      // No file should exist
      const filePath = path.join(os.tmpdir(), 'dea-registrations.json');
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });
});
