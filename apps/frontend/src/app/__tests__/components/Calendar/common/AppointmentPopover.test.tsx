import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockRejectAppointment = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
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
    const appointmentsLib = jest.requireMock('@/app/lib/appointments') as {
      allowReschedule: jest.Mock;
      canAssignAppointmentRoom: jest.Mock;
      isRequestedLikeStatus: jest.Mock;
    };
    const workspaceLib = jest.requireMock('@/app/lib/appointmentWorkspace') as {
      canEnterAppointmentWorkspace: jest.Mock;
    };
    const paymentLib = jest.requireMock('@/app/lib/paymentStatus') as {
      getAppointmentPaymentDisplay: jest.Mock;
    };

    appointmentsLib.allowReschedule.mockReturnValue(true);
    appointmentsLib.canAssignAppointmentRoom.mockReturnValue(true);
    appointmentsLib.isRequestedLikeStatus.mockImplementation((status) => status === 'REQUESTED');
    workspaceLib.canEnterAppointmentWorkspace.mockReturnValue(true);
    paymentLib.getAppointmentPaymentDisplay.mockReturnValue({
      state: 'UNPAID',
      label: 'Amount due',
    });
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

  it('rejects directly when declining', async () => {
    const onClose = jest.fn();

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
        onClose={onClose}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Decline request' }));

    expect(mockRejectAppointment).toHaveBeenCalledWith(appointment);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows the workspace action and reschedule path for non-requested appointments', () => {
    const handleRescheduleAppointment = jest.fn();
    const handleChangeRoomAppointment = jest.fn();
    const onClose = jest.fn();
    const nonRequestedAppointment = {
      ...appointment,
      status: 'UPCOMING',
    };

    render(
      <AppointmentPopover
        appointment={nonRequestedAppointment}
        invoicesByAppointmentId={{
          'appt-1': {
            totalAmount: 1200,
            currency: 'USD',
            items: [],
            subtotal: 1200,
            paymentCollectionMethod: 'CARD',
            status: 'UNPAID',
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        }}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={handleRescheduleAppointment}
        handleChangeRoomAppointment={handleChangeRoomAppointment}
        onClose={onClose}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    expect(screen.getByRole('button', { name: 'Start Appointment' })).toBeInTheDocument();
    expect(screen.getByText('Amount Due')).toBeInTheDocument();
    expect(screen.getByText('$ 0.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reschedule appointment' }));
    expect(handleRescheduleAppointment).toHaveBeenCalledWith(nonRequestedAppointment);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Assign room' }));
    expect(handleChangeRoomAppointment).toHaveBeenCalledWith(nonRequestedAppointment);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('routes to the workspace from the primary action', () => {
    const onClose = jest.fn();

    render(
      <AppointmentPopover
        appointment={{ ...appointment, status: 'UPCOMING' }}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={onClose}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Appointment' }));

    expect(mockPush).toHaveBeenCalledWith('/workspace');
    expect(onClose).toHaveBeenCalled();
  });

  it('routes from action bar shortcuts and closes the popover', () => {
    const onClose = jest.fn();

    render(
      <AppointmentPopover
        appointment={{ ...appointment, status: 'IN_PROGRESS' }}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={onClose}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Finance summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lab tests' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clinical notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'View Appointment' }));

    expect(mockPush).toHaveBeenCalledTimes(4);
    expect(mockPush).toHaveBeenCalledWith('/workspace');
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('routes to the companion overview from the companion name', () => {
    const onClose = jest.fn();

    render(
      <AppointmentPopover
        appointment={{ ...appointment, status: 'UPCOMING' }}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={onClose}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Buddy' }));

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining(
        '/companions/history?companionId=comp-1&source=appointments&appointmentId=appt-1'
      )
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('does not route the primary action when appointment id is missing', () => {
    const onClose = jest.fn();

    render(
      <AppointmentPopover
        appointment={{ ...appointment, id: undefined, status: 'UPCOMING' }}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={onClose}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Appointment' }));

    expect(mockPush).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the dialog cancel event fires', () => {
    const onClose = jest.fn();

    render(
      <AppointmentPopover
        appointment={appointment}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={onClose}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

    expect(onClose).toHaveBeenCalled();
  });

  it('hides edit actions when editing is not allowed', () => {
    render(
      <AppointmentPopover
        appointment={{ ...appointment, status: 'UPCOMING' }}
        invoicesByAppointmentId={{}}
        canEditAppointments={false}
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Reschedule appointment' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign room' })).not.toBeInTheDocument();
  });

  it('shows the estimate payment label when payment state is unknown', () => {
    const { getAppointmentPaymentDisplay } = jest.requireMock('@/app/lib/paymentStatus') as {
      getAppointmentPaymentDisplay: jest.Mock;
    };
    getAppointmentPaymentDisplay.mockReturnValueOnce({ state: 'PENDING', label: 'Estimate' });

    render(
      <AppointmentPopover
        appointment={{ ...appointment, status: 'UPCOMING' }}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    expect(screen.getAllByText('Estimate')).toHaveLength(2);
  });

  it('shows the paid payment label when payment state is settled', () => {
    const { getAppointmentPaymentDisplay } = jest.requireMock('@/app/lib/paymentStatus') as {
      getAppointmentPaymentDisplay: jest.Mock;
    };
    getAppointmentPaymentDisplay.mockReturnValueOnce({ state: 'PAID', label: 'Settled' });

    render(
      <AppointmentPopover
        appointment={{ ...appointment, status: 'UPCOMING' }}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Settled')).toBeInTheDocument();
  });

  it('hides workspace actions when the appointment cannot open the workspace', () => {
    const { canEnterAppointmentWorkspace } = jest.requireMock('@/app/lib/appointmentWorkspace') as {
      canEnterAppointmentWorkspace: jest.Mock;
    };
    canEnterAppointmentWorkspace.mockReturnValueOnce(false);

    render(
      <AppointmentPopover
        appointment={{ ...appointment, status: 'IN_PROGRESS' }}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    expect(screen.queryByRole('button', { name: 'Appointment overview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finance summary' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lab tests' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Appointment' })).not.toBeInTheDocument();
  });

  it('falls back to generic companion details when optional data is missing', () => {
    render(
      <AppointmentPopover
        appointment={{
          ...appointment,
          companion: {
            id: 'comp-2',
            name: 'Nova',
            species: 'unknown-species',
            parent: { name: 'Alex' },
          },
          lead: { name: 'Dr. Lee' },
          supportStaff: [],
        }}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    expect(screen.getByText('unknown-species · Unknown')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Room')).toBeInTheDocument();
  });

  it('formats mapped species, neuter status, and numeric weight', () => {
    render(
      <AppointmentPopover
        appointment={{
          ...appointment,
          companion: {
            id: 'comp-2',
            name: 'Nova',
            species: 'dog',
            breed: 'Beagle',
            gender: 'male',
            isneutered: true,
            currentWeight: 12,
            parent: { name: 'Alex' },
          },
        }}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    expect(screen.getByText('Beagle · Canine · MN · 12 kg')).toBeInTheDocument();
  });

  it('falls back to physical weight when the current weight cannot be parsed', () => {
    render(
      <AppointmentPopover
        appointment={{
          ...appointment,
          companion: {
            id: 'comp-3',
            name: 'Luna',
            species: 'cat',
            gender: 'female',
            currentWeight: 'unknown',
            physicalAttribute: { weight: '8 lb' },
            parent: { name: 'Riley' },
          },
        }}
        invoicesByAppointmentId={{}}
        canEditAppointments
        popoverId="popover-1"
        popoverDialogRef={{ current: null }}
        popoverStyle={{}}
        handleRescheduleAppointment={jest.fn()}
        onClose={jest.fn()}
        registerAnchorEl={jest.fn(() => jest.fn())}
      />
    );

    expect(screen.getByText('Feline · Female · 8 lb')).toBeInTheDocument();
  });
});
