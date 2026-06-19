'use strict';

import http from 'node:http';
import crypto from 'node:crypto';

export interface LocalApiServer {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getPort: () => number;
  getToken: () => string;
  isRunning: () => boolean;
}

export interface LocalApiDeps {
  port?: number;
  // Bearer token required on /api/* routes. Generated if not supplied.
  token?: string;
  logger: {
    debug: (event: string, data?: unknown) => void;
    info: (event: string, data?: unknown) => void;
    warn: (event: string, data?: unknown) => void;
  };
  getStatus?: () => Record<string, unknown>;
  getSettings?: () => Record<string, unknown>;
  handleNavigate?: (url: string) => void;
}

// A localhost control API is not a CORS-readable web resource: no
// Access-Control-Allow-Origin header is emitted, so browser script on other
// origins cannot read responses even if it can issue requests.
const respond = (res: http.ServerResponse, status: number, data: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

// Reject any request whose Host header is not loopback. Without this, a
// DNS-rebinding attack could reach the server from a remote origin.
export const isLoopbackHost = (hostHeader: string | undefined): boolean => {
  if (!hostHeader) return false;
  const lower = hostHeader.toLowerCase();
  if (LOOPBACK_HOSTS.has(lower)) return true;
  const withoutPort = lower.replace(/:\d+$/, '');
  return LOOPBACK_HOSTS.has(withoutPort);
};

const parseBody = (req: http.IncomingMessage): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });

export const createLocalApiServer = (deps: LocalApiDeps): LocalApiServer => {
  const port = deps.port || 18799;
  const token = deps.token || crypto.randomBytes(24).toString('hex');
  let server: http.Server | null = null;
  let running = false;

  const isAuthorized = (req: http.IncomingMessage): boolean => {
    const header = req.headers['authorization'];
    if (typeof header !== 'string') return false;
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) return false;
    const provided = Buffer.from(match[1] ?? '');
    const expected = Buffer.from(token);
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  };

  const handler = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    try {
      if (!isLoopbackHost(req.headers.host)) {
        respond(res, 403, { error: 'forbidden host' });
        return;
      }

      const url = req.url || '/';
      const method = (req.method || 'GET').toUpperCase();

      if (url === '/health' || url === '/') {
        respond(res, 200, { status: 'ok', app: 'Yosemite Crew PIMS' });
        return;
      }

      // Everything under /api/* requires the bearer token.
      if (!isAuthorized(req)) {
        respond(res, 401, { error: 'unauthorized' });
        return;
      }

      if (url === '/api/status' && method === 'GET') {
        respond(res, 200, { ...deps.getStatus?.(), uptime: process.uptime() });
        return;
      }

      if (url === '/api/settings' && method === 'GET') {
        respond(res, 200, deps.getSettings?.() || {});
        return;
      }

      if (url === '/api/navigate' && method === 'POST') {
        const body = await parseBody(req);
        const target = body.url as string | undefined;
        if (!target) {
          respond(res, 400, { error: 'url required' });
          return;
        }
        deps.handleNavigate?.(target);
        respond(res, 200, { ok: true });
        return;
      }

      respond(res, 404, { error: 'not found' });
    } catch (err) {
      deps.logger.warn('local_api_error', { error: String(err) });
      respond(res, 500, { error: 'internal error' });
    }
  };

  const start = async (): Promise<void> => {
    if (running) return;
    return new Promise((resolve, reject) => {
      server = http.createServer(handler);
      server.listen(port, '127.0.0.1', () => {
        running = true;
        deps.logger.info('local_api_started', { port });
        resolve();
      });
      server.on('error', (err) => {
        deps.logger.warn('local_api_error', { error: String(err) });
        reject(err);
      });
    });
  };

  const stop = async (): Promise<void> => {
    const srv = server;
    if (!running || !srv) return;
    return new Promise((resolve) => {
      srv.close(() => {
        running = false;
        deps.logger.info('local_api_stopped');
        resolve();
      });
    });
  };

  const getPort = (): number => port;
  const getToken = (): string => token;
  const isRunning = (): boolean => running;

  return { start, stop, getPort, getToken, isRunning };
};
