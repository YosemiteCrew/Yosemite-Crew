import {
  approveEstimate,
  convertEstimate,
  createEstimate,
  declineEstimate,
  deleteEstimate,
  getEstimate,
  getEstimateErrorMessage,
  listEstimates,
  markEstimateSent,
  updateEstimate,
} from '@/app/features/finance/services/estimateService';
import type { CreateEstimateInput, Estimate } from '@/app/features/finance/types/estimate';
import { deleteData, getData, patchData, postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  patchData: jest.fn(),
  deleteData: jest.fn(),
}));

const mockGetData = getData as jest.Mock;
const mockPostData = postData as jest.Mock;
const mockPatchData = patchData as jest.Mock;
const mockDeleteData = deleteData as jest.Mock;

const ESTIMATES_PATH = '/v1/pms/organisation/org-1/estimates';
const ESTIMATE_PATH = `${ESTIMATES_PATH}/est-1`;

const estimate: Estimate = {
  id: 'est-1',
  organisationId: 'org-1',
  patientId: 'pat-1',
  encounterId: null,
  status: 'DRAFT',
  validUntil: null,
  subtotal: 100,
  taxAmount: 20,
  total: 120,
  currency: 'GBP',
  notes: null,
  approvedBy: null,
  approvedAt: null,
  declinedAt: null,
  declineReason: null,
  convertedToInvoiceId: null,
  createdBy: 'user-1',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
  items: [
    {
      id: 'item-1',
      description: 'Consultation',
      quantity: 1,
      unitPrice: 100,
      taxRate: 20,
      lineTotal: 120,
      notes: null,
    },
  ],
};

const createInput: CreateEstimateInput = {
  patientId: 'pat-1',
  items: [{ description: 'Consultation', quantity: 1, unitPrice: 100 }],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listEstimates', () => {
  it('reads the organisation estimates with no filters', async () => {
    mockGetData.mockResolvedValue({ data: [estimate] });

    const estimates = await listEstimates('org-1');

    expect(mockGetData).toHaveBeenCalledWith(ESTIMATES_PATH, {});
    expect(estimates).toEqual([estimate]);
  });

  it('passes the status filter as a params argument, not a query string', async () => {
    mockGetData.mockResolvedValue({ data: [] });

    await listEstimates('org-1', { status: 'APPROVED' });

    expect(mockGetData).toHaveBeenCalledWith(ESTIMATES_PATH, { status: 'APPROVED' });
    const [path] = mockGetData.mock.calls[0];
    expect(path).not.toContain('?');
  });

  it('passes the patient filter as a params argument, not a query string', async () => {
    mockGetData.mockResolvedValue({ data: [] });

    await listEstimates('org-1', { patientId: 'pat-9' });

    expect(mockGetData).toHaveBeenCalledWith(ESTIMATES_PATH, { patientId: 'pat-9' });
    const [path] = mockGetData.mock.calls[0];
    expect(path).not.toContain('?');
  });

  it('passes both filters together', async () => {
    mockGetData.mockResolvedValue({ data: [] });

    await listEstimates('org-1', { patientId: 'pat-9', status: 'SENT' });

    expect(mockGetData).toHaveBeenCalledWith(ESTIMATES_PATH, {
      patientId: 'pat-9',
      status: 'SENT',
    });
  });

  it('omits empty filter values', async () => {
    mockGetData.mockResolvedValue({ data: [] });

    await listEstimates('org-1', { patientId: '', status: undefined });

    expect(mockGetData).toHaveBeenCalledWith(ESTIMATES_PATH, {});
  });

  it('returns an empty array when the body is an object rather than a list', async () => {
    mockGetData.mockResolvedValue({ data: { error: 'Bad gateway' } });

    await expect(listEstimates('org-1')).resolves.toEqual([]);
  });

  it('returns an empty array when the body is null', async () => {
    mockGetData.mockResolvedValue({ data: null });

    await expect(listEstimates('org-1')).resolves.toEqual([]);
  });

  it('throws when the organisation id is missing', async () => {
    await expect(listEstimates('')).rejects.toThrow('Organisation ID missing');
    expect(mockGetData).not.toHaveBeenCalled();
  });

  it('propagates a transport failure', async () => {
    mockGetData.mockRejectedValue(new Error('network down'));

    await expect(listEstimates('org-1')).rejects.toThrow('network down');
  });
});

describe('getEstimate', () => {
  it('reads one estimate by id', async () => {
    mockGetData.mockResolvedValue({ data: estimate });

    await expect(getEstimate('org-1', 'est-1')).resolves.toEqual(estimate);
    expect(mockGetData).toHaveBeenCalledWith(ESTIMATE_PATH);
  });

  it('throws when the organisation id is missing', async () => {
    await expect(getEstimate('', 'est-1')).rejects.toThrow('Organisation ID missing');
    expect(mockGetData).not.toHaveBeenCalled();
  });
});

describe('createEstimate', () => {
  it('POSTs the input to the estimates collection', async () => {
    mockPostData.mockResolvedValue({ data: estimate });

    await expect(createEstimate('org-1', createInput)).resolves.toEqual(estimate);
    expect(mockPostData).toHaveBeenCalledWith(ESTIMATES_PATH, createInput);
  });

  it('throws when the organisation id is missing', async () => {
    await expect(createEstimate('', createInput)).rejects.toThrow('Organisation ID missing');
    expect(mockPostData).not.toHaveBeenCalled();
  });
});

describe('markEstimateSent', () => {
  it('POSTs an empty body to the send action', async () => {
    mockPostData.mockResolvedValue({ data: { ...estimate, status: 'SENT' } });

    const sent = await markEstimateSent('org-1', 'est-1');

    expect(mockPostData).toHaveBeenCalledWith(`${ESTIMATE_PATH}/send`, {});
    expect(sent.status).toBe('SENT');
  });

  it('throws when the organisation id is missing', async () => {
    await expect(markEstimateSent('', 'est-1')).rejects.toThrow('Organisation ID missing');
    expect(mockPostData).not.toHaveBeenCalled();
  });
});

describe('approveEstimate', () => {
  it('POSTs an empty body to the approve action', async () => {
    mockPostData.mockResolvedValue({ data: { ...estimate, status: 'APPROVED' } });

    const approved = await approveEstimate('org-1', 'est-1');

    expect(mockPostData).toHaveBeenCalledWith(`${ESTIMATE_PATH}/approve`, {});
    expect(approved.status).toBe('APPROVED');
  });

  it('throws when the organisation id is missing', async () => {
    await expect(approveEstimate('', 'est-1')).rejects.toThrow('Organisation ID missing');
    expect(mockPostData).not.toHaveBeenCalled();
  });
});

describe('declineEstimate', () => {
  it('sends the reason when one is given', async () => {
    mockPostData.mockResolvedValue({ data: { ...estimate, status: 'DECLINED' } });

    const declined = await declineEstimate('org-1', 'est-1', 'Owner declined the plan');

    expect(mockPostData).toHaveBeenCalledWith(`${ESTIMATE_PATH}/decline`, {
      reason: 'Owner declined the plan',
    });
    expect(declined.status).toBe('DECLINED');
  });

  it('sends an empty body when no reason is given', async () => {
    mockPostData.mockResolvedValue({ data: estimate });

    await declineEstimate('org-1', 'est-1');

    expect(mockPostData).toHaveBeenCalledWith(`${ESTIMATE_PATH}/decline`, {});
  });

  it('sends an empty body for a blank reason rather than an empty string', async () => {
    mockPostData.mockResolvedValue({ data: estimate });

    await declineEstimate('org-1', 'est-1', '');

    expect(mockPostData).toHaveBeenCalledWith(`${ESTIMATE_PATH}/decline`, {});
  });

  it('throws when the organisation id is missing', async () => {
    await expect(declineEstimate('', 'est-1', 'nope')).rejects.toThrow('Organisation ID missing');
    expect(mockPostData).not.toHaveBeenCalled();
  });
});

describe('convertEstimate', () => {
  it('POSTs an empty body to the convert action', async () => {
    mockPostData.mockResolvedValue({
      data: { ...estimate, status: 'CONVERTED', convertedToInvoiceId: 'inv-1' },
    });

    const converted = await convertEstimate('org-1', 'est-1');

    expect(mockPostData).toHaveBeenCalledWith(`${ESTIMATE_PATH}/convert`, {});
    expect(converted.convertedToInvoiceId).toBe('inv-1');
  });

  it('throws when the organisation id is missing', async () => {
    await expect(convertEstimate('', 'est-1')).rejects.toThrow('Organisation ID missing');
    expect(mockPostData).not.toHaveBeenCalled();
  });
});

describe('updateEstimate', () => {
  it('PATCHes the changed fields onto the estimate', async () => {
    mockPatchData.mockResolvedValue({ data: { ...estimate, notes: 'Revised' } });

    const updated = await updateEstimate('org-1', 'est-1', { notes: 'Revised' });

    expect(mockPatchData).toHaveBeenCalledWith(ESTIMATE_PATH, { notes: 'Revised' });
    expect(updated.notes).toBe('Revised');
  });

  it('PATCHes replacement items', async () => {
    mockPatchData.mockResolvedValue({ data: estimate });

    await updateEstimate('org-1', 'est-1', {
      items: [{ description: 'Dental', quantity: 2, unitPrice: 50 }],
      currency: 'EUR',
    });

    expect(mockPatchData).toHaveBeenCalledWith(ESTIMATE_PATH, {
      items: [{ description: 'Dental', quantity: 2, unitPrice: 50 }],
      currency: 'EUR',
    });
  });

  it('throws when the organisation id is missing', async () => {
    await expect(updateEstimate('', 'est-1', { notes: 'x' })).rejects.toThrow(
      'Organisation ID missing'
    );
    expect(mockPatchData).not.toHaveBeenCalled();
  });
});

describe('deleteEstimate', () => {
  it('DELETEs the estimate and resolves with nothing', async () => {
    mockDeleteData.mockResolvedValue({ data: null });

    await expect(deleteEstimate('org-1', 'est-1')).resolves.toBeUndefined();
    expect(mockDeleteData).toHaveBeenCalledWith(ESTIMATE_PATH);
  });

  it('throws when the organisation id is missing', async () => {
    await expect(deleteEstimate('', 'est-1')).rejects.toThrow('Organisation ID missing');
    expect(mockDeleteData).not.toHaveBeenCalled();
  });

  it('propagates a transport failure', async () => {
    mockDeleteData.mockRejectedValue(new Error('Request failed with status code 409'));

    await expect(deleteEstimate('org-1', 'est-1')).rejects.toThrow(
      'Request failed with status code 409'
    );
  });
});

describe('getEstimateErrorMessage', () => {
  it('reads the string error the controller sends for a service failure', () => {
    const error = {
      message: 'Request failed with status code 400',
      response: { data: { error: 'Only APPROVED estimates can be converted.' } },
    };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe(
      'Only APPROVED estimates can be converted.'
    );
  });

  it('trims a padded string error', () => {
    const error = { response: { data: { error: '  Estimate not found  ' } } };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe('Estimate not found');
  });

  it('renders a zod flatten as readable text rather than [object Object]', () => {
    const error = {
      response: {
        data: { error: { formErrors: ['bad'], fieldErrors: { items: ['Required'] } } },
      },
    };

    const message = getEstimateErrorMessage(error, 'fallback');

    expect(message).toBe('bad. items: Required');
    expect(message).not.toContain('[object Object]');
  });

  it('renders field errors only', () => {
    const error = {
      response: {
        data: {
          error: {
            formErrors: [],
            fieldErrors: { items: ['Required'], patientId: ['Expected string'] },
          },
        },
      },
    };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe(
      'items: Required. patientId: Expected string'
    );
  });

  it('renders several messages for one field', () => {
    const error = {
      response: {
        data: { error: { fieldErrors: { currency: ['Too short', 'Too long'] } } },
      },
    };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe(
      'currency: Too short. currency: Too long'
    );
  });

  it('renders form errors only', () => {
    const error = {
      response: { data: { error: { formErrors: ['Invalid body'], fieldErrors: {} } } },
    };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe('Invalid body');
  });

  it('falls back when the flatten carries no messages at all', () => {
    const error = { response: { data: { error: { formErrors: [], fieldErrors: {} } } } };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('falls back when the flatten has neither key', () => {
    const error = { response: { data: { error: {} } } };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('ignores non-string entries inside the flatten', () => {
    const error = {
      response: {
        data: {
          error: {
            formErrors: [1, 'kept'],
            fieldErrors: { items: 'not an array', notes: [null, 'too long'] },
          },
        },
      },
    };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe('kept. notes: too long');
  });

  it('falls back when formErrors is not an array and there is nothing else', () => {
    const error = { response: { data: { error: { formErrors: 'nope' } } } };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('reads a plain message body', () => {
    const error = { response: { data: { message: 'x' } } };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe('x');
  });

  it('prefers the error key over the message key', () => {
    const error = { response: { data: { error: 'from error', message: 'from message' } } };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe('from error');
  });

  it('falls back for a blank string body', () => {
    const error = { response: { data: { error: '   ' } } };

    expect(getEstimateErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('returns the message of a plain Error', () => {
    expect(getEstimateErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('falls back for an Error with a blank message', () => {
    expect(getEstimateErrorMessage(new Error('   '), 'fallback')).toBe('fallback');
  });

  it('prefers the response body over the axios Error message', () => {
    const error = Object.assign(new Error('Request failed with status code 409'), {
      response: { data: { error: 'Estimate already converted.' } },
    });

    expect(getEstimateErrorMessage(error, 'fallback')).toBe('Estimate already converted.');
  });

  it('falls back for null and undefined', () => {
    expect(getEstimateErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getEstimateErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('falls back for a string and a number', () => {
    expect(getEstimateErrorMessage('nope', 'fallback')).toBe('fallback');
    expect(getEstimateErrorMessage(404, 'fallback')).toBe('fallback');
  });

  it('falls back when the response data is not an object', () => {
    expect(getEstimateErrorMessage({ response: { data: 'oops' } }, 'fallback')).toBe('fallback');
  });

  it('falls back when there is no response at all', () => {
    expect(getEstimateErrorMessage({ config: {} }, 'fallback')).toBe('fallback');
  });
});
