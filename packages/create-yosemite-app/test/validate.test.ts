import { validateProjectName } from '../src/validate.js';

describe('validateProjectName', () => {
  it.each(['my-app', 'my-integration', 'a', 'app2', 'clinic-sync-2', 'x-1-y'])(
    'accepts %s',
    (name) => {
      expect(validateProjectName(name)).toBeNull();
    }
  );

  it.each(['My-App', 'my_app', '-app', 'app-', 'my--app', '2fast', '.hidden', 'my app', 'my-app!'])(
    'rejects %s as not kebab-case',
    (name) => {
      expect(validateProjectName(name)).toContain('kebab-case');
    }
  );

  it.each(['../evil', '..', 'foo/bar', 'foo\\bar', 'foo/../bar', '/abs'])(
    'rejects %s for path traversal',
    (name) => {
      expect(validateProjectName(name)).toContain('path separators');
    }
  );

  it('rejects an empty name', () => {
    expect(validateProjectName('')).toContain('required');
  });

  it('rejects names longer than 214 characters', () => {
    const name = `a${'-a'.repeat(110)}`;
    expect(name.length).toBeGreaterThan(214);
    expect(validateProjectName(name)).toContain('214');
  });

  it('accepts a name of exactly 214 characters', () => {
    expect(validateProjectName('a'.repeat(214))).toBeNull();
  });
});
