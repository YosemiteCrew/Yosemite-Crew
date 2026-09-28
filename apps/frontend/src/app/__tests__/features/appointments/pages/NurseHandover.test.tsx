import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import '@testing-library/jest-dom';
import NurseHandover from '@/app/features/appointments/pages/NurseHandover/NurseHandover';
import { getHandoverVisits } from '@/app/features/appointments/pages/NurseHandover/handoverUtils';
import type { AppointmentWithCompanion } from '@/app/features/appointments/types/appointments';
import type { Task } from '@/app/features/tasks/types/task';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useTasksForPrimaryOrg } from '@/app/hooks/useTask';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAuthStore } from '@/app/stores/authStore';
import {
  listObservationSubmissionsForAppointment,
  listVitalRecordsForAppointment,
} from '@/app/features/appointments/services/workspaceClinicalService';

jest.mock('@/app/hooks/useAppointments', () => ({
  useAppointmentsForPrimaryOrg: jest.fn(),
  useLoadAppointmentsForPrimaryOrg: jest.fn(),
}));
jest.mock('@/app/hooks/useTask', () => ({
  useTasksForPrimaryOrg: jest.fn(),
  useLoadTasksForPrimaryOrg: jest.fn(),
}));
jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: jest.fn() }));
jest.mock('@/app/stores/authStore', () => ({ useAuthStore: jest.fn() }));
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  listObservationSubmissionsForAppointment: jest.fn(),
  listVitalRecordsForAppointment: jest.fn(),
}));

const patient = {
  id: 'patient-1',
  name: 'Milo',
  species: 'Dog',
  parent: { id: 'parent-1', name: 'Taylor Reed' },
};

const appointment = (
  id: string,
  status: AppointmentWithCompanion['status'],
  startTime = new Date('2026-09-28T09:00:00.000Z')
): AppointmentWithCompanion => ({
  id,
  patient,
  companion: patient,
  organisationId: 'org-1',
  appointmentDate: startTime,
  startTime,
  endTime: new Date(startTime.getTime() + 30 * 60_000),
  timeSlot: '09:00',
  durationMinutes: 30,
  status,
  appointmentType: {
    id: 'type-1',
    name: 'Check-up',
    speciality: { id: 'spec-1', name: 'General' },
  },
});

const task = (
  id: string,
  appointmentId: string,
  status: Task['status'],
  audience: Task['audience'] = 'EMPLOYEE_TASK'
): Task => ({
  _id: id,
  appointmentId,
  assignedTo: 'staff-1',
  audience,
  source: 'CUSTOM',
  category: 'CARE',
  name: id,
  dueAt: new Date('2026-09-28T09:30:00.000Z'),
  status,
});

const mockStoreHooks = (appointments: AppointmentWithCompanion[], tasks: Task[]) => {
  (useAppointmentsForPrimaryOrg as jest.Mock).mockReturnValue(appointments);
  (useTasksForPrimaryOrg as jest.Mock).mockReturnValue(tasks);
  (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
    selector({ primaryOrgId: 'org-1' })
  );
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
    selector({ attributes: { sub: 'staff-1', given_name: 'Mira', family_name: 'Patel' } })
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreHooks([], []);
  (listVitalRecordsForAppointment as jest.Mock).mockResolvedValue([]);
  (listObservationSubmissionsForAppointment as jest.Mock).mockResolvedValue([]);
});

describe('getHandoverVisits', () => {
  it('keeps current visits and visits with open staff work, not completed or parent work', () => {
    const current = appointment('current', 'IN_PROGRESS');
    const upcoming = appointment('upcoming', 'UPCOMING');
    const completed = appointment('completed', 'COMPLETED');
    const visits = getHandoverVisits(
      [current, upcoming, completed],
      [
        task('pending', 'upcoming', 'PENDING'),
        task('done', 'completed', 'COMPLETED'),
        task('parent', 'completed', 'PENDING', 'PARENT_TASK'),
        task('orphan', 'missing', 'PENDING'),
      ]
    );

    expect(visits.map(({ appointment: visit }) => visit.id)).toEqual(['current', 'upcoming']);
    expect(visits[1].openTasks.map((item) => item._id)).toEqual(['pending']);
  });

  it('keeps an active visit with no tasks and ignores appointments without ids', () => {
    const visitWithoutId = { ...appointment('missing-id', 'CHECKED_IN'), id: undefined };

    expect(
      getHandoverVisits([appointment('checked-in', 'CHECKED_IN'), visitWithoutId], [])
    ).toEqual([{ appointment: appointment('checked-in', 'CHECKED_IN'), openTasks: [] }]);
  });

  it('orders handover visits by scheduled start time', () => {
    const later = appointment('later', 'IN_PROGRESS', new Date('2026-09-28T12:00:00.000Z'));
    const earlier = appointment('earlier', 'CHECKED_IN', new Date('2026-09-28T08:00:00.000Z'));

    expect(
      getHandoverVisits([later, earlier], []).map(({ appointment: visit }) => visit.id)
    ).toEqual(['earlier', 'later']);
  });
});

describe('NurseHandover', () => {
  it('renders timestamps in the stable server timezone before browser preferences load', () => {
    mockStoreHooks([appointment('appt-1', 'CHECKED_IN')], []);

    expect(renderToString(<NurseHandover />)).toContain('11:00 AM');
  });

  it('shows open work and loads only saved vitals and observations when expanded', async () => {
    const visit = appointment('appt-1', 'IN_PROGRESS');
    mockStoreHooks([visit], [task('Give medication', 'appt-1', 'IN_PROGRESS')]);
    (listVitalRecordsForAppointment as jest.Mock).mockResolvedValue([
      {
        id: 'vital-1',
        code: 'VT-001',
        weightKg: 31,
        tempC: 38.4,
        heartRateBpm: 110,
        respRateBpm: 24,
        recordedByName: 'Mira Patel',
        recordedAt: '2026-09-28T08:30:00.000Z',
      },
    ]);
    (listObservationSubmissionsForAppointment as jest.Mock).mockResolvedValue([
      {
        id: 'obs-1',
        code: 'OT-001',
        toolKey: 'FGS',
        toolName: 'Pain check',
        scores: {},
        total: 3,
        recordedByName: 'Mira Patel',
        recordedAt: '2026-09-28T08:35:00.000Z',
      },
    ]);

    render(<NurseHandover />);

    expect(screen.getByRole('heading', { name: 'Shift handover' })).toBeInTheDocument();
    expect(screen.getByText('Give medication')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(listVitalRecordsForAppointment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Recorded observations' }));

    expect(
      await screen.findByText('Vitals · 31 kg · 38.4 °C · 110 bpm · 24 /min')
    ).toBeInTheDocument();
    expect(screen.getByText('Pain check · Score 3')).toBeInTheDocument();
    expect(listVitalRecordsForAppointment).toHaveBeenCalledWith(
      'org-1',
      'appt-1',
      expect.objectContaining({ authorId: 'staff-1', authorName: 'Mira Patel' })
    );
  });

  it('announces loading saved records with an output element', () => {
    const visit = appointment('appt-1', 'CHECKED_IN');
    mockStoreHooks([visit], []);
    (listVitalRecordsForAppointment as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<NurseHandover />);
    fireEvent.click(screen.getByRole('button', { name: 'Recorded observations' }));

    expect(screen.getByRole('status').tagName).toBe('OUTPUT');
  });

  it('distinguishes no saved records from a failed request and lets staff retry', async () => {
    const visit = appointment('appt-1', 'CHECKED_IN', new Date('invalid'));
    mockStoreHooks([visit], []);
    (listVitalRecordsForAppointment as jest.Mock).mockRejectedValueOnce(new Error('unavailable'));

    render(<NurseHandover />);
    expect(screen.getByText(/Time unavailable/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recorded observations' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Saved records could not be loaded.'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('No observations have been recorded for this visit.')
    ).toBeInTheDocument();
  });

  it('labels not-started work and saved records without optional measurements', async () => {
    const visit = appointment('appt-2', 'UPCOMING');
    mockStoreHooks([visit], [task('Collect sample', 'appt-2', 'PENDING')]);
    (listVitalRecordsForAppointment as jest.Mock).mockResolvedValue([
      {
        id: 'vital-empty',
        code: 'VT-002',
        recordedByName: 'You',
        recordedAt: 'not-a-date',
      },
    ]);
    (listObservationSubmissionsForAppointment as jest.Mock).mockResolvedValue([
      {
        id: 'observation-no-score',
        code: 'OT-002',
        toolKey: 'CSU_CAP',
        toolName: 'Comfort check',
        scores: {},
        recordedByName: 'You',
        recordedAt: 'not-a-date',
      },
    ]);

    render(<NurseHandover />);

    expect(screen.getByRole('region', { name: 'Open work' })).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recorded observations' }));
    expect(await screen.findByText('Vitals · No readings recorded')).toBeInTheDocument();
    expect(screen.getByText('Comfort check')).toBeInTheDocument();
    expect(await screen.findAllByText(/Time not recorded/)).toHaveLength(2);
  });

  it('uses a generic appointment label, shows a room, and falls back to the current user name', async () => {
    const visit = {
      ...appointment('appt-3', 'UPCOMING'),
      appointmentType: undefined,
      room: { id: 'room-1', name: 'Exam room' },
    } as AppointmentWithCompanion;
    mockStoreHooks([visit], [task('Review chart', 'appt-3', 'PENDING')]);
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ attributes: null })
    );

    render(<NurseHandover />);

    expect(screen.getByText('Appointment · Exam room')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recorded observations' }));
    expect(
      await screen.findByText('No observations have been recorded for this visit.')
    ).toBeInTheDocument();
    expect(listVitalRecordsForAppointment).toHaveBeenCalledWith(
      'org-1',
      'appt-3',
      expect.objectContaining({ authorName: 'You' })
    );
  });

  it('does not request saved records when the organisation is unavailable', () => {
    mockStoreHooks([appointment('appt-4', 'CHECKED_IN')], []);
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ primaryOrgId: null })
    );

    render(<NurseHandover />);
    fireEvent.click(screen.getByRole('button', { name: 'Recorded observations' }));

    expect(listVitalRecordsForAppointment).not.toHaveBeenCalled();
    expect(listObservationSubmissionsForAppointment).not.toHaveBeenCalled();
  });

  it('shows a clear empty state when there is no active visit or linked staff work', () => {
    mockStoreHooks([appointment('completed', 'COMPLETED')], []);

    render(<NurseHandover />);

    expect(
      screen.getByRole('heading', { name: 'Nothing to hand over right now' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View appointments' })).toHaveAttribute(
      'href',
      '/appointments'
    );
  });
});
