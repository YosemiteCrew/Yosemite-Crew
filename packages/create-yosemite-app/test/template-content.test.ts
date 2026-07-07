import * as fs from 'node:fs';
import * as path from 'node:path';

const templateDir = path.resolve(__dirname, '..', 'templates', 'api-starter');

function read(relative: string): string {
  return fs.readFileSync(path.join(templateDir, relative), 'utf8');
}

describe('api-starter template contract fidelity', () => {
  describe('src/client.ts', () => {
    let client: string;
    beforeAll(() => {
      client = read('src/client.ts');
    });

    it('targets every v1 data-plane endpoint', () => {
      // Quote-agnostic so prettier's quote style never breaks the contract check.
      for (const resource of ['appointments', 'patients', 'encounters', 'invoices']) {
        expect(client).toMatch(new RegExp(`['"]/v1/developer/${resource}['"]`));
        expect(client).toContain(`\`/v1/developer/${resource}/\${encodeURIComponent(id)}\``);
      }
      expect(client).toMatch(/['"]\/v1\/developer\/organization['"]/);
      expect(client).toMatch(/['"]\/v1\/developer\/usage['"]/);
    });

    it('authenticates with a Bearer Authorization header', () => {
      expect(client).toContain('Authorization: `Bearer ${this.apiKey}`');
      // The alternative header is documented for readers.
      expect(client).toContain('X-API-Key');
    });

    it('distinguishes the two 429 codes and reads Retry-After', () => {
      expect(client).toContain('rate_limited');
      expect(client).toContain('quota_exceeded');
      expect(client).toMatch(/headers\.get\(['"]Retry-After['"]\)/);
      expect(client).toContain('retryAfterSeconds');
    });

    it('documents the stable error codes and parses the error envelope', () => {
      for (const code of [
        'invalid_request',
        'missing_api_key',
        'invalid_api_key',
        'insufficient_scope',
        'not_found',
        'internal_error',
      ]) {
        expect(client).toContain(code);
      }
      expect(client).toContain('message?: string');
      expect(client).toContain('code?: string');
      expect(client).toContain('YosemiteApiError');
    });

    it('stays dependency-free (fetch only, no axios or other imports)', () => {
      expect(client).toContain('await fetch(');
      expect(client).not.toContain('axios');
      expect(client).not.toMatch(/from ['"]node:/);
      // The only import is the local type module.
      expect(client).toMatch(/from ['"]\.\/types\.js['"]/);
    });
  });

  describe('src/types.ts', () => {
    let types: string;
    beforeAll(() => {
      types = read('src/types.ts');
    });

    it('models the pagination envelope', () => {
      expect(types).toContain('nextCursor: string | null');
      expect(types).toContain('hasMore: boolean');
      expect(types).toContain('limit: number');
      expect(types).toContain('pagination: Pagination');
    });

    it('models the contract enums', () => {
      for (const status of [
        'REQUESTED',
        'UPCOMING',
        'CHECKED_IN',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW',
      ]) {
        expect(types).toMatch(new RegExp(`['"]${status}['"]`));
      }
      for (const status of ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED']) {
        expect(types).toMatch(new RegExp(`['"]${status}['"]`));
      }
    });

    it('models the usage introspection payload', () => {
      expect(types).toContain('billingPeriod: string');
      expect(types).toContain('callCount: number');
      expect(types).toContain('limit: number | null');
    });
  });

  describe('supporting files', () => {
    it('.env.example declares both variables and no secret values', () => {
      const env = read('.env.example');
      expect(env).toMatch(/^YC_API_KEY=$/m);
      expect(env).toMatch(/^YC_API_BASE_URL=http:\/\/localhost:3000$/m);
    });

    it('_gitignore ignores .env', () => {
      expect(read('_gitignore').split('\n')).toContain('.env');
    });

    it('package.json keeps the runtime dependency-free', () => {
      const packageJson = JSON.parse(read('package.json')) as {
        name: string;
        dependencies?: Record<string, string>;
        devDependencies: Record<string, string>;
      };
      expect(packageJson.name).toBe('{{name}}');
      expect(packageJson.dependencies).toBeUndefined();
      // Default sort = code-unit order, so "@types/node" sorts first.
      expect(Object.keys(packageJson.devDependencies).sort()).toEqual([
        '@types/node',
        'typescript',
      ]);
    });

    it('README explains where keys come from and which scopes are needed', () => {
      const readme = read('README.md');
      expect(readme).toContain('/developers/api-keys');
      expect(readme).toContain('appointments:read');
      expect(readme).toContain('patients:read');
      expect(readme).toContain('organization:read');
      expect(readme).toContain('rate_limited');
      expect(readme).toContain('quota_exceeded');
    });

    it('the example lists appointments and reads usage', () => {
      const index = read('src/index.ts');
      expect(index).toContain('listAppointments');
      expect(index).toContain('getUsage');
      expect(index).toMatch(/['"]UPCOMING['"]/);
      expect(index).toContain('YC_API_KEY');
      expect(index).toContain('YC_API_BASE_URL');
    });
  });
});
