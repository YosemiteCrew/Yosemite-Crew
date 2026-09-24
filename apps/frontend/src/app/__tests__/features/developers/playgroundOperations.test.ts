import { readFileSync } from 'fs';
import { join } from 'path';
import {
  APPOINTMENT_STATUSES,
  MAX_DISPLAY_CHARS,
  PLAYGROUND_OPERATIONS,
  buildRequest,
  describeFailure,
  formatBody,
  readNextCursor,
  readPractices,
  resolveUrl,
  toCurl,
  toRequestFixture,
  toTypeScript,
  validateParams,
  type PlaygroundOperation,
} from '@/app/features/developers/pages/DeveloperPlayground/playgroundOperations';

const op = (id: string): PlaygroundOperation => {
  const found = PLAYGROUND_OPERATIONS.find((o) => o.id === id);
  if (!found) throw new Error(`no operation ${id}`);
  return found;
};

const SPEC = readFileSync(join(process.cwd(), 'public/static/openapi/openapi.yaml'), 'utf8');

/** The YAML block for one path key, up to the next top-level path key. */
const pathBlock = (path: string): string => {
  const start = SPEC.indexOf(`\n  '${path}':\n`);
  if (start < 0) return '';
  const rest = SPEC.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}['/]/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};

const specParams = (block: string): string[] =>
  [...block.matchAll(/- name: ([\w-]+)\n\s+in: (\w+)/g)].map((m) => `${m[1]}:${m[2]}`).sort();

describe('playground operations match the published OpenAPI contract', () => {
  it('lists every /v1/developer path in the spec and nothing else', () => {
    const specPaths = [...SPEC.matchAll(/^ {2}'(\/v1\/developer\/[^']*)':$/gm)].map((m) => m[1]);
    expect(specPaths.length).toBeGreaterThan(0);
    expect(PLAYGROUND_OPERATIONS.map((o) => o.path).sort()).toEqual([...specPaths].sort());
  });

  it.each(PLAYGROUND_OPERATIONS.map((o) => [o.id, o] as const))(
    '%s has exactly the parameters the spec declares',
    (_id, operation) => {
      const block = pathBlock(operation.path);
      expect(block).toContain(`operationId: `);
      expect(operation.params.map((p) => `${p.name}:${p.in}`).sort()).toEqual(specParams(block));
      for (const param of operation.params) {
        const declared = new RegExp(
          String.raw`- name: ${param.name}\n\s+in: ${param.in}\n\s+required: ${param.required}`
        );
        expect(block).toMatch(declared);
      }
    }
  );

  it('offers the status values the spec enumerates', () => {
    const enumLine = /enum: \[([^\]]+)\]/.exec(pathBlock('/v1/developer/appointments'));
    expect(enumLine?.[1].split(', ')).toEqual([...APPOINTMENT_STATUSES]);
  });
});

describe('validateParams', () => {
  const list = op('listAppointments');

  it('requires the practice header', () => {
    expect(validateParams(list, {})).toEqual({ 'x-org-id': 'Practice (x-org-id) is required.' });
    expect(validateParams(list, { 'x-org-id': '   ' })).toHaveProperty('x-org-id');
    expect(validateParams(list, { 'x-org-id': 'org-1' })).toEqual({});
  });

  it('rejects dates that are not ISO date-times', () => {
    const base = { 'x-org-id': 'org-1' };
    expect(validateParams(list, { ...base, from: '31/01/2026' })).toHaveProperty('from');
    expect(validateParams(list, { ...base, to: '2026-13-45T99:00:00Z' })).toHaveProperty('to');
    expect(validateParams(list, { ...base, from: '2026-01-31T09:00:00Z' })).toEqual({});
  });

  it('rejects an unknown status', () => {
    expect(validateParams(list, { 'x-org-id': 'o', status: 'upcoming' })).toHaveProperty('status');
    expect(validateParams(list, { 'x-org-id': 'o', status: 'UPCOMING' })).toEqual({});
  });

  it.each(['0', '101', '1.5', 'ten'])('rejects page size %s', (limit) => {
    expect(validateParams(list, { 'x-org-id': 'o', limit })).toEqual({
      limit: 'Use a whole number from 1 to 100.',
    });
  });

  it.each(['1', '100'])('accepts page size %s', (limit) => {
    expect(validateParams(list, { 'x-org-id': 'o', limit })).toEqual({});
  });

  it('requires nothing for scope-free operations', () => {
    expect(validateParams(op('listOrganizations'), {})).toEqual({});
  });
});

describe('buildRequest', () => {
  it('encodes the path id so it cannot add segments or a query', () => {
    const built = buildRequest(op('getAppointment'), {
      appointmentId: '../usage?x=1',
      'x-org-id': 'org-1',
    });
    expect(built.path).toBe('/v1/developer/appointments/..%2Fusage%3Fx%3D1');
    expect(built.headers).toEqual({ 'x-org-id': 'org-1' });
  });

  it('sends only the filled query parameters, trimmed', () => {
    const built = buildRequest(op('listAppointments'), {
      'x-org-id': ' org-1 ',
      status: 'UPCOMING',
      limit: '',
      cursor: 'a b',
    });
    expect(built.path).toBe('/v1/developer/appointments?status=UPCOMING&cursor=a+b');
    expect(built.headers).toEqual({ 'x-org-id': 'org-1' });
  });

  it('never carries an Authorization header', () => {
    const built = buildRequest(op('listOrganizations'), { Authorization: 'Bearer leak' });
    expect(built).toEqual({ method: 'GET', path: '/v1/developer/organizations', headers: {} });
  });
});

describe('resolveUrl', () => {
  it('joins the configured origin and the path', () => {
    expect(resolveUrl('https://api.example.test/', '/v1/developer/usage')).toBe(
      'https://api.example.test/v1/developer/usage'
    );
    expect(resolveUrl('https://api.example.test/base', '/v1/developer/usage')).toBe(
      'https://api.example.test/base/v1/developer/usage'
    );
  });

  it.each([undefined, '', 'not a url', 'javascript:alert(1)', 'ftp://api.example.test'])(
    'refuses base %p',
    (base) => {
      expect(resolveUrl(base, '/v1/developer/usage')).toBeNull();
    }
  );

  it('cannot be moved to another host by the path', () => {
    expect(resolveUrl('https://api.example.test', '@evil.example.test/x')).toBeNull();
  });
});

describe('exports', () => {
  const list = op('listAppointments');
  const built = buildRequest(list, { 'x-org-id': "o'1", status: 'UPCOMING' });
  const url = 'https://api.example.test/v1/developer/appointments?status=UPCOMING';

  it('curl reads the key from the environment and shell-quotes inputs', () => {
    const curl = toCurl(built, url);
    expect(curl).toContain('-H "Authorization: Bearer $YC_API_KEY"');
    expect(curl).toContain(String.raw`-H 'x-org-id: o'\''1'`);
    expect(curl).toContain(`'${url}'`);
  });

  it('TypeScript reads the key from process.env and escapes inputs as literals', () => {
    const ts = toTypeScript(built, url);
    expect(ts).toContain('Authorization: `Bearer ${process.env.YC_API_KEY}`');
    expect(ts).toContain(`"x-org-id": "o'1"`);
    expect(ts).toContain(`fetch(${JSON.stringify(url)}`);
  });

  it('the fixture holds a placeholder, not a key', () => {
    const fixture = JSON.parse(toRequestFixture(list, built, url));
    expect(fixture).toEqual({
      operation: 'listAppointments',
      method: 'GET',
      url,
      headers: { Authorization: 'Bearer <YC_API_KEY>', 'x-org-id': "o'1" },
    });
  });
});

describe('describeFailure', () => {
  it('is null for success', () => {
    expect(describeFailure(200, null)).toBeNull();
  });

  it.each([
    [0, /did not reach the API/],
    [400, /rejected the inputs\. The API said: "bad"/],
    [401, /invalid, revoked or expired.*API keys page/],
    [403, /does not grant this operation/],
    [404, /Nothing with that id/],
    [429, /used its quota/],
    [503, /failed to handle the request \(503\)/],
    [418, /The API answered 418\./],
  ])('explains status %s', (status, pattern) => {
    expect(describeFailure(status, 'bad')).toMatch(pattern);
  });
});

describe('formatBody', () => {
  it('pretty-prints JSON', () => {
    expect(formatBody('{"a":1}')).toEqual({
      text: '{\n  "a": 1\n}',
      truncated: false,
      totalChars: 12,
    });
  });

  it('shows text that is not JSON as-is', () => {
    expect(formatBody('<html>')).toEqual({ text: '<html>', truncated: false, totalChars: 6 });
  });

  it('caps what is rendered', () => {
    const big = 'x'.repeat(MAX_DISPLAY_CHARS + 5);
    const out = formatBody(big);
    expect(out.text).toHaveLength(MAX_DISPLAY_CHARS);
    expect(out).toMatchObject({ truncated: true, totalChars: MAX_DISPLAY_CHARS + 5 });
  });

  it('does not parse a body too large to pretty-print cheaply', () => {
    const huge = JSON.stringify({ a: 'y'.repeat(MAX_DISPLAY_CHARS * 4) });
    expect(formatBody(huge).text.startsWith('{"a":"yyy')).toBe(true);
  });
});

describe('response readers', () => {
  it('reads the next cursor only when there is one', () => {
    expect(readNextCursor({ pagination: { nextCursor: 'c1' } })).toBe('c1');
    expect(readNextCursor({ pagination: { nextCursor: null } })).toBeNull();
    expect(readNextCursor({ pagination: { nextCursor: '' } })).toBeNull();
    expect(readNextCursor(null)).toBeNull();
    expect(readNextCursor('text')).toBeNull();
  });

  it('reads practice options and skips malformed rows', () => {
    expect(
      readPractices({
        data: [{ id: 'o1', name: 'Synthetic Vets' }, { id: 'o2' }, { name: 'x' }, null],
      })
    ).toEqual([
      { id: 'o1', name: 'Synthetic Vets' },
      { id: 'o2', name: 'o2' },
    ]);
    expect(readPractices({ data: 'nope' })).toEqual([]);
    expect(readPractices(null)).toEqual([]);
  });
});
