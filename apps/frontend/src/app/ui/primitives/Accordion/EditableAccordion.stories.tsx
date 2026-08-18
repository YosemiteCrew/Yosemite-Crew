import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import EditableAccordion, { type FieldConfig } from './EditableAccordion';

const FIELDS: FieldConfig[] = [
  { label: 'Name', key: 'name', type: 'text', required: true },
  { label: 'Breed', key: 'breed', type: 'text' },
  { label: 'Weight (kg)', key: 'weight', type: 'number', numeric: true },
  { label: 'Neutered', key: 'neutered', type: 'checkbox' },
];

const DATA = {
  name: 'Poppy',
  breed: 'Beagle',
  weight: 12.4,
  neutered: true,
};

/** Enters edit mode, which is two interactions deep: the card must be open first. */
const startEditing = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Companion details' }));
  return canvas;
};

const meta = {
  title: 'Primitives/EditableAccordion',
  component: EditableAccordion,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A read-only field list that swaps, in place, into a live form. It had no story, and its ' +
          'edit mode is **two interactions deep** - the card has to be open before the pencil is ' +
          'reachable - so the entire editing DOM, a completely different tree from the resting ' +
          'view, had never been rendered in Storybook.\n\n' +
          'The part most worth drawing is the inline Save/Cancel row, because it is the exact ' +
          'shape of the layout bugs found on this branch: a `grid grid-cols-2` living inside a ' +
          '`flex flex-col` parent, mounted only after a click, alongside a sibling that appears ' +
          'only on failure. Nothing had ever composited those three together.\n\n' +
          'Three states here exist only as a consequence of a promise, not of a prop: the button ' +
          'reads "Saving..." while `onSave` is pending, the error line appears only if it rejects, ' +
          'and the row returns to rest if it resolves. The stories drive each by handing `onSave` a ' +
          'promise that pends or rejects, which is the only way to reach them.\n\n' +
          'Field types are kept to text, number and checkbox on purpose. `select` and `dropdown` ' +
          'render `LabelDropdown`, which portals a listbox of its own - a second gated surface that ' +
          'wants its own stories rather than being smuggled in here - and `googleAddress` would ' +
          'reach for the Places API.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Companion details',
    fields: FIELDS,
    data: DATA,
    defaultOpen: true,
    onSave: fn(),
  },
} satisfies Meta<typeof EditableAccordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadView: Story = {
  name: 'Read view',
  parameters: {
    docs: { description: { story: 'The resting state: label/value rows and a pencil.' } },
  },
};

export const Editing: Story = {
  name: 'Edit mode',
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement);
    // Assert the form actually replaced the read rows, not just that a flag flipped.
    const save = await canvas.findByRole('button', { name: 'Save' });
    await expect(save).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(canvas.getByDisplayValue('Poppy')).toBeInTheDocument();

    /* The action row is the reason this story exists: a `grid grid-cols-2` that only
       mounts after a click. Assert the computed template really resolves to two
       tracks holding both buttons - a dropped or malformed template collapses them
       into one column and still looks deliberate. */
    const actions = save.parentElement as HTMLElement;
    await expect(getComputedStyle(actions).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(actions.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every row becomes an editor, and the Cancel/Save pair sits below in its two-column grid. ' +
          'This is the tree that had never been drawn.',
      },
    },
  },
};

export const CompactActions: Story = {
  name: 'Edit mode (compact actions)',
  args: { compactInlineActions: true },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement);
    expect(await canvas.findByRole('button', { name: 'Save' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same two buttons under the other branch: centred and content-width rather than a ' +
          'full-width two-column grid. Worth seeing beside the default, since the two layouts share ' +
          'no classes at all.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Saving (pending)',
  args: {
    // Never resolves, so the pending state stays on screen for review.
    onSave: () => new Promise<void>(() => {}),
  },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));
    expect(await canvas.findByRole('button', { name: 'Saving...' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both buttons disable and Save relabels while the promise is in flight. Reachable only by ' +
          'holding a promise open - there is no prop for it.',
      },
    },
  },
};

export const SaveFailed: Story = {
  name: 'Save failed',
  args: {
    onSave: () => Promise.reject(new Error('downstream unavailable')),
  },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));
    await expect(
      await canvas.findByText('Failed to save changes. Please try again.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The failure line appears above the buttons, inside the same flex column, and pushes the ' +
          'grid down. It exists only after a rejected promise, so it had never been composited with ' +
          'the action row before.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (no pencil)',
  args: { readOnly: true },
  parameters: {
    docs: {
      description: {
        story:
          'With `readOnly` the pencil is not rendered at all rather than disabled, so there is no ' +
          'affordance suggesting an edit that cannot happen.',
      },
    },
  },
};
