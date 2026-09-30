import {runInBackground} from '@/shared/utils/runInBackground';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('runInBackground', () => {
  let warnSpy: jest.SpyInstance;
  const originalDev = (global as any).__DEV__;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    (global as any).__DEV__ = originalDev;
    warnSpy.mockRestore();
  });

  it('stays quiet when the task succeeds', async () => {
    runInBackground(Promise.resolve('done'));
    await settle();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs a failed task with its name, message and stack in development', async () => {
    (global as any).__DEV__ = true;
    const failure = new TypeError('cannot read id');

    runInBackground(Promise.reject(failure));
    await settle();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [tag, detail] = warnSpy.mock.calls[0];
    expect(tag).toBe('[Background] Task failed');
    expect(detail).toBe(`TypeError: cannot read id\n${failure.stack}`);
  });

  it('logs only the name and message outside development', async () => {
    (global as any).__DEV__ = false;

    runInBackground(Promise.reject(new TypeError('cannot read id')));
    await settle();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Background] Task failed',
      'TypeError: cannot read id',
    );
  });

  it('logs a rejection that is not an Error as text', async () => {
    const rejectsWithText: PromiseLike<unknown> = {
      then: (_onFulfilled, onRejected) => {
        onRejected?.('timeout');
        return Promise.resolve() as any;
      },
    };

    runInBackground(rejectsWithText);
    await settle();

    expect(warnSpy).toHaveBeenCalledWith('[Background] Task failed', 'timeout');
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

  it('treats an error with only a response as a request error', async () => {
    runInBackground(
      Promise.reject(
        Object.assign(new Error('Server Error'), {response: {status: 500}}),
      ),
    );
    await settle();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Background] Task failed',
      'REQUEST unknown-url failed (500): Server Error',
    );
  });

  it('accepts a thenable that is not a native promise', async () => {
    (global as any).__DEV__ = false;
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
      'Error: thenable failed',
    );
  });
});
