/* eslint-disable no-useless-escape */
export const API_CONFIG = {
  BASE_URL: __DEV__ ? 'http://localhost:3000/api' : 'https://api.petcare.com',
  TIMEOUT: 10000,
} as const;

export const STORAGE_KEYS = {
  USER_TOKEN: '@petcare/user_token',
  USER_DATA: '@petcare/user_data',
  THEME_MODE: '@petcare/theme_mode',
  LANGUAGE: '@petcare/language',
  ONBOARDING_COMPLETED: '@petcare/onboarding_completed',
} as const;

export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
} as const;

export const PET_TYPES = [
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