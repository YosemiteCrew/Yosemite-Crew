import {
  validateEmail,
  validatePassword,
  validateStrongPassword,
  validatePasswordConfirmation,
  validateName,
  validatePhone,
  validateRequired,
  validatePositiveNumber,
  validatecompanionAge,
  validatecompanionWeight,
} from '@/shared/utils/validation';

describe('validation utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email', () => {
      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should reject invalid email format', () => {
      const result = validateEmail('invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid email');
    });

    it('should handle whitespace', () => {
      const result = validateEmail('  ');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate correct password', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password is required');
    });

    it('should reject short password', () => {
      const result = validatePassword('12345');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('6 characters');
    });
  });

  describe('validateStrongPassword', () => {
    it('should validate strong password', () => {
      const result = validateStrongPassword('Password123');
      expect(result.isValid).toBe(true);
    });

    it('should reject password without uppercase', () => {
      const result = validateStrongPassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('uppercase');
    });

    it('should reject password without lowercase', () => {
      const result = validateStrongPassword('PASSWORD123');
      expect(result.isValid).toBe(false);
    });

    it('should reject password without number', () => {
      const result = validateStrongPassword('Password');
      expect(result.isValid).toBe(false);
    });

    it('should reject short strong password', () => {
      const result = validateStrongPassword('Pass1');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('8 characters');
    });
  });

  describe('validatePasswordConfirmation', () => {
    it('should validate matching passwords', () => {
      const result = validatePasswordConfirmation('password123', 'password123');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty confirmation', () => {
      const result = validatePasswordConfirmation('password123', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('confirm');
    });

    it('should reject non-matching passwords', () => {
      const result = validatePasswordConfirmation('password123', 'different');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('do not match');
    });
  });

  describe('validateName', () => {
    it('should validate correct name', () => {
      const result = validateName('John Doe');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty name', () => {
      const result = validateName('');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone number', () => {
      const result = validatePhone('1234567890');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty phone', () => {
      const result = validatePhone('');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should validate required field', () => {
      const result = validateRequired('test value', 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty required field', () => {
      const result = validateRequired('', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('validatePositiveNumber', () => {
    it('should validate positive number', () => {
      const result = validatePositiveNumber('5', 'Age');
      expect(result.isValid).toBe(true);
    });

    it('should reject zero', () => {
      const result = validatePositiveNumber('0', 'Weight');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('positive');
    });

    it('should reject negative number', () => {
      const result = validatePositiveNumber('-5', 'Age');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('positive');
    });

    it('should reject non-numeric value', () => {
      const result = validatePositiveNumber('abc', 'Age');
      expect(result.isValid).toBe(false);
    });

    it('should validate decimal positive number', () => {
      const result = validatePositiveNumber('5.5', 'Weight');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validatecompanionAge', () => {
    it('should validate valid age', () => {
      const result = validatecompanionAge('5');
      expect(result.isValid).toBe(true);
    });

    it('should allow empty age (optional)', () => {
      const result = validatecompanionAge('');
      expect(result.isValid).toBe(true);
    });

    it('should allow whitespace (optional)', () => {
      const result = validatecompanionAge('  ');
      expect(result.isValid).toBe(true);
    });

    it('should reject age over 50', () => {
      const result = validatecompanionAge('51');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('unusually high');
    });

    it('should reject zero age', () => {
      const result = validatecompanionAge('0');
      expect(result.isValid).toBe(false);
    });

    it('should reject negative age', () => {
      const result = validatecompanionAge('-5');
      expect(result.isValid).toBe(false);
    });

    it('should accept age exactly 50', () => {
      const result = validatecompanionAge('50');
      expect(result.isValid).toBe(true);
    });

    it('should accept decimal age', () => {
      const result = validatecompanionAge('2.5');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validatecompanionWeight', () => {
    it('should validate valid weight', () => {
      const result = validatecompanionWeight('25');
      expect(result.isValid).toBe(true);
    });

    it('should allow empty weight (optional)', () => {
      const result = validatecompanionWeight('');
      expect(result.isValid).toBe(true);
    });

    it('should allow whitespace (optional)', () => {
      const result = validatecompanionWeight('  ');
      expect(result.isValid).toBe(true);
    });

    it('should reject zero weight', () => {
      const result = validatecompanionWeight('0');
      expect(result.isValid).toBe(false);
    });

    it('should reject negative weight', () => {
      const result = validatecompanionWeight('-5');
      expect(result.isValid).toBe(false);
    });

    it('should accept decimal weight', () => {
      const result = validatecompanionWeight('12.5');
      expect(result.isValid).toBe(true);
    });

    it('should reject non-numeric weight', () => {
      const result = validatecompanionWeight('heavy');
      expect(result.isValid).toBe(false);
    });
  });
});
