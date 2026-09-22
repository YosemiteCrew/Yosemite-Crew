import {
  createExecutionProvider,
  defaultProviderRegistry,
  missingCapabilities,
  validateExecutionConfig,
} from '../src/index.js';
import type { ExecutionProvider, ProviderFactory } from '../src/index.js';
import { configFor, managedSessionTransport, modelToolTransport } from './fixtures.js';

const managed = () => configFor('managed-session', managedSessionTransport().transport);
const modelTool = () => configFor('model-tool', modelToolTransport().transport);

describe('configuration', () => {
  it('accepts a complete configuration', () => {
    expect(() => validateExecutionConfig(managed())).not.toThrow();
  });

  it('refuses a provider that has not been acknowledged for data egress', () => {
    expect(() => createExecutionProvider({ ...managed(), dataEgressAcknowledged: false })).toThrow(
      expect.objectContaining({ code: 'configuration-invalid' })
    );
  });

  it('refuses a base URL that is neither https nor local development', () => {
    expect(() =>
      createExecutionProvider({ ...managed(), baseUrl: 'http://example.invalid' })
    ).toThrow(expect.objectContaining({ code: 'configuration-invalid' }));
  });

  it('accepts a localhost base URL for development', () => {
    expect(() =>
      validateExecutionConfig({ ...managed(), baseUrl: 'http://localhost:4000' })
    ).not.toThrow();
  });

  it.each(['http://localhost.evil.invalid', 'http://localhost@evil.invalid', 'not a URL'])(
    'refuses a non-local URL disguised as localhost: %s',
    (baseUrl) => {
      expect(() => validateExecutionConfig({ ...managed(), baseUrl })).toThrow(
        expect.objectContaining({ code: 'configuration-invalid' })
      );
    }
  );

  it('refuses an empty model', () => {
    expect(() => createExecutionProvider({ ...managed(), model: '  ' })).toThrow(
      expect.objectContaining({ code: 'configuration-invalid' })
    );
  });

  it('refuses a budget that permits no tool calls', () => {
    expect(() => createExecutionProvider({ ...managed(), budget: { maxToolCalls: 0 } })).toThrow(
      expect.objectContaining({ code: 'configuration-invalid' })
    );
  });
});

describe('provider selection', () => {
  it('builds each provider in the default registry', () => {
    expect(createExecutionProvider(managed()).name).toBe('managed-session');
    expect(createExecutionProvider(modelTool()).name).toBe('model-tool');
    expect(Object.keys(defaultProviderRegistry).sort()).toEqual(['managed-session', 'model-tool']);
  });

  it('adds a replacement provider through the registry alone', () => {
    const replacement: ExecutionProvider = {
      name: 'other-vendor',
      capabilities: () => ({
        provider: 'other-vendor',
        supports: ['structured-output', 'tool-calls'],
      }),
      run: async () => ({ output: {} }),
      cancel: async () => undefined,
    };
    const factory: ProviderFactory = () => replacement;

    const built = createExecutionProvider(
      { ...managed(), provider: 'other-vendor' },
      {
        ...defaultProviderRegistry,
        'other-vendor': factory,
      }
    );

    expect(built).toBe(replacement);
  });

  it('refuses an unconfigured provider instead of falling back to a configured one', () => {
    expect(() => createExecutionProvider({ ...managed(), provider: 'absent-vendor' })).toThrow(
      expect.objectContaining({ code: 'configuration-invalid' })
    );
  });
});

describe('capability negotiation', () => {
  it('rejects a provider that cannot meet a required capability', () => {
    expect(() =>
      createExecutionProvider({
        ...modelTool(),
        requiredCapabilities: ['provider-resume', 'tool-calls'],
      })
    ).toThrow(
      expect.objectContaining({
        code: 'capability-unsupported',
        message: expect.stringContaining('provider-resume'),
      })
    );
  });

  it('accepts the same requirement from a provider that supports it', () => {
    expect(() =>
      createExecutionProvider({
        ...managed(),
        requiredCapabilities: ['provider-resume', 'tool-calls'],
      })
    ).not.toThrow();
  });

  it('reports exactly which capabilities are missing', () => {
    const provider = createExecutionProvider(modelTool());

    expect(missingCapabilities(provider, ['tool-calls', 'structured-output'])).toEqual([]);
    expect(missingCapabilities(provider, ['provider-resume'])).toEqual(['provider-resume']);
  });
});
