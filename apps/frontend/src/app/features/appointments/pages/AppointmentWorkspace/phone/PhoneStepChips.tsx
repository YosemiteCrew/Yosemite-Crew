import React from 'react';
import { IoCheckmarkCircle } from 'react-icons/io5';
import {
  WORKSPACE_STEPS,
  WORKSPACE_STEP_LABELS,
  type StepStatus,
  type WorkspaceStep,
} from '@/app/features/appointments/types/workspace';

type PhoneStepChipsProps = {
  activeStep: WorkspaceStep;
  stepStatus: Record<WorkspaceStep, StepStatus>;
  onStepChange: (step: WorkspaceStep) => void;
};

/**
 * Completed chips use a shortened label so more of the row fits before scrolling,
 * matching the design (e.g. "Diagnostics" → "Diagn."). Active/upcoming chips keep
 * the full label.
 */
const SHORT_STEP_LABELS: Record<WorkspaceStep, string> = {
  SOAP: 'SOAP',
  DIAGNOSTICS: 'Diagn.',
  TREATMENT: 'Treat.',
  INVOICE: 'Invoice',
  SUMMARY: 'Summary',
};

const CHIP_BASE =
  'flex shrink-0 snap-start items-center rounded-full text-[11.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--blue)';

/**
 * Horizontal, snap-scrolling step-chip row that replaces the dot/line stepper on
 * phone. Active = blue outline + leading blue dot; completed = hairline pill with a
 * green check and shortened label; upcoming = hairline pill, muted ink. Every chip
 * navigates to its step.
 */
const PhoneStepChips = ({ activeStep, stepStatus, onStepChange }: PhoneStepChipsProps) => (
  <div className="flex flex-none snap-x gap-1.5 overflow-x-auto border-b border-(--hairline) px-3.5 py-2.5 scrollbar-hidden">
    {WORKSPACE_STEPS.map((step) => {
      const isActive = step === activeStep;
      const isCompleted = !isActive && stepStatus[step] === 'COMPLETED';
      if (isActive) {
        return (
          <button
            key={step}
            type="button"
            aria-current="step"
            onClick={() => onStepChange(step)}
            className={`${CHIP_BASE} gap-[5px] border-[1.5px] border-(--blue) bg-(--nav-active-bg) px-3 py-[7px] font-bold text-(--nav-active)`}
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-(--blue)" />
            {WORKSPACE_STEP_LABELS[step]}
          </button>
        );
      }
      return (
        <button
          key={step}
          type="button"
          onClick={() => onStepChange(step)}
          className={`${CHIP_BASE} gap-1 border border-(--hairline) font-semibold text-(--ink-muted) ${
            isCompleted ? 'px-[11px] py-[7px]' : 'px-3 py-[7px]'
          }`}
        >
          {isCompleted && (
            <IoCheckmarkCircle size={12} aria-hidden="true" className="text-(--success)" />
          )}
          {isCompleted ? SHORT_STEP_LABELS[step] : WORKSPACE_STEP_LABELS[step]}
        </button>
      );
    })}
  </div>
);

export default PhoneStepChips;
