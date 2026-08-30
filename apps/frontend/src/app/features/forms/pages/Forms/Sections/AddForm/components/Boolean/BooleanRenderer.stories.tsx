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
          '**The box holds its size against a long label.** `size-5` sits in a flex row where the ' +
          'label is the flexible sibling, so it needs `shrink-0` - without it the checkbox lost ' +
          'width to the text and rendered as an 8.9x20px sliver in a 260px column. The `Long ' +
          'label in a narrow column` story measures it.',
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

    /* The row is a flex line and the label is the flexible sibling, so without
       `shrink-0` the CHECKBOX gave up its width once the label stopped fitting:
       it measured 8.9px against its full 20px height in this 260px column, which
       is most of a phone form. It stays square now, and the text wraps. */
    await expect(Math.round(rect.height)).toBe(20);
    await expect(Math.round(rect.width)).toBe(20);

    // The text wraps instead of pushing the row wider than its column.
    const labelRect = canvas.getByText(LONG_LABEL).getBoundingClientRect();
    await expect(labelRect.height).toBeGreaterThan(40);
    const column = canvas.getByTestId('narrow-column');
    await expect(column.scrollWidth).toBeLessThanOrEqual(column.clientWidth);
  },
};
