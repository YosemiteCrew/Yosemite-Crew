import type { Bundle, Task as FhirTask } from '@yosemite-crew/fhir';
import { getData, patchData, postData } from '@/app/services/axios';

type FhirTaskListParams = {
  status?: string;
  audience?: string;
  organisationId?: string;
};

export const listFhirOrganisationTasks = async (
  organisationId: string,
  params: Omit<FhirTaskListParams, 'organisationId'> = {}
) => {
  const res = await getData<Bundle>(`/fhir/v1/task/organisation/${organisationId}`, params);
  return res.data;
};

export const listFhirCompanionTasks = async (
  companionId: string,
  params: FhirTaskListParams = {}
) => {
  const res = await getData<Bundle>(`/fhir/v1/task/companion/${companionId}`, params);
  return res.data;
};

export const createFhirTask = async (organisationId: string, task: FhirTask) => {
  const res = await postData<FhirTask, FhirTask>(
    `/fhir/v1/task/organisation/${organisationId}`,
    task
  );
  return res.data;
};

export const getFhirTask = async (organisationId: string, taskId: string) => {
  const res = await getData<FhirTask>(`/fhir/v1/task/organisation/${organisationId}/${taskId}`);
  return res.data;
};

export const updateFhirTask = async (organisationId: string, taskId: string, task: FhirTask) => {
  const res = await patchData<FhirTask, FhirTask>(
    `/fhir/v1/task/organisation/${organisationId}/${taskId}`,
    task
  );
  return res.data;
};

export const changeFhirTaskStatus = async (
  organisationId: string,
  taskId: string,
  task: FhirTask
) => {
  const res = await postData<FhirTask, FhirTask>(
    `/fhir/v1/task/organisation/${organisationId}/${taskId}/$status`,
    task
  );
  return res.data;
};
