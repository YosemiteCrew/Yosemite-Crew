/**
 * Static tool allowlist for the developer Agent Playground.
 *
 * Per ADR 0005 the toolset is a fixed, read-only allowlist compiled into the
 * client. Every tool maps to a GET endpoint on the Developer Data API v1
 * contract (/v1/developer/...). Adding a tool requires a code change reviewed
 * against the ADR - there is no runtime registration surface.
 */

export type PlaygroundToolName =
  | 'list_appointments'
  | 'get_appointment'
  | 'list_patients'
  | 'get_patient'
  | 'list_encounters'
  | 'list_invoices'
  | 'get_organization'
  | 'get_usage';

export type AnthropicToolDefinition = {
  name: PlaygroundToolName;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

const limitParam = {
  type: 'integer',
  description: 'Page size between 1 and 100. Defaults to 50.',
};

const cursorParam = {
  type: 'string',
  description: 'Opaque pagination cursor returned as pagination.nextCursor by a previous call.',
};

const dateFromParam = {
  type: 'string',
  description: 'ISO 8601 timestamp with offset. Only rows on or after this instant are returned.',
};

const dateToParam = {
  type: 'string',
  description: 'ISO 8601 timestamp with offset. Only rows on or before this instant are returned.',
};

export const PLAYGROUND_TOOLS: AnthropicToolDefinition[] = [
  {
    name: 'list_appointments',
    description:
      'List appointments for the organisation, newest appointment date first. Call this when the user asks about bookings, schedules, or visits. Returns a cursor-paginated envelope { data, pagination }.',
    input_schema: {
      type: 'object',
      properties: {
        limit: limitParam,
        cursor: cursorParam,
        status: {
          type: 'string',
          enum: [
            'REQUESTED',
            'UPCOMING',
            'CHECKED_IN',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED',
            'NO_SHOW',
          ],
          description: 'Filter by appointment status.',
        },
        dateFrom: dateFromParam,
        dateTo: dateToParam,
      },
    },
  },
  {
    name: 'get_appointment',
    description:
      'Fetch a single appointment by id, including support staff, attachments, and encounter linkage. Call this after list_appointments when the user asks for detail on one appointment.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The appointment id.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_patients',
    description:
      'List patients (companions) actively linked to the organisation. Call this when the user asks about pets or patients.',
    input_schema: {
      type: 'object',
      properties: {
        limit: limitParam,
        cursor: cursorParam,
        status: {
          type: 'string',
          enum: ['active', 'archived', 'inactive'],
          description: 'Filter by patient record status.',
        },
      },
    },
  },
  {
    name: 'get_patient',
    description:
      'Fetch a single patient by id with extended fields such as species code, weight, and allergies. Use the authoritative patient record instead of appointment snapshots.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The patient id.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_encounters',
    description:
      'List clinical encounters for the organisation, newest first. Call this when the user asks about visits, cases, or clinical history.',
    input_schema: {
      type: 'object',
      properties: {
        limit: limitParam,
        cursor: cursorParam,
        status: { type: 'string', description: 'Filter by encounter status.' },
        patientId: { type: 'string', description: 'Filter to a single patient.' },
        caseId: { type: 'string', description: 'Filter to a single case.' },
        dateFrom: dateFromParam,
        dateTo: dateToParam,
      },
    },
  },
  {
    name: 'list_invoices',
    description:
      'List invoices for the organisation, newest first. Call this when the user asks about billing, payments, or revenue.',
    input_schema: {
      type: 'object',
      properties: {
        limit: limitParam,
        cursor: cursorParam,
        status: {
          type: 'string',
          enum: ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'],
          description: 'Filter by invoice status.',
        },
        patientId: { type: 'string', description: 'Filter to a single patient.' },
        appointmentId: { type: 'string', description: 'Filter to a single appointment.' },
        dateFrom: dateFromParam,
        dateTo: dateToParam,
      },
    },
  },
  {
    name: 'get_organization',
    description:
      'Fetch the organisation profile the API key belongs to, including its address. Call this when the user asks about the clinic or practice itself.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_usage',
    description:
      'Fetch API usage for the current billing period: { billingPeriod, callCount, limit }. Call this when the user asks about quota or remaining calls.',
    input_schema: { type: 'object', properties: {} },
  },
];

type ListRoute = { path: string; params: string[] };

const LIST_ROUTES: Partial<Record<PlaygroundToolName, ListRoute>> = {
  list_appointments: {
    path: '/v1/developer/appointments',
    params: ['limit', 'cursor', 'status', 'dateFrom', 'dateTo'],
  },
  list_patients: {
    path: '/v1/developer/patients',
    params: ['limit', 'cursor', 'status'],
  },
  list_encounters: {
    path: '/v1/developer/encounters',
    params: ['limit', 'cursor', 'status', 'patientId', 'caseId', 'dateFrom', 'dateTo'],
  },
  list_invoices: {
    path: '/v1/developer/invoices',
    params: ['limit', 'cursor', 'status', 'patientId', 'appointmentId', 'dateFrom', 'dateTo'],
  },
};

const GET_BY_ID_ROUTES: Partial<Record<PlaygroundToolName, string>> = {
  get_appointment: '/v1/developer/appointments',
  get_patient: '/v1/developer/patients',
};

const SINGLETON_ROUTES: Partial<Record<PlaygroundToolName, string>> = {
  get_organization: '/v1/developer/organization',
  get_usage: '/v1/developer/usage',
};

const trimBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, '');

const isQueryValue = (value: unknown): value is string | number =>
  typeof value === 'string' || typeof value === 'number';

/**
 * Builds the request URL for an allowlisted tool. Throws when the tool is
 * unknown or a required id is missing so the caller can surface the problem
 * back to the model as a tool_result error.
 */
export const buildToolUrl = (
  name: string,
  input: Record<string, unknown>,
  baseUrl: string
): string => {
  const base = trimBaseUrl(baseUrl);
  const toolName = name as PlaygroundToolName;

  const singleton = SINGLETON_ROUTES[toolName];
  if (singleton) return `${base}${singleton}`;

  const byId = GET_BY_ID_ROUTES[toolName];
  if (byId) {
    const id = input.id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error(`The "${name}" tool requires a non-empty string "id" input.`);
    }
    return `${base}${byId}/${encodeURIComponent(id)}`;
  }

  const listRoute = LIST_ROUTES[toolName];
  if (!listRoute) {
    throw new Error(`Tool "${name}" is not in the playground allowlist.`);
  }

  const query = new URLSearchParams();
  for (const param of listRoute.params) {
    const value = input[param];
    if (isQueryValue(value)) query.set(param, String(value));
  }
  const queryString = query.toString();
  return `${base}${listRoute.path}${queryString ? `?${queryString}` : ''}`;
};

/**
 * Maps the Developer Data API error envelope { message, code } to a plain
 * human-readable notice, distinguishing quota exhaustion from burst rate
 * limiting on 429s.
 */
export const describeDataApiError = (status: number, body: string): string => {
  let message: string | undefined;
  let code: string | undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object') {
      const envelope = parsed as { message?: unknown; code?: unknown };
      if (typeof envelope.message === 'string') message = envelope.message;
      if (typeof envelope.code === 'string') code = envelope.code;
    }
  } catch {
    // Non-JSON body - fall through to status-based messages.
  }

  if (status === 401) {
    return `Authentication failed (${code ?? 'invalid_api_key'}). Check the Yosemite API key in the setup panel - it may be missing, revoked, or expired.`;
  }
  if (status === 403) {
    return `This API key does not have the scope required for that resource (${code ?? 'insufficient_scope'}). Issue a key with the matching read scope.`;
  }
  if (status === 429 && code === 'quota_exceeded') {
    return 'Monthly API quota exceeded. The free tier allows 1000 calls per month - upgrade the plan or wait for the next billing period.';
  }
  if (status === 429) {
    return 'Per-key rate limit hit. Too many requests in a short burst - wait a moment and try again.';
  }
  if (status === 404) {
    return `Not found (${code ?? 'not_found'}). The resource does not exist or belongs to another organisation.`;
  }
  if (status === 400) {
    return `Invalid request (${code ?? 'invalid_request'}): ${message ?? 'check the tool input parameters.'}`;
  }
  return `Yosemite API request failed (HTTP ${status})${message ? `: ${message}` : '.'}`;
};

export type ToolExecutionConfig = {
  baseUrl: string;
  yosemiteKey: string;
};

export type ToolExecutionResult = {
  content: string;
  isError: boolean;
};

/**
 * Executes one allowlisted read-only tool call against the Developer Data API
 * with the developer's own key. Never throws - failures come back as error
 * tool results so the model can explain them to the user.
 */
export const executePlaygroundTool = async (
  name: string,
  input: Record<string, unknown>,
  config: ToolExecutionConfig
): Promise<ToolExecutionResult> => {
  let url: string;
  try {
    url = buildToolUrl(name, input, config.baseUrl);
  } catch (error) {
    return {
      content: error instanceof Error ? error.message : 'Invalid tool call.',
      isError: true,
    };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.yosemiteKey}` },
    });
  } catch {
    return {
      content: `Could not reach the Yosemite API at ${trimBaseUrl(config.baseUrl)}. The /v1/developer endpoints may not be running in this environment yet - check the base URL in the setup panel.`,
      isError: true,
    };
  }

  const body = await response.text();
  if (!response.ok) {
    return { content: describeDataApiError(response.status, body), isError: true };
  }
  return { content: body, isError: false };
};
