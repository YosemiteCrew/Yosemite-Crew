import {
  buildTaskFromForm,
  formatDateToISODate,
  formatTimeToISO,
} from '@/features/tasks/utils/taskBuilder';
import type {TaskFormData} from '@/features/tasks/types';

describe('taskBuilder', () => {
  // Helper to fix timezone/current time for consistent testing
  // Using a fixed date: October 15, 2023, 10:30:45 UTC
  const mockDate = new Date('2023-10-15T10:30:45.000Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('formatDateToISODate', () => {
    it('returns null for null input', () => {
      expect(formatDateToISODate(null)).toBeNull();
    });

    it('formats date correctly with padding', () => {
      // Use a date requiring padding (Jan 5)
      const d = new Date(2023, 0, 5); // Month is 0-indexed
      expect(formatDateToISODate(d)).toBe('2023-01-05');
    });

    it('formats date correctly without padding needed', () => {
        const d = new Date(2023, 10, 15); // Nov 15
        expect(formatDateToISODate(d)).toBe('2023-11-15');
    });
  });

  describe('formatTimeToISO', () => {
    it('returns undefined for null input', () => {
      expect(formatTimeToISO(null)).toBeUndefined();
    });

    it('formats time correctly with padding', () => {
      const d = new Date(2023, 0, 1, 5, 4, 3); // 05:04:03
      expect(formatTimeToISO(d)).toBe('05:04:03');
    });

    it('formats time correctly with double digits', () => {
        const d = new Date(2023, 0, 1, 15, 14, 13); // 15:14:13
        expect(formatTimeToISO(d)).toBe('15:14:13');
      });
  });

  describe('buildTaskFromForm', () => {
    const baseForm: TaskFormData = {
      category: 'custom',
      title: 'Test Task',
      date: new Date('2023-12-01T12:00:00Z'),
      time: new Date('2023-12-01T14:30:00Z'),
      frequency: 'once',
      reminderEnabled: false,
      syncWithCalendar: false,
      attachDocuments: false,
      attachments: [],
      additionalNote: 'Some note',
      description: 'Generic desc',
      // Default empty values/nulls for unused fields to satisfy type
      dosages: [],
      medicineName: '',
      medicineType: null,
      medicationFrequency: null,
      startDate: null,
      endDate: null,
      observationalTool: null,
      chronicConditionType: null,
      healthTaskType: null,
      hygieneTaskType: null,
      dietaryTaskType: null,
      assignedTo: null,
      reminderOptions: null,
      calendarProvider: null,
      subcategory: null,
      parasitePreventionType: null,
    };

    const companionId = 'comp-123';

    it('builds a generic task correctly (default else branch)', () => {
      const result = buildTaskFromForm(baseForm, companionId);

      expect(result).toEqual({
        companionId: 'comp-123',
        category: 'custom',
        title: 'Test Task',
        date: '2023-12-01',
        // Time format depends on local time if we don't construct carefully or mock helpers.
        // Since we are testing the builder, we assume formatTimeToISO works (tested above).
        // Here we check if it passes through.
        time: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
        frequency: 'once',
        reminderEnabled: false,
        syncWithCalendar: false,
        attachDocuments: false,
        attachments: [],
        additionalNote: 'Some note',
        assignedTo: undefined,
        calendarProvider: undefined,
        reminderOptions: null,
        subcategory: undefined,
        details: {
          description: 'Generic desc',
        },
      });
    });

    it('builds a medication task correctly', () => {
        const medForm: TaskFormData = {
            ...baseForm,
            category: 'health',
            healthTaskType: 'give-medication',
            medicineName: 'Advil',
            medicineType: 'pill',
            medicationFrequency: 'daily',
            startDate: new Date('2023-11-01T00:00:00'),
            endDate: new Date('2023-11-10T00:00:00'),
            dosages: [
                {id: '1', label: 'Morning', time: '2023-01-01T08:00:00'},
            ],
            // Remove date/frequency from base to test fallbacks
            date: null,
            frequency: null,
        };

        const result = buildTaskFromForm(medForm, companionId);

        expect(result.details).toEqual({
            taskType: 'give-medication',
            medicineName: 'Advil',
            medicineType: 'pill',
            frequency: 'daily',
            startDate: '2023-11-01',
            endDate: expect.stringContaining('2023-11-10'), // Can be ISO string or date string
            dosages: [
                {id: '1', label: 'Morning', time: expect.stringMatching(/\d{2}:\d{2}:\d{2}/)},
            ]
        });
        // Fallback checks
        expect(result.date).toBe('2023-11-01'); // Fallback to startDate
        expect(result.frequency).toBe('daily'); // Fallback to medicationFrequency
    });

    it('builds an observational tool task', () => {
        const obsForm: TaskFormData = {
            ...baseForm,
            category: 'health',
            healthTaskType: 'take-observational-tool',
            observationalTool: 'thermometer',
            chronicConditionType: 'fever',
        };

        const result = buildTaskFromForm(obsForm, companionId);
        expect(result.details).toEqual({
            taskType: 'take-observational-tool',
            toolType: 'thermometer',
            chronicConditionType: 'fever',
        });
    });

    it('builds a hygiene task', () => {
        const hygieneForm: TaskFormData = {
            ...baseForm,
            category: 'hygiene',
            hygieneTaskType: 'grooming',
            description: 'Brush fur',
        };

        const result = buildTaskFromForm(hygieneForm, companionId);
        expect(result.details).toEqual({
            taskType: 'grooming',
            description: 'Brush fur',
        });
    });

    it('builds a dietary task', () => {
        const dietaryForm: TaskFormData = {
            ...baseForm,
            category: 'dietary',
            dietaryTaskType: 'feed',
            description: '1 cup',
        };

        const result = buildTaskFromForm(dietaryForm, companionId);
        expect(result.details).toEqual({
            taskType: 'feed',
            description: '1 cup',
        });
    });

    // Branch Coverage Specifics

    it('handles missing optional fields converting to undefined', () => {
        const minimalForm: TaskFormData = {
            ...baseForm,
            assignedTo: null,
            additionalNote: '',
            subcategory: null,
            calendarProvider: null,
            reminderOptions: null,
            time: null, // Test time undefined logic
        };

        const result = buildTaskFromForm(minimalForm, companionId);

        expect(result.assignedTo).toBeUndefined();
        expect(result.additionalNote).toBeUndefined();
        expect(result.subcategory).toBeUndefined();
        expect(result.calendarProvider).toBeUndefined();
        expect(result.time).toBeUndefined();
    });

    it('handles date fallbacks (no date, no startDate -> use current)', () => {
        const noDateForm: TaskFormData = {
            ...baseForm,
            date: null,
            startDate: null,
        };

        const result = buildTaskFromForm(noDateForm, companionId);
        // Should use mockDate (2023-10-15)
        expect(result.date).toBe('2023-10-15');
    });

    it('handles frequency fallback to default "once"', () => {
        const noFreqForm: TaskFormData = {
            ...baseForm,
            frequency: null,
            medicationFrequency: null,
        };
        const result = buildTaskFromForm(noFreqForm, companionId);
        expect(result.frequency).toBe('once');
    });

    it('handles medication details edge cases (missing startDate fallback)', () => {
         const medForm: TaskFormData = {
            ...baseForm,
            category: 'health',
            healthTaskType: 'give-medication',
            medicineName: 'X',
            medicineType: 'pill',
            dosages: [],
            startDate: null, // Should fallback to current date string in details
        };

        const result = buildTaskFromForm(medForm, companionId);
        const details: any = result.details;

        // Fallback logic in buildMedicationDetails:
        // startDate: formatDateToISODate(formData.startDate) || new Date().toISOString().split('T')[0]
        // mockDate is '2023-10-15T...'
        expect(details.startDate).toBe('2023-10-15');
        expect(details.endDate).toBeUndefined();
    });
  });
});
