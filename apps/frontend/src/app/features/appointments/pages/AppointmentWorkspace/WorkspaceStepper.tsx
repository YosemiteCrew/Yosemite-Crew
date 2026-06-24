import React from 'react';
import { FaCheck } from 'react-icons/fa6';
import {
  WORKSPACE_STEPS,
  WORKSPACE_STEP_LABELS,
  type StepStatus,
  type WorkspaceStep,
} from '@/app/features/appointments/types/workspace';

type WorkspaceStepperProps = {
  activeStep: WorkspaceStep;
  stepStatus: Record<WorkspaceStep, StepStatus>;
  onStepChange: (step: WorkspaceStep) => void;
};

/**
 * Marker = 16px outer ring + 8px solid centre dot. Active = brand blue, completed
 * shows a check, every other step is neutral-700 (matches the figma stepper where
 * all non-active markers are dark-filled rather than light/idle).
 */
const StepMarker = ({ isActive, status }: { isActive: boolean; status: StepStatus }) => {
  const isCompleted = status === 'COMPLETED';
  const accent = isActive ? 'border-text-brand' : 'border-neutral-700';
  const fill = isActive ? 'bg-text-brand' : 'bg-neutral-700';

  return (
    <span
      aria-hidden="true"
      className={`flex size-4 shrink-0 items-center justify-center rounded-full border bg-neutral-0 transition-colors duration-150 ${accent}`}
    >
      {isCompleted && !isActive ? (
        <span
          className={`flex size-2 items-center justify-center rounded-full text-neutral-0 ${fill}`}
        >
          <FaCheck size={6} />
        </span>
      ) : (
        <span className={`size-2 rounded-full transition-colors duration-150 ${fill}`} />
      )}
    </span>
  );
};

/** Horizontal 5-step progress line. Every step is freely clickable. */
const WorkspaceStepper = ({ activeStep, stepStatus, onStepChange }: WorkspaceStepperProps) => (
  <ol className="flex w-full items-start">
    {WORKSPACE_STEPS.map((step, index) => {
      const isActive = step === activeStep;
      const status = stepStatus[step];
      const isLast = index === WORKSPACE_STEPS.length - 1;
      return (
        <li key={step} className="flex flex-1 items-center last:flex-none">
          <button
            type="button"
            aria-current={isActive ? 'step' : undefined}
            onClick={() => onStepChange(step)}
            className="flex flex-col items-center gap-1.5 focus-visible:outline-none"
          >
            <StepMarker isActive={isActive} status={status} />
            <span
              className={`text-[14px] leading-[120%] ${isActive ? 'font-bold text-text-brand' : 'font-medium text-neutral-900'}`}
            >
              {WORKSPACE_STEP_LABELS[step]}
            </span>
          </button>
          {!isLast && (
            <span
              aria-hidden="true"
              className="mx-2 mb-5.5 h-px flex-1 self-center"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to right, var(--color-neutral-500) 0 8px, transparent 8px 16px)',
              }}
            />
          )}
        </li>
      );
    })}
  </ol>
);

export default WorkspaceStepper;
