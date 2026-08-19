import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import PhoneShell from './PhoneShell';
import { usePhoneShellStore } from './phoneShellStore';
import { useOrgStore } from '@/app/stores/orgStore';

const ORG_ID = 'org-storybook';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'TAX-0001',
  isVerified: true,
  isActive: true,
};

/** A real role code, so the tab gates resolve from the shipped permission table. */
const MEMBERSHIP: UserOrganization = {
  id: 'membership-1',
  practitionerReference: 'Practitioner/vet-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

type ShellFixture = {
  org: boolean;
  chatUnread: number;
};

const withShellState =
  ({ org, chatUnread }: ShellFixture) =>
  () => {
    const snapshot = useOrgStore.getState();
    useOrgStore.setState(
      org
        ? {
            orgsById: { [ORG_ID]: ORG },
            orgIds: [ORG_ID],
            primaryOrgId: ORG_ID,
            membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
          }
        : { orgsById: {}, orgIds: [], primaryOrgId: null, membershipsByOrgId: {} }
    );
    usePhoneShellStore.setState({ chatUnread });
    return () => {
      useOrgStore.setState({
        orgsById: snapshot.orgsById,
        orgIds: snapshot.orgIds,
        primaryOrgId: snapshot.primaryOrgId,
        membershipsByOrgId: snapshot.membershipsByOrgId,
      });
      usePhoneShellStore.setState({ chatUnread: 0 });
    };
  };

const meta = {
  title: 'Layout/PhoneShell',
  component: PhoneShell,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    // The shell is gated on a `(max-width: 767px)` media query and renders
    // nothing above it, so both the Storybook canvas and the Chromatic snapshot
    // have to be phone-width.
    chromatic: { viewports: [375] },
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The phone (< 768px) application shell: the 54px header (org switcher, search, notifications), ' +
          'the fixed bottom tab bar, the floating action button for the current section and the More ' +
          'bottom sheet. Above the phone breakpoint it renders nothing at all, leaving the desktop ' +
          'sidebar untouched — so these stories only show anything at a phone viewport. Tabs are gated ' +
          'by the same organisation, verification and permission rules as the desktop sidebar, which ' +
          'the stories seed into the org store.',
      },
    },
  },
} satisfies Meta<typeof PhoneShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Schedule: Story = {
  name: 'Schedule tab',
  beforeEach: withShellState({ org: true, chatUnread: 0 }),
  parameters: {
    docs: {
      description: {
        story:
          'A verified organisation with a full-permission role: every tab is reachable, Schedule is active (filled icon plus `aria-current`), and the FAB offers the create action for the appointments section.',
      },
    },
  },
};

export const ChatUnread: Story = {
  name: 'Chat tab with unread badge',
  beforeEach: withShellState({ org: true, chatUnread: 12 }),
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/chat' } },
    docs: {
      description: {
        story:
          'The Chat tab is the only one that carries a badge; it reads the unread count published by the chat feature and caps the label at 99+.',
      },
    },
  },
};

export const MoreSheet: Story = {
  name: 'More sheet open',
  beforeEach: withShellState({ org: true, chatUnread: 0 }),
  play: async ({ canvasElement }) => {
    // The shell mounts empty and only appears once its media-query effect has
    // run, hence `findByRole`. Above the phone breakpoint it never appears at
    // all, so a miss bails out rather than failing the story.
    let moreTab: HTMLElement;
    try {
      moreTab = await within(canvasElement).findByRole(
        'button',
        { name: 'More' },
        { timeout: 2000 }
      );
    } catch {
      return;
    }
    await userEvent.click(moreTab);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The More tab opens the bottom sheet holding the sections that do not fit the tab bar, plus the sign-out row.',
      },
    },
  },
};

export const NoOrganisation: Story = {
  name: 'No organisation yet',
  beforeEach: withShellState({ org: false, chatUnread: 0 }),
  parameters: {
    docs: {
      description: {
        story:
          'Straight after sign-up there is no organisation, so every gated tab and More row is disabled and the header falls back to its plain state.',
      },
    },
  },
};
