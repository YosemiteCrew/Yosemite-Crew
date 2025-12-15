import {
  resolveCategoryLabel,
  resolveHealthSubcategoryLabel,
  resolveParasitePreventionLabel,
  resolveChronicConditionLabel,
  resolveHealthTaskTypeLabel,
  resolveHygieneTaskTypeLabel,
  resolveDietaryTaskTypeLabel,
  resolveMedicationTypeLabel,
  resolveMedicationFrequencyLabel,
  resolveTaskFrequencyLabel,
  resolveObservationalToolLabel,
  resolveReminderOptionLabel,
  getTaskTitle,
  buildTaskTypeBreadcrumb,
} from '@/features/tasks/utils/taskLabels';

describe('taskLabels', () => {
  describe('Simple Label Resolvers', () => {
    // Helper to test the "lookup or fallback" pattern common to most functions
    const testLabelResolver = (
        fn: (key: any) => string,
        validKey: string,
        expectedLabel: string,
        invalidKey: string = 'unknown-key'
    ) => {
        expect(fn(validKey)).toBe(expectedLabel);
        expect(fn(invalidKey)).toBe(invalidKey); // Branch: || type
    };

    it('resolves Category labels', () => {
      testLabelResolver(resolveCategoryLabel, 'health', 'Health');
      testLabelResolver(resolveCategoryLabel, 'hygiene', 'Hygiene');
    });

    it('resolves Health Subcategory labels', () => {
      testLabelResolver(resolveHealthSubcategoryLabel, 'vaccination', 'Vaccination');
    });

    it('resolves Parasite Prevention labels', () => {
      testLabelResolver(resolveParasitePreventionLabel, 'deworming', 'Deworming');
    });

    it('resolves Chronic Condition labels', () => {
      testLabelResolver(resolveChronicConditionLabel, 'diabetes', 'Diabetes');
    });

    it('resolves Health Task Type labels', () => {
      testLabelResolver(resolveHealthTaskTypeLabel, 'give-medication', 'Give medication');
    });

    it('resolves Hygiene Task Type labels', () => {
      testLabelResolver(resolveHygieneTaskTypeLabel, 'give-bath', 'Give bath');
    });

    it('resolves Dietary Task Type labels', () => {
      testLabelResolver(resolveDietaryTaskTypeLabel, 'meals', 'Meals');
    });

    it('resolves Medication Type labels', () => {
      testLabelResolver(resolveMedicationTypeLabel, 'tablets-pills', 'Tablets/Pills');
    });

    it('resolves Medication Frequency labels', () => {
      testLabelResolver(resolveMedicationFrequencyLabel, 'daily', 'Daily');
    });

    it('resolves Task Frequency labels', () => {
      testLabelResolver(resolveTaskFrequencyLabel, 'weekly', 'Weekly');
    });

    it('resolves Observational Tool labels', () => {
      testLabelResolver(resolveObservationalToolLabel, 'feline-grimace-scale', 'Feline grimace scale');
    });

    it('resolves Reminder Option labels', () => {
      testLabelResolver(resolveReminderOptionLabel, '30-mins-prior', '30 mins prior');
    });
  });

  describe('getTaskTitle', () => {
    // 1. Health Category
    it('returns correct title for health medication', () => {
      expect(getTaskTitle('health', 'give-medication')).toBe('Give medication');
    });

    it('returns correct title for health observational tool', () => {
      expect(getTaskTitle('health', 'take-observational-tool')).toBe('Take observational tool');
    });

    it('returns correct title for health vaccination', () => {
      expect(getTaskTitle('health', 'vaccination')).toBe('Vaccination');
    });

    it('returns "New task" for health if type is unknown/undefined (fallback)', () => {
        expect(getTaskTitle('health', 'unknown-type')).toBe('New task');
        expect(getTaskTitle('health')).toBe('New task');
    });

    // 2. Hygiene Category
    it('returns resolved hygiene label if type is present', () => {
      expect(getTaskTitle('hygiene', 'give-bath')).toBe('Give bath');
    });

    it('returns "New task" for hygiene if type is missing', () => {
      expect(getTaskTitle('hygiene')).toBe('New task');
    });

    // 3. Dietary Category
    it('returns resolved dietary label if type is present', () => {
      expect(getTaskTitle('dietary', 'meals')).toBe('Meals');
    });

    it('returns "New task" for dietary if type is missing', () => {
        expect(getTaskTitle('dietary')).toBe('New task');
    });

    // 4. Custom Category
    it('returns "Custom task" for custom category', () => {
      expect(getTaskTitle('custom')).toBe('Custom task');
    });

    // 5. Default fallback
    it('returns "New task" for unknown category', () => {
      expect(getTaskTitle('unknown-cat' as any)).toBe('New task');
    });
  });

  describe('buildTaskTypeBreadcrumb', () => {
    // 1. Custom
    it('returns "Custom" for custom category', () => {
      expect(buildTaskTypeBreadcrumb('custom')).toBe('Custom');
    });

    // 2. Health
    it('returns basic "Health" if no subcategory', () => {
      expect(buildTaskTypeBreadcrumb('health')).toBe('Health');
    });

    it('returns "Health - Subcategory" if subcategory provided', () => {
      expect(buildTaskTypeBreadcrumb('health', 'vaccination')).toBe('Health - Vaccination');
    });

    it('returns breadcrumb with parasite prevention type', () => {
      expect(buildTaskTypeBreadcrumb(
          'health',
          'parasite-prevention',
          'deworming'
      )).toBe('Health - Parasite Prevention, Deworming');
    });

    it('returns breadcrumb with chronic condition type', () => {
      expect(buildTaskTypeBreadcrumb(
          'health',
          'chronic-conditions',
          null,
          'diabetes'
      )).toBe('Health - Chronic Conditions, Diabetes');
    });

    it('handles subcategory with no specific type extension', () => {
        expect(buildTaskTypeBreadcrumb('health', 'chronic-conditions')).toBe('Health - Chronic Conditions');
    });

    // 3. Hygiene
    it('returns "Hygiene - Type" when type provided', () => {
      expect(buildTaskTypeBreadcrumb('hygiene', null, null, null, 'give-bath')).toBe('Hygiene - Give bath');
    });

    it('returns "Hygiene - " when type missing', () => {
      expect(buildTaskTypeBreadcrumb('hygiene')).toBe('Hygiene - ');
    });

    // 4. Dietary
    it('returns "Dietary - Type" when type provided', () => {
      expect(buildTaskTypeBreadcrumb('dietary', null, null, null, 'meals')).toBe('Dietary - Meals');
    });

    it('returns "Dietary - " when type missing', () => {
        expect(buildTaskTypeBreadcrumb('dietary')).toBe('Dietary - ');
    });

    // 5. Default Fallback
    it('returns "Task Type" for unknown category', () => {
      expect(buildTaskTypeBreadcrumb('unknown' as any)).toBe('Task Type');
    });
  });
});