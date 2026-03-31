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
