import React from 'react';
import classNames from 'classnames';

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

const Progress: React.FC<ProgressProps> = ({ activeStep, canSelectStep, onStepSelect, steps }) => {
  return (
    <div className="steps-container">
      {steps.map((step, index) => (
        <div className="step" key={step.title}>
          <button
            type="button"
            className={classNames('step-info', 'step-trigger', {
              stepclickable: canSelectStep?.(index),
            })}
            disabled={canSelectStep ? !canSelectStep(index) : false}
            onClick={() => onStepSelect?.(index)}
          >
            <div
              className={classNames('step-logo', {
                activestepbackground: activeStep === index,
              })}
            >
              {step.logo}
            </div>
            <div
              className={classNames('step-heading', {
                activestep: activeStep === index,
              })}
            >
              {step.title}
            </div>
          </button>
          {steps.length - 1 !== index && (
            <div
              className={classNames('step-dash', {
                activestepbackground: activeStep === index,
              })}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default Progress;
