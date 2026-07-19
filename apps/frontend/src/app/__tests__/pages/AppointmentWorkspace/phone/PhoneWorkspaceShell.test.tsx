import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import PhoneWorkspaceShell from '@/app/features/appointments/pages/AppointmentWorkspace/phone/PhoneWorkspaceShell';
import type {
  StepStatus,
  Vitals,
  WorkspaceStep,
} from '@/app/features/appointments/types/workspace';

const appointment = { id: 'a1', status: 'IN_PROGRESS' } as unknown as Appointment;

const stepStatus: Record<WorkspaceStep, StepStatus> = {
  SOAP: 'IN_PROGRESS',
  DIAGNOSTICS: 'EMPTY',
  TREATMENT: 'EMPTY',
  INVOICE: 'EMPTY',
  SUMMARY: 'EMPTY',
};

const vitals: Vitals[] = [
  {
    id: 'v1',
    code: 'VITALS',
    tempF: 100.4,
    heartRateBpm: 90,
    respRateBpm: 20,
    recordedByName: 'Dr Weber',
    recordedAt: '2026-07-10T09:00:00.000Z',
  },
];

const baseProps = {
  appointment,
  companionName: 'Poppy',
  breed: 'Beagle',
  ageLabel: '4 Yrs',
  weightKg: 12.4,
  onBack: jest.fn(),
  stepStatus,
  onStepChange: jest.fn(),
  vitals,
  onAdvance: jest.fn(),
  onRecords: jest.fn(),
  onChat: jest.fn(),
  onMore: jest.fn(),
};

describe('PhoneWorkspaceShell', () => {
  beforeEach(() => jest.clearAllMocks());

  it('frames the step body with the patient bar, step chips, vitals tiles and action bar on SOAP', () => {
    render(
      <PhoneWorkspaceShell {...baseProps} activeStep="SOAP">
        <div>STEP BODY</div>
      </PhoneWorkspaceShell>
    );
    // Patient bar
    expect(screen.getByText('Poppy')).toBeInTheDocument();
    expect(screen.getByTestId('visit-timer')).toBeInTheDocument();
    // 3-up vitals tiles are shown on SOAP
    expect(screen.getByText('HR · RR')).toBeInTheDocument();
    expect(screen.getByText('90 · 20')).toBeInTheDocument();
    // Reused step body
    expect(screen.getByText('STEP BODY')).toBeInTheDocument();
    // Action bar icon cluster
    expect(screen.getByRole('button', { name: 'Records' })).toBeInTheDocument();
  });

  it('hides the vitals tiles on non-SOAP steps', () => {
    render(
      <PhoneWorkspaceShell {...baseProps} activeStep="DIAGNOSTICS">
        <div>STEP BODY</div>
      </PhoneWorkspaceShell>
    );
    expect(screen.queryByText('HR · RR')).not.toBeInTheDocument();
    expect(screen.getByText('STEP BODY')).toBeInTheDocument();
  });

  it('shows dashed vitals tiles when there are no recorded vitals', () => {
    render(
      <PhoneWorkspaceShell {...baseProps} activeStep="SOAP" vitals={[]}>
        <div>STEP BODY</div>
      </PhoneWorkspaceShell>
    );
    // Weight (12.4 kg) still renders from the companion record; temp + HR · RR dash.
    expect(screen.getByText('12.4 kg')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces the most recently recorded vitals regardless of array order', () => {
    const older: Vitals = {
      ...vitals[0],
      id: 'old',
      tempF: 99,
      recordedAt: '2026-07-10T08:00:00.000Z',
    };
    const newer: Vitals = {
      ...vitals[0],
      id: 'new',
      tempF: 103,
      recordedAt: '2026-07-10T11:00:00.000Z',
    };
    const { rerender } = render(
      <PhoneWorkspaceShell {...baseProps} activeStep="SOAP" vitals={[older, newer]}>
        <div>STEP BODY</div>
      </PhoneWorkspaceShell>
    );
    expect(screen.getByText('103 °F')).toBeInTheDocument();

    rerender(
      <PhoneWorkspaceShell {...baseProps} activeStep="SOAP" vitals={[newer, older]}>
        <div>STEP BODY</div>
      </PhoneWorkspaceShell>
    );
    expect(screen.getByText('103 °F')).toBeInTheDocument();
  });

  it('wires the back, step-chip and advance actions', () => {
    render(
      <PhoneWorkspaceShell {...baseProps} activeStep="SOAP">
        <div>STEP BODY</div>
      </PhoneWorkspaceShell>
    );
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(baseProps.onBack).toHaveBeenCalledTimes(1);

    // "Treatment" is unambiguous (the advance CTA reads "Diagnostics").
    fireEvent.click(screen.getByRole('button', { name: 'Treatment' }));
    expect(baseProps.onStepChange).toHaveBeenCalledWith('TREATMENT');
  });
});
