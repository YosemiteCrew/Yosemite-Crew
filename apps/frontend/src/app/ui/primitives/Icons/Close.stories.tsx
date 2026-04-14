import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import Close from './Close';

const meta = {
  title: 'Primitives/Icons/Close',
  component: Close,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Close/dismiss icon. Default renders a circular button; set `iconOnly` to render just the SVG ' +
          '(useful when composing into a custom interactive container).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: { iconOnly: { control: 'boolean' } },
  args: { onClick: fn(), iconOnly: false },
} satisfies Meta<typeof Close>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const IconOnly: Story = { args: { iconOnly: true } };
