import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import Back from './Back';
import Next from './Next';

const meta = {
  title: 'Primitives/Icons/Back button',
  component: Back,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A round icon-only button with a left chevron, used for "previous" in paginated tables, ' +
          'calendars and the onboarding stepper. Its only accessible name is the fixed ' +
          '`aria-label="Previous"`; the glyph carries no text. The hover fill is `--card-hover` ' +
          'and the disabled state is the native attribute, so an assistive technology user hears ' +
          'the button as unavailable rather than finding a click that does nothing.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
  args: {
    onClick: fn(),
    disabled: false,
  },
} satisfies Meta<typeof Back>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Previous' });
    await expect(button).toBeEnabled();
    await expect(button.querySelector('svg')).not.toBeNull();
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Previous' });
    await expect(button).toBeDisabled();
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first page of a list. The chevron stays visible so the control does not vanish and ' +
          'reflow its neighbours; only the click is withheld.',
      },
    },
  },
};

export const PaginationBar: Story = {
  name: 'Pagination bar (Back + Next)',
  render: (args) => (
    <div className="flex items-center gap-3">
      <Back {...args} />
      <span className="text-[13px] text-[var(--ink-muted)]">Showing 10 of 47 companions</span>
      <Next onClick={fn()} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    await expect(canvas.getByText('Showing 10 of 47 companions')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The pair as the paginated tables draw them, with the count between. Both chevrons are ' +
          'the same 20px glyph in the same 36px hit area, so the row is symmetrical.',
      },
    },
  },
};
