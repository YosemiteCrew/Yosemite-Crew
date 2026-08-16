import type {Form, FormField, FormSubmission} from '@yosemite-crew/types';
import {fromFormSubmissionRequestDTO} from '@yosemite-crew/types';
import type {AppointmentFormStatus} from './types';

const coerceDate = (value?: string | Date | null): Date => {
  if (!value) {
    return new Date();
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const safeDate = (value?: string | Date | null): Date | undefined => {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// richtext answers are stored as sanitized HTML (see RichTextRenderer on web)
// so they round-trip through the web WYSIWYG editor unchanged. Mobile has no
// rich-text editor, so we degrade to plain-text editing/display: strip tags
// and re-wrap plain text into simple <p> HTML on save, rather than showing
// raw markup or overwriting formatted content with plain text.
const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export const stripHtmlToPlainText = (html?: string | null): string => {
  if (!html) {
    return '';
  }
  const withNewlines = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li)\s*>/gi, '\n');

  // Strip to a fixed point rather than a single pass: one replace can leave
  // a reconstituted tag behind for malformed/nested markup like
  // "<scr<script>ipt>" (CodeQL: incomplete multi-character sanitization).
  let stripped = withNewlines;
  let previous: string;
  do {
    previous = stripped;
    stripped = stripped.replace(/<[^<>]*>/g, '');
  } while (stripped !== previous);

  return stripped
    .replace(
      /&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g,
      match => HTML_ENTITIES[match],
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

export const wrapPlainTextAsHtml = (text: string): string => {
  // A blank line (or several) has no real content — return '' rather than
  // e.g. "<p></p>", which is a non-empty string that isTruthy()/required
  // validation would wrongly treat as an answer.
  if (!text.trim()) {
    return '';
  }
  return text
    .split('\n')
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');
};

export const hasSignatureField = (fields?: FormField[]): boolean => {
  if (!fields?.length) {
    return false;
  }
  return fields.some(field => {
    if (field.type === 'signature') {
      return true;
    }
    if (field.type === 'group') {
      return hasSignatureField(field.fields);
    }
    return false;
  });
};

export const deriveFormStatus = (
  submission: FormSubmission | null | undefined,
  signingRequired: boolean,
): AppointmentFormStatus => {
  if (!submission) {
    return 'not_started';
  }

  const signing = submission.signing;
  const signingStatus = signing?.status;
  const hasSignedArtifact = Boolean(signing?.signedAt || signing?.pdf?.url);
  if (signingRequired) {
    if (
      signingStatus === 'SIGNED' ||
      String(signingStatus ?? '').toUpperCase() === 'COMPLETED' ||
      hasSignedArtifact
    ) {
      return 'signed';
    }
    if (signingStatus === 'IN_PROGRESS' || signingStatus === 'NOT_STARTED') {
      return 'signing';
    }
    return 'submitted';
  }

  return 'completed';
};

const normalizeFormId = (raw?: any): string => {
  if (!raw) {
    return '';
  }
  if (typeof raw === 'string') {
    return raw;
  }
  if (typeof raw === 'object') {
    if (raw._id) {
      return String(raw._id);
    }
    if (raw.id) {
      return String(raw.id);
    }
    if (typeof raw.toString === 'function') {
      return raw.toString();
    }
  }
  return '';
};

const sanitizeAnswerValue = (value: any): any => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeAnswerValue);
  }
  if (value && typeof value === 'object') {
    if ('url' in value && value.url) {
      return String(value.url);
    }
    if (Object.keys(value).length === 0) {
      return '';
    }
    return JSON.stringify(value);
  }
  return value;
};

const sanitizeAnswers = (
  answers: Record<string, any> | undefined | null,
): Record<string, any> => {
  if (!answers || typeof answers !== 'object') {
    return {};
  }
  return Object.entries(answers).reduce<Record<string, any>>(
    (acc, [key, val]) => {
      acc[key] = sanitizeAnswerValue(val);
      return acc;
    },
    {},
  );
};

export const normalizeSubmissionFromApi = (
  raw: any,
  schema?: FormField[],
  fallback?: Partial<FormSubmission>,
): FormSubmission => {
  if (raw?.resourceType === 'QuestionnaireResponse') {
    const parsed = fromFormSubmissionRequestDTO(raw, schema);
    return {
      ...parsed,
      submittedAt: coerceDate(parsed.submittedAt).toISOString() as any,
    };
  }

  const formId = normalizeFormId(raw?.formId ?? fallback?.formId);
  const submission: FormSubmission = {
    _id: normalizeFormId(raw?._id ?? raw?.id ?? fallback?._id),
    formId,
    formVersion: raw?.formVersion ?? fallback?.formVersion ?? 1,
    appointmentId: raw?.appointmentId ?? fallback?.appointmentId,
    companionId: raw?.companionId ?? fallback?.companionId,
    parentId: raw?.parentId ?? fallback?.parentId,
    submittedBy: raw?.submittedBy ?? fallback?.submittedBy,
    answers: sanitizeAnswers(raw?.answers ?? fallback?.answers ?? {}),
    submittedAt: coerceDate(
      raw?.submittedAt ?? fallback?.submittedAt,
    ).toISOString() as any,
    signing: raw?.signing ?? fallback?.signing,
  };

  if (submission.signing?.signedAt) {
    submission.signing = {
      ...submission.signing,
      signedAt: coerceDate(
        submission.signing.signedAt as any,
      ).toISOString() as any,
    };
  }

  return submission;
};

export const resolveFormVersion = (
  form: Form,
  submission?: FormSubmission | null,
): number | undefined =>
  submission?.formVersion ?? (form as any)?.formVersion ?? 1;

export const normalizeFormForState = (form: Form): Form => {
  const createdAtDate = safeDate(form.createdAt);
  const updatedAtDate = safeDate(form.updatedAt);
  const createdAt = createdAtDate ? createdAtDate.toISOString() : undefined;
  const updatedAt = updatedAtDate ? updatedAtDate.toISOString() : undefined;
  return {
    ...form,
    createdAt: createdAt as any,
    updatedAt: updatedAt as any,
  };
};
