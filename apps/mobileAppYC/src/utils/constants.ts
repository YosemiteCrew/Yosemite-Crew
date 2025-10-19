export const STORAGE_KEYS = {
  USER_TOKEN: '@companioncare/user_token',
  USER_DATA: '@companioncare/user_data',
  THEME_MODE: '@companioncare/theme_mode',
  LANGUAGE: '@companioncare/language',
  ONBOARDING_COMPLETED: '@companioncare/onboarding_completed',
} as const;

// Legacy regex patterns - DEPRECATED due to ReDoS vulnerabilities
// Use the validation functions below instead
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-()]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
} as const;

/**
 * Safe email validation without ReDoS vulnerability
 * Uses string operations instead of complex regex to prevent backtracking attacks
 */
export const isValidEmail = (email: string): boolean => {
  // RFC 5321: max email length is 320 characters
  if (!email || email.length > 320) {
    return false;
  }

  // Check for whitespace
  if (/\s/.test(email)) {
    return false;
  }

  // Find @ symbol - must exist and not be at start or end
  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex === email.length - 1) {
    return false;
  }

  // Ensure only one @ symbol
  if (email.indexOf('@', atIndex + 1) !== -1) {
    return false;
  }

  // RFC 5321: local part (before @) max 64 characters, domain part max 255 characters
  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);
  if (localPart.length > 64 || domainPart.length > 255) {
    return false;
  }

  // Find dot after @ - must exist and not be immediately after @ or at the end
  const dotIndex = domainPart.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === domainPart.length - 1) {
    return false;
  }

  return true;
};

/**
 * Safe phone validation without ReDoS vulnerability
 * Validates phone numbers with optional + prefix and common separators
 */
export const isValidPhone = (phone: string): boolean => {
  if (!phone || phone.length > 20) {
    return false; // Reasonable max length for international numbers
  }

  // Check if starts with optional +
  let index = 0;
  if (phone[0] === '+') {
    index = 1;
  }

  // Must have at least some digits after the optional +
  if (index >= phone.length) {
    return false;
  }

  // Check remaining characters are valid (digits, spaces, hyphens, parentheses)
  let hasDigit = false;
  for (let i = index; i < phone.length; i++) {
    const char = phone[i];
    if (char >= '0' && char <= '9') {
      hasDigit = true;
    } else if (char !== ' ' && char !== '-' && char !== '(' && char !== ')') {
      return false;
    }
  }

  return hasDigit;
};

/**
 * Safe password validation without ReDoS vulnerability
 * Requires: min 8 chars, at least one lowercase, one uppercase, one digit
 */
export const isValidPassword = (password: string): boolean => {
  if (!password || password.length < 8 || password.length > 128) {
    return false; // Reasonable bounds
  }

  let hasLower = false;
  let hasUpper = false;
  let hasDigit = false;

  for (let i = 0; i < password.length; i++) {
    const char = password[i];
    const code = char.charCodeAt(0);

    if (code >= 97 && code <= 122) {
      // a-z
      hasLower = true;
    } else if (code >= 65 && code <= 90) {
      // A-Z
      hasUpper = true;
    } else if (code >= 48 && code <= 57) {
      // 0-9
      hasDigit = true;
    } else {
      // Check if it's an allowed special character
      const allowedSpecials = '@$!%*?&';
      if (!allowedSpecials.includes(char) && (code < 97 || code > 122) && (code < 65 || code > 90) && (code < 48 || code > 57)) {
        return false; // Invalid character
      }
    }
  }

  return hasLower && hasUpper && hasDigit;
};

export const companion_TYPES = [
  'Dog',
  'Cat',
  'Bird',
  'Fish',
  'Rabbit',
  'Hamster',
  'Guinea Pig',
  'Reptile',
  'Other',
] as const;

export const COMMON_BREEDS = {
  Dog: [
    'Labrador Retriever',
    'Golden Retriever',
    'German Shepherd',
    'Bulldog',
    'Poodle',
    'Beagle',
    'Rottweiler',
    'Yorkshire Terrier',
    'Dachshund',
    'Siberian Husky',
  ],
  Cat: [
    'Persian',
    'Maine Coon',
    'British Shorthair',
    'Ragdoll',
    'Bengal',
    'Abyssinian',
    'Birman',
    'Oriental Shorthair',
    'Manx',
    'Russian Blue',
  ],
} as const;