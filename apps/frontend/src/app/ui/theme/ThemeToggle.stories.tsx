import type { Meta, StoryObj } from '@storybook/react';
import ThemeToggle from './ThemeToggle';

const meta = {
  title: 'Theme/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Round 38px button that flips the PIMS between the warm-bone light theme and the espresso ' +
          'dark theme. It reads and writes `data-theme` on `<html>` (the same source of truth the ' +
          'pre-paint theme script sets) and persists the choice, so pressing it here flips the whole ' +
          'Storybook canvas exactly as it flips the app. A moon shows in light mode, a sun in dark, ' +
          'and `aria-pressed` reflects the dark state.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    style: { control: false },
  },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FullWidth: Story = {
  name: 'Full width (collapsed menu)',
  args: {
    style: { width: '100%', borderRadius: 12 },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 200,
          padding: 12,
          borderRadius: 16,
          border: '1px solid var(--hairline)',
          background: 'var(--screen)',
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'The `style` prop merges over the base pill, which is how the account menu renders it as a ' +
          'full-width row instead of a floating circle.',
      },
    },
  },
};
