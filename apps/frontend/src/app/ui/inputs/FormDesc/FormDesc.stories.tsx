import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import FormDesc from './FormDesc';

const meta = {
  title: 'Inputs/FormDesc',
  component: FormDesc,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Multi-line control composed from the canonical Field and Textarea primitives. ' +
          'Uses a static label and one shared help/error slot.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    readonly: { control: 'boolean' },
    error: { control: 'text' },
  },
  args: {
    intype: 'text',
    inname: 'notes',
    inlabel: 'Concern / notes',
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
} satisfies Meta<typeof FormDesc>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithValue: Story = {
  args: { value: 'Scratching her left ear since the weekend.' },
};

export const WithError: Story = {
  args: { value: '', error: 'Please describe the concern.' },
  parameters: {
    docs: {
      description: { story: 'Error message replaces helper text below the textarea.' },
    },
  },
};

export const Readonly: Story = {
  args: { value: 'Non-editable note', inlabel: 'Fixed note', readonly: true },
};
