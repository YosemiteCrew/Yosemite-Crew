import { getData, postData, putData, deleteData } from '@/app/services/axios';

export type PracticeProfileEntityType = 'CLIENT' | 'PATIENT';
export type PracticeProfileFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT';

export type PracticeProfileField = {
  id: string;
  fieldKey: string;
  label: string;
  type: PracticeProfileFieldType;
  options: string[];
  value: unknown;
};

export const getPracticeProfileFields = async (
  entityType: PracticeProfileEntityType,
  entityId: string
) => {
  const response = await getData<PracticeProfileField[]>(
    `/fhir/v1/companion/org/profile-fields/${entityType}/${encodeURIComponent(entityId)}`
  );
  return response.data;
};

export const createPracticeProfileField = async (
  entityType: PracticeProfileEntityType,
  input: { label: string; type: PracticeProfileFieldType; options: string[] }
) => {
  const response = await postData<PracticeProfileField>(
    `/fhir/v1/companion/org/profile-fields/${entityType}`,
    input
  );
  return response.data;
};

export const savePracticeProfileFieldValues = async (
  entityType: PracticeProfileEntityType,
  entityId: string,
  values: Array<{ fieldId: string; value: unknown }>
) =>
  putData(
    `/fhir/v1/companion/org/profile-fields/${entityType}/${encodeURIComponent(entityId)}/values`,
    { values }
  );

export const deactivatePracticeProfileField = async (fieldId: string) =>
  deleteData(`/fhir/v1/companion/org/profile-fields/fields/${encodeURIComponent(fieldId)}`);
