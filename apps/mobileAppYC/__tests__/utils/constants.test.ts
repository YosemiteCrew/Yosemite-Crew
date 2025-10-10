import {STORAGE_KEYS, REGEX_PATTERNS, PET_TYPES, COMMON_BREEDS} from '@/utils/constants';

describe('constants', () => {
  describe('STORAGE_KEYS', () => {
    it('should have correct user token key', () => {
      expect(STORAGE_KEYS.USER_TOKEN).toBe('@petcare/user_token');
    });

    it('should have correct user data key', () => {
      expect(STORAGE_KEYS.USER_DATA).toBe('@petcare/user_data');
    });

    it('should have correct theme mode key', () => {
      expect(STORAGE_KEYS.THEME_MODE).toBe('@petcare/theme_mode');
    });

    it('should have correct language key', () => {
      expect(STORAGE_KEYS.LANGUAGE).toBe('@petcare/language');
    });

    it('should have correct onboarding completed key', () => {
      expect(STORAGE_KEYS.ONBOARDING_COMPLETED).toBe('@petcare/onboarding_completed');
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
        expect(REGEX_PATTERNS.PASSWORD.test('Password123')).toBe(true);
        expect(REGEX_PATTERNS.PASSWORD.test('Test1234')).toBe(true);
        expect(REGEX_PATTERNS.PASSWORD.test('MyPass1!')).toBe(true);
      });

      it('should not match weak passwords', () => {
        expect(REGEX_PATTERNS.PASSWORD.test('password')).toBe(false); // no uppercase or number
        expect(REGEX_PATTERNS.PASSWORD.test('PASSWORD')).toBe(false); // no lowercase or number
        expect(REGEX_PATTERNS.PASSWORD.test('12345678')).toBe(false); // no letters
        expect(REGEX_PATTERNS.PASSWORD.test('Pass1')).toBe(false); // too short
      });
    });
  });

  describe('PET_TYPES', () => {
    it('should contain common pet types', () => {
      expect(PET_TYPES).toContain('Dog');
      expect(PET_TYPES).toContain('Cat');
      expect(PET_TYPES).toContain('Bird');
      expect(PET_TYPES).toContain('Fish');
    });

    it('should have expected length', () => {
      expect(PET_TYPES.length).toBe(9);
    });

    it('should be an array', () => {
      expect(Array.isArray(PET_TYPES)).toBe(true);
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
});
