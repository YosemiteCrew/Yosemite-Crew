import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import CardHeader from './CardHeader';

const meta = {
  title: 'Cards/CardHeader',
  component: CardHeader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Section header with a 16px/700 --ink title and a hairline period-filter pill (12px / ' +
          'semibold / --ink-muted, 12px --ink-faint chevron, 6px×12px padding) matching the ' +
          'dashboard design.\n\n' +
          'The pill opens a listbox panel, and that panel is the reason this file matters more than ' +
          'its component: `CardHeader` is the header for Explore and for all six dashboard stat ' +
          'cards, so a single unreviewed panel here is the same panel on every one of them. It is ' +
          'rendered behind an `open` state and had never been drawn - the stories showed only the ' +
          'closed pill.\n\n' +
          'The panel is absolutely positioned at `top-[120%] right-0`, so it hangs below the pill ' +
          'and is right-aligned to it. `min-w-full` plus `whitespace-nowrap` means it takes its ' +
          'width from the longest option rather than from the pill, which is only visible with it ' +
          'open.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Explore',
    options: ['Last week', 'Last month', 'Last 6 months'],
    onSelect: fn(),
  },
} satisfies Meta<typeof CardHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Closed',
};

export const Open: Story = {
  name: 'Period panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /filter explore by time period/i }));
    const panel = canvas.getByLabelText('Filter Explore by time period');
    await expect(panel).toBeInTheDocument();
    // Assert the panel has its options, not just that the trigger flipped aria-expanded -
    // the weaker check passes on an empty panel.
    await expect(within(panel).getAllByRole('button')).toHaveLength(3);
  },
  parameters: {
    docs: {
      story:
        'The panel every stat card shares. The current period carries `aria-pressed`, which is the ' +
        'only thing distinguishing it - there is no check mark, so the selected row has to read as ' +
        'selected on colour alone.',
    },
  },
};

export const OpenWithLongOptions: Story = {
  name: 'Panel wider than its pill',
  args: {
    selected: 'Last 6 months',
    options: ['Last week', 'Last month', 'Last 6 months', 'Last 1 year'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /filter explore by time period/i }));
    const panel = canvas.getByLabelText('Filter Explore by time period');
    await expect(within(panel).getAllByRole('button')).toHaveLength(4);
  },
  parameters: {
    docs: {
      story:
        'Four options, the longest wider than the pill that opened it. `min-w-full` sets the floor ' +
        'and `whitespace-nowrap` stops the rows wrapping, so the panel grows leftwards from its ' +
        'right-aligned edge instead of overflowing the card.',
    },
  },
};

export const LongTitle: Story = {
  name: 'Long title (wraps beside pill)',
  args: { title: 'Appointment leaders by clinician' },
};

export const Controlled: Story = {
  args: { selected: 'Last month' },
};

export const SectionVariant: Story = {
  name: 'Section variant (open)',
  args: { variant: 'section' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /filter explore by time period/i }));
    await expect(canvas.getByLabelText('Filter Explore by time period')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        "The larger Explore heading: 16px title and a 12px pill against the card variant's 15px " +
        'and 11.5px. The panel itself does not change size with the variant, which is worth seeing ' +
        'against both.',
    },
  },
};
