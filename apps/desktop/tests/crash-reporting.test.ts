import {
  createCrashReporter,
  wireCrashLogging,
  CRASH_REPORTING_ENV,
} from '../src/lifecycle/crash-reporting';

describe('crash reporting', () => {
  test('starts local crash reporting when no upload URL is configured', () => {
    const started: Array<{ uploadToServer: boolean; submitURL: string }> = [];
    const paths: Array<{ name: string; value: string }> = [];
    const logs: Array<{ event: string }> = [];

    createCrashReporter({
      app: {
        getPath: () => '/tmp/yc',
        setPath: ((name: string, value: string) => paths.push({ name, value })) as never,
        getVersion: () => '0.1.0',
        isPackaged: false,
      } as never,
      crashReporter: {
        start: (options) => started.push(options as never),
      } as never,
      logger: {
        info: (event) => logs.push({ event }),
        warn: jest.fn(),
      } as never,
      env: {},
    });

    expect(paths[0]).toEqual({ name: 'crashDumps', value: '/tmp/yc/crashes' });
    expect(started[0].uploadToServer).toBe(false);
    expect(logs[0].event).toBe('crash_reporter_started');
  });

  test('enables upload when a crash upload URL is provided', () => {
    const started: Array<{ uploadToServer: boolean; submitURL: string }> = [];
    createCrashReporter({
      app: {
        getPath: () => '/tmp/yc',
        setPath: jest.fn(),
        getVersion: () => '0.1.0',
        isPackaged: true,
      } as never,
      crashReporter: {
        start: (options) => started.push(options as never),
      } as never,
      logger: { info: jest.fn(), warn: jest.fn() } as never,
      env: {
        [CRASH_REPORTING_ENV.CRASH_UPLOAD_URL_ENV]: 'https://crash.example.com',
      },
    });

    expect(started[0].uploadToServer).toBe(true);
    expect(started[0].submitURL).toBe('https://crash.example.com');
  });

  test('wires app-level crash logging events', () => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const logs: Array<{ event: string }> = [];
    wireCrashLogging({
      app: {
        on: (event: string, fn: (...args: unknown[]) => void) => {
          handlers[event] = fn;
        },
      } as never,
      logger: {
        info: (event: string) => logs.push({ event }),
        error: (event: string) => logs.push({ event }),
      } as never,
    });

    handlers['render-process-gone'](
      {},
      { getURL: () => 'https://yosemitecrew.com/x' },
      { reason: 'crashed', exitCode: 1 }
    );
    handlers['render-process-gone']({}, null, { reason: 'oom', exitCode: 9 }); // optional-chaining branch
    handlers['child-process-gone']({}, { type: 'GPU', reason: 'crashed' });
    handlers['gpu-info-update']();

    expect(logs.map((entry) => entry.event)).toEqual([
      'render_process_gone',
      'render_process_gone',
      'child_process_gone',
      'gpu_info_update',
    ]);
  });

  test('logs a warning when the crash dump path cannot be set', () => {
    const warns: string[] = [];
    createCrashReporter({
      app: {
        getPath: () => '/tmp/yc',
        setPath: () => {
          throw new Error('readonly');
        },
        getVersion: () => '0.1.0',
        isPackaged: false,
      } as never,
      crashReporter: { start: jest.fn() } as never,
      logger: {
        info: jest.fn(),
        warn: (event: string) => warns.push(event),
      } as never,
      env: {},
    });
    expect(warns).toContain('crash_dump_path_failed');
  });
});
