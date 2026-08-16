import type { Meta, StoryObj } from '@storybook/react';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';
import DashboardProfile from './DashboardProfile';
import { useOrgStore } from '../../../stores/orgStore';
import { useAuthStore } from '../../../stores/authStore';
import { PERMISSIONS } from '../../../lib/permissions';

const ORG_ID = 'storybook-org';

const buildOrg = (isVerified: boolean): Organisation => ({
  _id: ORG_ID,
  name: 'Pawsome Veterinary Clinic',
  type: 'HOSPITAL',
  phoneNo: '+49 30 123456',
  taxId: 'DE123456789',
  isVerified,
});

const buildMembership = (canEditOrg: boolean): UserOrganization => ({
  practitionerReference: 'storybook-user',
  organizationReference: ORG_ID,
  // No role baseline is assumed: permissions are granted explicitly so the
  // story does not silently change when the role table does.
  roleCode: '',
  active: true,
  extraPermissions: canEditOrg ? [PERMISSIONS.ORG_EDIT] : [],
});

/**
 * The widget reads everything from Zustand, so each story seeds the org and
 * auth stores before it renders and restores the previous state afterwards.
 * No network is involved — both stores are plain client state.
 */
const seedStores = (options: { isVerified: boolean; canEditOrg: boolean }) => {
  const previousOrgState = useOrgStore.getState();
  const previousAuthState = useAuthStore.getState();

  useOrgStore.setState({
    orgsById: { [ORG_ID]: buildOrg(options.isVerified) },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: buildMembership(options.canEditOrg) },
    // `usePermissions` reports `isLoading` until the org store has loaded, and
    // PermissionGate renders nothing while loading.
    status: 'loaded',
  });
  useAuthStore.setState({ attributes: { given_name: 'Sarah', family_name: 'Weber' } });

  return () => {
    useOrgStore.setState(previousOrgState);
    useAuthStore.setState(previousAuthState);
  };
};

const meta = {
  title: 'Widgets/DashboardProfile',
  component: DashboardProfile,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Greeting block at the top of the dashboard: the italic Newsreader "Welcome back," eyebrow, the signed-in ' +
          "user's name and avatar, a one-line summary, and — depending on the organisation — either a `Verified clinic` " +
          'status pill or the amber verification-in-progress banner with its booking CTA. The banner is wrapped in a ' +
          '`PermissionGate` for `org:edit`, so members without that permission never see it. Renders nothing at all when there is no primary organisation.',
      },
    },
  },
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 1100 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof DashboardProfile>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Verified organisation: greeting plus the success-toned `Verified clinic` pill. */
export const VerifiedClinic: Story = {
  beforeEach: () => seedStores({ isVerified: true, canEditOrg: true }),
};

/**
 * Awaiting verification, viewed by someone who can edit the organisation. The
 * warn-toned banner, the "Verify business profile" CTA and the explanatory note
 * all appear.
 */
export const AwaitingVerification: Story = {
  beforeEach: () => seedStores({ isVerified: false, canEditOrg: true }),
};

/**
 * The same unverified organisation seen by a member without `org:edit`. The
 * `PermissionGate` drops the whole banner, leaving only the greeting — this is
 * the state to check when the header looks unexpectedly bare.
 */
export const AwaitingVerificationWithoutPermission: Story = {
  beforeEach: () => seedStores({ isVerified: false, canEditOrg: false }),
};
