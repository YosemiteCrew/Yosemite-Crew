import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import BooleanRenderer from './BooleanRenderer';

type RendererProps = ComponentProps<typeof BooleanRenderer>;

const FASTED_LABEL = 'Fasted before the visit';

/**
 * Controlled wrapper. `BooleanRenderer` owns nothing - it is handed `value` and
 * an `onChange`, so a frozen `value` would render a checkbox that snaps back on
 * every click and hide exactly the wiring these stories exist to check. The
 * harness holds the answer and still forwards to `args.onChange`.
 */
const Harness = (args: RendererProps) => {
  const [value, setValue] = useState<boolean>(args.value);
  return (
    <div data-testid="renderer-host">
      <BooleanRenderer
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    </div>
  );
};

const meta = {
  title: 'Forms/BooleanRenderer',
  component: BooleanRenderer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The runtime yes/no control - the `boolean` entry in `runtimeComponentMap`, drawn ' +
          'wherever a saved form is filled in or previewed.\n\n' +
          '**It wires its own label rather than delegating to a design-system input.** The ' +
          'checkbox takes `id={field.id}` and the text is a real `<label htmlFor>`, which is what ' +
          'makes the words themselves a hit target - the difference between a 20px box and a ' +
          'full-width row to tap on a phone. It also sets `aria-label={field.label}`, so the ' +
          'announced name and the printed name come from the same string and cannot drift.\n\n' +
          '**`readOnly` maps to `disabled`.** Unlike `TextRenderer`, which ignores the flag and ' +
          'stays editable in the preview drawer, this control genuinely refuses input - through ' +
          'the label as well as the box.\n\n' +
          '**The box is squashed by a long label.** `size-5` sits in a flex row with no ' +
          '`shrink-0`, so in a narrow column the checkbox loses width to the text and renders ' +
          'as a ~9x20px sliver rather than a 20px square. The `Long label in a narrow column` ' +
          'story pins that measurement rather than asserting the square it should be.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: { id: 'fasted_before_visit', type: 'boolean', label: FASTED_LABEL },
    value: false,
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof BooleanRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  name: 'Unchecked, answered by the label',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('checkbox', { name: FASTED_LABEL });
    await expect(box).not.toBeChecked();

    /* Click the words, not the box. This is the htmlFor/id pairing: if `field.id`
       ever went missing or stopped matching, the checkbox would still look and
       work fine under a direct click and only the label would go dead. */
    await userEvent.click(canvas.getByText(FASTED_LABEL));
    await expect(args.onChange).toHaveBeenCalledWith(true);
    await expect(box).toBeChecked();
  },
};

export const Checked: Story = {
  name: 'Checked',
  args: { value: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('checkbox', { name: FASTED_LABEL });
    await expect(box).toBeChecked();
    /* The announced name is the printed name. Both come from `field.label`, and
       a divergence would be invisible on screen and wrong in a screen reader. */
    await expect(box).toHaveAccessibleName(canvas.getByText(FASTED_LABEL).textContent ?? '');
  },
};

export const ReadOnlyPreview: Story = {
  name: 'Read-only preview',
  args: { value: true, readOnly: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('checkbox', { name: FASTED_LABEL });
    await expect(box).toBeDisabled();

    // The label is the second way in, so it has to be dead too, not just the box.
    await userEvent.click(canvas.getByText(FASTED_LABEL));
    await expect(args.onChange).not.toHaveBeenCalled();
    await expect(box).toBeChecked();
  },
};

const LONG_LABEL =
  'Fasted for at least twelve hours before the anaesthetic and has had no water since midnight';

export const LongLabel: Story = {
  name: 'Long label in a narrow column',
  args: {
    field: { id: 'fasted_long', type: 'boolean', label: LONG_LABEL },
  },
  decorators: [
    (Story) => (
      <div data-testid="narrow-column" style={{ width: 260 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('checkbox', { name: LONG_LABEL });
    const rect = box.getBoundingClientRect();

    /* Pinning current, wrong behaviour. The row is a plain flex line and the box
       carries no `shrink-0`, so once the label's longest word stops fitting, the
       checkbox - not the text - gives up its width: it measures ~9px wide against
       its full 20px height and stops being square. Height is the half that still
       holds. If someone adds `shrink-0` (they should), this flips to
       width === height === 20 and the story is the thing that tells them. */
    await expect(Math.round(rect.height)).toBe(20);
    await expect(rect.width).toBeLessThan(rect.height);

    // The text wraps instead of pushing the row wider than its column.
    const labelRect = canvas.getByText(LONG_LABEL).getBoundingClientRect();
    await expect(labelRect.height).toBeGreaterThan(40);
    const column = canvas.getByTestId('narrow-column');
    await expect(column.scrollWidth).toBeLessThanOrEqual(column.clientWidth);
  },
};
