import type { Meta, StoryObj } from '@storybook/react';
import { WordsPullUp } from './WordsPullUp';

const meta = {
  title: 'Widgets/Animations/WordsPullUp',
  component: WordsPullUp,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Splits text by spaces and stagger-animates each word up from below the baseline. ' +
          'Triggers once when element enters viewport.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    text: { control: 'text' },
  },
  args: {
    text: 'Better animal health together',
    containerClassName: 'flex flex-wrap justify-center',
    className: 'text-heading-1 text-text-primary',
  },
} satisfies Meta<typeof WordsPullUp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongSentence: Story = {
  args: { text: 'The future of open source veterinary practice management is here' },
};
