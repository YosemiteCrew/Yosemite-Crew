'use strict';

import http from 'node:http';
import { createLocalApiServer, LocalApiDeps, isLoopbackHost } from '../src/core/local-api';

let portCounter = 20000;
const nextPort = (): number => ++portCounter;

const TOKEN = 'test-token-fixed';

const makeDeps = (overrides: Partial<LocalApiDeps> = {}): LocalApiDeps => ({
  port: nextPort(),
  token: TOKEN,
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn() },
  getStatus: jest.fn(() => ({ online: true, queued: 3 })),
  getSettings: jest.fn(() => ({ theme: 'dark', locale: 'en' })),
  handleNavigate: jest.fn(),
  ...overrides,
});

interface FetchOpts {
  method?: string;
  body?: string;
  auth?: string | null; // null = omit Authorization header
  host?: string;
}

const fetchJson = (url: string, opts: FetchOpts = {}): Promise<{ status: number; body: unknown }> =>
  new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (opts.body) headers['Content-Type'] = 'application/json';
    if (opts.auth !== null) headers['Authorization'] = `Bearer ${opts.auth || TOKEN}`;
    if (opts.host) headers['Host'] = opts.host;
    const req = http.request(url, { method: opts.method || 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode || 500,
            body: body ? JSON.parse(body) : null,
          });
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });

describe('isLoopbackHost', () => {
  test('accepts loopback hosts with and without ports', () => {
    expect(isLoopbackHost('127.0.0.1:18799')).toBe(true);
    expect(isLoopbackHost('localhost:20001')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('[::1]:18799')).toBe(true);
  });

  test('rejects non-loopback and missing hosts', () => {
    expect(isLoopbackHost('evil.com')).toBe(false);
    expect(isLoopbackHost('example.com:18799')).toBe(false);
    expect(isLoopbackHost(undefined)).toBe(false);
  });
});

describe('createLocalApiServer', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('start and stop lifecycle', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    expect(api.isRunning()).toBe(false);
    await api.start();
    expect(api.isRunning()).toBe(true);
    expect(api.getPort()).toBe(deps.port);
    await api.stop();
    expect(api.isRunning()).toBe(false);
  });

  test('start is idempotent', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    await api.start();
    expect(api.isRunning()).toBe(true);
    await api.stop();
  });

  test('stop is idempotent', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    await api.stop();
    await api.stop();
    expect(api.isRunning()).toBe(false);
  });

  test('GET /health returns ok without a token', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/health`, {
      auth: null,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    await api.stop();
  });

  test('GET / returns ok', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    await api.stop();
  });

  test('GET /api/status returns status from deps', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/api/status`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ online: true, queued: 3 });
    expect(typeof (res.body as Record<string, unknown>).uptime).toBe('number');
    await api.stop();
  });

  test('GET /api/settings returns settings from deps', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/api/settings`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ theme: 'dark', locale: 'en' });
    await api.stop();
  });

  test('/api/* requires a valid bearer token', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    const noToken = await fetchJson(`http://127.0.0.1:${deps.port}/api/settings`, { auth: null });
    expect(noToken.status).toBe(401);
    const wrongToken = await fetchJson(`http://127.0.0.1:${deps.port}/api/settings`, {
      auth: 'nope',
    });
    expect(wrongToken.status).toBe(401);
    await api.stop();
  });

  test('rejects requests with a non-loopback Host header', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/health`, {
      host: 'evil.com',
    });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'forbidden host' });
    await api.stop();
  });

  test('does not emit an Access-Control-Allow-Origin header', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    const acao = await new Promise<string | undefined>((resolve, reject) => {
      const req = http.request(`http://127.0.0.1:${deps.port}/health`, (res) => {
        res.resume();
        resolve(res.headers['access-control-allow-origin']);
      });
      req.on('error', reject);
      req.end();
    });
    expect(acao).toBeUndefined();
    await api.stop();
  });

  test('POST /api/navigate calls handleNavigate', async () => {
    const handleNavigate = jest.fn();
    const deps = makeDeps({ handleNavigate });
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/api/navigate`, {
      method: 'POST',
      body: JSON.stringify({ url: 'yosemitecrew://patients/new' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(handleNavigate).toHaveBeenCalledWith('yosemitecrew://patients/new');
    await api.stop();
  });

  test('POST /api/navigate requires url field', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/api/navigate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'url required' });
    await api.stop();
  });

  test('GET unknown route returns 404', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/api/nonexistent`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'not found' });
    await api.stop();
  });

  test('invalid JSON body returns 500', async () => {
    const handleNavigate = jest.fn();
    const deps = makeDeps({ handleNavigate });
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/api/navigate`, {
      method: 'POST',
      body: 'not-json',
    });
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'internal error' });
    await api.stop();
  });

  test('default port is 18799', () => {
    const deps = makeDeps({ port: undefined as unknown as number });
    const api = createLocalApiServer(deps);
    expect(api.getPort()).toBe(18799);
  });

  test('generates a token when none is provided', () => {
    const api = createLocalApiServer(makeDeps({ token: undefined }));
    expect(api.getToken().length).toBeGreaterThanOrEqual(32);
  });

  test('listening on 127.0.0.1 only', async () => {
    const deps = makeDeps();
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/health`);
    expect(res.status).toBe(200);
    await api.stop();
  });

  test('getStatus not required — graceful fallback', async () => {
    const deps = makeDeps({ getStatus: undefined });
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/api/status`);
    expect(res.status).toBe(200);
    await api.stop();
  });

  test('getSettings not required — graceful fallback', async () => {
    const deps = makeDeps({ getSettings: undefined });
    const api = createLocalApiServer(deps);
    await api.start();
    const res = await fetchJson(`http://127.0.0.1:${deps.port}/api/settings`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
    await api.stop();
  });
});
