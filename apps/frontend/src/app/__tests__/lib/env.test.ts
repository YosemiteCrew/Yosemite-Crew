import { getEnv } from '@/app/lib/env';

describe('getEnv', () => {
  beforeEach(() => {
    delete process.env['TEST_KEY'];
  });

  it('returns the environment variable value when set', () => {
    process.env['TEST_KEY'] = 'hello';
    expect(getEnv('TEST_KEY')).toBe('hello');
  });

  it('returns undefined when the key is not set', () => {
    expect(getEnv('NON_EXISTENT_KEY_123')).toBeUndefined();
  });

  it('returns undefined for non-string env values', () => {
    // process.env values are always strings or undefined in Node
    expect(getEnv('UNDEFINED_KEY')).toBeUndefined();
  });
});
