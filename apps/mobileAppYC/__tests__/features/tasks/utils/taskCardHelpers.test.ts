import { getTaskCardMeta } from '../../../../src/features/tasks/utils/taskCardHelpers';
import type { Task } from '../../../../src/features/tasks/types';
import type { User } from '../../../../src/features/auth/types';

describe('taskCardHelpers', () => {
  const mockUser: User = {
    id: 'user-1',
    parentId: null,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    profilePicture: 'http://avatar.jpg',
  };

  // FIX: Type casting to 'any' allows skipping strict union checks for mocks,
  // or define the full type if strictness is required.
  const baseTask: Task = {
    id: 'task-1',
    status: 'PENDING',
    category: 'general' as any, // Cast to any or use valid 'health' | 'admin' etc
    title: 'Test Task',
    assignedTo: undefined, // FIX: Use undefined instead of null
    details: {},
  } as any;

  describe('getTaskCardMeta', () => {
    it('identifies observational tool tasks correctly', () => {
      const task: Task = {
        ...baseTask,
        category: 'health',
        details: {
            taskType: 'take-observational-tool',
            toolType: 'feline-grimace-scale' // FIX: Added missing required property
        } as any,
      };
      const result = getTaskCardMeta(task, mockUser);
      expect(result.isObservationalToolTask).toBe(true);
    });

    it('returns false for observational tool if details are undefined', () => {
      const task: Task = {
        ...baseTask,
        category: 'health',
      };
      const result = getTaskCardMeta(task, mockUser);
      expect(result.isObservationalToolTask).toBe(false);
    });
  });
});