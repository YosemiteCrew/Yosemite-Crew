import type { Meta, StoryObj } from '@storybook/react';
import NotificationsPanel from './NotificationsPanel';
import { SAMPLE_NOTIFICATIONS } from './notificationSamples';
import './Notifications.css';

/**
 * NotificationsPanel is the presentational body the header bell renders inside its
 * dropdown (desktop/tablet) and its bottom-sheet (phone). It is the visual surface
 * for the notifications chrome, so these stories let the panel — and the outline
 * empty-state bell glyph the design calls for — be verified at tablet/phone widths.
 *
 * The panel itself is `position: absolute`/bottom-anchored in the app; the story
 * wrappers pin it in flow with the real `.yc-noti-panel` / `.yc-noti-sheet` chrome
 * so the border, radius, width and surface tokens render exactly as shipped.
 */
const meta = {
  title: 'Layout/Notifications/Panel',
  component: NotificationsPanel,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'subtle' },
  },
  args: {
    items: SAMPLE_NOTIFICATIONS,
    unreadCount: 3,
    onMarkAllRead: () => {},
    onSettings: () => {},
  },
} satisfies Meta<typeof NotificationsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop/tablet dropdown: 420px card, `--screen` surface, hairline border. */
export const Dropdown: Story = {
  parameters: { viewport: { defaultViewport: 'tablet' } },
  args: { layout: 'dropdown' },
  render: (args) => (
    <div style={{ padding: 24 }}>
      <div className="yc-noti-panel" style={{ position: 'static', margin: '0 auto' }}>
        <NotificationsPanel {...args} />
      </div>
    </div>
  ),
};

/** Phone bottom-sheet body: grabber, larger 38px icon discs, home indicator. */
export const Sheet: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
  args: { layout: 'sheet' },
  render: (args) => (
    <div style={{ padding: 0 }}>
      <div
        className="yc-noti-sheet"
        style={{ position: 'static', maxWidth: 390, margin: '0 auto' }}
      >
        <span className="yc-noti-sheet-grabber" aria-hidden />
        <NotificationsPanel {...args} />
        <span className="yc-noti-home-indicator" aria-hidden />
      </div>
    </div>
  ),
};

/** Empty feed — the live default until a durable source lands (outline bell). */
export const Empty: Story = {
  parameters: { viewport: { defaultViewport: 'tablet' } },
  args: { layout: 'dropdown', items: [], unreadCount: 0 },
  render: (args) => (
    <div style={{ padding: 24 }}>
      <div className="yc-noti-panel" style={{ position: 'static', margin: '0 auto' }}>
        <NotificationsPanel {...args} />
      </div>
    </div>
  ),
};
