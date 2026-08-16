import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import PhoneTabBar, { type PhoneTabItem } from './PhoneTabBar';
import { PHONE_TABS, type PhoneTabKey } from './phoneShellConfig';
import './PhoneShell.css';

/**
 * The whole phone shell skin lives behind `@media screen and (max-width: 767px)`
 * in `PhoneShell.css`, so every story here pins the `mobile` viewport — at any
 * wider width the bar renders as unstyled list markup.
 */
const buildItems = ({
  activeKey,
  disabledKeys = [],
  chatBadge,
}: {
  activeKey: PhoneTabKey;
  disabledKeys?: PhoneTabKey[];
  chatBadge?: number;
}): PhoneTabItem[] =>
  PHONE_TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    icon: tab.icon,
    activeIcon: tab.activeIcon,
    href: tab.href,
    active: tab.key === activeKey,
    disabled: disabledKeys.includes(tab.key),
    isMore: tab.isMore,
    badgeCount: tab.hasBadge ? chatBadge : undefined,
  }));

const meta = {
  title: 'Layout/PhoneTabBar',
  component: PhoneTabBar,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile' },
    docs: {
      description: {
        component:
          'Fixed bottom tab bar for the phone shell (Home, Schedule, Patients, Chat, More). ' +
          'Active tabs swap to the filled icon and `--nav-active` ink, gated tabs mirror the ' +
          "sidebar's permission check, and the Chat tab carries the unread badge. View at the " +
          '`mobile` viewport — the bar is styled only below 768px.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    moreOpen: false,
    onNavigate: fn(),
    onOpenMore: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 520, background: 'var(--page)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneTabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Home active',
  args: { items: buildItems({ activeKey: 'home' }) },
};

export const ChatUnread: Story = {
  name: 'Chat unread (99+ cap)',
  args: { items: buildItems({ activeKey: 'chat', chatBadge: 128 }) },
  parameters: {
    docs: {
      description: {
        story:
          'Counts above 99 collapse to `99+` so the badge cannot outgrow its tab and push the ' +
          'label into an ellipsis.',
      },
    },
  },
};

export const PermissionGated: Story = {
  name: 'Gated tabs',
  args: {
    items: buildItems({ activeKey: 'home', disabledKeys: ['patients', 'chat'] }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Tabs the member has no permission for (or that are locked behind verification) render ' +
          'at `--ink-faint2` with the native `disabled` attribute, so they are visibly and ' +
          'functionally inert rather than silently ignoring taps.',
      },
    },
  },
};

export const MoreSheetOpen: Story = {
  name: 'More sheet open',
  args: { items: buildItems({ activeKey: 'more' }), moreOpen: true },
  parameters: {
    docs: {
      description: {
        story:
          'While the More sheet is open the tab reports `aria-expanded="true"`. It never takes ' +
          '`aria-current` — it opens a dialog rather than navigating to a page.',
      },
    },
  },
};
