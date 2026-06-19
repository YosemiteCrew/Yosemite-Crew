import {
  TELEMETRY_ENV,
  createTelemetryClient,
  createTelemetryEvent,
  isTelemetryEnabled,
  sanitizeTelemetryName,
} from '../src/utils/telemetry';

describe('telemetry helpers', () => {
  test('is opt-in only', () => {
    expect(isTelemetryEnabled({})).toBe(false);
    expect(isTelemetryEnabled({ [TELEMETRY_ENV]: '0' })).toBe(false);
    expect(isTelemetryEnabled({ [TELEMETRY_ENV]: '1' })).toBe(true);
  });

  test('accepts bounded anonymous event names only', () => {
    expect(sanitizeTelemetryName('signin_clicked')).toBe('signin_clicked');
    expect(sanitizeTelemetryName(' ui:ready ')).toBe('ui:ready');
    expect(sanitizeTelemetryName('ankit@example.com')).toBeNull();
    expect(sanitizeTelemetryName('https://example.com/path')).toBeNull();
    expect(sanitizeTelemetryName('')).toBeNull();
  });

  test('creates counters with positive integer counts', () => {
    expect(createTelemetryEvent('usage', 'tray_show', 2)).toEqual({
      type: 'usage',
      name: 'tray_show',
      count: 2,
    });
    expect(createTelemetryEvent('usage', 'tray_show', 0)).toBeNull();
    expect(createTelemetryEvent('usage', 'tray_show', 1.5)).toBeNull();
  });

  test('does not send when telemetry is disabled', () => {
    const sink = { send: jest.fn() };
    const client = createTelemetryClient(sink, {});

    expect(client.enabled).toBe(false);
    expect(client.recordUsage('signin_clicked')).toBe(false);
    expect(sink.send).not.toHaveBeenCalled();
  });

  test('sends usage and error events when enabled', () => {
    const sink = { send: jest.fn() };
    const client = createTelemetryClient(sink, { [TELEMETRY_ENV]: '1' });

    expect(client.enabled).toBe(true);
    expect(client.recordUsage('signin_clicked')).toBe(true);
    expect(client.recordError('offline_page_shown', 3)).toBe(true);
    expect(sink.send).toHaveBeenNthCalledWith(1, {
      type: 'usage',
      name: 'signin_clicked',
      count: 1,
    });
    expect(sink.send).toHaveBeenNthCalledWith(2, {
      type: 'error',
      name: 'offline_page_shown',
      count: 3,
    });
  });

  test('rejects unsafe events and logs the rejection', () => {
    const warn = jest.fn();
    const sink = { send: jest.fn() };
    const client = createTelemetryClient(sink, { [TELEMETRY_ENV]: '1' }, { warn });

    expect(client.recordUsage('ankit@example.com')).toBe(false);
    expect(sink.send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('telemetry_event_rejected', expect.any(Object));
  });

  test('does not throw when the sink fails', () => {
    const warn = jest.fn();
    const sink = {
      send: jest.fn(() => {
        throw new Error('offline');
      }),
    };
    const client = createTelemetryClient(sink, { [TELEMETRY_ENV]: '1' }, { warn });

    expect(client.recordError('startup_failed')).toBe(false);
    expect(warn).toHaveBeenCalledWith('telemetry_send_failed', expect.any(Object));
  });

  test('handles async sink rejection gracefully', async () => {
    const warn = jest.fn();
    const sink = {
      send: jest.fn(() => Promise.reject(new Error('network_error'))),
    };
    const client = createTelemetryClient(sink, { [TELEMETRY_ENV]: '1' }, { warn });

    const result = client.recordUsage('sync_failed');
    expect(result).toBe(true);
    await new Promise(process.nextTick);
    expect(warn).toHaveBeenCalledWith('telemetry_send_failed', expect.any(Object));
  });

  test('rejects count exceeding 10000', () => {
    expect(createTelemetryEvent('usage', 'big_count', 10001)).toBeNull();
  });

  test('rejects count of 0 or negative', () => {
    expect(createTelemetryEvent('usage', 'zero', 0)).toBeNull();
    expect(createTelemetryEvent('usage', 'negative', -1)).toBeNull();
  });
});
