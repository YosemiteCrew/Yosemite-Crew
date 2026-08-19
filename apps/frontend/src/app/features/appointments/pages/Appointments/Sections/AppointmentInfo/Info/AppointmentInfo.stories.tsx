import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment, OrganisationRoom, Service, Speciality } from '@yosemite-crew/types';

import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useServiceStore } from '@/app/stores/serviceStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useTeamStore } from '@/app/stores/teamStore';
import AppointmentInfo from './AppointmentInfo';

const ORG_ID = 'org-storybook-info';
const SPECIALITY_ID = 'spec-general';
const SERVICE_ID = 'svc-annual';
const ROOM_ID = 'room-consult-2';

const APPOINTMENT: Appointment = {
  id: 'appt-info-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'vet-1', name: 'Dr. Weber' },
  supportStaff: [{ id: 'tech-1', name: 'Ana Silva' }],
  room: { id: ROOM_ID, name: 'Consult 2' },
  appointmentType: {
    id: SERVICE_ID,
    name: 'Annual check-up',
    speciality: { id: SPECIALITY_ID, name: 'General practice' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '10:30 - 11:00',
  durationMinutes: 30,
  status: 'UPCOMING',
  concern: 'Limping on the left hind leg since Sunday.',
};

const ROOMS: OrganisationRoom[] = [
  {
    id: ROOM_ID,
    name: 'Consult 2',
    organisationId: ORG_ID,
    code: 'C2',
    type: 'CONSULTATION',
  },
  {
    id: 'room-consult-3',
    name: 'Consult 3',
    organisationId: ORG_ID,
    code: 'C3',
    type: 'CONSULTATION',
  },
];

const SPECIALITY: Speciality = {
  _id: SPECIALITY_ID,
  organisationId: ORG_ID,
  name: 'General practice',
  isActive: true,
};

const SERVICE: Service = {
  id: SERVICE_ID,
  organisationId: ORG_ID,
  name: 'Annual check-up',
  durationMinutes: 30,
  cost: 82,
  specialityId: SPECIALITY_ID,
  isActive: true,
};

const TEAM: Team[] = [
  {
    _id: 'team-1',
    practionerId: 'vet-1',
    organisationId: ORG_ID,
    name: 'Dr. Weber',
    role: 'VETERINARIAN',
    speciality: [],
    status: 'Available',
    revokedPermissions: [],
    effectivePermissions: [],
    extraPerissions: [],
  },
];

/**
 * Seeds the five stores this section reads and restores them on unmount.
 *
 * Two requests still leave the component on mount and neither is stubbed, because
 * neither can change what is drawn: `useLoadRoomsForPrimaryOrg({ force: true, silent:
 * true })` only writes the room store on success, and the slot lookup that fires when
 * edit mode opens `catch`es into `timeSlots: []` - which is the same empty list the
 * form starts with. That is what makes the edit-mode stories below deterministic
 * without any MSW wiring, and it is also the honest state: a slot list this form
 * cannot fetch is exactly what a vet sees when availability is unreachable.
 */
const seed = () => {
  const orgSnapshot = useOrgStore.getState();
  const roomSnapshot = useOrganisationRoomStore.getState();
  const teamSnapshot = useTeamStore.getState();
  const specialitySnapshot = useSpecialityStore.getState();
  const serviceSnapshot = useServiceStore.getState();

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgsById: { [ORG_ID]: { _id: ORG_ID, type: 'HOSPITAL' } as never },
    status: 'loaded',
  });
  useOrganisationRoomStore.setState({
    roomsById: Object.fromEntries(ROOMS.map((item) => [item.id, item])),
    roomIdsByOrgId: { [ORG_ID]: ROOMS.map((item) => item.id) },
    roomUnitsById: {},
    roomUnitIdsByRoomId: {},
    status: 'loaded',
  });
  useTeamStore.setState({
    teamsById: { 'team-1': TEAM[0] },
    teamIdsByOrgId: { [ORG_ID]: ['team-1'] },
    status: 'loaded',
  });
  useSpecialityStore.setState({
    specialitiesById: { [SPECIALITY_ID]: SPECIALITY },
    specialityIdsByOrgId: { [ORG_ID]: [SPECIALITY_ID] },
  });
  useServiceStore.setState({
    servicesById: { [SERVICE_ID]: SERVICE },
    serviceIdsBySpecialityId: { [SPECIALITY_ID]: [SERVICE_ID] },
  });

  return () => {
    useOrgStore.setState(orgSnapshot);
    useOrganisationRoomStore.setState(roomSnapshot);
    useTeamStore.setState(teamSnapshot);
    useSpecialityStore.setState(specialitySnapshot);
    useServiceStore.setState(serviceSnapshot);
  };
};

const EDIT_PENCIL = 'Edit Appointments details';

const meta = {
  title: 'Appointments/AppointmentInfo (Info tab)',
  component: AppointmentInfo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Appointment tab inside the appointment detail modal. Its resting form is a plain ' +
          'list of label/value rows - and the pencil on the accordion replaces the whole list ' +
          'with a form, which had never been drawn.\n\n' +
          'The swap is not one form but two, chosen by status. `allowReschedule` is true only ' +
          'for REQUESTED and UPCOMING, and it decides whether Speciality, Service and the ' +
          'entire date/slot/lead block are editable controls or `ReadOnlyEditField` boxes. A ' +
          'checked-in appointment therefore opens an "edit" form in which most fields cannot be ' +
          'edited at all, which is the single most surprising thing on this surface and the one ' +
          'a snapshot of the resting rows can never show. Room and Status are gated ' +
          'independently again, on `canAssignAppointmentRoom` and on whether the status has any ' +
          'onward transition.\n\n' +
          'Validation only exists after Save is pressed: `validateAppointmentForm` short-' +
          'circuits entirely when the status is not reschedulable, so the same button is a ' +
          'silent save on one status and a wall of field errors on another.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeAppointment: APPOINTMENT,
    canEditAppointments: true,
  },
  decorators: [
    (Story) => (
      <div className="max-w-[560px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed,
} satisfies Meta<typeof AppointmentInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnlyRows: Story = {
  name: 'Resting rows',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Nine rows, in the order getAppointmentFields declares them.
    const labels = [
      'Reason',
      'Room',
      'Speciality',
      'Service',
      'Date',
      'Time',
      'Status',
      'Lead',
      'Staff',
    ];
    labels.forEach((label) => {
      expect(canvas.getByText(label)).toBeInTheDocument();
    });

    // Values, not just labels. Room is resolved through the seeded room list rather
    // than read off the appointment, so an unseeded store would render '-' here.
    await expect(
      canvas.getByText('Limping on the left hind leg since Sunday.')
    ).toBeInTheDocument();
    await expect(canvas.getByText('Consult 2')).toBeInTheDocument();
    await expect(canvas.getByText('General practice')).toBeInTheDocument();
    await expect(canvas.getByText('Dr. Weber')).toBeInTheDocument();
    await expect(canvas.getByText('Ana Silva')).toBeInTheDocument();
    // Status is the one row rendered as a pill instead of text.
    await expect(canvas.getByText('Upcoming')).toBeInTheDocument();

    // No form yet.
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: EDIT_PENCIL })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The tab as it opens. Every row is a `border-t` divider pair, and the Status row is ' +
          'the only one that is not text - it renders a `StatusPill` toned from the status, ' +
          'which is why it survives the switch to edit mode looking completely different.',
      },
    },
  },
};

export const EditModeReschedulable: Story = {
  name: 'Edit mode - upcoming (fully editable)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: EDIT_PENCIL }));

    // The label/value rows are gone, replaced by controls carrying the same values.
    await waitFor(() => {
      expect(canvas.queryByRole('button', { name: EDIT_PENCIL })).not.toBeInTheDocument();
    });

    // Speciality and Service are live dropdowns; the trigger's accessible name is
    // "<placeholder>: <selected>", so it doubles as the value assertion.
    await expect(
      canvas.getByRole('button', { name: 'Speciality: General practice' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Service: Annual check-up' })
    ).toBeInTheDocument();

    // The whole scheduling block appears: date, time, lead, support.
    await expect(canvas.getByLabelText('Date')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Time')).toHaveValue('');
    await expect(canvas.getByRole('button', { name: 'Lead' })).toBeInTheDocument();

    // Room and Status stay editable at this status.
    await expect(canvas.getByRole('button', { name: 'Room: Consult 2' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Status: Upcoming' })).toBeInTheDocument();

    // The footer only exists in edit mode.
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full form. Time is empty because the availability lookup for this service and ' +
          'date returns nothing here - the same thing a vet sees when the slot endpoint is ' +
          'unreachable - and the form is honest about it rather than pre-filling the booked ' +
          'time, which is why Save then refuses.',
      },
    },
  },
};

export const EditValidation: Story = {
  name: 'Edit mode - Save with no slot',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: EDIT_PENCIL }));
    const save = await canvas.findByRole('button', { name: 'Save' });

    await userEvent.click(save);

    // The error is attached to the Time field, not to the Slotpicker above it.
    const slotError = await canvas.findByText('Please select a slot');
    await expect(slotError).toBeInTheDocument();
    await expect(canvas.getByLabelText('Time')).toHaveAttribute('aria-invalid', 'true');

    // Save does not leave edit mode when it refuses, so the form is still open with
    // its values intact - an early return, not a partial save.
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Speciality: General practice' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only path to inline validation on this form. `validateAppointmentForm` runs on ' +
          'Save alone, so the first sign anything is missing is this line under Time - and the ' +
          'lead error it can also produce is mutually exclusive with it, since a missing slot ' +
          'returns before the lead is ever checked.',
      },
    },
  },
};

export const EditModeNotReschedulable: Story = {
  name: 'Edit mode - checked in (mostly read-only)',
  args: { activeAppointment: { ...APPOINTMENT, status: 'CHECKED_IN' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: EDIT_PENCIL }));
    expect(await canvas.findByRole('button', { name: 'Save' })).toBeEnabled();

    // Speciality, Service, Date, Time, Lead and Staff are all boxes now, not controls.
    await expect(canvas.queryByRole('button', { name: /^Speciality/ })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Service/ })).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText('Time')).not.toBeInTheDocument();
    await expect(canvas.getByText('General practice')).toBeInTheDocument();
    await expect(canvas.getByText('Annual check-up')).toBeInTheDocument();
    await expect(canvas.getByText('Dr. Weber')).toBeInTheDocument();

    // Room and Status remain editable: a checked-in patient still gets moved rooms and
    // still progresses to In progress.
    await expect(canvas.getByRole('button', { name: 'Room: Consult 2' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Status: Checked in' })).toBeInTheDocument();

    // The concern textarea is the one field that is editable at every status.
    await expect(canvas.getByLabelText('Describe concern')).toHaveValue(
      'Limping on the left hind leg since Sunday.'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The other edit form. Same pencil, same Save/Cancel footer, but six of the nine ' +
          'fields have become `ReadOnlyEditField` boxes on `card-hover/40` - a different ' +
          'component with a different shape from the rows behind it. Reviewers should look at ' +
          'whether it reads as "locked" rather than as an unstyled input.',
      },
    },
  },
};

export const CancelRestoresRows: Story = {
  name: 'Cancel returns to the rows',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: EDIT_PENCIL }));
    const concern = await canvas.findByLabelText('Describe concern');
    await userEvent.clear(concern);
    await userEvent.type(concern, 'Typed but discarded');

    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });
    // Cancel dispatches a full RESET off the appointment, so the typed value is gone
    // and the original reason is back - not merely hidden behind the rows.
    await expect(
      canvas.getByText('Limping on the left hind leg since Sunday.')
    ).toBeInTheDocument();
    await expect(canvas.queryByText('Typed but discarded')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: EDIT_PENCIL })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The discard path. It is a reducer RESET rather than a flag flip, which is the only ' +
          'reason a half-typed reason does not survive into the next open.',
      },
    },
  },
};

export const WithoutEditPermission: Story = {
  name: 'Without appointment-edit rights',
  args: { canEditAppointments: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // No pencil at all, so the edit form is unreachable rather than disabled.
    await expect(canvas.queryByRole('button', { name: EDIT_PENCIL })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    /* The full nine rows still render, with their values. The read-only case differs
       from the editable one by exactly one control, so listing the rows is what proves
       the section is intact rather than collapsed - a permission check that bailed out
       early would also remove the pencil. */
    const labels = [
      'Reason',
      'Room',
      'Speciality',
      'Service',
      'Date',
      'Time',
      'Status',
      'Lead',
      'Staff',
    ];
    labels.forEach((label) => {
      expect(canvas.getByText(label)).toBeInTheDocument();
    });
    await expect(
      canvas.getByText('Limping on the left hind leg since Sunday.')
    ).toBeInTheDocument();
    await expect(canvas.getByText('Consult 2')).toBeInTheDocument();
    await expect(canvas.getByText('General practice')).toBeInTheDocument();
    await expect(canvas.getByText('Dr. Weber')).toBeInTheDocument();
    await expect(canvas.getByText('Upcoming')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Read-only for a role without appointment edit. The accordion keeps its title and ' +
          'its chevron and loses only the pencil, which is worth a look: nothing else on the ' +
          'row signals that the section is locked.',
      },
    },
  },
};
