import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AppointmentHistoryList from '@/app/features/appointments/components/AppointmentHistoryList';
import { useAppointmentsForCompanionInPrimaryOrg } from '@/app/hooks/useAppointments';

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div>fallback</div>,
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForCompanionInPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/features/appointments/components/AppointmentCardContent', () => ({
  __esModule: true,
  default: ({ appointment }: any) => <div>{`appointment-${appointment.id}`}</div>,
}));

describe('AppointmentHistoryList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when no appointments exist', () => {
    (useAppointmentsForCompanionInPrimaryOrg as jest.Mock).mockReturnValue([]);

    render(<AppointmentHistoryList companionId="comp-1" />);

    expect(screen.getByText('No appointments found')).toBeInTheDocument();
  });

  it('renders appointments sorted by latest startTime first', () => {
    (useAppointmentsForCompanionInPrimaryOrg as jest.Mock).mockReturnValue([
      { id: 'a-1', startTime: new Date('2026-03-01T08:00:00Z') },
      { id: 'a-2', startTime: new Date('2026-04-01T08:00:00Z') },
      { id: 'a-3', startTime: new Date('2026-02-01T08:00:00Z') },
    ]);

    render(<AppointmentHistoryList companionId="comp-1" />);

    const items = screen.getAllByText(/appointment-/).map((node) => node.textContent);
    expect(items).toEqual(['appointment-a-2', 'appointment-a-1', 'appointment-a-3']);
  });
});
