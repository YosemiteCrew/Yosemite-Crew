import { formApi, mapAppointmentFormItem } from '../../../../src/features/forms/services/formService';
import apiClient from '../../../../src/shared/services/apiClient';
import {
  fromFormRequestDTO,
  fromFormSubmissionRequestDTO,
  toFormSubmissionResponseDTO,
} from '@yosemite-crew/types';
import { normalizeSubmissionFromApi } from '../../../../src/features/forms/utils';

// --- Mocks ---

// FIX: Explicitly mock apiClient and named export withAuthHeaders
jest.mock('../../../../src/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
  withAuthHeaders: jest.fn((token, extra) => {
    const headers: any = { Authorization: `Bearer ${token}` };
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
  const mockAuthHeaders = { Authorization: `Bearer ${mockToken}` };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. fetchFormsForAppointment
  // =========================================================================
  describe('fetchFormsForAppointment', () => {
    it('fetches forms and returns API response', async () => {
      const mockResponse = { appointmentId: 'appt-1', items: [] };
      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await formApi.fetchFormsForAppointment({
        appointmentId: 'appt-1',
        accessToken: mockToken,
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/fhir/v1/form/mobile/appointments/appt-1/forms',
        { headers: mockAuthHeaders }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  // =========================================================================
  // 2. fetchSoapNotes
  // =========================================================================
  describe('fetchSoapNotes', () => {
    it('fetches SOAP notes with default params', async () => {
      const mockResponse = { appointmentId: 'appt-1', soapNotes: {} };
      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await formApi.fetchSoapNotes({
        appointmentId: 'appt-1',
        accessToken: mockToken,
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/fhir/v1/form/mobile/appointments/appt-1/soap-notes',
        {
          params: { latestOnly: true },
          headers: mockAuthHeaders,
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('fetches SOAP notes with latestOnly=false', async () => {
      mockApiClient.get.mockResolvedValue({ data: {} });

      await formApi.fetchSoapNotes({
        appointmentId: 'appt-1',
        accessToken: mockToken,
        latestOnly: false,
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: { latestOnly: false } })
      );
    });
  });

  // =========================================================================
  // 3. fetchConsentFormForService
  // =========================================================================
  describe('fetchConsentFormForService', () => {
    it('fetches consent form and transforms result', async () => {
      const mockQuestionnaire = { resourceType: 'Questionnaire' };
      const mockForm = { id: 'consent-1' };

      mockApiClient.get.mockResolvedValue({ data: mockQuestionnaire });
      (fromFormRequestDTO as jest.Mock).mockReturnValue(mockForm);

      const result = await formApi.fetchConsentFormForService({
        organisationId: 'org-1',
        serviceId: 'svc-1',
        accessToken: mockToken,
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/fhir/v1/form/mobile/forms/org-1/svc-1/consent-form',
        expect.objectContaining({ headers: mockAuthHeaders })
      );
      expect(fromFormRequestDTO).toHaveBeenCalledWith(mockQuestionnaire);
      expect(result).toEqual(mockForm);
    });

    it('includes species param if provided', async () => {
      mockApiClient.get.mockResolvedValue({ data: {} });
      (fromFormRequestDTO as jest.Mock).mockReturnValue({});

      await formApi.fetchConsentFormForService({
        organisationId: 'org-1',
        serviceId: 'svc-1',
        species: 'Dog',
        accessToken: mockToken,
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: { species: 'Dog' } })
      );
    });
  });

  // =========================================================================
  // 4. fetchFormById
  // =========================================================================
  describe('fetchFormById', () => {
    it('fetches public form without auth if no token provided', async () => {
      mockApiClient.get.mockResolvedValue({ data: {} });
      (fromFormRequestDTO as jest.Mock).mockReturnValue({ id: 'form-1' });

      const result = await formApi.fetchFormById({ formId: 'form-1' });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/fhir/v1/form/public/form-1',
        { headers: undefined }
      );
      expect(result).toEqual({ id: 'form-1' });
    });

    it('fetches form with auth headers if token provided', async () => {
      mockApiClient.get.mockResolvedValue({ data: {} });

      await formApi.fetchFormById({ formId: 'form-1', accessToken: mockToken });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        { headers: mockAuthHeaders }
      );
    });
  });

  // =========================================================================
  // 5. submitForm
  // =========================================================================
  describe('submitForm', () => {
    it('transforms payload, posts to API, and normalizes response', async () => {
      const mockSubmission: any = { formId: 'f1', answers: {} };
      const mockSchema: any = [];
      const mockPayload = { resourceType: 'QuestionnaireResponse' };
      const mockApiResponse = { id: 'response-1' };
      const mockFinalResult = { _id: 'sub-1' };

      (toFormSubmissionResponseDTO as jest.Mock).mockReturnValue(mockPayload);
      mockApiClient.post.mockResolvedValue({ data: mockApiResponse });
      (normalizeSubmissionFromApi as jest.Mock).mockReturnValue(mockFinalResult);

      const result = await formApi.submitForm({
        formId: 'f1',
        submission: mockSubmission,
        schema: mockSchema,
        accessToken: mockToken,
      });

      expect(toFormSubmissionResponseDTO).toHaveBeenCalledWith(mockSubmission, mockSchema);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/fhir/v1/form/mobile/forms/f1/submit',
        mockPayload,
        { headers: mockAuthHeaders }
      );

      expect(normalizeSubmissionFromApi).toHaveBeenCalledWith(
        mockApiResponse,
        mockSchema,
        expect.objectContaining({ formId: 'f1' })
      );

      expect(result).toEqual(mockFinalResult);
    });
  });

  // =========================================================================
  // 6. startSigning
  // =========================================================================
  describe('startSigning', () => {
    it('posts to signing endpoint and returns signing URL', async () => {
      const mockData = { signingUrl: 'http://sign.com', documentId: 123 };
      mockApiClient.post.mockResolvedValue({ data: mockData });

      const result = await formApi.startSigning({
        submissionId: 'sub-1',
        accessToken: mockToken,
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/fhir/v1/form/mobile/form-submissions/sub-1/sign',
        {},
        { headers: mockAuthHeaders }
      );
      expect(result).toEqual(mockData);
    });

    it('includes user-id header if provided', async () => {
      mockApiClient.post.mockResolvedValue({ data: {} });

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
        }
      );
    });
  });

  // =========================================================================
  // 7. mapAppointmentFormItem
  // =========================================================================
  describe('mapAppointmentFormItem', () => {
    const mockQuestionnaire: any = { resourceType: 'Questionnaire' };
    const mockForm: any = { id: 'f1', schema: [] };

    beforeEach(() => {
      (fromFormRequestDTO as jest.Mock).mockReturnValue(mockForm);
    });

    it('maps item with only questionnaire (no response)', () => {
      const item: any = { questionnaire: mockQuestionnaire };

      const result = mapAppointmentFormItem(item);

      expect(fromFormRequestDTO).toHaveBeenCalledWith(mockQuestionnaire);
      expect(result.form).toEqual(mockForm);
      expect(result.submission).toBeNull();
      expect(result.formVersion).toBeUndefined();
    });

    it('maps item with questionnaire response', () => {
      const mockQR: any = { resourceType: 'QuestionnaireResponse' };
      const mockSubmission: any = { formVersion: 2 };
      (fromFormSubmissionRequestDTO as jest.Mock).mockReturnValue(mockSubmission);

      const item: any = {
        questionnaire: mockQuestionnaire,
        questionnaireResponse: mockQR
      };

      const result = mapAppointmentFormItem(item);

      expect(fromFormSubmissionRequestDTO).toHaveBeenCalledWith(mockQR, mockForm.schema);
      expect(result.submission).toEqual(mockSubmission);
      expect(result.formVersion).toBe(2);
    });
  });
});