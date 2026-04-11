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
    it('falls back to non-mobile endpoint when mobile endpoint returns 404', async () => {
      const payload = {isPMS: false, serviceId: 'svc-1', species: 'Dog'};
      const mockResponse = {appointmentId: 'appt-1', items: []};
      mockApiClient.post
        .mockRejectedValueOnce({response: {status: 404}})
        .mockResolvedValueOnce({data: mockResponse});

      const result = await formApi.fetchFormsForAppointment({
        appointmentId: 'appt-1',
        serviceId: 'svc-1',
        species: 'Dog',
        accessToken: mockToken,
      });

      expect(mockApiClient.post).toHaveBeenNthCalledWith(
        1,
        '/fhir/v1/form/mobile/appointments/appt-1/forms',
        payload,
        {headers: mockAuthHeaders},
      );
      expect(mockApiClient.post).toHaveBeenNthCalledWith(
        2,
        '/fhir/v1/form/appointments/appt-1/forms',
        payload,
        {headers: mockAuthHeaders},
      );
      expect(result).toEqual(mockResponse);
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

    it('includes user-id header if provided', async () => {
      mockApiClient.post.mockResolvedValue({data: {}});

      await formApi.startSigning({
        submissionId: 'sub-1',
        accessToken: mockToken,
        userId: 'user-123',
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        {
          headers: {
            ...mockAuthHeaders,
            'x-user-id': 'user-123',
          },
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
