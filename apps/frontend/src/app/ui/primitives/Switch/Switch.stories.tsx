import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useState } from 'react';

import Switch from './Switch';

const meta = {
  title: 'Primitives/Switch',
  component: Switch,
  parameters: {
    docs: {
      description: {
        component:
          'The product’s one switch. Eight hand-rolled copies shipped at six different sizes — ' +
          '56x32 in the Add-inventory drawer, 48x24 in the Rooms table, 44x24 in booking setup, ' +
          '40x24 in Settings, 36x22 in the chat info panel and 44x26 in developer settings — so ' +
          'toggling two settings in one session meant operating what looked like two different ' +
          'widgets. The geometry here is the design system’s `.switch`: a 40x24 track with an ' +
          '18px knob inset 3px, giving 19px of travel.',
      },
    },
  },
  args: { label: 'Visible in inventory', onChange: fn() },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
  args: { checked: false },
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole('switch');

    /* Measured, not matched on a class name: a restyle that keeps 40x24 passes
       and one that drifts back to 56x32 or 36x22 fails. These are the numbers
       the design system fixes. */
    const box = control.getBoundingClientRect();
    await expect(box.width).toBeCloseTo(40, 0);
    await expect(box.height).toBeCloseTo(24, 0);

    const knob = control.firstElementChild as HTMLElement;
    const knobBox = knob.getBoundingClientRect();
    await expect(knobBox.width).toBeCloseTo(18, 0);
    // 3px in from the left edge of the track when off.
    await expect(knobBox.left - box.left).toBeCloseTo(3, 0);

    await expect(control).toHaveAttribute('aria-checked', 'false');
  },
};

export const On: Story = {
  args: { checked: true },
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole('switch');
    const box = control.getBoundingClientRect();
    const knobBox = (control.firstElementChild as HTMLElement).getBoundingClientRect();

    // 19px of travel: 40 - 18 - 3. The knob must clear the right edge by 3px too.
    await expect(knobBox.left - box.left).toBeCloseTo(19, 0);
    await expect(box.right - knobBox.right).toBeCloseTo(3, 0);
    await expect(control).toHaveAttribute('aria-checked', 'true');
  },
};

export const Disabled: Story = {
  args: { checked: true, disabled: true },
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole('switch');
    await expect(control).toBeDisabled();
  },
};

const Controlled = () => {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <Switch checked={on} onChange={setOn} label="Cross-clinic messaging" />
      <span className="text-[13px] text-[var(--ink-muted)]">{on ? 'On' : 'Off'}</span>
    </div>
  );
};

export const Toggling: Story = {
  args: { checked: false },
  render: () => <Controlled />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole('switch');

    await expect(canvas.getByText('Off')).toBeInTheDocument();
    await userEvent.click(control);
    // The state is announced, not only filled in blue: a switch that changes
    // colour and nothing else tells a screen reader nothing.
    await expect(control).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByText('On')).toBeInTheDocument();
  },
};
