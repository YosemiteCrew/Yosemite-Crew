import { formatAuthError } from '@/services/auth/passwordlessAuth';
import { AuthError } from 'aws-amplify/auth';

describe('services/auth/passwordlessAuth formatAuthError', () => {
  test('maps known amplify error names', () => {
    expect(formatAuthError({ name: 'InvalidParameterException' })).toMatch(/invalid/i);
    expect(formatAuthError({ name: 'CodeMismatchException' })).toMatch(/incorrect/i);
    expect(formatAuthError({ name: 'ExpiredCodeException' })).toMatch(/expired/i);
  });

  test('uses amplify message hints', () => {
    expect(formatAuthError({ message: 'Code mismatch' })).toMatch(/incorrect/i);
    expect(formatAuthError({ message: 'token expired' })).toMatch(/expired/i);
  });

  test('AuthError instance returns message', () => {
    const err = new AuthError('Auth broke');
    expect(formatAuthError(err)).toBe('Auth broke');
  });

  test('generic Error returns message', () => {
    const err = new Error('Something bad');
    expect(formatAuthError(err)).toBe('Something bad');
  });

  test('unknown returns fallback', () => {
    expect(formatAuthError(12345)).toMatch(/Unexpected authentication error/i);
  });
});

