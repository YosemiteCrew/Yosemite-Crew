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
    // Object.fromEntries uses CreateDataProperty, so it can never invoke the
    // `__proto__` setter the way `obj[key] = ...` does. UNSAFE_KEYS still
    // filters first, so the dangerous keys are dropped rather than relocated
    // onto the result as own properties where a downstream Object.assign would
    // re-arm them.
    //
    // Note for reviewers: this also removes the CodeQL sink, and the
    // js/remote-property-injection alert on this line goes quiet because there
    // is no longer a property write, NOT because the Set guard was recognised.
    // A denylist is the wrong polarity for that query and never clears it.
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !UNSAFE_KEYS.has(key))
        .map((key) => [key, sanitizeInput(value[key])])
    );
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
