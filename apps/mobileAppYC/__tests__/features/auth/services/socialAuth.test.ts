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
    user: {name: {firstName: 'Ada', lastName: 'Lovelace'}, email: 'ada@example.com'},
  }),
  ResponseType: {ALL: 'ALL'},
  Scope: {ALL: 'ALL'},
};

jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: mockAppleAuth,
  appleAuthAndroid: mockAppleAuthAndroid,
}));

jest.mock('react-native-fbsdk-next', () => ({
  Settings: {
    setAppID: jest.fn(),
    initializeSDK: jest.fn(),
  },
  LoginManager: {
    logInWithPermissions: jest.fn(),
    logOut: jest.fn(),
  },
  AccessToken: {
    getCurrentAccessToken: jest.fn(),
  },
  AuthenticationToken: {
    getAuthenticationTokenIOS: jest.fn(),
  },
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
    (global as any).fetch = jest.fn().mockResolvedValue(makeResponse(okExchangeBody));
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

  it('signs in with Apple on iOS using the authorization code flow', async () => {
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
});
