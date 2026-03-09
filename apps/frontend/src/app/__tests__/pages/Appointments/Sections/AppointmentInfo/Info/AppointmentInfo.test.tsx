import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AppointmentInfo from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/AppointmentInfo';

const useRoomsMock = jest.fn();
const useTeamMock = jest.fn();
const useSpecialitiesMock = jest.fn();
const getServicesBySpecialityIdMock = jest.fn();
const updateAppointmentMock = jest.fn();
const getSlotsMock = jest.fn();
const changeAppointmentStatusMock = jest.fn();
jest.mock('@/app/hooks/useRooms', () => ({
  useRoomsForPrimaryOrg: () => useRoomsMock(),
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
    <button data-testid={`edit-${props.title}`} onClick={props.onEditClick}>
      edit
    </button>
    <div>{props.children}</div>
  </div>
));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => (props: any) => (
  <button
    data-testid={`dropdown-${props.placeholder}`}
    onClick={() => {
      const first = props.options?.[0];
      if (first) props.onSelect(first);
    }}
  >
    {props.placeholder}
  </button>
));

jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => (props: any) => (
  <textarea data-testid="concern" value={props.value} onChange={(e) => props.onChange(e)} />
));

jest.mock('@/app/features/appointments/components/DateTimePickerSection', () => () => (
  <div data-testid="date-time-picker" />
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
    useRoomsMock.mockReturnValue([{ id: 'room-1', name: 'Room A' }]);
    useTeamMock.mockReturnValue([
      { _id: 'team-1', name: 'Alex', practionerId: 'team-1' },
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

    expect(screen.getByText('Lead')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(updateAppointmentMock).not.toHaveBeenCalled();
  });
});
