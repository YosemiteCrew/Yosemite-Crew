import type { PlanDefinition, Questionnaire, QuestionnaireResponse } from '@yosemite-crew/fhir';
import {
  archiveFhirTemplate,
  createFhirTemplate,
  createFhirTemplateInstance,
  getFhirTemplate,
  listFhirOrganisationTemplates,
  listFhirTemplateLibrary,
  listFhirUserTemplates,
  publishFhirTemplate,
  submitFhirTemplateInstance,
  updateFhirTemplate,
  updateFhirTemplateInstance,
} from '@/app/features/forms/services/fhirTemplateService';
import { deleteData, getData, patchData, postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  deleteData: jest.fn(),
  getData: jest.fn(),
  patchData: jest.fn(),
  postData: jest.fn(),
}));

const questionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  title: 'SOAP',
};

const planDefinition: PlanDefinition = {
  resourceType: 'PlanDefinition',
  status: 'active',
  title: 'Inpatient schedule',
};

const response: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  status: 'in-progress',
};

describe('fhirTemplateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wraps FHIR questionnaire template list routes', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: { resourceType: 'Bundle', entry: [] } });

    await listFhirTemplateLibrary('questionnaire', { kind: 'SOAP_NOTE' });
    await listFhirOrganisationTemplates('questionnaire', 'org-1', {
      status: 'active',
    });
    await listFhirUserTemplates('questionnaire', 'org-1');

    expect(getData).toHaveBeenNthCalledWith(1, '/fhir/v1/template/questionnaire/library', {
      kind: 'SOAP_NOTE',
    });
    expect(getData).toHaveBeenNthCalledWith(
      2,
      '/fhir/v1/template/questionnaire/organisation/org-1',
      { status: 'active' }
    );
    expect(getData).toHaveBeenNthCalledWith(
      3,
      '/fhir/v1/template/questionnaire/organisation/org-1/users/me',
      {}
    );
  });

  it('wraps FHIR questionnaire CRUD and instance routes', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: questionnaire });
    (getData as jest.Mock).mockResolvedValue({ data: questionnaire });
    (patchData as jest.Mock).mockResolvedValue({ data: questionnaire });
    (deleteData as jest.Mock).mockResolvedValue({ data: questionnaire });

    await createFhirTemplate('questionnaire', questionnaire);
    await getFhirTemplate<Questionnaire>('questionnaire', 'org-1', 'tpl-1');
    await updateFhirTemplate('questionnaire', 'org-1', 'tpl-1', questionnaire);
    await publishFhirTemplate<Questionnaire>('questionnaire', 'org-1', 'tpl-1');
    await archiveFhirTemplate<Questionnaire>('questionnaire', 'org-1', 'tpl-1');
    await createFhirTemplateInstance('questionnaire', 'org-1', 'tpl-1', response);
    await updateFhirTemplateInstance('questionnaire', 'org-1', 'inst-1', response);
    await submitFhirTemplateInstance('questionnaire', 'org-1', 'inst-1', response);

    expect(postData).toHaveBeenNthCalledWith(1, '/fhir/v1/template/questionnaire', questionnaire);
    expect(getData).toHaveBeenCalledWith(
      '/fhir/v1/template/questionnaire/organisation/org-1/tpl-1'
    );
    expect(patchData).toHaveBeenNthCalledWith(
      1,
      '/fhir/v1/template/questionnaire/organisation/org-1/tpl-1',
      questionnaire
    );
    expect(postData).toHaveBeenNthCalledWith(
      2,
      '/fhir/v1/template/questionnaire/organisation/org-1/tpl-1/publish'
    );
    expect(deleteData).toHaveBeenCalledWith(
      '/fhir/v1/template/questionnaire/organisation/org-1/tpl-1'
    );
    expect(postData).toHaveBeenNthCalledWith(
      3,
      '/fhir/v1/template/questionnaire/organisation/org-1/tpl-1/instances',
      response
    );
    expect(patchData).toHaveBeenNthCalledWith(
      2,
      '/fhir/v1/template/questionnaire/template-instances/organisation/org-1/inst-1',
      response
    );
    expect(postData).toHaveBeenNthCalledWith(
      4,
      '/fhir/v1/template/questionnaire/template-instances/organisation/org-1/inst-1/submit',
      response
    );
  });

  it('wraps FHIR plan-definition routes with the same family helper', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: { resourceType: 'Bundle', entry: [] } });
    (postData as jest.Mock).mockResolvedValue({ data: planDefinition });

    await listFhirTemplateLibrary('plan-definition', { kind: 'INPATIENT_SCHEDULE' });
    await createFhirTemplate('plan-definition', planDefinition);

    expect(getData).toHaveBeenCalledWith('/fhir/v1/template/plan-definition/library', {
      kind: 'INPATIENT_SCHEDULE',
    });
    expect(postData).toHaveBeenCalledWith('/fhir/v1/template/plan-definition', planDefinition);
  });
});
