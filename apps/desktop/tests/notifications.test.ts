import { createNotificationManager, isDndWindow, type DndSchedule } from '../src/ui/notifications';

const dndOff = (): DndSchedule => ({
  enabled: false,
  start: '22:00',
  end: '07:00',
});
const dndOn = (): DndSchedule => ({
  enabled: true,
  start: '22:00',
  end: '07:00',
});

describe('isDndWindow', () => {
  test('returns true when current time is within DND range (overnight)', () => {
    expect(isDndWindow('22:00', '07:00', '23:30')).toBe(true);
    expect(isDndWindow('22:00', '07:00', '01:00')).toBe(true);
    expect(isDndWindow('22:00', '07:00', '06:59')).toBe(true);
  });

  test('returns false when current time is outside DND range (overnight)', () => {
    expect(isDndWindow('22:00', '07:00', '08:00')).toBe(false);
    expect(isDndWindow('22:00', '07:00', '21:59')).toBe(false);
  });

  test('returns true when current time is within DND range (same day)', () => {
    expect(isDndWindow('09:00', '17:00', '12:00')).toBe(true);
    expect(isDndWindow('09:00', '17:00', '09:00')).toBe(true);
    expect(isDndWindow('09:00', '17:00', '16:59')).toBe(true);
  });

  test('returns false when current time is outside DND range (same day)', () => {
    expect(isDndWindow('09:00', '17:00', '08:59')).toBe(false);
    expect(isDndWindow('09:00', '17:00', '17:00')).toBe(false);
  });

  test('returns false for invalid start/end time', () => {
    expect(isDndWindow('abc', 'def', '12:00')).toBe(false);
  });

  test('returns false for invalid now time', () => {
    expect(isDndWindow('22:00', '07:00', 'invalid')).toBe(false);
  });

  test('handles midnight boundary', () => {
    expect(isDndWindow('00:00', '06:00', '03:00')).toBe(true);
    expect(isDndWindow('00:00', '06:00', '23:59')).toBe(false);
  });
});

describe('createNotificationManager', () => {
  test('show returns true when DND is off', () => {
    const mgr = createNotificationManager(dndOff);
    expect(mgr.show({ title: 'Test', body: 'Hello' })).toBe(true);
  });

  test('show returns false when notifications are disabled (master toggle)', () => {
    const mgr = createNotificationManager(() => ({
      enabled: false,
      start: '22:00',
      end: '07:00',
      notificationsEnabled: false,
    }));
    expect(mgr.show({ title: 'Test', body: 'Hello' })).toBe(false);
  });

  test('show returns false when DND is active', () => {
    const mgr = createNotificationManager(dndOn, { now: () => '23:30' });
    expect(mgr.show({ title: 'Test', body: 'Hello', silent: true })).toBe(false);
  });

  test('show returns false when not supported', () => {
    const mgr = createNotificationManager(dndOff, { isSupported: () => false });
    expect(mgr.show({ title: 'Test', body: 'Hello' })).toBe(false);
  });

  test('show calls showNotification when provided', () => {
    const showNotification = jest.fn(() => true);
    const mgr = createNotificationManager(dndOff, { showNotification });
    const result = mgr.show({ title: 'T', body: 'B' });
    expect(result).toBe(true);
    expect(showNotification).toHaveBeenCalledWith('T', 'B', {
      silent: undefined,
    });
  });

  test('show passes silent option', () => {
    const showNotification = jest.fn(() => true);
    const mgr = createNotificationManager(dndOff, { showNotification });
    mgr.show({ title: 'T', body: 'B', silent: true });
    expect(showNotification).toHaveBeenCalledWith('T', 'B', { silent: true });
  });

  test('isDndActive returns true during DND hours', () => {
    const mgr = createNotificationManager(dndOn);
    expect(mgr.isDndActive('01:00')).toBe(true);
  });

  test('isDndActive returns false outside DND hours', () => {
    const mgr = createNotificationManager(dndOn);
    expect(mgr.isDndActive('12:00')).toBe(false);
  });

  test('isDndActive returns false when DND is disabled', () => {
    const mgr = createNotificationManager(dndOff);
    expect(mgr.isDndActive('01:00')).toBe(false);
  });

  test('isSupported returns the deps value', () => {
    const mgr = createNotificationManager(dndOff, { isSupported: () => false });
    expect(mgr.isSupported()).toBe(false);
  });

  test('isSupported defaults to true', () => {
    const mgr = createNotificationManager(dndOff);
    expect(mgr.isSupported()).toBe(true);
  });

  test('show respects DND even with showNotification provided', () => {
    const showNotification = jest.fn(() => true);
    const mgr = createNotificationManager(dndOn, {
      showNotification,
      now: () => '23:30',
    });
    expect(mgr.show({ title: 'T', body: 'B' })).toBe(false);
    expect(showNotification).not.toHaveBeenCalled();
  });
});
