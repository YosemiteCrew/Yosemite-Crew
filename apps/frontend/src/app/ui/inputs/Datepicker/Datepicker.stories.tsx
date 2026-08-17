import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent } from 'storybook/test';
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

export const OpenCalendar: Story = {
  name: 'Calendar open',
  args: { currentDate: new Date(2024, 5, 12) },
  parameters: {
    docs: {
      story:
        'The popper itself, which nothing else in this file renders. Every rule that styles ' +
        'the calendar lives behind a click, so the panel was invisible to Storybook and to ' +
        'Chromatic - four of its colours were wrong and no story could have caught it. The ' +
        'selected day and the selected time were `--color-brand-950`, the brand FILL, under ' +
        'white at 4.04:1, and "today" was that same blue on a chip mixed into literal white, ' +
        'so it stayed a white chip inside a dark modal. They now use `--blue-strong` with ' +
        '`--white-text`, and `--blue-text` over a tint mixed into the surface.',
    },
  },
  play: async ({ canvasElement }) => {
    // The trigger is react-datepicker's customInput, which is a BUTTON here -
    // there is no textbox to query.
    const trigger = canvasElement.querySelector('button');
    await userEvent.click(trigger as HTMLElement);
    // The popper portals out of the canvas, so assert against the document.
    await expect(document.querySelector('.yc-datepicker-calendar')).toBeInTheDocument();
  },
};
