import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { Task } from '@/app/features/tasks/types/task';
import RescheduleTask from './Reschedule';

type RescheduleTaskProps = ComponentProps<typeof RescheduleTask>;

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
  // A fixed instant. `getPreferredTimeZone` falls back to Europe/Berlin whenever no
  // timezone token is stored, so 12:00 UTC renders as 13:00 on every machine and the
  // labels below do not drift with the reviewer's clock.
  dueAt: new Date('2026-03-12T12:00:00.000Z'),
  recurrence: { type: 'ONCE', isMaster: false },
  status: 'PENDING',
  ...over,
});

/**
 * The tasks page mounts this dialog on demand and unmounts it on dismissal. Copying
 * that lifecycle keeps the docs page free of several simultaneously open dialogs,
 * each holding a share of `ModalBase`'s ref-counted body scroll lock.
 */
const RescheduleHarness = ({
  showModal: _showModal,
  setShowModal: _setShowModal,
  ...args
}: RescheduleTaskProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[460px] items-start bg-[var(--screen)] p-6">
      <button
        type="button"
        className="rounded-2xl bg-[var(--cta)] px-6 py-3 text-body-3-emphasis text-[var(--cta-text)]"
        onClick={() => setOpen(true)}
      >
        Open reschedule
      </button>
      {open && <RescheduleTask {...args} showModal setShowModal={setOpen} />}
    </div>
  );
};

/**
 * Opens the dialog and returns it.
 *
 * Matched on `dialog[open]` rather than a class: `ModalBase` leaves a dismissed dialog
 * MOUNTED and only drops the `open` attribute, so a class lookup can return a panel
 * that is no longer on screen. It portals to `document.body` as well, so nothing it
 * renders is inside `canvasElement`.
 *
 * The LAST open dialog is taken, not the first: the autodocs page shares one
 * `document.body` across every story, and portals append in mount order.
 */
const openDialog = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Open reschedule' }));
  return waitFor(() => {
    const dialogs = document.querySelectorAll('dialog[open]');
    expect(dialogs.length).toBeGreaterThan(0);
    return dialogs[dialogs.length - 1] as HTMLElement;
  });
};

/**
 * Every dialog currently open, oldest first.
 *
 * Counted against a baseline taken at the start of each play function rather than
 * asserted absolutely: the autodocs page renders every story into one `document.body`,
 * so a dialog another story opened is still there. Deltas hold in both that mode and
 * the isolated one the test runner uses.
 */
const openDialogs = (): HTMLElement[] =>
  [...document.querySelectorAll('dialog[open]')] as HTMLElement[];

const meta = {
  title: 'Tasks/RescheduleTask',
  component: RescheduleTask,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The dialog that moves a task to another day, opened from the task list, the board and ' +
          'the week agenda. It had no story at all.\n\n' +
          'It is a `CenterModal` - not the shared `Modal` - which matters more than it sounds: ' +
          '`CenterModal` is `w-[90%] sm:w-[500px]` and has **no phone branch**. Below 768px it ' +
          'does not become a bottom sheet the way `Modal variant="centered"` does; it stays a ' +
          'centred panel at 90% of the viewport. The phone story below is the only place that ' +
          'difference is visible.\n\n' +
          'The body is three parts: a `ModalHeader`, a `Datepicker` + `Timepicker` pair in a ' +
          'single-column grid, and a centred Cancel/Update row. The two pickers are the whole ' +
          'form - there is no reason field, no notification toggle and no preview of the new ' +
          'time.\n\n' +
          'Two things happen on Update that no static reading shows. A task in a **recurring ' +
          'series** does not save at all: `handleSave` stashes the new instant in a ref and opens ' +
          '`RecurrenceScopeModal` on top, so the reader is asked which occurrences the move ' +
          'applies to before anything is written. And a **completed or cancelled task** is ' +
          'refused: `canRescheduleTask` returns false, a warning toast fires and the dialog ' +
          'closes, leaving the task where it was. Both are drawn below.\n\n' +
          'What is NOT drawn: the button\'s `saving` -> "Saving..." swap. `saving` is internal ' +
          'state that is true only while `updateTask` is in flight, and holding that frame open ' +
          'needs request mocking, which this Storybook has no wiring for. The same swap IS ' +
          'reviewable in **Tasks/TaskFormBody -> Saving**, where the flag arrives as an ' +
          '`isLoading` prop and can be pinned.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    activeTask: task(),
  },
  render: (args) => <RescheduleHarness {...args} />,
} satisfies Meta<typeof RescheduleTask>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reschedule: Story = {
  name: 'The reschedule panel',
  play: async ({ canvasElement }) => {
    const baseline = openDialogs().length;
    const dialog = await openDialog(canvasElement);
    const panel = within(dialog);

    await expect(panel.getByRole('heading', { name: 'Reschedule' })).toBeInTheDocument();

    /* 500px, the `sm:` width. Measured with getBoundingClientRect - that is the border
       box, and getComputedStyle().width would report the content box and come back
       short by the panel's 1px border on each side. */
    await expect(Math.round(dialog.getBoundingClientRect().width)).toBe(500);

    /* The dialog has NO accessible name. `CenterModal` accepts `ariaLabel` and
       `ariaLabelledBy` and this caller passes neither, so a screen reader announces
       "dialog" while "Reschedule" sits in 17px bold at the top. Asserted rather than
       described, so that wiring the header up removes this line instead of leaving it
       silently stale. */
    await expect(dialog).not.toHaveAttribute('aria-label');
    await expect(dialog).not.toHaveAttribute('aria-labelledby');

    /* Both pickers are seeded from `activeTask.dueAt`, and they render in the
       PREFERRED timezone rather than in UTC - 13:00 for a 12:00 UTC instant with no
       timezone token stored. Reading them back is the only proof the seeding survived
       the two `useState` initialisers and the render-phase re-sync guard. */
    await expect(
      panel.getByRole('button', { name: 'Due date: Mar 12, 2026, toggle calendar' })
    ).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Due time: 13:00' })).toBeInTheDocument();

    /* Two children, stacked. The pair is a bare `grid gap-3` - no column count at all,
       at any breakpoint - so the date sits ABOVE the time at 500px exactly as it does
       at 375. The markup states that only by omission, and `gridTemplateColumns`
       resolves to "none" for implicit tracks, so it is asserted geometrically instead:
       same left edge, same width, second row below the first. */
    const pickers = panel.getByText('Due date').closest('.grid') as HTMLElement;
    await expect(pickers.children).toHaveLength(2);
    await expect(pickers.children[1]).toContainElement(
      panel.getByRole('button', { name: 'Due time: 13:00' })
    );
    const dateBox = pickers.children[0].getBoundingClientRect();
    const timeBox = pickers.children[1].getBoundingClientRect();
    await expect(Math.round(timeBox.left)).toBe(Math.round(dateBox.left));
    await expect(Math.round(timeBox.width)).toBe(Math.round(dateBox.width));
    await expect(timeBox.top).toBeGreaterThanOrEqual(dateBox.bottom);

    /* Cancel and Update share one line and are equal-width `min-w-[120px]` pills, with
       Update on the right. Compared by measured geometry rather than by DOM order,
       because the row is `justify-center flex-wrap` - the thing that gives out first
       is the wrap, and a DOM-order check would pass with the buttons stacked. */
    const cancel = panel.getByRole('button', { name: 'Cancel' });
    const update = panel.getByRole('button', { name: 'Update' });
    await expect(cancel).toBeEnabled();
    await expect(update).toBeEnabled();
    await expect(cancel.getBoundingClientRect().top).toBe(update.getBoundingClientRect().top);
    await expect(update.getBoundingClientRect().left).toBeGreaterThan(
      cancel.getBoundingClientRect().right
    );
    await expect(cancel.getBoundingClientRect().width).toBeGreaterThanOrEqual(120);
    await expect(update.getBoundingClientRect().width).toBeGreaterThanOrEqual(120);

    // One dialog, not two: the recurrence scope chooser is not mounted at rest.
    await expect(openDialogs()).toHaveLength(baseline + 1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole panel. Note what is missing as much as what is here: no reason, no note to ' +
          'the assignee, and no "was Mar 12, now Mar 14" confirmation - the reader has to remember ' +
          'the old date themselves, because the picker has already overwritten it.',
      },
    },
  },
};

export const SeriesTaskAsksForScope: Story = {
  name: 'A recurring task asks which occurrences',
  args: {
    activeTask: task({
      name: 'Twice-daily wound check',
      recurrence: { type: 'DAILY', isMaster: true },
    }),
  },
  play: async ({ canvasElement }) => {
    const baseline = openDialogs().length;
    const dialog = await openDialog(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update' }));

    /* Nothing was saved. `handleSave` recognises the series, stashes the computed
       instant in `pendingDueAtRef` and opens the scope chooser instead - so this click
       reaches no API at all, which is what makes the frame stable enough to draw. */
    await waitFor(() => {
      expect(openDialogs()).toHaveLength(baseline + 2);
    });
    const scope = within(openDialogs().at(-1) as HTMLElement);
    await expect(scope.getByRole('heading', { name: 'Edit recurring task' })).toBeInTheDocument();

    /* The prompt names the task, so the reader knows which series they are about to
       move - the reschedule panel behind it does not show the task name anywhere. */
    await expect(
      scope.getByText(
        '"Twice-daily wound check" is part of a recurring series. Which tasks should this change apply to?'
      )
    ).toBeInTheDocument();

    /* Three options, in order, with the narrowest pre-selected. The default matters:
       it is the difference between moving tomorrow's dose and moving every remaining
       dose, and the dialog commits it on a single click of "Save changes". */
    const options = scope.getAllByRole('radio');
    await expect(options).toHaveLength(3);
    await expect(scope.getByRole('radio', { name: 'This task only' })).toBeChecked();
    await expect(scope.getByRole('radio', { name: 'This and following tasks' })).not.toBeChecked();
    await expect(scope.getByRole('radio', { name: 'All tasks in the series' })).not.toBeChecked();

    // The reschedule panel stays open UNDERNEATH, still holding the new date, so
    // cancelling the scope question returns the reader to their edit rather than
    // discarding it.
    await expect(
      within(dialog).getByRole('button', { name: 'Due date: Mar 12, 2026, toggle calendar' })
    ).toBeInTheDocument();
    await expect(scope.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two stacked dialogs, which is the only place in the reschedule flow that happens. ' +
          '`ModalBase` keeps a stack so Escape and the backdrop only dismiss the topmost one - ' +
          'without that, closing the scope question would take the reschedule panel with it and ' +
          'lose the date the reader just picked.\n\n' +
          'This story stops before "Save changes". Confirming calls `updateTask`, which POSTs, ' +
          'and this Storybook has no request mocking.',
      },
    },
  },
};

export const CompletedTaskIsRefused: Story = {
  name: 'A completed task cannot be moved',
  args: { activeTask: task({ status: 'COMPLETED' }) },
  play: async ({ canvasElement }) => {
    const baseline = openDialogs().length;
    const dialog = await openDialog(canvasElement);

    /* The dialog opens fully editable for a task that cannot be rescheduled: both
       pickers are live, Update is enabled, and nothing is greyed. The guard lives in
       `handleSave`, not in the render, so the refusal only arrives after the reader
       has chosen a new date and pressed the button. */
    await expect(
      within(dialog).getByRole('button', { name: 'Due date: Mar 12, 2026, toggle calendar' })
    ).toBeInTheDocument();
    const update = within(dialog).getByRole('button', { name: 'Update' });
    await expect(update).toBeEnabled();

    await userEvent.click(update);

    /* `canRescheduleTask` rejects COMPLETED and CANCELLED, fires a warning toast and
       closes - with no write and no explanation left on screen once the toast expires.
       The harness unmounts the dialog on close, matching the real consumers, so the
       closed panel is gone rather than merely inert. */
    await waitFor(() => {
      expect(openDialogs()).toHaveLength(baseline);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dead end. `canShowTaskRescheduleAction` in the callers is what should keep this ' +
          'dialog shut for a finished task, so reaching this frame means a caller let it through - ' +
          'and the only feedback is a toast that has vanished by the time anyone asks what ' +
          'happened.',
      },
    },
  },
};

export const CancelClosesWithoutAWrite: Story = {
  name: 'Cancel closes without a write',
  play: async ({ canvasElement }) => {
    const baseline = openDialogs().length;
    const dialog = await openDialog(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(openDialogs()).toHaveLength(baseline);
    });

    // Reopening reads the task's own due date again: nothing was written and nothing
    // was carried over.
    const reopened = await openDialog(canvasElement);
    await expect(
      within(reopened).getByRole('button', { name: 'Due date: Mar 12, 2026, toggle calendar' })
    ).toBeInTheDocument();
    await expect(
      within(reopened).getByRole('button', { name: 'Due time: 13:00' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What this frame does NOT prove: `handleCancel` also resets `selectedDate` and ' +
          '`dueTimeValue` back to the task before closing, but the consumers - and this harness ' +
          'with them - unmount the dialog on dismissal, so the reopened one is a fresh mount ' +
          'whichever way that reset behaves. The reset only matters to a caller that keeps the ' +
          'dialog mounted and toggles `showModal`, and there is no such caller today.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375): still a centred panel',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10: a story using it still renders, still plays and still passes -
  // at the full panel width, under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const panel = within(dialog);

    /* `CenterModal` is `w-[90%] sm:w-[500px]`, and `sm` is 640px - so below the tablet
       breakpoint this is NOT the phone sheet that `Modal variant="centered"` re-forms
       into. It is the same centred panel narrowed to 90% of the viewport, and there is
       no grabber. Computed against the live viewport rather than written as 337.5, so
       the number states the RULE and cannot drift with the preset's pixel width. */
    const viewportWidth = document.documentElement.clientWidth;
    await expect(viewportWidth).toBeLessThanOrEqual(430);
    await expect(Math.round(dialog.getBoundingClientRect().width)).toBe(
      Math.round(viewportWidth * 0.9)
    );
    await expect(dialog.className).not.toContain('yc-phone-sheet');
    await expect(dialog.querySelector('.yc-phone-sheet-grabber')).toBeNull();

    // The pickers still stack, and both fill the panel's content box exactly -
    // measured off the dialog's own padding and border rather than a hardcoded
    // number, so this states the rule (`w-full` all the way down) not a pixel count.
    const panelStyle = getComputedStyle(dialog);
    const inset =
      Number.parseFloat(panelStyle.paddingLeft) +
      Number.parseFloat(panelStyle.paddingRight) +
      Number.parseFloat(panelStyle.borderLeftWidth) +
      Number.parseFloat(panelStyle.borderRightWidth);
    const dueDate = panel.getByRole('button', { name: 'Due date: Mar 12, 2026, toggle calendar' });
    await expect(Math.round(dueDate.getBoundingClientRect().width)).toBe(
      Math.round(dialog.getBoundingClientRect().width - inset)
    );

    // The two pills still share one line at this width. `flex-wrap` is what would give
    // out first, and a visibility check would pass either way.
    const cancel = panel.getByRole('button', { name: 'Cancel' });
    const update = panel.getByRole('button', { name: 'Update' });
    await expect(cancel.getBoundingClientRect().top).toBe(update.getBoundingClientRect().top);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Tasks are triaged on phones more than anywhere else, and rescheduling is the most ' +
          'common thing done to one. This panel is the reason to check rather than assume: it is ' +
          'the shared modal that does NOT re-form into a sheet, so it is the only task dialog that ' +
          'still floats at 375px.',
      },
    },
  },
};
