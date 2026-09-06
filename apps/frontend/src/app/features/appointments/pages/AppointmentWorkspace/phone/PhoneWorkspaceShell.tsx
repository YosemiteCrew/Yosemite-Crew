'use client';
import React, { useEffect, useRef } from 'react';
import type { Appointment } from '@yosemite-crew/types';
import type {
  StepStatus,
  Vitals,
  WorkspaceStep,
} from '@/app/features/appointments/types/workspace';
import PhonePatientBar from './PhonePatientBar';
import PhoneStepChips from './PhoneStepChips';
import PhoneVitalsTiles from './PhoneVitalsTiles';
import PhoneWorkspaceActionBar from './PhoneWorkspaceActionBar';

type PhonePrimaryCta = {
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
  icon?: React.ReactNode;
};

type PhoneWorkspaceShellProps = {
  appointment: Appointment;
  companionName: string;
  photoUrl?: string;
  speciesType?: string;
  breed?: string;
  ageLabel?: string;
  weightKg?: number;
  allergy?: string;
  visitStartAt?: string | Date;
  bookedEndAt?: string | Date;
  onBack: () => void;
  activeStep: WorkspaceStep;
  stepStatus: Record<WorkspaceStep, StepStatus>;
  onStepChange: (step: WorkspaceStep) => void;
  vitals: Vitals[];
  primaryCta?: PhonePrimaryCta;
  onAdvance: () => void;
  advanceDisabled?: boolean;
  onRecords: () => void;
  onChat: () => void;
  onMore: () => void;
  chatUnread?: boolean;
  /** The active step component, reused unchanged from the desktop layout. */
  children: React.ReactNode;
};

const latestVitalsOf = (vitals: Vitals[]): Vitals | undefined =>
  vitals.length === 0
    ? undefined
    : [...vitals].sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];

/**
 * Bespoke phone (< 768px) workspace layout. Frames the reused step body between a
 * compact patient bar + horizontal step-chip scroller (top) and a sticky action bar
 * (bottom), with the 3-up vitals tiles above the SOAP step. Rendered only on phone;
 * the desktop/tablet layout is untouched. The shell owns presentation only — every
 * handler, the timer binding, and the step components come from the workspace
 * container unchanged.
 */
const PhoneWorkspaceShell = ({
  appointment,
  companionName,
  photoUrl,
  speciesType,
  breed,
  ageLabel,
  weightKg,
  allergy,
  visitStartAt,
  bookedEndAt,
  onBack,
  activeStep,
  stepStatus,
  onStepChange,
  vitals,
  primaryCta,
  onAdvance,
  advanceDisabled,
  onRecords,
  onChat,
  onMore,
  chatUnread,
  children,
}: PhoneWorkspaceShellProps) => {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Reset the scroll body to the top on step change, mirroring the desktop
  // container's scroll-to-top behaviour (which targets #main-content / window).
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeStep]);

  return (
    // Bleed the workspace route's px-4/py-5 wrapper so the shell runs edge-to-edge,
    // and size it to the space the phone shell leaves between its fixed 54px header
    // and the 72px bottom tab bar (see PhoneShell.css) so the body scrolls internally.
    <div className="-mx-4 -my-5 flex h-[calc(100dvh-54px-max(72px+env(safe-area-inset-bottom,0px),var(--yc-consent-inset,0px)))] min-h-[480px] flex-col bg-(--screen)">
      <PhonePatientBar
        appointment={appointment}
        companionName={companionName}
        photoUrl={photoUrl}
        speciesType={speciesType}
        breed={breed}
        ageLabel={ageLabel}
        weightKg={weightKg}
        allergy={allergy}
        onBack={onBack}
        visitStartAt={visitStartAt}
        bookedEndAt={bookedEndAt}
      />
      <PhoneStepChips activeStep={activeStep} stepStatus={stepStatus} onStepChange={onStepChange} />
      <div
        ref={bodyRef}
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3.5"
      >
        {activeStep === 'SOAP' && (
          <PhoneVitalsTiles weightKg={weightKg} latestVitals={latestVitalsOf(vitals)} />
        )}
        {children}
      </div>
      <PhoneWorkspaceActionBar
        activeStep={activeStep}
        primaryCta={primaryCta}
        onAdvance={onAdvance}
        advanceDisabled={advanceDisabled}
        onRecords={onRecords}
        onChat={onChat}
        onMore={onMore}
        chatUnread={chatUnread}
      />
    </div>
  );
};

export default PhoneWorkspaceShell;
