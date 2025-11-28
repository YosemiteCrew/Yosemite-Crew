import {initializeFormDataFromTask} from '../../../../../src/features/tasks/screens/EditTaskScreen/initialization';
import type {Task} from '@/features/tasks/types';

describe('EditTaskScreen Initialization', () => {
  // Use a fixed date for testing "now" scenarios
  const mockNow = new Date('2023-11-15T10:00:00.000Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const baseTask: Task = {
    id: 't1',
    title: 'Base Task',
    category: 'custom',
    companionId: 'c1',
    status: 'pending',
    date: '2023-11-15',
    time: '14:30:00',
    frequency: 'once',
    reminderEnabled: false,
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    additionalNote: '',
  };

  describe('initializeFormDataFromTask', () => {
    it('initializes basic task data correctly', () => {
      const formData = initializeFormDataFromTask(baseTask);

      expect(formData.title).toBe('Base Task');
      expect(formData.category).toBe('custom');
      expect(formData.date).toEqual(new Date(2023, 10, 15)); // Month is 0-indexed
      expect(formData.time?.getHours()).toBe(14);
      expect(formData.time?.getMinutes()).toBe(30);
      expect(formData.frequency).toBe('once');
    });

    it('handles missing date strings gracefully (returns null date)', () => {
      const task = { ...baseTask, date: null as any }; // Force null for test
      const formData = initializeFormDataFromTask(task);
      // The function returns new Date() if dateStr is missing
      expect(formData.date).toEqual(mockNow);
    });

    it('handles invalid date strings (returns null date -> defaults to new Date())', () => {
      const task = { ...baseTask, date: 'invalid-date' };
      const formData = initializeFormDataFromTask(task);
      expect(formData.date).toEqual(mockNow);
    });

    it('handles missing/invalid time strings gracefully (returns null time)', () => {
      const task1 = { ...baseTask, time: null as any };
      const formData1 = initializeFormDataFromTask(task1);
      expect(formData1.time).toBeNull();

      const task2 = { ...baseTask, time: 'invalid:time' };
      const formData2 = initializeFormDataFromTask(task2);
      expect(formData2.time).toBeNull();
    });

    describe('Medication Data Extraction', () => {
      it('extracts medication details correctly', () => {
        const medTask: Task = {
          ...baseTask,
          category: 'health',
          details: {
            taskType: 'give-medication',
            medicineName: 'Aspirin',
            medicineType: 'pill',
            frequency: 'daily',
            startDate: '2023-11-01',
            endDate: '2023-11-10',
            dosages: [
              { time: '08:00:00', amount: '1' },
              { time: '2023-11-15T20:00:00.000Z', amount: '1' }, // Already ISO
            ],
            description: 'Take with food'
          } as any
        };

        const formData = initializeFormDataFromTask(medTask);

        expect(formData.healthTaskType).toBe('give-medication');
        expect(formData.medicineName).toBe('Aspirin');
        expect(formData.medicineType).toBe('pill');
        expect(formData.medicationFrequency).toBe('daily');
        expect(formData.startDate).toEqual(new Date(2023, 10, 1));
        expect(formData.endDate).toEqual(new Date(2023, 10, 10));
        expect(formData.description).toBe('Take with food');

        // Check normalized dosages
        expect(formData.dosages).toHaveLength(2);
        // First one normalized from time string to ISO for "today"
        const expectedDate1 = new Date(mockNow);
        expectedDate1.setHours(8, 0, 0, 0);
        expect(formData.dosages![0].time).toBe(expectedDate1.toISOString());
        // Second one kept as is
        expect(formData.dosages![1].time).toBe('2023-11-15T20:00:00.000Z');
      });

      it('handles null medication details gracefully', () => {
        const task: Task = { ...baseTask, category: 'health', details: null as any }; // extracted as null
        const formData = initializeFormDataFromTask(task);

        expect(formData.medicineName).toBe('');
        expect(formData.medicineType).toBeNull();
        expect(formData.dosages).toEqual([]);
      });

       it('handles invalid dosage time format (fallback to now)', () => {
        const medTask: Task = {
          ...baseTask,
          category: 'health',
          details: {
            taskType: 'give-medication',
            dosages: [{ time: 'invalid', amount: '1' }],
          } as any
        };
        const formData = initializeFormDataFromTask(medTask);
        // normalizeDosageTime fallback
        expect(formData.dosages![0].time).toBe(mockNow.toISOString());
      });

       it('handles partial time dosage format with NaNs', () => {
         // 'xx:xx' splits but maps to NaN
        const medTask: Task = {
          ...baseTask,
          category: 'health',
          details: {
            taskType: 'give-medication',
            dosages: [{ time: 'xx:xx', amount: '1' }],
          } as any
        };
        const formData = initializeFormDataFromTask(medTask);
        expect(formData.dosages![0].time).toBe(mockNow.toISOString());
      });

      it('handles null dosage time', () => {
        const medTask: Task = {
          ...baseTask,
          category: 'health',
          details: {
            taskType: 'give-medication',
            dosages: [{ time: null as any, amount: '1' }],
          } as any
        };
        const formData = initializeFormDataFromTask(medTask);
        expect(formData.dosages![0].time).toBe(mockNow.toISOString());
      });
    });

    describe('Observational Tool Data Extraction', () => {
      it('extracts observational tool details correctly', () => {
        const obsTask: Task = {
          ...baseTask,
          category: 'health',
          details: {
            taskType: 'take-observational-tool',
            toolType: 'thermometer',
            chronicConditionType: 'fever'
          } as any
        };

        const formData = initializeFormDataFromTask(obsTask);

        expect(formData.healthTaskType).toBe('take-observational-tool');
        expect(formData.observationalTool).toBe('thermometer');
        expect(formData.chronicConditionType).toBe('fever');
      });

      it('handles null observational details', () => {
         const task: Task = { ...baseTask, category: 'health' }; // No details
         const formData = initializeFormDataFromTask(task);
         expect(formData.observationalTool).toBeNull();
      });
    });

    describe('Category Specific Extractions', () => {
      it('extracts hygiene task type', () => {
        const task: Task = {
            ...baseTask,
            category: 'hygiene',
            details: { taskType: 'grooming' } as any
        };
        const formData = initializeFormDataFromTask(task);
        expect(formData.hygieneTaskType).toBe('grooming');
        expect(formData.dietaryTaskType).toBeNull();
      });

      it('extracts dietary task type', () => {
         const task: Task = {
            ...baseTask,
            category: 'dietary',
            details: { taskType: 'feed' } as any
        };
        const formData = initializeFormDataFromTask(task);
        expect(formData.dietaryTaskType).toBe('feed');
        expect(formData.hygieneTaskType).toBeNull();
      });

      it('handles null/undefined task type inside details', () => {
          const task: Task = { ...baseTask, category: 'hygiene', details: {} as any };
          const formData = initializeFormDataFromTask(task);
          expect(formData.hygieneTaskType).toBeUndefined();
      });
    });

    describe('Field Mapping & Fallbacks', () => {
        it('maps optional fields correctly', () => {
            const fullTask: Task = {
                ...baseTask,
                subcategory: 'bath' as any,
                assignedTo: 'user1',
                reminderEnabled: true,
                reminderOptions: { alertTime: '10m' } as any,
                syncWithCalendar: true,
                calendarProvider: 'google',
                attachDocuments: true,
                attachments: ['doc1'],
                additionalNote: 'Note',
                details: { description: 'Desc' } as any
            };

            const formData = initializeFormDataFromTask(fullTask);

            expect(formData.subcategory).toBe('bath');
            expect(formData.assignedTo).toBe('user1');
            expect(formData.reminderEnabled).toBe(true);
            expect(formData.syncWithCalendar).toBe(true);
            expect(formData.attachments).toEqual(['doc1']);
            expect(formData.description).toBe('Desc');
        });

        it('provides fallbacks for missing optional fields', () => {
            const minimalTask: Task = {
                ...baseTask,
                assignedTo: undefined,
                reminderOptions: undefined,
                calendarProvider: undefined,
                attachments: undefined as any, // Simulate missing
                additionalNote: undefined as any,
                details: undefined
            };

            const formData = initializeFormDataFromTask(minimalTask);

            expect(formData.assignedTo).toBeNull();
            expect(formData.reminderOptions).toBeNull();
            expect(formData.calendarProvider).toBeNull();
            expect(formData.attachments).toEqual([]); // Fallback to empty array
            expect(formData.additionalNote).toBe(''); // Fallback to empty string
            expect(formData.description).toBe('');
        });

        it('handles description extraction when details is missing', () => {
            const task = { ...baseTask, details: undefined };
            const formData = initializeFormDataFromTask(task);
            expect(formData.description).toBe('');
        });

         it('handles description extraction when details exists but no description', () => {
            const task = { ...baseTask, details: { someOtherProp: 1 } as any };
            const formData = initializeFormDataFromTask(task);
            expect(formData.description).toBe('');
        });
    });
  });
});