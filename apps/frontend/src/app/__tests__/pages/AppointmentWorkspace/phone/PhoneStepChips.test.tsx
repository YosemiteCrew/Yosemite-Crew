import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneStepChips from '@/app/features/appointments/pages/AppointmentWorkspace/phone/PhoneStepChips';
import type { StepStatus, WorkspaceStep } from '@/app/features/appointments/types/workspace';

const stepStatus: Record<WorkspaceStep, StepStatus> = {
  SOAP: 'COMPLETED',
  DIAGNOSTICS: 'COMPLETED',
  TREATMENT: 'IN_PROGRESS',
  INVOICE: 'EMPTY',
  SUMMARY: 'EMPTY',
};

describe('PhoneStepChips', () => {
  it('renders all five steps and marks the active one with aria-current', () => {
    render(
      <PhoneStepChips activeStep="TREATMENT" stepStatus={stepStatus} onStepChange={jest.fn()} />
    );
    // Completed chips use the shortened label; active/upcoming use the full label.
    expect(screen.getByText('SOAP')).toBeInTheDocument();
    expect(screen.getByText('Diagn.')).toBeInTheDocument();
    expect(screen.getByText('Invoice')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();

    const active = screen.getByRole('button', { name: 'Treatment' });
    expect(active).toHaveAttribute('aria-current', 'step');
  });

  it('shows the full label for the active step even if it is also completed', () => {
    render(
      <PhoneStepChips activeStep="DIAGNOSTICS" stepStatus={stepStatus} onStepChange={jest.fn()} />
    );
    // Active wins over completed: the full "Diagnostics" label, not "Diagn.".
    expect(screen.getByRole('button', { name: 'Diagnostics' })).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.queryByText('Diagn.')).not.toBeInTheDocument();
  });

  it('navigates when a chip is clicked', () => {
    const onStepChange = jest.fn();
    render(
      <PhoneStepChips activeStep="SOAP" stepStatus={stepStatus} onStepChange={onStepChange} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Invoice' }));
    expect(onStepChange).toHaveBeenCalledWith('INVOICE');
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    expect(onStepChange).toHaveBeenCalledWith('SUMMARY');
  });

  it('re-navigates to the active step when its own chip is tapped', () => {
    const onStepChange = jest.fn();
    render(
      <PhoneStepChips activeStep="TREATMENT" stepStatus={stepStatus} onStepChange={onStepChange} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Treatment' }));
    expect(onStepChange).toHaveBeenCalledWith('TREATMENT');
  });
});
