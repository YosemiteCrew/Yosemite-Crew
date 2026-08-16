import type { Meta, StoryObj } from '@storybook/react';
import {
  resetSidebarPreference,
  setSidebarCollapsedPreference,
} from '../../../lib/sidebarPreference';
import { useOrgStore } from '../../../stores/orgStore';
import Sidebar from './Sidebar';

/**
 * The nav gates itself on `orgStatus === 'loaded'` and renders a bare rail until then.
 * Flipping only `status` is enough to get the real nav on screen: it is not persisted,
 * and it leaves `primaryOrgId` null, so no org-scoped request is ever kicked off.
 */
const withLoadedOrgStatus = () => {
  const previous = useOrgStore.getState().status;
  useOrgStore.setState({ status: 'loaded' });
  return () => useOrgStore.setState({ status: previous });
};

const meta = {
  title: 'Layout/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The app shell nav rail. Routes are grouped under small section labels, the active route ' +
          'is matched against the current pathname, and every route is permission-gated - a route ' +
          'the member cannot reach renders dimmed rather than disappearing, so the nav never ' +
          'changes shape between roles. Desktop is the 224px expanded rail; tablet and a stored ' +
          'collapse preference both drop it to the 76px icon rail, where each row grows a ' +
          'GlassTooltip. The developer portal swaps in its own route set and skips the org gate.',
      },
    },
  },
  beforeEach: () => {
    resetSidebarPreference();
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', height: 720, background: 'var(--page)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeveloperPortal: Story = {
  name: 'Developer portal',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/home' } },
    docs: {
      description: {
        story:
          'The `/developers` route set: two groups, no org gate and no permission gating, with ' +
          'Dashboard active.',
      },
    },
  },
};

export const AppNavigation: Story = {
  name: 'App nav — no org access',
  beforeEach: withLoadedOrgStatus,
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/dashboard' } },
    docs: {
      description: {
        story:
          'The five app groups with no org loaded, which is what an unverified or deactivated ' +
          'member sees: every route is present but dimmed and inert. Compare the row rhythm here ' +
          'against the developer portal - both use the same 224px rail.',
      },
    },
  },
};

export const CollapsedRail: Story = {
  name: 'Collapsed icon rail',
  beforeEach: () => {
    setSidebarCollapsedPreference(true);
    return () => resetSidebarPreference();
  },
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/api-keys' } },
    docs: {
      description: {
        story:
          'The 76px rail the tablet breakpoint forces and a stored preference opts into on desktop. ' +
          'Group labels drop away, icons centre in 44px pills, and the route name survives for ' +
          'screen readers plus a tooltip on hover.',
      },
    },
  },
};
