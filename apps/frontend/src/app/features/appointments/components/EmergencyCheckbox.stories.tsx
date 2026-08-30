import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import EmergencyCheckbox from './EmergencyCheckbox';

const ARIA_NAME = 'Confirm this is an emergency';
const VISIBLE_TEXT = 'I confirm this is an emergency.';

/**
 * The booking form owns the value, so a story that only passed `checked` would
 * render a box that never moves under the pointer. This wrapper holds the state
 * the form would hold and forwards every call to the story's spy, which is the
 * only way to prove the caller's `!checked` round trip actually lands.
 *
 * Hoisted out of `render` on purpose: a `useState` inside `render: (args) => ...`
 * is a hook in a plain function and fails `react-hooks/rules-of-hooks`.
 */
const ControlledEmergencyCheckbox = (props: React.ComponentProps<typeof EmergencyCheckbox>) => {
  const [checked, setChecked] = useState(props.checked);
  return (
    <EmergencyCheckbox
      checked={checked}
      onChange={(next) => {
        setChecked(next);
        props.onChange(next);
      }}
    />
  );
};

const meta = {
  title: 'Appointments/EmergencyCheckbox',
  component: EmergencyCheckbox,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The emergency confirmation on the booking form. It is fully controlled - it holds no ' +
          'state of its own and reports the value it is moving TO (`onChange(!checked)`), so the ' +
          'form never has to invert anything.\n\n' +
          'Its accessibility is split across two attributes and they do not say the same thing. ' +
          'The input carries `aria-label="' +
          ARIA_NAME +
          '"`, which wins the accessible name outright, while the sentence beside it reads "' +
          VISIBLE_TEXT +
          '" and is bound only by `htmlFor` against a `useId` value. Two things can therefore ' +
          'break in silence: a screen reader user and a sighted user can be told different ' +
          'things, and if the generated id ever stops reaching the label the sentence becomes ' +
          'dead text that no longer toggles the box. The stories below pin both.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    checked: false,
    onChange: fn(),
  },
} satisfies Meta<typeof EmergencyCheckbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  name: 'Unchecked',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    /* Queried by ROLE and name rather than by the sentence: this is the assertion
       that would catch the `aria-label` being dropped or reworded, which no
       visual review and no snapshot would ever show. */
    const input = canvas.getByRole('checkbox', { name: ARIA_NAME });
    await expect(input).not.toBeChecked();

    await userEvent.click(input);
    // The value it is moving TO, not the value it had.
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    await expect(args.onChange).toHaveBeenCalledWith(true);
  },
};

export const Checked: Story = {
  name: 'Checked',
  args: { checked: true },
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole('checkbox', { name: ARIA_NAME });
    await expect(input).toBeChecked();

    await userEvent.click(input);
    /* Uncheck reports `false`. The handler is `onChange(!checked)` rather than
       `onChange(event.target.checked)`, so a stale `checked` prop would send the
       WRONG value rather than no value - a failure that still looks like a
       working checkbox on screen. */
    await expect(args.onChange).toHaveBeenCalledWith(false);
  },
};

export const LabelActivatesTheBox: Story = {
  name: 'The sentence is the hit target too',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('checkbox', { name: ARIA_NAME });
    const label = canvas.getByText(VISIBLE_TEXT);

    /* `useId` produces something like ":r3:" - never assert the value, only that
       the pairing survives. A label whose `for` misses is invisible damage: the
       sentence still renders, still shows the pointer cursor from
       `cursor-pointer`, and simply stops working. */
    await expect(input.id).not.toBe('');
    await expect(label).toHaveAttribute('for', input.id);

    await userEvent.click(label);
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    await expect(args.onChange).toHaveBeenCalledWith(true);
  },
};

export const Controlled: Story = {
  name: 'Round trip through the form',
  render: (args) => <ControlledEmergencyCheckbox {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole('checkbox', { name: ARIA_NAME });

    await userEvent.click(input);
    await expect(input).toBeChecked();
    await userEvent.click(input);
    /* Back to where it started. With a parent that stores what it is told, the
       two calls must be `true` then `false`; a component that reported
       `event.target.checked` off a stale render would send `true` twice and the
       box would jam on. */
    await expect(input).not.toBeChecked();
    await expect(args.onChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onChange).toHaveBeenNthCalledWith(2, false);
  },
};
