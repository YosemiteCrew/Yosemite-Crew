import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import FormInput from './FormInput';

const meta = {
  title: 'Inputs/FormInput',
  component: FormInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Compatibility API for the canonical Field and Input primitives. ' +
          'Uses a static label above the 40px control and one shared help/error slot.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    intype: { control: 'select', options: ['text', 'email', 'number', 'date', 'time'] },
    readonly: { control: 'boolean' },
    error: { control: 'text' },
  },
  args: {
    intype: 'text',
    inname: 'demo',
    inlabel: 'Full name',
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
} satisfies Meta<typeof FormInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithValue: Story = {
  args: { value: 'Harshit Wandhare', inlabel: 'Full name' },
};

export const EmailType: Story = {
  args: { intype: 'email', inlabel: 'Email address', inname: 'email', value: '' },
};

export const WithError: Story = {
  args: { value: 'bad', inlabel: 'Email address', error: 'Enter a valid email address.' },
  parameters: {
    docs: {
      description: { story: 'Error message shown below the input with a warning icon.' },
    },
  },
};

export const Readonly: Story = {
  args: { value: 'Non-editable', inlabel: 'Fixed field', readonly: true },
};
