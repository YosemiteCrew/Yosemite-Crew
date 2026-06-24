import type {
  Bundle,
  PlanDefinition,
  Questionnaire,
  QuestionnaireResponse,
} from '@yosemite-crew/fhir';
import { deleteData, getData, patchData, postData } from '@/app/services/axios';
import type { TemplateKind } from '@yosemite-crew/types';

type FhirTemplateListParams = {
  kind?: TemplateKind;
  status?: string;
  scope?: string;
};

type FhirTemplateResource = Questionnaire | PlanDefinition;
type FhirTemplateFamily = 'questionnaire' | 'plan-definition';

const familyPath = (family: FhirTemplateFamily) => `/fhir/v1/template/${family}`;

export const listFhirTemplateLibrary = async (
  family: FhirTemplateFamily,
  params: FhirTemplateListParams = {}
) => {
  const res = await getData<Bundle>(`${familyPath(family)}/library`, params);
  return res.data;
};

export const listFhirOrganisationTemplates = async (
  family: FhirTemplateFamily,
  organisationId: string,
  params: FhirTemplateListParams = {}
) => {
  const res = await getData<Bundle>(`${familyPath(family)}/organisation/${organisationId}`, params);
  return res.data;
};

export const listFhirUserTemplates = async (
  family: FhirTemplateFamily,
  organisationId: string,
  params: FhirTemplateListParams = {}
) => {
  const res = await getData<Bundle>(
    `${familyPath(family)}/organisation/${organisationId}/users/me`,
    params
  );
  return res.data;
};

export const createFhirTemplate = async <T extends FhirTemplateResource>(
  family: FhirTemplateFamily,
  resource: T
) => {
  const res = await postData<T, T>(familyPath(family), resource);
  return res.data;
};

export const getFhirTemplate = async <T extends FhirTemplateResource>(
  family: FhirTemplateFamily,
  organisationId: string,
  templateId: string
) => {
  const res = await getData<T>(
    `${familyPath(family)}/organisation/${organisationId}/${templateId}`
  );
  return res.data;
};

export const updateFhirTemplate = async <T extends FhirTemplateResource>(
  family: FhirTemplateFamily,
  organisationId: string,
  templateId: string,
  resource: T
) => {
  const res = await patchData<T, T>(
    `${familyPath(family)}/organisation/${organisationId}/${templateId}`,
    resource
  );
  return res.data;
};

export const publishFhirTemplate = async <T extends FhirTemplateResource>(
  family: FhirTemplateFamily,
  organisationId: string,
  templateId: string
) => {
  const res = await postData<T>(
    `${familyPath(family)}/organisation/${organisationId}/${templateId}/publish`
  );
  return res.data;
};

export const archiveFhirTemplate = async <T extends FhirTemplateResource>(
  family: FhirTemplateFamily,
  organisationId: string,
  templateId: string
) => {
  const res = await deleteData<T>(
    `${familyPath(family)}/organisation/${organisationId}/${templateId}`
  );
  return res.data;
};

export const createFhirTemplateInstance = async (
  family: FhirTemplateFamily,
  organisationId: string,
  templateId: string,
  response: QuestionnaireResponse
) => {
  const res = await postData<QuestionnaireResponse, QuestionnaireResponse>(
    `${familyPath(family)}/organisation/${organisationId}/${templateId}/instances`,
    response
  );
  return res.data;
};

export const updateFhirTemplateInstance = async (
  family: FhirTemplateFamily,
  organisationId: string,
  instanceId: string,
  response: QuestionnaireResponse
) => {
  const res = await patchData<QuestionnaireResponse, QuestionnaireResponse>(
    `${familyPath(family)}/template-instances/organisation/${organisationId}/${instanceId}`,
    response
  );
  return res.data;
};

export const submitFhirTemplateInstance = async (
  family: FhirTemplateFamily,
  organisationId: string,
  instanceId: string,
  response: QuestionnaireResponse
) => {
  const res = await postData<QuestionnaireResponse, QuestionnaireResponse>(
    `${familyPath(family)}/template-instances/organisation/${organisationId}/${instanceId}/submit`,
    response
  );
  return res.data;
};
