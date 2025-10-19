import 'react-native-get-random-values';
import {Dimensions, Platform} from 'react-native';

/**
 * Device dimensions
 */
export const screenWidth = Dimensions.get('window').width;
export const screenHeight = Dimensions.get('window').height;

/**
 * Platform checks
 */
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

/**
 * Format date to readable string
 */
export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Calculates the current age in full years from a given date of birth.
 * @param dateOfBirth The Date object or a date string representing the birth date.
 * @returns The age in full years (number).
 */
export const calculateAgeFromDateOfBirth = (dateOfBirth: Date | string): number => {
  // Ensure we are working with a Date object
  const dob = new Date(dateOfBirth);
  const today = new Date();

  // Calculate the difference in years
  let age = today.getFullYear() - dob.getFullYear();

  // Adjust age if the birthday hasn't occurred yet this year
  const monthDifference = today.getMonth() - dob.getMonth();
  
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dob.getDate())
  ) {
    age--;
  }

  // Ensure age is not negative (e.g., if future date is somehow passed)
  return Math.max(0, age);
};

/**
 * Format date to short string
 */
export const formatDateShort = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Calculate age from birth date
 */
export const calculateAge = (birthDate: string | Date): number => {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Capitalize first letter of string
 */
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Format weight with unit
 */
export const formatWeight = (weight: number, unit: 'kg' | 'lbs' = 'kg'): string => {
  return `${weight} ${unit}`;
};

/**
 * Generate random avatar URL
 */
export const generateAvatarUrl = (seed?: string): string => {
  const seedParam = seed ? `?seed=${seed}` : `?random=${Date.now()}`;
  return `https://picsum.photos/200/200${seedParam}`;
};

/**
 * Validate email format (safe from ReDoS attacks)
 * Uses string operations instead of complex regex to prevent backtracking
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

  // Find dot after @ - must exist and not be immediately after @ or at the end
  const domainPart = email.slice(atIndex + 1);

  // Check if domain starts with a dot or ends with a dot
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
    return false;
  }

  // Must have at least one dot in domain
  if (!domainPart.includes('.')) {
    return false;
  }

  return true;
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait) as unknown as number;
  };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Generate unique ID
 */
export const generateId = (): string => {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  if (!cryptoObj?.getRandomValues) {
    throw new Error('Secure random number generator is unavailable');
  }
  const buffer = new Uint8Array(16);
  cryptoObj.getRandomValues(buffer);
  const hex = Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
};

/**
 * Sleep/delay function
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Check if string is empty or only whitespace
 */
export const isEmpty = (str: string): boolean => {
  return !str || str.trim().length === 0;
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Format number with commas (safe from ReDoS attacks)
 * Uses string manipulation instead of complex lookahead regex
 */
export const formatNumber = (num: number): string => {
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Handle negative numbers
  const isNegative = integerPart.startsWith('-');
  const absoluteInteger = isNegative ? integerPart.slice(1) : integerPart;

  // Add commas from right to left
  let formatted = '';
  for (let i = absoluteInteger.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) {
      formatted = ',' + formatted;
    }
    formatted = absoluteInteger[i] + formatted;
  }

  // Reconstruct the number
  if (isNegative) {
    formatted = '-' + formatted;
  }

  if (decimalPart !== undefined) {
    formatted += '.' + decimalPart;
  }

  return formatted;
};

/**
 * Get initials from name
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};
