import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type {
  Organisation,
  OrganisationRoom,
  RoomUnitGroup,
  Speciality,
  UserOrganization,
} from '@yosemite-crew/types';

import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useTeamStore } from '@/app/stores/teamStore';
import RoomInfo from './RoomInfo';

const ORG_ID = 'org-storybook-room-info';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isActive: true,
};

const OWNER: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-marsh',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

const SPECIALITIES: Speciality[] = [
  { _id: 'spec-surgery', organisationId: ORG_ID, name: 'Surgery', isActive: true },
  { _id: 'spec-derm', organisationId: ORG_ID, name: 'Dermatology', isActive: true },
];

const TEAMS: Team[] = [
  {
    _id: 'team-marsh',
    practionerId: 'vet-marsh',
    organisationId: ORG_ID,
    name: 'Dr. Elena Marsh',
    role: 'VETERINARIAN',
    speciality: [],
    status: 'Available',
    revokedPermissions: [],
    effectivePermissions: [],
    extraPerissions: [],
  },
  {
    _id: 'team-lindqvist',
    practionerId: 'nurse-lindqvist',
    organisationId: ORG_ID,
    name: 'Nurse Lindqvist',
    role: 'NURSE',
    speciality: [],
    status: 'Available',
    revokedPermissions: [],
    effectivePermissions: [],
    extraPerissions: [],
  },
];

const CONSULT_ROOM: OrganisationRoom = {
  id: 'room-consult-1',
  name: 'Consult 1',
  organisationId: ORG_ID,
  code: 'C1',
  type: 'EXAM_ROOM',
  assignedSpecialiteis: [{ id: 'spec-surgery', name: 'Surgery' }],
  assignedStaffs: [{ id: 'vet-marsh', name: 'Dr. Elena Marsh' }],
  availableNow: true,
  availabilityMode: 'CUSTOM',
  availabilityDays: ['MON_FRI'],
  availabilityStartTime: '09:00',
  availabilityEndTime: '17:30',
  capabilities: ['Otoscope', 'Digital scale'],
};

const ICU_WARD: OrganisationRoom = {
  id: 'room-icu',
  name: 'ICU ward',
  organisationId: ORG_ID,
  code: 'ICU',
  type: 'ICU',
  assignedStaffs: [{ id: 'nurse-lindqvist', name: 'Nurse Lindqvist' }],
  availableNow: true,
  availabilityMode: 'ALL_DAY',
  capabilities: ['Oxygen cage', 'Syringe drivers'],
};

/** The kennel groups the ward is divided into; the units section is built from these. */
const ICU_UNIT_GROUPS: RoomUnitGroup[] = [
  {
    id: 'group-large',
    organisationId: ORG_ID,
    roomId: ICU_WARD.id,
    name: 'Kennel A',
    size: 'Large',
    unitCount: 2,
  },
  {
    id: 'group-medium',
    organisationId: ORG_ID,
    roomId: ICU_WARD.id,
    name: 'Kennel B',
    size: 'Medium',
    unitCount: 3,
  },
];

/**
 * Seeds the real stores rather than mocking the controller's hooks:
 * `useTeamForPrimaryOrg` and `useSpecialitiesForPrimaryOrg` are pure selectors,
 * and the unit groups are read straight off the room store. `status: 'loaded'`
 * on the org store matters - the drawer's own permission read reports loading
 * while it is `idle`.
 */
const seed =
  ({ unitGroups = [] }: { unitGroups?: RoomUnitGroup[] } = {}) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const roomSnapshot = useOrganisationRoomStore.getState();
    const specialitySnapshot = useSpecialityStore.getState();
    const teamSnapshot = useTeamStore.getState();

    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: OWNER },
      status: 'loaded',
    });
    useOrganisationRoomStore.getState().setRoomsForOrg(ORG_ID, [CONSULT_ROOM, ICU_WARD]);
    useOrganisationRoomStore.getState().setRoomUnitGroupsForRoom(ICU_WARD.id, unitGroups);
    useSpecialityStore.getState().setSpecialitiesForOrg(ORG_ID, SPECIALITIES);
    useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAMS);

    return () => {
      useTeamStore.setState(teamSnapshot);
      useSpecialityStore.setState(specialitySnapshot);
      useOrganisationRoomStore.setState(roomSnapshot);
      useOrgStore.setState(orgSnapshot);
    };
  };

/**
 * `showModal` is a prop whose setter lives on the Rooms page. Handing it a
 * plain mock leaves the close and discard paths dead, so the harness gives the
 * flag somewhere to live - the way the page does.
 */
const RoomInfoHarness = (args: ComponentProps<typeof RoomInfo>) => {
  const [showModal, setShowModal] = useState(args.showModal);
  return <RoomInfo {...args} showModal={showModal} setShowModal={setShowModal} />;
};

/** Only `<dialog open>` is painted; the closed confirms stay mounted and inert. */
const openDialogs = () => Array.from(document.querySelectorAll<HTMLElement>('dialog[open]'));

const findOpenDialogTitled = (title: string): HTMLElement => {
  const match = openDialogs().find((dialog) =>
    within(dialog).queryByRole('heading', { name: title })
  );
  if (!match) throw new Error(`No open dialog titled "${title}"`);
  return match;
};

const meta = {
  title: 'Organization/RoomInfo',
  component: RoomInfo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The room detail drawer as the Rooms section mounts it: `RoomInfoContent` driven by ' +
          '`useRoomInfoController`, which owns the view / edit mode, the draft, the dirty ' +
          'check and the two confirms.\n\n' +
          'The controller is what turns a stored `OrganisationRoom` into the form the drawer ' +
          'shows, and that translation is the part worth reviewing: `availabilityDays[0]` ' +
          'becomes the days label, `capabilities` becomes the equipment list, the assigned ' +
          'speciality and staff references are resolved to names through the speciality and ' +
          'team stores, and - for ICU, inpatient, isolation and boarding rooms only - the ' +
          "room's unit groups become the kennels in the Unit type section.\n\n" +
          'The presentational drawer with fully mocked setters is storied under ' +
          'Organization/RoomInfoContent. These stories seed the stores the controller reads ' +
          'and open the real thing.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: () => {},
    activeRoom: CONSULT_ROOM,
    canEditRoom: true,
  },
  render: (args) => <RoomInfoHarness {...args} />,
  beforeEach: seed(),
} satisfies Meta<typeof RoomInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {
  name: 'Detail drawer (view)',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const drawer = within(findOpenDialogTitled('Consult 1'));

    // The type appears twice on purpose: header meta and a Details row.
    await expect(drawer.getAllByText('Exam room')).toHaveLength(2);
    // References resolved to names through the seeded stores, not printed as ids.
    await expect(drawer.getByText('Surgery')).toBeInTheDocument();
    await expect(drawer.getByText('Dr. Elena Marsh')).toBeInTheDocument();
    await expect(drawer.queryByText('spec-surgery')).not.toBeInTheDocument();
    // `availabilityDays[0]` and `capabilities` become the labels.
    await expect(drawer.getByText('Mon - Fri')).toBeInTheDocument();
    await expect(drawer.getByText('09:00 - 17:30')).toBeInTheDocument();
    await expect(drawer.getByText('Otoscope, Digital scale')).toBeInTheDocument();

    await expect(drawer.getByRole('button', { name: 'Edit room' })).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Delete room' })).toBeInTheDocument();
    await expect(drawer.queryByRole('textbox')).toBeNull();
  },
};

export const EditMode: Story = {
  name: 'Editing the room',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    await userEvent.click(
      within(findOpenDialogTitled('Consult 1')).getByRole('button', { name: 'Edit room' })
    );

    const drawer = within(findOpenDialogTitled('Edit room'));
    await expect(drawer.getAllByRole('textbox').length).toBeGreaterThan(0);
    await expect(drawer.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    await expect(drawer.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    // The pencil is gone - you are already editing - but the trash stays.
    await expect(drawer.queryByRole('button', { name: 'Edit room' })).toBeNull();
    await expect(drawer.getByRole('button', { name: 'Delete room' })).toBeInTheDocument();
  },
};

export const DeleteConfirm: Story = {
  name: 'Nested confirm: Delete room?',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    await userEvent.click(
      within(findOpenDialogTitled('Consult 1')).getByRole('button', { name: 'Delete room' })
    );

    // Two painted dialogs: the confirm is a sibling of the drawer on document.body.
    await waitFor(() => expect(openDialogs()).toHaveLength(2));
    const confirm = within(findOpenDialogTitled('Delete room?'));
    await expect(confirm.getByText('Consult 1')).toBeInTheDocument();
    await expect(confirm.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    // Cancelling keeps the drawer.
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    await expect(findOpenDialogTitled('Consult 1')).toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { canEditRoom: false },
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const drawer = within(findOpenDialogTitled('Consult 1'));
    // Both header chips are dropped, not disabled.
    await expect(drawer.queryByRole('button', { name: 'Edit room' })).toBeNull();
    await expect(drawer.queryByRole('button', { name: 'Delete room' })).toBeNull();
    await expect(drawer.getByText('Dr. Elena Marsh')).toBeInTheDocument();
  },
};

export const WardWithUnits: Story = {
  name: 'ICU ward built from its unit groups',
  args: { activeRoom: ICU_WARD },
  beforeEach: seed({ unitGroups: ICU_UNIT_GROUPS }),
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const drawer = within(findOpenDialogTitled('ICU ward'));

    // Two groups become two kennels, and their counts sum into the total.
    await expect(drawer.getByText('Unit type (2)')).toBeInTheDocument();
    await expect(drawer.getAllByText('Kennel A')).toHaveLength(2);
    await expect(drawer.getAllByText('Kennel B')).toHaveLength(2);
    await expect(drawer.getByText('Nurse Lindqvist')).toBeInTheDocument();
    await expect(drawer.getByText('Oxygen cage, Syringe drivers')).toBeInTheDocument();
  },
};

export const Closed: Story = {
  name: 'Closed (nothing painted)',
  args: { showModal: false },
  play: async () => {
    // The drawer stays mounted but inert; nothing is painted until it opens.
    await expect(openDialogs()).toHaveLength(0);
  },
};
