import {
  validateEmail,
  validatePassword,
  validateStrongPassword,
  validatePasswordConfirmation,
  validateName,
  validatePhone,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validateNumeric,
  validatePositiveNumber,
  validatecompanionName,
  validatecompanionType,
  validatecompanionAge,
} from '@/utils/validation';

describe('utils/validation', () => {
  test('validateEmail', () => {
    expect(validateEmail('')).toEqual({ isValid: false, error: 'Email is required' });
    expect(validateEmail('bad@')).toEqual({ isValid: false, error: 'Please enter a valid email address' });
    expect(validateEmail('test@example.com')).toEqual({ isValid: true });
  });

  test('validatePassword', () => {
    expect(validatePassword('')).toEqual({ isValid: false, error: 'Password is required' });
    expect(validatePassword('123')).toEqual({ isValid: false, error: 'Password must be at least 6 characters long' });
    expect(validatePassword('123456')).toEqual({ isValid: true });
  });

  test('validateStrongPassword', () => {
    expect(validateStrongPassword('')).toEqual({ isValid: false, error: 'Password is required' });
    expect(validateStrongPassword('Short7')).toEqual({ isValid: false, error: 'Password must be at least 8 characters long' });
    expect(validateStrongPassword('alllowercase1')).toEqual({ isValid: false, error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    expect(validateStrongPassword('ValidPass1')).toEqual({ isValid: true });
  });

  test('validatePasswordConfirmation', () => {
    expect(validatePasswordConfirmation('a', '')).toEqual({ isValid: false, error: 'Please confirm your password' });
    expect(validatePasswordConfirmation('a', 'b')).toEqual({ isValid: false, error: 'Passwords do not match' });
    expect(validatePasswordConfirmation('a', 'a')).toEqual({ isValid: true });
  });

  test('validateName', () => {
    expect(validateName('')).toEqual({ isValid: false, error: 'Name is required' });
    expect(validateName(' A')).toEqual({ isValid: false, error: 'Name must be at least 2 characters long' });
    expect(validateName('Al')).toEqual({ isValid: true });
  });

  test('validatePhone', () => {
    expect(validatePhone('')).toEqual({ isValid: false, error: 'Phone number is required' });
    expect(validatePhone('abc')).toEqual({ isValid: false, error: 'Please enter a valid phone number' });
    expect(validatePhone('+1 (555) 123-4567')).toEqual({ isValid: true });
  });

  test('validateRequired', () => {
    expect(validateRequired('', 'Field')).toEqual({ isValid: false, error: 'Field is required' });
    expect(validateRequired(' x ', 'Field')).toEqual({ isValid: true });
  });

  test('validateMinLength', () => {
    expect(validateMinLength('abc', 5, 'Field')).toEqual({ isValid: false, error: 'Field must be at least 5 characters long' });
    expect(validateMinLength('abcdef', 5, 'Field')).toEqual({ isValid: true });
  });

  test('validateMaxLength', () => {
    expect(validateMaxLength('abcdef', 5, 'Field')).toEqual({ isValid: false, error: 'Field must be no more than 5 characters long' });
    expect(validateMaxLength('abc', 5, 'Field')).toEqual({ isValid: true });
  });

  test('validateNumeric', () => {
    expect(validateNumeric('', 'Age')).toEqual({ isValid: true });
    expect(validateNumeric('abc', 'Age')).toEqual({ isValid: false, error: 'Age must be a valid number' });
    expect(validateNumeric('123', 'Age')).toEqual({ isValid: true });
  });

  test('validatePositiveNumber', () => {
    expect(validatePositiveNumber('-1', 'Age')).toEqual({ isValid: false, error: 'Age must be a positive number' });
    expect(validatePositiveNumber('0', 'Age')).toEqual({ isValid: false, error: 'Age must be a positive number' });
    expect(validatePositiveNumber('2', 'Age')).toEqual({ isValid: true });
  });

  test('validatecompanionName/type/age', () => {
    expect(validatecompanionName('')).toEqual({ isValid: false, error: 'companion name is required' });
    expect(validatecompanionType('')).toEqual({ isValid: false, error: 'companion type is required' });
    expect(validatecompanionAge('')).toEqual({ isValid: true });
    expect(validatecompanionAge('60')).toEqual({ isValid: false, error: 'Age seems unusually high. Please check the value.' });
    expect(validatecompanionAge('10')).toEqual({ isValid: true });
  });
});

