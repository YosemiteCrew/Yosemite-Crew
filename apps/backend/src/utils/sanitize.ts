// src/utils/sanitize.ts
import { escape, trim, stripLow } from 'validator';

export const sanitizeInput = (value: any): any => {
  if (typeof value === 'string') {
    return escape(stripLow(trim(value)));
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }
  if (typeof value === 'object' && value !== null) {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      sanitized[key] = sanitizeInput(value[key]);
    }
    return sanitized;
  }
  return value;
};
