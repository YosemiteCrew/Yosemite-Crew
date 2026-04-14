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
});
