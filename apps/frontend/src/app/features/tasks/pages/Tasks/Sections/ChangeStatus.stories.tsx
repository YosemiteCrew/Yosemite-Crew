import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { Task } from '@/app/features/tasks/types/task';
import ChangeTaskStatus from './ChangeStatus';

type ChangeTaskStatusProps = ComponentProps<typeof ChangeTaskStatus>;

const task = (over: Partial<Task> = {}): Task => ({
  _id: 'task-analgesia',
  organisationId: 'org-storybook',
  assignedBy: 'practitioner-elena',
  assignedTo: 'practitioner-ravi',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'MEDICATION',
  priority: 'HIGH',
  name: 'Midday analgesia round',
  // Fixed instant: `getPreferredTimeZone` returns Europe/Berlin whenever no
  // timezone token is stored, so every label below is machine-independent.
  dueAt: new Date('2026-03-12T12:00:00.000Z'),
  status: 'PENDING',
  ...over,
});

/**
 * The consumers (the board's drag handler, the task list's quick action) mount this
 * on demand and unmount it on dismissal. The harness reproduces that lifecycle and
 * keeps the dialog off the docs page at rest, where `ModalBase`'s shared body scroll
 * lock would otherwise be held by five open dialogs at once.
 */
const StatusFlowHarness = ({
  showModal: _showModal,
  setShowModal: _setShowModal,
  ...args
}: ChangeTaskStatusProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[420px] items-start p-6">
      <button
        type="button"
        className="rounded-2xl bg-[var(--cta)] px-6 py-3 text-body-3-emphasis text-[var(--cta-text)]"
        onClick={() => setOpen(true)}
      >
        Open status chooser
      </button>
      {open && <ChangeTaskStatus {...args} showModal setShowModal={setOpen} />}
    </div>
  );
};

/**
 * Opens the chooser and returns the live dialog.
 *
 * Matched on `dialog[open]` rather than on the panel class: `ModalBase` leaves a
 * dismissed dialog MOUNTED and merely drops the `open` attribute, so a class
 * lookup can return a dialog that is no longer on screen.
 */
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
 * Opens the status menu and returns the panel.
 *
 * `LabelDropdown` portals its panel to `document.body`, so it is outside both the
 * canvas and the dialog. The LAST match is taken rather than the first: a panel
 * left open by an earlier story on the docs page is still in the body, and
 * `querySelector` would happily return that one and assert against stale options.
 */
const openStatusMenu = async (dialog: HTMLElement, currentLabel: string) => {
  await userEvent.click(
    within(dialog).getByRole('button', { name: `Task status: ${currentLabel}` })
  );
  return waitFor(() => {
    const panels = document.querySelectorAll('[data-portal-dropdown]');
    expect(panels.length).toBeGreaterThan(0);
    return panels[panels.length - 1] as HTMLElement;
  });
};

/** Every option the menu is currently offering, in render order. */
const menuOptions = (panel: HTMLElement): string[] =>
  [...panel.querySelectorAll('button')].map((option) => (option.textContent ?? '').trim());

const meta = {
  title: 'Tasks/ChangeTaskStatus',
  component: ChangeTaskStatus,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The status chooser a task is moved with, from the board, the week agenda and the task ' +
          'list. It is a thin wrapper: everything visible comes from the shared ' +
          '`ChangeStatusModal`, and what this file contributes is the **option list**, computed ' +
          'from the task taxonomy as `{current status} + getAllowedTaskStatusTransitions(current)`.\n\n' +
          'That computation is the whole reason it needs stories. The transition table is ' +
          'directional and lossy - `PENDING` can go anywhere, `IN_PROGRESS` can only move forward ' +
          'to Completed or Cancelled, and both terminal states allow nothing at all - so the same ' +
          'dialog offers four options, three options or exactly one depending on the task it was ' +
          'opened for. Nothing in the markup announces which case a reviewer is looking at, and ' +
          'until now none of the three had ever been rendered.\n\n' +
          'The menu itself is a `LabelDropdown` with `searchable={false}` that `createPortal`s its ' +
          'panel to `document.body`, so the options are not inside the dialog and not inside the ' +
          'canvas. They only exist after a click on the trigger, which is why every story here ' +
          'opens it rather than trusting the resting trigger label alone.\n\n' +
          '`preferredStatus` is the other half. Callers that already know where the task is going ' +
          '(a card dropped onto the Completed column) pass it so the dialog opens pre-answered, ' +
          'and `resolveSelectedStatus` silently falls back to the current status when that ' +
          'preference is not a legal move. A regression there is invisible: the dialog still ' +
          'opens, it just quietly proposes the wrong thing.\n\n' +
          'No story here presses **Update**. Saving calls `changeTaskStatus`, which writes to the ' +
          'task store and POSTs, and this Storybook has no request mocking - the stories stop at ' +
          'the last frame before the write.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    activeTask: task(),
    preferredStatus: null,
  },
  render: (args) => <StatusFlowHarness {...args} />,
} satisfies Meta<typeof ChangeTaskStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingTask: Story = {
  name: 'Pending - every move is legal',
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(
      within(dialog).getByRole('heading', { name: 'Change status' })
    ).toBeInTheDocument();

    const panel = await openStatusMenu(dialog, 'Pending');
    // The point of the story is WHICH options exist, not that a panel appeared:
    // an empty panel, or one built from the full TaskStatusOptions list ignoring
    // the transition table, would both satisfy "the menu opened".
    await expect(menuOptions(panel)).toEqual(['Pending', 'In Progress', 'Completed', 'Cancelled']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A pending task is the only case where the menu is the whole status list. Every other ' +
          'story below is this same dialog with rows missing.',
      },
    },
  },
};

export const InProgressTask: Story = {
  name: 'In progress - no way back to Pending',
  args: { activeTask: task({ status: 'IN_PROGRESS' }) },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(
      within(dialog).getByRole('button', { name: 'Task status: In Progress' })
    ).toBeInTheDocument();

    const panel = await openStatusMenu(dialog, 'In Progress');
    await expect(menuOptions(panel)).toEqual(['In Progress', 'Completed', 'Cancelled']);
    // Asserted explicitly, not just implied by the count: "Pending is gone" is the
    // behaviour, and a four-option regression would still pass a length check that
    // was written as `toBeGreaterThan`.
    await expect(menuOptions(panel)).not.toContain('Pending');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Started work cannot be un-started. The dialog looks identical to the pending one - same ' +
          'height, same trigger, same two actions - and the only difference is a row that is not ' +
          'in the portalled menu.',
      },
    },
  },
};

export const TerminalTask: Story = {
  name: 'Completed - the menu has one row',
  args: { activeTask: task({ status: 'COMPLETED' }) },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const panel = await openStatusMenu(dialog, 'Completed');
    await expect(menuOptions(panel)).toEqual(['Completed']);

    // The dead end is the point of the story, so it is asserted rather than only
    // described: the dialog offers a full Cancel/Update pair, both live, over a
    // menu that cannot change anything. Nothing in the frame is disabled or
    // greyed, which is exactly what makes it easy to miss.
    await expect(within(dialog).getByRole('button', { name: 'Update' })).toBeEnabled();
    await expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    await expect(
      within(dialog).getByRole('button', { name: 'Task status: Completed' })
    ).toHaveAttribute('aria-haspopup', 'listbox');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Completed and Cancelled allow no transitions, so the filter leaves only the status the ' +
          'task already has. The dialog still opens with a live Update button, because the guard ' +
          'that should keep it shut lives in the CALLERS ' +
          '(`canShowTaskStatusChangeAction`) rather than here - press it and `handleSave` ' +
          'short-circuits on `currentStatus === selectedStatus` and just closes. Worth a look: ' +
          'this is a dead-end dialog that presents itself as an editable one.',
      },
    },
  },
};

export const PreferredStatus: Story = {
  name: 'Pre-answered by the caller',
  args: { activeTask: task(), preferredStatus: 'COMPLETED' },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    // Pre-selection is carried ONLY by the trigger label - there is no highlight,
    // no badge and no second affordance - so this one string is the entire signal
    // that the caller's intent survived into the dialog.
    await expect(
      within(dialog).getByRole('button', { name: 'Task status: Completed' })
    ).toBeInTheDocument();
    await expect(
      within(dialog).queryByRole('button', { name: 'Task status: Pending' })
    ).not.toBeInTheDocument();

    // The pre-selection must not narrow the menu. Options are filtered from the
    // task's CURRENT status, so a pending task pre-answered as Completed still
    // offers all four - the reader can overrule the drop they just made. A
    // regression that filtered from the preference instead would leave a
    // one-row menu here and still satisfy the trigger-label check above.
    const panel = await openStatusMenu(dialog, 'Completed');
    await expect(menuOptions(panel)).toEqual(['Pending', 'In Progress', 'Completed', 'Cancelled']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a card dropped onto the Completed column opens: the destination is already chosen ' +
          'and the reader only has to confirm it. The menu behind it is unchanged - every move ' +
          'legal from Pending is still on offer, so the drop is a proposal rather than a decision.',
      },
    },
  },
};

export const PreferredStatusRejected: Story = {
  name: 'Illegal preference falls back',
  args: { activeTask: task({ status: 'IN_PROGRESS' }), preferredStatus: 'PENDING' },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    // Pending is neither a legal move from IN_PROGRESS nor present in the filtered
    // options, so `resolveSelectedStatus` drops it and keeps the current status.
    await expect(
      within(dialog).getByRole('button', { name: 'Task status: In Progress' })
    ).toBeInTheDocument();

    const panel = await openStatusMenu(dialog, 'In Progress');
    await expect(menuOptions(panel)).toEqual(['In Progress', 'Completed', 'Cancelled']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A caller asking for an impossible move gets no error and no explanation - the dialog ' +
          'opens on the current status as if nothing had been requested. That silence is the ' +
          'behaviour under review here: the only way to notice it is to compare this frame with ' +
          'the pre-answered one above.',
      },
    },
  },
};

export const ChoosingAStatus: Story = {
  name: 'Choosing a status',
  args: { activeTask: task() },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const panel = await openStatusMenu(dialog, 'Pending');

    await userEvent.click(within(panel).getByRole('button', { name: 'Completed' }));

    // The selection moves the trigger label and closes the panel. Both matter:
    // `LabelDropdown` keeps its own `internalSelected`, so a controlled parent
    // that never echoes the value back would leave the label stale.
    await waitFor(() =>
      expect(document.querySelectorAll('[data-portal-dropdown]')).toHaveLength(0)
    );
    await expect(
      within(dialog).getByRole('button', { name: 'Task status: Completed' })
    ).toBeInTheDocument();
    // Choosing is not committing: the dialog stays open on its Cancel/Update pair.
    await expect(document.querySelector('dialog[open]')).not.toBeNull();
    await expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled();
    await expect(within(dialog).getByRole('button', { name: 'Update' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The frame between opening and saving, which is where the dialog spends most of its ' +
          'life and which no snapshot had ever contained.',
      },
    },
  },
};

export const CancelLeavesTheTask: Story = {
  name: 'Cancel closes without a write',
  args: { activeTask: task() },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);

    // Move the selection first, so Cancel has something to abandon. Cancelling an
    // untouched dialog would close either way and prove nothing about discarding.
    const panel = await openStatusMenu(dialog, 'Pending');
    await userEvent.click(within(panel).getByRole('button', { name: 'Cancelled' }));
    await expect(
      within(dialog).getByRole('button', { name: 'Task status: Cancelled' })
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    // A closed modal stays MOUNTED without its `open` attribute whenever the parent
    // keeps rendering it, so absence has to be asserted against `dialog[open]`.
    // Here the harness unmounts it as well, which is the real consumer's lifecycle.
    await waitFor(() => expect(document.querySelector('dialog[open]')).toBeNull());

    // Reopening reads Pending again, and the whole menu is back: the abandoned
    // choice reached neither the task nor the next dialog.
    const reopened = await openDialog(canvasElement);
    await expect(
      within(reopened).getByRole('button', { name: 'Task status: Pending' })
    ).toBeInTheDocument();
    const reopenedPanel = await openStatusMenu(reopened, 'Pending');
    await expect(menuOptions(reopenedPanel)).toEqual([
      'Pending',
      'In Progress',
      'Completed',
      'Cancelled',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A status is chosen, then abandoned. Nothing is written and the task is still Pending ' +
          'when the dialog comes back.\n\n' +
          'Note what this frame does NOT prove. `handleCancel` also resets `selectedStatus` back ' +
          'to the current status, but the consumers - and this harness with them - unmount the ' +
          'dialog on dismissal, so the reopened one is a fresh mount whichever way that reset ' +
          'behaves. The reset only matters to a caller that keeps the dialog mounted and toggles ' +
          '`showModal`, and there is no such caller today.',
      },
    },
  },
};

export const PhoneWidth: Story = {
  name: 'Phone (375)',
  args: { activeTask: task() },
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10: it still type-checks and still runs, and silently renders the
  // desktop width under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);

    // `CenterModal` is `w-[90%] sm:w-[500px]`, and `sm` is 640px - so below the
    // tablet breakpoint this dialog does NOT re-form into the phone sheet that
    // `Modal variant="centered"` gets. It is the same centered panel, narrowed to
    // 90% of the viewport, which is the detail this frame exists to show.
    // Computed against the live viewport rather than written as 337.5, so the
    // number states the RULE and cannot drift with the preset's pixel width.
    const viewportWidth = document.documentElement.clientWidth;
    const width = dialog.getBoundingClientRect().width;
    await expect(Math.round(width)).toBe(Math.round(viewportWidth * 0.9));

    // The action row is `flex-wrap` with two `min-w-30` pills. At this width they
    // still share one line - the claim worth checking, since wrapping is the first
    // thing that gives out and a visibility check would pass either way.
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const update = within(dialog).getByRole('button', { name: 'Update' });
    await expect(cancel.getBoundingClientRect().top).toBe(update.getBoundingClientRect().top);
    await expect(update.getBoundingClientRect().left).toBeGreaterThan(
      cancel.getBoundingClientRect().right
    );

    // And the trigger fills the panel's content box exactly - measured off the
    // dialog's own padding and border rather than against a hardcoded number, so
    // this states the rule (`w-full` all the way down) instead of a pixel count.
    const trigger = within(dialog).getByRole('button', { name: 'Task status: Pending' });
    const panelStyle = getComputedStyle(dialog);
    const inset =
      Number.parseFloat(panelStyle.paddingLeft) +
      Number.parseFloat(panelStyle.paddingRight) +
      Number.parseFloat(panelStyle.borderLeftWidth) +
      Number.parseFloat(panelStyle.borderRightWidth);
    await expect(Math.round(trigger.getBoundingClientRect().width)).toBe(Math.round(width - inset));
  },
  parameters: {
    docs: {
      description: {
        story:
          'Tasks are triaged on phones more than anywhere else, and this dialog is the control ' +
          'that does it. Nothing about it is phone-specific, which is exactly why it is worth ' +
          'drawing at 375 rather than assuming.',
      },
    },
  },
};
