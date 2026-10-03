import {describeRequestError} from '@/shared/utils/safeErrorLog';

const isRequestError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  ('config' in error || 'response' in error);

// Request errors carry their request config, auth header included, so they
// only ever get the log-safe summary. Anything else keeps its name and message,
// and its stack in development builds.
const describeFailure = (error: unknown): string => {
  if (isRequestError(error)) {
    return describeRequestError(error);
  }
  if (error instanceof Error) {
    const summary = `${error.name}: ${error.message}`;
    return __DEV__ && error.stack ? `${summary}\n${error.stack}` : summary;
  }
  return String(error);
};

/**
 * Starts work that an event handler or effect does not wait for. A failure is
 * logged instead of surfacing as an unhandled promise rejection; anything the
 * user has to see is shown by the work itself (its alert or its slice's error
 * state).
 */
export const runInBackground = (task: PromiseLike<unknown>): void => {
  Promise.resolve(task).catch(error => {
    console.warn('[Background] Task failed', describeFailure(error));
  });
};
