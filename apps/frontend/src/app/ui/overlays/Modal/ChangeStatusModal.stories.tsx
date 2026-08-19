import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { RecordStatus } from '@yosemite-crew/types';

import ToastProvider from '@/app/ui/layout/ToastProvider';
import ChangeStatusModal from './ChangeStatusModal';

const STATUS_OPTIONS: Array<{ value: RecordStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'inactive', label: 'Inactive' },
];

type HarnessProps = {
  currentStatus: RecordStatus;
  canTransition: (from: RecordStatus, to: RecordStatus) => boolean;
  validateBeforeSave?: (next: RecordStatus) => string | null;
  onSave: (next: RecordStatus) => Promise<void>;
};

/**
 * `ChangeStatusModal` is generic over its status union, so it cannot be a story's
 * `component` directly. This harness pins it to `RecordStatus` - the companion
 * consumer's union - and reproduces the real lifecycle: consumers mount the dialog
 * on demand and unmount it on dismissal, which also keeps five open dialogs off the
 * docs page, where they would each hold `ModalBase`'s shared body scroll lock.
 */
const CompanionStatusHarness = ({
  currentStatus,
  canTransition,
  validateBeforeSave,
  onSave,
}: HarnessProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[420px] items-start p-6">
      <ToastProvider />
      <button
        type="button"
        className="rounded-2xl bg-[var(--cta)] px-6 py-3 text-body-3-emphasis text-[var(--cta-text)]"
        onClick={() => setOpen(true)}
      >
        Open status chooser
      </button>
      {open && (
        <ChangeStatusModal<RecordStatus>
          showModal
          setShowModal={setOpen}
          currentStatus={currentStatus}
          defaultStatus={currentStatus}
          statusOptions={STATUS_OPTIONS}
          placeholder="Companion status"
          canTransition={canTransition}
          getInvalidMessage={(from, to) => `Cannot change status from ${from} to ${to}.`}
          validateBeforeSave={validateBeforeSave}
          onSave={onSave}
        />
      )}
    </div>
  );
};

/** Opens the chooser and returns the live dialog, matched on `dialog[open]`. */
const openDialog = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Open status chooser' }));
  return waitFor(() => {
    const dialog = document.querySelector('dialog[open]');
    expect(dialog).not.toBeNull();
    return dialog as HTMLElement;
  });
};

/**
 * Picks a status. `LabelDropdown` portals its panel to `document.body`, so the
 * options are outside both the dialog and the canvas; the last panel is taken
 * because a panel left open by an earlier story is still in the body.
 */
const chooseStatus = async (dialog: HTMLElement, from: string, to: string) => {
  await userEvent.click(within(dialog).getByRole('button', { name: `Companion status: ${from}` }));
  const panel = await waitFor(() => {
    const panels = document.querySelectorAll('[data-portal-dropdown]');
    expect(panels.length).toBeGreaterThan(0);
    return panels[panels.length - 1] as HTMLElement;
  });
  await userEvent.click(within(panel).getByRole('button', { name: to }));
  return waitFor(() =>
    expect(
      within(dialog).getByRole('button', { name: `Companion status: ${to}` })
    ).toBeInTheDocument()
  );
};

/** A save that never settles - the only way to hold the saving frame still. */
const neverSettles = () => new Promise<void>(() => {});

/**
 * The text of the toasts currently on screen.
 *
 * Read off the container rather than through a text query: on the docs page every
 * story mounts its own `ToastContainer`, so one `notify` can render in more than
 * one of them and a `findByText` would throw on the duplicates.
 */
const toastText = (): string =>
  [...document.querySelectorAll('.Toastify__toast')]
    .map((node) => node.textContent ?? '')
    .join(' | ');

const meta = {
  title: 'Overlays/ChangeStatusModal',
  component: CompanionStatusHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The shared status chooser behind the companion, appointment and task status changes. ' +
          'What it owns beyond the picker is a small state machine on the way out, and none of it ' +
          'had ever been drawn, because in every consumer `onSave` is a real network write: a ' +
          'snapshot catches either the resting dialog or nothing.\n\n' +
          'Pressing **Update** can end in five different frames. Same status: the dialog just ' +
          'closes, no write. Illegal transition: a warning **toast**, and the dialog stays open ' +
          'with nothing in it changed. Failed validation: an inline red line under the picker. ' +
          'A rejected save: the same inline line, carrying the error message. And in flight: the ' +
          'button label flips to `Saving...`, both buttons disable, and the picker takes ' +
          '`pointer-events-none` so the status cannot be changed underneath a write already sent.\n\n' +
          'Two of those are easy to get wrong and impossible to notice: the toast branch leaves ' +
          'the dialog looking untouched (the picker still shows the status that was refused), and ' +
          'the `pointer-events-none` guard is invisible in a static frame - the picker still looks ' +
          'live, it just no longer answers.\n\n' +
          'The stories mount a real `ToastProvider`, so the warning branch renders where the app ' +
          'renders it rather than being asserted as a call.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    currentStatus: 'active',
    /* Both are widened back to the prop's own signature. Without the casts the
       meta args narrow the story type to `() => true` and to a `Mock` of this
       exact shape, and every override below - a real transition table, a save
       that never settles - stops type-checking against its own component. */
    canTransition: (() => true) as HarnessProps['canTransition'],
    onSave: fn(async () => {}) as HarnessProps['onSave'],
  },
} satisfies Meta<typeof CompanionStatusHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AtRest: Story = {
  name: 'At rest',
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);

    const heading = within(dialog).getByRole('heading', { name: 'Change status' });
    // The heading is an h2 wired to the shell, not a styled div - the dialog is
    // named by it, so the level is part of what the frame is asserting.
    await expect(heading.tagName).toBe('H2');

    /* The picker opens on the CURRENT status rather than on the placeholder, so
       the reader's first move is always a change away from where they are. */
    const trigger = within(dialog).getByRole('button', { name: 'Companion status: Active' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger.textContent).toContain('Active');
    await expect(within(dialog).getByRole('button', { name: 'Update' })).toBeEnabled();
    await expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    // Neither failure line exists yet: the inline slot is empty, not hidden.
    await expect(within(dialog).queryByText(/Settle the open invoice/)).not.toBeInTheDocument();
    await expect(dialog.querySelectorAll('p')).toHaveLength(0);

    /* The baseline for the saving story: the picker is interactive, and nothing
       above it has taken the pointer-events guard. */
    await expect(getComputedStyle(trigger).pointerEvents).toBe('auto');
    await expect(trigger.closest('.pointer-events-none')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The frame the consumers already had. Everything below is this dialog after Update has ' +
          'been pressed.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Saving (in flight)',
  args: { onSave: neverSettles },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await chooseStatus(dialog, 'Active', 'Archived');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update' }));

    // The label IS the state - there is no spinner and no overlay - so the button
    // named "Update" must be gone, not merely disabled.
    const saving = await within(dialog).findByRole('button', { name: 'Saving...' });
    await expect(saving).toBeDisabled();
    await expect(within(dialog).queryByRole('button', { name: 'Update' })).not.toBeInTheDocument();
    // Cancel goes with it: a save in flight cannot be abandoned from here.
    await expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();

    /* And the picker stops answering. Asserted on the trigger's own computed
       style rather than on the wrapper's class list, because the class is only
       the mechanism - what matters is that the control the reader can still see
       and still read no longer takes a pointer. */
    const trigger = within(dialog).getByRole('button', {
      name: 'Companion status: Archived',
    });
    await waitFor(() => expect(getComputedStyle(trigger).pointerEvents).toBe('none'));
    await expect(trigger.closest('.pointer-events-none')).not.toBeNull();
    // It is not disabled and not dimmed: it reads exactly as it did a frame ago.
    await expect(trigger).toBeEnabled();

    // The dialog stays open behind the write - closing is the save's job.
    await expect(document.querySelector('dialog[open]')).not.toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Held open by an `onSave` that never settles, which is the only way to keep this frame ' +
          'still. In the app it lasts one round trip.\n\n' +
          'Note what the guard does not do: the picker keeps its full `--field-bg` styling and its ' +
          'chevron, so nothing announces that it is inert. Compare it with the "At rest" frame ' +
          'above - the two are pixel-identical apart from the button label.',
      },
    },
  },
};

export const IllegalTransition: Story = {
  name: 'Illegal transition (toast, dialog stays)',
  args: {
    currentStatus: 'archived',
    canTransition: (_from: RecordStatus, to: RecordStatus) => to !== 'active',
    onSave: fn(async () => {}),
  },
  play: async ({ canvasElement, args }) => {
    const dialog = await openDialog(canvasElement);
    await chooseStatus(dialog, 'Archived', 'Active');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update' }));

    // The refusal is announced OUTSIDE the dialog, in a toast, carrying both the
    // fixed title and the message the caller supplied through `getInvalidMessage`.
    await waitFor(() => expect(toastText()).toContain('Status update blocked'));
    await expect(toastText()).toContain('Cannot change status from archived to active.');

    // Nothing was written, and the dialog is back to a live Update - so a reader
    // who missed the toast sees a dialog that looks as if the press did nothing.
    await expect(args.onSave).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Update' })).toBeEnabled()
    );
    await expect(document.querySelector('dialog[open]')).not.toBeNull();
    // The picker still shows the status that was just refused, not the one the
    // companion actually has.
    await expect(
      within(dialog).getByRole('button', { name: 'Companion status: Active' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The branch worth arguing about. The transition is rejected in a corner toast while the ' +
          'dialog keeps the rejected selection on screen, so the two surfaces disagree until the ' +
          'reader cancels. Nothing inside the dialog carries the refusal.',
      },
    },
  },
};

export const ValidationMessage: Story = {
  name: 'Blocked by validation (inline)',
  args: {
    validateBeforeSave: (next: RecordStatus) =>
      next === 'archived' ? 'Settle the open invoice before archiving this companion.' : null,
    onSave: fn(async () => {}),
  },
  play: async ({ canvasElement, args }) => {
    const dialog = await openDialog(canvasElement);
    await chooseStatus(dialog, 'Active', 'Archived');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update' }));

    /* Unlike the transition refusal, this one lands INSIDE the dialog, directly
       under the picker, in `--danger-text`. Polled rather than read once: the
       line arrives with the re-render that also re-enables the buttons. */
    const message = await within(dialog).findByText(
      'Settle the open invoice before archiving this companion.'
    );
    await expect(message.tagName).toBe('P');
    /* It is red, not body ink. Compared against the dialog's own heading rather
       than against a hex value: if `--danger-text` ever resolved to nothing the
       paragraph would simply inherit, and a class-list assertion would still
       pass. Polled, since the line arrives with the re-render that also
       re-enables the buttons. */
    const heading = within(dialog).getByRole('heading', { name: 'Change status' });
    await waitFor(() =>
      expect(getComputedStyle(message).color).not.toBe(getComputedStyle(heading).color)
    );
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(within(dialog).getByRole('button', { name: 'Update' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`validateBeforeSave` is the caller’s last guard, and it is the only failure the dialog ' +
          'reports in place. It also grows the panel by a line, so the action row moves down while ' +
          'the reader is looking at it.',
      },
    },
  },
};

export const SaveRejects: Story = {
  name: 'The save rejects',
  args: {
    onSave: fn(() => Promise.reject(new Error('The companion record is locked by another user.'))),
  },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await chooseStatus(dialog, 'Active', 'Archived');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update' }));

    /* The rejection's own message is surfaced verbatim, in the same inline slot
       the validation message uses - so an API error string is shown to the user
       exactly as it arrives. `findByText` already fails if the line never lands,
       so the returned node is asserted for WHAT it is rather than that it is
       there: the same `<p>` the validation branch writes into, which is what
       makes the two failures indistinguishable to a reader. */
    const failure = await within(dialog).findByText(
      'The companion record is locked by another user.'
    );
    await expect(failure.tagName).toBe('P');
    // Same red as the validation branch, so an infrastructure failure and a
    // business rule are the same sentence in the same place to a reader.
    const heading = within(dialog).getByRole('heading', { name: 'Change status' });
    await waitFor(() =>
      expect(getComputedStyle(failure).color).not.toBe(getComputedStyle(heading).color)
    );

    // `finally` releases the frame: the label comes back and the picker answers
    // again, which is what makes a retry possible without reopening.
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Update' })).toBeEnabled()
    );
    const trigger = within(dialog).getByRole('button', { name: 'Companion status: Archived' });
    await expect(getComputedStyle(trigger).pointerEvents).toBe('auto');
    await expect(document.querySelector('dialog[open]')).not.toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A failed write. The dialog stays open on the chosen status so the press can be repeated ' +
          'without re-answering the picker.',
      },
    },
  },
};

export const NoChange: Story = {
  name: 'Update without changing anything',
  play: async ({ canvasElement, args }) => {
    const dialog = await openDialog(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update' }));

    // `currentStatus === selectedStatus` short-circuits before `canTransition`
    // and before the write: the dialog just closes.
    await waitFor(() => expect(document.querySelector('dialog[open]')).toBeNull());
    await expect(args.onSave).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The no-op. It is indistinguishable from a successful save at the call site - same close, ' +
          'no toast, no error - which is why the terminal-status callers guard the dialog rather ' +
          'than the button.',
      },
    },
  },
};
