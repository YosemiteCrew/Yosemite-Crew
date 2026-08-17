'use client';
import React, { useCallback, useState } from 'react';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { Primary } from '@/app/ui/primitives/Buttons';
import { getPassportErrorMessage } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportErrorMessage';
import {
  hasFieldErrors,
  type FieldErrors,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportFieldValidation';

const SAVE_FAILED_MESSAGE = 'Unable to save this record. Please try again.';

export type PassportCaptureFormOptions<TDraft, TPayload> = {
  initialDraft: TDraft;
  validate: (draft: TDraft) => FieldErrors;
  buildPayload: (draft: TDraft) => TPayload;
  onSubmit: (payload: TPayload) => Promise<void>;
};

/**
 * Every passport form runs the same transaction - edit an all-string draft,
 * validate it with the backend's own rules, post it, and either clear the form
 * or show the server's rejection - so the behaviour lives here once and each
 * form supplies only its fields, validator and payload builder.
 */
export const usePassportCaptureForm = <TDraft extends Record<string, string>, TPayload>({
  initialDraft,
  validate,
  buildPayload,
  onSubmit,
}: PassportCaptureFormOptions<TDraft, TPayload>) => {
  const [draft, setDraft] = useState<TDraft>(initialDraft);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setField = useCallback((key: Extract<keyof TDraft, string>, value: string) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    // Correcting a field clears its message rather than leaving a stale one.
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }, []);

  // Fire-and-settle rather than async: the caller is a click handler, and every
  // outcome is already rendered through `isSaving` / `submitError`.
  const handleSubmit = useCallback(() => {
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    if (hasFieldErrors(nextErrors)) return;
    setIsSaving(true);
    setSubmitError(null);
    onSubmit(buildPayload(draft))
      .then(() => setDraft(initialDraft))
      .catch((error: unknown) => {
        setSubmitError(getPassportErrorMessage(error, SAVE_FAILED_MESSAGE));
      })
      .finally(() => setIsSaving(false));
  }, [buildPayload, draft, initialDraft, onSubmit, validate]);

  return { draft, errors, isSaving, submitError, setField, handleSubmit };
};

export type PassportFormFooterProps = {
  submitLabel: string;
  isSaving: boolean;
  submitError: string | null;
  onSubmit: () => void;
};

/** Save row shared by the capture forms and the issuance form. */
export const PassportFormFooter = ({
  submitLabel,
  isSaving,
  submitError,
  onSubmit,
}: PassportFormFooterProps) => (
  <>
    {submitError && (
      <p role="alert" className="text-caption-1 text-danger-600">
        {submitError}
      </p>
    )}
    <div className="flex justify-end">
      <Primary
        text={isSaving ? 'Saving...' : submitLabel}
        onClick={onSubmit}
        isDisabled={isSaving}
        size="small"
      />
    </div>
  </>
);

export type PassportFormShellProps = PassportFormFooterProps & {
  title: string;
  description: string;
  children: React.ReactNode;
};

export const PassportFormShell = ({
  title,
  description,
  submitLabel,
  isSaving,
  submitError,
  onSubmit,
  children,
}: PassportFormShellProps) => (
  <SectionContainer title={title}>
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] leading-[140%] text-(--ink-muted)">{description}</p>
      {children}
      <PassportFormFooter
        submitLabel={submitLabel}
        isSaving={isSaving}
        submitError={submitError}
        onSubmit={onSubmit}
      />
    </div>
  </SectionContainer>
);

export type DraftFieldSpec<TDraft> = {
  key: Extract<keyof TDraft, string>;
  label: string;
  /** Defaults to `text`. Date fields use the native pickers so the value the
   *  clinician produces is already an unambiguous ISO calendar date. */
  type?: 'text' | 'date' | 'datetime-local' | 'number' | 'url';
};

type DraftFieldsProps<TDraft extends Record<string, string>> = {
  specs: ReadonlyArray<DraftFieldSpec<TDraft>>;
  draft: TDraft;
  errors: FieldErrors;
  onChange: (key: Extract<keyof TDraft, string>, value: string) => void;
};

export function DraftFields<TDraft extends Record<string, string>>({
  specs,
  draft,
  errors,
  onChange,
}: Readonly<DraftFieldsProps<TDraft>>) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {specs.map((spec) => (
        <FormInput
          key={spec.key}
          intype={spec.type ?? 'text'}
          inlabel={spec.label}
          value={draft[spec.key]}
          error={errors[spec.key]}
          onChange={(event) => onChange(spec.key, event.target.value)}
        />
      ))}
    </div>
  );
}

export type NotesFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export const NotesField = ({ label, value, onChange }: NotesFieldProps) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[12.5px] font-semibold text-(--ink-soft)">{label}</span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      rows={3}
      className="rounded-[12px] border-[1.5px] border-(--hairline) bg-(--field-bg) px-[14px] py-2.5 text-[14px] text-(--ink-body) outline-none focus:border-(--blue)"
    />
  </label>
);
