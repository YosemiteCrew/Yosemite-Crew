import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockRejectAppointment = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: () => <span data-testid="mock-image" />,
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ orgsById: {} }),
}));

jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: (selector: any) =>
    selector({
      getCompanionById: () => undefined,
    }),
}));

jest.mock('@/app/stores/appointmentWorkspaceStore', () => ({
  useAppointmentWorkspaceStore: (selector: any) =>
    selector({
      encountersById: {},
    }),
}));

jest.mock('@/app/stores/roomStore', () => ({
  useOrganisationRoomStore: (selector: any) =>
    selector({
      roomUnitsById: {},
      roomUnitIdsByRoomId: {},
    }),
}));

jest.mock('@/app/lib/appointments', () => ({
  allowReschedule: jest.fn(() => true),
  canAssignAppointmentRoom: jest.fn(() => true),
  getAppointmentCompanionPhotoUrl: jest.fn(() => ''),
  getClinicalNotesIntent: jest.fn(() => ({ label: 'prescription', subLabel: 'subjective' })),
  getClinicalNotesLabel: jest.fn(() => 'Clinical notes'),
  isRequestedLikeStatus: jest.fn(() => true),
}));

jest.mock('@/app/lib/appointmentWorkspace', () => ({
  buildWorkspaceHrefForIntent: jest.fn(() => '/workspace'),
  canEnterAppointmentWorkspace: jest.fn(() => true),
}));

jest.mock('@/app/lib/appointmentRoomDisplay', () => ({
  getAppointmentRoomDisplay: jest.fn(() => ({ label: 'Room', value: '-' })),
}));

jest.mock('@/app/lib/paymentStatus', () => ({
  getAppointmentPaymentDisplay: jest.fn(() => ({ state: 'UNPAID', label: 'Amount due' })),
}));

jest.mock('@/app/lib/invoice', () => ({
  normalizeAppointmentId: jest.fn((value: string | undefined) => value),
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: jest.fn(() => '$ 0.00'),
}));

jest.mock('@/app/lib/timezone', () => ({
  formatDateInPreferredTimeZone: jest.fn(() => 'Jan 6, 2025'),
}));

jest.mock('@/app/lib/companionName', () => ({
  formatCompanionNameWithOwnerLastName: jest.fn(() => 'Buddy'),
  getOwnerFirstName: jest.fn(() => 'Sam'),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn(() => ''),
}));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/features/appointments/components/AppointmentStatusPill', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('@/app/features/appointments/components/EmergencyBadge', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('@/app/features/appointments/components/AppointmentCardContent', () => ({
  AppointmentModePill: () => <div />,
}));

jest.mock('@/app/features/appointments/components/Calendar/common/PopoverDetail', () => ({
  __esModule: true,
  default: ({ label, value }: any) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

jest.mock('@/app/features/appointments/components/Calendar/common/StaffInput', () => ({
  __esModule: true,
  default: ({ label, value }: any) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

jest.mock('@/app/hooks/useWheelToHorizontalScroll', () => ({
  useWheelToHorizontalScroll: jest.fn(() => jest.fn()),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  rejectAppointment: (...args: any[]) => mockRejectAppointment(...args),
}));

import AppointmentPopover from '@/app/features/appointments/components/Calendar/common/AppointmentPopover';

describe('AppointmentPopover', () => {
  const appointment: any = {
    id: 'appt-1',
    status: 'REQUESTED',
    startTime: new Date('2025-01-06T09:00:00Z'),
    endTime: new Date('2025-01-06T09:30:00Z'),
    appointmentDate: new Date('2025-01-06T09:00:00Z'),
    concern: 'Vaccines',
    companion: {
      id: 'comp-1',
      name: 'Buddy',
      species: 'dog',
      parent: { name: 'Sam' },
    },
    appointmentType: { name: 'Checkup', speciality: { name: 'General Medicine' } },
    lead: { name: 'Dr. Lee' },
    supportStaff: [{ name: 'Taylor' }],
    room: { name: 'Room A' },
    organisationId: 'org-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the accept modal path when accepting', () => {
    const handleAcceptAppointment = jest.fn();

    render(
      <AppointmentPopover
        appointment={appointment}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        handleAcceptAppointment={handleAcceptAppointment}
        onClose={jest.fn()}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Accept request' }));

    expect(handleAcceptAppointment).toHaveBeenCalledWith(appointment);
  });

  it('rejects directly when declining', () => {
    render(
      <AppointmentPopover
        appointment={appointment}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        handleAcceptAppointment={jest.fn()}
        onClose={jest.fn()}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Decline request' }));

    expect(mockRejectAppointment).toHaveBeenCalledWith(appointment);
  });
});
