import {
  STORAGE_KEYS,
  REGEX_PATTERNS,
  companion_TYPES,
  COMMON_BREEDS,
  isValidEmail,
  isValidPhone,
  isValidPassword,
} from '@/utils/constants';

describe('constants', () => {
  describe('STORAGE_KEYS', () => {
    it('should have correct user token key', () => {
      expect(STORAGE_KEYS.USER_TOKEN).toBe('@companioncare/user_token');
    });

    it('should have correct user data key', () => {
      expect(STORAGE_KEYS.USER_DATA).toBe('@companioncare/user_data');
    });

    it('should have correct theme mode key', () => {
      expect(STORAGE_KEYS.THEME_MODE).toBe('@companioncare/theme_mode');
    });

    it('should have correct language key', () => {
      expect(STORAGE_KEYS.LANGUAGE).toBe('@companioncare/language');
    });

    it('should have correct onboarding completed key', () => {
      expect(STORAGE_KEYS.ONBOARDING_COMPLETED).toBe('@companioncare/onboarding_completed');
    });
  });

  describe('REGEX_PATTERNS', () => {
    describe('EMAIL pattern', () => {
      it('should match valid emails', () => {
        expect(REGEX_PATTERNS.EMAIL.test('test@example.com')).toBe(true);
        expect(REGEX_PATTERNS.EMAIL.test('user.name@domain.co')).toBe(true);
        expect(REGEX_PATTERNS.EMAIL.test('test123@test-domain.com')).toBe(true);
      });

      it('should not match invalid emails', () => {
        expect(REGEX_PATTERNS.EMAIL.test('notanemail')).toBe(false);
        expect(REGEX_PATTERNS.EMAIL.test('missing@domain')).toBe(false);
        expect(REGEX_PATTERNS.EMAIL.test('@nodomain.com')).toBe(false);
      });
    });

    describe('PHONE pattern', () => {
      it('should match valid phone numbers', () => {
        expect(REGEX_PATTERNS.PHONE.test('+1234567890')).toBe(true);
        expect(REGEX_PATTERNS.PHONE.test('123-456-7890')).toBe(true);
        expect(REGEX_PATTERNS.PHONE.test('(123) 456-7890')).toBe(true);
        expect(REGEX_PATTERNS.PHONE.test('123 456 7890')).toBe(true);
      });

      it('should not match invalid phone numbers', () => {
        expect(REGEX_PATTERNS.PHONE.test('abc')).toBe(false);
        expect(REGEX_PATTERNS.PHONE.test('123abc456')).toBe(false);
      });
    });

    describe('PASSWORD pattern', () => {
      it('should match strong passwords', () => {
        expect(REGEX_PATTERNS.PASSWORD.test('TestPass123')).toBe(true);
        expect(REGEX_PATTERNS.PASSWORD.test('Example1234')).toBe(true);
        expect(REGEX_PATTERNS.PASSWORD.test('ValidPass1!')).toBe(true);
      });

      it('should not match weak passwords', () => {
        expect(REGEX_PATTERNS.PASSWORD.test('password')).toBe(false); // no uppercase or number
        expect(REGEX_PATTERNS.PASSWORD.test('PASSWORD')).toBe(false); // no lowercase or number
        expect(REGEX_PATTERNS.PASSWORD.test('12345678')).toBe(false); // no letters
        expect(REGEX_PATTERNS.PASSWORD.test('Pass1')).toBe(false); // too short
      });
    });
  });

  describe('companion_TYPES', () => {
    it('should contain common companion types', () => {
      expect(companion_TYPES).toContain('Dog');
      expect(companion_TYPES).toContain('Cat');
      expect(companion_TYPES).toContain('Bird');
      expect(companion_TYPES).toContain('Fish');
    });

    it('should have expected length', () => {
      expect(companion_TYPES.length).toBe(9);
    });

    it('should be an array', () => {
      expect(Array.isArray(companion_TYPES)).toBe(true);
    });
  });

  describe('COMMON_BREEDS', () => {
    describe('Dog breeds', () => {
      it('should contain common dog breeds', () => {
        expect(COMMON_BREEDS.Dog).toContain('Labrador Retriever');
        expect(COMMON_BREEDS.Dog).toContain('Golden Retriever');
        expect(COMMON_BREEDS.Dog).toContain('German Shepherd');
      });

      it('should have 10 breeds', () => {
        expect(COMMON_BREEDS.Dog.length).toBe(10);
      });
    });

    describe('Cat breeds', () => {
      it('should contain common cat breeds', () => {
        expect(COMMON_BREEDS.Cat).toContain('Persian');
        expect(COMMON_BREEDS.Cat).toContain('Maine Coon');
        expect(COMMON_BREEDS.Cat).toContain('British Shorthair');
      });

      it('should have 10 breeds', () => {
        expect(COMMON_BREEDS.Cat.length).toBe(10);
      });
    });

    it('should only have Dog and Cat breeds', () => {
      expect(Object.keys(COMMON_BREEDS)).toEqual(['Dog', 'Cat']);
    });
  });

  describe('Safe validation functions', () => {
    describe('isValidEmail', () => {
      it('should validate correct emails', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co')).toBe(true);
        expect(isValidEmail('test123@test-domain.com')).toBe(true);
      });

      it('should reject invalid emails', () => {
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('notanemail')).toBe(false);
        expect(isValidEmail('missing@domain')).toBe(false);
        expect(isValidEmail('@nodomain.com')).toBe(false);
        expect(isValidEmail('test @example.com')).toBe(false);
        expect(isValidEmail('test@@example.com')).toBe(false);
      });

      it('should reject emails that are too long', () => {
        const longEmail = 'a'.repeat(300) + '@example.com';
        expect(isValidEmail(longEmail)).toBe(false);
      });
    });

    describe('isValidPhone', () => {
      it('should validate correct phone numbers', () => {
        expect(isValidPhone('+1234567890')).toBe(true);
        expect(isValidPhone('123-456-7890')).toBe(true);
        expect(isValidPhone('(123) 456-7890')).toBe(true);
        expect(isValidPhone('123 456 7890')).toBe(true);
      });

      it('should reject invalid phone numbers', () => {
        expect(isValidPhone('')).toBe(false);
        expect(isValidPhone('abc')).toBe(false);
        expect(isValidPhone('123abc456')).toBe(false);
        expect(isValidPhone('+')).toBe(false);
      });

      it('should reject phone numbers that are too long', () => {
        expect(isValidPhone('1'.repeat(30))).toBe(false);
      });
    });

    describe('isValidPassword', () => {
      it('should validate strong passwords', () => {
        expect(isValidPassword('TestPass123')).toBe(true);
        expect(isValidPassword('Example1234')).toBe(true);
        expect(isValidPassword('ValidPass1!')).toBe(true);
      });

      it('should reject weak passwords', () => {
        expect(isValidPassword('')).toBe(false);
        expect(isValidPassword('password')).toBe(false); // no uppercase or number
        expect(isValidPassword('PASSWORD')).toBe(false); // no lowercase or number
        expect(isValidPassword('12345678')).toBe(false); // no letters
        expect(isValidPassword('Pass1')).toBe(false); // too short
      });

      it('should reject passwords that are too long', () => {
        const longPassword = 'Test1' + 'a'.repeat(130);
        expect(isValidPassword(longPassword)).toBe(false);
      });

      it('should reject passwords with invalid special characters', () => {
        expect(isValidPassword('TestPass123#')).toBe(false); // # not allowed
        expect(isValidPassword('TestPass123^')).toBe(false); // ^ not allowed
      });
    });
  });
});
