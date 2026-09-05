import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import FilteredEmptyState from './FilteredEmptyState';

const meta = {
  title: 'Layout/FilteredEmptyState',
  component: FilteredEmptyState,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The card a list shows when its filters exclude every row. It is deliberately not an ' +
          'error: a blue filter disc, a title that names the cause, and one way out. The clear ' +
          'action is only drawn when `onClearFilters` is passed, so a table with nothing to clear ' +
          'never shows a dead button. The copy props exist because "these filters" means something ' +
          'different on invoices, tasks and appointments, and the defaults are written for a ' +
          'date-plus-status filter bar.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    onClearFilters: fn(),
  },
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof FilteredEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'With clear action',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Nothing matches these filters')).toBeInTheDocument();
    await expect(
      canvas.getByText('Try widening the date range or clearing a status filter.')
    ).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Clear all filters' }));
    await expect(args.onClearFilters).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default copy with a real clear handler. The button is a `Secondary` pill with the ' +
          'close-circle glyph, so it reads as "undo the filters" rather than as a primary action.',
      },
    },
  },
};

export const NoAction: Story = {
  name: 'Without clear action',
  args: {
    onClearFilters: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Nothing matches these filters')).toBeInTheDocument();
    // Hidden rather than disabled: a disabled "Clear all filters" would promise
    // something the caller cannot do.
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'No handler, no button. The card keeps its height and centring so a list that toggles ' +
          'between the two readings does not jump.',
      },
    },
  },
};

export const CustomCopy: Story = {
  name: 'Custom copy (invoices)',
  args: {
    title: 'No invoices in this range',
    message: 'Adjust the date range or clear the status filter to see more.',
    clearLabel: 'Reset filters',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No invoices in this range')).toBeInTheDocument();
    await expect(
      canvas.getByText('Adjust the date range or clear the status filter to see more.')
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Reset filters' }));
    await expect(args.onClearFilters).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every string is a prop. The finance list names the record type in the title and ' +
          'relabels the action, and nothing about the card geometry changes.',
      },
    },
  },
};
