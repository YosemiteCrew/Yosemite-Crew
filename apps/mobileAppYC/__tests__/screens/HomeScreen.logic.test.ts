import {deriveHomeGreetingName} from '@/features/home/screens/HomeScreen/HomeScreen.helpers';

describe('deriveHomeGreetingName', () => {
  it('uses trimmed name when provided', () => {
    const r = deriveHomeGreetingName('  Sky  ');
    expect(r.resolvedName).toBe('Sky');
    expect(r.displayName).toBe('Sky');
  });

  it('falls back to Sky when blank', () => {
    const r1 = deriveHomeGreetingName('   ');
    const r2 = deriveHomeGreetingName(undefined);
    expect(r1.resolvedName).toBe('Sky');
    expect(r2.resolvedName).toBe('Sky');
  });

  it('truncates very long names to 13 chars + ellipsis', () => {
    const long = 'Supercalifragilisticexpialidocious';
    const r = deriveHomeGreetingName(long);
    expect(r.displayName.length).toBe(16); // 13 + '...'
    expect(r.displayName.endsWith('...')).toBe(true);
  });
});

describe('isHomeRequestSettled', () => {
  const {
    isHomeRequestSettled,
  } = require('@/features/home/screens/HomeScreen/HomeScreen.helpers');

  it('is settled once the request succeeded', () => {
    expect(isHomeRequestSettled(false, true, undefined)).toBe(true);
  });

  // The #2368 fix. Hydration flags are only set in `.fulfilled`, so before this
  // a rejected fetch was indistinguishable from one still in flight and the
  // full-screen loader waited on it until the 12s escape hatch.
  it('is settled once the request FAILED, even though it never hydrated', () => {
    expect(isHomeRequestSettled(false, false, 'Network Error')).toBe(true);
  });

  it('is not settled while the request is still in flight', () => {
    expect(isHomeRequestSettled(true, false, undefined)).toBe(false);
    expect(isHomeRequestSettled(true, true, undefined)).toBe(false);
    expect(isHomeRequestSettled(true, false, 'Network Error')).toBe(false);
  });

  it('is not settled when it neither succeeded nor failed', () => {
    expect(isHomeRequestSettled(false, false, undefined)).toBe(false);
  });

  it('treats an undefined loading flag as not loading', () => {
    expect(isHomeRequestSettled(undefined, true, undefined)).toBe(true);
  });

  it('treats an empty failure message as no failure', () => {
    expect(isHomeRequestSettled(false, false, '')).toBe(false);
  });
});
