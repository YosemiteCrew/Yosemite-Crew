/*
 * The operations the API playground can run, and the pure helpers that turn a
 * form into a request, a request into an exportable example, and a response
 * into something a developer can act on.
 *
 * The list mirrors the API-key data plane (`/v1/developer`) exactly as it is
 * published in `public/static/openapi/openapi.yaml`; a test reads that file and
 * fails if a path or parameter here drifts from it. Nothing outside this list
 * can be called: the playground builds URLs only from these fixed templates
 * against the configured API origin, so it is not a general HTTP client.
 *
 * The API key never passes through anything in this file. Exports use the
 * `YC_API_KEY` environment variable, so a copied snippet or fixture cannot leak
 * the key the developer pasted into the page.
 */

export type ParamLocation = 'path' | 'query' | 'header';
export type ParamKind = 'text' | 'datetime' | 'enum' | 'integer';

export type OperationParam = {
  name: string;
  in: ParamLocation;
  required: boolean;
  label: string;
  description: string;
  kind: ParamKind;
  options?: readonly string[];
  min?: number;
  max?: number;
};

export type PlaygroundOperation = {
  id: string;
  method: 'GET';
  path: string;
  summary: string;
  /** The key scope the route requires, or null when the route is scope-free. */
  scope: string | null;
  /** The practice permission the caller's membership must hold, if any. */
  permission: string | null;
  params: OperationParam[];
};

export const API_KEY_ENV_VAR = 'YC_API_KEY';

const ORG_HEADER: OperationParam = {
  name: 'x-org-id',
  in: 'header',
  required: true,
  label: 'Practice (x-org-id)',
  description: 'One of the practice ids returned by List practices for this key.',
  kind: 'text',
};

export const APPOINTMENT_STATUSES = [
  'REQUESTED',
  'UPCOMING',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export const PLAYGROUND_OPERATIONS: readonly PlaygroundOperation[] = [
  {
    id: 'listOrganizations',
    method: 'GET',
    path: '/v1/developer/organizations',
    summary: 'List practices',
    scope: null,
    permission: null,
    params: [],
  },
  {
    id: 'getUsage',
    method: 'GET',
    path: '/v1/developer/usage',
    summary: 'Read usage and quota',
    scope: null,
    permission: null,
    params: [],
  },
  {
    id: 'listAppointments',
    method: 'GET',
    path: '/v1/developer/appointments',
    summary: 'List appointments',
    scope: 'appointments:read',
    permission: 'appointments:view:any',
    params: [
      ORG_HEADER,
      {
        name: 'from',
        in: 'query',
        required: false,
        label: 'From',
        description: 'ISO 8601 date-time lower bound on the appointment date.',
        kind: 'datetime',
      },
      {
        name: 'to',
        in: 'query',
        required: false,
        label: 'To',
        description: 'ISO 8601 date-time upper bound on the appointment date.',
        kind: 'datetime',
      },
      {
        name: 'status',
        in: 'query',
        required: false,
        label: 'Status',
        description: 'Only appointments in this status.',
        kind: 'enum',
        options: APPOINTMENT_STATUSES,
      },
      {
        name: 'limit',
        in: 'query',
        required: false,
        label: 'Page size',
        description: 'Between 1 and 100. The server defaults to 50.',
        kind: 'integer',
        min: 1,
        max: 100,
      },
      {
        name: 'cursor',
        in: 'query',
        required: false,
        label: 'Cursor',
        description: 'pagination.nextCursor from the previous page.',
        kind: 'text',
      },
    ],
  },
  {
    id: 'getAppointment',
    method: 'GET',
    path: '/v1/developer/appointments/{appointmentId}',
    summary: 'Get one appointment',
    scope: 'appointments:read',
    permission: 'appointments:view:any',
    params: [
      {
        name: 'appointmentId',
        in: 'path',
        required: true,
        label: 'Appointment id',
        description: 'An id from a List appointments result.',
        kind: 'text',
      },
      ORG_HEADER,
    ],
  },
];

export type ParamValues = Record<string, string>;

const isIsoDateTime = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(new Date(value).getTime());

/** Field-level errors keyed by parameter name. Empty when the inputs are valid. */
export const validateParams = (
  operation: PlaygroundOperation,
  values: ParamValues
): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const param of operation.params) {
    const value = (values[param.name] ?? '').trim();
    if (!value) {
      if (param.required) errors[param.name] = `${param.label} is required.`;
      continue;
    }
    if (param.kind === 'datetime' && !isIsoDateTime(value)) {
      errors[param.name] = 'Use an ISO 8601 date-time, for example 2026-01-31T09:00:00Z.';
    } else if (param.kind === 'enum' && !param.options?.includes(value)) {
      errors[param.name] = `Choose one of: ${param.options?.join(', ')}.`;
    } else if (param.kind === 'integer') {
      const n = Number(value);
      const min = param.min ?? Number.MIN_SAFE_INTEGER;
      const max = param.max ?? Number.MAX_SAFE_INTEGER;
      if (!Number.isInteger(n) || n < min || n > max) {
        errors[param.name] = `Use a whole number from ${min} to ${max}.`;
      }
    }
  }
  return errors;
};

export type BuiltRequest = {
  method: 'GET';
  /** Path plus query string, relative to the API origin. */
  path: string;
  /** Headers other than Authorization, which is added only when sending. */
  headers: Record<string, string>;
};

export const buildRequest = (operation: PlaygroundOperation, values: ParamValues): BuiltRequest => {
  let path = operation.path;
  const query = new URLSearchParams();
  const headers: Record<string, string> = {};
  for (const param of operation.params) {
    const value = (values[param.name] ?? '').trim();
    if (param.in === 'path') {
      // Encoded so an id cannot add path segments or a query of its own.
      path = path.replace(`{${param.name}}`, encodeURIComponent(value));
    } else if (!value) {
      continue;
    } else if (param.in === 'query') {
      query.append(param.name, value);
    } else {
      headers[param.name] = value;
    }
  }
  const search = query.toString();
  return { method: operation.method, path: search ? `${path}?${search}` : path, headers };
};

/**
 * The absolute URL for a request, or null when no API origin is configured or
 * the configured one is not http(s). The origin comes from build configuration,
 * never from the form, so a request cannot be pointed at another host.
 */
export const resolveUrl = (baseUrl: string | undefined, path: string): string | null => {
  if (!baseUrl) return null;
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return null;
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;
  let basePath = base.pathname;
  while (basePath.endsWith('/')) basePath = basePath.slice(0, -1);
  const url = new URL(base.origin + basePath + path);
  return url.origin === base.origin ? url.toString() : null;
};

// POSIX single quotes: close, emit an escaped quote, reopen.
const SHELL_QUOTE_ESCAPE = String.raw`'\''`;
const shellQuote = (value: string): string => `'${value.replaceAll("'", SHELL_QUOTE_ESCAPE)}'`;

export const toCurl = (request: BuiltRequest, url: string): string => {
  const lines = [
    `curl --fail-with-body -sS -X ${request.method}`,
    `  -H "Authorization: Bearer $${API_KEY_ENV_VAR}"`,
    ...Object.entries(request.headers).map(([k, v]) => `  -H ${shellQuote([k, v].join(': '))}`),
    `  ${shellQuote(url)}`,
  ];
  return lines.join(' \\\n');
};

export const toTypeScript = (request: BuiltRequest, url: string): string => {
  const headerLines = [
    '    Authorization: `Bearer ${process.env.' + API_KEY_ENV_VAR + '}`,',
    ...Object.entries(request.headers).map(
      ([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`
    ),
  ];
  return [
    `const response = await fetch(${JSON.stringify(url)}, {`,
    `  method: ${JSON.stringify(request.method)},`,
    '  headers: {',
    ...headerLines,
    '  },',
    '});',
    'const body = await response.json();',
    'if (!response.ok) {',
    '  throw new Error(`${response.status}: ${body.message ?? "request failed"}`);',
    '}',
    'console.log(body);',
  ].join('\n');
};

/** A request description safe to save or share: the key is a placeholder. */
export const toRequestFixture = (
  operation: PlaygroundOperation,
  request: BuiltRequest,
  url: string
): string =>
  JSON.stringify(
    {
      operation: operation.id,
      method: request.method,
      url,
      headers: { Authorization: `Bearer <${API_KEY_ENV_VAR}>`, ...request.headers },
    },
    null,
    2
  );

/** What the developer can do about a response, or null when it succeeded. */
export const describeFailure = (status: number, serverMessage: string | null): string | null => {
  const detail = serverMessage ? ` The API said: "${serverMessage}".` : '';
  if (status >= 200 && status < 300) return null;
  switch (status) {
    case 0:
      return 'The request did not reach the API. Check your connection and try again.';
    case 400:
      return `The API rejected the inputs.${detail} Fix the highlighted value and run again.`;
    case 401:
      return `The key was missing, invalid, revoked or expired.${detail} Create a new key on the API keys page and paste it here.`;
    case 403:
      return `The key or your practice membership does not grant this operation.${detail} Check the key's scopes and that you are an active member of the practice.`;
    case 404:
      return `Nothing with that id exists in a practice this key can read.${detail}`;
    case 429:
      return `This key has used its quota for the current period.${detail} Read usage and quota shows the limit.`;
    default:
      return status >= 500
        ? `The API failed to handle the request (${status}).${detail} Try again shortly.`
        : `The API answered ${status}.${detail}`;
  }
};

export const MAX_DISPLAY_CHARS = 100_000;

export type FormattedBody = { text: string; truncated: boolean; totalChars: number };

/**
 * Pretty-prints JSON and caps the displayed size, so a large page cannot freeze
 * the portal. The cap applies to what is rendered, not to what was received.
 */
export const formatBody = (raw: string): FormattedBody => {
  let text = raw;
  if (raw.length <= MAX_DISPLAY_CHARS * 4) {
    try {
      text = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      text = raw;
    }
  }
  return {
    text: text.length > MAX_DISPLAY_CHARS ? text.slice(0, MAX_DISPLAY_CHARS) : text,
    truncated: text.length > MAX_DISPLAY_CHARS,
    totalChars: text.length,
  };
};

/** The next-page cursor from a list response, if there is one. */
export const readNextCursor = (json: unknown): string | null => {
  if (!json || typeof json !== 'object') return null;
  const pagination = (json as { pagination?: { nextCursor?: unknown } }).pagination;
  return typeof pagination?.nextCursor === 'string' && pagination.nextCursor
    ? pagination.nextCursor
    : null;
};

export type PracticeOption = { id: string; name: string };

/** Practice ids from a List practices response, to offer in the x-org-id field. */
export const readPractices = (json: unknown): PracticeOption[] => {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) =>
    item && typeof item.id === 'string'
      ? [{ id: item.id, name: typeof item.name === 'string' ? item.name : item.id }]
      : []
  );
};

/** Headers a gateway may use to identify one request, first match wins. */
export const CORRELATION_HEADERS = ['x-request-id', 'x-correlation-id', 'x-amzn-requestid'];
