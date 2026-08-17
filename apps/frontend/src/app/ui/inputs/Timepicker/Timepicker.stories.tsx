import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent } from 'storybook/test';
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

export const OpenList: Story = {
  name: 'Time list open',
  args: { value: '09:30' },
  parameters: {
    docs: {
      story:
        'The time list, which only exists after a click and so was never rendered in ' +
        'Storybook. Its selected row carried white on the brand fill `--color-brand-950` at ' +
        '4.04:1; it uses `--blue-strong` with `--white-text` now.',
    },
  },
  play: async ({ canvasElement }) => {
    // The trigger is react-datepicker's customInput, which is a BUTTON here -
    // there is no textbox to query.
    const trigger = canvasElement.querySelector('button');
    await userEvent.click(trigger as HTMLElement);
    await expect(document.querySelector('.yc-datepicker-calendar')).toBeInTheDocument();
  },
};
