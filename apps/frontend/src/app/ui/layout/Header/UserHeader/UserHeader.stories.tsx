import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { OrgIntegration } from '../../../../features/integrations/services/types';
import { useAuthStore } from '../../../../stores/authStore';
import { useIntegrationStore } from '../../../../stores/integrationStore';
import { useOrgStore } from '../../../../stores/orgStore';
import UserHeader from './UserHeader';

// The bar is styled by the shell stylesheet, which the app loads through
// `Header`, not through UserHeader itself.
import '../Header.css';

const PRIMARY_ORG_ID = 'org-sunrise';

const org = (id: string, name: string): Organisation => ({
  _id: id,
  name,
  type: 'HOSPITAL',
  phoneNo: '+1 415 555 0134',
  taxId: 'TAX-0001',
  isVerified: true,
});

const ORGS: Organisation[] = [
  org(PRIMARY_ORG_ID, 'Sunrise Veterinary'),
  org('org-harbour', 'Harbour Animal Hospital'),
  org('org-glen', 'Glen Road Equine'),
];

const MERCK_INTEGRATION: OrgIntegration = {
  id: 'integration-merck',
  organisationId: PRIMARY_ORG_ID,
  provider: 'MERCK_MANUALS',
  status: 'enabled',
  source: 'backend',
};

/**
 * Seeds the two stores the header reads from - the org list behind the switcher
 * and the Cognito attributes behind the display name - and puts both back when
 * the story unmounts. Nothing here fetches: every hook in this header
 * (`usePrimaryOrgProfile`, `useResolvedMerckIntegrationForPrimaryOrg`,
 * `useNotifications`) resolves out of a store or returns a fixed empty value.
 */
const withSignedInOrg = (options?: { merckEnabled?: boolean }) => () => {
  const orgSnapshot = useOrgStore.getState();
  const authSnapshot = useAuthStore.getState();
  const integrationSnapshot = useIntegrationStore.getState();

  useOrgStore.setState({
    orgsById: Object.fromEntries(ORGS.map((entry) => [String(entry._id), entry])),
    orgIds: ORGS.map((entry) => String(entry._id)),
    primaryOrgId: PRIMARY_ORG_ID,
    status: 'loaded',
  });
  useAuthStore.setState({
    attributes: { given_name: 'Alina', family_name: 'Fischer' },
  });
  if (options?.merckEnabled) {
    useIntegrationStore.setState({
      integrationsById: { 'integration-merck': MERCK_INTEGRATION },
      integrationIdsByOrgId: { [PRIMARY_ORG_ID]: ['integration-merck'] },
    });
  }

  return () => {
    useOrgStore.setState(orgSnapshot);
    useAuthStore.setState(authSnapshot);
    useIntegrationStore.setState(integrationSnapshot);
  };
};

/** Reproduces the sticky glass shell `Header` wraps the signed-in bar in. */
const HeaderShell = ({ children }: { children: ReactNode }) => (
  <div style={{ background: 'var(--page)', minHeight: 420 }}>
    <header className="yc-liquid-header-shell yc-user-header-shell flex w-full items-center justify-center sticky top-0 left-0 z-997">
      {children}
    </header>
  </div>
);

const meta = {
  title: 'Layout/UserHeader',
  component: UserHeader,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The signed-in app bar: the organization switcher on the left, then the route-aware search ' +
          'field, theme toggle, notifications bell and the account menu. Almost everything about it ' +
          'is keyed off the pathname - the search placeholder changes per module, and on the routes ' +
          'that own their own search (dashboard, settings, chat, inventory, guides) the field is ' +
          'dropped entirely. The developer portal swaps the org chip out and points the account menu ' +
          'at its own settings.',
      },
    },
  },
  decorators: [
    (Story) => (
      <HeaderShell>
        <Story />
      </HeaderShell>
    ),
  ],
  beforeEach: withSignedInOrg(),
} satisfies Meta<typeof UserHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The resting bar on `/appointments`: org chip with a monogram (the org has no
 * logo), "Search appointments" placeholder, and both menus closed.
 */
export const Default: Story = {};

export const OrgSwitcherOpen: Story = {
  name: 'Organization switcher open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Sunrise Veterinary/ }));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The switcher panel. It lists at most four organizations and always closes with the "View ' +
          'all organizations" link, so a member of a dozen practices still gets a fixed-height panel ' +
          'rather than a scrolling one.',
      },
    },
  },
};

export const AccountMenuOpen: Story = {
  name: 'Account menu open',
  beforeEach: withSignedInOrg({ merckEnabled: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Alina Fischer/ }));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The account menu at its longest. The MSD Veterinary Manual row only appears when the org ' +
          'is verified and the Merck integration is enabled, which this story seeds - without it the ' +
          'menu is Settings, Guides and the red Sign out row.',
      },
    },
  },
};

export const DeveloperPortal: Story = {
  name: 'Developer portal',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/home' } },
    docs: {
      description: {
        story:
          'On `/developers` there is no organization context, so the left side of the bar is empty ' +
          'and the search falls back to the generic placeholder. The account menu drops the ' +
          'org-scoped rows and points Settings at `/developers/settings`.',
      },
    },
  },
};
