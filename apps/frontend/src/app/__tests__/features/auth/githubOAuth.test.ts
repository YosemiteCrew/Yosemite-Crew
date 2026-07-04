import { TextEncoder } from 'node:util';

type OAuthModule = typeof import('@/app/features/auth/lib/githubOAuth');

const loadModule = (): OAuthModule =>
  jest.requireActual('@/app/features/auth/lib/githubOAuth') as OAuthModule;

const enableEnv = () => {
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = 'yc.auth.eu-central-1.amazoncognito.com';
  process.env.NEXT_PUBLIC_COGNITO_CLIENTID = 'client123';
  process.env.NEXT_PUBLIC_COGNITO_GITHUB_IDP = 'GitHub';
};

describe('githubOAuth', () => {
  const originalEnv = process.env;
  let realSessionStorage: Storage;

  const overrideSessionStorage = (partial: Partial<Storage>) => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
        ...partial,
      },
    });
  };

  beforeAll(() => {
    realSessionStorage = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i += 1) arr[i] = (i * 7) % 256;
          return arr;
        },
        subtle: { digest: async () => new Uint8Array(32).buffer },
      },
    });
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    sessionStorage.clear();
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: realSessionStorage,
    });
  });

  it('is disabled until the domain and client id are configured', () => {
    delete process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    expect(loadModule().isGithubSignInEnabled()).toBe(false);
  });

  it('is enabled once configured', () => {
    enableEnv();
    expect(loadModule().isGithubSignInEnabled()).toBe(true);
  });

  it('returns null from startGithubSignIn when disabled', async () => {
    delete process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    expect(await loadModule().startGithubSignIn('/developers/home')).toBeNull();
  });

  it('builds the authorize URL with PKCE + state and stores the handshake', async () => {
    enableEnv();
    const url = await loadModule().startGithubSignIn('/developers/home');
    expect(url).not.toBeNull();
    const parsed = new URL(url as string);
    expect(parsed.origin).toBe('https://yc.auth.eu-central-1.amazoncognito.com');
    expect(parsed.pathname).toBe('/oauth2/authorize');
    expect(parsed.searchParams.get('identity_provider')).toBe('GitHub');
    expect(parsed.searchParams.get('client_id')).toBe('client123');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
    expect(parsed.searchParams.get('redirect_uri')).toContain('/auth/callback');

    const stored = JSON.parse(sessionStorage.getItem('yc_github_oauth_v1') as string);
    expect(stored.state).toBe(parsed.searchParams.get('state'));
    expect(stored.redirectTo).toBe('/developers/home');
    expect(stored.verifier).toBeTruthy();
  });

  it('exchanges the code for tokens after validating state', async () => {
    enableEnv();
    const mod = loadModule();
    const url = await mod.startGithubSignIn('/developers/home');
    const state = new URL(url as string).searchParams.get('state') as string;

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: 'idt', access_token: 'act', refresh_token: 'rft' }),
    }) as unknown as typeof fetch;

    const result = await mod.completeGithubSignIn({ code: 'code123', state });
    expect(result.tokens).toEqual({ idToken: 'idt', accessToken: 'act', refreshToken: 'rft' });
    expect(result.redirectTo).toBe('/developers/home');
  });

  it('rejects a mismatched state', async () => {
    enableEnv();
    const mod = loadModule();
    await mod.startGithubSignIn('/x');
    await expect(mod.completeGithubSignIn({ code: 'c', state: 'wrong' })).rejects.toThrow();
  });

  it('throws when there is no stored handshake', async () => {
    enableEnv();
    await expect(loadModule().completeGithubSignIn({ code: 'c', state: 's' })).rejects.toThrow();
  });

  it('throws on a failed token exchange', async () => {
    enableEnv();
    const mod = loadModule();
    const url = await mod.startGithubSignIn('/x');
    const state = new URL(url as string).searchParams.get('state') as string;
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }) as unknown as typeof fetch;
    await expect(mod.completeGithubSignIn({ code: 'c', state })).rejects.toThrow();
  });

  it('treats an unparseable Cognito domain as disabled', () => {
    process.env.NEXT_PUBLIC_COGNITO_DOMAIN = 'http://';
    process.env.NEXT_PUBLIC_COGNITO_CLIENTID = 'client123';
    expect(loadModule().isGithubSignInEnabled()).toBe(false);
  });

  it('throws on an incomplete token response', async () => {
    enableEnv();
    const mod = loadModule();
    const url = await mod.startGithubSignIn('/x');
    const state = new URL(url as string).searchParams.get('state') as string;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: 'only-id' }),
    }) as unknown as typeof fetch;
    await expect(mod.completeGithubSignIn({ code: 'c', state })).rejects.toThrow();
  });

  it('falls back to the developer home when no redirect target was stored', async () => {
    enableEnv();
    const mod = loadModule();
    const url = await mod.startGithubSignIn('');
    const state = new URL(url as string).searchParams.get('state') as string;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: 'i', access_token: 'a', refresh_token: 'r' }),
    }) as unknown as typeof fetch;
    const result = await mod.completeGithubSignIn({ code: 'c', state });
    expect(result.redirectTo).toBe('/developers/home');
  });

  it('still builds the authorize URL when sessionStorage.setItem is blocked', async () => {
    enableEnv();
    overrideSessionStorage({
      setItem: () => {
        throw new Error('private mode');
      },
    });
    const url = await loadModule().startGithubSignIn('/x');
    expect(url).toContain('/oauth2/authorize');
  });

  it('fails closed when sessionStorage.getItem throws', async () => {
    enableEnv();
    overrideSessionStorage({
      getItem: () => {
        throw new Error('blocked');
      },
    });
    await expect(loadModule().completeGithubSignIn({ code: 'c', state: 's' })).rejects.toThrow();
  });

  it('tolerates sessionStorage.removeItem throwing after a valid handshake', async () => {
    enableEnv();
    const mod = loadModule();
    const url = await mod.startGithubSignIn('/dash');
    const state = new URL(url as string).searchParams.get('state') as string;
    const storedRaw = sessionStorage.getItem('yc_github_oauth_v1');
    overrideSessionStorage({
      getItem: () => storedRaw,
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: 'i', access_token: 'a', refresh_token: 'r' }),
    }) as unknown as typeof fetch;
    const result = await mod.completeGithubSignIn({ code: 'c', state });
    expect(result.tokens.idToken).toBe('i');
    expect(result.redirectTo).toBe('/dash');
  });
});
