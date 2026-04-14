import type { Meta, StoryObj } from '@storybook/react';
import { TextFade } from './TextFade';

const meta = {
  title: 'Widgets/Animations/TextFade',
  component: TextFade,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Stagger-fades each direct child element in from above or below when it enters the viewport. ' +
          'Triggers once per page load.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    direction: { control: 'radio', options: ['up', 'down'] },
    staggerChildren: { control: { type: 'range', min: 0.05, max: 0.5, step: 0.05 } },
  },
  args: { direction: 'up', staggerChildren: 0.1 },
} satisfies Meta<typeof TextFade>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Up: Story = {
  args: { direction: 'up' },
  render: (args) => (
    <TextFade {...args} className="flex flex-col gap-3 text-center">
      <h2 className="text-heading-1 text-text-primary">Yosemite Crew</h2>
      <p className="text-body-3 text-text-secondary">Better animal health, together.</p>
      <p className="text-body-4 text-text-secondary">Open-source veterinary platform.</p>
    </TextFade>
  ),
};

export const Down: Story = {
  args: { direction: 'down' },
  render: (args) => (
    <TextFade {...args} className="flex flex-col gap-3 text-center">
      <h2 className="text-heading-1 text-text-primary">Yosemite Crew</h2>
      <p className="text-body-3 text-text-secondary">Better animal health, together.</p>
    </TextFade>
  ),
};
