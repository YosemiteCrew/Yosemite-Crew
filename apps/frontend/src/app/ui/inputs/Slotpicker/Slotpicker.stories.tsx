import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import Slotpicker from './index';
import type { Slot } from '@/app/features/appointments/types/appointments';

const StatefulSlotpicker = (args: ComponentProps<typeof Slotpicker>) => {
  const [date, setDate] = useState<Date>(args.selectedDate);
  const [slot, setSlot] = useState<Slot | null>(args.selectedSlot);
  return (
    <Slotpicker
      {...args}
      selectedDate={date}
      setSelectedDate={setDate}
      selectedSlot={slot}
      setSelectedSlot={setSlot}
    />
  );
};

const today = new Date();
const at = (h: number, m: number) => {
  const d = new Date(today);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const SLOTS: Slot[] = [
  { startTime: at(8, 0), endTime: at(8, 45), vetIds: ['v1'] },
  { startTime: at(8, 45), endTime: at(9, 30), vetIds: ['v1'] },
  { startTime: at(9, 30), endTime: at(10, 15), vetIds: ['v1'] },
  { startTime: at(10, 15), endTime: at(11, 0), vetIds: ['v1'] },
  { startTime: at(11, 0), endTime: at(11, 45), vetIds: ['v1'] },
];

const meta = {
  title: 'Inputs/Slotpicker',
  component: Slotpicker,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Month navigation + horizontal date strip + a wrapping grid of bookable time slots. ' +
          'A chosen slot fills solid blue (white text, glow shadow) to match the design booking sheet.\n\n' +
          'The fill is the *second* cue, not the only one: the day strip and the slot list are each a ' +
          'named `role="group"`, and every day cell and time chip carries `aria-pressed` (plus ' +
          '`aria-current="date"` on today), the same way `PhoneDayStrip` announces its week.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    selectedDate: today,
    setSelectedDate: () => {},
    selectedSlot: null,
    setSelectedSlot: () => {},
    timeSlots: SLOTS,
  },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
  render: (args) => <StatefulSlotpicker {...args} />,
} satisfies Meta<typeof Slotpicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelectedSlot: Story = {
  args: { selectedSlot: SLOTS[2] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Read out of the named groups rather than off the canvas: the chosen slot
       used to be blue fill and nothing else, so exactly one chip in the time
       group must report itself pressed - and the day cells are a separate
       group, which is what stops a bare aria-pressed count from passing here. */
    const times = within(canvas.getByRole('group', { name: 'Select a time' }));
    const pressed = times.getAllByRole('button', { pressed: true });
    await expect(pressed).toHaveLength(1);

    const days = within(canvas.getByRole('group', { name: 'Select a day' }));
    await expect(days.getAllByRole('button', { pressed: true })).toHaveLength(1);
  },
  parameters: {
    docs: {
      story:
        'The chosen slot renders as a solid-blue filled chip, and reports itself pressed so the ' +
        'choice survives a screen reader as well as a glance.',
    },
  },
};

export const NoSlots: Story = {
  args: { timeSlots: [] },
};
