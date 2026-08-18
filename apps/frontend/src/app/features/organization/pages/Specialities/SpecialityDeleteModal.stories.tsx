import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import SpecialityDeleteModal from './SpecialityDeleteModal';

/**
 * The parent gates this modal by *mounting* it - there is no `open` prop - so a
 * harness that mounts it from a row action is the only way to exercise the real
 * path, portal and focus move included.
 */
const RowHarness = (props: ComponentProps<typeof SpecialityDeleteModal>) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex w-full max-w-[420px] items-center justify-between gap-3 rounded-2xl border border-card-border p-4">
      <span className="text-body-4 text-text-primary">{props.specialityName}</span>
      <button
        type="button"
        className="rounded-full border border-danger-600 px-4 py-2 text-body-4 text-danger-600"
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
      {confirming && <SpecialityDeleteModal {...props} onCancel={() => setConfirming(false)} />}
    </div>
  );
};

/** The dialog portals to `document.body`, so assertions query the document. */
const findDialog = async () => {
  const dialog = await within(document.body).findByRole('dialog');
  await expect(dialog).toBeInTheDocument();
  return within(dialog);
};

const meta = {
  title: 'Organization/SpecialityDeleteModal',
  component: SpecialityDeleteModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The destructive confirm for removing a speciality. It has no `open` prop at all - it ' +
          'hardcodes `showModal` on `CenterModal` - so the parent gates it purely by mounting it, ' +
          'and `ModalBase` then `createPortal`s the whole thing to `document.body`. Between those ' +
          'two facts, nothing in Storybook or Chromatic had ever contained a single pixel of it.\n\n' +
          'What that hid is a dialog carrying real consequences. The body names the speciality in ' +
          'a `<strong>` inside a flowing paragraph, so a long name rewraps the sentence and the ' +
          'dialog grows; the action row is a `grid grid-cols-2 gap-3`, which makes Cancel and ' +
          'Delete exactly equal in width and weight - the same 50/50 pairing that made an earlier ' +
          'destructive dialog read as symmetric when it should not. And the in-flight state is ' +
          'label-only: `deleting` swaps the text to "Deleting..." and the click handler early-' +
          'returns, but the button is never actually `disabled`, so it keeps full contrast and ' +
          'stays focusable while the request is out.\n\n' +
          'Both buttons pass `href="#"`, which `BaseButton` treats as *not* a link, so they render ' +
          'as `<button>` rather than anchors - worth pinning down, since a mistake there would be ' +
          'invisible until a keyboard user hit it.\n\n' +
          'The stories assert the dialog body has its copy and both actions, not merely that a ' +
          'dialog exists.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    specialityName: 'Dermatology',
    deleting: false,
    onCancel: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof SpecialityDeleteModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Confirm dialog',
  play: async () => {
    const panel = await findDialog();
    await expect(panel.getByRole('heading', { name: 'Delete speciality' })).toBeInTheDocument();
    await expect(panel.getByText('Dermatology')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    await expect(panel.getByText(/This action cannot be undone\./)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The resting confirm. Cancel and Delete are equal halves of a two-column grid, so the ' +
        'destructive action carries no less visual weight than the safe one - the red fill is the ' +
        'only thing distinguishing them.',
    },
  },
};

export const MountedFromRow: Story = {
  name: 'Opened from a speciality row',
  render: (args) => <RowHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Nothing is portalled until the row action mounts it - that mount is the gate.
    await expect(within(document.body).queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }));
    const panel = await findDialog();
    await expect(panel.getByRole('heading', { name: 'Delete speciality' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The real path: the dialog does not exist in the DOM until the row action mounts it. That ' +
        'also exercises the mount-time behaviour of `ModalBase` - the body scroll lock and the ' +
        'focus move onto the first focusable control inside the dialog.',
    },
  },
};

export const Deleting: Story = {
  name: 'Delete in flight',
  args: { deleting: true },
  play: async () => {
    const panel = await findDialog();
    const confirm = panel.getByRole('button', { name: 'Deleting...' });
    await expect(confirm).toBeInTheDocument();
    // Label-only: the guard lives in the handler, so the control is still enabled.
    await expect(confirm).toBeEnabled();
  },
  parameters: {
    docs: {
      story:
        'While the delete is out, only the label changes. The button keeps its full-strength red ' +
        'fill and stays focusable and clickable - the repeat click is swallowed by an early return ' +
        'rather than prevented - so this state is easy to mistake for the resting one.',
    },
  },
};

export const LongSpecialityName: Story = {
  name: 'Long speciality name',
  args: {
    specialityName: 'Small animal internal medicine and advanced diagnostic imaging',
  },
  play: async () => {
    const panel = await findDialog();
    await expect(
      panel.getByText('Small animal internal medicine and advanced diagnostic imaging')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The name is inlined into the sentence rather than given its own line, so a long one ' +
        'rewraps the paragraph and grows the dialog downward. The action grid stays a fixed ' +
        'two-column row underneath, which is what keeps this from turning into a scrolling panel.',
    },
  },
};
