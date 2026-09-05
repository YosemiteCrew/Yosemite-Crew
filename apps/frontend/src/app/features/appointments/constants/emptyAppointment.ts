import { Appointment } from '@yosemite-crew/types';

export const EMPTY_APPOINTMENT: Appointment = {
  id: undefined,
  patient: {
    id: '',
    name: '',
    species: '',
    breed: '',
    parent: {
      id: '',
      name: '',
    },
  },
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
  // Accessors, not literals. `new Date()` here would run once when the module
  // is first imported, so under SSR every request that opened a blank form
  // would be handed the server's start-up instant for the rest of the process.
  // A getter evaluates per read, which is what "a blank appointment starts at
  // now" was always meant to say; spreading the constant (every caller does)
  // still snapshots a plain Date, exactly as before.
  get appointmentDate() {
    return new Date();
  },
  get startTime() {
    return new Date();
  },
  get endTime() {
    return new Date();
  },
  timeSlot: '',
  durationMinutes: 0,
  status: 'REQUESTED',
  isEmergency: false,
  concern: '',
};
