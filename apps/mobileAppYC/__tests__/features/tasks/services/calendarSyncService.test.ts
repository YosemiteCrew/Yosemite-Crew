import {
  createCalendarEventForTask,
  removeCalendarEvents,
  openCalendarEvent,
} from '../../../../src/features/tasks/services/calendarSyncService';
import RNCalendarEvents from 'react-native-calendar-events';
import { Alert, Linking, Platform } from 'react-native';
import type { Task } from '../../../../src/features/tasks/types';

// --- Mocks ---

jest.mock('react-native-calendar-events', () => ({
  checkPermissions: jest.fn(),
  requestPermissions: jest.fn(),
  saveEvent: jest.fn(),
  removeEvent: jest.fn(),
  findEventById: jest.fn(),
}));

jest.spyOn(Alert, 'alert');
jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});

// --- Mock Data ---

const baseTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  status: 'PENDING',
  category: 'admin', // Use a valid category string or cast 'as any'
  date: '2025-01-01',
  time: '10:00:00',
  syncWithCalendar: true,
  calendarProvider: 'cal-1',
  details: {},
  reminderOffsetMinutes: 15,
} as any; // Cast to 'any' to avoid strict union property checks for base object

describe('calendarSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    // Default to authorized for most tests
    (RNCalendarEvents.checkPermissions as jest.Mock).mockResolvedValue('authorized');
    (RNCalendarEvents.saveEvent as jest.Mock).mockResolvedValue('evt-1');
  });

  // =========================================================================
  // 1. Permission Handling
  // =========================================================================
  describe('Permission Handling', () => {
    it('returns null and alerts if permission denied initially and after request', async () => {
      (RNCalendarEvents.checkPermissions as jest.Mock).mockResolvedValue('denied');
      (RNCalendarEvents.requestPermissions as jest.Mock).mockResolvedValue('denied');

      const result = await createCalendarEventForTask(baseTask);

      expect(result).toBeNull();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Calendar permission needed',
        expect.stringContaining('Enable calendar access'),
        expect.any(Array)
      );
    });

    it('proceeds if permission is authorized initially', async () => {
      (RNCalendarEvents.checkPermissions as jest.Mock).mockResolvedValue('authorized');

      const result = await createCalendarEventForTask(baseTask);
      expect(result).toBe('evt-1');
      expect(RNCalendarEvents.requestPermissions).not.toHaveBeenCalled();
    });

    it('proceeds if permission is authorized after request', async () => {
      (RNCalendarEvents.checkPermissions as jest.Mock).mockResolvedValue('undetermined');
      (RNCalendarEvents.requestPermissions as jest.Mock).mockResolvedValue('authorized');

      const result = await createCalendarEventForTask(baseTask);
      expect(result).toBe('evt-1');
    });

    it('handles missing RNCalendarEvents library gracefully', async () => {
      const originalCheck = RNCalendarEvents.checkPermissions;
      // Simulate library not linked
      (RNCalendarEvents as any).checkPermissions = undefined;

      const result = await createCalendarEventForTask(baseTask);

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('unavailable or not linked'));

      // Restore
      (RNCalendarEvents as any).checkPermissions = originalCheck;
    });

    it('handles permission check error', async () => {
      (RNCalendarEvents.checkPermissions as jest.Mock).mockRejectedValue(new Error('Native Error'));

      const result = await createCalendarEventForTask(baseTask);
      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Permission check failed'), expect.anything());
    });
  });

  // =========================================================================
  // 2. Simple Event Creation
  // =========================================================================
  describe('createCalendarEventForTask (Simple)', () => {
    it('creates a basic event with correct details', async () => {
      await createCalendarEventForTask(baseTask, 'Buddy', 'Dr. Smith');

      expect(RNCalendarEvents.saveEvent).toHaveBeenCalledWith(
        'Test Task',
        expect.objectContaining({
          startDate: expect.stringContaining('2025-01-01'),
          notes: expect.stringContaining('Companion: Buddy'),
          alarms: [{ date: -15 }],
        })
      );
    });

    it('uses default date if task date/time missing', async () => {
      const noDateTask = { ...baseTask, date: undefined, time: undefined, dueAt: undefined };
      await createCalendarEventForTask(noDateTask as any);
      expect(RNCalendarEvents.saveEvent).toHaveBeenCalled();
    });

    it('uses date + default time (09:00) if time missing', async () => {
       const dateOnlyTask = { ...baseTask, date: '2025-01-01', time: undefined };
       await createCalendarEventForTask(dateOnlyTask as any);

       expect(RNCalendarEvents.saveEvent).toHaveBeenCalledWith(
           expect.anything(),
           expect.objectContaining({
               startDate: expect.stringContaining('2025-01-01'),
           })
       );
    });

    it('handles recurrence: daily', async () => {
      const recurringTask = { ...baseTask, frequency: 'daily' } as any;
      await createCalendarEventForTask(recurringTask);

      expect(RNCalendarEvents.saveEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ recurrence: 'daily' })
      );
    });

    it('handles recurrence with end date (recurrenceRule)', async () => {
      // Cast as any because 'details' partial match
      const endDateTask = {
         ...baseTask,
         frequency: 'weekly',
         details: { endDate: '2025-12-31' }
      } as any;

      await createCalendarEventForTask(endDateTask);

      expect(RNCalendarEvents.saveEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          recurrenceRule: {
            frequency: 'weekly',
            interval: 1,
            endDate: '2025-12-31',
          },
        })
      );
    });

    it('handles medication and observational tool notes', async () => {
      // Cast as any to bypass strict type requirements for Medicine details
      const complexTask = {
        ...baseTask,
        description: 'Take pills',
        additionalNote: 'With food',
        details: {
          medicineName: 'Aspirin',
          medicineType: 'Tablet',
          toolType: 'Pain Scale',
        },
      } as any;

      await createCalendarEventForTask(complexTask);

      const callArgs = (RNCalendarEvents.saveEvent as jest.Mock).mock.calls[0][1];
      const notes = callArgs.notes;

      expect(notes).toContain('📝 Take pills');
      expect(notes).toContain('💡 Note: With food');
      expect(notes).toContain('💊 MEDICATION');
      expect(notes).toContain('Medicine: Aspirin');
      expect(notes).toContain('Type: Tablet');
      expect(notes).toContain('📋 Observational Tool: Pain Scale');
    });

    it('handles saveEvent failure', async () => {
      (RNCalendarEvents.saveEvent as jest.Mock).mockRejectedValue(new Error('Calendar Full'));

      const result = await createCalendarEventForTask(baseTask);
      expect(result).toBeNull();
      expect(Alert.alert).toHaveBeenCalledWith('Calendar', expect.stringContaining('Unable to add'));
    });
  });

  // =========================================================================
  // 3. Medication Dosage Events (Loop Logic)
  // =========================================================================
  describe('createDosageCalendarEvents', () => {
    it('creates multiple events for medication dosages', async () => {
      // Cast as any to bypass TaskSpecificDetails union
      const dosageTask = {
        ...baseTask,
        details: {
          medicineName: 'Advil',
          dosages: [
            { id: 'd1', label: 'Morning', time: '08:00' },
            { id: 'd2', label: 'Evening', time: '20:00' },
          ],
        },
      } as any;

      (RNCalendarEvents.saveEvent as jest.Mock)
        .mockResolvedValueOnce('evt-1')
        .mockResolvedValueOnce('evt-2');

      const result = await createCalendarEventForTask(dosageTask);

      expect(RNCalendarEvents.saveEvent).toHaveBeenCalledTimes(2);

      expect(RNCalendarEvents.saveEvent).toHaveBeenCalledWith(
        'Test Task - Morning',
        expect.objectContaining({
            startDate: expect.any(String),
            notes: expect.stringContaining('Dosage: Morning')
        })
      );

      expect(RNCalendarEvents.saveEvent).toHaveBeenCalledWith(
        'Test Task - Evening',
        expect.objectContaining({
            startDate: expect.any(String),
        })
      );

      expect(result).toBe('evt-1,evt-2');
    });

    it('skips invalid dosage times', async () => {
       const invalidTask = {
           ...baseTask,
           details: {
               medicineName: 'Drug',
               dosages: [{ id: 'd1', label: 'Bad', time: 'invalid-time' }]
           }
       } as any;

       const result = await createCalendarEventForTask(invalidTask);

       expect(RNCalendarEvents.saveEvent).not.toHaveBeenCalled();
       expect(result).toBeNull();
       expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid dosage time'), 'invalid-time');
    });

    it('handles error during dosage creation loop', async () => {
        (RNCalendarEvents.saveEvent as jest.Mock).mockRejectedValue(new Error('Fail'));

        const result = await createCalendarEventForTask({
            ...baseTask,
            details: {
              medicineName: 'Advil',
              dosages: [{ id: 'd1', label: 'Morning', time: '08:00' }],
            },
        } as any);

        expect(result).toBeNull();
        expect(Alert.alert).toHaveBeenCalledWith('Calendar', expect.stringContaining('Unable to add medication'));
    });

    it('sets default alarms if reminderOffset is missing', async () => {
        const noReminderTask = {
            ...baseTask,
            reminderOffsetMinutes: undefined,
            reminderOptions: { method: 'alert', time: 10 },
            details: { medicineName: 'M', dosages: [{id:'1', label:'L', time:'10:00'}] }
        } as any;

        await createCalendarEventForTask(noReminderTask);

        expect(RNCalendarEvents.saveEvent).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ alarms: [{ date: -15 }] })
        );
    });
  });

  // =========================================================================
  // 4. Remove Events
  // =========================================================================
  describe('removeCalendarEvents', () => {
    it('removes single event', async () => {
      await removeCalendarEvents('evt-1');
      expect(RNCalendarEvents.removeEvent).toHaveBeenCalledWith('evt-1');
    });

    it('removes multiple events (comma separated)', async () => {
      await removeCalendarEvents('evt-1, evt-2,   evt-3');
      expect(RNCalendarEvents.removeEvent).toHaveBeenCalledTimes(3);
    });

    it('does nothing if id string is empty', async () => {
      await removeCalendarEvents(null);
      expect(RNCalendarEvents.removeEvent).not.toHaveBeenCalled();
    });

    it('aborts if permission denied', async () => {
      (RNCalendarEvents.checkPermissions as jest.Mock).mockResolvedValue('denied');
      (RNCalendarEvents.requestPermissions as jest.Mock).mockResolvedValue('denied');

      await removeCalendarEvents('evt-1');
      expect(RNCalendarEvents.removeEvent).not.toHaveBeenCalled();
    });

    it('continues removing if one fails', async () => {
      (RNCalendarEvents.removeEvent as jest.Mock)
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error('Not found'))
          .mockResolvedValueOnce(true);

      await removeCalendarEvents('1,2,3');
      expect(RNCalendarEvents.removeEvent).toHaveBeenCalledTimes(3);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to remove event'), '2', expect.anything());
    });

    it('handles catastrophic failure in removal function', async () => {
       // Force a crash inside the function logic by making split fail or permission check crash
       (RNCalendarEvents.checkPermissions as jest.Mock).mockRejectedValue(new Error('Crash'));

       await removeCalendarEvents('1');
    });
  });

  // =========================================================================
  // 5. Open Event
  // =========================================================================
  describe('openCalendarEvent', () => {
    it('opens iOS calendar URL with event time', async () => {
      Platform.OS = 'ios';
      const mockDate = new Date('2025-01-01T10:00:00Z');
      (RNCalendarEvents.findEventById as jest.Mock).mockResolvedValue({ startDate: mockDate.toISOString() });

      await openCalendarEvent('evt-1');

      const expectedSeconds = Math.floor(mockDate.getTime() / 1000);
      expect(Linking.openURL).toHaveBeenCalledWith(`calshow:${expectedSeconds}`);
    });

    it('opens Android calendar URL with event time', async () => {
      Platform.OS = 'android';
      const mockDate = new Date('2025-01-01T10:00:00Z');
      (RNCalendarEvents.findEventById as jest.Mock).mockResolvedValue({ startDate: mockDate.toISOString() });

      await openCalendarEvent('evt-1');

      const expectedMs = mockDate.getTime();
      expect(Linking.openURL).toHaveBeenCalledWith(`content://com.android.calendar/time/${expectedMs}`);
    });

    it('uses fallback date if event not found', async () => {
      Platform.OS = 'ios';
      (RNCalendarEvents.findEventById as jest.Mock).mockResolvedValue(null);
      const fallback = new Date('2025-02-01');

      await openCalendarEvent('evt-1', fallback);

      const expectedSeconds = Math.floor(fallback.getTime() / 1000);
      expect(Linking.openURL).toHaveBeenCalledWith(`calshow:${expectedSeconds}`);
    });

    it('alerts if permission denied', async () => {
       (RNCalendarEvents.checkPermissions as jest.Mock).mockResolvedValue('denied');
       (RNCalendarEvents.requestPermissions as jest.Mock).mockResolvedValue('denied');

       await openCalendarEvent('1');
       expect(Linking.openURL).not.toHaveBeenCalled();
    });

    it('alerts if URL not supported', async () => {
       (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
       (RNCalendarEvents.findEventById as jest.Mock).mockResolvedValue({ startDate: new Date().toISOString() });

       await openCalendarEvent('1');
       expect(Linking.openURL).not.toHaveBeenCalled();
       expect(Alert.alert).toHaveBeenCalledWith('Calendar', expect.stringContaining('Please open your calendar app'));
    });

    it('handles errors during open', async () => {
       (RNCalendarEvents.findEventById as jest.Mock).mockRejectedValue(new Error('Read Fail'));
       await openCalendarEvent('1');
       expect(Alert.alert).toHaveBeenCalledWith('Calendar', expect.stringContaining('Please open your calendar app'));
    });
  });
});