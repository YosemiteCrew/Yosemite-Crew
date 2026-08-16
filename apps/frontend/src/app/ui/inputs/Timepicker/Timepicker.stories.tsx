import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import Timepicker from './index';

const StatefulTimepicker = (args: ComponentProps<typeof Timepicker>) => {
  const [value, setValue] = useState(args.value);
  return <Timepicker {...args} value={value} onChange={setValue} />;
};

const meta = {
  title: 'Inputs/Timepicker',
  component: Timepicker,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Time-of-day field built on react-datepicker. Labelled 46px trigger (13px radius, ' +
          '1.5px hairline border, --field-bg fill, 13.5px value) with a clock icon; opens a ' +
          'time-only list. `value`/`onChange` use "HH:mm" strings.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    minuteInterval: { control: 'number' },
    error: { control: 'text' },
  },
  args: {
    label: 'Start time',
    value: '',
    onChange: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: (args) => <StatefulTimepicker {...args} />,
} satisfies Meta<typeof Timepicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithValue: Story = {
  args: { value: '09:30' },
};

export const WithError: Story = {
  args: { error: 'Select a time.' },
};
