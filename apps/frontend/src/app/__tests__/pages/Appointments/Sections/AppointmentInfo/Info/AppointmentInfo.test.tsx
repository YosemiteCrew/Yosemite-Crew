import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AppointmentInfo from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/AppointmentInfo';
import {
  validateAppointmentForm,
  validateSlotLeadErrors,
} from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/appointmentInfoValidation';

const useRoomsMock = jest.fn();
const useTeamMock = jest.fn();
const useSpecialitiesMock = jest.fn();
const getServicesBySpecialityIdMock = jest.fn();
const updateAppointmentMock = jest.fn();
const getSlotsMock = jest.fn();
const changeAppointmentStatusMock = jest.fn();
const notifyMock = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: (...args: any[]) => notifyMock(...args) }),
}));

jest.mock('@/app/hooks/useRooms', () => ({
  useLoadRoomsForPrimaryOrg: jest.fn(),
  useRoomsForPrimaryOrg: () => useRoomsMock(),
}));

let mockRoomState = {
  roomUnitsById: {} as Record<string, any>,
  roomUnitIdsByRoomId: {} as Record<string, string[]>,
};
jest.mock('@/app/stores/roomStore', () => ({
  useOrganisationRoomStore: (selector: any) => selector(mockRoomState),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesForPrimaryOrg: () => useSpecialitiesMock(),
}));

jest.mock('@/app/stores/serviceStore', () => ({
  useServiceStore: {
    getState: () => ({
      getServicesBySpecialityId: (...args: any[]) => getServicesBySpecialityIdMock(...args),
    }),
  },
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  updateAppointment: (...args: any[]) => updateAppointmentMock(...args),
  getSlotsForServiceAndDateForPrimaryOrg: (...args: any[]) => getSlotsMock(...args),
  changeAppointmentStatus: (...args: any[]) => changeAppointmentStatusMock(...args),
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => (props: any) => (
  <div>
    {props.showEditIcon ? (
      <button data-testid={`edit-${props.title}`} onClick={props.onEditClick}>
        edit
      </button>
    ) : null}
    <div>{props.children}</div>
  </div>
));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => (props: any) => (
  <div>
    <button
      data-testid={`dropdown-${props.placeholder}`}
      onClick={() => {
        const first = props.options?.[0];
        if (first) props.onSelect(first);
      }}
    >
      {props.placeholder}
    </button>
    {(props.options ?? []).map((option: any) => (
      <button
        key={option.value}
        data-testid={`option-${props.placeholder}-${option.value}`}
        onClick={() => props.onSelect(option)}
      >
        {option.label}
      </button>
    ))}
  </div>
));

jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => (props: any) => (
  <textarea data-testid="concern" value={props.value} onChange={(e) => props.onChange(e)} />
));

jest.mock('@/app/features/appointments/components/DateTimePickerSection', () => (props: any) => (
  <div data-testid="date-time-picker">
    <div data-testid="date-time-lead-id">{props.leadId ?? ''}</div>
    <div data-testid="date-time-lead-options">{JSON.stringify(props.leadOptions ?? [])}</div>
    <div data-testid="date-time-slot-error">{props.slotError ?? ''}</div>
    <div data-testid="date-time-lead-error">{props.leadError ?? ''}</div>
    <button
      data-testid="set-date-value"
      onClick={() => props.setSelectedDate(new Date('2026-03-05T00:00:00.000Z'))}
    >
      set-date-value
    </button>
    <button
      data-testid="set-date-fn"
      onClick={() => props.setSelectedDate((prev: Date) => new Date(prev.getTime()))}
    >
      set-date-fn
    </button>
    <button
      data-testid="set-slot-value"
      onClick={() =>
        props.setSelectedSlot({ startTime: '11:00', endTime: '11:30', vetIds: ['team-1'] })
      }
    >
      set-slot-value
    </button>
    <button data-testid="set-slot-fn" onClick={() => props.setSelectedSlot((prev: any) => prev)}>
      set-slot-fn
    </button>
    <button data-testid="clear-slot" onClick={() => props.setSelectedSlot(null)}>
      clear-slot
    </button>
    <button
      data-testid="pick-lead"
      onClick={() => props.onLeadSelect({ value: 'team-2', label: 'Sam' })}
    >
      pick-lead
    </button>
    <button data-testid="change-support" onClick={() => props.onSupportStaffChange(['team-2'])}>
      change-support
    </button>
  </div>
));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: (props: any) => (
    <button data-testid="save-appointment" onClick={props.onClick}>
      {props.text}
    </button>
  ),
  Secondary: (props: any) => (
    <button data-testid="cancel-appointment" onClick={props.onClick}>
      {props.text}
    </button>
  ),
}));

describe('AppointmentInfo section', () => {
  const activeAppointment: any = {
    id: 'appt-1',
    concern: 'Checkup',
    room: { id: 'room-1', name: 'Room A' },
    appointmentType: {
      id: 'svc-1',
      name: 'General',
      speciality: { id: 'spec-1', name: 'General' },
    },
    appointmentDate: '2026-02-28T10:00:00.000Z',
    startTime: '2026-02-28T10:00:00.000Z',
    endTime: '2026-02-28T10:30:00.000Z',
    status: 'REQUESTED',
    lead: { id: 'team-1', name: 'Alex' },
    supportStaff: [{ id: 'team-2', name: 'Sam' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoomState = {
      roomUnitsById: {},
      roomUnitIdsByRoomId: {},
    };
    useRoomsMock.mockReturnValue([{ id: 'room-1', name: 'Room A' }]);
    useTeamMock.mockReturnValue([
      {
        _id: 'team-1',
        name: 'Alex',
        practionerId: 'team-1',
        image: 'https://example.com/alex.jpg',
      },
      { _id: 'team-2', name: 'Sam', practionerId: 'team-2' },
    ]);
    useSpecialitiesMock.mockReturnValue([{ _id: 'spec-1', name: 'General' }]);
    getServicesBySpecialityIdMock.mockReturnValue([
      { id: 'svc-1', name: 'General', durationMinutes: 30 },
    ]);
    getSlotsMock.mockResolvedValue([{ startTime: '10:00', endTime: '10:30', vetIds: ['team-1'] }]);
  });

  it('requests slots when appointment details are put into edit mode', async () => {
    render(<AppointmentInfo activeAppointment={activeAppointment} />);

    fireEvent.click(screen.getByTestId('edit-Appointments details'));

    await waitFor(() => {
      expect(getSlotsMock).toHaveBeenCalledWith('svc-1', expect.any(Date));
    });
  });

  it('renders staff details in read-only appointment info', async () => {
    render(<AppointmentInfo activeAppointment={activeAppointment} />);

    expect(screen.getByText('Speciality')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(updateAppointmentMock).not.toHaveBeenCalled();
  });

  it('does not allow edit mode for completed appointments', async () => {
    render(<AppointmentInfo activeAppointment={{ ...activeAppointment, status: 'COMPLETED' }} />);

    expect(screen.queryByTestId('edit-Appointments details')).not.toBeInTheDocument();
    expect(getSlotsMock).not.toHaveBeenCalled();
  });

  it('shows read-only schedule fields for checked-in appointments while keeping allowed edits', async () => {
    render(<AppointmentInfo activeAppointment={{ ...activeAppointment, status: 'CHECKED_IN' }} />);

    fireEvent.click(screen.getByTestId('edit-Appointments details'));

    expect(getSlotsMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('date-time-picker')).not.toBeInTheDocument();
    expect(screen.getByText('Speciality')).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Room')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByTestId('concern')).toBeInTheDocument();
  });

  it('filters fully occupied rooms from inpatient room edits', async () => {
    useRoomsMock.mockReturnValue([
      { id: 'room-2', name: 'Room B' },
      { id: 'room-1', name: 'Room A' },
    ]);
    mockRoomState = {
      roomUnitsById: {
        'unit-1': {
          id: 'unit-1',
          roomId: 'room-1',
          displayName: 'Ward 1',
          code: 'W1',
          isActive: true,
          isOccupied: false,
        },
        'unit-2': {
          id: 'unit-2',
          roomId: 'room-2',
          displayName: 'Ward 2',
          code: 'W2',
          isActive: true,
          isOccupied: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-1': ['unit-1'],
        'room-2': ['unit-2'],
      },
    };

    render(
      <AppointmentInfo
        activeAppointment={{
          ...activeAppointment,
          appointmentKind: 'INPATIENT',
          status: 'CHECKED_IN',
          room: { id: 'room-0', name: 'Lobby' },
        }}
      />
    );

    fireEvent.click(screen.getByTestId('edit-Appointments details'));
    fireEvent.click(screen.getByTestId('dropdown-Room'));
    fireEvent.click(screen.getByTestId('save-appointment'));

    await waitFor(() => {
      expect(updateAppointmentMock).toHaveBeenCalledWith(
        expect.objectContaining({ room: { id: 'room-1', name: 'Room A' } })
      );
    });
  });

  it('keeps the assigned lead available when editing the appointment current slot', async () => {
    getSlotsMock.mockResolvedValue([{ startTime: '10:00', endTime: '10:30', vetIds: ['team-2'] }]);
    render(<AppointmentInfo activeAppointment={activeAppointment} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('date-time-lead-id')).toHaveTextContent('team-1');
    });

    const leadOptions = JSON.parse(
      screen.getByTestId('date-time-lead-options').textContent ?? '[]'
    );
    expect(leadOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'team-1', label: 'Alex' }),
        expect.objectContaining({ value: 'team-2', label: 'Sam' }),
      ])
    );
  });

  it('sends lead profileUrl when saving edited appointment', async () => {
    render(<AppointmentInfo activeAppointment={activeAppointment} />);
    fireEvent.click(screen.getByTestId('edit-Appointments details'));

    await waitFor(() => {
      expect(getSlotsMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('save-appointment'));

    await waitFor(() => {
      expect(updateAppointmentMock).toHaveBeenCalled();
    });

    const updatedPayload = updateAppointmentMock.mock.calls.at(-1)?.[0];
    expect(updatedPayload?.lead).toEqual(
      expect.objectContaining({
        id: 'team-1',
        name: 'Alex',
        profileUrl: 'https://example.com/alex.jpg',
      })
    );
  });

  it('updates speciality, service and concern from the edit dropdowns', async () => {
    render(<AppointmentInfo activeAppointment={activeAppointment} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await waitFor(() => expect(getSlotsMock).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByTestId('dropdown-Speciality'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('dropdown-Service'));
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('concern'), { target: { value: 'New concern' } });
    });

    expect(screen.getByTestId('concern')).toHaveValue('New concern');
  });

  it('handles date and slot updates from the picker (value and updater forms)', async () => {
    render(<AppointmentInfo activeAppointment={activeAppointment} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await waitFor(() => expect(getSlotsMock).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByTestId('set-date-value'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('set-date-fn'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('set-slot-value'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('set-slot-fn'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-slot'));
    });

    expect(screen.getByTestId('date-time-picker')).toBeInTheDocument();
  });

  it('runs the lead and support staff picker callbacks', async () => {
    render(<AppointmentInfo activeAppointment={activeAppointment} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await waitFor(() => expect(getSlotsMock).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByTestId('pick-lead'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('change-support'));
    });

    expect(screen.getByTestId('date-time-picker')).toBeInTheDocument();
  });

  it('exits edit mode when the active appointment id changes', async () => {
    const { rerender } = render(<AppointmentInfo activeAppointment={activeAppointment} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await waitFor(() => expect(screen.getByTestId('date-time-picker')).toBeInTheDocument());

    await act(async () => {
      rerender(<AppointmentInfo activeAppointment={{ ...activeAppointment, id: 'appt-2' }} />);
    });

    expect(screen.queryByTestId('date-time-picker')).not.toBeInTheDocument();
  });

  it('resets the form when cancelling edits', async () => {
    render(<AppointmentInfo activeAppointment={activeAppointment} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await waitFor(() => expect(screen.getByTestId('date-time-picker')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-appointment'));
    });

    expect(screen.queryByTestId('date-time-picker')).not.toBeInTheDocument();
  });

  it('does not request slots when the appointment has no service selected', async () => {
    const { appointmentType, ...withoutService } = activeAppointment;
    void appointmentType;
    render(<AppointmentInfo activeAppointment={withoutService} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });

    expect(getSlotsMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('date-time-picker')).toBeInTheDocument();
  });

  it('synthesizes the booked slot when it is missing from availability', async () => {
    getSlotsMock.mockResolvedValue([{ startTime: '14:00', endTime: '14:30', vetIds: ['team-1'] }]);
    render(<AppointmentInfo activeAppointment={activeAppointment} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('date-time-lead-id')).toHaveTextContent('team-1');
    });
  });

  it('clears slots when the availability lookup fails', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    getSlotsMock.mockRejectedValue(new Error('boom'));
    render(<AppointmentInfo activeAppointment={activeAppointment} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });

    await waitFor(() => expect(getSlotsMock).toHaveBeenCalled());
    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  it('clears the slot when no lead is available for it', async () => {
    getSlotsMock.mockResolvedValue([{ startTime: '10:00', endTime: '10:30', vetIds: ['ghost'] }]);
    render(<AppointmentInfo activeAppointment={{ ...activeAppointment, lead: undefined }} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('date-time-slot-error')).toHaveTextContent(
        'No lead is available for this slot. Please choose another slot.'
      );
    });
    expect(screen.getByTestId('date-time-lead-error')).toHaveTextContent(
      'No lead is available for this slot.'
    );
  });

  it('requires choosing a lead when several are available for the slot', async () => {
    getSlotsMock.mockResolvedValue([
      { startTime: '10:00', endTime: '10:30', vetIds: ['team-1', 'team-2'] },
    ]);
    render(
      <AppointmentInfo activeAppointment={{ ...activeAppointment, lead: { id: 'team-3' } }} />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('date-time-lead-error')).toHaveTextContent(
        'Multiple leads are available. Please choose a lead.'
      );
    });
    expect(screen.getByTestId('date-time-lead-id')).toHaveTextContent('');
  });

  it('applies a valid status change on save', async () => {
    changeAppointmentStatusMock.mockResolvedValue(undefined);
    render(<AppointmentInfo activeAppointment={{ ...activeAppointment, status: 'UPCOMING' }} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await waitFor(() => expect(getSlotsMock).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByTestId('option-Status-CHECKED_IN'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-appointment'));
    });

    await waitFor(() => {
      expect(updateAppointmentMock).toHaveBeenCalled();
      expect(changeAppointmentStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'UPCOMING' }),
        'CHECKED_IN'
      );
    });
  });

  it('formats a Date appointmentDate in the read-only view', () => {
    render(
      <AppointmentInfo
        activeAppointment={{
          ...activeAppointment,
          appointmentDate: new Date('2026-02-28T10:00:00.000Z'),
        }}
      />
    );

    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('falls back to dashes for an appointment with no optional data', () => {
    const bareAppointment: any = { id: 'appt-bare' };
    render(<AppointmentInfo activeAppointment={bareAppointment} />);

    // No status means the appointment is not editable, so no edit affordance is offered.
    expect(screen.queryByTestId('edit-Appointments details')).not.toBeInTheDocument();
    // Reason, room, speciality, service, date, time, lead and staff all fall back to a dash.
    expect(screen.getAllByText('-')).toHaveLength(8);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('ignores support staff entries that have no name', () => {
    render(
      <AppointmentInfo
        activeAppointment={{ ...activeAppointment, supportStaff: [{ id: 'team-9' }] }}
      />
    );

    expect(screen.getByText('Staff').parentElement?.textContent).toBe('Staff-');
  });

  it('shows dashes and blocks saving when a checked-in appointment has no schedule details', async () => {
    const scheduleless: any = {
      id: 'appt-1',
      concern: 'Checkup',
      room: { id: 'room-1', name: 'Room A' },
      status: 'CHECKED_IN',
      lead: { id: 'team-1' },
    };
    render(<AppointmentInfo activeAppointment={scheduleless} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });

    // Speciality, service, date, time, lead and staff each render a dash.
    expect(screen.getAllByText('-')).toHaveLength(6);

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-appointment'));
    });

    // The unparseable start time reads as a schedule change, which a checked-in
    // appointment is not allowed to make.
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Reschedule blocked' })
    );
    expect(updateAppointmentMock).not.toHaveBeenCalled();
  });

  it('saves a checked-in appointment that has no speciality or service', async () => {
    render(
      <AppointmentInfo
        activeAppointment={{
          ...activeAppointment,
          status: 'CHECKED_IN',
          appointmentType: undefined,
        }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-appointment'));
    });

    await waitFor(() => expect(updateAppointmentMock).toHaveBeenCalled());
    expect(updateAppointmentMock.mock.calls.at(-1)?.[0].appointmentType).toEqual({
      id: '',
      name: '',
      speciality: { id: '', name: '' },
    });
  });

  it('saves an appointment that has no room assigned', async () => {
    render(<AppointmentInfo activeAppointment={{ ...activeAppointment, room: undefined }} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    // The booked slot has resolved once its lead reaches the picker.
    await waitFor(() =>
      expect(screen.getByTestId('date-time-lead-options')).toHaveTextContent('Alex')
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-appointment'));
    });

    await waitFor(() => expect(updateAppointmentMock).toHaveBeenCalled());
    expect(updateAppointmentMock.mock.calls.at(-1)?.[0].room).toBeUndefined();
  });

  it('builds lead and support staff from team members identified only by _id', async () => {
    useTeamMock.mockReturnValue([
      // Lead: no practionerId, no name and no image.
      { _id: 'team-1' },
      // Unusable: no id of any kind.
      { name: 'Ghost' },
      // Only matchable through its nested organisation user id.
      { practionerId: 'team-4', name: 'Uma', userOrganisation: { userId: 'team-4' } },
      // Support staff member with no name.
      { _id: 'team-3' },
    ]);
    // The empty vet id normalizes away and must not widen the lead options.
    getSlotsMock.mockResolvedValue([
      { startTime: '10:00', endTime: '10:30', vetIds: ['', 'team-1'] },
    ]);

    render(
      <AppointmentInfo
        activeAppointment={{ ...activeAppointment, supportStaff: [{ id: 'team-3' }] }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    // The nameless lead falls back to its id, which also proves the slot resolved.
    await waitFor(() =>
      expect(screen.getByTestId('date-time-lead-options')).toHaveTextContent('team-1')
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-appointment'));
    });

    await waitFor(() => expect(updateAppointmentMock).toHaveBeenCalled());
    const payload = updateAppointmentMock.mock.calls.at(-1)?.[0];
    expect(payload.lead).toEqual({ id: 'team-1', name: 'team-1', profileUrl: undefined });
    expect(payload.supportStaff).toEqual([{ id: 'team-3', name: 'team-3' }]);
  });

  it('matches a speciality that has no id by its name', async () => {
    useSpecialitiesMock.mockReturnValue([{ name: 'General' }]);
    render(
      <AppointmentInfo
        activeAppointment={{
          ...activeAppointment,
          appointmentType: {
            id: 'svc-1',
            name: 'General',
            speciality: { id: 'General', name: 'General' },
          },
        }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('date-time-lead-options')).toHaveTextContent('Alex')
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-appointment'));
    });

    await waitFor(() => expect(updateAppointmentMock).toHaveBeenCalled());
    expect(updateAppointmentMock.mock.calls.at(-1)?.[0].appointmentType.speciality).toEqual({
      id: 'General',
      name: 'General',
    });
  });

  it('discards a slot response that resolves after its request was superseded', async () => {
    const resolvers: Array<(slots: any[]) => void> = [];
    getSlotsMock.mockImplementation(
      () =>
        new Promise<any[]>((resolve) => {
          resolvers.push(resolve);
        })
    );
    getServicesBySpecialityIdMock.mockReturnValue([
      { id: 'svc-1', name: 'General', durationMinutes: 30 },
      { id: 'svc-2', name: 'Dental', durationMinutes: 30 },
    ]);

    render(<AppointmentInfo activeAppointment={activeAppointment} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await waitFor(() => expect(resolvers).toHaveLength(1));

    // Switching service supersedes the in-flight availability request.
    await act(async () => {
      fireEvent.click(screen.getByTestId('option-Service-svc-2'));
    });
    await waitFor(() => expect(resolvers).toHaveLength(2));

    // Settle the superseded request last: its slots must not reach the form.
    await act(async () => {
      resolvers[1]([{ startTime: '10:00', endTime: '10:30', vetIds: ['team-2'] }]);
      resolvers[0]([{ startTime: '09:00', endTime: '09:30', vetIds: ['team-1'] }]);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('date-time-lead-options')).toHaveTextContent('team-2');
  });

  it('does not save while no slot is selected', async () => {
    render(<AppointmentInfo activeAppointment={activeAppointment} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    // Wait for the booked slot to land before clearing it, so no late
    // availability response can re-select it.
    await waitFor(() =>
      expect(screen.getByTestId('date-time-lead-options')).toHaveTextContent('Alex')
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-slot'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-appointment'));
    });

    expect(updateAppointmentMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('date-time-slot-error')).toHaveTextContent('Please select a slot');
  });

  it('reports no lead when the synthesized booked slot has no vets', async () => {
    getSlotsMock.mockResolvedValue([{ startTime: '14:00', endTime: '14:30', vetIds: ['team-1'] }]);
    render(<AppointmentInfo activeAppointment={{ ...activeAppointment, lead: undefined }} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('date-time-slot-error')).toHaveTextContent(
        'No lead is available for this slot. Please choose another slot.'
      );
    });
    expect(screen.getByTestId('date-time-lead-options').textContent).toBe('[]');
  });

  it('treats an unparseable appointment start time as having no booked slot', async () => {
    render(
      <AppointmentInfo activeAppointment={{ ...activeAppointment, startTime: 'not-a-date' }} />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await waitFor(() => expect(getSlotsMock).toHaveBeenCalled());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('date-time-lead-options').textContent).toBe('[]');
    expect(screen.getByTestId('date-time-slot-error').textContent).toBe('');
  });

  it('treats a missing appointment start time as having no booked slot', async () => {
    render(
      <AppointmentInfo
        activeAppointment={{ ...activeAppointment, startTime: undefined, endTime: undefined }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-Appointments details'));
    });
    await waitFor(() => expect(getSlotsMock).toHaveBeenCalled());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('date-time-lead-options').textContent).toBe('[]');
  });
});

describe('validateSlotLeadErrors', () => {
  const normalizeId = (value?: string | null) =>
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.toLowerCase();

  it('requires a slot when none is selected', () => {
    expect(validateSlotLeadErrors(null, [], '', normalizeId)).toEqual({
      slot: 'Please select a slot',
    });
  });

  it('reports no lead available when the slot has no lead options', () => {
    const slot = { startTime: '10:00', endTime: '10:30', vetIds: [] } as any;
    expect(validateSlotLeadErrors(slot, [], '', normalizeId)).toEqual({
      slot: 'No lead is available for this slot. Please choose another slot.',
      leadId: 'No lead is available for this slot.',
    });
  });

  it('asks the user to pick when multiple leads are available and none chosen', () => {
    const slot = { startTime: '10:00', endTime: '10:30', vetIds: ['a', 'b'] } as any;
    expect(
      validateSlotLeadErrors(
        slot,
        [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
        '',
        normalizeId
      )
    ).toEqual({ leadId: 'Multiple leads are available. Please choose a lead.' });
  });

  it('flags a lead that is not available for the slot', () => {
    const slot = { startTime: '10:00', endTime: '10:30', vetIds: ['a', 'b'] } as any;
    expect(
      validateSlotLeadErrors(
        slot,
        [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
        'c',
        normalizeId
      )
    ).toEqual({ leadId: 'Selected lead is not available for this slot.' });
  });

  it('returns no errors when the selected lead is valid', () => {
    const slot = { startTime: '10:00', endTime: '10:30', vetIds: ['a', 'b'] } as any;
    expect(
      validateSlotLeadErrors(
        slot,
        [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
        'a',
        normalizeId
      )
    ).toEqual({});
  });
});

describe('validateAppointmentForm', () => {
  const normalizeId = (value?: string | null) =>
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.toLowerCase();

  it('skips validation when schedule selection is not required', () => {
    expect(
      validateAppointmentForm({
        appointmentValues: { specialityId: '', serviceId: '', leadId: '' },
        selectedSlot: null,
        slotLeadOptions: [],
        normalizeId,
        requireScheduleSelection: false,
      })
    ).toEqual({});
  });

  it('collects speciality, service and slot errors when required', () => {
    expect(
      validateAppointmentForm({
        appointmentValues: { specialityId: '', serviceId: '', leadId: '' },
        selectedSlot: null,
        slotLeadOptions: [],
        normalizeId,
        requireScheduleSelection: true,
      })
    ).toEqual({
      specialityId: 'Please select a speciality',
      serviceId: 'Please select a service',
      slot: 'Please select a slot',
    });
  });

  it('passes when all required values are provided', () => {
    const slot = { startTime: '10:00', endTime: '10:30', vetIds: ['a'] } as any;
    expect(
      validateAppointmentForm({
        appointmentValues: { specialityId: 'spec-1', serviceId: 'svc-1', leadId: 'a' },
        selectedSlot: slot,
        slotLeadOptions: [{ label: 'A', value: 'a' }],
        normalizeId,
        requireScheduleSelection: true,
      })
    ).toEqual({});
  });
});
