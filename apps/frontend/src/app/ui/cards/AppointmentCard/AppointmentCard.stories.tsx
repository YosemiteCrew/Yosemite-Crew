import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { Appointment, Organisation } from '@yosemite-crew/types';

import AppointmentCard from './index';
import type { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useOrgStore } from '@/app/stores/orgStore';

const ORG_ID = 'org-storybook';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'TAX-0001',
  isVerified: true,
  isActive: true,
};

const SOAP_INTENT: AppointmentViewIntent = { label: 'prescription', subLabel: 'subjective' };

const BASE_APPOINTMENT: Appointment = {
  id: 'appt-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Maya Whitfield' },
  },
  lead: { id: 'vet-1', name: 'Dr. Elena Marsh' },
  supportStaff: [{ id: 'nurse-1', name: 'Tom Reyes' }],
  room: { id: 'room-1', name: 'Consult 2' },
  appointmentType: {
    id: 'type-1',
    name: 'Wellness exam',
    speciality: { id: 'spec-1', name: 'General practice' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
  concern: 'Annual check-up and vaccination review',
};

const meta = {
  title: 'Cards/AppointmentCard',
  component: AppointmentCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The appointment tile used by the appointments list: companion header, the detail rows, the ' +
          'inpatient/outpatient pill and the status pill, closed by a row of circular actions. Which ' +
          'actions appear depends on the status and on `canEditAppointments` — a requested booking ' +
          'shows only accept/decline, a locked-down role only shows the read actions. The clinical ' +
          'notes action is labelled from the organisation type ("Medical Records" for a hospital, ' +
          '"Care" elsewhere), which the stories seed into the org store.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: BASE_APPOINTMENT,
    canEditAppointments: true,
    handleViewAppointment: fn(),
    handleWorkspaceAppointment: fn(),
    handleRescheduleAppointment: fn(),
    handleChangeStatusAppointment: fn(),
    handleChangeRoomAppointment: fn(),
    getSoapViewIntent: () => SOAP_INTENT,
  },
  argTypes: {
    canEditAppointments: { control: 'boolean' },
  },
  decorators: [
    (StoryFn) => (
      <div className="flex flex-wrap gap-6" style={{ maxWidth: 720 }}>
        <StoryFn />
      </div>
    ),
  ],
  beforeEach: () => {
    // The card resolves its clinical-notes label from the org store. Only
    // `orgsById` is seeded: setting `primaryOrgId` would make the card's
    // content hook start loading the team over the network.
    const snapshot = useOrgStore.getState();
    useOrgStore.setState({ orgsById: { [ORG_ID]: ORG }, orgIds: [ORG_ID], primaryOrgId: null });
    return () => {
      useOrgStore.setState({
        orgsById: snapshot.orgsById,
        orgIds: snapshot.orgIds,
        primaryOrgId: snapshot.primaryOrgId,
      });
    };
  },
} satisfies Meta<typeof AppointmentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Upcoming: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A confirmed booking an editor can act on: view, change status, reschedule, assign room, medical records, finance and labs.',
      },
    },
  },
};

export const Requested: Story = {
  name: 'Requested — needs a response',
  args: {
    appointment: {
      ...BASE_APPOINTMENT,
      status: 'REQUESTED',
      room: undefined,
      concern: 'Limping on the back right leg since yesterday',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'A request replaces the whole action row with the accept (success) and decline (danger) pair — the only two things that can happen to it next.',
      },
    },
  },
};

export const ViewOnly: Story = {
  name: 'Without edit permission',
  args: { canEditAppointments: false },
  parameters: {
    docs: {
      description: {
        story:
          'Without `canEditAppointments` the mutating actions disappear and the row keeps only view, records, finance and labs.',
      },
    },
  },
};

export const LongValues: Story = {
  name: 'Long names and reason',
  args: {
    appointment: {
      ...BASE_APPOINTMENT,
      patient: {
        id: 'companion-2',
        name: 'Bartholomew Fitzgerald the Third',
        species: 'dog',
        breed: 'Bernese Mountain Dog / Great Pyrenees cross',
        parent: { id: 'parent-2', name: 'Alexandra Konstantinopoulos' },
      },
      appointmentType: {
        id: 'type-2',
        name: 'Post-operative orthopaedic recheck and bandage change',
        speciality: { id: 'spec-2', name: 'Orthopaedic surgery' },
      },
      room: { id: 'room-2', name: 'Surgical prep and recovery suite' },
      concern:
        'Recheck of the cranial cruciate ligament repair, bandage change and a review of the pain relief plan',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Overflow guard: long companion, breed, service and room values must not push the card wider or break the action row.',
      },
    },
  },
};
