import React, { useId } from 'react';
import { IoArrowForward, IoCameraOutline, IoClose } from 'react-icons/io5';
import { FiCheck } from 'react-icons/fi';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import {
  CompanionAlert,
  ALERT_PRIORITY_CONFIG,
} from '@/app/features/companions/components/AddCompanion/type';
import type { ModalMode } from './addCompanionCentralModalHelpers';

export const SectionHeading = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-2">
    <span className="flex items-center justify-center text-text-primary">{icon}</span>
    <h3
      style={{
        fontFamily: 'var(--font-satoshi), sans-serif',
        fontSize: 16,
        fontWeight: 700,
        lineHeight: '120%',
        letterSpacing: '-0.02em',
        color: 'var(--ink)',
      }}
    >
      {title}
    </h3>
  </div>
);

export const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-2.5 border-t border-card-border first:border-t-0">
    <span className="text-[12px] font-semibold text-text-secondary shrink-0">{label}</span>
    <span className="text-[13px] font-medium text-text-primary text-right">{value || '-'}</span>
  </div>
);

export const AlertChipView = ({ alert }: { alert: CompanionAlert }) => {
  const cfg = ALERT_PRIORITY_CONFIG[alert.priority] ?? ALERT_PRIORITY_CONFIG.medium;
  return (
    <span
      className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[10px] font-bold border leading-[1.4]"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {alert.label}
    </span>
  );
};

export const AlertChipEdit = ({
  alert,
  onRemove,
}: {
  alert: CompanionAlert;
  onRemove: (id: string) => void;
}) => {
  const cfg = ALERT_PRIORITY_CONFIG[alert.priority];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-[10px] font-bold border leading-[1.4]"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {alert.label}
      <button
        type="button"
        aria-label={`Remove alert ${alert.label}`}
        onClick={() => onRemove(alert.id)}
        className="flex items-center justify-center rounded-full size-3.5 hover:opacity-70 transition-opacity"
        style={{ color: cfg.text }}
      >
        <IoClose size={11} />
      </button>
    </span>
  );
};

type FooterLeftProps = {
  setMode: (m: ModalMode) => void;
  setCompanionErrors: (e: Partial<Record<string, string>>) => void;
  setParentErrors: (e: Partial<Record<string, string>>) => void;
};

/**
 * Edit-mode footer left action. The create flow's step nav (including
 * "← Go to Appointment") lives in `AddCompanionWizardFooter`, so this is only
 * ever rendered in edit mode and just offers "Discard changes".
 */
export const FooterLeft = ({ setMode, setCompanionErrors, setParentErrors }: FooterLeftProps) => (
  <Secondary
    href="#"
    text="Discard changes"
    onClick={() => {
      setMode('view');
      setCompanionErrors({});
      setParentErrors({});
    }}
  />
);

// ─── Add-companion wizard primitives (design: 2-step "Add companion" flow) ──────

/** Wizard header: "Step N of 2 · <phase>" subtitle line under the modal title. */
export const WizardStepHeader = ({ step }: { step: 1 | 2 }) => (
  <span
    className="text-[12.5px]"
    style={{ color: 'var(--ink-muted)' }}
    data-testid="add-companion-step-subtitle"
  >
    {step === 1 ? 'Step 1 of 2 · patient details' : 'Step 2 of 2 · parent details'}
  </span>
);

/** Two progress step-dots — the second fills in on step 2. */
export const StepDots = ({ step }: { step: 1 | 2 }) => (
  <span className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
    <span className="h-[5px] w-[22px] rounded-full" style={{ background: 'var(--blue)' }} />
    <span
      className="h-[5px] w-[22px] rounded-full"
      style={{ background: step >= 2 ? 'var(--blue)' : 'var(--divider)' }}
    />
  </span>
);

/** Dashed-circle camera dropzone that reads a chosen image into a data URL. */
export const PhotoDropzone = ({
  photoUrl,
  onPhotoSelected,
  className,
  iconSize = 20,
}: {
  photoUrl?: string;
  onPhotoSelected: (dataUrl: string) => void;
  className?: string;
  iconSize?: number;
}) => {
  const inputId = useId();
  const hasPhoto = Boolean(photoUrl);
  return (
    <label
      htmlFor={inputId}
      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-full border-[1.5px] border-dashed cursor-pointer overflow-hidden shrink-0 ${className ?? 'size-[72px]'}`}
      style={{
        background: 'var(--field-bg)',
        borderColor: 'var(--divider)',
        color: 'var(--ink-faint)',
        backgroundImage: hasPhoto ? `url(${photoUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {!hasPhoto && (
        <>
          <IoCameraOutline size={iconSize} aria-hidden="true" />
          <span className="text-[9px] font-bold tracking-wide">PHOTO</span>
        </>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Upload companion photo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          // One-shot read on a reader created per change event: the single
          // onload slot replaces an addEventListener('load', ...) that had no
          // detach path, so nothing outlives this handler.
          reader.onload = () => {
            if (typeof reader.result === 'string') onPhotoSelected(reader.result);
          };
          reader.readAsDataURL(file);
        }}
      />
    </label>
  );
};

type SexRadioRowProps = {
  gender: string;
  isNeutered: boolean;
  onChange: (gender: string, neutered: boolean) => void;
};

const SexOption = ({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="radio"
      name="companion-sex"
      className="sr-only"
      aria-label={label}
      checked={selected}
      onChange={onSelect}
    />
    <span
      aria-hidden="true"
      className="flex size-[19px] items-center justify-center rounded-full border-2 transition-colors"
      style={{ borderColor: selected ? 'var(--blue)' : 'var(--divider)' }}
    >
      {selected && (
        <span className="size-[9px] rounded-full" style={{ background: 'var(--blue)' }} />
      )}
    </span>
    <span
      className="text-[13px] font-medium"
      style={{ color: selected ? 'var(--ink-body)' : 'var(--ink-muted)' }}
    >
      {label}
    </span>
  </label>
);

/** Male / Female radios + a Neutered checkbox — replaces the combined dropdown. */
export const SexRadioRow = ({ gender, isNeutered, onChange }: SexRadioRowProps) => (
  <div role="radiogroup" aria-label="Sex" className="flex flex-wrap items-center gap-4">
    <span className="text-body-4 text-text-secondary">Sex</span>
    <SexOption
      label="Male"
      selected={gender === 'male'}
      onSelect={() => onChange('male', isNeutered)}
    />
    <SexOption
      label="Female"
      selected={gender === 'female'}
      onSelect={() => onChange('female', isNeutered)}
    />
    <span className="h-[18px] w-px" style={{ background: 'var(--hairline)' }} aria-hidden="true" />
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        className="sr-only"
        aria-label="Neutered"
        checked={isNeutered}
        onChange={(event) => onChange(gender, event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="flex size-[19px] items-center justify-center rounded-md text-white transition-colors"
        style={{
          background: isNeutered ? 'var(--blue)' : 'var(--field-bg)',
          border: isNeutered ? 'none' : '1.5px solid var(--divider)',
        }}
      >
        {isNeutered && <FiCheck size={13} />}
      </span>
      <span
        className="text-[13px] font-medium"
        style={{ color: isNeutered ? 'var(--ink-body)' : 'var(--ink-muted)' }}
      >
        Neutered
      </span>
    </label>
  </div>
);

type WizardFooterProps = {
  step: 1 | 2;
  variant: 'modal' | 'sheet';
  onAdvance: () => void;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onGoToAppointment?: () => void;
  hasUnsavedChanges: boolean;
  pendingGoToAppointmentRef: React.RefObject<boolean>;
  setShowDiscardConfirm: (v: boolean) => void;
};

/** Footer for the add-companion wizard: step-dots on the left, step nav on the right. */
export const AddCompanionWizardFooter = ({
  step,
  variant,
  onAdvance,
  onBack,
  onCancel,
  onSubmit,
  onGoToAppointment,
  hasUnsavedChanges,
  pendingGoToAppointmentRef,
  setShowDiscardConfirm,
}: WizardFooterProps) => {
  const handleGoToAppointment = () => {
    if (hasUnsavedChanges) {
      pendingGoToAppointmentRef.current = true;
      setShowDiscardConfirm(true);
    } else {
      onGoToAppointment?.();
    }
  };

  const leftSecondary = () => {
    if (step === 2) return <Secondary text="← Patient details" onClick={onBack} />;
    if (onGoToAppointment) {
      return <Secondary href="#" text="← Go to Appointment" onClick={handleGoToAppointment} />;
    }
    // The phone sheet closes via its header grabber/X, so it omits an inline Cancel.
    if (variant === 'sheet') return null;
    return <Secondary text="Cancel" onClick={onCancel} />;
  };

  return (
    <div
      className={
        variant === 'sheet'
          ? 'flex w-full items-center gap-3'
          : 'flex w-full flex-wrap items-center gap-3 border-t border-card-border pt-3'
      }
    >
      <StepDots step={step} />
      <div className="flex flex-1 items-center justify-end gap-2.5">
        {leftSecondary()}
        {step === 1 ? (
          <Primary
            text="Parent details"
            icon={<IoArrowForward aria-hidden="true" />}
            iconPosition="right"
            onClick={onAdvance}
          />
        ) : (
          <Primary text="Save Patient Info" icon={<FiCheck size={15} />} onClick={onSubmit} />
        )}
      </div>
    </div>
  );
};
