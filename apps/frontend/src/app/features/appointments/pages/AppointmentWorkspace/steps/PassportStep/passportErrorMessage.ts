// The backend answers a rejected passport payload with `{ message: "..." }`
// (e.g. "Invalid request body" from the Zod guard), so the server's own wording
// is what the clinician sees rather than a generic failure line.
const readResponseMessage = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined;
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (!data || typeof data !== 'object') return undefined;
  const { message, error: nestedError } = data as { message?: unknown; error?: unknown };
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof nestedError === 'string' && nestedError.trim()) return nestedError;
  return undefined;
};

export const getPassportErrorMessage = (error: unknown, fallback: string): string => {
  const responseMessage = readResponseMessage(error);
  if (responseMessage) return responseMessage;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};
