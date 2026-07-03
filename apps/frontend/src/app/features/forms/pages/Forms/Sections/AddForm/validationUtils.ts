import { FormField } from '@/app/features/forms/types/forms';
import { isRichTextEmpty } from '@/app/lib/richText';

/**
 * Whether a single answer satisfies a "required" constraint.
 * - richtext: non-empty once stripped of empty markup (`<p></p>`, `&nbsp;`)
 * - checkbox groups (arrays): at least one selection
 * - boolean: treated as a required affirmation (must be true) — the common
 *   intent of marking a yes/no field required (e.g. a consent toggle). Since the
 *   initial value is `false`, an unchecked required boolean is "unanswered".
 * - number: any numeric value counts as answered
 * - text / dropdown / radio / date / signature: a non-empty (trimmed) string
 */
const isAnswered = (field: FormField, value: unknown): boolean => {
  if (field.type === 'richtext') {
    return typeof value === 'string' && !isRichTextEmpty(value);
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value === true;
  if (typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
};

/**
 * Collect the labels of required fields that have no answer, recursing into
 * groups. Used to validate a form-fill before submitting it to the backend so
 * the workspace never persists an incomplete required form.
 */
export const collectMissingRequiredFields = (
  fields: FormField[],
  values: Record<string, unknown>
): string[] => {
  const missing: string[] = [];
  const walk = (items: FormField[]) => {
    items.forEach((field) => {
      if (field.type === 'group') {
        walk(field.fields ?? []);
        return;
      }
      if (field.required && !isAnswered(field, values[field.id])) {
        missing.push(field.label || field.id);
      }
    });
  };
  walk(fields);
  return missing;
};
