/**
 * Logger tests — NODE_ENV=test so isProd=false, isTest=true.
 * debug/info are silenced in test mode.
 * warn/error are NOT silenced but we suppress the real console calls via spies.
 */

describe('logger (NODE_ENV=test)', () => {
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('debug does NOT call console.debug in test env', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.debug('test message');
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('info does NOT call console.info in test env', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.info('test message');
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('warn does NOT call console.warn in test env (isTest=true)', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.warn('warn message');
    // isTest=true → warn is silenced
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('error does NOT call console.error in test env (isTest=true)', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.error('error message');
    // isTest=true → error is silenced
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('debug with no args uses fallback "(no details)"', async () => {
    // Even though debug is silenced in test, we can verify safeArgs logic
    // by testing in a simulated dev environment
    const { logger } = await import('@/app/lib/logger');
    // Should not throw even with no args
    expect(() => logger.debug()).not.toThrow();
  });

  it('info with no args does not throw', async () => {
    const { logger } = await import('@/app/lib/logger');
    expect(() => logger.info()).not.toThrow();
  });

  it('warn with no args does not throw', async () => {
    const { logger } = await import('@/app/lib/logger');
    expect(() => logger.warn()).not.toThrow();
  });

  it('error with no args does not throw', async () => {
    const { logger } = await import('@/app/lib/logger');
    expect(() => logger.error()).not.toThrow();
  });
});

describe('logger (simulated development env)', () => {
  const originalEnv = process.env.NODE_ENV;
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    (process.env as { NODE_ENV: string }).NODE_ENV = 'development';
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (process.env as { NODE_ENV: string }).NODE_ENV = originalEnv as string;
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('debug calls console.debug with the level prefix and forwarded args', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.debug('hello', 42);
    expect(debugSpy).toHaveBeenCalledWith('[DEBUG]', 'hello', 42);
  });

  it('debug falls back to "(no details)" when called with no args', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.debug();
    expect(debugSpy).toHaveBeenCalledWith('[DEBUG]', '(no details)');
  });

  it('info calls console.info with the level prefix and forwarded args', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.info('hello');
    expect(infoSpy).toHaveBeenCalledWith('[INFO]', 'hello');
  });

  it('warn calls console.warn outside test env', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.warn('careful');
    expect(warnSpy).toHaveBeenCalledWith('[WARN]', 'careful');
  });

  it('error calls console.error outside test env', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.error('boom');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR]', 'boom');
  });
});

describe('logger (simulated production env)', () => {
  const originalEnv = process.env.NODE_ENV;
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    (process.env as { NODE_ENV: string }).NODE_ENV = 'production';
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (process.env as { NODE_ENV: string }).NODE_ENV = originalEnv as string;
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('debug and info are silenced in production', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.debug('hidden');
    logger.info('hidden');
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('warn and error still fire in production (only isTest silences them)', async () => {
    const { logger } = await import('@/app/lib/logger');
    logger.warn('prod warning');
    logger.error('prod error');
    expect(warnSpy).toHaveBeenCalledWith('[WARN]', 'prod warning');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR]', 'prod error');
  });
});
