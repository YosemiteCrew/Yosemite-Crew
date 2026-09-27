import type { Meta, StoryObj } from '@storybook/react';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';
import type { Task } from '@/app/features/tasks/types/task';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import NurseHandover from './NurseHandover';

const ORG_ID = 'org-handover-story';
const VISIT_ID = 'visit-handover-story';
const MEMBERSHIP: UserOrganization = {
  practitionerReference: 'Practitioner/staff-handover-story',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

const VISIT: Appointment = {
  id: VISIT_ID,
  patient: {
    id: 'patient-handover-story',
    name: 'Milo Hartmann',
    species: 'Dog',
    parent: { id: 'parent-handover-story', name: 'Lena Hartmann' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-09-28T09:00:00.000Z'),
  startTime: new Date('2026-09-28T09:00:00.000Z'),
  endTime: new Date('2026-09-28T09:30:00.000Z'),
  timeSlot: '09:00 - 09:30',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
  appointmentType: { id: 'checkup', name: 'Check-up' },
  companion: {
    id: 'patient-handover-story',
    name: 'Milo Hartmann',
    species: 'Dog',
    parent: { id: 'parent-handover-story', name: 'Lena Hartmann' },
  },
};

const OPEN_TASK: Task = {
  _id: 'task-handover-story',
  organisationId: ORG_ID,
  appointmentId: VISIT_ID,
  assignedTo: 'staff-handover-story',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'CARE',
  name: 'Confirm recovery comfort',
  dueAt: new Date('2026-09-28T09:30:00.000Z'),
  status: 'IN_PROGRESS',
};

const meta = {
  title: 'Appointments/NurseHandover',
  component: NurseHandover,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    const previousOrg = useOrgStore.getState();
    const previousAppointments = useAppointmentStore.getState();
    const previousTasks = useTaskStore.getState();
    const previousAuth = useAuthStore.getState();

    useOrgStore.setState({
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
      status: 'loaded',
    });
    useAppointmentStore.setState({
      appointmentsById: { [VISIT_ID]: VISIT },
      appointmentIdsByOrgId: { [ORG_ID]: [VISIT_ID] },
      status: 'loaded',
    });
    useTaskStore.setState({
      tasksById: { [OPEN_TASK._id]: OPEN_TASK },
      taskIdsByOrgId: { [ORG_ID]: [OPEN_TASK._id] },
      status: 'loaded',
    });
    useAuthStore.setState({
      attributes: { sub: 'staff-handover-story', given_name: 'Mira', family_name: 'Patel' },
    });

    return () => {
      useOrgStore.setState(previousOrg, true);
      useAppointmentStore.setState(previousAppointments, true);
      useTaskStore.setState(previousTasks, true);
      useAuthStore.setState(previousAuth, true);
    };
  },
} satisfies Meta<typeof NurseHandover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveVisits: Story = {};
