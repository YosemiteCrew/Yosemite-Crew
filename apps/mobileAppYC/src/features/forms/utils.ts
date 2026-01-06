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

  const signingStatus = submission.signing?.status;
  if (signingRequired) {
    if (signingStatus === 'SIGNED') {
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
    if ('url' in value && (value as any).url) {
      return (value as any).url;
    }
    if (Object.keys(value).length === 0) {
      return '';
    }
    return JSON.stringify(value);
  }
  return value;
};

const sanitizeAnswers = (answers: Record<string, any> | undefined | null): Record<string, any> => {
  if (!answers || typeof answers !== 'object') {
    return {};
  }
  return Object.entries(answers).reduce<Record<string, any>>((acc, [key, val]) => {
    acc[key] = sanitizeAnswerValue(val);
    return acc;
  }, {});
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
    submittedAt: coerceDate(raw?.submittedAt ?? fallback?.submittedAt).toISOString() as any,
    signing: raw?.signing ?? fallback?.signing,
  };

  if (submission.signing?.signedAt) {
    submission.signing = {
      ...submission.signing,
      signedAt: coerceDate(submission.signing.signedAt as any).toISOString() as any,
    };
  }

  return submission;
};

export const resolveFormVersion = (
  form: Form,
  submission?: FormSubmission | null,
): number | undefined => submission?.formVersion ?? (form as any)?.formVersion ?? 1;

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
