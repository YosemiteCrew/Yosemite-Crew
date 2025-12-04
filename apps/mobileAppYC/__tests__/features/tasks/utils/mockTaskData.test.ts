import {MOCK_TASKS, getMockTasksForCompanion} from '../../../../src/features/tasks/utils/mockTaskData';

describe('mockTaskData', () => {
  describe('MOCK_TASKS', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(MOCK_TASKS)).toBe(true);
      expect(MOCK_TASKS.length).toBeGreaterThan(0);
    });

    it('should contain valid task objects with correct properties', () => {
      for (const task of MOCK_TASKS) {
        expect(task).toHaveProperty('id');
        expect(typeof task.id).toBe('string');

        expect(task).toHaveProperty('companionId');
        expect(typeof task.companionId).toBe('string');

        expect(task).toHaveProperty('title');
        expect(typeof task.title).toBe('string');

        expect(task).toHaveProperty('category');
        expect(['health', 'hygiene', 'dietary', 'custom']).toContain(task.category);

        // Validate date format (YYYY-MM-DD)
        expect(task.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Validate time format (HH:MM)
        expect(task.time).toMatch(/^\d{2}:\d{2}$/);

        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('frequency');
      }
    });

    it('should have internal consistency for medication tasks', () => {
      const medTasks = MOCK_TASKS.filter(t =>
        t.category === 'health' && t.details && 'taskType' in t.details && t.details.taskType === 'give-medication'
      );

      expect(medTasks.length).toBeGreaterThan(0);

      for (const task of medTasks) {
        // Force type assertion for test convenience as we know the structure matches the filter
        const details: any = task.details;
        expect(details).toHaveProperty('medicineName');
        expect(details).toHaveProperty('medicineType');
        expect(Array.isArray(details.dosages)).toBe(true);
      }
    });
  });

  describe('getMockTasksForCompanion', () => {
    it('should return tasks with the overridden companionId', () => {
      const testCompanionId = 'test-id-123';
      const tasks = getMockTasksForCompanion(testCompanionId);

      expect(tasks).toHaveLength(MOCK_TASKS.length);

      // Verify every task has the new ID
      for (const task of tasks) {
        expect(task.companionId).toBe(testCompanionId);
      }
    });

    it('should return new object references (immutability check)', () => {
      const testCompanionId = 'test-id-456';
      const tasks = getMockTasksForCompanion(testCompanionId);

      // Verify the first element is a new object reference
      expect(tasks[0]).not.toBe(MOCK_TASKS[0]);

      // But should share other properties (shallow copy logic validation)
      expect(tasks[0].id).toBe(MOCK_TASKS[0].id);
      expect(tasks[0].title).toBe(MOCK_TASKS[0].title);

      // Ensure the original constant was not mutated
      expect(MOCK_TASKS[0].companionId).toBe('companion-1');
    });
  });
});