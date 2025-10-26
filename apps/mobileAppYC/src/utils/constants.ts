export const STORAGE_KEYS = {
  USER_TOKEN: '@companioncare/user_token',
  USER_DATA: '@companioncare/user_data',
  THEME_MODE: '@companioncare/theme_mode',
  LANGUAGE: '@companioncare/language',
  ONBOARDING_COMPLETED: '@companioncare/onboarding_completed',
} as const;

// Legacy regex patterns - DEPRECATED due to ReDoS vulnerabilities
// Use the validation functions below instead
type SafePattern = {
  test: (value: string) => boolean;
};

const createSafePattern = (validator: (value: string) => boolean): SafePattern => ({
  test: (value: string) => validator(value),
});

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
  if (email.slice(atIndex + 1).includes('@')) {
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
  if (phone.startsWith('+')) {
    index = 1;
  }

  // Must have at least some digits after the optional +
  if (index >= phone.length) {
    return false;
  }

  // Check remaining characters are valid (digits, spaces, hyphens, parentheses)
  let hasDigit = false;
  for (const char of phone.slice(index)) {
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
  const allowedSpecials = new Set(['@', '$', '!', '%', '*', '?', '&']);

  for (const char of password) {
    const code = char.codePointAt(0) ?? 0;

    const isLower = code >= 97 && code <= 122;
    if (isLower) {
      hasLower = true;
      continue;
    }

    const isUpper = code >= 65 && code <= 90;
    if (isUpper) {
      hasUpper = true;
      continue;
    }

    const isDigit = code >= 48 && code <= 57;
    if (isDigit) {
      hasDigit = true;
      continue;
    }

    if (allowedSpecials.has(char)) {
      continue;
    }

    return false; // Invalid character
  }

  return hasLower && hasUpper && hasDigit;
};

export const REGEX_PATTERNS = {
  EMAIL: createSafePattern(isValidEmail),
  PHONE: createSafePattern(isValidPhone),
  PASSWORD: createSafePattern(isValidPassword),
} as const;

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
