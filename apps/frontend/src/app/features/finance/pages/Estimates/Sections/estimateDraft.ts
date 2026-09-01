/**
 * The estimate editor's draft state and its validation.
 *
 * Kept out of the dialog component file so Fast Refresh can preserve component
 * state (a component file that also exports non-components forces a full
 * reload), and so the validation can be tested without rendering anything.
 */

export type DraftLine = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

export const emptyLine = (key: string): DraftLine => ({
  key,
  description: '',
  quantity: '1',
  unitPrice: '',
  taxRate: '0',
});

/** A blank or unparseable numeric field reads as 0 rather than NaN. */
export const toNumber = (raw: string): number => {
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

export type DraftValidation = { ok: true } | { ok: false; message: string };

/** Today as yyyy-mm-dd, for the date input's `min` and for validation. */
export const todayIsoDate = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

/**
 * Validate a draft the way the backend's zod schema does, so the user is told
 * what is wrong before a request is sent rather than reading a flattened zod
 * error afterwards. `items.min(1)`, `description.min(1)`, `quantity.positive()`
 * and `unitPrice.min(0)` all come from CreateEstimateSchema.
 */
export const validateDraft = (
  patientId: string,
  lines: DraftLine[],
  validUntil = '',
  today: string = todayIsoDate()
): DraftValidation => {
  if (!patientId) return { ok: false, message: 'Choose a companion for this estimate.' };
  // Nothing derives EXPIRED from validUntil - not the service, not a job - so a
  // quote dated in the past stays a DRAFT that can still be sent, approved and
  // converted. Refusing it at creation is the only place it is caught.
  if (validUntil && validUntil < today) {
    return { ok: false, message: 'The validity date cannot be in the past.' };
  }
  if (lines.length === 0) return { ok: false, message: 'Add at least one line.' };
  for (const line of lines) {
    const described = line.description.trim();
    if (!described) {
      return { ok: false, message: 'Every line needs a description.' };
    }
    if (toNumber(line.quantity) <= 0) {
      return { ok: false, message: `Quantity for "${described}" must be above zero.` };
    }
    if (toNumber(line.unitPrice) < 0) {
      return { ok: false, message: `Unit price for "${described}" cannot be negative.` };
    }
    const taxRate = toNumber(line.taxRate);
    if (taxRate < 0 || taxRate > 100) {
      return { ok: false, message: `Tax for "${described}" must be between 0 and 100.` };
    }
  }
  return { ok: true };
};

export const inputClass =
  'min-w-0 flex-1 bg-transparent px-3 py-2 text-body-4 text-text-primary outline-none';
export const fieldClass =
  'flex items-stretch overflow-hidden rounded-2xl border border-input-border-default focus-within:border-input-border-active';
