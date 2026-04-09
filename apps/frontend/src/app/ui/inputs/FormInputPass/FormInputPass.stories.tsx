import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import FormInputPass from './FormInputPass';

const meta = {
  title: 'Inputs/FormInputPass',
  component: FormInputPass,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Password input with show/hide toggle. Same floating-label style as `FormInput`. ' +
          'Toggle button carries correct aria-label for accessibility.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    error: { control: 'text' },
  },
  args: {
    intype: 'password',
    inname: 'password',
    inlabel: 'Password',
    value: '',
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormInputPass>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithValue: Story = {
  args: { value: 'myS3cur3P@ss' },
  parameters: {
    docs: {
      description: { story: 'Click the eye icon to reveal the password.' },
    },
  },
};

export const WithError: Story = {
  args: { value: 'short', error: 'Password must be at least 8 characters.' },
};
