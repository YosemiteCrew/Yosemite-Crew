// src/utils/sanitize.ts
import validator from "validator";

const { escape, stripLow, trim } = validator;

export const sanitizeInput = (value: any): any => {
  if (typeof value === "string") {
    return escape(stripLow(trim(value)));
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }
  if (typeof value === "object" && value !== null) {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      sanitized[key] = sanitizeInput(value[key]);
    }
    return sanitized;
  }
  return value;
};

export function assertSafeString(input: unknown, field: string): string {
  if (typeof input !== "string") {
    throw new Error(`${field} must be a string`);
  }

  if (field === "email") return input;

  // Prevent NoSQL operator injection
  if (input.includes("$") || input.includes(".")) {
    throw new Error(`${field} contains invalid characters`);
  }

  // Optional — restrict allowed characters (tune as needed)
  if (!/^[a-zA-Z0-9@._+-]+$/.test(input)) {
    throw new Error(`${field} contains invalid format`);
  }

  return input;
}

export function assertEmail(input: unknown, field = "email"): string {
  if (typeof input !== "string") {
    throw new Error(`${field} must be a string`);
  }

  if (/^\$/.test(input)) {
    throw new Error(`${field} cannot start with '$'`);
  }

  if (!validator.isEmail(input)) {
    throw new Error(`${field} must be a valid email`);
  }

  return input.trim().toLowerCase();
}
