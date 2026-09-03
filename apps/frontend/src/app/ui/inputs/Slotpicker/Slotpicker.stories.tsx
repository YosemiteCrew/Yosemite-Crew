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

/* A slot's time is a UTC clock reading, "HH:MM" - what the API sends
   (`dayjs(startTime).format("HH:mm")`) and what the chip formatter parses. This
   fixture used to build full ISO timestamps, which that formatter rejects and
   returns unchanged, so every chip in this story read
   "2026-09-04T06:00:00.000Z" and the wrapping grid it is meant to demonstrate
   collapsed into one chip per row. */
const SLOTS: Slot[] = [
  { startTime: '08:00', endTime: '08:45', vetIds: ['v1'] },
  { startTime: '08:45', endTime: '09:30', vetIds: ['v1'] },
  { startTime: '09:30', endTime: '10:15', vetIds: ['v1'] },
  { startTime: '10:15', endTime: '11:00', vetIds: ['v1'] },
  { startTime: '11:00', endTime: '11:45', vetIds: ['v1'] },
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
          'labelled `fieldset`, and every day cell and time chip carries `aria-pressed` (plus ' +
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

    /* And the chip reads as a time. The formatter passes anything that is not
       "HH:MM" straight through, so a fixture in the wrong shape shows the raw
       string and nothing here noticed. */
    for (const chip of times.getAllByRole('button')) {
      await expect(chip.textContent).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    }
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
