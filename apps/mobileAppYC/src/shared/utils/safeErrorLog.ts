/**
 * A log-safe description of a request failure.
 *
 * Axios errors keep the request `config` on them, and this app's API calls
 * attach an `Authorization: Bearer <accessToken>` header. Logging the raw error
 * therefore writes an access token into the device log and into whatever
 * collects it, so nothing but the status, a short message and the request path
 * ever leaves this function.
 */
export const describeRequestError = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) {
    return String(error);
  }

  const candidate = error as {
    message?: unknown;
    response?: {status?: unknown};
    config?: {method?: unknown; url?: unknown};
  };

  const status =
    typeof candidate.response?.status === 'number'
      ? String(candidate.response.status)
      : 'no-status';
  const method =
    typeof candidate.config?.method === 'string'
      ? candidate.config.method.toUpperCase()
      : 'REQUEST';
  // Path only: a query string can carry identifiers we would rather not log.
  const url =
    typeof candidate.config?.url === 'string'
      ? candidate.config.url.split('?')[0]
      : 'unknown-url';
  const message =
    typeof candidate.message === 'string' ? candidate.message : 'unknown error';

  return `${method} ${url} failed (${status}): ${message}`;
};
