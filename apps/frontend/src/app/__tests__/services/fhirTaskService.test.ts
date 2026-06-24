import type { Task as FhirTask } from '@yosemite-crew/fhir';
import {
  changeFhirTaskStatus,
  createFhirTask,
  getFhirTask,
  listFhirCompanionTasks,
  listFhirOrganisationTasks,
  updateFhirTask,
} from '@/app/features/tasks/services/fhirTaskService';
import { getData, patchData, postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  patchData: jest.fn(),
  postData: jest.fn(),
}));

const task: FhirTask = {
  resourceType: 'Task',
  status: 'requested',
  intent: 'order',
};

describe('fhirTaskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wraps FHIR task list routes', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: { resourceType: 'Bundle', entry: [] } });

    await listFhirOrganisationTasks('org-1', { status: 'requested', audience: 'EMPLOYEE_TASK' });
    await listFhirCompanionTasks('comp-1', {
      organisationId: 'org-1',
      audience: 'PARENT_TASK',
    });

    expect(getData).toHaveBeenNthCalledWith(1, '/fhir/v1/task/organisation/org-1', {
      status: 'requested',
      audience: 'EMPLOYEE_TASK',
    });
    expect(getData).toHaveBeenNthCalledWith(2, '/fhir/v1/task/companion/comp-1', {
      organisationId: 'org-1',
      audience: 'PARENT_TASK',
    });
  });

  it('wraps FHIR task create/get/update/status routes', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: task });
    (getData as jest.Mock).mockResolvedValue({ data: task });
    (patchData as jest.Mock).mockResolvedValue({ data: task });

    await createFhirTask('org-1', task);
    await getFhirTask('org-1', 'task-1');
    await updateFhirTask('org-1', 'task-1', task);
    await changeFhirTaskStatus('org-1', 'task-1', task);

    expect(postData).toHaveBeenNthCalledWith(1, '/fhir/v1/task/organisation/org-1', task);
    expect(getData).toHaveBeenCalledWith('/fhir/v1/task/organisation/org-1/task-1');
    expect(patchData).toHaveBeenCalledWith('/fhir/v1/task/organisation/org-1/task-1', task);
    expect(postData).toHaveBeenNthCalledWith(
      2,
      '/fhir/v1/task/organisation/org-1/task-1/$status',
      task
    );
  });
});
