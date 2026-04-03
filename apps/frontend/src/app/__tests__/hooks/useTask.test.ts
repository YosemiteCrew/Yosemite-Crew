import { renderHook } from '@testing-library/react';
import {
  useLoadTasksForPrimaryOrg,
  useTasksForPrimaryOrg,
  useTasksAssignedToUser,
} from '@/app/hooks/useTask';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { loadTasksForPrimaryOrg } from '@/app/features/tasks/services/taskService';
import { Task } from '@/app/features/tasks/types/task';

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/stores/taskStore', () => ({
  useTaskStore: jest.fn(),
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  loadTasksForPrimaryOrg: jest.fn(),
}));

const makeTask = (_id: string, assignedTo?: string): Task =>
  ({ _id, assignedTo }) as unknown as Task;

describe('useLoadTasksForPrimaryOrg', () => {
  it('loads tasks when primaryOrgId is set', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org1' })
    );

    renderHook(() => useLoadTasksForPrimaryOrg());
    expect(loadTasksForPrimaryOrg).toHaveBeenCalledWith({ force: true });
  });

  it('does not load tasks when primaryOrgId is null', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: null })
    );

    renderHook(() => useLoadTasksForPrimaryOrg());
    expect(loadTasksForPrimaryOrg).not.toHaveBeenCalled();
  });
});

describe('useTasksForPrimaryOrg', () => {
  it('returns empty array when no primaryOrgId', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: null })
    );
    (useTaskStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ tasksById: {}, taskIdsByOrgId: {} })
    );

    const { result } = renderHook(() => useTasksForPrimaryOrg());
    expect(result.current).toEqual([]);
  });

  it('returns tasks for the primary org', () => {
    const task1 = makeTask('t1');
    const task2 = makeTask('t2');

    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org1' })
    );
    (useTaskStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        tasksById: { t1: task1, t2: task2 },
        taskIdsByOrgId: { org1: ['t1', 't2'] },
      })
    );

    const { result } = renderHook(() => useTasksForPrimaryOrg());
    expect(result.current).toHaveLength(2);
    expect(result.current).toContain(task1);
    expect(result.current).toContain(task2);
  });

  it('filters out missing task IDs', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org1' })
    );
    (useTaskStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        tasksById: { t1: makeTask('t1') },
        taskIdsByOrgId: { org1: ['t1', 'missing-id'] },
      })
    );

    const { result } = renderHook(() => useTasksForPrimaryOrg());
    expect(result.current).toHaveLength(1);
  });
});

describe('useTasksAssignedToUser', () => {
  it('returns empty array when no primaryOrgId', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: null })
    );
    (useTaskStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ tasksById: {}, taskIdsByOrgId: {} })
    );

    const { result } = renderHook(() => useTasksAssignedToUser('user1'));
    expect(result.current).toEqual([]);
  });

  it('returns empty array when no userId', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org1' })
    );
    (useTaskStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        tasksById: { t1: makeTask('t1', 'user1') },
        taskIdsByOrgId: { org1: ['t1'] },
      })
    );

    const { result } = renderHook(() => useTasksAssignedToUser(undefined));
    expect(result.current).toEqual([]);
  });

  it('returns only tasks assigned to the given user', () => {
    const task1 = makeTask('t1', 'user1');
    const task2 = makeTask('t2', 'user2');

    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org1' })
    );
    (useTaskStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        tasksById: { t1: task1, t2: task2 },
        taskIdsByOrgId: { org1: ['t1', 't2'] },
      })
    );

    const { result } = renderHook(() => useTasksAssignedToUser('user1'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0]._id).toBe('t1');
  });
});
