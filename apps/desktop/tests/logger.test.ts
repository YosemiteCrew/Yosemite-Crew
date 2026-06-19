import { createLogger, loggerTestExports } from '../src/utils/logger';

describe('structured logger', () => {
  test('redacts sensitive fields recursively', () => {
    const sanitized = loggerTestExports.sanitize({
      authToken: 'abc',
      nested: { password: 'pw', value: 'safe' },
    }) as Record<string, unknown>;
    expect(sanitized).toEqual({
      authToken: '[redacted]',
      nested: { password: '[redacted]', value: 'safe' },
    });
  });

  test('normalizes errors, arrays, nulls, long strings, and overly deep objects', () => {
    const sanitized = loggerTestExports.sanitize({
      error: new Error('boom'),
      list: [null, undefined, 7, 'x'.repeat(1005)],
      deep: { a: { b: { c: { d: { e: { f: 'too far' } } } } } },
    }) as {
      error: { name: string; message: string };
      list: unknown[];
      deep: { a: { b: { c: { d: { e: unknown } } } } };
    };

    expect(sanitized.error.name).toBe('Error');
    expect(sanitized.error.message).toBe('boom');
    expect(sanitized.list.slice(0, 3)).toEqual([null, undefined, 7]);
    expect(sanitized.list[3]).toHaveLength(1003);
    expect(sanitized.deep.a.b.c.d.e).toBe('[max-depth]');
  });

  test('writes JSON lines without throwing when a log directory is configured', () => {
    const writes: Array<{ event: string; data: { apiKey: string } }> = [];
    const logger = createLogger({
      logDir: '/virtual/logs',
      now: () => new Date('2026-06-13T00:00:00.000Z'),
      mkdirSync: (() => undefined) as never,
      writeFileSync: ((_file: string, line: string) => writes.push(JSON.parse(line))) as never,
    });

    logger.info('test_event', { apiKey: 'secret', value: 1 });

    expect(writes).toHaveLength(1);
    expect(writes[0].event).toBe('test_event');
    expect(writes[0].data.apiKey).toBe('[redacted]');
  });

  test('logs to stdout with level-specific console writers', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger({
      stdout: true,
      now: () => new Date('2026-06-13T00:00:00.000Z'),
    });

    logger.debug('debug_event');
    logger.info('info_event');
    logger.warn('warn_event');
    logger.error('error_event');

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0][0])).toContain('DEBUG');
    expect(String(warnSpy.mock.calls[0][0])).toContain('WARN');
    expect(String(errorSpy.mock.calls[0][0])).toContain('ERROR');

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('swallows filesystem logging failures', () => {
    const logger = createLogger({
      logDir: '/virtual/logs',
      mkdirSync: (() => {
        throw new Error('readonly');
      }) as never,
    });

    expect(() => logger.info('fs_error')).not.toThrow();
  });
});
