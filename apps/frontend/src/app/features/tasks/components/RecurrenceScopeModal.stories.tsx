import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import RecurrenceScopeModal from './RecurrenceScopeModal';

type ScopeModalProps = ComponentProps<typeof RecurrenceScopeModal>;

/**
 * Consumers mount this fresh when a recurring task is edited or deleted and
 * unmount it on dismissal - which is what resets the choice back to `THIS`,
 * since the component keeps no effect to re-sync it. The harness reproduces
 * that lifecycle, and keeps the dialog off the docs page at rest where
 * `ModalBase`'s shared body scroll lock would otherwise stay held.
 */
const ScopeFlowHarness = ({
  showModal: _showModal,
  setShowModal: _set,
  ...args
}: ScopeModalProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[420px] items-start p-6">
      <button
        type="button"
        className="rounded-2xl bg-[var(--cta)] px-6 py-3 text-body-3-emphasis text-[var(--cta-text)]"
        onClick={() => setOpen(true)}
      >
        Open scope chooser
      </button>
      {open && <RecurrenceScopeModal {...args} showModal setShowModal={setOpen} />}
    </div>
  );
};

const openDialog = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Open scope chooser' }));
  const dialog = document.body.querySelector('dialog.yc-modal-dialog') as HTMLElement | null;
  await expect(dialog).toBeInTheDocument();
  return dialog as HTMLElement;
};

const meta = {
  title: 'Tasks/RecurrenceScopeModal',
  component: RecurrenceScopeModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The question every calendar asks before it touches a repeating task: does this apply to ' +
          'one occurrence, this one and everything after it, or the whole series? It is shared by ' +
          'the /tasks module, the Quick Actions panel and the workspace inpatient schedule, so one ' +
          'unreviewed rendering here is the same dialog on three surfaces - and it had no story at ' +
          'all.\n\n' +
          'It cannot simply be rendered: `CenterModal` `createPortal`s it to `document.body`, so it ' +
          'exists only while a parent keeps it mounted with `showModal` set. Every story below ' +
          'drives it through a trigger and asserts the dialog has its three options and both ' +
          'actions, rather than that a portal appeared.\n\n' +
          'The choice has no default beyond `THIS`, and **selection is carried by colour alone**: ' +
          'the chosen row swaps `border-card-border text-text-secondary` for ' +
          '`border-input-border-active bg-card-hover text-text-primary`. There is no check mark and ' +
          'no other affordance, so if that class swap regresses the dialog still works and simply ' +
          'stops telling anyone what it is about to do. The stories assert the class moves.\n\n' +
          'Wording is the other half. `action` flips the heading, the confirm label and one word in ' +
          'the prompt - "deletion" against "change" - and the task name is interpolated into the ' +
          'sentence in quotes, so a long name rewraps the paragraph and pushes the ' +
          '`grid grid-cols-2` action row down inside the 500px dialog. Both wordings are drawn here ' +
          'because only one of them was ever seen in review.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    action: 'edit',
    taskName: 'Morning medication round',
    onConfirm: fn(),
  },
  render: (args) => <ScopeFlowHarness {...args} />,
} satisfies Meta<typeof RecurrenceScopeModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EditScope: Story = {
  name: 'Edit wording',
  play: async ({ canvasElement }) => {
    const dialog = within(await openDialog(canvasElement));
    await expect(dialog.getByRole('heading', { name: 'Edit recurring task' })).toBeInTheDocument();
    // Assert the dialog drew its prompt, all three options and both actions -
    // an empty portalled dialog would satisfy "a dialog appeared" on its own.
    await expect(
      dialog.getByText(/"Morning medication round" is part of a recurring series/)
    ).toBeInTheDocument();
    await expect(dialog.getByText(/Which tasks should this change apply to\?/)).toBeInTheDocument();
    await expect(dialog.getAllByRole('radio')).toHaveLength(3);
    await expect(dialog.getByRole('radio', { name: 'This task only' })).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The edit path: "Save changes" as the confirm, and the prompt asking which tasks the ' +
          '*change* applies to.',
      },
    },
  },
};

export const DeleteScope: Story = {
  name: 'Delete wording',
  args: { action: 'delete' },
  play: async ({ canvasElement }) => {
    const dialog = within(await openDialog(canvasElement));
    await expect(
      dialog.getByRole('heading', { name: 'Delete recurring task' })
    ).toBeInTheDocument();
    await expect(
      dialog.getByText(/Which tasks should this deletion apply to\?/)
    ).toBeInTheDocument();
    await expect(dialog.getAllByRole('radio')).toHaveLength(3);
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The destructive path. Only three words differ from the edit dialog and the confirm is the ' +
          'same `Primary` pill in the same place - there is no red, and no reordering, so the two ' +
          'are worth seeing side by side.',
      },
    },
  },
};

export const ScopeChanged: Story = {
  name: 'Choosing "this and following"',
  play: async ({ canvasElement, args }) => {
    const dialog = within(await openDialog(canvasElement));
    const following = dialog.getByRole('radio', { name: 'This and following tasks' });
    await userEvent.click(following);
    await expect(following).toBeChecked();
    await expect(dialog.getByRole('radio', { name: 'This task only' })).not.toBeChecked();
    // Selection is signalled by the row's fill and border, nothing else, so
    // assert the class swap actually moved with the choice.
    await expect(following.closest('label')).toHaveClass('bg-card-hover');
    await userEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
    await expect(args.onConfirm).toHaveBeenCalledWith('THIS_AND_FOLLOWING');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The middle option, and the frame where the selected-row treatment is visible against two ' +
          'unselected ones. Confirming does not close the dialog: `onConfirm` is all it does, and ' +
          'the caller decides what happens next.',
      },
    },
  },
};

export const Busy: Story = {
  name: 'Working (confirm in flight)',
  args: { busy: true, action: 'delete' },
  play: async ({ canvasElement }) => {
    const dialog = within(await openDialog(canvasElement));
    const confirm = dialog.getByRole('button', { name: 'Working…' });
    await expect(confirm).toBeDisabled();
    // Only the confirm locks; Cancel and the radios stay live, which is the
    // detail this frame exists to show.
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    await expect(dialog.getByRole('radio', { name: 'All tasks in the series' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'While the scoped operation runs, the confirm relabels to "Working…" and disables. The ' +
          'label is driven by a prop rather than by the promise, so this state is only reachable ' +
          'from the outside - and had never been rendered.',
      },
    },
  },
};

export const NoTaskName: Story = {
  name: 'No task name',
  args: { taskName: undefined },
  play: async ({ canvasElement }) => {
    const dialog = within(await openDialog(canvasElement));
    await expect(dialog.getByText(/This is a recurring task\./)).toBeInTheDocument();
    await expect(dialog.getAllByRole('radio')).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The fallback sentence when the caller has no name to quote. It is a different first ' +
          'clause, not a truncated one, so the paragraph is a line shorter and the options sit ' +
          'higher in the dialog.',
      },
    },
  },
};

export const LongTaskName: Story = {
  name: 'Long task name',
  args: {
    taskName: 'Post-operative analgesia review and owner call-back for the orthopaedic ward',
  },
  play: async ({ canvasElement }) => {
    const dialog = within(await openDialog(canvasElement));
    // The name is interpolated mid-sentence in quotes, so it rewraps the
    // paragraph rather than truncating - the only way to see the dialog grow.
    await expect(
      dialog.getByText(
        /"Post-operative analgesia review and owner call-back for the orthopaedic ward" is part of a recurring series/
      )
    ).toBeInTheDocument();
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Task names are user-entered. The prompt wraps to three lines and pushes the option list ' +
          'and the two-column action row down, which is the shape of layout defect this sweep ' +
          'exists to make visible.',
      },
    },
  },
};
