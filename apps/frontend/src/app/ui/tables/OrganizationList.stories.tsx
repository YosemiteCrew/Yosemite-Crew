import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { OrgWithMembership } from '@/app/features/organization/types/org';
import { useOrgStore } from '@/app/stores/orgStore';
import OrganizationList from './OrganizationList';

const CURRENT_ORG_ID = 'org-sunrise';

const buildOrg = (overrides: Partial<Organisation> = {}): Organisation => ({
  _id: CURRENT_ORG_ID,
  name: 'Sunrise Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+1 415 555 0134',
  taxId: 'TAX-0001',
  isVerified: true,
  ...overrides,
});

const buildMembership = (roleDisplay: string): UserOrganization => ({
  practitionerReference: 'Practitioner/pract-1',
  organizationReference: `Organization/${CURRENT_ORG_ID}`,
  roleCode: 'VET',
  roleDisplay,
});

const row = (
  org: Partial<Organisation> = {},
  roleDisplay: string | null = 'veterinarian'
): OrgWithMembership => ({
  org: buildOrg(org),
  membership: roleDisplay === null ? null : buildMembership(roleDisplay),
});

const ORGS: OrgWithMembership[] = [
  row(),
  row({ _id: 'org-northgate', name: 'Northgate Animal Hospital', type: 'CLINIC' }, 'technician'),
  row({ _id: 'org-riverside', name: 'Riverside Veterinary Clinic', isVerified: false }, 'admin'),
];

/**
 * Each card reads `primaryOrgId` off the org store to mark the member's current
 * organisation. Setting it here keeps the stories offline - the store is never
 * asked to load anything - and the snapshot is restored on unmount so
 * neighbouring stories are unaffected.
 */
const withPrimaryOrg = (primaryOrgId: string | null) => () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({ primaryOrgId });
  return () => {
    useOrgStore.setState(snapshot);
  };
};

const meta = {
  title: 'Tables/OrganizationList',
  component: OrganizationList,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/organizations' } },
    docs: {
      description: {
        component:
          'The organisation picker. Choosing one sets the primary org and then resolves where ' +
          'that member should land, which is role-dependent rather than a fixed route. It renders ' +
          'nothing at all when the list is empty, because the page around it owns that message.',
      },
    },
  },
  tags: ['autodocs'],
  args: { orgs: ORGS },
  beforeEach: withPrimaryOrg(CURRENT_ORG_ID),
} satisfies Meta<typeof OrganizationList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Three organisations',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Sunrise Veterinary')).toBeInTheDocument();
    await expect(canvas.getByText('Northgate Animal Hospital')).toBeInTheDocument();
    await expect(canvas.getByText('Riverside Veterinary Clinic')).toBeInTheDocument();
  },
};

export const NoPrimaryYet: Story = {
  name: 'Before a primary organisation is chosen',
  beforeEach: withPrimaryOrg(null),
  parameters: {
    docs: {
      description: {
        story:
          'A member who has just accepted their first invitation has no primary org, so no card ' +
          'is marked current. The list still has to be usable - this is exactly the state where ' +
          'they need to pick one.',
      },
    },
  },
};

export const WithoutMembership: Story = {
  name: 'An organisation with no membership record',
  args: { orgs: [row({}, null)] },
  play: async ({ canvasElement }) => {
    /* `membership` is nullable, and the click path reads a role off it to decide
       where to land. The card must still render rather than throwing - the
       fallback route is what handles the missing role. */
    await expect(within(canvasElement).getByText('Sunrise Veterinary')).toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'No organisations: nothing renders',
  args: { orgs: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).not.toContain('Sunrise');
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
