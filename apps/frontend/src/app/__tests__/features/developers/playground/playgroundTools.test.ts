import {
  buildToolUrl,
  describeDataApiError,
  executePlaygroundTool,
  PLAYGROUND_TOOLS,
} from '@/app/features/developers/playground/playgroundTools';

const BASE_URL = 'http://localhost:8000';
const CONFIG = { baseUrl: BASE_URL, yosemiteKey: 'yc_test_fake_key' };

const fetchMock = jest.fn();

const mockResponse = (status: number, body: string) => ({
  ok: status >= 200 && status < 300,
  status,
  text: jest.fn().mockResolvedValue(body),
});

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('PLAYGROUND_TOOLS allowlist', () => {
  test('contains exactly the eight read-only tools from the v1 contract', () => {
    expect(PLAYGROUND_TOOLS.map((tool) => tool.name)).toEqual([
      'list_appointments',
      'get_appointment',
      'list_patients',
      'get_patient',
      'list_encounters',
      'list_invoices',
      'get_organization',
      'get_usage',
    ]);
  });

  test('every tool declares an object input schema', () => {
    PLAYGROUND_TOOLS.forEach((tool) => {
      expect(tool.input_schema.type).toBe('object');
      expect(tool.description.length).toBeGreaterThan(20);
    });
  });

  test('id tools mark id as required', () => {
    const getAppointment = PLAYGROUND_TOOLS.find((tool) => tool.name === 'get_appointment');
    const getPatient = PLAYGROUND_TOOLS.find((tool) => tool.name === 'get_patient');
    expect(getAppointment?.input_schema.required).toEqual(['id']);
    expect(getPatient?.input_schema.required).toEqual(['id']);
  });
});

describe('buildToolUrl', () => {
  test('builds list URLs with only allowlisted query params', () => {
    const url = buildToolUrl(
      'list_appointments',
      { limit: 10, status: 'UPCOMING', bogus: 'dropme', cursor: 'abc' },
      BASE_URL
    );
    expect(url).toBe(
      'http://localhost:8000/v1/developer/appointments?limit=10&cursor=abc&status=UPCOMING'
    );
  });

  test('omits the query string when no params are provided', () => {
    expect(buildToolUrl('list_patients', {}, BASE_URL)).toBe(
      'http://localhost:8000/v1/developer/patients'
    );
  });

  test('skips non-scalar query values', () => {
    const url = buildToolUrl('list_invoices', { status: { nested: true }, limit: 5 }, BASE_URL);
    expect(url).toBe('http://localhost:8000/v1/developer/invoices?limit=5');
  });

  test('supports encounter filters from the contract', () => {
    const url = buildToolUrl(
      'list_encounters',
      { patientId: 'p1', caseId: 'c1', dateFrom: '2026-07-01T00:00:00+00:00' },
      BASE_URL
    );
    expect(url).toContain('/v1/developer/encounters?');
    expect(url).toContain('patientId=p1');
    expect(url).toContain('caseId=c1');
    expect(url).toContain('dateFrom=2026-07-01T00%3A00%3A00%2B00%3A00');
  });

  test('builds id URLs with encoding and trims trailing slashes from the base', () => {
    expect(buildToolUrl('get_appointment', { id: 'a/b' }, 'http://localhost:8000//')).toBe(
      'http://localhost:8000/v1/developer/appointments/a%2Fb'
    );
    expect(buildToolUrl('get_patient', { id: 'pat-1' }, BASE_URL)).toBe(
      'http://localhost:8000/v1/developer/patients/pat-1'
    );
  });

  test('builds singleton URLs', () => {
    expect(buildToolUrl('get_organization', {}, BASE_URL)).toBe(
      'http://localhost:8000/v1/developer/organization'
    );
    expect(buildToolUrl('get_usage', {}, BASE_URL)).toBe(
      'http://localhost:8000/v1/developer/usage'
    );
  });

  test('throws for a missing or blank id', () => {
    expect(() => buildToolUrl('get_appointment', {}, BASE_URL)).toThrow(/requires a non-empty/);
    expect(() => buildToolUrl('get_patient', { id: '   ' }, BASE_URL)).toThrow(
      /requires a non-empty/
    );
    expect(() => buildToolUrl('get_patient', { id: 7 }, BASE_URL)).toThrow(/requires a non-empty/);
  });

  test('throws for tools outside the allowlist', () => {
    expect(() => buildToolUrl('delete_patient', {}, BASE_URL)).toThrow(/not in the playground/);
  });
});

describe('describeDataApiError', () => {
  test('maps 401 to a key check notice', () => {
    const message = describeDataApiError(
      401,
      JSON.stringify({ message: 'Invalid or expired API key', code: 'invalid_api_key' })
    );
    expect(message).toContain('invalid_api_key');
    expect(message).toContain('Yosemite API key');
  });

  test('maps 401 without a body to the default code', () => {
    expect(describeDataApiError(401, 'not-json')).toContain('invalid_api_key');
  });

  test('maps 403 to an insufficient scope notice', () => {
    const message = describeDataApiError(
      403,
      JSON.stringify({ message: 'Insufficient scope', code: 'insufficient_scope' })
    );
    expect(message).toContain('scope');
  });

  test('distinguishes quota exhaustion from burst rate limiting on 429', () => {
    const quota = describeDataApiError(
      429,
      JSON.stringify({ message: 'Monthly API quota exceeded.', code: 'quota_exceeded' })
    );
    const burst = describeDataApiError(
      429,
      JSON.stringify({ message: 'Rate limit exceeded.', code: 'rate_limited' })
    );
    expect(quota).toContain('1000 calls per month');
    expect(burst).toContain('rate limit');
    expect(burst).not.toContain('1000 calls per month');
  });

  test('maps 404 and 400 with fallbacks', () => {
    expect(describeDataApiError(404, '{}')).toContain('not_found');
    expect(describeDataApiError(400, '{}')).toContain('invalid_request');
    expect(
      describeDataApiError(400, JSON.stringify({ message: 'Bad cursor', code: 'invalid_request' }))
    ).toContain('Bad cursor');
  });

  test('falls back to the HTTP status for unexpected codes', () => {
    expect(describeDataApiError(500, JSON.stringify({ message: 'boom' }))).toBe(
      'Yosemite API request failed (HTTP 500): boom'
    );
    expect(describeDataApiError(503, 'oops')).toBe('Yosemite API request failed (HTTP 503).');
  });

  test('ignores non-string envelope fields', () => {
    expect(describeDataApiError(400, JSON.stringify({ message: 42, code: 9 }))).toContain(
      'invalid_request'
    );
  });
});

describe('executePlaygroundTool', () => {
  test('performs a GET with the bearer key and returns the body', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, '{"data":[]}'));

    const result = await executePlaygroundTool('list_appointments', { limit: 2 }, CONFIG);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/v1/developer/appointments?limit=2',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer yc_test_fake_key' },
      }
    );
    expect(result).toEqual({ content: '{"data":[]}', isError: false });
  });

  test('returns an error result for invalid tool calls without fetching', async () => {
    const result = await executePlaygroundTool('get_appointment', {}, CONFIG);
    expect(result.isError).toBe(true);
    expect(result.content).toContain('requires a non-empty');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns an error result for tools outside the allowlist', async () => {
    const result = await executePlaygroundTool('write_patient', {}, CONFIG);
    expect(result.isError).toBe(true);
    expect(result.content).toContain('not in the playground allowlist');
  });

  test('degrades gracefully when the backend is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));

    const result = await executePlaygroundTool('get_usage', {}, CONFIG);

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Could not reach the Yosemite API');
    expect(result.content).toContain('http://localhost:8000');
  });

  test('maps HTTP errors through the error envelope', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        429,
        JSON.stringify({ message: 'Monthly API quota exceeded.', code: 'quota_exceeded' })
      )
    );

    const result = await executePlaygroundTool('get_organization', {}, CONFIG);

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Monthly API quota exceeded');
  });
});
