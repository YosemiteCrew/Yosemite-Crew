import type { Meta, StoryObj } from '@storybook/react';
import type { RefObject } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import SpecialityNameEditor from './SpecialityNameEditor';

/** The component only writes to this ref, so a plain object stands in for useRef. */
const makeRef = (): RefObject<HTMLInputElement | null> => ({ current: null });

/**
 * The editor returns a bare fragment in display mode - three siblings with no
 * wrapper of their own - so the row it lives in supplies both the flex context and
 * the `group` that the rename button's reveal keys off. Reproducing that wrapper
 * here is not decoration: without `group` the `sm:group-hover:` rule never has an
 * anchor, and without `min-w-0` the truncation story cannot truncate.
 */
const meta = {
  title: 'Organization/SpecialityNameEditor',
  component: SpecialityNameEditor,
  parameters: {
    layout: 'padded',
    containerWidth: 520,
    docs: {
      description: {
        component:
          'The left-hand identity of a speciality row, and two completely different renders behind ' +
          'one `editingName` flag. Display mode is a name button, a counts subtitle and a rename ' +
          'affordance. Editing mode replaces all three with a text field and a row of three 32px ' +
          'circles - save, cancel, delete - which share a shape, a size and a position, so a ' +
          'crossed pair of handlers is invisible until someone deletes a speciality they meant to ' +
          'rename. Each story therefore fires one control and checks the other two stayed silent.\n\n' +
          'Two details do not live here and are easy to misread as bugs in this file. The error ' +
          '*message* is rendered by the accordion header, not by the editor: all the editor does ' +
          'is set `aria-invalid`, and it wires up no `aria-describedby`, so the invalid state is ' +
          'announced without its reason. And Enter/Escape are not handled here either - the input ' +
          'forwards the whole key event to `onNameKeyDown` and the parent decides which keys mean ' +
          'save and cancel.\n\n' +
          'The rename button is revealed rather than hidden: `sm:opacity-0` with ' +
          '`sm:group-hover:opacity-100` and `sm:focus-visible:opacity-100`. It stays in the layout ' +
          'and in the tab order at zero opacity, which is why the focus reveal matters - the ' +
          'pointer reveal cannot be reproduced by a synthetic hover, but a keyboard user reaching ' +
          'an invisible button is the failure that actually strands someone. Below `sm` the ' +
          'opacity rules drop out entirely and the button is simply always visible, since a touch ' +
          'device has no hover to reveal it with.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    editingName: false,
    nameInputId: 'speciality-name-editor-story',
    inputRef: makeRef(),
    nameValue: 'Dermatology',
    nameError: '',
    specialityName: 'Dermatology',
    subtitle: '9 services · 4 packages',
    onToggleOpen: fn(),
    onNameChange: fn(),
    onNameKeyDown: fn(),
    onSaveName: fn(),
    onCancelName: fn(),
    onEditClick: fn(),
    onRequestDelete: fn(),
  },
  decorators: [
    (Story, context) => (
      <div
        className="group flex items-center gap-2 rounded-2xl border border-card-border px-4 py-3"
        style={{ width: (context.parameters.containerWidth as number | undefined) ?? 520 }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof SpecialityNameEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Display: Story = {
  name: 'Display: name, subtitle, rename',
  args: { nameInputId: 'speciality-name-editor-display' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* The name is a button, not a heading: it toggles the accordion. A page lists
       one of these per speciality, so the rename control has to name its target -
       "Rename" alone leaves a screen-reader user with a column of identical
       buttons and no way to tell which speciality they are about to rename. */
    const rename = canvas.getByRole('button', { name: 'Rename Dermatology' });
    await expect(canvas.getByRole('button', { name: 'Dermatology' })).toBeInTheDocument();
    await expect(canvas.getByText('9 services · 4 packages')).toBeInTheDocument();

    // Editing controls belong to the other branch and must not leak into this one.
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();

    /* Hidden by opacity, not by display: it keeps its box and its place in the tab
       order at rest. Above `sm` that means an invisible, focusable button. */
    await expect(getComputedStyle(rename).opacity).toBe('0');
    await expect(rename.getBoundingClientRect().width).toBeGreaterThan(0);

    /* `sm:focus-visible:opacity-100` is the only thing that saves the keyboard
       path. Tab into it rather than calling .focus(): Chromium only grants
       :focus-visible when the focus move came from the keyboard. */
    canvas.getByRole('button', { name: 'Dermatology' }).focus();
    await userEvent.tab();
    await expect(rename).toHaveFocus();
    // The opacity transition means the settled value arrives a frame later than the focus.
    await waitFor(async () => {
      await expect(getComputedStyle(rename).opacity).toBe('1');
    });

    await userEvent.click(rename);
    await expect(args.onEditClick).toHaveBeenCalledTimes(1);
    // Renaming must not also toggle the accordion open underneath the field.
    await expect(args.onToggleOpen).not.toHaveBeenCalled();
  },
};

export const Editing: Story = {
  name: 'Editing: save, cancel, delete',
  args: {
    editingName: true,
    nameInputId: 'speciality-name-editor-editing',
    inputRef: makeRef(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Edit speciality name' });

    await expect(input).toHaveValue('Dermatology');
    /* The visible name button is gone, so the accordion can no longer be toggled
       from here - that is deliberate, an open rename should not collapse the row. */
    await expect(canvas.queryByRole('button', { name: 'Dermatology' })).not.toBeInTheDocument();

    /* Three round controls of the same 32px size sit in a row. Fire each one and
       assert the other two stayed silent: nothing about the rendering would show
       a delete handler wired to the tick. */
    await userEvent.click(canvas.getByRole('button', { name: 'Save name' }));
    await expect(args.onSaveName).toHaveBeenCalledTimes(1);
    await expect(args.onCancelName).not.toHaveBeenCalled();
    await expect(args.onRequestDelete).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: 'Cancel rename' }));
    await expect(args.onCancelName).toHaveBeenCalledTimes(1);
    await expect(args.onRequestDelete).not.toHaveBeenCalled();

    /* Delete names its target for the same reason rename does, and because this is
       the destructive one it is the label a confirm dialog is judged against. */
    await userEvent.click(canvas.getByRole('button', { name: 'Delete Dermatology' }));
    await expect(args.onRequestDelete).toHaveBeenCalledTimes(1);
    await expect(args.onSaveName).toHaveBeenCalledTimes(1);

    // The field owns no key handling itself; the parent reads the key off the event.
    await userEvent.type(input, 'x');
    await expect(args.onNameChange).toHaveBeenCalledWith('Dermatologyx');
    await userEvent.type(input, '{Enter}');
    await expect(args.onNameKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Enter' })
    );
    await userEvent.type(input, '{Escape}');
    await expect(args.onNameKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Escape' })
    );
  },
};

export const EditingWithError: Story = {
  name: 'Editing: name rejected',
  args: {
    editingName: true,
    nameInputId: 'speciality-name-editor-error',
    inputRef: makeRef(),
    nameValue: '',
    nameError: 'Speciality name is required.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Edit speciality name' });

    await expect(input).toHaveAttribute('aria-invalid', 'true');

    /* The message itself is the accordion header's job, so nothing here renders
       the reason and nothing points at it. Pinning that keeps the split honest: if
       a message ever appears in this component it would be announced twice, and if
       the header stops rendering one the field goes invalid with no explanation at
       all - which is what these two assertions describe today. */
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(input).not.toHaveAttribute('aria-describedby');
    await expect(canvas.queryByText('Speciality name is required.')).not.toBeInTheDocument();

    // The three controls stay reachable while invalid - cancel especially.
    await expect(canvas.getByRole('button', { name: 'Cancel rename' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Save name' })).toBeEnabled();
  },
};

export const LongName: Story = {
  name: 'Long name in a narrow row',
  parameters: { containerWidth: 300 },
  args: {
    nameInputId: 'speciality-name-editor-long',
    specialityName: 'Small animal internal medicine and advanced diagnostic imaging',
    subtitle: '24 services · 11 packages',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByRole('button', {
      name: 'Small animal internal medicine and advanced diagnostic imaging',
    });
    const rename = canvas.getByRole('button', {
      name: 'Rename Small animal internal medicine and advanced diagnostic imaging',
    });

    // Clipped with an ellipsis rather than wrapped: the row must stay one line high.
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
    await expect(Math.round(name.getBoundingClientRect().height)).toBeLessThanOrEqual(28);

    /* `shrink-0` on the rename button is what makes the clipping land on the text.
       Without it the 36px control is the thing that gets squeezed and the row ends
       up with a name that fits and a button nobody can hit. */
    await expect(Math.round(rename.getBoundingClientRect().width)).toBe(36);
    await expect(Math.round(rename.getBoundingClientRect().height)).toBe(36);

    // Name, subtitle and control still share one line, and none of it overflows.
    const nameBox = name.getBoundingClientRect();
    const renameBox = rename.getBoundingClientRect();
    await expect(renameBox.left).toBeGreaterThanOrEqual(nameBox.right);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
