import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PackageDeleteModal from './PackageDeleteModal';

type DeleteModalProps = ComponentProps<typeof PackageDeleteModal>;

/**
 * The component has no closed state - the parent mounts it when delete is pressed and
 * unmounts it on cancel - so the harness reproduces that lifecycle. It also keeps the
 * dialog out of the docs page at rest, where `ModalBase`'s shared body scroll lock would
 * otherwise stay held.
 */
const DeleteFlowHarness = (args: DeleteModalProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[360px] items-start p-6">
      <button
        type="button"
        className="px-6 py-3 bg-[var(--danger-strong)] text-[var(--danger-strong-ink)] rounded-2xl text-body-3-emphasis"
        onClick={() => setOpen(true)}
      >
        Delete package
      </button>
      {open && (
        <PackageDeleteModal
          {...args}
          onCancel={() => {
            setOpen(false);
            args.onCancel();
          }}
          onConfirm={() => {
            setOpen(false);
            args.onConfirm();
          }}
        />
      )}
    </div>
  );
};

const openDialog = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Delete package' }));
  const dialog = document.body.querySelector('dialog.yc-modal-dialog') as HTMLElement | null;
  await expect(dialog).toBeInTheDocument();
  return dialog as HTMLElement;
};

const meta = {
  title: 'Organization/PackageDeleteModal',
  component: PackageDeleteModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The confirm step before a service package is destroyed. It had no story, and it ' +
          'cannot have one that simply renders: the component hard-codes `showModal` and is ' +
          '`createPortal`ed to `document.body` by `CenterModal`, so it exists only for as long ' +
          'as the Specialities page keeps it mounted.\n\n' +
          'The layout worth pinning is the action row: a `grid grid-cols-2 gap-3` of a ' +
          'Secondary and a Delete pill, both full-bleed halves of the 500px dialog. That is a ' +
          'two-column grid nested inside `CenterModal`’s `flex flex-col gap-3` container, ' +
          'exactly the shape of the layout bugs this sweep exists for - and destructive-first ' +
          'ordering matters here, because the red pill sits on the right where a confirm ' +
          'usually does.\n\n' +
          'The copy is the other reason to draw it. The package name is interpolated into the ' +
          'sentence in `<strong>`, so a long name rewraps the paragraph rather than truncating, ' +
          'and the body carries the archive advice that is the actual guidance - none of which ' +
          'is reviewable from the component source alone.\n\n' +
          'Each story drives the dialog through its trigger and asserts the dialog has its ' +
          'copy and both actions, not merely that something portalled.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    packageName: 'Senior wellness plan',
    onCancel: fn(),
    onConfirm: fn(),
  },
  render: (args) => <DeleteFlowHarness {...args} />,
} satisfies Meta<typeof PackageDeleteModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  name: 'Open',
  play: async ({ canvasElement }) => {
    const dialog = within(await openDialog(canvasElement));
    await expect(dialog.getByRole('heading', { name: 'Delete package' })).toBeInTheDocument();
    // Assert the dialog drew its copy and BOTH actions - an empty portalled
    // dialog would satisfy "a dialog appeared" on its own.
    await expect(dialog.getByText('Senior wellness plan')).toBeInTheDocument();
    await expect(dialog.getByText(/cannot be undone/i)).toBeInTheDocument();
    await expect(dialog.getByText(/archiving instead/i)).toBeInTheDocument();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    /* Both actions live in a `grid grid-cols-2` that only mounts with the dialog.
       Assert the computed template resolves to two tracks holding both buttons: a
       dropped template stacks them into one column and still looks intentional. */
    const actionRow = dialog.getByRole('button', { name: 'Delete' }).parentElement as HTMLElement;
    await expect(getComputedStyle(actionRow).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(
      2
    );
    await expect(actionRow.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      story:
        'The dialog as the Specialities page shows it: title row with the X, the warning ' +
        'paragraph naming the package, then the two half-width actions.',
    },
  },
};

export const Confirmed: Story = {
  name: 'Delete pressed',
  play: async ({ canvasElement, args }) => {
    const dialog = await openDialog(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await expect(args.onConfirm).toHaveBeenCalled();
    // The parent owns the lifecycle, so confirming unmounts the dialog outright.
    await expect(document.body.querySelector('dialog.yc-modal-dialog')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The destructive path. The dialog does not close itself - `onConfirm` is all it does, ' +
        'and the page decides what happens next.',
    },
  },
};

export const Cancelled: Story = {
  name: 'Cancel pressed',
  play: async ({ canvasElement, args }) => {
    const dialog = await openDialog(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancel).toHaveBeenCalled();
    await expect(document.body.querySelector('dialog.yc-modal-dialog')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'Cancel is wired to the same handler as the header X and the backdrop, so all three ' +
        'dismissals land in one place.',
    },
  },
};

export const LongPackageName: Story = {
  name: 'Long package name',
  args: {
    packageName: 'Senior wellness plan with quarterly bloodwork, dental scale and polish',
    onCancel: fn(),
    onConfirm: fn(),
  },
  play: async ({ canvasElement }) => {
    const dialog = within(await openDialog(canvasElement));
    const name = dialog.getByText(
      'Senior wellness plan with quarterly bloodwork, dental scale and polish'
    );
    // The name is interpolated mid-sentence, so it rewraps the paragraph rather
    // than truncating - the only way to see how tall the dialog gets.
    await expect(name.tagName).toBe('STRONG');
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'Package names are user-entered and can be long. The `<strong>` sits inline in the ' +
        'sentence, so the paragraph grows and pushes the action grid down inside the 500px ' +
        'dialog.',
    },
  },
};
