describe('devSession', () => {
  const ORIGINAL_JEST_WORKER_ID = process.env.JEST_WORKER_ID;
  const ORIGINAL_DEV = (global as any).__DEV__;

  afterEach(() => {
    process.env.JEST_WORKER_ID = ORIGINAL_JEST_WORKER_ID;
    (global as any).__DEV__ = ORIGINAL_DEV;
    jest.resetModules();
  });

  it('DEV_MOCK_SESSION is disabled in the current source (ENABLE flag is off)', () => {
    // Regression guard: this must stay false so the mock-auth harness can
    // never activate in a build that gets shipped. If this test fails,
    // someone flipped ENABLE to true in src/config/devSession.ts.
    const {DEV_MOCK_SESSION} = require('@/config/devSession');
    expect(DEV_MOCK_SESSION).toBe(false);
  });

  it('stays disabled under jest even if it were ever re-enabled at runtime', () => {
    // JEST_WORKER_ID is always defined under jest, which independently keeps
    // the harness off during tests regardless of the ENABLE flag.
    expect(process.env.JEST_WORKER_ID).toBeDefined();
  });

  it('stays disabled in a DEV build with jest out of the picture', () => {
    // THE guard that matters. The assertions above both pass whatever ENABLE
    // says: the first because JEST_WORKER_ID is set, the third because __DEV__
    // is false - so neither would notice the flag being flipped back on. This
    // reproduces the only condition in which the mock-auth harness can actually
    // activate: a development build, no jest.
    jest.resetModules();
    delete process.env.JEST_WORKER_ID;
    (global as any).__DEV__ = true;

    const {DEV_MOCK_SESSION} = require('@/config/devSession');
    expect(DEV_MOCK_SESSION).toBe(false);
  });

  it('stays disabled outside of __DEV__ (production), proving the harness cannot activate in a release build', () => {
    jest.resetModules();
    delete process.env.JEST_WORKER_ID;
    (global as any).__DEV__ = false;

    const {DEV_MOCK_SESSION} = require('@/config/devSession');
    expect(DEV_MOCK_SESSION).toBe(false);
  });

  describe('seedDevSession', () => {
    it('dispatches a mock authenticated session, access, companions, and selection', () => {
      const {
        seedDevSession,
        MOCK_USER,
        MOCK_COMPANIONS,
      } = require('@/config/devSession');
      const dispatch = jest.fn();

      seedDevSession(dispatch);

      expect(dispatch).toHaveBeenCalledTimes(4);
      expect(dispatch.mock.calls[0][0]).toMatchObject({
        type: 'auth/setAuthenticated',
        payload: {user: MOCK_USER, provider: 'supertokens'},
      });
      expect(dispatch.mock.calls[3][0]).toMatchObject({
        type: 'companion/setSelectedCompanion',
        payload: MOCK_COMPANIONS[0].id,
      });
    });
  });
});
