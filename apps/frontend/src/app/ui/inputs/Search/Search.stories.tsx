import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import Search from './index';

const meta = {
  title: 'Inputs/Search',
  component: Search,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Search input with magnifier icon. Fixed width (`w-60` / `xl:w-[280px]`). ' +
          'Controlled: pass `value` and `setSearch`.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    value: { control: 'text' },
  },
  args: {
    value: '',
    placeholder: 'Search',
    setSearch: fn(),
  },
} satisfies Meta<typeof Search>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const WithValue: Story = { args: { value: 'Harshit' } };
export const CustomPlaceholder: Story = { args: { placeholder: 'Search appointments…' } };
