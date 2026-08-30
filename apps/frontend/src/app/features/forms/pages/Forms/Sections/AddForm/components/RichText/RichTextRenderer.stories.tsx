import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import RichTextRenderer from './RichTextRenderer';

type RichTextField = FormField & { type: 'richtext' };

const NOTES_FIELD: RichTextField = {
  id: 'discharge_notes',
  type: 'richtext',
  label: 'Discharge notes',
  placeholder: 'Home care, medication and follow-up',
};

/** Inventory-generated and template-generated rows do not always carry a label. */
const UNLABELLED_FIELD: RichTextField = {
  id: 'free_notes',
  type: 'richtext',
  label: '',
  placeholder: 'Home care, medication and follow-up',
};

const SAVED_NOTE =
  '<p>Rest for 48 hours, lead walks only.</p>' +
  '<ul><li>Metacam 1.5mg/ml, 0.5ml once daily</li><li>Check the wound twice a day</li></ul>' +
  '<ol><li>Recheck in 10 days</li></ol>';

/**
 * What a stored value can look like if anything upstream of the editor ever wrote to it -
 * a pasted email body, a migrated record, a crafted API payload. `sanitizeRichText` is the
 * only thing standing between it and `dangerouslySetInnerHTML`.
 */
const HOSTILE_NOTE =
  '<p onclick="steal()">Give <a href="https://phish.example.test">Metacam</a> twice daily</p>' +
  '<script>alert(1)</script>' +
  '<img src="x" onerror="alert(2)">';

/**
 * Controlled wrapper. The renderer owns nothing - a frozen `value` would leave the editor
 * fighting the parent on every keystroke. The harness holds the answer and still forwards
 * to `args.onChange`, and its host div gives the play functions a handle on the component's
 * own subtree (the read-only branch renders raw HTML with no test hook of its own).
 */
const Harness = (args: ComponentProps<typeof RichTextRenderer>) => {
  const [value, setValue] = useState<string>(args.value);
  return (
    <div data-testid="renderer-host" style={{ maxWidth: 520 }}>
      <RichTextRenderer
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

/** The component's own flex column: `[label?, body]`. Its child count IS the label branch. */
const columnOf = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByTestId('renderer-host').firstElementChild as HTMLElement;

const meta = {
  title: 'Forms/RichTextRenderer',
  component: RichTextRenderer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The runtime rich-text field - the `richtext` entry in `runtimeComponentMap`, drawn ' +
          'wherever a saved form is filled in or read back.\n\n' +
          '**`readOnly` is not a mode, it is a different component.** The editable branch mounts ' +
          'Tiptap; the read-only branch mounts no editor at all and pipes the value straight into ' +
          '`dangerouslySetInnerHTML`. Nothing about them looks related in the props table, and the ' +
          'read-only branch is the one with the sharp edge, so the stories check the two things ' +
          'that branch depends on: that no textbox survives it, and that the sanitizer runs.\n\n' +
          '**The sanitizer is the whole security boundary.** `sanitizeRichText` allows only ' +
          '`p/br/strong/b/em/i/u/s/ul/ol/li` and the `class` attribute; scripts, images, links and ' +
          'inline handlers are dropped. The "Unsafe markup" story feeds it a hostile value and ' +
          'asserts what survives, because the copy renders identically either way.\n\n' +
          '**The read-only list styling lives on the parent.** Sanitized HTML carries no classes, ' +
          'so `[&_ul]:list-disc [&_ol]:list-decimal` plus `pl-6` on the wrapper is the only thing ' +
          'making a stored list read as a list. If those arbitrary variants stop compiling the ' +
          'markers silently vanish and a discharge list becomes unpunctuated prose, so the story ' +
          'measures computed style rather than trusting the class names.\n\n' +
          '**The editable branch reports back on mount**, before anyone types - Tiptap emits its ' +
          'normalised HTML as soon as it initialises, so simply opening a form dirties the answer. ' +
          'The read-only branch cannot, which is asserted as the pair.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: NOTES_FIELD,
    value: '',
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof RichTextRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  name: 'Editable and empty',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const column = columnOf(canvasElement);

    /* The heading is a plain span, not a <label>, and the editor is a contenteditable
       div - so the two are only connected by `ariaLabel={field.label}`. Query by that
       name: if that wiring broke, the field would still look labelled on screen and
       announce itself as unnamed, so the printed heading below proves nothing on its
       own - the accessible name is the assertion. */
    const editor = await canvas.findByRole('textbox', { name: 'Discharge notes' });
    await expect(editor).toHaveAttribute('aria-readonly', 'false');
    await expect(editor).toHaveAttribute('contenteditable', 'true');

    await expect(column.children).toHaveLength(2);
    await expect(column.firstElementChild).toHaveTextContent('Discharge notes');

    // Empty value, so `field.placeholder` is what the user reads.
    await expect(canvas.getByText('Home care, medication and follow-up')).toBeVisible();

    /* Nobody has typed. Tiptap still emitted its normalised empty document, so the
       answer is already reported as '<p></p>' rather than ''. Anything upstream
       tracking dirtiness sees an edit the moment the form opens. Pinned, not
       endorsed - if the editor stops emitting on mount this is the line that says so. */
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    await expect(args.onChange).toHaveBeenLastCalledWith('<p></p>');
  },
};

export const EditableWithoutALabel: Story = {
  name: 'Editable with content, no label',
  args: {
    field: UNLABELLED_FIELD,
    value: '<p>Rest for 48 hours, lead walks only.</p>',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // No label means no heading at all - one child, not an empty span holding a gap open.
    await expect(columnOf(canvasElement).children).toHaveLength(1);

    /* The editor still has to be named. `field.label || 'Rich text'` is the fallback,
       and it is the only name a screen reader gets for this field. */
    const editor = await canvas.findByRole('textbox', { name: 'Rich text' });
    await expect(editor).toHaveTextContent('Rest for 48 hours, lead walks only.');

    // Content present, so the placeholder must be gone rather than sitting under the text.
    await expect(canvas.queryByText('Home care, medication and follow-up')).toBeNull();
  },
};

export const ReadOnlyNote: Story = {
  name: 'Read-only saved note',
  args: { value: SAVED_NOTE, readOnly: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const column = columnOf(canvasElement);
    const note = column.lastElementChild as HTMLElement;

    /* The branch swaps the editor out entirely. If it ever "unified" into a disabled
       editor instead, a saved note would become focusable and land in the tab order
       of every read-back view - and look identical. */
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expect(args.onChange).not.toHaveBeenCalled();

    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);

    /* Sanitized HTML carries no classes of its own, so these arbitrary variants on the
       wrapper are the only thing drawing the markers and the indent. Measured, because
       a variant that stops compiling leaves the classes in the DOM and the list looking
       like three unrelated lines. */
    const ul = note.querySelector('ul') as HTMLElement;
    const ol = note.querySelector('ol') as HTMLElement;
    const ulStyle = globalThis.getComputedStyle(ul);
    await expect(ulStyle.listStyleType).toBe('disc');
    await expect(ulStyle.paddingLeft).toBe('24px');
    await expect(globalThis.getComputedStyle(ol).listStyleType).toBe('decimal');

    // `min-h-22`: an empty saved note still reserves its block instead of collapsing.
    await expect(globalThis.getComputedStyle(note).minHeight).toBe('88px');
  },
};

export const ReadOnlyUnsafeMarkup: Story = {
  name: 'Read-only: unsafe markup stripped',
  args: { value: HOSTILE_NOTE, readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const note = columnOf(canvasElement).lastElementChild as HTMLElement;

    /* Everything outside the allow-list goes, including the tags that carry the
       payload. `dangerouslySetInnerHTML` does not execute an injected <script>, but an
       <img onerror> fires on load - so its absence is the assertion that matters. */
    await expect(note.querySelector('script')).toBeNull();
    await expect(note.querySelector('img')).toBeNull();
    await expect(canvas.queryByRole('link')).toBeNull();
    await expect(note.textContent).not.toContain('alert(1)');

    /* The clinical copy survives whole: the anchor is unwrapped rather than deleted
       with its text. A sanitizer that dropped children too would silently swallow
       words out of a saved note, which is worse than the markup it was removing. */
    await expect(note).toHaveTextContent('Give Metacam twice daily');

    // Allowed tag, disallowed attribute: the paragraph stays, the handler does not.
    const paragraph = note.querySelector('p') as HTMLElement;
    await expect(paragraph.hasAttribute('onclick')).toBe(false);
  },
};
