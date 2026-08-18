import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import GlassTooltip from './GlassTooltip';

const meta = {
  title: 'Primitives/GlassTooltip',
  component: GlassTooltip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Portal-based tooltip with viewport-aware positioning. Triggers on hover and focus. ' +
          'Supports four placement directions.\n\n' +
          'The bubble does not exist in the DOM until the trigger is hovered or focused, and no ' +
          'prop can force it open - the listeners are attached imperatively in a `useEffect`. The ' +
          'four placement stories below therefore drew only the closed trigger button, so the ' +
          'bubble itself, and the whole of `updatePosition`, had never once run in Storybook.\n\n' +
          'That matters more than it sounds. `updatePosition` measures the trigger AND the bubble, ' +
          'picks a side, then clamps against the viewport with an 8px padding - none of which is ' +
          'exercised by rendering a button. The stories now open the bubble in a `play` function, ' +
          'so the placement logic is under visual review.\n\n' +
          'Both entry paths are covered: hover, and keyboard focus via `focusin`, which is the one ' +
          'a keyboard user actually gets.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    side: { control: 'select', options: ['top', 'right', 'bottom', 'left'] },
    content: { control: 'text' },
  },
  args: {
    content: 'Helpful tooltip text',
    side: 'top',
  },
} satisfies Meta<typeof GlassTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

const TriggerButton = ({ children }: { children: React.ReactNode }) => (
  <button
    type="button"
    className="px-6 py-3 border border-card-border rounded-2xl text-body-4 text-text-primary"
  >
    {children}
  </button>
);

/** Hovers the trigger and asserts the portalled bubble actually rendered its content. */
const openOnHover = async (canvasElement: HTMLElement, expected: string) => {
  const canvas = within(canvasElement);
  await userEvent.hover(canvas.getByRole('button', { name: /hover me|top|right|bottom|left/i }));
  const bubble = await within(document.body).findByRole('tooltip');
  await expect(bubble).toHaveTextContent(expected);
};

export const Top: Story = {
  args: { side: 'top', content: 'Appears above' },
  render: (args) => (
    <GlassTooltip {...args}>
      <TriggerButton>Hover me</TriggerButton>
    </GlassTooltip>
  ),
  play: async ({ canvasElement }) => openOnHover(canvasElement, 'Appears above'),
};

export const Bottom: Story = {
  args: { side: 'bottom', content: 'Appears below' },
  render: (args) => (
    <GlassTooltip {...args}>
      <TriggerButton>Hover me</TriggerButton>
    </GlassTooltip>
  ),
  play: async ({ canvasElement }) => openOnHover(canvasElement, 'Appears below'),
};

export const Left: Story = {
  args: { side: 'left', content: 'Appears left' },
  render: (args) => (
    <GlassTooltip {...args}>
      <TriggerButton>Hover me</TriggerButton>
    </GlassTooltip>
  ),
  play: async ({ canvasElement }) => openOnHover(canvasElement, 'Appears left'),
};

export const Right: Story = {
  args: { side: 'right', content: 'Appears right' },
  render: (args) => (
    <GlassTooltip {...args}>
      <TriggerButton>Hover me</TriggerButton>
    </GlassTooltip>
  ),
  play: async ({ canvasElement }) => openOnHover(canvasElement, 'Appears right'),
};

export const KeyboardFocus: Story = {
  name: 'Opened by keyboard focus',
  args: { side: 'top', content: 'Reachable without a mouse' },
  render: (args) => (
    <GlassTooltip {...args}>
      <TriggerButton>Hover me</TriggerButton>
    </GlassTooltip>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // focusin, not hover - the path a keyboard user takes, and the one most likely to
    // rot unnoticed because every manual check is done with a mouse.
    canvas.getByRole('button').focus();
    const bubble = await within(document.body).findByRole('tooltip');
    await expect(bubble).toHaveTextContent('Reachable without a mouse');
  },
};

export const LongContent: Story = {
  name: 'Long content (wraps and clamps)',
  args: {
    side: 'top',
    content: 'Dispensing this course will deduct the full quantity from stock, not a single dose.',
    maxWidth: 220,
  },
  render: (args) => (
    <GlassTooltip {...args}>
      <TriggerButton>Hover me</TriggerButton>
    </GlassTooltip>
  ),
  play: async ({ canvasElement }) => openOnHover(canvasElement, 'deduct the full quantity'),
  parameters: {
    docs: {
      story:
        'A bubble wide enough to need `maxWidth` and to be pushed back inside the viewport by the ' +
        '8px clamp. This is the case `updatePosition` exists for, and the case a closed trigger ' +
        'can never show.',
    },
  },
};

export const AllSides: Story = {
  name: 'All placements',
  render: () => (
    <div className="grid grid-cols-2 gap-8 place-items-center w-72">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <GlassTooltip key={side} content={`Tooltip on ${side}`} side={side}>
          <TriggerButton>{side}</TriggerButton>
        </GlassTooltip>
      ))}
    </div>
  ),
};
