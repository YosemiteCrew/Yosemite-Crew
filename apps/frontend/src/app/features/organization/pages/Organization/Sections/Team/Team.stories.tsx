import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, Speciality, UserOrganization } from '@yosemite-crew/types';

import type { Team as TeamMember } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useTeamStore } from '@/app/stores/teamStore';
import Team from './Team';

const ORG_ID = 'org-storybook-team';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
};

/** Real role codes, so permissions resolve from the shipped role table rather than a stub. */
const OWNER: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-marsh',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

/** RECEPTIONIST holds `teams:view:any` but not `teams:edit:any`. */
const RECEPTIONIST: UserOrganization = {
  ...OWNER,
  id: 'membership-reception',
  roleCode: 'RECEPTIONIST',
};

const speciality = (id: string, name: string): Speciality => ({
  _id: id,
  organisationId: ORG_ID,
  name,
  isActive: true,
});

const SPECIALITIES: Speciality[] = [
  speciality('spec-cardiology', 'Cardiology'),
  speciality('spec-internal', 'Internal medicine'),
];

/**
 * `employmentType` is read off the record through a cast in `employmentLabel`,
 * so it is not on the `Team` type. The fixture carries it the same way the API
 * response does.
 */
type TeamFixture = TeamMember & { employmentType?: string };

const member = (over: Partial<TeamFixture> & Pick<TeamFixture, '_id' | 'name'>): TeamFixture => ({
  practionerId: `practitioner-${over._id}`,
  organisationId: ORG_ID,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
  ...over,
});

/**
 * Three members chosen to cover all three `teamStatusPill` branches and both
 * `employmentLabel` branches in one screen: a raw status passed through, the
 * "Requested" -> INVITED rename, the "Off-Duty" -> OFF DUTY muted pill, and the
 * em-dash fallback for a member with no employment type on file.
 */
const TEAMS: TeamFixture[] = [
  member({
    _id: 'team-marsh',
    name: 'Dr. Elena Marsh',
    speciality: [SPECIALITIES[0]],
    employmentType: 'FULL_TIME',
    status: 'Consulting',
  }),
  member({
    _id: 'team-raman',
    name: 'Priya Raman',
    role: 'TECHNICIAN',
    speciality: [SPECIALITIES[1]],
    employmentType: 'PART_TIME',
    status: 'Requested',
  }),
  member({
    _id: 'team-reyes',
    name: 'Tom Reyes',
    role: 'RECEPTIONIST',
    status: 'Off-Duty',
  }),
];

/**
 * Seeds the real stores rather than mocking the hooks.
 *
 * `useTeamForPrimaryOrg` is a pure store selector - the fetch lives in the
 * separate `useLoadTeam`, which this section does not call - so the roster
 * mounts off the network with no service stub at all. `status: 'loaded'` is
 * load-bearing: `usePermissions` reports `isLoading` while the org store is
 * `idle`, and a loading `PermissionGate` renders its (null) skeleton, which
 * would leave every story here blank rather than denied.
 */
const seed =
  ({
    membership = OWNER,
    teams = TEAMS,
  }: { membership?: UserOrganization; teams?: TeamFixture[] } = {}) =>
  () => {
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership },
      status: 'loaded',
    });
    useTeamStore.getState().setTeamsForOrg(ORG_ID, teams);
    useSpecialityStore.getState().setSpecialitiesForOrg(ORG_ID, SPECIALITIES);

    return () => {
      useOrgStore.setState({
        orgsById: {},
        orgIds: [],
        primaryOrgId: null,
        membershipsByOrgId: {},
        status: 'idle',
      });
      useTeamStore.setState({ teamsById: {}, teamIdsByOrgId: {} });
      useSpecialityStore.setState({ specialitiesById: {}, specialityIdsByOrgId: {} });
    };
  };

/**
 * Both panels portal to `document.body`, so neither is inside `canvasElement`,
 * and a closed one stays MOUNTED without its `open` attribute - absence has to
 * be asserted against `dialog[open]`.
 */
const openDialogs = () => Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];

/** The five-cell row that holds a member, given any text inside it. */
const rowOf = (inside: HTMLElement): HTMLElement => inside.closest('div.grid') as HTMLElement;

const meta = {
  title: 'Organization/Team',
  component: Team,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/organization' } },
    docs: {
      description: {
        component:
          'The team roster on the organisation page. Everything except the populated table was ' +
          'unreachable in Storybook, because all of it is behind either a permission or a ' +
          'store shape: the empty branch needs an org with no members, the invite pill needs ' +
          '`teams:edit:any` **and** a verified org, and both drawers only exist after a ' +
          'click.\n\n' +
          'The invite affordance is an AND of two unrelated things, which is easy to lose in a ' +
          'refactor: `canEditTeam && isVerified`. A verified clinic whose signed-in user is a ' +
          'receptionist and an unverified clinic owned by the signed-in user render the same ' +
          'header, for two entirely different reasons, and both are drawn below.\n\n' +
          'The row is a five-track CSS grid, not a table - `1.6fr 1fr 1fr 110px 44px` shared ' +
          'between the header band and every row. Nothing enforces that agreement, so a header ' +
          'that grows a sixth cell silently wraps rather than failing, which is why the tracks ' +
          'are counted here rather than eyeballed.\n\n' +
          'Status is not passed through verbatim either: `teamStatusPill` renames "Requested" ' +
          'to INVITED, mutes "Off-Duty" to OFF DUTY, and leaves anything else as the raw text ' +
          'in the green completed pill.',
      },
    },
  },
  tags: ['autodocs'],
  args: { isVerified: true },
  decorators: [
    (Story) => (
      <div className="min-h-[520px] w-[980px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof Team>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Roster: Story = {
  name: 'Roster (owner, verified)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The heading count is derived from the same array as the rows below it.
    await expect(canvas.getByRole('heading', { name: 'Team (3)' })).toBeInTheDocument();

    /* Assert the ROW, not the cells. Every one of these strings also exists
       somewhere else on the screen, so three separate `getByText`s pass just as
       happily with a value rendered against the wrong member. The avatar has no
       image in these fixtures, so the monogram is the row's leading text. */
    await expect(rowOf(canvas.getByText('Dr. Elena Marsh')).textContent).toBe(
      'DEDr. Elena MarshCardiologyVeterinarianFull timeConsulting'
    );
    await expect(rowOf(canvas.getByText('Priya Raman')).textContent).toBe(
      'PRPriya RamanInternal medicineTechnicianPart timeINVITED'
    );
    // No speciality subline and no employment type: the em-dash fallback.
    await expect(rowOf(canvas.getByText('Tom Reyes')).textContent).toBe(
      'TRTom ReyesReceptionist—OFF DUTY'
    );

    /* Five header cells and five tracks. The header band and the rows carry the
       same `grid-cols-[1.6fr_1fr_1fr_110px_44px]` string and nothing checks that
       they still agree; a template with four tracks pushes the 44px action
       column onto a second line instead of failing. */
    const header = canvasElement.querySelector('.yc-table-head') as HTMLElement;
    await expect(header.children).toHaveLength(5);
    await expect(getComputedStyle(header).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(5);

    // Owner + verified: the invite pill is present and nothing is open yet.
    await expect(canvas.getByRole('button', { name: 'Invite member' })).toBeInTheDocument();
    await expect(openDialogs()).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting roster. The member cell stacks a bold name over the faint comma-joined ' +
          'speciality list, and a member with no specialities loses the second line entirely ' +
          'rather than rendering an empty one.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No team members yet',
  beforeEach: seed({ teams: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No team members yet.')).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Team (0)' })).toBeInTheDocument();

    /* Empty is not the same as denied, and the copy alone cannot tell them
       apart: the header band still renders here, and no row survived. */
    await expect(canvas.getByText('Member')).toBeInTheDocument();
    await expect(canvas.queryAllByRole('button', { name: /^Open .* details$/ })).toHaveLength(0);
    // A clinic with no members can still invite one, so the pill stays.
    await expect(canvas.getByRole('button', { name: 'Invite member' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A loaded roster with nothing in it - the state a freshly created clinic opens on. ' +
          'The header band is still drawn above the sentence, so the empty branch is a row ' +
          'replacement rather than a table replacement.',
      },
    },
  },
};

export const UnverifiedOrg: Story = {
  name: 'Invite hidden: org not verified',
  args: { isVerified: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The owner still holds teams:edit:any - only the verification half is false.
    await expect(canvas.queryByRole('button', { name: 'Invite member' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Team (3)' })).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: /^Open .* details$/ })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Half of the invite gate. `isVerified` is a prop from the organisation page, not a ' +
          'permission, so an owner of an unverified clinic sees the full roster and its per-row ' +
          'kebabs but cannot add to it.',
      },
    },
  },
};

export const WithoutEditPermission: Story = {
  name: 'Invite hidden: receptionist',
  beforeEach: seed({ membership: RECEPTIONIST }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The other half of the gate, and the same rendered header.
    await expect(canvas.queryByRole('button', { name: 'Invite member' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Team (3)' })).toBeInTheDocument();
    /* teams:view:any survives, so the roster itself is not gated away. Asserted
       as a whole row rather than a name: a gate that leaked into the row cells
       (an empty employment column, a missing status pill) still leaves the name
       on screen, and a bare `getByText` would call that a pass. */
    await expect(rowOf(canvas.getByText('Dr. Elena Marsh')).textContent).toBe(
      'DEDr. Elena MarshCardiologyVeterinarianFull timeConsulting'
    );
    await expect(canvas.getAllByRole('button', { name: /^Open .* details$/ })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'RECEPTIONIST holds `teams:view:any` but not `teams:edit:any`. The permissions come ' +
          'from the shipped role table via a real membership rather than a hand-written array, ' +
          'so this story moves if the role table does.',
      },
    },
  },
};

export const InviteDrawer: Story = {
  name: 'Invite member opens AddTeam',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(openDialogs()).toHaveLength(0);

    await userEvent.click(canvas.getByRole('button', { name: 'Invite member' }));

    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(openDialogs()[0]);
    await expect(panel.getByRole('heading', { name: 'Add team' })).toBeVisible();
    /* The employee-type row is three pills rather than a dropdown. Asserted as
       one string so the label and its three options are pinned together and in
       order - three separate existence checks pass with the row split apart or
       an option renamed into the wrong slot. */
    const employmentRow = panel.getByText('Employee type').parentElement as HTMLElement;
    await expect(employmentRow.textContent).toBe('Employee typeFull timePart timeContract');

    /* It also opens PRE-SELECTED on FULL_TIME, so the drawer is never in a
       "nothing chosen" state for this field, unlike the two dropdowns above it.
       Selection here is a colour swap with no aria state behind it, so it is
       polled: the pills carry no transition, but the token layer resolving late
       would still make one synchronous read compare two identical inks. */
    const fullTime = panel.getByRole('button', { name: 'Full time' });
    const partTime = panel.getByRole('button', { name: 'Part time' });
    await waitFor(() => {
      expect(getComputedStyle(fullTime).color).not.toBe(getComputedStyle(partTime).color);
    });

    await expect(panel.getByRole('button', { name: 'Send invite' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The invite drawer is mounted from the first render with `showModal` false, so its ' +
          '`<dialog>` is in the DOM all along and only the `open` attribute moves. That is why ' +
          'the assertions here count `dialog[open]` rather than looking for the panel markup.',
      },
    },
  },
};

export const MemberDrawer: Story = {
  name: 'Row kebab opens TeamInfo',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Open Priya Raman details' }));

    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(openDialogs()[0]);
    const title = panel.getByRole('heading', { name: 'Priya Raman' });
    /* Eyebrow / title / meta as one string. The kebab has to select the row it
       belongs to, and `activeTeam` starts life pointing at the FIRST member -
       so asserting only that a drawer opened, or only that some heading exists,
       passes just as well with Dr. Elena Marsh in it. */
    await expect((title.parentElement?.parentElement as HTMLElement).textContent).toBe(
      'Team memberPriya RamanTechnician'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The per-row kebab sets `activeTeam` and opens the drawer in one handler. Opening it ' +
          'also fires the panel’s profile fetch, which has no backend in Storybook: the ' +
          'component catches that itself and falls back to `profile = null`, so what is drawn ' +
          'here is the roster record plus the empty profile sections, not a half-loaded panel.',
      },
    },
  },
};
