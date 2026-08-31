import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import { StructureLockContext } from '../structureLockContext';
import RichTextBuilder from './RichTextBuilder';

type RichTextField = FormField & { type: 'richtext' };

/** The prefill placeholder, copied from the component so a copy edit fails here first. */
const PREFILL_PLACEHOLDER = 'Default content shown when the form loads…';

/** An author-owned block in a Custom template: the label is theirs, the prefill starts empty. */
const AUTHORED_FIELD: RichTextField = {
  id: 'assessment',
  type: 'richtext',
  label: 'Assessment',
  defaultValue: '',
};

/** The shape a Discharge template carries once its section has been written. */
const PRELOADED_FIELD: RichTextField = {
  id: 'discharge_instructions',
  type: 'richtext',
  label: 'Discharge instructions',
  defaultValue:
    '<p>Rest for 48 hours, lead walks only.</p>' +
    '<ul><li>Metacam 1.5mg/ml, 0.5ml once daily</li><li>Check the wound twice a day</li></ul>',
};

/**
 * `defaultValue` is typed `any` on the app-side `FormField`, so a record written by an
 * older builder can hold something that is not a string - and this one also arrived
 * with no label. Both are guarded, and both guards are invisible until they are gone.
 */
const MALFORMED_FIELD: RichTextField = {
  id: 'legacy_notes',
  type: 'richtext',
  label: '',
  defaultValue: { html: '<p>stored as an object</p>' },
};

/**
 * `RichTextBuilder` is fully controlled - it renders `field` straight out of the prop and
 * hands the whole field back. Handed a frozen prop the Label input would refuse every
 * keystroke, so the harness holds the field and still forwards to `args.onChange`.
 */
const Harness = (args: ComponentProps<typeof RichTextBuilder>) => {
  const [field, setField] = useState<RichTextField>(args.field);
  return (
    <div className="w-full max-w-[470px]">
      <RichTextBuilder
        {...args}
        field={field}
        onChange={(next) => {
          setField(next as RichTextField);
          args.onChange(next);
        }}
      />
    </div>
  );
};

const meta = {
  title: 'Forms/RichTextBuilder',
  component: RichTextBuilder,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The settings block for a `richtext` field in the template builder. The author names the ' +
          'section and writes the content the workspace prefills with, which is how SOAP and ' +
          'Discharge templates ship formatted clinical text.\n\n' +
          '**`StructureLockContext` removes the Label input entirely.** On a YC-default template the ' +
          'name is part of the template contract, so the lock swaps the input for a plain paragraph ' +
          'while leaving the editor live. That split is the whole point of the lock and it fails in ' +
          'two opposite, equally silent ways: a lock that misses the label lets an author rename a ' +
          'canonical section, and a lock that reaches the editor as well turns a YC-default template ' +
          'into a read-only one nobody can prefill. The Locked story asserts both halves.\n\n' +
          '**The editor is named after the label**: its ariaLabel is the label plus "default ' +
          'content", so the announced name is the only thing distinguishing one editor from the ' +
          'next in a template with several rich-text sections. It is derived, never typed, so ' +
          'nothing on screen shows when it goes wrong.\n\n' +
          '**Opening the builder rewrites the field before the author touches it.** Tiptap emits ' +
          'its own normalised HTML once the editor mounts, so `onChange` fires immediately: an ' +
          'empty prefill becomes `<p></p>`, and stored list markup comes back with each `<li>` ' +
          'wrapped in a `<p>`. Every open therefore marks the template dirty and changes what would ' +
          'be saved. Both stories pin that, as behaviour rather than as intent.\n\n' +
          '**Two fallbacks cover badly shaped records.** An empty label prints "Rich text" rather ' +
          'than an empty heading, and a non-string `defaultValue` is coerced to an empty string ' +
          'rather than reaching Tiptap. See "Malformed field".\n\n' +
          'The stories below never type into the editor itself: Tiptap owns that surface and its own ' +
          'stories at `Primitives/RichTextEditor` cover typing, the toolbar and the focus ring.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: AUTHORED_FIELD,
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof RichTextBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unlocked: Story = {
  name: 'Unlocked: the label is editable',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    const labelInput = canvas.getByRole('textbox', { name: 'Label' });
    await expect(labelInput).toHaveValue('Assessment');

    /* `immediatelyRender: false`, so the editor arrives after mount - find it, do not
       assume it. Its accessible name is derived from the label; if that derivation
       broke, two rich-text sections would be indistinguishable to a screen reader and
       identical on screen. */
    const editor = await canvas.findByRole('textbox', { name: 'Assessment default content' });
    await expect(editor).toHaveAttribute('aria-readonly', 'false');

    // Empty prefill, so the author sees the placeholder rather than a blank slab.
    await expect(canvas.getByText(PREFILL_PLACEHOLDER)).toBeVisible();

    /* Nothing has been typed yet and the field has already been reported back once:
       Tiptap emits the normalised HTML of its empty document, so a prefill stored as
       '' returns as '<p></p>'. Opening the builder is enough to dirty the template.
       Pinned, not endorsed - if the editor stops emitting on mount this line is what
       says so. */
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: 'Assessment', defaultValue: '<p></p>' })
    );

    await userEvent.type(labelInput, ' notes');
    /* The whole field goes back, not a patch, and the typing lands on `label` only.
       `defaultValue` is the key the workspace prefills from, so a rename that dragged
       it along would quietly rewrite the prefilled text of a live template. */
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'assessment',
        type: 'richtext',
        label: 'Assessment notes',
        defaultValue: '<p></p>',
      })
    );
  },
};

export const Locked: Story = {
  name: 'Locked: the name is fixed, the content is not',
  decorators: [
    (Story) => (
      <StructureLockContext.Provider value={true}>
        <Story />
      </StructureLockContext.Provider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The name is printed, not offered. Renaming a canonical section would break the
    // template contract the backend snapshot is written against.
    await expect(canvas.getByText('Assessment').tagName).toBe('P');
    await expect(canvas.queryByRole('textbox', { name: 'Label' })).toBeNull();

    /* Exactly one textbox survives, and it is the editor - still contenteditable and
       still announcing itself as writable. The lock is about structure; if it ever
       reached content, a locked template would look identical and prefill nothing. */
    const boxes = await canvas.findAllByRole('textbox');
    await expect(boxes).toHaveLength(1);
    await expect(boxes[0]).toHaveAccessibleName('Assessment default content');
    await expect(boxes[0]).toHaveAttribute('contenteditable', 'true');
    await expect(boxes[0]).toHaveAttribute('aria-readonly', 'false');
  },
};

export const Preloaded: Story = {
  name: 'Preloaded default content',
  args: { field: PRELOADED_FIELD },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole('textbox', {
      name: 'Discharge instructions default content',
    });

    /* The stored HTML has to survive the round trip into Tiptap as structure, not as
       escaped text: this is the reason the field is rich text at all. Two list items,
       parsed, inside the editable surface. */
    await expect(within(editor).getAllByRole('listitem')).toHaveLength(2);
    await expect(editor).toHaveTextContent('Rest for 48 hours, lead walks only.');

    // Content present means the placeholder must be gone, not stacked underneath it.
    await expect(canvas.queryByText(PREFILL_PLACEHOLDER)).toBeNull();

    /* The round trip is not lossless. Merely opening this section emits the field
       back with Tiptap's normalisation applied - each `<li>` gains a wrapping `<p>` -
       so the stored HTML changes without an edit. Asserting the difference rather
       than the exact output: what matters is that a save now writes markup the
       author never typed. */
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ defaultValue: PRELOADED_FIELD.defaultValue })
    );
    // The words survive; only the markup around them was rewritten.
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        defaultValue: expect.stringContaining('Metacam 1.5mg/ml, 0.5ml once daily'),
      })
    );
  },
};

export const MalformedField: Story = {
  name: 'Malformed field: no label, non-string default',
  args: { field: MALFORMED_FIELD },
  decorators: [
    (Story) => (
      <StructureLockContext.Provider value={true}>
        <Story />
      </StructureLockContext.Provider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Locked, so the label is the heading - and an empty label must not render an
       unnamed block above the editor. The fallback is the only thing naming this row. */
    await expect(canvas.getByText('Rich text').tagName).toBe('P');

    const editor = await canvas.findByRole('textbox', { name: 'Rich text default content' });
    /* `typeof field.defaultValue === 'string'` is the guard. Without it an object
       reaches Tiptap and the author is handed "[object Object]" to edit and save. */
    await expect(editor.textContent).toBe('');
    await expect(canvas.getByText(PREFILL_PLACEHOLDER)).toBeVisible();
  },
};
