import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { OrgWithMembership } from '@/app/features/organization/types/org';
import { useOrgStore } from '@/app/stores/orgStore';
import OrgCard from './OrgCard';

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

const buildRow = (
  org: Partial<Organisation> = {},
  roleDisplay = 'veterinarian'
): OrgWithMembership => ({
  org: buildOrg(org),
  membership: buildMembership(roleDisplay),
});

/**
 * The card reads `primaryOrgId` straight off the org store to decide whether it is
 * the member's current organisation. Setting it here keeps the story offline - the
 * store is never asked to load anything - and the previous state is restored on
 * unmount so neighbouring stories are unaffected.
 */
const withPrimaryOrg = (primaryOrgId: string | null) => () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({ primaryOrgId });
  return () => {
    useOrgStore.setState(snapshot);
  };
};

const meta = {
  title: 'Cards/OrgCard',
  component: OrgCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One row in the organisation picker: a tinted initial tile, the organisation name with its ' +
          'verification badge, a "role · type" subline and a forward chevron. The tile tint is derived ' +
          'from the name so an organisation keeps the same colour between visits, except for the ' +
          "member's current organisation, which is always the blue tile with the filled chevron. The " +
          'whole row is a single button.',
      },
    },
  },
  argTypes: {
    handleOrgClick: { table: { disable: true } },
  },
  args: {
    org: buildRow(),
    handleOrgClick: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 460 }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: withPrimaryOrg(null),
} satisfies Meta<typeof OrgCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {
  name: 'Verified, not current',
  parameters: {
    docs: {
      description: {
        story:
          'A verified organisation the member belongs to but has not switched into: palette tint on the ' +
          'initial tile, the green VERIFIED badge and the outlined chevron.',
      },
    },
  },
};

export const Pending: Story = {
  name: 'Pending verification',
  args: {
    org: buildRow(
      { _id: 'org-meadow', name: 'Meadowbrook Boarding', type: 'BOARDER', isVerified: false },
      'admin'
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Until an organisation clears verification the badge flips to the amber PENDING tone. The ' +
          'subline picks up the membership role and the business type, both title-cased.',
      },
    },
  },
};

export const Current: Story = {
  name: 'Current organisation',
  beforeEach: withPrimaryOrg(CURRENT_ORG_ID),
  parameters: {
    docs: {
      description: {
        story:
          'The organisation the member is signed into. It always takes the blue tile regardless of the ' +
          'name-derived palette, gains the highlighted border and swaps the outlined chevron for the ' +
          'filled one.',
      },
    },
  },
};

export const LongName: Story = {
  name: 'Long name and role',
  args: {
    org: buildRow(
      {
        _id: 'org-long',
        name: 'Northern Highlands Veterinary Hospital and Emergency Referral Centre',
        type: 'HOSPITAL',
      },
      'senior consultant veterinary surgeon'
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Name and subline both truncate rather than wrap, so a long organisation name cannot push the ' +
          'badge or the chevron out of the row or change its height.',
      },
    },
  },
};
