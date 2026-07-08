import React from 'react';
import { IoClose } from 'react-icons/io5';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { CompanionAlert } from '@/app/features/companions/components/AddCompanion/type';
import { ALERT_PRIORITY_CONFIG } from '@/app/features/companions/components/AddCompanion/type';
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
        color: 'var(--color-neutral-700)',
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
      className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold border leading-[1.4]"
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
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold border leading-[1.4]"
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
  mode: ModalMode;
  onGoToAppointment?: () => void;
  hasUnsavedChanges: boolean;
  pendingGoToAppointmentRef: React.RefObject<boolean>;
  setShowDiscardConfirm: (v: boolean) => void;
  setMode: (m: ModalMode) => void;
  setCompanionErrors: (e: Partial<Record<string, string>>) => void;
  setParentErrors: (e: Partial<Record<string, string>>) => void;
};

export const FooterLeft = ({
  mode,
  onGoToAppointment,
  hasUnsavedChanges,
  pendingGoToAppointmentRef,
  setShowDiscardConfirm,
  setMode,
  setCompanionErrors,
  setParentErrors,
}: FooterLeftProps) => {
  if (onGoToAppointment && mode === 'create') {
    return (
      <Secondary
        href="#"
        text="← Go to Appointment"
        onClick={(e) => {
          e?.preventDefault();
          if (hasUnsavedChanges) {
            pendingGoToAppointmentRef.current = true;
            setShowDiscardConfirm(true);
          } else {
            onGoToAppointment();
          }
        }}
      />
    );
  }
  if (mode === 'edit') {
    return (
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
  }
  return <div />;
};
