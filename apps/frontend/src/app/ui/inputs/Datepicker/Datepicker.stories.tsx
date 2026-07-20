import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import Datepicker from './index';

const StatefulDatepicker = (args: ComponentProps<typeof Datepicker>) => {
  const [date, setDate] = useState<Date | null>(args.currentDate);
  return <Datepicker {...args} currentDate={date} setCurrentDate={setDate} />;
};

const meta = {
  title: 'Inputs/Datepicker',
  component: Datepicker,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Calendar date field built on react-datepicker. `type="input"` renders a labelled ' +
          '46px field (13px radius, 1.5px hairline border, --field-bg fill); `type="icon"` renders ' +
          'a square 46px trigger. Popper opens a themed calendar.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'inline-radio', options: ['input', 'icon'] },
    error: { control: 'text' },
  },
  args: {
    placeholder: 'Date of birth',
    type: 'input',
    currentDate: null,
    setCurrentDate: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: (args) => <StatefulDatepicker {...args} />,
} satisfies Meta<typeof Datepicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InputField: Story = {};

export const WithValue: Story = {
  args: { currentDate: new Date(2024, 5, 12) },
};

export const IconOnly: Story = {
  args: { type: 'icon' },
  parameters: { docs: { story: 'Compact square trigger that opens the calendar popper.' } },
};

export const WithError: Story = {
  args: { error: 'Select a valid date.' },
};
