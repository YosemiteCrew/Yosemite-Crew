import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Audit from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Audit';

const getAppointmentAuditTrailMock = jest.fn();

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div>fallback</div>,
}));

jest.mock('@/app/features/audit/services/auditService', () => ({
  getAppointmentAuditTrail: (...args: any[]) => getAppointmentAuditTrailMock(...args),
}));

jest.mock('@/app/lib/validators', () => ({
  toTitle: (value: string) => `TITLE:${value}`,
}));

jest.mock('@/app/lib/date', () => ({
  formatDateTimeLocal: (value: string) => `DATE:${value}`,
}));

describe('Audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when appointment id is missing', async () => {
    render(<Audit activeAppointment={{ id: '' } as any} />);

    await waitFor(() => {
      expect(screen.getByText('Nothing to show')).toBeInTheDocument();
    });
    expect(getAppointmentAuditTrailMock).not.toHaveBeenCalled();
  });

  it('renders audit entries when service returns data', async () => {
    getAppointmentAuditTrailMock.mockResolvedValue([
      {
        id: 'a1',
        eventType: 'status_change',
        entityType: 'appointment',
        actorType: 'user',
        actorName: 'dr jane',
        occurredAt: '2025-01-01T00:00:00.000Z',
      },
    ]);

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    await waitFor(() => {
      expect(getAppointmentAuditTrailMock).toHaveBeenCalledWith('appt-1');
    });

    expect(await screen.findByText('TITLE:status_change')).toBeInTheDocument();
    expect(screen.getByText('Appointment')).toBeInTheDocument();
    expect(screen.getByText('Updated by: dr jane • TITLE:USER')).toBeInTheDocument();
    expect(screen.getByText('DATE:2025-01-01T00:00:00.000Z')).toBeInTheDocument();
  });

  it('falls back to empty state when audit service fails', async () => {
    getAppointmentAuditTrailMock.mockRejectedValue(new Error('boom'));

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    await waitFor(() => {
      expect(screen.getByText('Nothing to show')).toBeInTheDocument();
    });
  });

  it('labels every known actor type and falls back to a titled type', async () => {
    getAppointmentAuditTrailMock.mockResolvedValue([
      { id: '1', eventType: 'e1', actorType: 'PMS_USER', actorName: 'Jane', occurredAt: 'T' },
      { id: '2', eventType: 'e2', actorType: 'PARENT', actorName: 'Sam', occurredAt: 'T' },
      { id: '3', eventType: 'e3', actorType: 'SYSTEM', actorName: 'Cron', occurredAt: 'T' },
      // Unmapped actor type -> toTitle fallback.
      { id: '4', eventType: 'e4', actorType: 'robot', actorName: 'R2', occurredAt: 'T' },
    ]);

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    expect(await screen.findByText('Updated by: Jane • Team member')).toBeInTheDocument();
    expect(screen.getByText('Updated by: Sam • Pet parent')).toBeInTheDocument();
    expect(screen.getByText('Updated by: Cron • System')).toBeInTheDocument();
    expect(screen.getByText('Updated by: R2 • TITLE:ROBOT')).toBeInTheDocument();
  });

  it('drops the actor name when absent and defaults a missing actor type to SYSTEM', async () => {
    getAppointmentAuditTrailMock.mockResolvedValue([
      // No name -> label only, not "name • label".
      { id: '1', eventType: 'e1', actorType: 'PARENT', occurredAt: 'T' },
      // Neither name nor type -> the '' -> 'SYSTEM' default, then toTitle.
      { id: '2', eventType: 'e2', occurredAt: 'T' },
      // Whitespace-only name is treated as absent.
      { id: '3', eventType: 'e3', actorType: 'SYSTEM', actorName: '   ', occurredAt: 'T' },
    ]);

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    expect(await screen.findByText('Updated by: Pet parent')).toBeInTheDocument();
    expect(screen.getByText('Updated by: TITLE:SYSTEM')).toBeInTheDocument();
    expect(screen.getByText('Updated by: System')).toBeInTheDocument();
  });

  it('labels and tones every known entity type, and hides the badge without one', async () => {
    getAppointmentAuditTrailMock.mockResolvedValue([
      { id: '1', eventType: 'e1', entityType: 'COMPANION_ORGANISATION', occurredAt: 'T' },
      { id: '2', eventType: 'e2', entityType: 'APPOINTMENT', occurredAt: 'T' },
      { id: '3', eventType: 'e3', entityType: 'INVOICE', occurredAt: 'T' },
      { id: '4', eventType: 'e4', entityType: 'DOCUMENT', occurredAt: 'T' },
      { id: '5', eventType: 'e5', entityType: 'FORM', occurredAt: 'T' },
      // Unmapped entity -> toTitle fallback + neutral tone.
      { id: '6', eventType: 'e6', entityType: 'widget', occurredAt: 'T' },
      // No entity -> no badge at all.
      { id: '7', eventType: 'e7', occurredAt: 'T' },
    ]);

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    expect(await screen.findByText('Companion profile')).toBeInTheDocument();
    expect(screen.getByText('Appointment')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('Template')).toBeInTheDocument();
    expect(screen.getByText('TITLE:WIDGET')).toBeInTheDocument();
    // Seven entries, six badges: the entity-less row renders none.
    expect(screen.getByText('TITLE:e7')).toBeInTheDocument();
  });

  it('keys entries that carry no id', async () => {
    getAppointmentAuditTrailMock.mockResolvedValue([
      { eventType: 'no_id', entityType: 'APPOINTMENT', occurredAt: 'T' },
    ]);

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    expect(await screen.findByText('TITLE:no_id')).toBeInTheDocument();
  });

  it('renders an empty list when the service resolves nullish', async () => {
    getAppointmentAuditTrailMock.mockResolvedValue(undefined);

    render(<Audit activeAppointment={{ id: 'appt-1' } as any} />);

    await waitFor(() => {
      expect(screen.getByText('Nothing to show')).toBeInTheDocument();
    });
  });
});
