import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PackageFormActions from './PackageFormActions';

/**
 * Both edges of the row are the thing under test, so they are read off the DOM
 * rather than off class names: `group` is the div holding Cancel + Save, `root`
 * is the justify-between row itself. Walking up from the Save button keeps this
 * independent of the preview decorator's own wrappers.
 */
const actionsRow = (canvasElement: HTMLElement) => {
  const save = within(canvasElement).getByRole('button', { name: 'Save Package' });
  const group = save.parentElement;
  const root = group?.parentElement;
  if (!(group instanceof HTMLElement) || !(root instanceof HTMLElement)) {
    throw new Error('the action row no longer nests Save inside a group inside a row');
  }
  return { group: group.getBoundingClientRect(), root: root.getBoundingClientRect() };
};

const meta = {
  title: 'Organization/PackageFormActions',
  component: PackageFormActions,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The footer of the package draft form. Its layout changes with `isEditing`, and the ' +
          'change is easy to get wrong in a way that still renders: the create branch emits an ' +
          'empty `<div />` where Delete would go, purely so `justify-between` still has two ' +
          'children. Drop the spacer and Cancel/Save silently slide to the left of the card.\n\n' +
          'Delete is a `Secondary danger` pinned hard left, as far from Save as the row allows, ' +
          'and it only opens the confirm modal - the destroy happens after that dialog, never ' +
          'from this row. Every button here is passed `href="#"`, which `BaseButton` treats as ' +
          '"not a link" and renders as a real `<button>`; that is why the play functions can ' +
          'query them by role.\n\n' +
          'Save is wrapped in `Promise.resolve(onSave()).catch()`, so a save that rejects is ' +
          'swallowed here rather than escaping as an unhandled rejection. There is a story for ' +
          'that, because nothing about the rendered row would tell you it had regressed.\n\n' +
          'Narrow enough and the row wraps - and the confirm pair then sits at the LEFT edge, ' +
          'because a wrapped line holds one item and `justify-between` has nothing to push it ' +
          'against. The phone story measures that rather than describing it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    isEditing: false,
    onCancel: fn(),
    onDeleteClick: fn(),
    onSave: fn(),
  },
} satisfies Meta<typeof PackageFormActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  name: 'New package',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // A package that does not exist yet cannot be deleted.
    await expect(canvas.queryByRole('button', { name: 'Delete Package' })).toBeNull();

    const { group, root } = actionsRow(canvasElement);
    /* The empty <div /> is load-bearing. With a single child, justify-between
       parks Cancel and Save on the LEFT of the card - which looks intentional
       enough that it would ship. Right edges flush, left edge well inside. */
    await expect(Math.round(root.right - group.right)).toBe(0);
    await expect(group.left).toBeGreaterThan(root.left);

    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};

export const Editing: Story = {
  name: 'Editing an existing package',
  args: { isEditing: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const deleteButton = canvas.getByRole('button', { name: 'Delete Package' });
    const { group, root } = actionsRow(canvasElement);

    /* Destructive action flush left, confirm pair flush right, the whole row's
       width between them. This is the separation the layout exists for - a
       Delete that drifts next to Save is a mis-click waiting to happen. */
    await expect(Math.round(deleteButton.getBoundingClientRect().left - root.left)).toBe(0);
    await expect(Math.round(root.right - group.right)).toBe(0);

    await userEvent.click(deleteButton);
    /* Delete only ASKS: the row raises onDeleteClick, the parent opens
       PackageDeleteModal. If this ever also fired a save, the package would be
       written and then destroyed. */
    await expect(args.onDeleteClick).toHaveBeenCalledTimes(1);
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(args.onCancel).not.toHaveBeenCalled();

    // Cancel and Delete are both Secondary pills; they must not share a handler.
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(args.onDeleteClick).toHaveBeenCalledTimes(1);

    await userEvent.click(canvas.getByRole('button', { name: 'Save Package' }));
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onDeleteClick).toHaveBeenCalledTimes(1);
  },
};

export const SaveRejects: Story = {
  name: 'A save that fails',
  args: {
    isEditing: true,
    onSave: fn(() => Promise.reject(new Error('save rejected'))),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole('button', { name: 'Save Package' });
    await userEvent.click(save);
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    /* The assertion that matters is not below - it is that this story finishes at
       all. `Promise.resolve(onSave()).catch(() => undefined)` is what keeps a
       rejected save from becoming an unhandled rejection in the console; hand the
       promise straight to onClick instead and this story starts logging one while
       the row still looks perfect. The row stays live afterwards, so a failed save
       can be retried. */
    await expect(save).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  },
};

export const Phone: Story = {
  name: 'Phone: the row wraps and un-aligns',
  args: { isEditing: true },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* The width is constrained here rather than left to the viewport global: the
     viewport is applied by the Storybook manager to the iframe, so a story opened
     directly - which is how these are verified, and how Chromatic renders a
     snapshot of the docs page - measures the full canvas and every geometry
     assertion below would be checked at the wrong width. 320px is about the card
     interior on a 375 phone, once the page and SectionContainer padding is off. */
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const deleteBox = canvas
      .getByRole('button', { name: 'Delete Package' })
      .getBoundingClientRect();
    const { group, root } = actionsRow(canvasElement);

    // 153 + 232 + a 12px gutter does not fit, so flex-wrap earns its keep.
    await expect(deleteBox.bottom).toBeLessThanOrEqual(group.top);
    /* And the confirm pair lands on the LEFT once it wraps, not under the right
       edge where it sits on desktop: justify-between has nothing to push against
       on a line holding a single item. Worth pinning because it is the opposite
       of what the desktop story asserts, and nobody would predict it from the
       classes - if it ever starts reading `right`, someone has changed the
       alignment and the desktop row moved with it. */
    await expect(Math.round(group.left - root.left)).toBe(0);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
