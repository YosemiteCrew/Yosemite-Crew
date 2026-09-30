import {runInBackground} from '@/shared/utils/runInBackground';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('runInBackground', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('stays quiet when the task succeeds', async () => {
    runInBackground(Promise.resolve('done'));
    await settle();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs a failed task instead of leaving the rejection unhandled', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    runInBackground(Promise.reject(new Error('network down')));
    await settle();

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Background] Task failed',
      'REQUEST unknown-url failed (no-status): network down',
    );
  });

  it('keeps request credentials out of the log', async () => {
    const requestError = Object.assign(new Error('Unauthorized'), {
      response: {status: 401},
      config: {
        method: 'get',
        url: '/v1/companions?parentId=p-1',
        headers: {Authorization: 'Bearer secret-token'},
      },
    });

    runInBackground(Promise.reject(requestError));
    await settle();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Background] Task failed',
      'GET /v1/companions failed (401): Unauthorized',
    );
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('secret-token');
  });

  it('accepts a thenable that is not a native promise', async () => {
    const thenable: PromiseLike<unknown> = {
      then: (_onFulfilled, onRejected) => {
        onRejected?.(new Error('thenable failed'));
        return Promise.resolve() as any;
      },
    };

    runInBackground(thenable);
    await settle();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Background] Task failed',
      'REQUEST unknown-url failed (no-status): thenable failed',
    );
  });
});
