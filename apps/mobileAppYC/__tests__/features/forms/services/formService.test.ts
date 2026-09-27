import {
  formApi,
  mapAppointmentFormItem,
} from '../../../../src/features/forms/services/formService';
import apiClient from '../../../../src/shared/services/apiClient';
import {
  fromFormRequestDTO,
  fromFormSubmissionRequestDTO,
  toFormSubmissionResponseDTO,
} from '@yosemite-crew/types';
import {normalizeSubmissionFromApi} from '../../../../src/features/forms/utils';

// --- Mocks ---

// FIX: Explicitly mock apiClient and named export withAuthHeaders
jest.mock('../../../../src/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
  withAuthHeaders: jest.fn((token, extra) => {
    const headers: any = {Authorization: `Bearer ${token}`};
    if (extra) Object.assign(headers, extra);
    return headers;
  }),
}));

jest.mock('../../../../src/features/forms/utils');
jest.mock('@yosemite-crew/types', () => ({
  fromFormRequestDTO: jest.fn(),
  fromFormSubmissionRequestDTO: jest.fn(),
  toFormSubmissionResponseDTO: jest.fn(),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('formService', () => {
  const mockToken = 'access-token';
  const mockAuthHeaders = {Authorization: `Bearer ${mockToken}`};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. fetchFormsForAppointment
  // =========================================================================
  describe('fetchFormsForAppointment', () => {
    it('fetches forms via mobile endpoint and returns API response', async () => {
      const mockResponse = {appointmentId: 'appt-1', items: []};
      mockApiClient.post.mockResolvedValue({data: mockResponse});

      const result = await formApi.fetchFormsForAppointment({
        appointmentId: 'appt-1',
        accessToken: mockToken,
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/fhir/v1/form/mobile/appointments/appt-1/forms',
        {isPMS: false},
        {headers: mockAuthHeaders},
      );
      expect(result).toEqual(mockResponse);
    });
    it('rethrows a 404 from the mobile endpoint without trying the practice route', async () => {
      const notFound = {response: {status: 404}};
      mockApiClient.post.mockRejectedValueOnce(notFound);

      await expect(
        formApi.fetchFormsForAppointment({
          appointmentId: 'appt-1',
          serviceId: 'svc-1',
          species: 'Dog',
          accessToken: mockToken,
        }),
      ).rejects.toBe(notFound);

      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/fhir/v1/form/mobile/appointments/appt-1/forms',
        {isPMS: false, serviceId: 'svc-1', species: 'Dog'},
        {headers: mockAuthHeaders},
      );
    });

    it('rethrows non-404 errors from the mobile endpoint without falling back', async () => {
      const serverError = {response: {status: 500}};
      mockApiClient.post.mockRejectedValueOnce(serverError);

      await expect(
        formApi.fetchFormsForAppointment({
          appointmentId: 'appt-1',
          accessToken: mockToken,
        }),
      ).rejects.toBe(serverError);

      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 2. fetchFormById
  // =========================================================================
  describe('fetchFormById', () => {
    it('fetches public form without auth if no token provided', async () => {
      mockApiClient.get.mockResolvedValue({data: {}});
      (fromFormRequestDTO as jest.Mock).mockReturnValue({id: 'form-1'});

      const result = await formApi.fetchFormById({formId: 'form-1'});

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/fhir/v1/form/public/form-1',
        {headers: undefined},
      );
      expect(result).toEqual({id: 'form-1'});
    });

    it('fetches form with auth headers if token provided', async () => {
      mockApiClient.get.mockResolvedValue({data: {}});

      await formApi.fetchFormById({formId: 'form-1', accessToken: mockToken});

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.any(String), {
        headers: mockAuthHeaders,
      });
    });
  });

  // =========================================================================
  // 3. submitForm
  // =========================================================================
  describe('submitForm', () => {
    it('transforms payload, posts to API, and normalizes response', async () => {
      const mockSubmission: any = {formId: 'f1', answers: {}};
      const mockSchema: any = [];
      const mockPayload = {resourceType: 'QuestionnaireResponse'};
      const mockApiResponse = {id: 'response-1'};
      const mockFinalResult = {_id: 'sub-1'};

      (toFormSubmissionResponseDTO as jest.Mock).mockReturnValue(mockPayload);
      mockApiClient.post.mockResolvedValue({data: mockApiResponse});
      (normalizeSubmissionFromApi as jest.Mock).mockReturnValue(
        mockFinalResult,
      );

      const result = await formApi.submitForm({
        formId: 'f1',
        submission: mockSubmission,
        schema: mockSchema,
        accessToken: mockToken,
      });

      expect(toFormSubmissionResponseDTO).toHaveBeenCalledWith(
        mockSubmission,
        mockSchema,
      );

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/fhir/v1/form/mobile/forms/f1/submit',
        mockPayload,
        {headers: mockAuthHeaders},
      );

      expect(normalizeSubmissionFromApi).toHaveBeenCalledWith(
        mockApiResponse,
        mockSchema,
        expect.objectContaining({formId: 'f1'}),
      );

      expect(result).toEqual(mockFinalResult);
    });
  });

  // =========================================================================
  // 4. startSigning
  // =========================================================================
  describe('startSigning', () => {
    it('posts to signing endpoint and returns signing URL', async () => {
      const mockData = {signingUrl: 'http://sign.com', documentId: 123};
      mockApiClient.post.mockResolvedValue({data: mockData});

      const result = await formApi.startSigning({
        submissionId: 'sub-1',
        accessToken: mockToken,
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/fhir/v1/form/mobile/form-submissions/sub-1/sign',
        {},
        {headers: mockAuthHeaders},
      );
      expect(result).toEqual(mockData);
    });

    it('sends request with auth headers only (no x-user-id)', async () => {
      mockApiClient.post.mockResolvedValue({data: {}});

      await formApi.startSigning({
        submissionId: 'sub-1',
        accessToken: mockToken,
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        {
          headers: mockAuthHeaders,
        },
      );
    });
  });

  // =========================================================================
  // 5. mapAppointmentFormItem
  // =========================================================================
  describe('mapAppointmentFormItem', () => {
    const mockQuestionnaire: any = {resourceType: 'Questionnaire'};
    const mockForm: any = {id: 'f1', schema: []};

    beforeEach(() => {
      (fromFormRequestDTO as jest.Mock).mockReturnValue(mockForm);
    });

    it('maps item with only questionnaire (no response)', () => {
      const item: any = {questionnaire: mockQuestionnaire};

      const result = mapAppointmentFormItem(item);

      expect(fromFormRequestDTO).toHaveBeenCalledWith(mockQuestionnaire);
      expect(result.form).toEqual(mockForm);
      expect(result.submission).toBeNull();
      expect(result.formVersion).toBeUndefined();
    });

    it('keeps whether the parent may sign, and reads anything else as no', () => {
      const base: any = {questionnaire: mockQuestionnaire};

      expect(mapAppointmentFormItem({...base, canSign: true}).canSign).toBe(
        true,
      );
      expect(mapAppointmentFormItem(base).canSign).toBe(false);
      expect(
        mapAppointmentFormItem({...base, canSign: 'yes'} as any).canSign,
      ).toBe(false);
    });

    it('maps item with questionnaire response', () => {
      const mockQR: any = {resourceType: 'QuestionnaireResponse'};
      const mockSubmission: any = {formVersion: 2};
      (fromFormSubmissionRequestDTO as jest.Mock).mockReturnValue(
        mockSubmission,
      );

      const item: any = {
        questionnaire: mockQuestionnaire,
        questionnaireResponse: mockQR,
      };

      const result = mapAppointmentFormItem(item);

      expect(fromFormSubmissionRequestDTO).toHaveBeenCalledWith(
        mockQR,
        mockForm.schema,
      );
      expect(result.submission).toEqual(mockSubmission);
      expect(result.formVersion).toBe(2);
    });

    it('normalizes signing to SIGNED when API item status is completed', () => {
      const mockQR: any = {resourceType: 'QuestionnaireResponse'};
      const mockSubmission: any = {
        formVersion: 2,
        signing: {status: 'IN_PROGRESS'},
      };
      (fromFormSubmissionRequestDTO as jest.Mock).mockReturnValue(
        mockSubmission,
      );

      const item: any = {
        questionnaire: mockQuestionnaire,
        questionnaireResponse: mockQR,
        status: 'completed',
      };

      const result = mapAppointmentFormItem(item);

      expect(result.submission?.signing?.status).toBe('SIGNED');
      expect(result.formVersion).toBe(2);
    });
  });
});
