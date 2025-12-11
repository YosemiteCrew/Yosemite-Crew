import {
  isBackdatedDate,
  validateMedicationFields,
  validateObservationalToolFields,
  validateStandardTaskFields,
  validateTaskForm,
} from '@/features/tasks/utils/taskValidation';
import type {TaskFormData} from '@/features/tasks/types';

describe('taskValidation', () => {
  // Mock System Time: October 15, 2023
  const mockToday = new Date('2023-10-15T12:00:00Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockToday);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const createFormData = (overrides: Partial<TaskFormData> = {}): TaskFormData => ({
    title: 'Valid Title',
    category: 'health',
    assignedTo: 'user-1',
    date: new Date('2023-10-15T10:00:00Z'), // Today
    time: new Date(),
    frequency: 'once',

    // Health/Medication specific
    healthTaskType: null,
    medicineName: 'Aspirin',
    medicineType: 'pill',
    dosages: [{time: '08:00', amount: '1'}],
    medicationFrequency: 'daily',
    startDate: new Date('2023-10-15T10:00:00Z'), // Today

    // Observational
    observationalTool: 'thermometer',

    // Others
    hygieneTaskType: null,
    dietaryTaskType: null,
    reminderEnabled: false,
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    description: '',
    ...overrides,
  } as TaskFormData);

  describe('isBackdatedDate', () => {
    it('returns false if date is null', () => {
      expect(isBackdatedDate(null)).toBe(false);
    });

    it('returns false for today', () => {
      const today = new Date('2023-10-15T00:00:00Z');
      expect(isBackdatedDate(today)).toBe(false);
    });

    it('returns false for future date', () => {
      const tomorrow = new Date('2023-10-16T00:00:00Z');
      expect(isBackdatedDate(tomorrow)).toBe(false);
    });
  });

  describe('validateMedicationFields', () => {
    it('validates required fields', () => {
      const data = createFormData({
        medicineName: '',
        medicineType: null,
        dosages: [],
        medicationFrequency: null,
        startDate: null,
      });
      const errors: any = {};

      validateMedicationFields(data, errors);

      expect(errors.medicineName).toBeDefined();
      expect(errors.medicineType).toBeDefined();
      expect(errors.dosages).toBeDefined();
      expect(errors.medicationFrequency).toBeDefined();
      expect(errors.startDate).toBeDefined();
    });

    it('validates backdated start date when checkBackdates is true (default)', () => {
      const data = createFormData({
        startDate: new Date('2023-10-14'), // Yesterday
      });
      const errors: any = {};

      validateMedicationFields(data, errors); // default true
      expect(errors.startDate).toBe('Start date cannot be in the past');
    });

    it('allows backdated start date when checkBackdates is false', () => {
      const data = createFormData({
        startDate: new Date('2023-10-14'),
      });
      const errors: any = {};

      validateMedicationFields(data, errors, false);
      expect(errors.startDate).toBeUndefined();
    });

    it('passes with valid data', () => {
      const data = createFormData();
      const errors: any = {};
      validateMedicationFields(data, errors);
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('validateObservationalToolFields', () => {
    it('validates required fields', () => {
      const data = createFormData({
        observationalTool: null,
        date: null,
        frequency: null,
      });
      const errors: any = {};

      validateObservationalToolFields(data, errors);

      expect(errors.observationalTool).toBeDefined();
      expect(errors.date).toBe('Date is required'); // Specific check for null date msg
      expect(errors.frequency).toBeDefined();
    });

    it('validates backdated date', () => {
      const data = createFormData({
        date: new Date('2023-10-14'),
      });
      const errors: any = {};

      validateObservationalToolFields(data, errors, true);
      expect(errors.date).toBe('Date cannot be in the past');
    });

    it('skips backdate validation if disabled', () => {
        const data = createFormData({ date: new Date('2023-10-14') });
        const errors: any = {};
        validateObservationalToolFields(data, errors, false);
        expect(errors.date).toBeUndefined();
    });

    it('passes valid data', () => {
        const data = createFormData();
        const errors: any = {};
        validateObservationalToolFields(data, errors);
        expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('validateStandardTaskFields', () => {
    it('validates required fields', () => {
      const data = createFormData({
        date: null,
        frequency: null,
      });
      const errors: any = {};

      validateStandardTaskFields(data, errors);

      expect(errors.date).toBeDefined();
      expect(errors.frequency).toBeDefined();
    });

    it('validates backdated date', () => {
        const data = createFormData({ date: new Date('2023-10-14') });
        const errors: any = {};
        validateStandardTaskFields(data, errors);
        expect(errors.date).toBe('Date cannot be in the past');
    });

    it('passes valid data', () => {
        const data = createFormData();
        const errors: any = {};
        validateStandardTaskFields(data, errors);
        expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('validateTaskForm', () => {
    it('validates global fields (title, assignedTo, selection)', () => {
      const data = createFormData({
          title: '   ', // Empty
          assignedTo: null,
      });
      const errors = validateTaskForm(data, null); // No selection

      expect(errors.category).toBe('Please select a task type');
      expect(errors.title).toBe('Task name is required');
      expect(errors.assignedTo).toBe('Assigned to is required');
    });

    it('skips global checks if options disable them', () => {
        const data = createFormData({
            title: 'Valid',
            assignedTo: null, // Invalid usually
        });
        // Edit mode usually passes requireTaskTypeSelection: false
        const errors = validateTaskForm(data, null, { requireTaskTypeSelection: false });

        expect(errors.category).toBeUndefined();
        expect(errors.assignedTo).toBeUndefined();
    });

    it('routes to Medication validation', () => {
        const data = createFormData({
            healthTaskType: 'give-medication',
            medicineName: '', // Invalid
        });
        const errors = validateTaskForm(data, {});
        expect(errors.medicineName).toBeDefined();
    });

    it('routes to Observational Tool validation', () => {
        const data = createFormData({
            healthTaskType: 'take-observational-tool',
            observationalTool: null, // Invalid
        });
        const errors = validateTaskForm(data, {});
        expect(errors.observationalTool).toBeDefined();
    });

    it('routes to Standard validation (default)', () => {
        const data = createFormData({
            healthTaskType: null, // Not medication or observational
            frequency: null, // Invalid
        });
        const errors = validateTaskForm(data, {});
        expect(errors.frequency).toBeDefined();
    });

    it('uses default options values', () => {
       const data = createFormData({
           title: '',
           assignedTo: null
       });
       // Call without options object
       const errors = validateTaskForm(data, {});

       // Should default requireTaskTypeSelection=true
       expect(errors.title).toBeDefined();
       expect(errors.assignedTo).toBeDefined();
    });
  });
});