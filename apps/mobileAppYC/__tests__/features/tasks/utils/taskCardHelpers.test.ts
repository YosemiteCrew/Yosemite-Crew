import {getTaskCardMeta} from '../../../../src/features/tasks/utils/taskCardHelpers';
import type {Task} from '../../../../src/features/tasks/types';
import type {User} from '../../../../src/features/auth/types';

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
          toolType: 'feline-grimace-scale', // FIX: Added missing required property
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

    it('populates assignedToData when the task is assigned to the current user (resolved via id)', () => {
      const task: Task = {...baseTask, assignedTo: 'user-1'};
      const result = getTaskCardMeta(task, mockUser);
      expect(result.assignedToData).toEqual({
        avatar: 'http://avatar.jpg',
        name: 'John',
      });
    });

    it('resolves selfId via parentId when parentId is set', () => {
      const parentUser: User = {...mockUser, parentId: 'parent-1'};
      const task: Task = {...baseTask, assignedTo: 'parent-1'};
      const result = getTaskCardMeta(task, parentUser);
      expect(result.assignedToData).toEqual({
        avatar: 'http://avatar.jpg',
        name: 'John',
      });
    });

    it('falls back to undefined avatar when profilePicture is missing', () => {
      const userWithoutAvatar: User = {...mockUser, profilePicture: undefined};
      const task: Task = {...baseTask, assignedTo: 'user-1'};
      const result = getTaskCardMeta(task, userWithoutAvatar);
      expect(result.assignedToData?.avatar).toBeUndefined();
    });

    it('falls back to "User" when firstName is missing', () => {
      const userWithoutName: User = {...mockUser, firstName: ''};
      const task: Task = {...baseTask, assignedTo: 'user-1'};
      const result = getTaskCardMeta(task, userWithoutName);
      expect(result.assignedToData?.name).toBe('User');
    });

    it('leaves assignedToData undefined when the task is not assigned to the current user', () => {
      const task: Task = {...baseTask, assignedTo: 'someone-else'};
      const result = getTaskCardMeta(task, mockUser);
      expect(result.assignedToData).toBeUndefined();
    });

    it('leaves assignedToData undefined when authUser is null', () => {
      const task: Task = {...baseTask, assignedTo: 'user-1'};
      const result = getTaskCardMeta(task, null);
      expect(result.assignedToData).toBeUndefined();
    });

    it('treats status case-insensitively for isPending and isCompleted', () => {
      const pendingTask: Task = {...baseTask, status: 'pending' as any};
      expect(getTaskCardMeta(pendingTask, mockUser).isPending).toBe(true);

      const completedTask: Task = {...baseTask, status: 'Completed' as any};
      expect(getTaskCardMeta(completedTask, mockUser).isCompleted).toBe(true);
    });
  });
});
