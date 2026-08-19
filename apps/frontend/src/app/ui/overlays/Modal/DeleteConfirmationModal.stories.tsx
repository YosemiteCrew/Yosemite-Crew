import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import DeleteConfirmationModal from './DeleteConfirmationModal';

type DeleteModalProps = ComponentProps<typeof DeleteConfirmationModal>;

const ITEMS = [
  'All companion and clinical records held by this organization',
  'Every appointment, invoice and payment history',
  'All staff accounts and their access',
  'Uploaded documents, images and lab results',
];

/**
 * `showModal` is a prop, but the state behind the gate - consent, the typed email and
 * its inline error - lives inside the component and is reset on every close. So the
 * harness owns only the open flag, exactly as the settings page does, and drives it
 * through a trigger rather than mounting the dialog open: at rest the docs page then
 * holds no `ModalBase` scroll lock.
 */
const DeleteFlowHarness = (args: DeleteModalProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[560px] items-start p-6">
      <button
        type="button"
        className="rounded-2xl bg-[var(--danger-strong)] px-6 py-3 text-body-3-emphasis text-[var(--danger-strong-ink)]"
        onClick={() => setOpen(true)}
      >
        Delete organization
      </button>
      <DeleteConfirmationModal {...args} showModal={open} setShowModal={setOpen} />
    </div>
  );
};

/** Opens the dialog and returns it. Only the open one carries the `open` attribute. */
const openDialog = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Delete organization' }));
  const dialog = document.body.querySelector('dialog.yc-modal-dialog[open]') as HTMLElement | null;
  await expect(dialog).toBeInTheDocument();
  return dialog as HTMLElement;
};

/** Ticks consent and, optionally, types an address. */
const fillGate = async (dialog: HTMLElement, email?: string) => {
  const scope = within(dialog);
  await userEvent.click(scope.getByRole('checkbox'));
  if (email !== undefined) {
    await userEvent.type(scope.getByLabelText('Enter email address'), email);
  }
  return scope;
};

const meta = {
  title: 'Overlays/DeleteConfirmationModal',
  component: DeleteConfirmationModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The last step before an organization or a profile is destroyed. It is `createPortal`ed ' +
          'to `document.body` by `CenterModal`, so it exists only while a page holds `showModal` - ' +
          'and the states that matter are two interactions deeper still, behind a checkbox and a ' +
          'typed email that no snapshot had ever supplied.\n\n' +
          'The gate is the reason to draw it. Delete is `isDisabled={!consent}`, which through ' +
          '`BaseButton` renders a genuinely `disabled` button (the `href="#"` never becomes a link), ' +
          'and `handleDelete` re-checks consent before doing anything - defence in depth on an ' +
          'irreversible action. The email is validated *separately*, inline, and only once Delete ' +
          'is pressed: folding it into the same gate would make "Email is required" unreachable, ' +
          'because the button would still be disabled at the moment the message needed to appear. ' +
          'So there are three distinct rejections - unticked, empty address, malformed address - ' +
          'and each renders differently.\n\n' +
          'The layout worth pinning is the same shape as the bugs this sweep exists for: a ' +
          '`grid grid-cols-2 gap-2` action row nested inside `CenterModal`’s ' +
          '`flex flex-col gap-3`, mounted only with the dialog, with the destructive pill on the ' +
          'right where a confirm usually sits. Above it the "will permanently remove" bullets are ' +
          'a `list-disc` at `text-caption-1`, and the whole dialog is a fixed 500px column that ' +
          'grows downward as that list grows.\n\n' +
          'Every story below opens the dialog through its trigger and asserts the panel has its ' +
          'copy, its bullets and both actions - not merely that something portalled.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: false,
    setShowModal: fn(),
    title: 'Delete organization',
    confirmationQuestion: 'Are you sure you want to delete Riverbend Veterinary?',
    itemsToRemove: ITEMS,
    emailPrompt: 'Type the email address on your account to confirm.',
    consentLabel: 'I understand this is permanent and cannot be undone.',
    noteText: 'Deletion runs within 24 hours and cannot be cancelled once it starts.',
    onDelete: fn(),
  },
  argTypes: {
    // Owned by the harness so the dialog has a real open/close lifecycle.
    showModal: { table: { disable: true }, control: false },
    setShowModal: { table: { disable: true }, control: false },
  },
  render: (args) => <DeleteFlowHarness {...args} />,
} satisfies Meta<typeof DeleteConfirmationModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  name: 'Open (Delete gated)',
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const scope = within(dialog);
    await expect(scope.getByRole('heading', { name: 'Delete organization' })).toBeInTheDocument();
    await expect(
      scope.getByText('Are you sure you want to delete Riverbend Veterinary?')
    ).toBeInTheDocument();
    await expect(scope.getByText('This action will permanently remove:')).toBeInTheDocument();
    // The bullets are the substance of the warning - assert they are all there, not
    // merely that a list element exists.
    await expect(scope.getAllByRole('listitem')).toHaveLength(ITEMS.length);
    await expect(scope.getByText(ITEMS[0])).toBeInTheDocument();
    await expect(scope.getByLabelText('Enter email address')).toHaveValue('');
    await expect(scope.getByRole('checkbox')).not.toBeChecked();
    // The gate itself: Delete is a real disabled button until consent is given.
    const remove = scope.getByRole('button', { name: 'Delete' });
    await expect(remove).toBeDisabled();
    await expect(scope.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    /* Both actions live in a `grid grid-cols-2` that only mounts with the dialog.
       Assert the computed template resolves to two tracks holding both buttons: a
       dropped template stacks them into one column and still looks deliberate. */
    const actions = remove.parentElement as HTMLElement;
    await expect(getComputedStyle(actions).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(actions.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dialog as it opens: the question, the bulleted list of what goes, the email field, ' +
          'the consent row, and a Delete that cannot yet be pressed. Nothing here indicates *why* ' +
          'Delete is inert other than the checkbox above it, which is the whole design.',
      },
    },
  },
};

export const ConsentGiven: Story = {
  name: 'Consent ticked (Delete live)',
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const scope = await fillGate(dialog);
    await expect(scope.getByRole('checkbox')).toBeChecked();
    await expect(scope.getByRole('button', { name: 'Delete' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'One click changes the button from disabled to live. `BaseButton` swaps the ' +
          '`pointer-events-none opacity-60` pair off it, so the difference is a 40% opacity step ' +
          'on a red pill - the only visual feedback that the gate has opened.',
      },
    },
  },
};

export const EmailRequired: Story = {
  name: 'Consent ticked, no email',
  play: async ({ canvasElement, args }) => {
    const dialog = await openDialog(canvasElement);
    const scope = await fillGate(dialog);
    await userEvent.click(scope.getByRole('button', { name: 'Delete' }));
    // Reachable only because consent and the email are separate gates: a combined
    // gate would leave Delete disabled and this message unreachable.
    expect(await scope.findByRole('alert')).toHaveTextContent('Email is required');
    await expect(args.onDelete).not.toHaveBeenCalled();
    await expect(scope.getByLabelText('Enter email address')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pressing Delete with the address blank. The error is an inline `role="alert"` row under ' +
          'the field with a warning glyph, and it also flips the input border to `--danger` - a ' +
          'state that appears *after* a press rather than on blur, so it is only ever seen mid-flow.',
      },
    },
  },
};

export const EmailInvalid: Story = {
  name: 'Consent ticked, malformed email',
  play: async ({ canvasElement, args }) => {
    const dialog = await openDialog(canvasElement);
    const scope = await fillGate(dialog, 'ops@yosemite');
    await userEvent.click(scope.getByRole('button', { name: 'Delete' }));
    expect(await scope.findByRole('alert')).toHaveTextContent('Enter a valid email');
    await expect(args.onDelete).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second rejection, with different copy in the same row. Typing again clears the ' +
          'error on the first keystroke rather than on the next press, so this state is easy to ' +
          'lose and hard to review outside a story.',
      },
    },
  },
};

export const ErrorClearsOnTyping: Story = {
  name: 'Error clears as soon as typing resumes',
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const scope = await fillGate(dialog, 'ops@yosemite');
    await userEvent.click(scope.getByRole('button', { name: 'Delete' }));
    expect(await scope.findByRole('alert')).toBeInTheDocument();
    await userEvent.type(scope.getByLabelText('Enter email address'), 'crew.com');
    await expect(scope.queryByRole('alert')).not.toBeInTheDocument();
    await expect(scope.getByLabelText('Enter email address')).toHaveValue('ops@yosemitecrew.com');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The recovery path. `onChange` clears the message, so the row disappears and the dialog ' +
          'shrinks by its height while the reader is still typing - the layout shift is the point ' +
          'of drawing it.',
      },
    },
  },
};

export const Confirmed: Story = {
  name: 'Deleted',
  play: async ({ canvasElement, args }) => {
    const dialog = await openDialog(canvasElement);
    const scope = await fillGate(dialog, 'ops@yosemitecrew.com');
    await userEvent.click(scope.getByRole('button', { name: 'Delete' }));
    await expect(args.onDelete).toHaveBeenCalled();
    // Both gates satisfied: the modal resets its own state and closes itself. The
    // close lands after `onDelete` settles, so wait for it rather than racing it.
    await waitFor(() =>
      expect(document.body.querySelector('dialog.yc-modal-dialog[open]')).not.toBeInTheDocument()
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only path that reaches `onDelete`. The modal awaits it, then resets consent, email ' +
          'and error before closing, so re-opening never shows a pre-ticked consent box.',
      },
    },
  },
};

export const Cancelled: Story = {
  name: 'Cancelled',
  play: async ({ canvasElement, args }) => {
    const dialog = await openDialog(canvasElement);
    await fillGate(dialog, 'ops@yosemitecrew.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(args.onDelete).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.body.querySelector('dialog.yc-modal-dialog[open]')).not.toBeInTheDocument()
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Cancel runs the same `reset()` as a successful delete, which is what stops a filled-in ' +
          'address and a ticked consent box surviving into the next open.',
      },
    },
  },
};

export const ShortList: Story = {
  name: 'Two bullets (profile deletion)',
  args: {
    title: 'Delete profile',
    confirmationQuestion: 'Are you sure you want to delete your profile?',
    itemsToRemove: ['Your account and sign-in', 'Your personal settings and preferences'],
    emailPrompt: 'Type your email address to confirm.',
    consentLabel: 'I understand my profile cannot be restored.',
    noteText: 'Records you authored stay with the organization.',
  },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const scope = within(dialog);
    await expect(scope.getAllByRole('listitem')).toHaveLength(2);
    await expect(scope.getByRole('button', { name: 'Delete' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The other caller of the same dialog. Every string is a prop, so the shortest form is ' +
          'the honest test of the fixed 500px column: with two bullets the dialog is barely taller ' +
          'than its actions, and the `gap-3` rhythm between the four blocks is all that separates ' +
          'them.',
      },
    },
  },
};
