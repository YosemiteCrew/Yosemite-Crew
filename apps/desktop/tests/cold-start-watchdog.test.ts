'use strict';

import { shouldRetryColdStart, createColdStartWatchdog } from '../src/core/cold-start-watchdog';

describe('shouldRetryColdStart', () => {
  test('returns true for about:blank when not retried', () => {
    expect(shouldRetryColdStart('about:blank', false)).toBe(true);
  });

  test('returns true for empty string when not retried', () => {
    expect(shouldRetryColdStart('', false)).toBe(true);
  });

  test('returns false for a real URL', () => {
    expect(shouldRetryColdStart('https://yosemitecrew.com', false)).toBe(false);
  });

  test('returns false when already retried', () => {
    expect(shouldRetryColdStart('about:blank', true)).toBe(false);
  });

  test('returns false when already retried even with empty url', () => {
    expect(shouldRetryColdStart('', true)).toBe(false);
  });
});

describe('createColdStartWatchdog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('triggers retry when url is about:blank after timeout', () => {
    const onRetry = jest.fn();
    const logger = { info: jest.fn() };
    const getUrl = jest.fn(() => 'about:blank');

    const wd = createColdStartWatchdog({
      getUrl,
      onRetry,
      logger,
      timeoutMs: 6000,
    });
    wd.start();
    expect(onRetry).not.toHaveBeenCalled();

    jest.advanceTimersByTime(6000);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('cold_start_recovered', {
      url: 'about:blank',
    });
  });

  test('does not trigger retry when url is valid', () => {
    const onRetry = jest.fn();
    const getUrl = jest.fn(() => 'https://yosemitecrew.com');

    const wd = createColdStartWatchdog({ getUrl, onRetry, timeoutMs: 6000 });
    wd.start();
    jest.advanceTimersByTime(6000);
    expect(onRetry).not.toHaveBeenCalled();
  });

  test('only retries once even if url remains blank', () => {
    const onRetry = jest.fn();
    const getUrl = jest.fn(() => 'about:blank');

    const wd = createColdStartWatchdog({ getUrl, onRetry, timeoutMs: 6000 });
    wd.start();
    jest.advanceTimersByTime(6000);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Advance again — should NOT call onRetry again
    jest.advanceTimersByTime(6000);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('cancel prevents retry', () => {
    const onRetry = jest.fn();
    const getUrl = jest.fn(() => 'about:blank');

    const wd = createColdStartWatchdog({ getUrl, onRetry, timeoutMs: 6000 });
    wd.start();
    wd.cancel();
    jest.advanceTimersByTime(6000);
    expect(onRetry).not.toHaveBeenCalled();
  });

  test('start is idempotent', () => {
    const onRetry = jest.fn();
    const getUrl = jest.fn(() => 'about:blank');

    const wd = createColdStartWatchdog({ getUrl, onRetry, timeoutMs: 6000 });
    wd.start();
    wd.start();
    jest.advanceTimersByTime(6000);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('cancel is idempotent', () => {
    const onRetry = jest.fn();
    const getUrl = jest.fn(() => 'about:blank');

    const wd = createColdStartWatchdog({ getUrl, onRetry, timeoutMs: 6000 });
    wd.cancel();
    wd.cancel();
    jest.advanceTimersByTime(6000);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
