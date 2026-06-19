import {
  createTelemetryHttpPayload,
  createTelemetryHttpSink,
  telemetryBackoffMs,
} from '../src/utils/telemetry-sink';

const event = { type: 'usage' as const, name: 'signin_clicked', count: 1 };

describe('telemetry http sink', () => {
  test('builds a timestamped payload without mutating input events', () => {
    const events = [event];
    const payload = createTelemetryHttpPayload(events, () => new Date('2026-01-01T00:00:00.000Z'));

    expect(payload).toEqual({
      events: [event],
      sentAt: '2026-01-01T00:00:00.000Z',
    });
    expect(payload.events).not.toBe(events);
  });

  test('uses default now when not provided', () => {
    const events = [event];
    const payload = createTelemetryHttpPayload(events);
    expect(payload.sentAt).toBeDefined();
    expect(typeof payload.sentAt).toBe('string');
  });

  test('calculates capped exponential backoff', () => {
    expect(telemetryBackoffMs(0)).toBe(0);
    expect(telemetryBackoffMs(1, 100, 1_000)).toBe(100);
    expect(telemetryBackoffMs(4, 100, 1_000)).toBe(800);
    expect(telemetryBackoffMs(8, 100, 1_000)).toBe(1_000);
  });

  test('uploads queued events in batches', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve({ ok: true, status: 200 } as Response));
    const sink = createTelemetryHttpSink({
      endpoint: 'https://telemetry.example.test/events',
      fetchImpl,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      maxBatchSize: 1,
    });

    sink.send(event);
    sink.send({ type: 'error', name: 'offline_page', count: 2 });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sink.pendingCount()).toBe(0);
  });

  test('keeps events queued and backs off when upload fails', async () => {
    const warn = jest.fn();
    const fetchImpl = jest.fn(() => Promise.resolve({ ok: false, status: 503 } as Response));
    // Freeze `now` so the remaining-delay calculation is deterministic: no time
    // has elapsed since the failure, so the full window is reported.
    const sink = createTelemetryHttpSink({
      endpoint: 'https://telemetry.example.test/events',
      fetchImpl,
      logger: { warn },
      baseBackoffMs: 250,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    sink.send(event);
    await Promise.resolve();
    await Promise.resolve();

    expect(sink.pendingCount()).toBe(1);
    expect(sink.nextDelayMs()).toBe(250);
    expect(warn).toHaveBeenCalledWith('telemetry_http_upload_failed', expect.any(Object));
    expect(await sink.flush()).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('resumes flushing once the backoff window elapses', async () => {
    let clock = new Date('2026-01-01T00:00:00.000Z').getTime();
    const fetchImpl = jest
      .fn()
      // First attempt fails, arming the backoff window.
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      // Second attempt (after the window passes) succeeds.
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const sink = createTelemetryHttpSink({
      endpoint: 'https://telemetry.example.test/events',
      fetchImpl,
      baseBackoffMs: 250,
      now: () => new Date(clock),
    });

    sink.send(event);
    await Promise.resolve();
    await Promise.resolve();

    // Backoff is active immediately after the failure: flush is short-circuited.
    expect(sink.pendingCount()).toBe(1);
    expect(sink.nextDelayMs()).toBe(250);
    expect(await sink.flush()).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Advance past the backoff window — the queue must flush again.
    clock += 300;
    expect(sink.nextDelayMs()).toBe(0);
    expect(await sink.flush()).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sink.pendingCount()).toBe(0);
  });

  test('flush returns true when upload succeeds', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve({ ok: true, status: 200 } as Response));
    const sink = createTelemetryHttpSink({
      endpoint: 'https://telemetry.example.test/events',
      fetchImpl,
      maxBatchSize: 10,
      now: () => new Date('2026-06-01T00:00:00.000Z'),
    });

    sink.send(event);
    await Promise.resolve();
    await Promise.resolve();

    expect(await sink.flush()).toBe(true);
    expect(sink.pendingCount()).toBe(0);
  });

  test('flush returns true when queue empty', async () => {
    const fetchImpl = jest.fn();
    const sink = createTelemetryHttpSink({
      endpoint: 'https://telemetry.example.test/events',
      fetchImpl,
    });

    expect(await sink.flush()).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
