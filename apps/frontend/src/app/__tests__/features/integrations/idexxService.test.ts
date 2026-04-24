import {
  getApiErrorMessage,
  getOrgIntegrations,
  getIntegrationByProvider,
  storeIntegrationCredentials,
  validateIntegrationCredentials,
  enableIntegration,
  disableIntegration,
  listIdexxTests,
  getIdexxCensus,
  addPatientToIdexxCensus,
  createIdexxLabOrder,
  getIdexxOrderById,
  listIdexxOrders,
  listIdexxIvlsDevices,
  listIdexxResults,
  getIdexxResultById,
  getIdexxResultPdfUrl,
  getIdexxResultPdfBlob,
} from '@/app/features/integrations/services/idexxService';

const getDataMock = jest.fn();
const postDataMock = jest.fn();
const apiGetMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...args: any[]) => getDataMock(...args),
  postData: (...args: any[]) => postDataMock(...args),
  default: { get: (...args: any[]) => apiGetMock(...args) },
}));

// Create an axios error helper for tests
const makeAxiosError = (status: number, data?: any) => ({
  isAxiosError: true,
  response: { status, data: data ?? {} },
});

// Override axios.isAxiosError to work with our fake error objects
jest.mock('axios', () => ({
  isAxiosError: (e: any) => Boolean(e?.isAxiosError),
}));

describe('getApiErrorMessage', () => {
  it('returns fallback for non-axios errors', () => {
    expect(getApiErrorMessage(new Error('oops'), 'Default')).toBe('Default');
  });

  it('returns fallback for null', () => {
    expect(getApiErrorMessage(null, 'Default')).toBe('Default');
  });

  it('returns 403 Forbidden message without backend message', () => {
    const msg = getApiErrorMessage(makeAxiosError(403), 'Default');
    expect(msg).toContain('403');
    expect(msg).toContain('Forbidden');
  });

  it('returns 403 Forbidden message with backend message', () => {
    const msg = getApiErrorMessage(makeAxiosError(403, { message: 'org not found' }), 'Default');
    expect(msg).toContain('Forbidden (403)');
    expect(msg).toContain('org not found');
  });

  it('returns status code with fallback for other errors', () => {
    const msg = getApiErrorMessage(makeAxiosError(500), 'Server Error');
    expect(msg).toContain('500');
    expect(msg).toContain('Server Error');
  });

  it('returns status with backend message for other errors', () => {
    const msg = getApiErrorMessage(makeAxiosError(400, { error: 'bad input' }), 'Fallback');
    expect(msg).toContain('bad input');
  });

  it('returns fallback when no status', () => {
    const fakeErr = { isAxiosError: true, response: undefined };
    expect(getApiErrorMessage(fakeErr, 'No status')).toBe('No status');
  });
});

describe('getOrgIntegrations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns data on success', async () => {
    const integrations = [{ provider: 'IDEXX' }];
    getDataMock.mockResolvedValue({ data: integrations });
    const result = await getOrgIntegrations('org-1');
    expect(result).toEqual(integrations);
  });

  it('returns empty array on 404', async () => {
    getDataMock.mockRejectedValue(makeAxiosError(404));
    const result = await getOrgIntegrations('org-1');
    expect(result).toEqual([]);
  });

  it('re-throws non-404 errors', async () => {
    getDataMock.mockRejectedValue(makeAxiosError(500));
    await expect(getOrgIntegrations('org-1')).rejects.toBeDefined();
  });

  it('returns empty array when data is null', async () => {
    getDataMock.mockResolvedValue({ data: null });
    const result = await getOrgIntegrations('org-1');
    expect(result).toEqual([]);
  });
});

describe('getIntegrationByProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns matching integration', async () => {
    getDataMock.mockResolvedValue({
      data: [{ provider: 'IDEXX' }, { provider: 'merck' }],
    });
    const result = await getIntegrationByProvider('org-1', 'IDEXX');
    expect(result?.provider).toBe('IDEXX');
  });

  it('returns null when no match found', async () => {
    getDataMock.mockResolvedValue({ data: [{ provider: 'MERCK' }] });
    const result = await getIntegrationByProvider('org-1', 'IDEXX');
    expect(result).toBeNull();
  });

  it('is case-insensitive for provider matching', async () => {
    getDataMock.mockResolvedValue({ data: [{ provider: 'idexx' }] });
    const result = await getIntegrationByProvider('org-1', 'IDEXX');
    expect(result?.provider).toBe('idexx');
  });

  it('defaults to IDEXX provider', async () => {
    getDataMock.mockResolvedValue({ data: [{ provider: 'IDEXX' }] });
    const result = await getIntegrationByProvider('org-1');
    expect(result?.provider).toBe('IDEXX');
  });
});

describe('storeIntegrationCredentials', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts credentials and returns integration', async () => {
    const integration = { provider: 'IDEXX', enabled: true };
    postDataMock.mockResolvedValue({ data: integration });
    const result = await storeIntegrationCredentials('org-1', {
      username: 'u',
      password: 'p',
    } as any);
    expect(result).toEqual(integration);
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/integration/pms/organisation/org-1/IDEXX/credentials',
      { username: 'u', password: 'p' }
    );
  });
});

describe('validateIntegrationCredentials', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts to validate endpoint and returns response', async () => {
    postDataMock.mockResolvedValue({ data: { valid: true } });
    const result = await validateIntegrationCredentials('org-1', 'IDEXX');
    expect(result).toEqual({ valid: true });
  });
});

describe('enableIntegration / disableIntegration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enableIntegration posts to enable endpoint', async () => {
    postDataMock.mockResolvedValue({ data: { enabled: true } });
    const result = await enableIntegration('org-1', 'IDEXX');
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/integration/pms/organisation/org-1/idexx/enable'
    );
    expect(result).toEqual({ enabled: true });
  });

  it('disableIntegration posts to disable endpoint', async () => {
    postDataMock.mockResolvedValue({ data: { enabled: false } });
    const result = await disableIntegration('org-1', 'IDEXX');
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/integration/pms/organisation/org-1/idexx/disable'
    );
    expect(result).toEqual({ enabled: false });
  });
});

describe('listIdexxTests', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches tests with defaults', async () => {
    getDataMock.mockResolvedValue({ data: { tests: [] } });
    const result = await listIdexxTests({ organisationId: 'org-1' });
    expect(result).toEqual({ tests: [] });
    expect(getDataMock).toHaveBeenCalledWith('/v1/labs/pms/organisation/org-1/idexx/tests', {
      query: '',
      page: 1,
      limit: 25,
    });
  });

  it('passes custom pagination parameters', async () => {
    getDataMock.mockResolvedValue({ data: { tests: [] } });
    await listIdexxTests({ organisationId: 'org-1', query: 'blood', page: 2, limit: 10 });
    expect(getDataMock).toHaveBeenCalledWith('/v1/labs/pms/organisation/org-1/idexx/tests', {
      query: 'blood',
      page: 2,
      limit: 10,
    });
  });
});

describe('getIdexxCensus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns census entries', async () => {
    getDataMock.mockResolvedValue({ data: [{ id: 'c1' }] });
    const result = await getIdexxCensus('org-1');
    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('returns empty array when data is null', async () => {
    getDataMock.mockResolvedValue({ data: null });
    const result = await getIdexxCensus('org-1');
    expect(result).toEqual([]);
  });
});

describe('addPatientToIdexxCensus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts and returns census entry', async () => {
    const entry = { id: 'e1' };
    postDataMock.mockResolvedValue({ data: entry });
    const result = await addPatientToIdexxCensus({
      organisationId: 'org-1',
      payload: { patientId: 'p1' } as any,
    });
    expect(result).toEqual(entry);
  });
});

describe('createIdexxLabOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts and returns lab order', async () => {
    const order = { id: 'lo1' };
    postDataMock.mockResolvedValue({ data: order });
    const result = await createIdexxLabOrder({
      organisationId: 'org-1',
      payload: { tests: [] } as any,
    });
    expect(result).toEqual(order);
  });
});

describe('getIdexxOrderById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches and returns order by ID', async () => {
    const order = { id: 'lo1' };
    getDataMock.mockResolvedValue({ data: order });
    const result = await getIdexxOrderById({ organisationId: 'org-1', idexxOrderId: 'lo1' });
    expect(result).toEqual(order);
  });
});

describe('listIdexxOrders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns array when data is array', async () => {
    const orders = [{ id: 'o1' }, { id: 'o2' }];
    postDataMock.mockResolvedValue({ data: orders });
    const result = await listIdexxOrders({ organisationId: 'org-1' });
    expect(result).toEqual(orders);
  });

  it('returns orders from object payload', async () => {
    const orders = [{ id: 'o1' }];
    postDataMock.mockResolvedValue({ data: { orders } });
    const result = await listIdexxOrders({ organisationId: 'org-1' });
    expect(result).toEqual(orders);
  });

  it('returns empty array when orders property is missing', async () => {
    postDataMock.mockResolvedValue({ data: {} });
    const result = await listIdexxOrders({ organisationId: 'org-1' });
    expect(result).toEqual([]);
  });

  it('posts appointmentId when provided', async () => {
    postDataMock.mockResolvedValue({ data: [] });
    await listIdexxOrders({ organisationId: 'org-1', appointmentId: 'appt-1' });
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/labs/pms/organisation/org-1/idexx/orders/search',
      {
        appointmentId: 'appt-1',
      }
    );
  });

  it('posts companionId, status, and limit when provided', async () => {
    postDataMock.mockResolvedValue({ data: [] });
    await listIdexxOrders({
      organisationId: 'org-1',
      companionId: 'comp-1',
      status: 'SUBMITTED',
      limit: 10,
    });
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/labs/pms/organisation/org-1/idexx/orders/search',
      {
        companionId: 'comp-1',
        status: 'SUBMITTED',
        limit: 10,
      }
    );
  });

  it('posts merged search filters when multiple are provided', async () => {
    postDataMock.mockResolvedValue({ data: [] });
    await listIdexxOrders({
      organisationId: 'org-1',
      appointmentId: 'appt-1',
      companionId: 'comp-1',
    });
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/labs/pms/organisation/org-1/idexx/orders/search',
      {
        appointmentId: 'appt-1',
        companionId: 'comp-1',
      }
    );
  });

  it('posts empty object when no search filters are provided', async () => {
    postDataMock.mockResolvedValue({ data: [] });
    await listIdexxOrders({ organisationId: 'org-1' });
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/labs/pms/organisation/org-1/idexx/orders/search',
      {}
    );
  });
});

describe('listIdexxIvlsDevices', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches and returns IVLS devices', async () => {
    const devices = { devices: [] };
    getDataMock.mockResolvedValue({ data: devices });
    const result = await listIdexxIvlsDevices('org-1');
    expect(result).toEqual(devices);
  });
});

describe('listIdexxResults', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns results array', async () => {
    const results = [{ id: 'r1' }];
    getDataMock.mockResolvedValue({ data: results });
    const result = await listIdexxResults('org-1');
    expect(result).toEqual(results);
  });

  it('returns empty array when data is null', async () => {
    getDataMock.mockResolvedValue({ data: null });
    const result = await listIdexxResults('org-1');
    expect(result).toEqual([]);
  });
});

describe('getIdexxResultById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches and returns result by ID', async () => {
    const result = { id: 'r1' };
    getDataMock.mockResolvedValue({ data: result });
    const res = await getIdexxResultById({ organisationId: 'org-1', resultId: 'r1' });
    expect(res).toEqual(result);
  });
});

describe('getIdexxResultPdfUrl', () => {
  it('constructs the correct URL', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://api.example.com';
    const url = getIdexxResultPdfUrl({ organisationId: 'org-1', resultId: 'r1' });
    expect(url).toContain('org-1');
    expect(url).toContain('r1');
    expect(url).toContain('pdf');
  });
});

// Helper to create a Blob with a working .text() method (jsdom Blob lacks it)
const makeTextBlob = (text: string, type = 'text/plain') => {
  const blob = new Blob([text], { type });
  blob.text = () => Promise.resolve(text);
  return blob;
};

describe('getIdexxResultPdfBlob', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns blob directly when content type is application/pdf', async () => {
    const mockBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    apiGetMock.mockResolvedValue({ data: mockBlob });
    const result = await getIdexxResultPdfBlob({ organisationId: 'org-1', resultId: 'r1' });
    expect(result).toBeInstanceOf(Blob);
  });

  it('converts hex string to PDF blob', async () => {
    const hex = '48656c6c6f'; // "Hello" in hex (valid even-length hex)
    const textBlob = makeTextBlob(hex);
    apiGetMock.mockResolvedValue({ data: textBlob });
    const result = await getIdexxResultPdfBlob({ organisationId: 'org-1', resultId: 'r1' });
    expect(result.type).toBe('application/pdf');
  });

  it('converts hex from JSON payload', async () => {
    const hex = '48656c6c6f'; // valid hex
    const jsonBlob = makeTextBlob(JSON.stringify({ hex }));
    apiGetMock.mockResolvedValue({ data: jsonBlob });
    const result = await getIdexxResultPdfBlob({ organisationId: 'org-1', resultId: 'r1' });
    expect(result.type).toBe('application/pdf');
  });

  it('throws error for empty response', async () => {
    const emptyBlob = makeTextBlob('');
    apiGetMock.mockResolvedValue({ data: emptyBlob });
    await expect(
      getIdexxResultPdfBlob({ organisationId: 'org-1', resultId: 'r1' })
    ).rejects.toThrow('Empty PDF response');
  });

  it('wraps non-hex text blob as pdf', async () => {
    const nonHexBlob = makeTextBlob('not hex data!!!');
    apiGetMock.mockResolvedValue({ data: nonHexBlob });
    const result = await getIdexxResultPdfBlob({ organisationId: 'org-1', resultId: 'r1' });
    expect(result.type).toBe('application/pdf');
  });
});
