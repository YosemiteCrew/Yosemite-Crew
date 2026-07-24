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
          'Multi-line textarea with a static top label, matching the design field system ' +
          '(46px-scale fields: 13px radius, 1.5px hairline border, --field-bg fill, 13.5px text). ' +
          'Supports error display with a warning icon.',
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
      description: { story: 'Error message shown below the textarea with a warning icon.' },
    },
  },
};

export const Readonly: Story = {
  args: { value: 'Non-editable note', inlabel: 'Fixed note', readonly: true },
};
