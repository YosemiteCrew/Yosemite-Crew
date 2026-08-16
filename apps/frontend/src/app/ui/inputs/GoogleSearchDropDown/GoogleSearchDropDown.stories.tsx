import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import GoogleSearchDropDown from './GoogleSearchDropDown';

const StatefulGoogleSearchDropDown = (args: ComponentProps<typeof GoogleSearchDropDown>) => {
  const [value, setValue] = useState(args.value);
  return (
    <GoogleSearchDropDown
      {...args}
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        args.onChange?.(event);
      }}
    />
  );
};

const meta = {
  title: 'Inputs/GoogleSearchDropDown',
  component: GoogleSearchDropDown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Address field backed by Google Places autocomplete: the user types a clinic or address, ' +
          'picks a prediction, and the component fills the surrounding form (name, phone, website and ' +
          'the split address) from the place details. The field is the standard 44px form input — ' +
          '`--field-bg` fill, 1.5px `--hairline` border, 12px radius — and squares its bottom corners ' +
          'while the prediction list is open. Predictions are fetched from the live Places API after ' +
          'two characters, so in Storybook (no API key) typing leaves the list closed; the stories ' +
          'below cover the states the field renders on its own.',
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
    inname: 'address',
    inlabel: 'Clinic address',
    value: '',
    onChange: fn(),
  },
  decorators: [
    (StoryFn) => (
      <div style={{ width: 420 }}>
        <StoryFn />
      </div>
    ),
  ],
  render: (args) => <StatefulGoogleSearchDropDown {...args} />,
} satisfies Meta<typeof GoogleSearchDropDown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  name: 'Address selected',
  args: { value: '1200 Mission Street, Suite 4' },
  parameters: {
    docs: {
      description: {
        story:
          'After a prediction is picked the field holds the street line; the rest of the address lands in the form around it.',
      },
    },
  },
};

export const WithError: Story = {
  name: 'Validation error',
  args: { value: 'Unknown place', error: 'Select an address from the list' },
};

export const ReadOnly: Story = {
  name: 'Read only',
  args: { value: '1200 Mission Street, Suite 4', readonly: true },
  parameters: {
    docs: {
      description: {
        story: 'Read-only fields never open the prediction list and never call the Places API.',
      },
    },
  },
};
