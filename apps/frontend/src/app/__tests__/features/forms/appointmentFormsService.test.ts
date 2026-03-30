import {
  fetchAppointmentForms,
  linkAppointmentForms,
} from '@/app/features/forms/services/appointmentFormsService';
import { fromFormRequestDTO, fromFormSubmissionRequestDTO } from '@yosemite-crew/types';

const postDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  postData: (...args: any[]) => postDataMock(...args),
  getData: jest.fn(),
  default: { get: jest.fn() },
}));

// Mock the types package transformers so we don't need real FHIR data
jest.mock('@yosemite-crew/types', () => {
  const original = jest.requireActual('@yosemite-crew/types');
  return {
    ...original,
    fromFormRequestDTO: jest.fn((dto: any) => ({
      _id: dto?.id ?? 'form-id',
      name: dto?.title ?? 'Form',
      schema: [],
      status: 'published',
      orgId: '',
      category: 'Custom',
      visibilityType: 'Internal',
      createdBy: '',
      updatedBy: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    fromFormSubmissionRequestDTO: jest.fn((dto: any) => ({
      _id: dto?.id ?? 'sub-id',
      formId: 'form-id',
      answers: [],
    })),
  };
});

describe('fetchAppointmentForms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns mapped forms for valid items', async () => {
    postDataMock.mockResolvedValue({
      data: {
        appointmentId: 'appt-1',
        items: [
          {
            questionnaire: { id: 'q1', title: 'Consent Form' },
            questionnaireResponse: { id: 'qr1' },
            status: 'completed',
          },
        ],
      },
    });

    const result = await fetchAppointmentForms('appt-1');
    expect(result.appointmentId).toBe('appt-1');
    expect(result.forms).toHaveLength(1);
    expect(result.forms[0].status).toBe('completed');
  });

  it('returns forms with pending status when no response and no explicit status', async () => {
    postDataMock.mockResolvedValue({
      data: {
        appointmentId: 'appt-2',
        items: [
          {
            questionnaire: { id: 'q2', title: 'New Form' },
            status: '',
          },
        ],
      },
    });

    const result = await fetchAppointmentForms('appt-2');
    expect(result.forms[0].status).toBe('pending');
  });

  it('returns forms with pending status when status contains "pending"', async () => {
    postDataMock.mockResolvedValue({
      data: {
        appointmentId: 'appt-3',
        items: [
          {
            questionnaire: { id: 'q3', title: 'Form 3' },
            status: 'in-pending',
          },
        ],
      },
    });

    const result = await fetchAppointmentForms('appt-3');
    expect(result.forms[0].status).toBe('pending');
  });

  it('returns forms with completed status when status contains "signed"', async () => {
    postDataMock.mockResolvedValue({
      data: {
        appointmentId: 'appt-4',
        items: [
          {
            questionnaire: { id: 'q4' },
            status: 'signed',
          },
        ],
      },
    });

    const result = await fetchAppointmentForms('appt-4');
    expect(result.forms[0].status).toBe('completed');
  });

  it('filters out null items (invalid forms)', async () => {
    (fromFormRequestDTO as jest.Mock).mockImplementationOnce(() => {
      throw new Error('invalid FHIR');
    });

    postDataMock.mockResolvedValue({
      data: {
        appointmentId: 'appt-5',
        items: [{ questionnaire: null, status: '' }],
      },
    });

    // console.error is thrown as an error in jest.setup.ts — suppress it for this test
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await fetchAppointmentForms('appt-5');
    (console.error as jest.Mock).mockRestore();
    expect(result.forms).toHaveLength(0);
  });

  it('handles empty items array', async () => {
    postDataMock.mockResolvedValue({
      data: { appointmentId: 'appt-6', items: [] },
    });

    const result = await fetchAppointmentForms('appt-6');
    expect(result.forms).toEqual([]);
    expect(result.appointmentId).toBe('appt-6');
  });

  it('handles missing items field', async () => {
    postDataMock.mockResolvedValue({
      data: { appointmentId: 'appt-7' },
    });

    const result = await fetchAppointmentForms('appt-7');
    expect(result.forms).toEqual([]);
  });
});

describe('fetchAppointmentForms - fallback forms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses fallback form when questionnaire throws but questionnaireResponse present', async () => {
    (fromFormRequestDTO as jest.Mock).mockImplementationOnce(() => {
      throw new Error('invalid FHIR');
    });

    const qr = {
      id: 'qr-1',
      title: 'Fallback Form',
      item: [{ linkId: 'field1', text: 'What is your name?', answer: [] }],
    };

    jest.spyOn(console, 'error').mockImplementation(() => {});
    postDataMock.mockResolvedValue({
      data: {
        appointmentId: 'appt-fallback',
        items: [
          {
            questionnaire: null,
            questionnaireResponse: qr,
            status: 'completed',
          },
        ],
      },
    });

    const result = await fetchAppointmentForms('appt-fallback');
    (console.error as jest.Mock).mockRestore();
    // fallback form is generated from the questionnaireResponse
    expect(result.forms).toHaveLength(1);
  });

  it('handles items with boolean answer type', async () => {
    (fromFormRequestDTO as jest.Mock).mockImplementationOnce(() => {
      throw new Error('invalid');
    });

    jest.spyOn(console, 'error').mockImplementation(() => {});
    postDataMock.mockResolvedValue({
      data: {
        appointmentId: 'appt-bool',
        items: [
          {
            questionnaire: null,
            questionnaireResponse: {
              id: 'qr-bool',
              item: [{ linkId: 'q1', text: 'Agree?', answer: [{ valueBoolean: true }] }],
            },
            status: '',
          },
        ],
      },
    });

    const result = await fetchAppointmentForms('appt-bool');
    (console.error as jest.Mock).mockRestore();
    expect(result.forms).toHaveLength(1);
  });

  it('handles items with date answer type', async () => {
    (fromFormRequestDTO as jest.Mock).mockImplementationOnce(() => {
      throw new Error('invalid');
    });

    jest.spyOn(console, 'error').mockImplementation(() => {});
    postDataMock.mockResolvedValue({
      data: {
        appointmentId: 'appt-date',
        items: [
          {
            questionnaire: null,
            questionnaireResponse: {
              id: 'qr-date',
              item: [{ linkId: 'q1', text: 'Birth date?', answer: [{ valueDate: '2000-01-01' }] }],
            },
            status: '',
          },
        ],
      },
    });

    const result = await fetchAppointmentForms('appt-date');
    (console.error as jest.Mock).mockRestore();
    expect(result.forms).toHaveLength(1);
  });

  it('handles items with signature field by linkId', async () => {
    (fromFormRequestDTO as jest.Mock).mockImplementationOnce(() => {
      throw new Error('invalid');
    });

    jest.spyOn(console, 'error').mockImplementation(() => {});
    postDataMock.mockResolvedValue({
      data: {
        appointmentId: 'appt-sig',
        items: [
          {
            questionnaire: null,
            questionnaireResponse: {
              id: 'qr-sig',
              item: [{ linkId: 'patient_signature', text: 'Sign here', answer: [] }],
            },
            status: '',
          },
        ],
      },
    });

    const result = await fetchAppointmentForms('appt-sig');
    (console.error as jest.Mock).mockRestore();
    expect(result.forms).toHaveLength(1);
  });

  it('handles grouped items with children', async () => {
    (fromFormRequestDTO as jest.Mock).mockImplementationOnce(() => {
      throw new Error('invalid');
    });

    jest.spyOn(console, 'error').mockImplementation(() => {});
    postDataMock.mockResolvedValue({
      data: {
        appointmentId: 'appt-group',
        items: [
          {
            questionnaire: null,
            questionnaireResponse: {
              id: 'qr-group',
              item: [
                {
                  linkId: 'group1',
                  text: 'Personal Info',
                  item: [{ linkId: 'sub1', text: 'Name', answer: [] }],
                },
              ],
            },
            status: '',
          },
        ],
      },
    });

    const result = await fetchAppointmentForms('appt-group');
    (console.error as jest.Mock).mockRestore();
    expect(result.forms).toHaveLength(1);
  });
});

describe('linkAppointmentForms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the correct endpoint with formIds', async () => {
    postDataMock.mockResolvedValue({ data: {} });

    await linkAppointmentForms({
      organisationId: 'org-1',
      appointmentId: 'appt-1',
      formIds: ['f1', 'f2'],
    });

    expect(postDataMock).toHaveBeenCalledWith('/fhir/v1/appointment/pms/org-1/appt-1/forms', {
      formIds: ['f1', 'f2'],
    });
  });

  it('throws error when organisationId is missing', async () => {
    await expect(
      linkAppointmentForms({
        organisationId: '',
        appointmentId: 'appt-1',
        formIds: ['f1'],
      })
    ).rejects.toThrow('Organisation and appointment IDs are required.');
  });

  it('throws error when appointmentId is missing', async () => {
    await expect(
      linkAppointmentForms({
        organisationId: 'org-1',
        appointmentId: '',
        formIds: ['f1'],
      })
    ).rejects.toThrow('Organisation and appointment IDs are required.');
  });
});
