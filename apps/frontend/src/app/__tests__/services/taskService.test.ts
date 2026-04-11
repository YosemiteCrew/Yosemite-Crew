import {
  changeTaskStatus,
  createTask,
  createTaskTemplate,
  getTaskLibrary,
  getTaskTemplatesForPrimaryOrg,
  loadTasksForPrimaryOrg,
  updateTask,
} from '@/app/features/tasks/services/taskService';

const getDataMock = jest.fn();
const postDataMock = jest.fn();
const patchDataMock = jest.fn();

const orgState = { primaryOrgId: 'org-1' };
const taskStoreState: any = {
  startLoading: jest.fn(),
  status: 'idle',
  setTasksForOrg: jest.fn(),
  upsertTask: jest.fn(),
  tasksById: {},
};

jest.mock('@/app/services/axios', () => ({
  getData: (...args: any[]) => getDataMock(...args),
  postData: (...args: any[]) => postDataMock(...args),
  patchData: (...args: any[]) => patchDataMock(...args),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: () => orgState },
}));

jest.mock('@/app/stores/taskStore', () => ({
  useTaskStore: { getState: () => taskStoreState },
}));

describe('taskService', () => {
  beforeEach(() => {
    getDataMock.mockReset();
    postDataMock.mockReset();
    patchDataMock.mockReset();
    taskStoreState.startLoading.mockReset();
    taskStoreState.setTasksForOrg.mockReset();
    taskStoreState.upsertTask.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore?.();
    (console.error as jest.Mock).mockRestore?.();
  });

  it('loads tasks for org', async () => {
    getDataMock.mockResolvedValue({ data: [{ _id: 't1' }] });

    await loadTasksForPrimaryOrg();

    expect(getDataMock).toHaveBeenCalledWith('/v1/task/pms/organisation/org-1');
    expect(taskStoreState.setTasksForOrg).toHaveBeenCalledWith('org-1', [{ _id: 't1' }]);
  });

  it('creates custom task and upserts', async () => {
    postDataMock.mockResolvedValue({ data: { _id: 't1', audience: 'EMPLOYEE_TASK' } });

    await createTask({ _id: '', source: 'CUSTOM', audience: 'EMPLOYEE_TASK' } as any);

    expect(postDataMock).toHaveBeenCalledWith('/v1/task/pms/custom', expect.any(Object));
    expect(taskStoreState.upsertTask).toHaveBeenCalled();
  });

  it('updates task', async () => {
    patchDataMock.mockResolvedValue({ data: { _id: 't1' } });

    await updateTask({ _id: 't1' } as any);

    expect(patchDataMock).toHaveBeenCalledWith('/v1/task/pms/t1', expect.any(Object));
    expect(taskStoreState.upsertTask).toHaveBeenCalled();
  });

  it('changes task status', async () => {
    postDataMock.mockResolvedValue({ data: { _id: 't1' } });
    taskStoreState.tasksById = {
      t1: {
        _id: 't1',
        organisationId: 'org-1',
        status: 'PENDING',
      },
    };

    await changeTaskStatus({ _id: 't1', status: 'COMPLETED' } as any);

    expect(postDataMock).toHaveBeenCalledWith('/v1/task/pms/t1/status', { status: 'COMPLETED' });
    expect(taskStoreState.upsertTask).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 't1',
        organisationId: 'org-1',
        status: 'COMPLETED',
      })
    );
  });

  it('creates task template', async () => {
    postDataMock.mockResolvedValue({ data: {} });

    await createTaskTemplate({ _id: '', source: 'ORG_TEMPLATE' } as any);

    expect(postDataMock).toHaveBeenCalledWith('/v1/task/pms/templates', expect.any(Object));
  });

  it('loads templates and library', async () => {
    getDataMock.mockResolvedValue({ data: [] });

    const templates = await getTaskTemplatesForPrimaryOrg();
    const library = await getTaskLibrary();

    expect(templates).toEqual([]);
    expect(library).toEqual([]);
  });

  it('does not load tasks when status is loaded and force is false', async () => {
    taskStoreState.status = 'loaded';
    await loadTasksForPrimaryOrg({ force: false });
    expect(getDataMock).not.toHaveBeenCalled();
  });

  it('loads tasks when status is loaded but force is true', async () => {
    taskStoreState.status = 'loaded';
    getDataMock.mockResolvedValue({ data: [] });
    await loadTasksForPrimaryOrg({ force: true });
    expect(getDataMock).toHaveBeenCalled();
    taskStoreState.status = 'idle'; // reset
  });

  it('does not call startLoading when silent is true', async () => {
    taskStoreState.status = 'idle';
    getDataMock.mockResolvedValue({ data: [] });
    await loadTasksForPrimaryOrg({ silent: true });
    expect(taskStoreState.startLoading).not.toHaveBeenCalled();
  });

  it('loads tasks when status is error', async () => {
    taskStoreState.status = 'error';
    getDataMock.mockResolvedValue({ data: [{ _id: 't2' }] });
    await loadTasksForPrimaryOrg();
    expect(taskStoreState.setTasksForOrg).toHaveBeenCalledWith('org-1', [{ _id: 't2' }]);
    taskStoreState.status = 'idle'; // reset
  });

  it('returns without loading when no primaryOrgId', async () => {
    orgState.primaryOrgId = null as any;
    await loadTasksForPrimaryOrg();
    expect(getDataMock).not.toHaveBeenCalled();
    orgState.primaryOrgId = 'org-1'; // reset
  });

  it('creates template task via from-template route', async () => {
    postDataMock.mockResolvedValue({ data: { _id: 't2', audience: 'EMPLOYEE_TASK' } });
    await createTask({ _id: '', source: 'ORG_TEMPLATE', audience: 'EMPLOYEE_TASK' } as any);
    expect(postDataMock).toHaveBeenCalledWith('/v1/task/pms/from-template', expect.any(Object));
  });

  it('creates library task via from-library route', async () => {
    postDataMock.mockResolvedValue({ data: { _id: 't3', audience: 'EMPLOYEE_TASK' } });
    await createTask({ _id: '', source: 'YC_LIBRARY', audience: 'EMPLOYEE_TASK' } as any);
    expect(postDataMock).toHaveBeenCalledWith('/v1/task/pms/from-library', expect.any(Object));
  });

  it('throws for invalid task source', async () => {
    await expect(createTask({ _id: '', source: 'INVALID' } as any)).rejects.toThrow(
      'Invalid task source type'
    );
  });

  it('does not upsert when audience is not EMPLOYEE_TASK', async () => {
    postDataMock.mockResolvedValue({ data: { _id: 't4', audience: 'OTHER' } });
    await createTask({ _id: '', source: 'CUSTOM', audience: 'OTHER' } as any);
    expect(taskStoreState.upsertTask).not.toHaveBeenCalled();
  });

  it('returns without creating task when no primaryOrgId', async () => {
    orgState.primaryOrgId = null as any;
    await createTask({ _id: '', source: 'CUSTOM' } as any);
    expect(postDataMock).not.toHaveBeenCalled();
    orgState.primaryOrgId = 'org-1'; // reset
  });

  it('returns without updating task when no primaryOrgId', async () => {
    orgState.primaryOrgId = null as any;
    await updateTask({ _id: 't1' } as any);
    expect(patchDataMock).not.toHaveBeenCalled();
    orgState.primaryOrgId = 'org-1'; // reset
  });

  it('returns without updating task when no _id', async () => {
    await updateTask({} as any);
    expect(patchDataMock).not.toHaveBeenCalled();
  });

  it('returns without changing status when no primaryOrgId', async () => {
    orgState.primaryOrgId = null as any;
    await changeTaskStatus({ _id: 't1', status: 'COMPLETED' } as any);
    expect(postDataMock).not.toHaveBeenCalled();
    orgState.primaryOrgId = 'org-1'; // reset
  });

  it('returns without changing status when no task _id', async () => {
    await changeTaskStatus({} as any);
    expect(postDataMock).not.toHaveBeenCalled();
  });

  it('returns empty array from getTaskTemplatesForPrimaryOrg when no orgId', async () => {
    orgState.primaryOrgId = null as any;
    const result = await getTaskTemplatesForPrimaryOrg();
    expect(result).toEqual([]);
    orgState.primaryOrgId = 'org-1'; // reset
  });

  it('rethrows errors from loadTasksForPrimaryOrg', async () => {
    taskStoreState.status = 'idle';
    getDataMock.mockRejectedValue(new Error('network error'));
    await expect(loadTasksForPrimaryOrg()).rejects.toThrow('network error');
    taskStoreState.status = 'idle'; // reset
  });

  it('rethrows errors from createTask', async () => {
    postDataMock.mockRejectedValue(new Error('create failed'));
    await expect(createTask({ _id: '', source: 'CUSTOM' } as any)).rejects.toThrow('create failed');
  });

  it('rethrows errors from updateTask', async () => {
    patchDataMock.mockRejectedValue(new Error('update failed'));
    await expect(updateTask({ _id: 't1' } as any)).rejects.toThrow('update failed');
  });

  it('rethrows errors from changeTaskStatus', async () => {
    postDataMock.mockRejectedValue(new Error('status failed'));
    await expect(changeTaskStatus({ _id: 't1', status: 'CANCELLED' } as any)).rejects.toThrow(
      'status failed'
    );
  });
});
