/**
 * Extracts a human-readable message from a catalog API error.
 *
 * The catalog backend returns errors as either:
 * - a nested conflict/dependency object: `{ error: { code, message, details } }`
 * - a simple body: `{ message }`
 *
 * Prefer the nested `error.message` (it carries dependency/cycle context), then the
 * top-level `message`, then a provided fallback.
 */
type CatalogErrorBody = {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
  message?: string;
};

const getResponseData = (error: unknown): CatalogErrorBody | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;
  return typeof data === 'object' && data !== null ? data : undefined;
};

export const getCatalogErrorCode = (error: unknown): string | undefined =>
  getResponseData(error)?.error?.code;

export const getCatalogErrorMessage = (error: unknown, fallback: string): string => {
  const data = getResponseData(error);
  const message = data?.error?.message ?? data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
};

/**
 * Builds a short dependency summary (e.g. "1 package, 2 appointments") from a
 * dependency-conflict error's `details`, when present.
 */
export const getCatalogDependencySummary = (error: unknown): string | undefined => {
  const details = getResponseData(error)?.error?.details;
  if (!details) return undefined;
  const labels: Record<string, [string, string]> = {
    packageDependencies: ['package', 'packages'],
    activeServices: ['active service', 'active services'],
    archivedServices: ['archived service', 'archived services'],
    activePackages: ['active package', 'active packages'],
    appointments: ['appointment', 'appointments'],
    invoices: ['invoice', 'invoices'],
  };
  const parts = Object.entries(details)
    .filter(([key, value]) => typeof value === 'number' && value > 0 && labels[key])
    .map(([key, value]) => {
      const count = value as number;
      const [singular, plural] = labels[key];
      return `${count} ${count === 1 ? singular : plural}`;
    });
  return parts.length ? parts.join(', ') : undefined;
};
