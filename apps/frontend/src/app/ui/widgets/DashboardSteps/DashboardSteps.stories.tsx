import type { Meta, StoryObj } from '@storybook/react';
import type { Organisation, Speciality, UserOrganization } from '@yosemite-crew/types';
import type { BillingSubscription } from '@/app/features/billing/types/billing';
import type { RoleCode } from '@/app/lib/permissions';
import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import { useTeamStore } from '@/app/stores/teamStore';
import DashboardSteps from './index';

const ORG_ID = 'org-1';

const org: Organisation = {
  _id: ORG_ID,
  name: 'Half Dome Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '+1 209 555 0148',
  taxId: 'US-TAX-4417',
  isVerified: true,
  isActive: true,
};

const membership = (roleCode: RoleCode): UserOrganization => ({
  id: 'membership-1',
  practitionerReference: 'Practitioner/user-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode,
  active: true,
});

const speciality = (id: string, name: string, activeServiceCount: number): Speciality => ({
  _id: id,
  organisationId: ORG_ID,
  name,
  activeServiceCount,
});

const teamMember = (id: string, name: string): Team => ({
  _id: id,
  practionerId: `practitioner-${id}`,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

type Seed = {
  roleCode: RoleCode;
  specialities: Speciality[];
  team: Team[];
  subscription: BillingSubscription;
};

/**
 * The card takes no props: org, subscription, services, team and the signed-in
 * role all come out of four Zustand stores. They are plain stores with no provider
 * and no fetch on read, so seeding them is the whole of the setup. It runs in
 * `beforeEach` rather than in a decorator so nothing writes to a store during a
 * React render.
 */
const seedStores = ({ roleCode, specialities, team, subscription }: Seed) => {
  useOrgStore.setState({
    orgsById: { [ORG_ID]: org },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: membership(roleCode) },
    status: 'loaded',
  });
  useSpecialityStore.getState().setSpecialitiesForOrg(ORG_ID, specialities);
  useTeamStore.getState().setTeamsForOrg(ORG_ID, team);
  useSubscriptionStore.getState().setSubscriptionForOrg(ORG_ID, subscription);
};

const NOTHING_DONE: Seed = {
  roleCode: 'OWNER',
  specialities: [speciality('spec-1', 'General practice', 0)],
  team: [teamMember('team-1', 'Dr. Amelia Hart')],
  subscription: { orgId: ORG_ID, plan: 'free' },
};

/**
 * No `autodocs` tag on purpose. Every story here writes the same global stores, so
 * a docs page that mounts all three at once would show whichever one seeded last
 * three times over. One story per canvas is the only honest reading.
 */
const meta = {
  title: 'Widgets/DashboardSteps',
  component: DashboardSteps,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "Get started" onboarding strip at the top of the dashboard: up to three cards for ' +
          'adding services, inviting the team and connecting Stripe. Completion is derived from the ' +
          'org’s own data rather than stored, a step the signed-in role cannot action is dropped ' +
          'from the row instead of being shown disabled, and the whole strip unmounts once every ' +
          'visible step is done — so it can never sit on a finished dashboard.',
      },
    },
  },
  beforeEach: () => {
    seedStores(NOTHING_DONE);
  },
} satisfies Meta<typeof DashboardSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NothingDone: Story = {
  name: 'Nothing done yet',
  parameters: {
    docs: {
      description: {
        story:
          'First run: no services, a one-person team and no Stripe account, so all three cards are ' +
          'open and the counter reads "0 of 3 done".',
      },
    },
  },
};

export const PartiallyComplete: Story = {
  name: 'Two of three done',
  beforeEach: () => {
    seedStores({
      roleCode: 'OWNER',
      specialities: [speciality('spec-1', 'General practice', 4)],
      team: [teamMember('team-1', 'Dr. Amelia Hart'), teamMember('team-2', 'Priya Raman')],
      subscription: { orgId: ORG_ID, plan: 'business', connectAccountId: 'acct_demo' },
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Completed steps stay in place at 55% opacity with a filled check and a disabled button ' +
          'whose label flips to the "view" wording, so the row keeps its three-column rhythm as ' +
          'steps land. Stripe has an account but charges are not enabled yet, which is the third ' +
          'button label: "Continue setup".',
      },
    },
  },
};

export const RoleWithoutBilling: Story = {
  name: 'Role that cannot connect Stripe',
  beforeEach: () => {
    seedStores({ ...NOTHING_DONE, roleCode: 'ADMIN' });
  },
  parameters: {
    docs: {
      description: {
        story:
          'An admin can manage services and the team but not billing, so the Stripe card is ' +
          'removed and the counter becomes "0 of 2 done". Two cards stretch across the same ' +
          'three-column grid — the case worth checking before a role ever sees a single lonely card.',
      },
    },
  },
};
