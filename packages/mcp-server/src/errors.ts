/**
 * Typed surface over the developer data API error envelope:
 *   { "message": string, "code": string }
 * plus the 429 Retry-After semantics defined in
 * docs/plans/developer-portal-data-api.md (sections 5.2 and 5.3).
 */

export const FREE_TIER_MONTHLY_LIMIT = 1000;

export type YcApiErrorCode =
  | 'invalid_request'
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'insufficient_scope'
  | 'not_found'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'internal_error';

export class YcApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    options: { status?: number; code?: string; retryAfterSeconds?: number } = {}
  ) {
    super(message);
    this.name = 'YcApiError';
    this.status = options.status;
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

interface AxiosErrorLike {
  isAxiosError: true;
  message: string;
  response?: {
    status: number;
    data?: unknown;
    headers?: Record<string, unknown>;
  };
}

/**
 * Structural axios error check. Deliberately does not call axios.isAxiosError
 * so error mapping stays testable with plain objects and mocked axios.
 */
export function isAxiosErrorLike(err: unknown): err is AxiosErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { isAxiosError?: unknown }).isAxiosError === true
  );
}

function readEnvelope(data: unknown): { message?: string; code?: string } {
  if (typeof data !== 'object' || data === null) {
    return {};
  }
  const record = data as Record<string, unknown>;
  return {
    message: typeof record.message === 'string' ? record.message : undefined,
    code: typeof record.code === 'string' ? record.code : undefined,
  };
}

function readRetryAfterSeconds(headers: Record<string, unknown> | undefined): number | undefined {
  const raw = headers?.['retry-after'];
  let parsed: number;
  if (typeof raw === 'string') {
    parsed = Number.parseInt(raw, 10);
  } else if (typeof raw === 'number') {
    parsed = raw;
  } else {
    return undefined;
  }
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Normalise any thrown value into a YcApiError carrying status/code/Retry-After. */
export function toYcApiError(err: unknown): YcApiError {
  if (err instanceof YcApiError) {
    return err;
  }
  if (isAxiosErrorLike(err)) {
    if (!err.response) {
      return new YcApiError(
        `Could not reach the Yosemite Crew API: ${err.message}. Check YC_API_BASE_URL and that the backend is running.`
      );
    }
    const { status, data, headers } = err.response;
    const envelope = readEnvelope(data);
    const options: { status: number; code?: string; retryAfterSeconds?: number } = { status };
    if (envelope.code !== undefined) {
      options.code = envelope.code;
    }
    const retryAfterSeconds = readRetryAfterSeconds(headers);
    if (retryAfterSeconds !== undefined) {
      options.retryAfterSeconds = retryAfterSeconds;
    }
    return new YcApiError(envelope.message ?? `Request failed with status ${status}`, options);
  }
  return new YcApiError(err instanceof Error ? err.message : String(err));
}

function describe429(error: YcApiError): string {
  if (error.code === 'quota_exceeded') {
    const resetHint =
      error.retryAfterSeconds !== undefined
        ? `The quota resets in about ${error.retryAfterSeconds} seconds (Retry-After).`
        : 'The quota resets at the start of the next UTC month.';
    return `Monthly API quota exceeded: the free tier includes ${FREE_TIER_MONTHLY_LIMIT} calls per month. ${resetHint} Upgrade to Pro in the developer portal billing page to remove the hard limit, and use the get_usage tool to inspect current usage (it does not consume quota).`;
  }
  const retryIn = error.retryAfterSeconds ?? 1;
  return `Rate limited: too many requests for this API key. Retry in ${retryIn} second(s).`;
}

/**
 * Render an error as actionable text for an MCP tool result.
 * `requiredScope` is the scope the calling tool needs, used for 403 guidance.
 */
export function describeToolError(err: unknown, requiredScope?: string): string {
  const error = toYcApiError(err);
  const { status, code } = error;

  if (status === 400) {
    return `The API rejected the request (${code ?? 'invalid_request'}): ${error.message}. Check the tool arguments; cursor values must come from a previous response's pagination.nextCursor.`;
  }
  if (status === 401) {
    return `Authentication failed (${code ?? 'invalid_api_key'}): ${error.message}. Check that YC_API_KEY is set to a valid API key that has not been revoked or expired. Keys are managed in the Yosemite Crew developer portal (/developers/api-keys).`;
  }
  if (status === 403) {
    const scopeHint = requiredScope ? ` This tool requires the '${requiredScope}' scope.` : '';
    return `Permission denied (${code ?? 'insufficient_scope'}): ${error.message}.${scopeHint} Create or update an API key with the required scopes in the developer portal.`;
  }
  if (status === 404) {
    return `Not found: ${error.message}. The resource does not exist or belongs to a different organisation than this API key.`;
  }
  if (status === 429) {
    return describe429(error);
  }
  if (status === 500) {
    return `The Yosemite Crew API reported an internal error (${code ?? 'internal_error'}): ${error.message}. Try again; if the problem persists, check the backend logs.`;
  }
  if (status !== undefined) {
    return `Yosemite Crew API request failed with status ${status}: ${error.message}`;
  }
  return error.message;
}
