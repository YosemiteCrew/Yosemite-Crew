import {describeRequestError} from '@/shared/utils/safeErrorLog';

/**
 * Starts work that an event handler or effect does not wait for. A failure is
 * logged in log-safe form instead of surfacing as an unhandled promise
 * rejection; anything the user has to see is shown by the work itself (its
 * alert or its slice's error state).
 */
export const runInBackground = (task: PromiseLike<unknown>): void => {
  Promise.resolve(task).catch(error => {
    console.warn('[Background] Task failed', describeRequestError(error));
  });
};
