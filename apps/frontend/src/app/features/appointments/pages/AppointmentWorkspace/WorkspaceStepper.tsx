import React from 'react';
import { IoCheckmarkOutline } from 'react-icons/io5';
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
 * Marker = 16px circle. Completed (non-active) steps are fully filled with the
 * CTA ink and carry a centred white check; the active step keeps the ring with a
 * blue centre dot, and idle steps show a muted `--ink-6b` dot.
 */
const StepMarker = ({ isActive, status }: { isActive: boolean; status: StepStatus }) => {
  const isCompleted = status === 'COMPLETED';

  if (isCompleted && !isActive) {
    return (
      <span
        aria-hidden="true"
        className="flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-150"
        style={{ background: 'var(--cta)', color: 'var(--cta-text)' }}
      >
        <IoCheckmarkOutline size={10} />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center rounded-full border bg-neutral-0 transition-colors duration-150"
      style={{ borderColor: isActive ? 'var(--blue-text)' : 'var(--ink-6b)' }}
    >
      <span
        className="size-2 rounded-full transition-colors duration-150"
        style={{ background: isActive ? 'var(--blue-text)' : 'var(--ink-6b)' }}
      />
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
      // Between two finished steps the design draws a solid rule; the dashed
      // gradient is reserved for the path that is still ahead of the visit.
      const nextStatus = isLast ? undefined : stepStatus[WORKSPACE_STEPS[index + 1]];
      const isConnectorSolid = status === 'COMPLETED' && nextStatus === 'COMPLETED';
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
              className={`text-[13px] leading-[120%] ${isActive ? 'font-bold' : 'font-medium'}`}
              style={{ color: isActive ? 'var(--blue-text)' : 'var(--ink-body)' }}
            >
              {WORKSPACE_STEP_LABELS[step]}
            </span>
          </button>
          {!isLast && (
            <span
              aria-hidden="true"
              className="mx-2 mb-5.5 h-px flex-1 self-center"
              style={
                isConnectorSolid
                  ? { background: 'var(--divider)' }
                  : {
                      backgroundImage:
                        'repeating-linear-gradient(to right, var(--divider) 0 8px, transparent 8px 16px)',
                    }
              }
            />
          )}
        </li>
      );
    })}
  </ol>
);

export default WorkspaceStepper;
