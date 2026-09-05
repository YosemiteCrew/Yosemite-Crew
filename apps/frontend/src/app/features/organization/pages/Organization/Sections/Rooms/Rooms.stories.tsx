import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type {
  Organisation,
  OrganisationRoom,
  Speciality,
  UserOrganization,
} from '@yosemite-crew/types';

import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useTeamStore } from '@/app/stores/teamStore';
import Rooms from './Rooms';

const ORG_ID = 'org-storybook-rooms-section';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

const OWNER: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-marsh',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

/**
 * Every shipped role holds `room:edit:any`, so the only way to reach the
 * read-only header is an explicit revocation on the membership - which is a
 * real configuration, and the one `resolveMembershipPermissions` subtracts
 * after the role baseline.
 */
const OWNER_ROOMS_REVOKED: UserOrganization = {
  ...OWNER,
  id: 'membership-owner-revoked',
  revokedPermissions: ['room:edit:any'],
};

const SPECIALITIES: Speciality[] = [
  { _id: 'spec-surgery', organisationId: ORG_ID, name: 'Surgery', isActive: true },
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
];

/**
 * Three rooms chosen to cover all three branches of `roomMeta`: capabilities
 * win over assigned specialities, an assigned speciality is the fallback, and a
 * room with neither reads "No schedule set" rather than rendering a blank line.
 */
const ROOMS: OrganisationRoom[] = [
  {
    id: 'room-consult-1',
    name: 'Consult 1',
    organisationId: ORG_ID,
    code: 'C1',
    type: 'EXAM_ROOM',
    availabilityMode: 'WORKING_HOURS',
    availabilityDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    capabilities: ['Ultrasound', 'Dental X-ray'],
  },
  {
    id: 'room-theatre-a',
    name: 'Theatre A',
    organisationId: ORG_ID,
    code: 'TA',
    type: 'SURGERY',
    availabilityMode: 'ALL_DAY',
    assignedSpecialiteis: [{ id: 'spec-surgery', name: 'Surgery' }],
  },
  {
    id: 'room-isolation',
    name: 'Isolation bay',
    organisationId: ORG_ID,
    code: 'IB',
    type: 'ISOLATION',
  },
];

/**
 * Seeds the real stores rather than mocking the hooks. `useRoomsForPrimaryOrg`
 * is a pure store selector - the fetch lives in `useLoadRoomsForPrimaryOrg`,
 * which this section never calls - so the list mounts with no network at all.
 * `status: 'loaded'` matters: `usePermissions` reports `isLoading` while the org
 * store is `idle`, and the gate then renders its null skeleton instead of either
 * the section or the fallback.
 */
const seed =
  ({
    membership = OWNER,
    rooms = ROOMS,
  }: { membership?: UserOrganization; rooms?: OrganisationRoom[] } = {}) =>
  () => {
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership },
      status: 'loaded',
    });
    useOrganisationRoomStore.getState().setRoomsForOrg(ORG_ID, rooms);
    useSpecialityStore.getState().setSpecialitiesForOrg(ORG_ID, SPECIALITIES);
    useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAMS);

    return () => {
      useOrgStore.setState({
        orgsById: {},
        orgIds: [],
        primaryOrgId: null,
        membershipsByOrgId: {},
        status: 'idle',
      });
      useOrganisationRoomStore.setState({ roomsById: {}, roomIdsByOrgId: {} });
      useSpecialityStore.setState({ specialitiesById: {}, specialityIdsByOrgId: {} });
      useTeamStore.setState({ teamsById: {}, teamIdsByOrgId: {} });
    };
  };

/**
 * The Add-room drawer and the room detail drawer both portal to `document.body`
 * and are both mounted from the first render - only the `open` attribute moves -
 * so presence has to be counted on `dialog[open]`.
 */
const openDialogs = () => Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];

const meta = {
  title: 'Organization/Rooms',
  component: Rooms,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/organization' } },
    docs: {
      description: {
        component:
          'The rooms list on the organisation page. The populated list is the only part that ' +
          'was ever visible in Storybook: the empty branch needs an org with no rooms, and the ' +
          '"+ Add room" path needs `room:edit:any` plus a click.\n\n' +
          'Each row is one button spanning the whole width, so the hit target is the row rather ' +
          'than the name - and the trailing meta line is `hidden sm:block`, which means the ' +
          'schedule and capability summary simply is not there below 640px.\n\n' +
          'That meta line is three rules deep and reads as one sentence, so it is the part ' +
          'worth reviewing: capabilities beat assigned specialities, four or more days collapse ' +
          'to a `Mon–Fri` range while three or fewer are listed, `ALL_DAY` short-circuits to ' +
          '"Every day", and a room with nothing configured falls back to "No schedule set" ' +
          'rather than rendering an empty span.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[420px] w-[860px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof Rooms>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RoomList: Story = {
  name: 'Rooms list',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Rooms (3)' })).toBeInTheDocument();

    /* Assert the whole row button, not the name. The name, the lowercased type
       and the meta line are three independent derivations of the same record,
       and checking them separately passes with the meta of one room rendered
       against the name of another. */
    await expect(canvas.getByRole('button', { name: /^View Consult 1 details$/ }).textContent).toBe(
      'Consult 1 · exam roomMon–Fri · Ultrasound, Dental X-ray'
    );
    // No capabilities: the assigned speciality is the fallback half of the line.
    await expect(canvas.getByRole('button', { name: /^View Theatre A details$/ }).textContent).toBe(
      'Theatre A · surgeryEvery day · Surgery'
    );
    // Neither: the sentence is a fallback, not an empty string.
    await expect(
      canvas.getByRole('button', { name: /^View Isolation bay details$/ }).textContent
    ).toBe('Isolation bay · isolationNo schedule set');

    await expect(canvas.getByRole('button', { name: '+ Add room' })).toBeInTheDocument();
    await expect(openDialogs()).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting list. The leading glyph is chosen by room type - the scissors cover ' +
          'surgery and grooming, the bed covers the four in-patient types, and everything ' +
          'unmatched gets the medkit - so a new room type added to the enum silently inherits ' +
          'the medkit rather than failing.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No rooms added yet',
  beforeEach: seed({ rooms: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No rooms added yet.')).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Rooms (0)' })).toBeInTheDocument();
    // Empty replaces the whole <ul>, so there is no row left to click.
    await expect(canvas.queryAllByRole('button', { name: /^View .* details$/ })).toHaveLength(0);
    // The section still offers the way out of the empty state.
    await expect(canvas.getByRole('button', { name: '+ Add room' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A loaded org with no rooms. `activeRoom` is `null` here, which is what keeps the ' +
          'detail drawer from mounting at all - so this state has one fewer dialog in the DOM ' +
          'than the populated one, not merely a closed one.',
      },
    },
  },
};

export const AddRoomDrawer: Story = {
  name: '+ Add room opens the drawer',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(openDialogs()).toHaveLength(0);

    await userEvent.click(canvas.getByRole('button', { name: '+ Add room' }));

    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(openDialogs()[0]);
    await expect(panel.getByRole('heading', { name: 'New room' })).toBeVisible();
    /* The drawer's speciality and staff pickers read the same seeded stores the
       list rows do, so the options are real rather than placeholders. The
       footer action is queried inside the dialog rather than on the canvas
       because the section's own "+ Add room" link is still there behind the
       scrim. */
    await expect(panel.getByRole('button', { name: 'Basic details' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    /* All four collapsible sections, named. The unit section carries its own
       draft count in the header, so `Unit type (0)` is also the assertion that
       the drawer opened EMPTY rather than holding drafts from a previous open -
       a shared-state bug that a "the drawer appeared" check cannot see. */
    for (const section of [
      'Basic details',
      'Availability',
      'Unit type (0)',
      'Equipments / Capabilities',
    ]) {
      await expect(panel.getByRole('button', { name: section })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    }
    await expect(panel.getByRole('button', { name: 'New room' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The header action is a text link rather than a filled pill - the design keeps the ' +
          'filled `--cta` treatment for the Team section, which is the one that spends money on ' +
          'a seat. Both sit in the same header row shape, so the difference only shows with the ' +
          'two sections side by side.',
      },
    },
  },
};

export const WithoutEditPermission: Story = {
  name: 'Add hidden without room:edit:any',
  beforeEach: seed({ membership: OWNER_ROOMS_REVOKED }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: '+ Add room' })).not.toBeInTheDocument();
    // `room:view:any` survives the revocation, so the list itself is untouched.
    await expect(canvas.getByRole('heading', { name: 'Rooms (3)' })).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: /^View .* details$/ })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same flag also travels into the detail drawer as `canEditRoom`, so this is not ' +
          'only a missing header link - the rows still open, read-only.',
      },
    },
  },
};
