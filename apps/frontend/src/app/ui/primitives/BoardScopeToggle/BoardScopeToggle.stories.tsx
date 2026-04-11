import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import BoardScopeToggle from './BoardScopeToggle';

const meta = {
  title: 'Primitives/BoardScopeToggle',
  component: BoardScopeToggle,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Sliding two-segment toggle. Used on task boards to switch between "All" items and "Mine only". ' +
          'Blue when showing all, pink when filtered to current user.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showMineOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    allLabel: { control: 'text' },
    mineLabel: { control: 'text' },
  },
  args: {
    showMineOnly: false,
    disabled: false,
    allLabel: 'All tasks',
    mineLabel: 'My tasks',
    onChange: fn(),
  },
} satisfies Meta<typeof BoardScopeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ShowingAll: Story = { args: { showMineOnly: false } };
export const ShowingMine: Story = { args: { showMineOnly: true } };
export const Disabled: Story = { args: { disabled: true } };
