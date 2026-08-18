import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';
import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';
import Availability from './Availability';

const ORG_ID = 'org-1';

const OWNER_MEMBERSHIP: UserOrganization = {
  id: 'membership-1',
  practitionerReference: 'Practitioner/user-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

const speciality = (name: string): Team['speciality'][number] => ({
  _id: name.toLowerCase().replace(/\s+/g, '-'),
  organisationId: ORG_ID,
  name,
});

const teamMember = (
  id: string,
  name: string,
  role: string,
  status: Team['status'],
  specialities: string[],
  todayAppointment: string,
  weeklyWorkingHours: string
): Team => ({
  _id: id,
  practionerId: `practitioner-${id}`,
  organisationId: ORG_ID,
  name,
  role,
  speciality: specialities.map(speciality),
  todayAppointment,
  weeklyWorkingHours,
  status,
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const TEAM: Team[] = [
  teamMember('t1', 'Dr. Amelia Hart', 'VETERINARIAN', 'Available', ['Cardiology'], '6', '38.5'),
  teamMember('t2', 'Dr. Ravi Menon', 'VETERINARIAN', 'Consulting', ['Dermatology'], '11', '40'),
  teamMember('t3', 'Priya Raman', 'RECEPTIONIST', 'Off-Duty', [], '0', '0'),
  teamMember('t4', 'Tomas Vidal', 'TECHNICIAN', 'Requested', ['Internal Medicine'], '3', '22'),
];

/**
 * Everything the widget shows comes out of two Zustand stores: the team list, and
 * the membership `usePermissions` derives `teams:view:any` from for the surrounding
 * `PermissionGate`. Both are plain stores with no provider and no fetch on read, so
 * seeding them in `beforeEach` — outside any React render — is the whole of the setup.
 *
 * No `autodocs` tag on purpose: the stores are global, so a docs page that mounts
 * every story at once would show whichever one seeded last in all of them.
 */
const seedStores = (team: Team[]) => {
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: OWNER_MEMBERSHIP },
    status: 'loaded',
  });
  useTeamStore.getState().setTeamsForOrg(ORG_ID, team);
};

const meta = {
  title: 'Widgets/Summary/Availability',
  component: Availability,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The dashboard’s team-availability panel: a counted heading, the five status chips, and ' +
          'the shared `AvailabilityTable` (which re-forms into `AvailabilityCard`s below the table ' +
          'breakpoint). Filtering is local — the chips narrow the rows already in the team store ' +
          'rather than refetching. The whole panel sits behind a `teams:view:any` gate, so a role ' +
          'without it sees nothing at all rather than an empty table.\n\n' +
          'The half of this widget that no story had ever drawn is the **`TeamInfo` panel** behind ' +
          'a row’s view control. `TeamInfo` is mounted the whole time — `activeTeam` defaults to ' +
          '`teams[0]` — but its `Modal` renders `<dialog>` without `open`, marked `inert` and ' +
          'translated off-canvas at `translate-x-[120%]`, so the entire drawer was present in the ' +
          'DOM and invisible to every reader and every snapshot. Only `setView(true)` from a row ' +
          'brings it on screen.\n\n' +
          'That is worth more than one interaction: the drawer carries five accordions (Org, ' +
          'Personal, Address and Professional details plus Availability), and it re-forms by ' +
          'breakpoint the same way the table does. Above 1280 the drawer is a 530px right-side ' +
          'panel over a `--color-overlay-backdrop` scrim; below 768 `useIsPhone` swaps it to the ' +
          'full-screen `yc-modal-fullscreen` form. Two quite different layouts, neither previously ' +
          'rendered.\n\n' +
          'The row control is itself two different elements by width, which is why the plays below ' +
          'match on the shape of the label rather than one string: above 1280 it is the table’s ' +
          'round eye button labelled `View availability for <name>`, and below it is the ' +
          '`AvailabilityCard`’s full-width `View` pill. `.table-list` is hidden at ' +
          '`max-width: 1279.98px` and the card list is hidden by `xl:hidden`, so exactly one of ' +
          'the two is ever reachable.',
      },
    },
  },
  beforeEach: () => {
    seedStores(TEAM);
  },
} satisfies Meta<typeof Availability>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Full team',
};

export const Empty: Story = {
  name: 'No team members',
  beforeEach: () => {
    seedStores([]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A brand-new org. The heading still counts — "Availability (0)" — the chips stay ' +
          'interactive, and the table drops to its own empty row rather than collapsing the panel.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone width',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'Below the table breakpoint the rows re-form into `AvailabilityCard`s and the five ' +
          'status chips wrap onto a second line. Same data as `Full team`, so any drift between ' +
          'the two readings of a row shows up as a diff here.',
      },
    },
  },
};

/**
 * Above 1280 the control is the table’s `View availability for <name>` eye button;
 * below it, the card’s plain `View` pill. Both render in DOM order team-first, and
 * CSS hides one of the two, so the first match is always the first member either way.
 */
const clickFirstViewControl = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const [viewControl] = canvas.getAllByRole('button', { name: /^View/ });
  await userEvent.click(viewControl);
  // Matched on `open`, not on `role`: TeamInfo also mounts a closed delete
  // dialog, so a role query would be ambiguous the moment the UA hiding rule
  // is not in play.
  await waitFor(() => expect(document.querySelector('dialog[open]')).toBeInTheDocument());
  return within(document.querySelector('dialog[open]') as HTMLElement);
};

/** The five accordions the drawer is made of, in render order. */
const DRAWER_SECTIONS = [
  'Org details',
  'Personal details',
  'Address details',
  'Professional details',
  'Availability',
];

export const TeamDetail: Story = {
  name: 'Team member drawer (open)',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer this widget exists to open. It is asserted to carry its real content - the ' +
          'member name as the dialog heading, the "Team member" eyebrow, and all five accordions - ' +
          'rather than merely to have gained `open`, because an empty portalled panel satisfies the ' +
          'weaker check and that is exactly how a regression survives.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    // Nothing carries `open` at rest: the drawer is mounted but inert.
    await expect(document.querySelector('dialog[open]')).toBeNull();

    const panel = await clickFirstViewControl(canvasElement);
    await expect(panel.getByRole('heading', { name: 'Dr. Amelia Hart' })).toBeInTheDocument();
    await expect(panel.getByText('Team member')).toBeInTheDocument();

    // Each accordion header is a button labelled with its own title.
    for (const section of DRAWER_SECTIONS) {
      await expect(panel.getByRole('button', { name: section })).toBeInTheDocument();
    }
  },
};

export const TeamDetailPhone: Story = {
  name: 'Team member drawer (phone, full-screen)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'The same drawer below 768, where `useIsPhone` re-forms the right-side panel into the ' +
          'full-screen `yc-modal-fullscreen` layout and the row control is the card’s `View` pill ' +
          'rather than the table’s eye button. Same content, a completely different container - ' +
          'and until now neither had been drawn.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const panel = await clickFirstViewControl(canvasElement);
    await expect(panel.getByRole('heading', { name: 'Dr. Amelia Hart' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Org details' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Availability' })).toBeInTheDocument();
  },
};

export const TeamDetailFiltered: Story = {
  name: 'Drawer opened from a filtered list',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'Chips filter the list, then a row opens the drawer. Worth its own drawing because ' +
          '`setActive` and the chip filter are independent: the drawer must show the member whose ' +
          'row was clicked, not `teams[0]`, and the two only disagree once the list has been ' +
          'narrowed.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Consulting' }));
    const panel = await clickFirstViewControl(canvasElement);
    // The single remaining row is Dr. Ravi Menon, not the default teams[0].
    await expect(panel.getByRole('heading', { name: 'Dr. Ravi Menon' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Personal details' })).toBeInTheDocument();
  },
};
