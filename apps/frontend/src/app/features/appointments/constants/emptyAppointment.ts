import { Appointment } from '@yosemite-crew/types';

export const EMPTY_APPOINTMENT: Appointment = {
  id: undefined,
  companion: {
    id: '',
    name: '',
    species: '',
    breed: '',
    parent: {
      id: '',
      name: '',
    },
  },
  lead: undefined,
  supportStaff: [],
  room: undefined,
  appointmentType: undefined,
  organisationId: '',
  appointmentDate: new Date(),
  startTime: new Date(),
  endTime: new Date(),
  timeSlot: '',
  durationMinutes: 0,
  status: 'REQUESTED',
  isEmergency: false,
  concern: '',
};
