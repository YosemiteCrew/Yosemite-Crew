import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import TextRenderer from './TextRenderer';

type TextareaField = FormField & { type: 'textarea' };

/** `placeholder` is authored in the builder and, as the stories below show, never
    reaches the runtime control - FormDesc has no placeholder prop at all. */
const HISTORY: TextareaField = {
  id: 'history',
  type: 'textarea',
  label: 'History',
  placeholder: 'Free text, up to a paragraph',
  required: false,
};

/** An imported template field that arrived with no label of its own. */
const UNLABELLED: TextareaField = {
  id: 'note_body',
  type: 'textarea',
  label: '',
};

const LONG_ANSWER =
  'Reduced appetite since Friday, drinking normally. Vomited twice overnight, ' +
  'bile only, no blood. Bright and responsive on presentation, mucous membranes ' +
  'pink, CRT under two seconds. Abdomen soft and non-painful on palpation. ' +
  'Owner reports no access to bins, no known toxin exposure, and no change of ' +
  'diet in the last fortnight. Vaccinations and worming up to date.';

/**
 * `TextRenderer` owns no state - it is handed `value` and an `onChange`. Frozen,
 * it would refuse every keystroke, so the harness holds the answer and still
 * forwards to `args.onChange`, which lets a play function assert the emitted
 * value as well as the round trip back into the control.
 */
const Harness = (args: ComponentProps<typeof TextRenderer>) => {
  const [value, setValue] = useState(args.value);
  return (
    <div className="w-full max-w-[560px]">
      <TextRenderer
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
  title: 'Forms/TextRenderer',
  component: TextRenderer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The runtime textarea: what a pet parent types into, what the appointment workspace ' +
          'mounts for a template field, and what the preview drawer draws read-only.\n\n' +
          'It looks like a pass-through to `FormDesc` and is not quite one. It maps `field.id` ' +
          'onto the control `name` and `field.label` onto the label, and it pins the box to ' +
          '`min-h-[120px]! max-h-[140px]!`. **The 140px ceiling is unreachable.** A textarea with ' +
          '`height: auto` sizes from its `rows` attribute (2, unset here), not from its content, ' +
          'so the intrinsic height is about 69px, the 120px floor lifts it, and it stops there ' +
          'whatever you type. Every story below measures 120px, empty or overflowing. Long ' +
          'answers scroll inside the box rather than pushing the rest of the form down the page, ' +
          'which is the behaviour that matters and the one asserted.\n\n' +
          'Two things it does NOT do, both asserted below because both are invisible until ' +
          'someone relies on them. The authored `placeholder` is dropped - FormDesc accepts no ' +
          'placeholder prop, so an empty field shows an empty box and nothing else. And FormDesc ' +
          'hardcodes `required` on the textarea, so a field the schema marks optional is still a ' +
          'required control in the DOM.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: HISTORY,
    value: 'Reduced appetite for four days.',
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof TextRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'An answered field',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox', { name: 'History' });

    /* The mapping this component exists for. `inname` is the field ID, not the
       label: a control posting "History" as its name would look right on screen
       and key the answer under the wrong thing. */
    await expect(textarea).toHaveAttribute('name', 'history');
    await expect(textarea).toHaveValue('Reduced appetite for four days.');

    // The builder lets an author write a placeholder for this field; FormDesc has
    // no placeholder prop, so it never arrives. An empty answer shows a bare box.
    await expect(textarea).not.toHaveAttribute('placeholder');

    // It emits the string, not the change event. A renderer that forwarded `e`
    // would still "work" until the caller tried to store the value.
    await userEvent.type(textarea, ' Bright otherwise.');
    await expect(args.onChange).toHaveBeenLastCalledWith(
      'Reduced appetite for four days. Bright otherwise.'
    );
  },
};

export const Empty: Story = {
  name: 'Unanswered',
  args: { value: '' },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByRole('textbox', { name: 'History' });
    await expect(textarea).toHaveValue('');

    /* Same 120px box as the answered story, so the form does not reflow on the
       first keystroke. This is the floor from `min-h-[120px]!`, not the content. */
    await expect(Math.round(textarea.getBoundingClientRect().height)).toBe(120);

    /* The fixture sets `required: false` and the control is required anyway:
       FormDesc hardcodes the attribute. Every runtime textarea in a form blocks
       native submission while empty, whatever the schema says. */
    await expect(textarea).toBeRequired();
  },
};

export const LongAnswer: Story = {
  name: 'A long answer scrolls inside the box',
  args: { value: LONG_ANSWER },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByRole('textbox', {
      name: 'History',
    }) as HTMLTextAreaElement;

    /* Identical to the empty box. The declared range is 120-140 but a textarea
       sizes from `rows`, not from content, so it never leaves the floor - the
       140px ceiling is dead code. What is load-bearing is that the box is fixed:
       five lines of history do not push the rest of the form off the screen. */
    await expect(Math.round(textarea.getBoundingClientRect().height)).toBe(120);

    // ...and the overflow is reachable, rather than clipped away unread.
    await expect(textarea.scrollHeight).toBeGreaterThan(textarea.clientHeight);
  },
};

export const MissingLabel: Story = {
  name: 'A field with no label leaves the control unnamed',
  args: { field: UNLABELLED, value: '' },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByRole('textbox');

    /* `field.label || ''` is passed straight through, and FormDesc renders it in
       both places at once: an empty <label> and `aria-label=""`. An empty
       aria-label is ignored, the empty label element contributes nothing, so the
       control ends up with no accessible name and a screen reader announces a
       bare text area. FormRenderer covers for this by inventing a label from the
       field id before it gets here - mounted directly, nothing does. */
    await expect(textarea).toHaveAttribute('aria-label', '');
    const label = canvasElement.querySelector(`label[for="${CSS.escape(textarea.id)}"]`);
    await expect(label).not.toBeNull();
    await expect(label?.textContent).toBe('');

    // The id -> name mapping still happens, so the answer is at least stored right.
    await expect(textarea).toHaveAttribute('name', 'note_body');
  },
};

export const Phone: Story = {
  name: 'Phone: the box keeps its height',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { value: LONG_ANSWER },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByRole('textbox', { name: 'History' });

    /* The heights are absolute pixels, so a phone gets the same 120px box as a
       laptop - roughly four visible lines of a five-line answer. Worth drawing
       rather than assuming: this is the control a pet parent actually types into. */
    await expect(Math.round(textarea.getBoundingClientRect().height)).toBe(120);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};

export const ReadOnly: Story = {
  name: 'Read-only: the box refuses input',
  args: { value: LONG_ANSWER, readOnly: true },
  play: async ({ args, canvasElement }) => {
    const textarea = within(canvasElement).getByRole('textbox', { name: 'History' });

    /* `FormRenderer` passes `readOnly` to every runtime renderer, but the map
       casts each through `as any`, so a renderer that does not declare the prop
       drops it with no type error. This one did, and a read-only form - the
       preview drawer, or a submitted form opened for reading - kept a fully
       editable textarea whose typing still fired `onChange`. */
    await expect(textarea).toHaveAttribute('readonly');
    await userEvent.type(textarea, 'edited');
    await expect(args.onChange).not.toHaveBeenCalled();
    await expect((textarea as HTMLTextAreaElement).value).toBe(LONG_ANSWER);
  },
};
