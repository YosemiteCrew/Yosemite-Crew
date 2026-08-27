jest.mock('uuid', () => ({v4: jest.fn(() => 'nonce-123')}));

const mockSuperTokens = {
  init: jest.fn(),
  signOut: jest.fn(),
  doesSessionExist: jest.fn(),
  getAccessToken: jest.fn(),
  getUserId: jest.fn(),
  attemptRefreshingSession: jest.fn(),
  addAxiosInterceptors: jest.fn(),
};

jest.mock('supertokens-react-native', () => ({
  __esModule: true,
  default: mockSuperTokens,
}));

const mockGoogle = {
  hasPlayServices: jest.fn().mockResolvedValue(true),
  signIn: jest.fn().mockResolvedValue({
    type: 'success',
    data: {
      user: {
        email: 'test@example.com',
        givenName: 'Ada',
        familyName: 'Lovelace',
        photo: 'https://example.com/avatar.png',
      },
    },
  }),
  getTokens: jest.fn().mockResolvedValue({
    idToken: 'google-id-token',
    accessToken: 'google-access-token',
  }),
  signOut: jest.fn().mockResolvedValue(undefined),
  configure: jest.fn(),
};

const mockAppleAuth = {
  performRequest: jest.fn(),
  Operation: {LOGIN: 'LOGIN'},
  Scope: {EMAIL: 'EMAIL', FULL_NAME: 'FULL_NAME'},
  Error: {
    CANCELED: 'CANCELED',
    FAILED: 'FAILED',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    NOT_HANDLED: 'NOT_HANDLED',
  },
};

const mockAppleAuthAndroid = {
  isSupported: true,
  configure: jest.fn(),
  signIn: jest.fn().mockResolvedValue({
    id_token: 'apple-android-id-token',
    user: {
      name: {firstName: 'Ada', lastName: 'Lovelace'},
      email: 'ada@example.com',
    },
  }),
  ResponseType: {ALL: 'ALL'},
  Scope: {ALL: 'ALL'},
};

jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: mockAppleAuth,
  appleAuthAndroid: mockAppleAuthAndroid,
}));

const mockFbSettings = {
  setAppID: jest.fn(),
  initializeSDK: jest.fn(),
};
const mockLoginManager = {
  logInWithPermissions: jest.fn(),
  logOut: jest.fn(),
};
const mockAccessToken = {
  getCurrentAccessToken: jest.fn(),
};
const mockAuthenticationToken = {
  getAuthenticationTokenIOS: jest.fn(),
};

jest.mock('react-native-fbsdk-next', () => ({
  Settings: mockFbSettings,
  LoginManager: mockLoginManager,
  AccessToken: mockAccessToken,
  AuthenticationToken: mockAuthenticationToken,
}));

const mockKeychain = {
  getGenericPassword: jest.fn().mockResolvedValue(null),
  setGenericPassword: jest.fn().mockResolvedValue(true),
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  },
  SECURITY_LEVEL: {SECURE_SOFTWARE: 'SECURE_SOFTWARE'},
};
jest.mock('react-native-keychain', () => mockKeychain);

const mockAsyncStorage = {
  removeItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

const mockSyncAuthUser = jest.fn();
jest.mock('@/features/auth/services/authUserService', () => ({
  syncAuthUser: (...args: any[]) => mockSyncAuthUser(...args),
}));

const defaultPasswordlessConfig = {
  profileServiceUrl: 'https://example.com/profile',
  createAccountUrl: 'https://example.com/create',
  profileBootstrapUrl: 'https://example.com/bootstrap',
  googleWebClientId: 'test-google-client-id',
  facebookAppId: 'test-facebook-app-id',
  appleServiceId: 'com.test.app',
  appleRedirectUri: 'https://test.example.com/auth/handler',
};

const mockPasswordlessConfig = {...defaultPasswordlessConfig};
const mockApiConfig = {baseUrl: 'http://localhost:4000', timeoutMs: 15000};

jest.mock('@/config/variables', () => ({
  PASSWORDLESS_AUTH_CONFIG: mockPasswordlessConfig,
  API_CONFIG: mockApiConfig,
  PENDING_PROFILE_STORAGE_KEY: '@pending_profile_payload',
  PENDING_PROFILE_UPDATED_EVENT: 'pendingProfileUpdated',
}));

const mockConfigModule = (
  overrides?: Partial<typeof defaultPasswordlessConfig>,
) => {
  Object.assign(mockPasswordlessConfig, defaultPasswordlessConfig, overrides);
};

const okExchangeBody = {
  status: 'OK',
  createdNewRecipeUser: true,
  user: {id: 'st-user-1', emails: ['test@example.com']},
};

const baseAuthSyncResponse = {
  success: true,
  authUser: {
    _id: 'auth-user-id',
    authProvider: 'supertokens',
    providerUserId: 'st-user-1',
    email: 'test@example.com',
  },
  parentLinked: false,
  parentSummary: undefined,
};

const makeResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const loadSocialAuth = () => {
  let mod: any;
  jest.isolateModules(() => {
    jest.doMock(
      '@react-native-google-signin/google-signin',
      () => ({
        GoogleSignin: mockGoogle,
        statusCodes: {SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED'},
      }),
      {virtual: true},
    );
    jest.unmock('@/features/auth/services/socialAuth');
    mod = require('@/features/auth/services/socialAuth');
  });
  return mod;
};

describe('socialAuth', () => {
  const RN = require('react-native');
  const originalPlatform = RN.Platform.OS;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockConfigModule();
    jest.clearAllMocks();
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(makeResponse(okExchangeBody));
    mockSuperTokens.getAccessToken.mockResolvedValue('st-access-token');
    mockSyncAuthUser.mockResolvedValue(baseAuthSyncResponse);
    RN.Platform.OS = originalPlatform;
  });

  afterAll(() => {
    RN.Platform.OS = originalPlatform;
    (global as any).fetch = originalFetch;
  });

  it('configures social providers with configured IDs', () => {
    const {configureSocialProviders} = loadSocialAuth();

    configureSocialProviders();

    expect(mockGoogle.configure).toHaveBeenCalledWith(
      expect.objectContaining({webClientId: expect.any(String)}),
    );
    expect(mockAppleAuthAndroid.configure).not.toHaveBeenCalled();
  });

  // Same gap as the OTP path: the social sign-in built its token bundle with no
  // expiresAt at all, and a missing expiry reads as "never expires" downstream.
  it('records the token expiry from the access token at social sign-in', async () => {
    // {"exp":1893456000} in base64url.
    mockSuperTokens.getAccessToken.mockResolvedValue(
      ['header', 'eyJleHAiOjE4OTM0NTYwMDB9', 'sig'].join('.'),
    );
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('google');

    expect(result.tokens.expiresAt).toBe(1893456000 * 1000);
  });

  it('leaves the social sign-in expiry undefined for a non-JWT token', async () => {
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('google');

    expect(result.tokens.expiresAt).toBeUndefined();
  });

  it('signs in with Google and exchanges the tokens with SuperTokens', async () => {
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('google');

    expect(mockGoogle.hasPlayServices).toHaveBeenCalled();
    expect(mockGoogle.signIn).toHaveBeenCalled();
    expect(mockGoogle.getTokens).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/auth/signinup',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          rid: 'thirdparty',
        }),
      }),
    );
    expect(mockSuperTokens.init).toHaveBeenCalledWith(
      expect.objectContaining({
        apiDomain: 'http://localhost:4000',
        apiBasePath: '/auth',
        tokenTransferMethod: 'header',
      }),
    );
    expect(result.tokens.provider).toBe('supertokens');
    expect(result.tokens.accessToken).toBe('st-access-token');
    expect(result.user.email).toBe('test@example.com');
    expect(result.user.firstName).toBe('Ada');
    expect(result.user.lastName).toBe('Lovelace');
    expect(mockSyncAuthUser).toHaveBeenCalledWith({
      authToken: 'st-access-token',
    });
  });

  it('signs in with Apple on iOS by exchanging the identity token as oAuthTokens', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockResolvedValueOnce({
      identityToken: 'apple-id-token',
      authorizationCode: 'apple-auth-code',
      nonce: 'nonce-123',
      fullName: {givenName: 'Ada', familyName: 'Lovelace'},
      email: 'ada@apple.example',
    });

    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('apple');

    expect(mockAppleAuth.performRequest).toHaveBeenCalled();
    // The signinup body must use the oAuthTokens path. The authorization-code
    // flow (redirectURIInfo) breaks native sign-in: SuperTokens forwards the
    // empty redirect_uri to Apple's token endpoint and Apple rejects the code.
    const signInUpCall = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
      String(url).includes('/signinup'),
    );
    expect(signInUpCall).toBeDefined();
    const body = JSON.parse(signInUpCall![1].body);
    expect(body).toEqual({
      thirdPartyId: 'apple',
      oAuthTokens: {id_token: 'apple-id-token'},
    });
    expect(body.redirectURIInfo).toBeUndefined();
    expect(result.tokens.idToken).toBe('st-access-token');
    expect(result.user.firstName).toBe('Ada');
    expect(result.user.lastName).toBe('Lovelace');
    expect(result.user.email).toBe('test@example.com');
  });

  it('maps Google cancellation to auth/cancelled', async () => {
    mockGoogle.signIn.mockRejectedValueOnce({code: 'SIGN_IN_CANCELLED'});
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toMatchObject({
      code: 'auth/cancelled',
    });
  });

  it('throws for unsupported provider', async () => {
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('unknown')).rejects.toThrow(
      /Unsupported social provider/,
    );
  });

  it('configureSocialProviders tolerates missing provider ids', () => {
    mockConfigModule({googleWebClientId: '', facebookAppId: ''});
    const {configureSocialProviders} = loadSocialAuth();

    expect(() => configureSocialProviders()).not.toThrow();
  });

  it('does not reconfigure providers on a second call', () => {
    const {configureSocialProviders} = loadSocialAuth();

    configureSocialProviders();
    configureSocialProviders();

    expect(mockGoogle.configure).toHaveBeenCalledTimes(1);
  });

  it('parses a single-word full name without a last name', async () => {
    mockGoogle.signIn.mockResolvedValueOnce({
      type: 'success',
      data: {user: {email: 'solo@example.com', name: 'Ada'}},
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('google');

    expect(result.user.firstName).toBe('Ada');
    expect(result.user.lastName).toBeUndefined();
  });

  it('continues Google sign-in when clearing the previous session fails', async () => {
    mockGoogle.signOut.mockRejectedValueOnce(new Error('no session'));
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('google');

    expect(result.tokens.provider).toBe('supertokens');
  });

  it('rethrows non-cancelled Google sign-in errors', async () => {
    mockGoogle.signIn.mockRejectedValueOnce(
      Object.assign(new Error('boom'), {code: 'SOME_OTHER_CODE'}),
    );
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow('boom');
  });

  it('signs out and rethrows cancellation when getTokens fails with SIGN_IN_CANCELLED', async () => {
    mockGoogle.getTokens.mockRejectedValueOnce({code: 'SIGN_IN_CANCELLED'});
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toMatchObject({
      code: 'SIGN_IN_CANCELLED',
      message: 'Google sign-in cancelled',
    });
    expect(mockGoogle.signOut).toHaveBeenCalled();
  });

  it('rethrows a generic message when getTokens fails for a non-cancellation reason', async () => {
    mockGoogle.getTokens.mockRejectedValueOnce({code: 'SOME_ERROR'});
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toMatchObject({
      code: 'SOME_ERROR',
    });
  });

  it('throws when Google sign-in returns no ID token', async () => {
    mockGoogle.getTokens.mockResolvedValueOnce({
      idToken: null,
      accessToken: 'x',
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      /Missing ID token/,
    );
  });

  it('signs in with Facebook on iOS using the limited-login token', async () => {
    RN.Platform.OS = 'ios';
    mockLoginManager.logInWithPermissions.mockResolvedValueOnce({
      isCancelled: false,
    });
    mockAuthenticationToken.getAuthenticationTokenIOS.mockResolvedValueOnce({
      authenticationToken: 'fb-ios-token',
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('facebook');

    expect(mockLoginManager.logOut).toHaveBeenCalled();
    expect(mockLoginManager.logInWithPermissions).toHaveBeenCalledWith(
      ['public_profile', 'email'],
      'limited',
      expect.any(String),
    );
    expect(result.tokens.provider).toBe('supertokens');
  });

  it('maps Facebook iOS cancellation to auth/cancelled', async () => {
    RN.Platform.OS = 'ios';
    mockLoginManager.logInWithPermissions.mockResolvedValueOnce({
      isCancelled: true,
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('facebook')).rejects.toMatchObject({
      code: 'auth/cancelled',
    });
  });

  it('throws when Facebook iOS returns no authentication token', async () => {
    RN.Platform.OS = 'ios';
    mockLoginManager.logInWithPermissions.mockResolvedValueOnce({
      isCancelled: false,
    });
    mockAuthenticationToken.getAuthenticationTokenIOS.mockResolvedValueOnce({
      authenticationToken: null,
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('facebook')).rejects.toThrow(
      /Missing authentication token/,
    );
  });

  it('signs in with Facebook on Android using the classic access token', async () => {
    RN.Platform.OS = 'android';
    mockLoginManager.logInWithPermissions.mockResolvedValueOnce({
      isCancelled: false,
    });
    mockAccessToken.getCurrentAccessToken.mockResolvedValueOnce({
      accessToken: 'fb-android-token',
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('facebook');

    expect(mockLoginManager.logInWithPermissions).toHaveBeenCalledWith([
      'public_profile',
      'email',
    ]);
    expect(result.tokens.provider).toBe('supertokens');
  });

  it('maps Facebook Android cancellation to auth/cancelled', async () => {
    RN.Platform.OS = 'android';
    mockLoginManager.logInWithPermissions.mockResolvedValueOnce({
      isCancelled: true,
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('facebook')).rejects.toMatchObject({
      code: 'auth/cancelled',
    });
  });

  it('throws when Facebook Android returns no access token', async () => {
    RN.Platform.OS = 'android';
    mockLoginManager.logInWithPermissions.mockResolvedValueOnce({
      isCancelled: false,
    });
    mockAccessToken.getCurrentAccessToken.mockResolvedValueOnce(null);
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('facebook')).rejects.toThrow(
      /Missing access token/,
    );
  });

  it('throws when Apple iOS returns no identity token', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockResolvedValueOnce({identityToken: null});
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /no identity token/,
    );
  });

  it('throws when Apple Android sign-in is not supported on the device', async () => {
    RN.Platform.OS = 'android';
    mockAppleAuthAndroid.isSupported = false;
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /requires Android API 19/,
    );

    mockAppleAuthAndroid.isSupported = true;
  });

  it('throws when Apple Android config is missing serviceId/redirectUri', async () => {
    RN.Platform.OS = 'android';
    mockConfigModule({appleServiceId: '', appleRedirectUri: ''});
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /Missing appleServiceId/,
    );
  });

  it('signs in with Apple on Android using the id_token flow', async () => {
    RN.Platform.OS = 'android';
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('apple');

    expect(mockAppleAuthAndroid.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'com.test.app',
        redirectUri: 'https://test.example.com/auth/handler',
      }),
    );
    expect(result.tokens.provider).toBe('supertokens');
  });

  it('throws when Apple Android sign-in returns no id_token', async () => {
    RN.Platform.OS = 'android';
    mockAppleAuthAndroid.signIn.mockResolvedValueOnce({});
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /no id_token returned/,
    );
  });

  it('maps account-exists-with-different-credential apple errors', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /account already exists/,
    );
  });

  it('maps invalid_client apple configuration errors', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockRejectedValueOnce({
      message: 'invalid_client: bad config',
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /Apple configuration error/,
    );
  });

  it('maps Apple CANCELED error to auth/cancelled', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockRejectedValueOnce({
      code: mockAppleAuth.Error.CANCELED,
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toMatchObject({
      code: 'auth/cancelled',
    });
  });

  it('maps Apple FAILED error', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockRejectedValueOnce({
      code: mockAppleAuth.Error.FAILED,
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /Apple sign-in failed/,
    );
  });

  it('maps Apple INVALID_RESPONSE error', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockRejectedValueOnce({
      code: mockAppleAuth.Error.INVALID_RESPONSE,
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /Invalid response from Apple/,
    );
  });

  it('maps Apple NOT_HANDLED error', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockRejectedValueOnce({
      code: mockAppleAuth.Error.NOT_HANDLED,
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /not supported on this device/,
    );
  });

  it('wraps a non-Error apple rejection in a new Error', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockRejectedValueOnce('raw-string-failure');
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      'raw-string-failure',
    );
  });

  it('throws when Apple sign-in is attempted on an unsupported platform', async () => {
    RN.Platform.OS = 'windows' as any;
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /not supported on this platform/,
    );
  });

  it('logs and continues when clearing the legacy Apple profile cache throws', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockResolvedValueOnce({
      identityToken: 'apple-id-token',
      authorizationCode: 'auth-code',
      fullName: {givenName: 'Ada', familyName: 'Lovelace'},
      email: 'ada@example.com',
    });
    mockAsyncStorage.removeItem.mockRejectedValueOnce(
      new Error('storage down'),
    );
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('apple');

    expect(result.tokens.provider).toBe('supertokens');
  });

  it('uses a cached Apple profile from Keychain when Apple omits name/email on subsequent logins', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockResolvedValueOnce({
      identityToken: 'apple-id-token-2',
      authorizationCode: 'auth-code-2',
      fullName: null,
      email: null,
    });
    mockKeychain.getGenericPassword.mockResolvedValueOnce({
      username: 'apple-profile',
      password: JSON.stringify({
        firstName: 'Cached',
        lastName: 'Person',
        email: 'cached@example.com',
      }),
    });
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(makeResponse({status: 'OK', user: {id: 'st-user-1'}}));
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('apple');

    expect(result.user.firstName).toBe('Cached');
    expect(result.user.lastName).toBe('Person');
    expect(result.user.email).toBe('cached@example.com');
  });

  it('warns and returns no cached profile when reading from Keychain throws', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockResolvedValueOnce({
      identityToken: 'apple-id-token',
      authorizationCode: 'auth-code',
      fullName: {givenName: 'Ada', familyName: 'Lovelace'},
      email: 'ada@example.com',
    });
    mockKeychain.getGenericPassword.mockRejectedValueOnce(
      new Error('keychain error'),
    );
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('apple');

    expect(result.tokens.provider).toBe('supertokens');
  });

  it('warns and continues when caching the Apple profile in Keychain fails', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockResolvedValueOnce({
      identityToken: 'apple-id-token',
      authorizationCode: 'auth-code',
      fullName: {givenName: 'Ada', familyName: 'Lovelace'},
      email: 'ada@example.com',
    });
    mockKeychain.setGenericPassword.mockRejectedValueOnce(
      new Error('keychain write failed'),
    );
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('apple');

    expect(result.tokens.provider).toBe('supertokens');
  });

  it('surfaces the server-provided reason for SIGN_IN_UP_NOT_ALLOWED', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(
      makeResponse({
        status: 'SIGN_IN_UP_NOT_ALLOWED',
        reason: 'Email already linked to email/password',
      }),
    );
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toMatchObject({
      code: 'auth/account-exists-with-different-credential',
      message: 'Email already linked to email/password',
    });
  });

  it('falls back to a default message for SIGN_IN_UP_NOT_ALLOWED without a reason', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(makeResponse({status: 'SIGN_IN_UP_NOT_ALLOWED'}));
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      /account already exists with this email/,
    );
  });

  it('falls back to a generic message for unrecognized non-OK statuses', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(makeResponse({status: 'SOMETHING_ELSE'}));
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      /Social sign-in failed/,
    );
  });

  it('uses the server message for unrecognized non-OK statuses when present', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse({status: 'ERR', message: 'custom failure'}),
      );
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      'custom failure',
    );
  });

  it('treats an unparsable exchange response body as empty and fails', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      /Social sign-in failed/,
    );
  });

  it('throws when the exchange response is not ok', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(
        makeResponse({status: 'OK', user: {id: 'x'}}, false, 500),
      );
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow();
  });

  it('throws when the exchange response has no user id', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(makeResponse({status: 'OK'}));
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      /Missing user in response/,
    );
  });

  it('warns when Google sign-out during error cleanup fails', async () => {
    mockSuperTokens.getAccessToken.mockResolvedValueOnce(null);
    let signOutCallCount = 0;
    mockGoogle.signOut.mockImplementation(() => {
      signOutCallCount += 1;
      if (signOutCallCount === 2) {
        return Promise.reject(new Error('cleanup fail'));
      }
      return Promise.resolve(undefined);
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      /Authentication tokens are missing/,
    );
    expect(mockGoogle.signOut).toHaveBeenCalledTimes(2);

    mockGoogle.signOut.mockResolvedValue(undefined);
  });

  it('throws when no email can be resolved from the provider or exchange', async () => {
    mockGoogle.signIn.mockResolvedValueOnce({
      type: 'success',
      data: {user: {givenName: 'Ada'}},
    });
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(makeResponse({status: 'OK', user: {id: 'st-user-1'}}));
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      /could not retrieve your email/,
    );
  });

  it('continues with a default profile when syncAuthUser fails', async () => {
    mockSyncAuthUser.mockRejectedValueOnce(new Error('sync down'));
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('google');

    expect(result.profile.exists).toBe(false);
    expect(result.parentLinked).toBe(false);
  });

  it('parses a multi-word full name into first and last name via parseName', async () => {
    mockGoogle.signIn.mockResolvedValueOnce({
      type: 'success',
      data: {user: {email: 'multi@example.com', name: 'Ada Marie Lovelace'}},
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('google');

    expect(result.user.firstName).toBe('Ada');
    expect(result.user.lastName).toBe('Marie Lovelace');
  });

  it('defaults to an empty profile when Google sign-in returns no result payload', async () => {
    mockGoogle.signIn.mockResolvedValueOnce(undefined);
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('google');

    expect(result.user.firstName).toBeUndefined();
    expect(result.user.email).toBe('test@example.com');
  });

  it('reads the Google user profile from a flat (non-data-wrapped) sign-in result', async () => {
    mockGoogle.signIn.mockResolvedValueOnce({
      user: {email: 'flat@example.com', givenName: 'Flat', familyName: 'User'},
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('google');

    expect(result.user.firstName).toBe('Flat');
    expect(result.user.lastName).toBe('User');
  });

  it('throws when GoogleSignin.getTokens resolves with no payload', async () => {
    mockGoogle.getTokens.mockResolvedValueOnce(undefined);
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      /Missing ID token/,
    );
  });

  it('defaults the error code to auth/cancelled when getTokens fails without a code', async () => {
    mockGoogle.getTokens.mockRejectedValueOnce({});
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toMatchObject({
      code: 'auth/cancelled',
    });
  });

  it('swallows a failed Google sign-out cleanup after getTokens fails', async () => {
    mockGoogle.getTokens.mockRejectedValueOnce({code: 'SOME_ERROR'});
    let signOutCallCount = 0;
    mockGoogle.signOut.mockImplementation(() => {
      signOutCallCount += 1;
      if (signOutCallCount === 2) {
        return Promise.reject(new Error('cleanup after getTokens failed'));
      }
      return Promise.resolve(undefined);
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toMatchObject({
      code: 'SOME_ERROR',
    });
    expect(mockGoogle.signOut).toHaveBeenCalledTimes(3);

    mockGoogle.signOut.mockResolvedValue(undefined);
  });

  it('omits the authorization code when Apple iOS does not provide one', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockResolvedValueOnce({
      identityToken: 'apple-id-token-3',
      fullName: {givenName: 'Ada', familyName: 'Lovelace'},
      email: 'ada@example.com',
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('apple');

    expect(result.tokens.provider).toBe('supertokens');
  });

  it('defaults Apple Android profile fields to null when the response has no user object', async () => {
    RN.Platform.OS = 'android';
    mockAppleAuthAndroid.signIn.mockResolvedValueOnce({
      id_token: 'apple-android-token-2',
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('apple');

    expect(result.tokens.provider).toBe('supertokens');
  });

  it('treats a non-object exchange response body as empty', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => 'just-a-string',
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      /Social sign-in failed/,
    );
  });

  it('marks the profile as existing and complete when authSync returns a parent summary', async () => {
    mockSyncAuthUser.mockResolvedValueOnce({
      success: true,
      authUser: baseAuthSyncResponse.authUser,
      parentLinked: true,
      parentSummary: {
        id: 'parent-1',
        isComplete: true,
        profileImageUrl: 'https://img.example/p.png',
      },
    });
    const {signInWithSocialProvider} = loadSocialAuth();

    const result = await signInWithSocialProvider('google');

    expect(result.profile.exists).toBe(true);
    expect(result.profile.isComplete).toBe(true);
    expect(result.parentLinked).toBe(true);
  });

  it('suppresses errors whose message mentions cancellation even without an error code', async () => {
    mockGoogle.signIn.mockRejectedValueOnce(
      new Error('User cancelled the login flow'),
    );
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toMatchObject({
      code: 'auth/cancelled',
      message: 'auth/cancelled',
    });
  });

  it('surfaces a plain error message when no code is present and it does not mention cancellation', async () => {
    mockGoogle.signIn.mockRejectedValueOnce(
      new Error('totally unrelated failure'),
    );
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      'totally unrelated failure',
    );
  });

  it('wraps a plain object rejection with no message in a generic Error', async () => {
    mockGoogle.signIn.mockRejectedValueOnce({});
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      '[object Object]',
    );
  });

  it('falls back to a generic message when a nullish value is thrown', async () => {
    mockGoogle.signIn.mockRejectedValueOnce(null);
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      'Social sign-in failed',
    );
  });

  it('defaults all cached Apple profile fields to null when nothing is cached and Apple/exchange provide no name or email', async () => {
    RN.Platform.OS = 'ios';
    mockAppleAuth.performRequest.mockResolvedValueOnce({
      identityToken: 'apple-id-token-4',
      authorizationCode: 'auth-code-4',
      fullName: null,
      email: null,
    });
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue(makeResponse({status: 'OK', user: {id: 'st-user-1'}}));
    const {signInWithSocialProvider} = loadSocialAuth();

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(
      /could not retrieve your email/,
    );
    expect(mockKeychain.setGenericPassword).toHaveBeenCalled();
  });
});
