import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import AppointmentScopeToggle from './AppointmentScopeToggle';

/**
 * The switch on the appointments toolbar that narrows the day from "everything
 * this clinic has booked" down to "the appointments assigned to me".
 */
const meta = {
  title: 'Primitives/AppointmentScopeToggle',
  component: AppointmentScopeToggle,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Switch-style scope filter for the appointments toolbar. Off shows the whole clinic, on narrows the list to the signed-in user. ' +
          'The 40x24 track is `--divider` when off and `--blue` when on; the 19px knob is `--screen` off / white on, with a `--sh22` drop shadow. ' +
          'The "Mine" label tracks the same state — `--ink-muted` off, `--ink-body` on.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showMineOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    showMineOnly: false,
    disabled: false,
    onChange: fn(),
  },
} satisfies Meta<typeof AppointmentScopeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default toolbar state: the whole clinic's day is in view. */
export const ShowingEveryone: Story = {};

/** Filtered to the signed-in user — blue track, knob right, label in `--ink-body`. */
export const ShowingMineOnly: Story = { args: { showMineOnly: true } };

/** While the appointment list is still loading the toggle is inert (70% opacity). */
export const Disabled: Story = { args: { disabled: true } };

const ControlledScopeToggle = (args: ComponentProps<typeof AppointmentScopeToggle>) => {
  const [showMineOnly, setShowMineOnly] = useState(false);
  return (
    <AppointmentScopeToggle {...args} showMineOnly={showMineOnly} onChange={setShowMineOnly} />
  );
};

/** Wired to local state so the 200ms knob transition can be seen. */
export const Interactive: Story = {
  render: (args) => <ControlledScopeToggle {...args} />,
};
