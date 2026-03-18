import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentBoard from '@/app/features/appointments/components/AppointmentBoard';

jest.mock('@/app/hooks/useBoardDragScroll', () => ({
  useBoardDragScroll: () => ({
    autoScrollBoardOnDrag: jest.fn(),
  }),
}));

jest.mock('@/app/lib/buildDragPreview', () => ({
  buildDragPreview: () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    return element;
  },
}));

jest.mock('@/app/config/statusConfig', () => ({
  getStatusStyle: () => ({ backgroundColor: '#f5f5f5', color: '#111111' }),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  acceptAppointment: jest.fn(),
  changeAppointmentStatus: jest.fn(),
  rejectAppointment: jest.fn(),
}));

jest.mock('@/app/lib/timezone', () => ({
  isOnPreferredTimeZoneCalendarDay: () => true,
  formatDateInPreferredTimeZone: (value: Date, opts?: Intl.DateTimeFormatOptions) => {
    if (opts?.hour) return '9:00 AM';
    return 'Monday, Mar 16, 2026';
  },
}));

jest.mock('@/app/ui/primitives/Icons/Back', () => (props: any) => (
  <button type="button" onClick={props.onClick}>
    Back
  </button>
));

jest.mock('@/app/ui/primitives/Icons/Next', () => (props: any) => (
  <button type="button" onClick={props.onClick}>
    Next
  </button>
));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => [],
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({ attributes: {} }),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => () => <div data-testid="datepicker" />);

jest.mock('@/app/hooks/useInvoices', () => ({
  useInvoicesForPrimaryOrg: () => [],
}));

jest.mock('@/app/lib/paymentStatus', () => ({
  createInvoiceByAppointmentId: () => ({}),
  getAppointmentPaymentDisplay: () => ({
    label: 'Unpaid',
    badgeBackgroundColor: '#eee',
    badgeTextColor: '#111',
  }),
}));

jest.mock('next/image', () => (props: any) => (
  <div data-testid="mock-image" data-src={props.src} data-alt={props.alt ?? ''} />
));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: () => '/dog.png',
}));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ orgsById: {} }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({
    notify: jest.fn(),
  }),
}));

jest.mock('@/app/ui/primitives/BoardScopeToggle/BoardScopeToggle', () => (props: any) => (
  <button type="button" onClick={() => props.onChange(!props.showMineOnly)}>
    Toggle scope
  </button>
));

describe('AppointmentBoard', () => {
  const setCurrentDate = jest.fn();
  const setActiveAppointment = jest.fn();
  const setViewPopup = jest.fn();

  const baseAppointment = {
    organisationId: 'org-1',
    startTime: new Date('2026-03-16T09:00:00.000Z'),
    companion: {
      name: 'Buddy',
      species: 'dog',
      parent: { name: 'Sam' },
    },
    lead: { name: 'Dr. Lee' },
    room: { name: 'Room 1' },
    concern: 'Checkup',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the appointment side modal on click when the card is not draggable', () => {
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-completed', status: 'COMPLETED' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
      />
    );

    fireEvent.click(screen.getByLabelText('Open appointment Buddy'));

    expect(setActiveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-completed' })
    );
    expect(setViewPopup).toHaveBeenCalledWith(true);
  });

  it('does not render a full-card click target when the card is draggable', () => {
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-upcoming', status: 'UPCOMING' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Open appointment Buddy' })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Draggable appointment Buddy')).toHaveAttribute(
      'draggable',
      'true'
    );
  });
});
