import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import GoogleAddressFieldRenderer from './googleAddressFieldRenderer';

const StatefulGoogleAddressFieldRenderer = (
  args: ComponentProps<typeof GoogleAddressFieldRenderer>
) => {
  const [value, setValue] = useState(args.value);
  return (
    <GoogleAddressFieldRenderer
      {...args}
      value={value}
      onChange={(next) => {
        setValue(next);
        args.onChange(next);
      }}
    />
  );
};

const googleAddressFieldRendererMeta = {
  title: 'Primitives/Accordion/GoogleAddressFieldRenderer',
  component: GoogleAddressFieldRenderer,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Shared `googleAddress` entry for field-renderer maps (ProfileCard, EditableAccordion). ' +
          'Wraps GoogleSearchDropDown so a single field definition can drive both the visible address ' +
          'input and the sibling fields around it: picking a prediction calls `onChange` with the street ' +
          'line and, if `onMultiChange` is given, also pushes the derived city/state/postalCode/country ' +
          'into whatever form state the caller manages. `onMultiChange` is optional - omit it and the ' +
          'renderer behaves like a plain single-value address field.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    error: { control: 'text' },
  },
  args: {
    field: { key: 'address', label: 'Address' },
    value: '',
    onChange: fn(),
    onMultiChange: fn(),
  },
  decorators: [
    (StoryFn) => (
      <div style={{ width: 420 }}>
        <StoryFn />
      </div>
    ),
  ],
  render: (args) => <StatefulGoogleAddressFieldRenderer {...args} />,
} satisfies Meta<typeof GoogleAddressFieldRenderer>;

export default googleAddressFieldRendererMeta;
type GoogleAddressFieldRendererStory = StoryObj<typeof googleAddressFieldRendererMeta>;

export const Default: GoogleAddressFieldRendererStory = {};

export const AddressSelected: GoogleAddressFieldRendererStory = {
  name: 'Address selected',
  args: { value: '1200 Mission Street, Suite 4' },
  parameters: {
    docs: {
      description: {
        story:
          'After a prediction is picked the field holds the street line; `onMultiChange` has already ' +
          'received the city/state/postalCode/country for the sibling fields.',
      },
    },
  },
};

export const WithError: GoogleAddressFieldRendererStory = {
  name: 'Validation error',
  args: { value: 'Unknown place', error: 'Select an address from the list' },
};

export const WithoutSiblingAutofill: GoogleAddressFieldRendererStory = {
  name: 'No onMultiChange',
  args: { onMultiChange: undefined },
  parameters: {
    docs: {
      description: {
        story:
          'Without `onMultiChange` the renderer still reports the street line through `onChange`, but ' +
          'skips autofilling city/state/postalCode/country - the shape a caller gets if it only wired up ' +
          'the single-value field.',
      },
    },
  },
};
