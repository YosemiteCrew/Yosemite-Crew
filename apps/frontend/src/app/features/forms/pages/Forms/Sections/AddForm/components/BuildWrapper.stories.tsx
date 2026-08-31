import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import BuilderWrapper from './BuildWrapper';
import { StructureLockContext } from './structureLockContext';

const INPUT_FIELD: FormField = {
  id: 'presenting_complaint',
  type: 'input',
  label: 'Presenting complaint',
  placeholder: 'Limping on the left hind',
};

const MEDICATION_GROUP: FormField = {
  id: 'medications',
  type: 'group',
  label: 'Medications',
  fields: [],
};

/** Stand-in for the builder body (`builderComponentMap[field.type]`) that Build passes as children. */
const Body = ({ label }: { label: string }) => (
  <div
    data-testid="builder-body"
    style={{ fontSize: 13, color: 'var(--color-muted-999)', lineHeight: '20px' }}
  >
    {label}
  </div>
);

/** The wrapper's own `<section>`. It carries the aria-label, the drag props and the padding. */
const sectionFor = (canvasElement: HTMLElement, name: string): HTMLElement =>
  within(canvasElement).getByRole('region', { name });

const meta = {
  title: 'Forms/BuilderWrapper',
  component: BuilderWrapper,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The chrome around every row in the template builder: a drag handle, a heading, and the ' +
          'move/delete controls. Which controls exist is decided by three inputs that do not look ' +
          'related in the props table - `StructureLockContext`, `contentDeletable`, and whether ' +
          '`onMoveUp`/`onMoveDown` were passed at all - so the stories below pin each combination.\n\n' +
          'Two things a reviewer should know.\n\n' +
          '*The lock also disarms dragging.* `canDrag = draggable && !structureLocked`, so a locked ' +
          'row silently drops the `draggable` attribute even though the caller still passes ' +
          '`draggable`. Nothing about the row looks different apart from the dimmed handle, which ' +
          'is why "Locked structure" asserts the attribute rather than the appearance.\n\n' +
          '*The heading is the field TYPE, not its label.* `title` is built from `field.type`, so a ' +
          'group called "Medications" and a group called "Tasks" both read "Group" - and every ' +
          'aria-label built from it ("Delete Group") is equally non-specific. In a template with ' +
          'several groups the delete buttons are indistinguishable to a screen reader.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: INPUT_FIELD,
    onDelete: fn(),
    onMoveUp: fn(),
    onMoveDown: fn(),
    canMoveUp: true,
    canMoveDown: true,
    draggable: true,
    onDragStart: fn(),
    children: <Body label="Short answer · required" />,
  },
} satisfies Meta<typeof BuilderWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unlocked: Story = {
  name: 'Unlocked, all controls',
  play: async ({ canvasElement }) => {
    const section = sectionFor(canvasElement, 'Input field');
    const canvas = within(section);

    /* Exactly three controls, and each is named after the field. The three icons are
       otherwise interchangeable to anything that cannot see them. */
    await expect(canvas.getAllByRole('button')).toHaveLength(3);
    await expect(canvas.getByRole('button', { name: 'Move Input up' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Move Input down' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Delete Input' })).toBeEnabled();

    // Dragging is armed on the section itself, not on the handle.
    await expect(section).toHaveAttribute('draggable', 'true');
    const handle = section.querySelector('[data-drag-handle]') as SVGElement;
    await expect(globalThis.getComputedStyle(handle).opacity).toBe('1');
  },
};

export const TopOfList: Story = {
  name: 'First row: move up is disabled',
  args: { canMoveUp: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(sectionFor(canvasElement, 'Input field'));
    const up = canvas.getByRole('button', { name: 'Move Input up' });

    /* Disabled rather than removed - the row keeps the same control count at every
       position, so the buttons do not shift under the pointer as a field moves. */
    await expect(up).toBeDisabled();
    await userEvent.click(up, { pointerEventsCheck: 0 });
    await expect(args.onMoveUp).not.toHaveBeenCalled();

    /* The neighbour still works, and it calls the OTHER handler: the two arrows sit
       2px apart and swapping them would look identical in a screenshot. */
    await userEvent.click(canvas.getByRole('button', { name: 'Move Input down' }));
    await expect(args.onMoveDown).toHaveBeenCalledTimes(1);
    await expect(args.onMoveUp).not.toHaveBeenCalled();
  },
};

export const BottomOfList: Story = {
  name: 'Last row: move down is disabled',
  args: { canMoveDown: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(sectionFor(canvasElement, 'Input field'));
    const down = canvas.getByRole('button', { name: 'Move Input down' });

    await expect(down).toBeDisabled();
    await userEvent.click(down, { pointerEventsCheck: 0 });
    await expect(args.onMoveDown).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: 'Move Input up' }));
    await expect(args.onMoveUp).toHaveBeenCalledTimes(1);
    await expect(args.onMoveDown).not.toHaveBeenCalled();
  },
};

export const LockedStructure: Story = {
  name: 'Locked structure: no controls at all',
  decorators: [
    (Story) => (
      <StructureLockContext.Provider value={true}>
        <Story />
      </StructureLockContext.Provider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const section = sectionFor(canvasElement, 'Input field');

    // Nothing structural survives the lock, including delete.
    await expect(within(section).queryAllByRole('button')).toHaveLength(0);

    /* The caller still passes `draggable` and `onDragStart`; the wrapper drops both.
       If that guard regressed the row would still LOOK locked while reordering by
       drag kept working, which is the failure this story exists for. */
    await expect(section).not.toHaveAttribute('draggable');

    // The handle stays in the layout, dimmed, so rows do not reflow when a template locks.
    const handle = section.querySelector('[data-drag-handle]') as SVGElement;
    await expect(handle).toBeInTheDocument();
    await expect(globalThis.getComputedStyle(handle).opacity).toBe('0.5');

    // Content is untouched by the lock - only the controls go.
    await expect(within(section).getByTestId('builder-body')).toBeInTheDocument();
  },
};

export const LockedContentDeletable: Story = {
  name: 'Locked structure, deletable content',
  args: {
    field: MEDICATION_GROUP,
    compact: true,
    contentDeletable: true,
    children: <Body label="Amoxicillin 250mg · twice daily" />,
  },
  decorators: [
    (Story) => (
      <StructureLockContext.Provider value={true}>
        <Story />
      </StructureLockContext.Provider>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    const canvas = within(sectionFor(canvasElement, 'Group field'));

    /* A medication the author added to a YC-default template is content, not structure,
       so it can be removed - but it still must not be reordered. Exactly one button. */
    const buttons = canvas.getAllByRole('button');
    await expect(buttons).toHaveLength(1);
    await expect(buttons[0]).toHaveAccessibleName('Delete Group');
    await expect(canvas.queryByRole('button', { name: /move/i })).not.toBeInTheDocument();

    await userEvent.click(buttons[0]);
    await expect(args.onDelete).toHaveBeenCalledTimes(1);
  },
};

export const NotDraggable: Story = {
  name: 'Not draggable, still reorderable',
  args: { draggable: false },
  play: async ({ args, canvasElement }) => {
    const section = sectionFor(canvasElement, 'Input field');

    await expect(section).not.toHaveAttribute('draggable');
    const handle = section.querySelector('[data-drag-handle]') as SVGElement;
    await expect(globalThis.getComputedStyle(handle).opacity).toBe('0.5');

    /* Dragging off does NOT mean reordering off - nested rows are button-only. The
       dimmed handle is the sole hint, and it still says `cursor: grab`, which is the
       one thing here that lies to the pointer. */
    await expect(globalThis.getComputedStyle(handle).cursor).toBe('grab');
    await userEvent.click(within(section).getByRole('button', { name: 'Move Input up' }));
    await expect(args.onMoveUp).toHaveBeenCalledTimes(1);
  },
};

export const CompactSpacing: Story = {
  name: 'Compact against default',
  args: { compact: true },
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
      <BuilderWrapper {...args} compact={false} field={{ ...INPUT_FIELD, type: 'textarea' }}>
        <Body label="Default row" />
      </BuilderWrapper>
      <BuilderWrapper {...args} compact={true} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const roomy = sectionFor(canvasElement, 'Textarea field');
    const tight = sectionFor(canvasElement, 'Input field');

    /* `compact` is spelled out three times in one class string (padding, gap, radius,
       heading size). Asserting the relation rather than the pixel values keeps this
       honest if the scale is retuned, while still failing if `compact` stops applying. */
    const roomyBox = globalThis.getComputedStyle(roomy);
    const tightBox = globalThis.getComputedStyle(tight);
    await expect(parseFloat(tightBox.paddingTop)).toBeLessThan(parseFloat(roomyBox.paddingTop));
    await expect(parseFloat(tightBox.borderTopLeftRadius)).toBeLessThan(
      parseFloat(roomyBox.borderTopLeftRadius)
    );
    await expect(parseFloat(tightBox.rowGap)).toBeLessThan(parseFloat(roomyBox.rowGap));

    const headingSize = (section: HTMLElement, text: string) =>
      parseFloat(globalThis.getComputedStyle(within(section).getByText(text)).fontSize);
    await expect(headingSize(tight, 'Input')).toBeLessThan(headingSize(roomy, 'Textarea'));

    // Same controls either way - compact trims spacing, not affordances.
    await expect(within(tight).getAllByRole('button')).toHaveLength(3);
  },
};

export const Dragging: Story = {
  name: 'isDragging changes nothing at default size',
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
      <BuilderWrapper {...args} field={{ ...INPUT_FIELD, type: 'textarea' }} isDragging={false}>
        <Body label="At rest" />
      </BuilderWrapper>
      <BuilderWrapper {...args} isDragging={true} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const atRest = globalThis.getComputedStyle(sectionFor(canvasElement, 'Textarea field'));
    const dragging = globalThis.getComputedStyle(sectionFor(canvasElement, 'Input field'));

    /* `isDragging` appends `rounded-[18px]` - which a non-compact row already has. So the
       flag is inert here: no lift, no dimming, no outline, nothing a user could see. The
       drag feedback comes entirely from the cloned drag image, and this row is drawn
       exactly as if it were sitting still. Asserting the sameness so that adding a real
       dragging treatment has to come here and say so. */
    await expect(dragging.borderTopLeftRadius).toBe(atRest.borderTopLeftRadius);
    await expect(dragging.opacity).toBe(atRest.opacity);
    await expect(dragging.boxShadow).toBe(atRest.boxShadow);
    await expect(dragging.backgroundColor).toBe(atRest.backgroundColor);
  },
};
