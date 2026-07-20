import React from 'react';
import classNames from 'classnames';
import { IoCheckmark } from 'react-icons/io5';

import './Progress.css';

export type StepContent = {
  title: string;
  logo: React.ReactNode;
};

type ProgressProps = {
  activeStep: number;
  canSelectStep?: (stepIndex: number) => boolean;
  onStepSelect?: (stepIndex: number) => void;
  steps: StepContent[];
};

type StepState = 'complete' | 'active' | 'upcoming';

const getStepState = (index: number, activeStep: number): StepState => {
  if (index < activeStep) return 'complete';
  if (index === activeStep) return 'active';
  return 'upcoming';
};

// Connector fill: fully blue behind completed steps, half-filled behind the current
// (in-progress) step, empty ahead of it — matching the design's progress track.
const getConnectorFill = (index: number, activeStep: number): string => {
  if (index < activeStep) return '100%';
  if (index === activeStep) return '50%';
  return '0%';
};

const Progress: React.FC<ProgressProps> = ({ activeStep, canSelectStep, onStepSelect, steps }) => {
  return (
    <div className={classNames('yc-steps', { 'is-two-step': steps.length === 2 })}>
      {steps.map((step, index) => {
        const state = getStepState(index, activeStep);
        const clickable = canSelectStep ? canSelectStep(index) : false;
        const isLast = index === steps.length - 1;
        return (
          <div className="yc-step" key={step.title}>
            <button
              type="button"
              className={classNames('yc-step-trigger', `is-${state}`, {
                'is-clickable': clickable,
              })}
              disabled={canSelectStep ? !clickable : false}
              onClick={() => onStepSelect?.(index)}
            >
              <span className={classNames('yc-step-badge', `is-${state}`)}>
                {state === 'complete' ? <IoCheckmark aria-hidden="true" size={18} /> : step.logo}
              </span>
              <span className={classNames('yc-step-label', `is-${state}`)}>{step.title}</span>
            </button>
            {!isLast && (
              <span className="yc-step-connector" aria-hidden="true">
                <span
                  className="yc-step-connector-fill"
                  style={{ width: getConnectorFill(index, activeStep) }}
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Progress;
