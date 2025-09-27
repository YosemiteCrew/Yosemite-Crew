import {REGEX_PATTERNS} from './constants';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate email address
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email.trim()) {
    return {isValid: false, error: 'Email is required'};
  }
  
  if (!REGEX_PATTERNS.EMAIL.test(email)) {
    return {isValid: false, error: 'Please enter a valid email address'};
  }
  
  return {isValid: true};
};

/**
 * Validate password
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return {isValid: false, error: 'Password is required'};
  }
  
  if (password.length < 6) {
    return {isValid: false, error: 'Password must be at least 6 characters long'};
  }
  
  return {isValid: true};
};

/**
 * Validate strong password
 */
export const validateStrongPassword = (password: string): ValidationResult => {
  if (!password) {
    return {isValid: false, error: 'Password is required'};
  }
  
  if (password.length < 8) {
    return {isValid: false, error: 'Password must be at least 8 characters long'};
  }
  
  if (!REGEX_PATTERNS.PASSWORD.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    };
  }
  
  return {isValid: true};
};

/**
 * Validate password confirmation
 */
export const validatePasswordConfirmation = (
  password: string,
  confirmPassword: string
): ValidationResult => {
  if (!confirmPassword) {
    return {isValid: false, error: 'Please confirm your password'};
  }
  
  if (password !== confirmPassword) {
    return {isValid: false, error: 'Passwords do not match'};
  }
  
  return {isValid: true};
};

/**
 * Validate name
 */
export const validateName = (name: string): ValidationResult => {
  if (!name.trim()) {
    return {isValid: false, error: 'Name is required'};
  }
  
  if (name.trim().length < 2) {
    return {isValid: false, error: 'Name must be at least 2 characters long'};
  }
  
  return {isValid: true};
};

/**
 * Validate phone number
 */
export const validatePhone = (phone: string): ValidationResult => {
  if (!phone.trim()) {
    return {isValid: false, error: 'Phone number is required'};
  }
  
  if (!REGEX_PATTERNS.PHONE.test(phone)) {
    return {isValid: false, error: 'Please enter a valid phone number'};
  }
  
  return {isValid: true};
};

/**
 * Validate required field
 */
export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  if (!value || !value.trim()) {
    return {isValid: false, error: `${fieldName} is required`};
  }
  
  return {isValid: true};
};

/**
 * Validate minimum length
 */
export const validateMinLength = (
  value: string,
  minLength: number,
  fieldName: string
): ValidationResult => {
  if (value.length < minLength) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${minLength} characters long`,
    };
  }
  
  return {isValid: true};
};

/**
 * Validate maximum length
 */
export const validateMaxLength = (
  value: string,
  maxLength: number,
  fieldName: string
): ValidationResult => {
  if (value.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} must be no more than ${maxLength} characters long`,
    };
  }
  
  return {isValid: true};
};

/**
 * Validate numeric value
 */
export const validateNumeric = (value: string, fieldName: string): ValidationResult => {
  if (!value.trim()) {
    return {isValid: true}; // Allow empty for optional fields
  }
  
  if (isNaN(Number(value))) {
    return {isValid: false, error: `${fieldName} must be a valid number`};
  }
  
  return {isValid: true};
};

/**
 * Validate positive number
 */
export const validatePositiveNumber = (value: string, fieldName: string): ValidationResult => {
  const numericValidation = validateNumeric(value, fieldName);
  if (!numericValidation.isValid) {
    return numericValidation;
  }
  
  if (value.trim() && Number(value) <= 0) {
    return {isValid: false, error: `${fieldName} must be a positive number`};
  }
  
  return {isValid: true};
};

/**
 * Validate pet name
 */
export const validatePetName = (name: string): ValidationResult => {
  return validateRequired(name, 'Pet name');
};

/**
 * Validate pet type
 */
export const validatePetType = (type: string): ValidationResult => {
  return validateRequired(type, 'Pet type');
};

/**
 * Validate pet age
 */
export const validatePetAge = (age: string): ValidationResult => {
  if (!age.trim()) {
    return {isValid: true}; // Age is optional
  }
  
  const numericValidation = validatePositiveNumber(age, 'Age');
  if (!numericValidation.isValid) {
    return numericValidation;
  }
  
  const ageValue = Number(age);
  if (ageValue > 50) {
    return {isValid: false, error: 'Age seems unusually high. Please check the value.'};
  }
  
  return {isValid: true};
};

/**
 * Validate pet weight
 */
export const validatePetWeight = (weight: string): ValidationResult => {
  if (!weight.trim()) {
    return {isValid: true}; // Weight is optional
  }
  
  return validatePositiveNumber(weight, 'Weight');
};