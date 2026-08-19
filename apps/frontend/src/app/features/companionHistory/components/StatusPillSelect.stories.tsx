import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { StatusPillSelect } from './CompanionHistoryTimeline';
import { AppointmentLabels, TaskLabels } from '@/app/config/statusConfig';

/** The menu is absolutely positioned under the pill, so the canvas needs room below it. */
const Room = (Story: React.ComponentType) => (
  <div className="flex min-h-[280px] items-start justify-center pt-6">
    <Story />
  </div>
);

const meta = {
  title: 'Companions/StatusPillSelect',
  component: StatusPillSelect,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The status control on every appointment and task row of the companion history timeline: ' +
          'a status pill that is either a read-only badge or, when transitions exist, a trigger for ' +
          'a `role="menu"` panel.\n\n' +
          'The panel had never been drawn. It is rendered behind an `open` flag and, crucially, it ' +
          'is dismissed by `onBlur` on the trigger - so it cannot survive a click anywhere else, ' +
          'and any review that is not an actual interaction sees only the closed pill. What is ' +
          "inside it is not decoration: each row pairs an 8px dot filled with that status's " +
          "`borderColor` against a label in that status's `color`, both pulled from " +
          '`getStatusStyle`. Six different token pairs render in one panel and none of them appear ' +
          'anywhere in the resting markup.\n\n' +
          'Which rows appear is derived twice over. `allowedKeys` filters the option list ' +
          'case-insensitively against `option.key`, so an allow-list naming a status the option ' +
          'list does not carry silently drops it; and when the filter leaves nothing - or `locked` ' +
          'or `disabled` is set - the component stops being a control at all and falls back to a ' +
          'plain `StatusPill` with no caret and nothing focusable.\n\n' +
          'The rows commit on `mouseDown` with `preventDefault`, not on `click`, precisely so the ' +
          "trigger's blur handler cannot close the panel out from under the selection. The stories " +
          'assert the opened panel has its rows and its dots, rather than that `aria-expanded` ' +
          'flipped - an empty panel satisfies the weaker check.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    status: 'upcoming',
    options: AppointmentLabels,
    onChange: fn(),
  },
} satisfies Meta<typeof StatusPillSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Trigger only',
  parameters: {
    docs: {
      description: {
        story:
          'The resting pill: the compact label plus a 10px chevron that rotates 180 degrees while ' +
          'the panel is open. The full status wording stays in the `title` attribute, because ' +
          '"Awaiting payment" is shortened to "Awaiting" on the pill itself.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Menu open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Status' }));

    const menu = canvas.getByRole('menu');
    await expect(menu).toBeInTheDocument();
    // Assert the panel has its rows, not merely that the trigger flipped
    // aria-expanded: an empty panel passes the weaker check.
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(6);
    await expect(within(menu).getByText('In progress')).toBeInTheDocument();

    /* Every row carries a colour dot, and the dot is the only thing separating
       one status from another at a glance. Six rows must mean six dots. */
    await expect(menu.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(6);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole appointment status vocabulary in one panel. This is the render where all six ' +
          'status token pairs are visible together, which is the only way to check they read as six ' +
          'distinct states rather than three plus three near-duplicates.',
      },
    },
  },
};

export const AllowedTransitions: Story = {
  name: 'Only the valid transitions',
  args: { allowedKeys: ['CHECKED_IN', 'CANCELLED'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Status' }));

    const menu = canvas.getByRole('menu');
    // The allow-list is matched case-insensitively against option.key, so the
    // upper-case keys the transition helpers return still hit the lower-case options.
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
    await expect(within(menu).getByText('Checked in')).toBeInTheDocument();
    await expect(within(menu).queryByText('Completed')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'How the timeline actually renders it: the panel offers only what the status machine ' +
          'permits next, so a two-row panel is the common case and the six-row one is the outlier. ' +
          'A short panel is where a menu sized from its trigger rather than its content shows up.',
      },
    },
  },
};

export const SelectingATransition: Story = {
  name: 'Selecting a row',
  args: { allowedKeys: ['CHECKED_IN', 'CANCELLED'] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Status' }));
    await userEvent.click(within(canvas.getByRole('menu')).getByText('Checked in'));

    // The row commits the option KEY, not its display name.
    await expect(args.onChange).toHaveBeenCalledWith('checked_in');
    // ...and the panel closes behind it.
    await expect(canvas.queryByRole('menu')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The commit path. It fires on `mouseDown` with `preventDefault`, which is what stops the ' +
          "trigger's `onBlur` from closing the panel before the click ever lands - a plain `onClick` " +
          'here would be a dead row.',
      },
    },
  },
};

export const ClosesOnBlur: Story = {
  name: 'Closes on blur',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Status' }));
    await expect(canvas.getByRole('menu')).toBeInTheDocument();

    await userEvent.tab();
    await expect(canvas.queryByRole('menu')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Moving focus off the trigger dismisses the panel. Worth pinning down because the panel ' +
          'is not focusable itself - keyboard users tabbing forward from the pill lose it rather ' +
          'than entering it.',
      },
    },
  },
};

export const Locked: Story = {
  name: 'Locked (terminal status)',
  args: { status: 'completed', locked: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Not a disabled button - no button at all, so there is no affordance
    // suggesting a change that cannot happen.
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(canvas.getByText('Completed')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A completed appointment has nowhere to go, so the component renders a badge with no ' +
          'caret and nothing focusable rather than a dimmed trigger.',
      },
    },
  },
};

export const NoAllowedTransitions: Story = {
  name: 'Empty allow-list (badge)',
  args: { allowedKeys: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An empty `allowedKeys` is not the same as omitting it: an empty array is still truthy, ' +
          'so the filter runs and removes every option, and the component degrades to the same ' +
          'badge as `locked`. This is the branch that turns a control into a label without anyone ' +
          'passing `locked`.',
      },
    },
  },
};

export const TaskVocabulary: Story = {
  name: 'Task statuses',
  args: { status: 'in_progress', options: TaskLabels },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Status' }));
    await expect(within(canvas.getByRole('menu')).getAllByRole('menuitem')).toHaveLength(4);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same component driven by the task vocabulary, which is four statuses rather than ' +
          'six and starts at Pending instead of Requested. The two lists share three token pairs ' +
          'and differ in the fourth, so both belong in review.',
      },
    },
  },
};
