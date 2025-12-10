import {
  getUpdatedFormDataFromTaskType,
  getErrorFieldsToClear,
  isMedicationForm,
  isObservationalToolForm,
  isSimpleForm,
} from '@/features/tasks/utils/taskFormHelpers';
import type {TaskTypeSelection, TaskFormData} from '@/features/tasks/types';

describe('taskFormHelpers', () => {
  // Helper to create a basic mock selection
  const createSelection = (overrides: Partial<TaskTypeSelection> = {}): TaskTypeSelection => ({
    category: 'custom',
    label: 'Test Task',
    taskType: 'generic',
    ...overrides,
  });

  // Helper to create basic form data (unused by the function but required by TS)
  const mockCurrentData: TaskFormData = {} as any;

  describe('getUpdatedFormDataFromTaskType', () => {
    it('updates basic fields from selection', () => {
      const selection = createSelection({
        category: 'custom',
        label: 'New Title',
        subcategory: 'sub-1',
        parasitePreventionType: 'flea',
        chronicConditionType: 'arthritis',
      });

      const updates = getUpdatedFormDataFromTaskType(selection, mockCurrentData);

      expect(updates.category).toBe('custom');
      expect(updates.title).toBe('New Title');
      expect(updates.subcategory).toBe('sub-1');
      expect(updates.parasitePreventionType).toBe('flea');
      expect(updates.chronicConditionType).toBe('arthritis');
    });

    describe('Health Category Logic', () => {
      it('sets healthTaskType and preserves medication fields when medication is selected', () => {
        const selection = createSelection({
          category: 'health',
          taskType: 'give-medication',
        });

        const updates = getUpdatedFormDataFromTaskType(selection, mockCurrentData);

        expect(updates.healthTaskType).toBe('give-medication');
        // Should NOT clear medication fields (keys should be undefined in updates)
        expect(updates).not.toHaveProperty('medicineName');
        expect(updates).not.toHaveProperty('medicineType');
        // Should clear observational tool as it's not observational
        expect(updates.observationalTool).toBeNull();
      });

      it('sets healthTaskType and preserves observational fields when tool is selected', () => {
        const selection = createSelection({
          category: 'health',
          taskType: 'take-observational-tool',
        });

        const updates = getUpdatedFormDataFromTaskType(selection, mockCurrentData);

        expect(updates.healthTaskType).toBe('take-observational-tool');
        // Should NOT clear observational tool
        expect(updates).not.toHaveProperty('observationalTool');
        // Should clear medication fields
        expect(updates.medicineName).toBe('');
        expect(updates.medicineType).toBeNull();
        expect(updates.startDate).toBeDefined(); // Checks that it resets date
      });

      it('clears both medication and observational fields for generic health tasks', () => {
        const selection = createSelection({
          category: 'health',
          taskType: 'vaccination', // Neither med nor obs
        });

        const updates = getUpdatedFormDataFromTaskType(selection, mockCurrentData);

        expect(updates.healthTaskType).toBe('vaccination');
        // Clears Meds
        expect(updates.medicineName).toBe('');
        expect(updates.medicineType).toBeNull();
        // Clears Obs
        expect(updates.observationalTool).toBeNull();
      });
    });

    describe('Non-Health Category Logic', () => {
      it('clears all health fields when switching to non-health category', () => {
        const selection = createSelection({
          category: 'custom',
        });

        const updates = getUpdatedFormDataFromTaskType(selection, mockCurrentData);

        expect(updates.healthTaskType).toBeNull();
        expect(updates.medicineName).toBe('');
        expect(updates.medicineType).toBeNull();
        expect(updates.observationalTool).toBeNull();
        expect(updates.startDate).toBeInstanceOf(Date);
        expect(updates.endDate).toBeNull();
      });

      it('sets hygieneTaskType correctly', () => {
        const selection = createSelection({
          category: 'hygiene',
          taskType: 'bath',
        });
        const updates = getUpdatedFormDataFromTaskType(selection, mockCurrentData);
        expect(updates.hygieneTaskType).toBe('bath');
        expect(updates.dietaryTaskType).toBeNull();
      });

      it('sets dietaryTaskType correctly', () => {
        const selection = createSelection({
          category: 'dietary',
          taskType: 'food',
        });
        const updates = getUpdatedFormDataFromTaskType(selection, mockCurrentData);
        expect(updates.dietaryTaskType).toBe('food');
        expect(updates.hygieneTaskType).toBeNull();
      });

       it('clears hygiene/dietary types if category does not match', () => {
        const selection = createSelection({
          category: 'custom',
          taskType: 'generic',
        });
        const updates = getUpdatedFormDataFromTaskType(selection, mockCurrentData);
        expect(updates.dietaryTaskType).toBeNull();
        expect(updates.hygieneTaskType).toBeNull();
      });
    });
  });

  describe('getErrorFieldsToClear', () => {
    it('always clears basic fields', () => {
      const selection = createSelection({ category: 'custom' });
      const fields = getErrorFieldsToClear(selection);
      expect(fields).toContain('category');
      expect(fields).toContain('title');
    });

    it('adds healthTaskType for health category', () => {
      const selection = createSelection({ category: 'health', taskType: 'generic' });
      const fields = getErrorFieldsToClear(selection);
      expect(fields).toContain('healthTaskType');
    });

    it('adds medication specific error fields', () => {
      const selection = createSelection({ category: 'health', taskType: 'give-medication' });
      const fields = getErrorFieldsToClear(selection);

      expect(fields).toContain('medicineName');
      expect(fields).toContain('medicineType');
      expect(fields).toContain('dosages');
      expect(fields).toContain('medicationFrequency');
      expect(fields).toContain('startDate');
    });

    it('adds observational tool specific error fields', () => {
      const selection = createSelection({ category: 'health', taskType: 'take-observational-tool' });
      const fields = getErrorFieldsToClear(selection);

      expect(fields).toContain('observationalTool');
      // Should not contain med fields
      expect(fields).not.toContain('medicineName');
    });
  });

  describe('Form Type Checkers', () => {
    describe('isMedicationForm', () => {
      it('returns true for "give-medication"', () => {
        expect(isMedicationForm('give-medication')).toBe(true);
      });
      it('returns false for other types or null', () => {
        expect(isMedicationForm('other')).toBe(false);
        expect(isMedicationForm(null)).toBe(false);
      });
    });

    describe('isObservationalToolForm', () => {
      it('returns true for "take-observational-tool"', () => {
        expect(isObservationalToolForm('take-observational-tool')).toBe(true);
      });
      it('returns false for other types or null', () => {
        expect(isObservationalToolForm('other')).toBe(false);
        expect(isObservationalToolForm(null)).toBe(false);
      });
    });

    describe('isSimpleForm', () => {
      it('returns true if neither medication nor observational tool', () => {
        expect(isSimpleForm('vaccination')).toBe(true);
        expect(isSimpleForm(null)).toBe(true);
      });

      it('returns false if medication form', () => {
        expect(isSimpleForm('give-medication')).toBe(false);
      });

      it('returns false if observational tool form', () => {
        expect(isSimpleForm('take-observational-tool')).toBe(false);
      });
    });
  });
});