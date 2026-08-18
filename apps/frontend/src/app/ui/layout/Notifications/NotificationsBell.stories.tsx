import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import NotificationsBell from './NotificationsBell';
// The trigger takes its chrome from the header sheets, not from Notifications.css:
// `.yc-icon-button` lives in UserHeader.css and `.yc-phone-iconbtn` in PhoneShell.css
// (inside a max-width:767px query, so it is inert above the phone breakpoint).
import '../Header/UserHeader/UserHeader.css';
import '../PhoneShell/PhoneShell.css';

const PHONE_VIEWPORT = {
  phone: {
    name: 'Mobile (375)',
    styles: { width: '375px', height: '812px' },
    type: 'mobile',
  },
};

/** A stand-in header row: the panel is anchored to the bell, so it needs a right edge. */
const HeaderRow = (Story: React.ComponentType) => (
  <div className="min-h-[520px] bg-[var(--page)] p-4">
    <div className="flex items-center justify-end gap-2 rounded-2xl bg-[var(--screen)] px-4 py-3">
      <Story />
    </div>
  </div>
);

const meta = {
  title: 'Layout/Notifications/Bell',
  component: NotificationsBell,
  decorators: [HeaderRow],
  parameters: {
    layout: 'fullscreen',
    // "Notification settings" pushes /settings, so the App Router mock has to be
    // on even though nothing here navigates.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The header bell and the surface behind it. `Layout/Notifications/Panel` draws the panel ' +
          'body on its own; this file draws what the bell actually mounts around it, which is a ' +
          'different tree in each variant and existed only after a click.\n\n' +
          'That is the gap worth naming rather than the component. Four production bugs on this ' +
          'branch lived on surfaces that only exist after an interaction - a popover whose ' +
          '`grid-template-columns` used a comma, so the browser dropped the declaration and six ' +
          'children collapsed into one column; two calendar overlays with an orphaned grid child ' +
          'that doubled their height; dropdown text painted with fill tokens instead of ink ' +
          'tokens. None are visible to tsc, eslint or jest, and none were reachable from a story ' +
          'that only rendered a trigger.\n\n' +
          'The two variants share no chrome. `desktop` renders an inline `<dialog>` ' +
          '(`.yc-noti-panel`: absolute at `top: calc(100% + 9px)`, right-aligned, ' +
          '`width: min(420px, 100vw - 32px)`, radius 20) anchored to the bell and dismissed by an ' +
          'outside mousedown. `phone` portals a whole sheet root to `document.body`: a blurred ' +
          '`--sh55` backdrop button, then a `max-height: 86vh` sheet with `24px 24px 0 0` corners, ' +
          'a grabber above the content and a home indicator below it, dismissed by its backdrop ' +
          'rather than by an outside click. Escape closes either one, through a capture-phase ' +
          'listener.\n\n' +
          'One honest limitation: `useNotifications` reports an empty feed today - there is no ' +
          'durable notifications source in the PIMS yet, and the presenter deliberately reports ' +
          'nothing rather than fabricating rows - so the bell shows no unread dot and the panel it ' +
          'opens is always the "All caught up" state. That IS the state that ships, which is why ' +
          'it is worth drawing inside the real dropdown and sheet chrome; the populated body is ' +
          'covered by the Panel stories, which pass items in directly.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    variant: 'desktop',
  },
} satisfies Meta<typeof NotificationsBell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Bell only',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Notifications' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(canvas.queryByRole('dialog')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting header control: a 17px outline bell in `.yc-icon-button`. The unread dot is ' +
          'absent because the feed reports zero unread, so the dot is a branch this component ' +
          'cannot currently reach from its own hook.',
      },
    },
  },
};

export const DesktopPanelOpen: Story = {
  name: 'Desktop dropdown open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Notifications' }));

    // Assert the panel has real content, not merely that aria-expanded flipped -
    // an empty panel satisfies the weaker check, which is how this kind of
    // regression stays invisible.
    const panel = await canvas.findByRole('dialog', { name: 'Notifications' });
    await expect(panel).toHaveClass('yc-noti-panel');
    await expect(within(panel).getByText('All caught up')).toBeInTheDocument();
    await expect(
      within(panel).getByText('New bookings, lab results and messages will land here.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dropdown, drawn inside its own chrome for the first time. The empty body has no ' +
          'header row and no footer - `NotificationsPanel` returns early for an empty list - so the ' +
          'panel is sized entirely by the empty block, which is exactly the composition worth ' +
          'seeing against the 420px card and its 20px radius.',
      },
    },
  },
};

export const DesktopEscapeCloses: Story = {
  name: 'Escape closes the dropdown',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bell = canvas.getByRole('button', { name: 'Notifications' });
    await userEvent.click(bell);
    await expect(await canvas.findByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(bell).toHaveAttribute('aria-expanded', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dismissal path a keyboard user has. The listener is registered in the capture phase ' +
          'and stops propagation, so a bell inside a modal or a sheet closes only itself rather ' +
          'than tearing down whatever is behind it.',
      },
    },
  },
};

export const PhoneSheetOpen: Story = {
  name: 'Phone sheet open',
  args: { variant: 'phone' },
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: {
    viewport: { options: PHONE_VIEWPORT },
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The phone surface: a portalled sheet root with its own blurred backdrop button, the ' +
          '44px grabber above the content and the home indicator below it. None of that markup ' +
          'exists in the desktop variant, and none of it exists until the bell is tapped.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Notifications' }));

    // The sheet portals to document.body, so it is outside canvasElement.
    const sheet = await within(document.body).findByRole('dialog', { name: 'Notifications' });
    await expect(sheet).toHaveClass('yc-noti-sheet');
    await expect(within(sheet).getByText('All caught up')).toBeInTheDocument();
    // The sheet chrome itself, which is the phone-only part of this surface.
    await expect(sheet.querySelector('.yc-noti-sheet-grabber')).not.toBeNull();
    await expect(sheet.querySelector('.yc-noti-home-indicator')).not.toBeNull();
    await expect(
      within(document.body).getByRole('button', { name: 'Close notifications' })
    ).toBeInTheDocument();
  },
};
