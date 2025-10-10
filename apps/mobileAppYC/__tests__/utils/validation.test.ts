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
  validatePetName,
  validatePetType,
  validatePetAge,
  validatePetWeight,
} from '@/utils/validation';

describe('validation', () => {
  describe('validateEmail', () => {
    it('should return valid for correct email', () => {
      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should return invalid for whitespace only', () => {
      const result = validateEmail('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should return invalid for malformed email', () => {
      const result = validateEmail('notanemail');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should return invalid for email without @', () => {
      const result = validateEmail('test.example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });
  });

  describe('validatePassword', () => {
    it('should return valid for password with 6+ characters', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password is required');
    });

    it('should return invalid for password less than 6 characters', () => {
      const result = validatePassword('12345');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 6 characters long');
    });

    it('should return valid for exactly 6 characters', () => {
      const result = validatePassword('123456');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateStrongPassword', () => {
    it('should return valid for strong password', () => {
      const result = validateStrongPassword('Password123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for empty password', () => {
      const result = validateStrongPassword('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password is required');
    });

    it('should return invalid for password less than 8 characters', () => {
      const result = validateStrongPassword('Pass1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters long');
    });

    it('should return invalid for password without uppercase', () => {
      const result = validateStrongPassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('uppercase letter');
    });

    it('should return invalid for password without lowercase', () => {
      const result = validateStrongPassword('PASSWORD123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('lowercase letter');
    });

    it('should return invalid for password without number', () => {
      const result = validateStrongPassword('PasswordOnly');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('one number');
    });
  });

  describe('validatePasswordConfirmation', () => {
    it('should return valid when passwords match', () => {
      const result = validatePasswordConfirmation('password123', 'password123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid when confirmation is empty', () => {
      const result = validatePasswordConfirmation('password123', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please confirm your password');
    });

    it('should return invalid when passwords do not match', () => {
      const result = validatePasswordConfirmation('password123', 'password456');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Passwords do not match');
    });
  });

  describe('validateName', () => {
    it('should return valid for name with 2+ characters', () => {
      const result = validateName('John');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for empty name', () => {
      const result = validateName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should return invalid for whitespace only', () => {
      const result = validateName('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should return invalid for single character', () => {
      const result = validateName('J');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name must be at least 2 characters long');
    });

    it('should return valid for exactly 2 characters', () => {
      const result = validateName('Jo');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validatePhone', () => {
    it('should return valid for correct phone number', () => {
      const result = validatePhone('+1234567890');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for phone with spaces', () => {
      const result = validatePhone('123 456 7890');
      expect(result.isValid).toBe(true);
    });

    it('should return valid for phone with dashes', () => {
      const result = validatePhone('123-456-7890');
      expect(result.isValid).toBe(true);
    });

    it('should return valid for phone with parentheses', () => {
      const result = validatePhone('(123) 456-7890');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for empty phone', () => {
      const result = validatePhone('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Phone number is required');
    });

    it('should return invalid for phone with letters', () => {
      const result = validatePhone('123abc7890');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid phone number');
    });
  });

  describe('validateRequired', () => {
    it('should return valid for non-empty value', () => {
      const result = validateRequired('test', 'Field');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for empty value', () => {
      const result = validateRequired('', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field is required');
    });

    it('should return invalid for whitespace only', () => {
      const result = validateRequired('   ', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field is required');
    });

    it('should use custom field name in error', () => {
      const result = validateRequired('', 'Username');
      expect(result.error).toBe('Username is required');
    });
  });

  describe('validateMinLength', () => {
    it('should return valid when length meets minimum', () => {
      const result = validateMinLength('hello', 5, 'Field');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid when length exceeds minimum', () => {
      const result = validateMinLength('hello world', 5, 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid when length is below minimum', () => {
      const result = validateMinLength('hi', 5, 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field must be at least 5 characters long');
    });
  });

  describe('validateMaxLength', () => {
    it('should return valid when length is below maximum', () => {
      const result = validateMaxLength('hello', 10, 'Field');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid when length equals maximum', () => {
      const result = validateMaxLength('hello', 5, 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid when length exceeds maximum', () => {
      const result = validateMaxLength('hello world', 5, 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field must be no more than 5 characters long');
    });
  });

  describe('validateNumeric', () => {
    it('should return valid for numeric string', () => {
      const result = validateNumeric('123', 'Field');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for decimal number', () => {
      const result = validateNumeric('123.45', 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should return valid for empty string', () => {
      const result = validateNumeric('', 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for non-numeric string', () => {
      const result = validateNumeric('abc', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field must be a valid number');
    });
  });

  describe('validatePositiveNumber', () => {
    it('should return valid for positive number', () => {
      const result = validatePositiveNumber('10', 'Field');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for decimal positive number', () => {
      const result = validatePositiveNumber('10.5', 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should return valid for empty string', () => {
      const result = validatePositiveNumber('', 'Field');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for zero', () => {
      const result = validatePositiveNumber('0', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field must be a positive number');
    });

    it('should return invalid for negative number', () => {
      const result = validatePositiveNumber('-5', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field must be a positive number');
    });

    it('should return invalid for non-numeric string', () => {
      const result = validatePositiveNumber('abc', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field must be a valid number');
    });
  });

  describe('validatePetName', () => {
    it('should return valid for pet name', () => {
      const result = validatePetName('Buddy');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for empty pet name', () => {
      const result = validatePetName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Pet name is required');
    });
  });

  describe('validatePetType', () => {
    it('should return valid for pet type', () => {
      const result = validatePetType('Dog');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for empty pet type', () => {
      const result = validatePetType('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Pet type is required');
    });
  });

  describe('validatePetAge', () => {
    it('should return valid for normal pet age', () => {
      const result = validatePetAge('5');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for empty age (optional)', () => {
      const result = validatePetAge('');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for age over 50', () => {
      const result = validatePetAge('51');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('unusually high');
    });

    it('should return valid for age exactly 50', () => {
      const result = validatePetAge('50');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for zero age', () => {
      const result = validatePetAge('0');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Age must be a positive number');
    });

    it('should return invalid for negative age', () => {
      const result = validatePetAge('-5');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Age must be a positive number');
    });

    it('should return invalid for non-numeric age', () => {
      const result = validatePetAge('abc');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Age must be a valid number');
    });
  });

  describe('validatePetWeight', () => {
    it('should return valid for positive weight', () => {
      const result = validatePetWeight('15.5');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for empty weight (optional)', () => {
      const result = validatePetWeight('');
      expect(result.isValid).toBe(true);
    });

    it('should return invalid for zero weight', () => {
      const result = validatePetWeight('0');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Weight must be a positive number');
    });

    it('should return invalid for negative weight', () => {
      const result = validatePetWeight('-10');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Weight must be a positive number');
    });

    it('should return invalid for non-numeric weight', () => {
      const result = validatePetWeight('heavy');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Weight must be a valid number');
    });
  });
});
