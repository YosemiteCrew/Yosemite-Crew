// --- Global Mock Objects (Defined outside to remain stable across resets) ---
let logger: {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

const mockSession = {
  isValid: jest.fn(() => true),
  getIdToken: jest.fn(() => ({
    decodePayload: jest.fn(() => ({ 'custom:role': 'admin' })),
  })),
};

const mockUserInstance = {
  signUp: jest.fn(),
  confirmRegistration: jest.fn(),
  resendConfirmationCode: jest.fn(),
  authenticateUser: jest.fn(),
  getSession: jest.fn(),
  globalSignOut: jest.fn(),
  forgotPassword: jest.fn(),
  confirmPassword: jest.fn(),
  getUserAttributes: jest.fn(),
};

const mockPoolInstance = {
  signUp: jest.fn(),
  getCurrentUser: jest.fn(),
};

// --- Mocks Setup ---

// Mock orgStore
const mockClearOrgs = jest.fn();
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: {
    getState: jest.fn(() => ({
      clearOrgs: mockClearOrgs,
    })),
  },
}));

// Mock Amazon Cognito with stable references
jest.mock('amazon-cognito-identity-js', () => {
  return {
    CognitoUserPool: jest.fn(() => mockPoolInstance),
    CognitoUser: jest.fn(() => mockUserInstance),
    CognitoUserAttribute: jest.fn().mockImplementation((x) => x),
    AuthenticationDetails: jest.fn(),
    CognitoUserSession: jest.fn(),
  };
});

jest.mock('@/app/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('authStore', () => {
  let useAuthStore: any;

  beforeEach(async () => {
    // 1. Reset Modules to ensure authStore re-initializes
    jest.resetModules();

    // 2. Setup Env
    process.env.NEXT_PUBLIC_COGNITO_USERPOOLID = 'us-east-1_test';
    process.env.NEXT_PUBLIC_COGNITO_CLIENTID = 'test-client-id';

    // 3. Clear Mocks
    jest.clearAllMocks();
    mockClearOrgs.mockClear();

    // 4. Default Implementations (Resetting default behavior for every test)
    mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));
    mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);

    // 5. Load logger after resetModules so we reference the current mock instance
    const loggerModule = await import('@/app/lib/logger');
    logger = loggerModule.logger as typeof logger;

    // 6. Dynamic Import
    const imported = await import('@/app/stores/authStore');
    useAuthStore = imported.useAuthStore;
  });

  describe('signUp', () => {
    it('calls userPool.signUp and resolves on success', async () => {
      const mockResult = { userSub: '123' };
      mockPoolInstance.signUp.mockImplementation((_e: any, _p: any, _a: any, _v: any, cb: any) =>
        cb(null, mockResult)
      );

      const result = await useAuthStore.getState().signUp('test@email.com', 'pass', 'John', 'Doe');

      expect(mockPoolInstance.signUp).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('rejects when signUp fails', async () => {
      const error = new Error('SignUp Failed');
      mockPoolInstance.signUp.mockImplementation((_e: any, _p: any, _a: any, _v: any, cb: any) =>
        cb(error, null)
      );

      await expect(
        useAuthStore.getState().signUp('test@email.com', 'pass', 'John', 'Doe')
      ).rejects.toThrow('SignUp Failed');
    });

    it('rejects with generic error string if error is not Error object', async () => {
      mockPoolInstance.signUp.mockImplementation((_e: any, _p: any, _a: any, _v: any, cb: any) =>
        cb('Network Error', null)
      );

      await expect(
        useAuthStore.getState().signUp('test@email.com', 'pass', 'John', 'Doe')
      ).rejects.toThrow('Network Error');
    });
  });

  describe('confirmSignUp', () => {
    it('calls cognitoUser.confirmRegistration and resolves', async () => {
      mockUserInstance.confirmRegistration.mockImplementation((_c: any, _f: any, cb: any) =>
        cb(null, 'SUCCESS')
      );

      const result = await useAuthStore.getState().confirmSignUp('test@email.com', '123456');

      expect(mockUserInstance.confirmRegistration).toHaveBeenCalled();
      expect(result).toBe('SUCCESS');
    });

    it('rejects on failure', async () => {
      mockUserInstance.confirmRegistration.mockImplementation((_c: any, _f: any, cb: any) =>
        cb(new Error('Bad Code'), null)
      );

      await expect(
        useAuthStore.getState().confirmSignUp('test@email.com', '123456')
      ).rejects.toThrow('Bad Code');
    });
  });

  describe('resendCode', () => {
    it('calls resendConfirmationCode and resolves', async () => {
      mockUserInstance.resendConfirmationCode.mockImplementation((cb: any) => cb(null, 'SENT'));
      const result = await useAuthStore.getState().resendCode('test@email.com');
      expect(mockUserInstance.resendConfirmationCode).toHaveBeenCalled();
      expect(result).toBe('SENT');
    });

    it('rejects on failure', async () => {
      mockUserInstance.resendConfirmationCode.mockImplementation((cb: any) =>
        cb(new Error('Fail'), null)
      );
      await expect(useAuthStore.getState().resendCode('test@email.com')).rejects.toThrow('Fail');
    });
  });

  describe('signIn', () => {
    it('authenticates user successfully and loads attributes', async () => {
      mockUserInstance.authenticateUser.mockImplementation((_authDetails: any, callbacks: any) => {
        callbacks.onSuccess(mockSession);
      });
      const mockAttrs = [{ getName: () => 'email', getValue: () => 'test@test.com' }];
      mockUserInstance.getUserAttributes.mockImplementation((cb: any) => cb(null, mockAttrs));

      await useAuthStore.getState().signIn('test@email.com', 'pass');

      const state = useAuthStore.getState();
      expect(state.status).toBe('signin-authenticated');
      expect(state.attributes).toEqual({ email: 'test@test.com' });
    });

    it('handles loadUserAttributes failure gracefully after signin', async () => {
      const errorSpy = logger.error as jest.Mock;
      mockUserInstance.authenticateUser.mockImplementation((_authDetails: any, callbacks: any) => {
        callbacks.onSuccess(mockSession);
      });
      mockUserInstance.getUserAttributes.mockImplementation((cb: any) =>
        cb(new Error('Attr Fail'), null)
      );

      await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(errorSpy).toHaveBeenCalledWith('Failed to load user attributes', expect.any(Error));
      expect(useAuthStore.getState().status).toBe('signin-authenticated');
    });
  });

  describe('checkSession', () => {
    it('restores session if valid user exists', async () => {
      mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
      mockSession.isValid.mockReturnValue(true);
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.user).not.toBeNull();
    });

    it('sets unauthenticated if no current user', async () => {
      mockPoolInstance.getCurrentUser.mockReturnValue(null);
      await useAuthStore.getState().checkSession();
      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
      expect(state.user).toBeNull();
    });

    it('sets unauthenticated if session is invalid', async () => {
      mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
      const invalidSession = { ...mockSession, isValid: () => false };
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, invalidSession));

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
    });

    it('sets unauthenticated if getSession errors', async () => {
      mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
      mockUserInstance.getSession.mockImplementation((cb: any) =>
        cb(new Error('Session Error'), null)
      );

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
      expect(state.error).toBe('Session Error');
    });
  });

  describe('refreshSession', () => {
    it('refreshes session successfully', async () => {
      mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
      mockSession.isValid.mockReturnValue(true);
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));

      await useAuthStore.getState().refreshSession();

      const state = useAuthStore.getState();
      expect(state.role).toBe('admin');
    });

    it('returns null if no user', async () => {
      mockPoolInstance.getCurrentUser.mockReturnValue(null);
      const res = await useAuthStore.getState().refreshSession();
      expect(res).toBeNull();
    });

    it('returns null on session error', async () => {
      const warnSpy = logger.warn as jest.Mock;
      mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(new Error('Fail'), null));

      const res = await useAuthStore.getState().refreshSession();
      expect(res).toBeNull();
    });
  });

  describe('signout', () => {
    it('signs out successfully', async () => {
      useAuthStore.setState({ user: mockUserInstance, status: 'authenticated' });
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));
      mockUserInstance.globalSignOut.mockImplementation(({ onSuccess }: any) => onSuccess());

      await useAuthStore.getState().signout();

      expect(mockUserInstance.globalSignOut).toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(mockClearOrgs).toHaveBeenCalled();
    });

    it('handles signout failure but still resets state locally', async () => {
      const errorSpy = logger.error as jest.Mock;
      useAuthStore.setState({ user: mockUserInstance, status: 'authenticated' });

      mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));
      mockUserInstance.globalSignOut.mockImplementation(({ onFailure }: any) =>
        onFailure(new Error('Signout API Fail'))
      );

      await useAuthStore.getState().signout();

      expect(errorSpy).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('resolves early if no user in state', async () => {
      useAuthStore.setState({ user: null });
      await useAuthStore.getState().signout();
      expect(mockUserInstance.globalSignOut).not.toHaveBeenCalled();
    });

    it('handles invalid session during signout', async () => {
      const warnSpy = logger.warn as jest.Mock;
      useAuthStore.setState({ user: mockUserInstance });

      const invalidSession = { ...mockSession, isValid: () => false };
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, invalidSession));

      await useAuthStore.getState().signout();

      expect(warnSpy).toHaveBeenCalledWith('Invalid session during signout');
      expect(mockUserInstance.globalSignOut).not.toHaveBeenCalled();
    });

    it('handles session error during signout', async () => {
      const warnSpy = logger.warn as jest.Mock;
      useAuthStore.setState({ user: mockUserInstance });

      mockUserInstance.getSession.mockImplementation((cb: any) =>
        cb(new Error('Session Error'), null)
      );

      await useAuthStore.getState().signout();

      expect(warnSpy).toHaveBeenCalledWith('getSession failed during signout:', expect.any(Error));
    });
  });

  describe('forgotPassword', () => {
    it('resolves on success', async () => {
      const mockData = { CodeDeliveryDetails: {} };
      mockUserInstance.forgotPassword.mockImplementation(({ onSuccess }: any) =>
        onSuccess(mockData)
      );
      const result = await useAuthStore.getState().forgotPassword('test@email.com');
      expect(result).toBe(mockData);
    });

    it('rejects on failure', async () => {
      mockUserInstance.forgotPassword.mockImplementation(({ onFailure }: any) =>
        onFailure(new Error('Fail'))
      );
      await expect(useAuthStore.getState().forgotPassword('test@email.com')).rejects.toThrow(
        'Fail'
      );
    });
  });

  describe('resetPassword', () => {
    it('resolves success string on success', async () => {
      mockUserInstance.confirmPassword.mockImplementation((_c: any, _p: any, { onSuccess }: any) =>
        onSuccess()
      );
      const result = await useAuthStore.getState().resetPassword('email', 'code', 'newPass');
      expect(result).toBe('success');
    });

    it('rejects on failure', async () => {
      mockUserInstance.confirmPassword.mockImplementation((_c: any, _p: any, { onFailure }: any) =>
        onFailure(new Error('Reset Fail'))
      );
      await expect(
        useAuthStore.getState().resetPassword('email', 'code', 'newPass')
      ).rejects.toThrow('Reset Fail');
    });
  });

  describe('loadUserAttributes', () => {
    it('loads and sets attributes', async () => {
      useAuthStore.setState({ user: mockUserInstance });
      const mockAttrs = [{ getName: () => 'email', getValue: () => 'me@test.com' }];
      mockUserInstance.getUserAttributes.mockImplementation((cb: any) => cb(null, mockAttrs));

      const res = await useAuthStore.getState().loadUserAttributes();

      expect(res).toEqual({ email: 'me@test.com' });
      expect(useAuthStore.getState().attributes).toEqual({ email: 'me@test.com' });
    });

    it('returns null if no user', async () => {
      useAuthStore.setState({ user: null });
      const res = await useAuthStore.getState().loadUserAttributes();
      expect(res).toBeNull();
    });

    it('rejects on API error', async () => {
      useAuthStore.setState({ user: mockUserInstance });
      mockUserInstance.getUserAttributes.mockImplementation((cb: any) =>
        cb(new Error('Attr Fail'), null)
      );

      await expect(useAuthStore.getState().loadUserAttributes()).rejects.toThrow('Attr Fail');
    });
  });

  describe('Environment Edge Case', () => {
    it('handles signout when globalThis is undefined (simulated)', async () => {
      // We override the spy behavior ONCE for this specific test
      mockClearOrgs.mockImplementationOnce(() => {
        throw new Error('Store Error');
      });

      const warnSpy = logger.warn as jest.Mock;

      await useAuthStore.getState().signout();

      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to clear org store on signout',
        expect.any(Error)
      );
    });
  });

  describe('getValidSession', () => {
    it('returns current session if fresh and no force refresh', async () => {
      const freshSession = {
        isValid: () => true,
        getIdToken: () => ({
          decodePayload: () => ({ exp: Math.floor(Date.now() / 1000) + 9999 }),
        }),
      };
      useAuthStore.setState({ session: freshSession as any });

      const result = await useAuthStore.getState().getValidSession();
      expect(result).toBe(freshSession);
    });

    it('returns refreshed session if current session is not fresh', async () => {
      // No session set → refresh will be called
      useAuthStore.setState({ session: null });
      mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
      mockSession.isValid.mockReturnValue(true);
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));

      const result = await useAuthStore.getState().getValidSession();
      expect(result).not.toBeNull();
    });

    it('falls through to checkSession when refreshedSession is null', async () => {
      useAuthStore.setState({ session: null });
      // Refresh fails (no current user)
      mockPoolInstance.getCurrentUser.mockReturnValue(null);

      const result = await useAuthStore.getState().getValidSession();
      // Both refresh and checkSession fail → null
      expect(result).toBeNull();
    });

    it('returns null with forceRefresh when refreshedSession is null', async () => {
      useAuthStore.setState({ session: null });
      mockPoolInstance.getCurrentUser.mockReturnValue(null);

      const result = await useAuthStore.getState().getValidSession({ forceRefresh: true });
      expect(result).toBeNull();
    });
  });

  describe('isSessionFresh edge cases', () => {
    it('returns false if session.isValid() is false', async () => {
      const expiredSession = {
        isValid: () => false,
        getIdToken: () => ({ decodePayload: () => ({}) }),
      };
      useAuthStore.setState({ session: expiredSession as any });

      // Getting a valid session should trigger refresh
      mockPoolInstance.getCurrentUser.mockReturnValue(null);
      const result = await useAuthStore.getState().getValidSession();
      expect(result).toBeNull();
    });

    it('handles token decoding error in isSessionFresh', async () => {
      // Session that throws on decodePayload — should fallback to session.isValid()
      const problematicSession = {
        isValid: jest.fn(() => true),
        getIdToken: () => ({
          decodePayload: () => {
            throw new Error('decode error');
          },
        }),
      };
      useAuthStore.setState({ session: problematicSession as any });

      const result = await useAuthStore.getState().getValidSession();
      expect(result).toBe(problematicSession);
    });
  });

  describe('signIn non-Error rejection', () => {
    it('rejects with string error wrapped in Error', async () => {
      mockUserInstance.authenticateUser.mockImplementationOnce((_: any, { onFailure }: any) => {
        onFailure('string error message');
      });

      await expect(useAuthStore.getState().signIn('user@test.com', 'pass')).rejects.toThrow(
        'string error message'
      );
    });
  });

  describe('forgotPassword non-Error rejection', () => {
    it('wraps non-Error in Error on failure', async () => {
      mockUserInstance.forgotPassword.mockImplementation(({ onFailure }: any) =>
        onFailure('string-fail')
      );
      await expect(useAuthStore.getState().forgotPassword('test@email.com')).rejects.toThrow(
        'string-fail'
      );
    });
  });

  describe('resetPassword non-Error rejection', () => {
    it('wraps non-Error in Error on failure', async () => {
      mockUserInstance.confirmPassword.mockImplementation((_c: any, _p: any, { onFailure }: any) =>
        onFailure('string-fail')
      );
      await expect(
        useAuthStore.getState().resetPassword('email', 'code', 'newPass')
      ).rejects.toThrow('string-fail');
    });
  });
});
