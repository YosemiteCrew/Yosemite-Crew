import type { Meta, StoryObj } from '@storybook/react';
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
          'without it sees nothing at all rather than an empty table.',
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
  parameters: {
    viewport: { defaultViewport: 'mobile' },
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
