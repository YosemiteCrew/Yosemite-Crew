import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import ModalHeader from './ModalHeader';

const meta = {
  title: 'Overlays/ModalHeader',
  component: ModalHeader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Standard modal header with centered title and close button. ' +
          'A hidden spacer button on the left keeps the title visually centered. ' +
          'Use inside `CenterModal` or any modal container.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
  },
  args: {
    title: 'Modal title',
    onClose: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-md border border-card-border rounded-2xl p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ModalHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongTitle: Story = { args: { title: 'Confirm deletion of appointment record' } };
