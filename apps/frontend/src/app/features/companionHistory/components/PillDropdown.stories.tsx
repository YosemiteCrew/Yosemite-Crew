import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { PillDropdown } from './CompanionHistoryTimeline';

const SORT_OPTIONS = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Type', value: 'type' },
  { label: 'Status', value: 'status' },
];

const STATUS_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Awaiting payment', value: 'no_payment' },
  { label: 'Checked in', value: 'checked_in' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

/** The panel is absolutely positioned under the pill, so the canvas needs room below it. */
const Room = (Story: React.ComponentType) => (
  <div className="flex min-h-[280px] items-start justify-center pt-6">
    <Story />
  </div>
);

/** Opens the panel and returns it - the panel itself carries no role to query by. */
const openPanel = async (canvasElement: HTMLElement, triggerName: RegExp) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: triggerName }));
  const firstOption = canvas.getAllByRole('button')[1];
  return firstOption.parentElement as HTMLElement;
};

const meta = {
  title: 'Companions/PillDropdown',
  component: PillDropdown,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Status and Sort-by selectors above the companion history list, styled as filter pills ' +
          'so they read alongside the history-tab chips rather than as boxed form fields.\n\n' +
          'The panel is the reason this file exists, and it had never been rendered. It sits behind ' +
          'an `open` flag and is dismissed by a document-level `mousedown` listener, so it survives ' +
          'only for as long as an interaction holds it - no static render of this component has ' +
          'ever contained a single option row.\n\n' +
          'What is inside it is a text-token surface, which is exactly the shape of the dropdown ' +
          'bug this work exists to catch: the panel paints `--screen` with a `--hairline` border, ' +
          'and its rows are `--ink` at `font-bold` when selected against `--ink-muted` at ' +
          '`font-medium` when not, hovering to `--inset`. Weight and ink are the ONLY thing marking ' +
          'the current choice - there is no check mark, no dot, no background - so a row that ' +
          'reached for a fill token instead of an ink token would look deliberate and be ' +
          'unreadable. The stories assert the weight, not merely that rows exist.\n\n' +
          'One thing the stories make visible rather than fix: the trigger advertises ' +
          '`aria-haspopup="menu"`, but the panel it opens is a plain `<div>` of plain `<button>`s ' +
          'with no `role="menu"` and no `role="menuitem"`. Anything querying this as a menu finds ' +
          'nothing - which is why the assertions below anchor on the option buttons themselves.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: 'Sort by',
    options: SORT_OPTIONS,
    value: 'newest',
    onSelect: fn(),
  },
} satisfies Meta<typeof PillDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Trigger only',
  parameters: {
    docs: {
      description: {
        story:
          'The resting pill: a 1px `--hairline` border, 12px semibold `--ink-muted` text and a 12px ' +
          'chevron. It shows the selected option\'s label, not the field label - "Sort by" only ' +
          'survives in the accessible name.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Panel open',
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement, /^Sort by: Newest first$/);

    // Assert the panel has its rows, not that the trigger flipped aria-expanded:
    // an empty panel satisfies the weaker check.
    const rows = within(panel).getAllByRole('button');
    await expect(rows).toHaveLength(4);
    await expect(within(panel).getByText('Oldest first')).toBeInTheDocument();

    /* Weight is the entire selected-state affordance - there is no check mark.
       Assert it directly, or a row that lost its bold would still pass. */
    await expect(within(panel).getByText('Newest first')).toHaveClass('font-bold');
    await expect(within(panel).getByText('Oldest first')).toHaveClass('font-medium');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The four sort options with the current one bolded. The panel has a `min-w-40` (160px) ' +
          "floor and grows from the pill's left edge, so it is regularly wider than the pill that " +
          'opened it.',
      },
    },
  },
};

export const StatusFilter: Story = {
  name: 'Status filter (wide options)',
  args: { label: 'Status', options: STATUS_OPTIONS, value: 'in_progress' },
  play: async ({ canvasElement }) => {
    const panel = await openPanel(canvasElement, /^Status: In progress$/);
    await expect(within(panel).getAllByRole('button')).toHaveLength(5);
    await expect(within(panel).getByText('In progress')).toHaveClass('font-bold');
    // "Awaiting payment" is the longest row and sets the panel width.
    await expect(within(panel).getByText('Awaiting payment')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The other caller, with longer labels and a selection in the middle of the list. Rows do ' +
          'not truncate, so the panel takes its width from the longest option while the pill keeps ' +
          'its own - a mismatch only visible with the panel open.',
      },
    },
  },
};

export const SelectingAnOption: Story = {
  name: 'Selecting a row',
  play: async ({ args, canvasElement }) => {
    const panel = await openPanel(canvasElement, /^Sort by: Newest first$/);
    await userEvent.click(within(panel).getByText('Type'));

    // The row commits the option VALUE, not its label.
    await expect(args.onSelect).toHaveBeenCalledWith('type');
    // The component closes itself even though it is otherwise fully controlled.
    await expect(within(canvasElement).getAllByRole('button')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Committing a choice. The pill is controlled - the label only changes once the parent ' +
          'sends a new `value` back - but the open/closed state is local, so the panel closes on ' +
          'its own regardless of what the parent does with the selection.',
      },
    },
  },
};

export const ClosesOnOutsideClick: Story = {
  name: 'Closes on outside press',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Sort by: Newest first$/ }));
    await expect(canvas.getAllByRole('button')).toHaveLength(5);

    // A document-level mousedown listener dismisses it; there is no Escape handler.
    await userEvent.click(canvasElement);
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          "Dismissal is `mousedown` on `document`, scoped to anything outside the pill's own " +
          'container. Escape does nothing here, which is worth knowing before this pill is reused ' +
          'inside a modal that does listen for it.',
      },
    },
  },
};

export const UnknownValue: Story = {
  name: 'Value not in the options',
  args: { value: 'relevance' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // With no matching option the trigger falls back to the field label, so the
    // pill reads "Sort by" and no row is bolded.
    const trigger = canvas.getByRole('button', { name: /^Sort by: Sort by$/ });
    await userEvent.click(trigger);
    const panel = canvas.getAllByRole('button')[1].parentElement as HTMLElement;
    await expect(within(panel).getAllByRole('button')).toHaveLength(4);
    await expect(panel.querySelectorAll('.font-bold')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A value the option list does not carry - a stale saved filter, or a status removed from ' +
          'the vocabulary. The pill degrades to the field label and the panel shows nothing as ' +
          'selected, which is honest but leaves the accessible name reading "Sort by: Sort by".',
      },
    },
  },
};
