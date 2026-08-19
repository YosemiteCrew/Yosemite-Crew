import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { ConversationRow } from './ConversationRow';

const meta = {
  title: 'Chat/ConversationRow',
  component: ConversationRow,
  decorators: [
    // The kebab menu is absolutely positioned at `top-9` under the row and is
    // 190px wide, so the row needs both a sidebar-ish width and room below it.
    (Story) => (
      <div className="min-h-[340px] w-[320px] p-2">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One row of the chat sidebar: avatar with presence dot, name, network and mute glyphs, ' +
          'timestamp, preview line and unread pill, with a triage kebab beside it.\n\n' +
          'Everything to the right of the ellipsis is a surface no snapshot has held. The menu is ' +
          'gated on `menuOpen`, and opening it mounts **two** siblings, not one: a ' +
          '`fixed inset-0 z-10` full-screen transparent button that catches the next click ' +
          'anywhere on the page, and the `absolute right-0 top-9 z-20 w-[190px]` panel above it. ' +
          'The stacking is load-bearing - a backdrop at or above `z-20` would swallow every ' +
          'click meant for the menu, and the menu would look perfect while being completely ' +
          'inert. That is exactly the class of defect a closed-state snapshot cannot see.\n\n' +
          'Which rows the panel contains is decided by *which callbacks were passed*, not by a ' +
          'prop enumerating them: `onArchive` and `onUnarchive` are separate props rendering ' +
          'separate rows, and mute is chosen by `muted ? onUnmute : onMute`, so an archived, muted ' +
          'conversation and a live one produce panels with no rows in common. Both are drawn ' +
          'below.\n\n' +
          'The kebab trigger is itself conditional on interaction below the `xl` breakpoint: it ' +
          'is `opacity-0` until `group-hover` (or focus), and only at `xl` does it become the ' +
          'persistent `--inset` filled circle from the wide desktop frame. At sidebar widths the ' +
          'resting row genuinely has no visible affordance for any of this.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    name: 'Lena Hartmann',
    preview: 'Poppy is doing much better today, thank you',
    time: '09:41',
    onClick: fn(),
    onArchive: fn(),
    onMute: fn(),
    onSnooze: fn(),
  },
} satisfies Meta<typeof ConversationRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Resting',
  parameters: {
    docs: {
      description: {
        story:
          'What the sidebar shows before anyone touches the row. Below `xl` the kebab is present ' +
          'in the DOM but at `opacity-0`, so this is a row with an invisible control on it.',
      },
    },
  },
};

export const KebabRevealedOnHover: Story = {
  name: 'Kebab revealed (hover)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const kebab = canvas.getByRole('button', { name: 'Conversation actions' });
    // Resting: present, but transparent - the affordance only exists on hover
    // below xl, which is why it never appears in a static capture.
    await expect(kebab).toHaveClass('opacity-0');
    await expect(kebab).toHaveClass('group-hover:opacity-100');
    await userEvent.hover(kebab);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Hovering the row lifts the kebab to full opacity via the parent `group`. Focus does the ' +
          'same through `focus-visible:opacity-100`, so keyboard users are not locked out of the ' +
          'triage actions.',
      },
    },
  },
};

export const MenuOpen: Story = {
  name: 'Kebab menu open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Conversation actions' }));

    // Assert the panel has its rows. A check that the trigger merely toggled
    // would pass on an empty 190px card, which is how a dropped menu survives.
    const archive = await canvas.findByRole('button', { name: 'Archive' });
    await expect(archive).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Snooze · 1 hour' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Snooze · 1 day' })).toBeInTheDocument();

    // The click-catcher and the stacking that makes the menu usable.
    const backdrop = canvas.getByRole('button', { name: 'Close menu' });
    await expect(backdrop).toHaveClass('fixed', 'inset-0', 'z-10');
    const panel = archive.parentElement as HTMLElement;
    await expect(panel).toHaveClass('z-20');
    await expect(panel).toHaveClass('w-[190px]');
    // Four actions plus the hairline that separates snooze from the rest.
    await expect(within(panel).getAllByRole('button')).toHaveLength(4);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Archive, Mute, then an `--hairline` rule and the two snooze durations, in a `p-1.5` ' +
          'card with `rounded-xl` rows. The mute row carries `active`, so it sits on ' +
          '`bg-chat-surface-soft` while the others are plain until hovered - a selected-looking ' +
          'row that is not actually a selection.',
      },
    },
  },
};

export const ArchivedAndMutedMenu: Story = {
  name: 'Kebab menu open (archived + muted)',
  args: {
    muted: true,
    preview: 'Archived · last message 3 weeks ago',
    onArchive: undefined,
    onMute: undefined,
    onSnooze: undefined,
    onUnarchive: fn(),
    onUnmute: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The muted bell shows on the row itself, before the menu is touched.
    await expect(canvas.getByLabelText('Muted')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Conversation actions' }));
    const unarchive = await canvas.findByRole('button', { name: 'Unarchive' });
    await expect(unarchive).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
    // The inverse rows are genuinely absent, not disabled.
    await expect(canvas.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument();
    // Two rows, no snooze block, so the panel is barely a third of its usual height.
    await expect(
      within(unarchive.parentElement as HTMLElement).getAllByRole('button')
    ).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same component with the opposite callbacks: Unarchive and Unmute, no snooze, and no ' +
          'separator rule. Worth seeing beside the default - the two panels share their chrome and ' +
          'nothing else, and the short one is where a hard-coded panel height would show up.',
      },
    },
  },
};

export const NoActions: Story = {
  name: 'No actions (kebab absent)',
  args: {
    onArchive: undefined,
    onMute: undefined,
    onSnooze: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // `hasActions` drops the whole trigger rather than rendering a dead one.
    await expect(
      canvas.queryByRole('button', { name: 'Conversation actions' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A read-only row - the directory listings mount it this way. With no triage callbacks ' +
          'the kebab is not rendered at all, so the row text runs to the full width instead of ' +
          'reserving a 32px gutter for a control that does nothing.',
      },
    },
  },
};

export const UnreadActive: Story = {
  name: 'Unread, active, group',
  args: {
    name: 'Ward round · ICU',
    preview: 'Marisol: bay 3 needs a recheck at 14:00',
    unread: 4,
    group: true,
    active: true,
    online: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'The selected row with unread traffic. The badge is `--blue-strong` rather than `--blue` ' +
          'on purpose: white on `--blue` is 4.09:1, under AA at 10px, and the stronger tone is ' +
          '6.48:1. At `xl` the active row also swaps its raised white card for `--surface-soft` ' +
          'with an `inset 3px 0 0 --blue` left stripe.',
      },
    },
  },
};

export const NetworkAndApp: Story = {
  name: 'Across-the-network, via app',
  args: {
    name: 'Riverside Veterinary Centre',
    preview: 'Referral notes attached for Bruno',
    network: true,
    viaApp: true,
    time: 'Tue',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both provenance glyphs at once, each with its own `aria-label`, competing with the name ' +
          'for the row. The name is the only flexible element (`min-w-0 flex-1 truncate`); the ' +
          'glyphs and the timestamp are `shrink-0`, so a long clinic name clips rather than ' +
          'pushing the time off the row.',
      },
    },
  },
};
