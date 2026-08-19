// src/utils/sanitize.ts
import validator from 'validator';

const { escape, stripLow, trim } = validator;

/**
 * Keys that must never be copied from caller-supplied input onto a plain object.
 *
 * `JSON.parse('{"__proto__": {...}}')` produces an OWN property named
 * `__proto__`, and `Object.keys` returns it. Assigning it back onto a `{}`
 * literal invokes the prototype setter rather than creating a property, so a
 * recursive copy that trusts its key list rewrites the prototype of the object
 * it is building. Skipping is preferred over `Object.create(null)` here: the
 * result is handed to callers that expect an ordinary object.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const sanitizeInput = (value: any): any => {
  if (typeof value === 'string') {
    return escape(stripLow(trim(value)));
  }
  if (Array.isArray(value)) {
    return value.map((element) => sanitizeInput(element));
  }
  if (typeof value === 'object' && value !== null) {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      if (UNSAFE_KEYS.has(key)) continue;
      sanitized[key] = sanitizeInput(value[key]);
    }
    return sanitized;
  }
  return value;
};

export function assertSafeString(input: unknown, field: string): string {
  if (typeof input !== 'string') {
    throw new TypeError(`${field} must be a string`);
  }

  if (field === 'email') return input;

  // Prevent NoSQL operator injection
  if (input.includes('$') || input.includes('.')) {
    throw new Error(`${field} contains invalid characters`);
  }

  // Optional — restrict allowed characters (tune as needed)
  if (!/^[a-zA-Z0-9@._+-]+$/.test(input)) {
    throw new Error(`${field} contains invalid format`);
  }

  return input;
}

export function assertEmail(input: unknown, field = 'email'): string {
  if (typeof input !== 'string') {
    throw new TypeError(`${field} must be a string`);
  }

  if (/^\$/.test(input)) {
    throw new Error(`${field} cannot start with '$'`);
  }

  if (!validator.isEmail(input)) {
    throw new Error(`${field} must be a valid email`);
  }

  return input.trim().toLowerCase();
}
