/*
 * Maps a failed data-plane call to text an agent can act on.
 *
 * The envelope is NOT uniform across the stack and pretending otherwise
 * produces useless messages. The controllers answer `{ message, code }`, but
 * `authorizeApiKey` (401/429) and the RBAC guards (403) answer `{ message }`
 * with no code, because they predate this surface and are shared with the
 * session-authenticated routes. So status is the primary signal and `code` is
 * a refinement when present.
 */
export class YcApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = 'YcApiError';
    this.status = options.status;
    this.code = options.code;
  }
}

interface AxiosErrorLike {
  isAxiosError: true;
  message: string;
  response?: { status: number; data?: unknown };
}

/*
 * Structural check rather than axios.isAxiosError, so error mapping stays
 * testable with plain objects and no axios instance.
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
    const { message, code } = readEnvelope(err.response.data);
    return new YcApiError(message ?? `Request failed with HTTP ${err.response.status}.`, {
      status: err.response.status,
      code,
    });
  }
  return new YcApiError(err instanceof Error ? err.message : String(err));
}

const GUIDANCE: Record<number, string> = {
  401: 'The API key was rejected. Check YC_API_KEY, and that the key has not been revoked or expired in the developer portal.',
  403: 'The key or the account lacks access. A 403 here means either the key is missing the scope this tool needs, or the key owner is not an active member of the organisation with permission to read it.',
  404: 'Not found. The record does not exist, or it belongs to an organisation this key cannot read - the API does not distinguish the two.',
  429: 'Rate limited or out of monthly quota. Wait for the window to reset, or upgrade the developer plan.',
};

/** Human-readable text for an MCP isError result. */
export function describeToolError(err: unknown, requiredScope?: string): string {
  const apiError = toYcApiError(err);
  const parts = [apiError.message];

  const guidance = apiError.status ? GUIDANCE[apiError.status] : undefined;
  if (guidance) {
    parts.push(guidance);
  }
  if (apiError.status === 403 && requiredScope) {
    parts.push(`This tool needs the "${requiredScope}" scope.`);
  }
  return parts.join(' ');
}
