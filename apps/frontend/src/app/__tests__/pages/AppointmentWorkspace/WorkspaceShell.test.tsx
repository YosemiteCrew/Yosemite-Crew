import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import ReadyToggle from '@/app/features/appointments/pages/AppointmentWorkspace/components/ReadyToggle';
import AlertPill from '@/app/features/appointments/pages/AppointmentWorkspace/components/AlertPill';
import WorkspaceStepper from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceStepper';
import WorkspaceHeader from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceHeader';
import CompanionContextCard from '@/app/features/appointments/pages/AppointmentWorkspace/CompanionContextCard';
import WorkspaceMetaBar from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceMetaBar';
import { buildEmptyEncounter } from '@/app/features/appointments/services/workspaceInitialData';
import type { StepStatus, WorkspaceStep } from '@/app/features/appointments/types/workspace';
import type { Appointment } from '@yosemite-crew/types';

expect.extend(toHaveNoViolations);

const headerAppointment = {
  id: 'appt-1',
  status: 'COMPLETED',
  companion: { id: 'c1', name: 'Gigi', species: 'Canine', parent: { id: 'p1', name: 'Rachel' } },
} as unknown as Appointment;

const stepStatus: Record<WorkspaceStep, StepStatus> = {
  SOAP: 'COMPLETED',
  DIAGNOSTICS: 'IN_PROGRESS',
  TREATMENT: 'EMPTY',
  INVOICE: 'EMPTY',
  SUMMARY: 'EMPTY',
};

describe('ReadyToggle', () => {
  it('renders unselected and toggles', () => {
    const onToggle = jest.fn();
    render(<ReadyToggle label="Ready for Billing" state={{ value: false }} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /ready for billing/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
  });

  it('renders the green stamp with name and timestamp when selected', () => {
    render(
      <ReadyToggle
        label="Ready for Discharge"
        state={{ value: true, byName: 'Dr Tim', at: new Date().toISOString() }}
        onToggle={jest.fn()}
      />
    );
    expect(screen.getByText('By Dr Tim')).toBeInTheDocument();
    expect(screen.getByText(/Today,/)).toBeInTheDocument();
  });

  it('renders the timestamp when the backend does not include an actor name', () => {
    render(
      <ReadyToggle
        label="Ready for Billing"
        state={{ value: true, at: '2026-06-18T11:05:00.000Z' }}
        onToggle={jest.fn()}
      />
    );
    expect(screen.getByText('By Clinical team')).toBeInTheDocument();
    expect(screen.getByText(/Jun 18,/)).toBeInTheDocument();
  });

  it('does not toggle when disabled', () => {
    const onToggle = jest.fn();
    render(
      <ReadyToggle
        label="Ready for Billing"
        state={{ value: false }}
        disabled
        onToggle={onToggle}
      />
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('AlertPill', () => {
  it('renders the label', () => {
    render(<AlertPill label="Needs muzzle" severity="high" />);
    expect(screen.getByText('Needs muzzle')).toBeInTheDocument();
  });
});

describe('WorkspaceStepper', () => {
  it('renders all five steps and changes step on click', () => {
    const onStepChange = jest.fn();
    render(
      <WorkspaceStepper
        activeStep="DIAGNOSTICS"
        stepStatus={stepStatus}
        onStepChange={onStepChange}
      />
    );
    expect(screen.getByText('SOAP Notes')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Treatment'));
    expect(onStepChange).toHaveBeenCalledWith('TREATMENT');
  });
});

describe('WorkspaceHeader', () => {
  it('renders title, alerts and fires actions', () => {
    const onBack = jest.fn();
    const onQuickActions = jest.fn();
    render(
      <WorkspaceHeader
        appointment={headerAppointment}
        companionName="Gigi Hadid"
        alerts={[{ id: '1', label: 'Needs muzzle', severity: 'high' }]}
        onBack={onBack}
        onQuickActions={onQuickActions}
      />
    );
    // Title uses the companion's first name only.
    expect(screen.getByText(/Gigi’s Appointment/)).toBeInTheDocument();
    expect(screen.getByText('Needs muzzle')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-alert-strip')).toHaveClass('overflow-x-auto');
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    fireEvent.click(screen.getByRole('button', { name: /quick actions/i }));
    expect(onBack).toHaveBeenCalled();
    expect(onQuickActions).toHaveBeenCalled();
  });

  it('surfaces client (parent) alerts as read-only Client-labelled pills', () => {
    render(
      <WorkspaceHeader
        appointment={headerAppointment}
        companionName="Gigi Hadid"
        alerts={[{ id: 'p1', label: 'Needs muzzle', severity: 'high' }]}
        clientAlerts={[{ id: 'c1', label: 'Aggressive owner', severity: 'critical' }]}
        onBack={jest.fn()}
        onQuickActions={jest.fn()}
      />
    );
    expect(screen.getByText('Needs muzzle')).toBeInTheDocument();
    expect(screen.getByText('Client: Aggressive owner')).toBeInTheDocument();
  });

  it('fires the add-alert action when provided', () => {
    const onAddAlert = jest.fn();
    render(
      <WorkspaceHeader
        appointment={headerAppointment}
        companionName="Gigi Hadid"
        alerts={[]}
        onBack={jest.fn()}
        onQuickActions={jest.fn()}
        onAddAlert={onAddAlert}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
    expect(onAddAlert).toHaveBeenCalled();
  });

  it('shows the patient alert tooltip on hover', async () => {
    render(
      <WorkspaceHeader
        appointment={headerAppointment}
        companionName="Gigi Hadid"
        alerts={[]}
        onBack={jest.fn()}
        onQuickActions={jest.fn()}
        onAddAlert={jest.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /add alert/i }).closest('.glass-tooltip');
    expect(trigger).not.toBeNull();
    fireEvent.mouseEnter(trigger as Element);

    expect(await screen.findByText('Add alerts for companion')).toBeInTheDocument();
  });

  it('omits the add-alert button when no handler is provided', () => {
    render(
      <WorkspaceHeader
        appointment={headerAppointment}
        companionName="Gigi"
        alerts={[]}
        onBack={jest.fn()}
        onQuickActions={jest.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /add alert/i })).not.toBeInTheDocument();
  });

  it('shows the Emergency badge only for emergency appointments', () => {
    const { rerender } = render(
      <WorkspaceHeader
        appointment={headerAppointment}
        companionName="Gigi"
        alerts={[]}
        onBack={jest.fn()}
        onQuickActions={jest.fn()}
      />
    );
    expect(screen.queryByText('Emergency')).not.toBeInTheDocument();

    rerender(
      <WorkspaceHeader
        appointment={{ ...headerAppointment, isEmergency: true } as typeof headerAppointment}
        companionName="Gigi"
        alerts={[]}
        onBack={jest.fn()}
        onQuickActions={jest.fn()}
      />
    );
    expect(screen.getByText('Emergency')).toBeInTheDocument();
  });
});

describe('CompanionContextCard', () => {
  const details = [
    { label: 'Name', value: 'Gigi Hadid' },
    { label: 'Patient ID', value: 'PT-48291' },
  ];

  it('renders details and view-details action', () => {
    const onViewDetails = jest.fn();
    render(
      <CompanionContextCard
        name="Gigi"
        details={details}
        mode="OUTPATIENT"
        onViewDetails={onViewDetails}
      />
    );
    expect(screen.getByText('PT-48291')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(onViewDetails).toHaveBeenCalled();
  });

  it('renders the inpatient mode pill', () => {
    render(<CompanionContextCard name="Gigi" details={details} mode="INPATIENT" />);
    expect(screen.getByText('Inpatient')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <CompanionContextCard name="Gigi" details={details} mode="OUTPATIENT" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ReadyToggle stamp formatting', () => {
  it('formats a non-today timestamp as month/day', () => {
    render(
      <ReadyToggle
        label="Ready for Billing"
        state={{ value: true, byName: 'A', at: '2020-06-15T12:00:00Z' }}
        onToggle={jest.fn()}
      />
    );
    expect(screen.getByText('By A')).toBeInTheDocument();
    // A past date is rendered as "<Mon> <day>, <time>" — not the "Today," form.
    expect(screen.getByText(/Jun 15,/)).toBeInTheDocument();
    expect(screen.queryByText(/Today,/)).not.toBeInTheDocument();
  });

  it('ignores an invalid timestamp', () => {
    render(
      <ReadyToggle
        label="Ready for Billing"
        state={{ value: true, byName: 'A', at: 'nope' }}
        onToggle={jest.fn()}
      />
    );
    expect(screen.getByText('By A')).toBeInTheDocument();
  });
});

describe('WorkspaceMetaBar', () => {
  const baseProps = (mode: 'OUTPATIENT' | 'INPATIENT') => ({
    encounter: buildEmptyEncounter('a1', mode),
    activeStep: 'SOAP' as WorkspaceStep,
    roomOptions: [{ label: 'Room 1', value: 'room-1' }],
    unitOptions: [{ label: '24', value: 'unit-24' }],
    onSelectRoom: jest.fn(),
    onSelectUnit: jest.fn(),
    onSaveAndNext: jest.fn(),
    onToggleReadyForBilling: jest.fn(),
    onToggleReadyForDischarge: jest.fn(),
    billingTogglesLocked: false,
    dischargeTogglesLocked: false,
  });

  it('renders consultation type for outpatient and fires Save & Next', () => {
    const props = baseProps('OUTPATIENT');
    render(<WorkspaceMetaBar {...props} />);
    expect(screen.getByText('Ready for Billing')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Diagnostics'));
    expect(props.onSaveAndNext).toHaveBeenCalled();
  });

  it('shows the consultation type as a read-only field (changed via hospitalization flow)', () => {
    const props = baseProps('OUTPATIENT');
    render(<WorkspaceMetaBar {...props} />);
    expect(screen.getByText('Consultation type')).toBeInTheDocument();
    expect(screen.getByText('Outpatient')).toBeInTheDocument();
    // No editable mode control — the value is set through the hospitalization modal.
    expect(screen.queryByRole('button', { name: /consultation type/i })).not.toBeInTheDocument();
  });

  it('renders room and unit dropdowns for inpatient', () => {
    const props = baseProps('INPATIENT');
    render(<WorkspaceMetaBar {...props} />);
    expect(screen.getByText('Room')).toBeInTheDocument();
    expect(screen.getByText('Unit')).toBeInTheDocument();
  });

  it('labels the support staff field and keeps the lead field', () => {
    const props = baseProps('INPATIENT');
    render(<WorkspaceMetaBar {...props} />);
    expect(screen.getByText('Assigned Lead')).toBeInTheDocument();
    expect(screen.getByText('Support Staff')).toBeInTheDocument();
    expect(screen.queryByText('Assigned Nurse')).not.toBeInTheDocument();
    // Inpatient still surfaces the Ready toggles and the advance button.
    expect(screen.getByText('Ready for Billing')).toBeInTheDocument();
    expect(screen.getByText('Ready for Discharge')).toBeInTheDocument();
  });

  it('renders lead and support profile photos when appointment metadata provides them', () => {
    const props = baseProps('INPATIENT');
    const encounter = {
      ...props.encounter,
      leadName: 'Dr Lead',
      nurseName: 'Nurse Tim',
    };
    render(
      <WorkspaceMetaBar
        {...props}
        encounter={encounter}
        leadPhotoUrl="https://example.com/lead.jpg"
        supportPhotoUrl="https://example.com/support.jpg"
      />
    );
    expect(screen.getByAltText('Dr Lead')).toHaveAttribute(
      'src',
      expect.stringContaining('lead.jpg')
    );
    expect(screen.getByAltText('Nurse Tim')).toHaveAttribute(
      'src',
      expect.stringContaining('support.jpg')
    );
  });

  it('shows a custom primary CTA when provided', () => {
    const props = baseProps('OUTPATIENT');
    const onClick = jest.fn();
    render(<WorkspaceMetaBar {...props} primaryCta={{ label: 'Skip to Summary', onClick }} />);
    fireEvent.click(screen.getByText('Skip to Summary'));
    expect(onClick).toHaveBeenCalled();
  });

  it('shows a custom primary CTA in the inpatient layout', () => {
    const props = baseProps('INPATIENT');
    const onClick = jest.fn();
    render(<WorkspaceMetaBar {...props} primaryCta={{ label: 'Skip to Summary', onClick }} />);
    fireEvent.click(screen.getByText('Skip to Summary'));
    expect(onClick).toHaveBeenCalled();
  });

  it('shows a Summary terminal CTA beside the ready toggles', () => {
    const props = baseProps('INPATIENT');
    const onClick = jest.fn();
    render(
      <WorkspaceMetaBar
        {...props}
        activeStep="SUMMARY"
        primaryCta={{ label: 'Discharge', onClick }}
      />
    );

    expect(screen.getByText('Ready for Discharge')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^discharge$/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('toggles ready flags', () => {
    const props = baseProps('OUTPATIENT');
    render(<WorkspaceMetaBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));
    expect(props.onToggleReadyForBilling).toHaveBeenCalled();
    expect(props.onToggleReadyForDischarge).toHaveBeenCalled();
  });

  it('keeps the ready toggles interactive when only the content is view-only', () => {
    // A checked Ready-for-Discharge marks the encounter view-only, but the
    // toggle itself must stay clickable so a mistaken check can be undone.
    const props = baseProps('OUTPATIENT');
    const encounter = {
      ...props.encounter,
      viewOnly: true,
      readyForDischarge: { value: true, byName: 'A', at: '2026-06-02T12:00:00Z' },
    };
    render(
      <WorkspaceMetaBar
        {...props}
        encounter={encounter}
        billingTogglesLocked={false}
        dischargeTogglesLocked={false}
      />
    );
    const discharge = screen.getByRole('button', { name: /ready for discharge/i });
    expect(discharge).not.toBeDisabled();
    fireEvent.click(discharge);
    expect(props.onToggleReadyForDischarge).toHaveBeenCalled();
  });

  it('locks the discharge toggle under the clinical time window but keeps billing editable', () => {
    // The time-based lock window is clinical: it freezes the discharge toggle but
    // NOT the billing toggle, which follows its own (operational) state.
    const props = baseProps('OUTPATIENT');
    render(<WorkspaceMetaBar {...props} billingTogglesLocked={false} dischargeTogglesLocked />);
    expect(screen.getByRole('button', { name: /ready for discharge/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /ready for billing/i })).not.toBeDisabled();
  });

  it('locks the billing toggle only when the encounter is persisted view-only', () => {
    const props = baseProps('OUTPATIENT');
    render(<WorkspaceMetaBar {...props} billingTogglesLocked dischargeTogglesLocked />);
    expect(screen.getByRole('button', { name: /ready for billing/i })).toBeDisabled();
  });
});
