import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import type { Task } from '@/app/features/tasks/types/task';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import TasksPanel from './TasksPanel';

const APPOINTMENT_ID = 'appt-workspace-1';

const DRESSING = 'Change surgical dressing';
const WEIGH = 'Weigh and record';

/**
 * Two real tasks in the shared task store, which is the ONLY place this panel
 * reads its rows from - the workspace schedule and this panel render the same
 * objects on purpose.
 *
 * `dueAt` is fixed so the row's "Due:" line and the details Duration row are
 * stable, though both are formatted in the viewer's locale and timezone, so the
 * stories assert the labels rather than the rendered timestamps.
 */
const DRESSING_TASK: Task = {
  _id: 'task-dressing',
  appointmentId: APPOINTMENT_ID,
  assignedTo: 'staff-nadia',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'CARE',
  name: DRESSING,
  description: 'Remove the old dressing, clean with saline, re-wrap.',
  dueAt: new Date('2026-03-12T14:00:00.000Z'),
  status: 'PENDING',
  recurrence: {
    type: 'WEEKLY',
    isMaster: true,
    endDate: new Date('2026-04-09T14:00:00.000Z'),
  },
  reminder: { enabled: true, offsetMinutes: 30 },
};

const WEIGH_TASK: Task = {
  _id: 'task-weigh',
  appointmentId: APPOINTMENT_ID,
  assignedTo: 'staff-nadia',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'DIAGNOSTIC',
  name: WEIGH,
  dueAt: new Date('2026-03-12T15:30:00.000Z'),
  status: 'IN_PROGRESS',
};

const ENCOUNTER: AppointmentEncounter = {
  appointmentId: APPOINTMENT_ID,
  mode: 'INPATIENT',
  consultationType: 'Post-op inpatient',
  leadId: 'prac-amara',
  leadName: 'Dr. Amara Weber',
  alerts: [],
  soap: [],
  soapTemplates: [],
  vitals: [],
  observations: [],
  diagnosticTests: [],
  diagnosticOrders: [],
  services: [],
  prescription: [],
  schedule: [],
  invoiceLineItems: [],
  pastInvoices: [],
  depositCents: 0,
  currency: 'USD',
  withdrawDeposit: false,
  taxPercent: 0,
  overallDiscountPercent: 0,
  dischargeSummary: '',
  documents: [],
  readyForBilling: { value: false },
  readyForDischarge: { value: false },
  stepStatus: {
    SOAP: 'COMPLETED',
    DIAGNOSTICS: 'IN_PROGRESS',
    TREATMENT: 'IN_PROGRESS',
    PASSPORT: 'EMPTY',
    INVOICE: 'EMPTY',
    SUMMARY: 'EMPTY',
  },
  viewOnly: false,
};

/**
 * `TasksPanel` returns `null` outright without an encounter, so the seed is what
 * makes the panel exist at all.
 *
 * Leaving `primaryOrgId` null is deliberate and is the whole offline seam:
 * `loadTasksForPrimaryOrg` and `useLoadTeam` both return at their first line
 * without one, so the mount reads the seeded store and never fetches. The cost
 * is an empty assignee list, which is what the "Assigned to" dropdowns show
 * here.
 */
const seed = (tasks: Task[] = [DRESSING_TASK, WEIGH_TASK]) => {
  useOrgStore.setState({ primaryOrgId: null });
  useTaskStore.setState({
    tasksById: Object.fromEntries(tasks.map((task) => [task._id, task])),
    taskIdsByOrgId: {},
    status: 'loaded',
  });
  useAppointmentWorkspaceStore.setState({
    encountersById: { [APPOINTMENT_ID]: ENCOUNTER },
    focusTaskId: null,
  });
};

/**
 * The value span of one "Task details" row. `DetailRow` renders label and value as
 * two sibling spans, so the value is the label's next sibling - there is no test id
 * and no role, and matching the value text directly would assert nothing about which
 * label it belongs to.
 */
const detailValue = (panel: HTMLElement, label: string): HTMLElement =>
  within(panel).getByText(label).nextElementSibling as HTMLElement;

const meta = {
  title: 'Workspace/TasksPanel',
  component: TasksPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Quick Actions tasks panel. Two of its three states had never been drawn, and both ' +
          'replace content rather than adding to it.\n\n' +
          '**The per-row "Task details" breakdown** is a local `TaskDetails` block gated on ' +
          '`expandedRowId`, opened by the dark eye button on the row. It reads the BACKING `Task` ' +
          'from the store, not the flattened `ScheduleTask` the row renders, so it is the only ' +
          'place repeat, reminder and the recurrence end date appear at all.\n\n' +
          '**The form swap** is a whole-panel replacement: `if (formOpen) return <PanelTaskForm/>` ' +
          'happens before the tab strip and the list are rendered, so New Task and Edit take the ' +
          'panel over completely. That is easy to miss reading the file and impossible to see in a ' +
          'snapshot of the list. From the form, editing a task in a recurring series opens ' +
          '`RecurrenceScopeModal` - a second, portalled layer on top of the swapped panel.\n\n' +
          'Everything here runs off a seeded task store with no primary org, which is the ' +
          'condition under which every loader in this file returns at its first line. The one ' +
          'request that is not org-gated is the task-template list behind the form; it is fired ' +
          'and its rejection is swallowed by `Promise.allSettled`, so the form renders with an ' +
          'empty template picker instead of stalling.\n\n' +
          'What is NOT drawn here: the form\'s `editError` line ("Unable to update task. Please ' +
          'try again."). It is set only when `updateTask` REJECTS, and `updateTask` returns at ' +
          'its first line without a primary org - the same absence that keeps the rest of this ' +
          'file offline. Reaching it would need a primary org plus a stubbed failing PATCH, and ' +
          'this repo has no request-stub wiring.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointmentId: APPOINTMENT_ID,
    companionId: 'companion-1',
  },
  decorators: [
    (Story) => (
      <div className="w-[440px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    seed();
  },
} satisfies Meta<typeof TasksPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RowDetailsExpanded: Story = {
  name: 'Row details expanded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(DRESSING)).toBeInTheDocument();
    await expect(canvas.queryByText('Task details')).not.toBeInTheDocument();

    // The eye button's label carries the row name, which is what keeps the two
    // rows' toggles apart for a screen reader and for this query.
    await userEvent.click(canvas.getByRole('button', { name: `View ${DRESSING}` }));

    const details = (await canvas.findByText('Task details')).parentElement as HTMLElement;

    /* Five rows for this task, with every value resolved through the taxonomy rather
       than printed raw: CARE -> "Care", a WEEKLY master with no cron -> "Weekly",
       30 minutes -> the reminder option's own label. Asserting the values is the
       point - a details block that rendered every label against an em-dash would
       satisfy a presence check. */
    await expect(detailValue(details, 'Category')).toHaveTextContent('Care');
    await expect(detailValue(details, 'Repeat')).toHaveTextContent('Weekly');
    await expect(detailValue(details, 'Reminder')).toHaveTextContent('30 minutes before');
    // Duration is a joined range, so it renders only on a task that has both a due
    // date and a recurrence end date. The two dates are locale-formatted, so the
    // join is what is asserted, not the rendered days.
    await expect(detailValue(details, 'Duration').textContent).toContain(' - ');
    await expect(detailValue(details, 'Instructions')).toHaveTextContent(
      'Remove the old dressing, clean with saline, re-wrap.'
    );

    /* "Assigned by" is a sixth DetailRow that can never render: `TaskRow` is the only
       caller of `TaskDetails` and it never passes `assignedByName`, so the row is
       dead code today. Asserted so that the day someone wires it up, this story is
       what notices. */
    await expect(within(details).queryByText('Assigned by')).not.toBeInTheDocument();

    // Exactly one row is expandable at a time: the other task stays collapsed.
    await expect(canvas.getAllByText('Task details')).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: `View ${WEIGH}` })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The read-only breakdown under one row: a `rounded-2xl` inset card of label/value rows ' +
          'separated by hairlines, with the last border removed. It is the only surface in the ' +
          "panel that shows a task's repeat and reminder settings without opening the editor.",
      },
    },
  },
};

export const RowDetailsToggleClosed: Story = {
  name: 'Row details toggle back off',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `View ${DRESSING}` }));
    expect(await canvas.findByText('Task details')).toBeInTheDocument();

    /* The icon and the accessible name both swap on expand (eye -> eye-off), so
       the closing click has to be found under the other name. A story that reused
       the "View ..." query here would fail to find the button and never close it. */
    const hide = canvas.getByRole('button', { name: `Hide details for ${DRESSING}` });
    await userEvent.click(hide);

    await waitFor(() => {
      expect(canvas.queryByText('Task details')).not.toBeInTheDocument();
    });
    await expect(canvas.getByRole('button', { name: `View ${DRESSING}` })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`expandedRowId` is a single id, not a set, so the toggle is genuinely exclusive and the ' +
          'same button closes what it opened under a different name.',
      },
    },
  },
};

export const NewTaskForm: Story = {
  name: 'New Task takes over the panel',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('tab')).toHaveLength(2);

    await userEvent.click(canvas.getByRole('button', { name: 'New Task' }));

    expect(await canvas.findByRole('heading', { name: 'New task' })).toBeInTheDocument();
    /* The list and the tab strip are GONE, not covered: the early return replaces
       the whole panel body. This is the assertion that separates a swap from an
       overlay, and it is the thing the source makes hardest to see. */
    await expect(canvas.queryAllByRole('tab')).toHaveLength(0);
    await expect(canvas.queryByText(DRESSING)).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'New Task' })).not.toBeInTheDocument();

    await expect(canvas.getByRole('button', { name: 'Back to tasks' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save task' })).toBeInTheDocument();

    // A fresh form, not a seeded one: the Task field is empty on New.
    await expect(canvas.queryByDisplayValue(DRESSING)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'New Task replaces the tab strip, the list and its own button with the shared ' +
          '`TaskFormFields` form plus a back arrow. The same form is used by the /tasks module, so ' +
          'this is the panel-width rendering of it - single column, not the two-column dialog grid.',
      },
    },
  },
};

export const EditSeedsTheForm: Story = {
  name: 'Edit seeds the form',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `Edit ${DRESSING}` }));

    expect(await canvas.findByRole('heading', { name: 'Edit task' })).toBeInTheDocument();
    // Seeded from the backing Task in the store, not from the flattened row.
    await expect(canvas.getByDisplayValue(DRESSING)).toBeInTheDocument();
    await expect(
      canvas.getByDisplayValue('Remove the old dressing, clean with saline, re-wrap.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Edit routes through the same `PanelTaskForm`, with the heading and the template picker ' +
          "as the only differences. `openEdit` prefers the store's real `Task`; a schedule row " +
          'with no backing task falls back to a hand-built draft, which is why the seeded values ' +
          'are worth asserting rather than assumed.',
      },
    },
  },
};

export const RecurrenceScopeChoice: Story = {
  name: 'Recurring edit asks for a scope',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `Edit ${DRESSING}` }));
    expect(await canvas.findByRole('heading', { name: 'Edit task' })).toBeInTheDocument();
    await expect(document.querySelector('dialog[open]')).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: 'Save task' }));

    /* The modal is portalled to document.body by ModalBase, so it is outside
       canvasElement entirely, and a closed dialog stays mounted without its `open`
       attribute - absence has to be asserted against `dialog[open]`, as above. */
    await waitFor(() => {
      expect(document.querySelector('dialog[open]')).not.toBeNull();
    });
    const dialog = within(document.querySelector('dialog[open]') as HTMLElement);

    await expect(dialog.getByText(/is part of a recurring series/)).toHaveTextContent(
      `"${DRESSING}" is part of a recurring series.`
    );
    const scopes = dialog.getAllByRole('radio');
    await expect(scopes).toHaveLength(3);
    await expect(dialog.getByLabelText('This task only')).toBeChecked();
    await expect(dialog.getByLabelText('This and following tasks')).not.toBeChecked();
    await expect(dialog.getByLabelText('All tasks in the series')).not.toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Saving an edit to a task that belongs to a series stops and asks which occurrences the ' +
          'change applies to, the way a calendar does. It appears only for a series task - the ' +
          'other row in this panel saves straight through - and it is gated behind the form swap, ' +
          'so it sits two interactions deep and had never been rendered from this entry point.',
      },
    },
  },
};

export const EmptyPanel: Story = {
  name: 'No tasks yet',
  beforeEach: () => {
    seed([]);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No tasks yet.')).toBeInTheDocument();
    // Empty list, but the panel still offers its one action.
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
    await expect(canvas.getByRole('button', { name: 'New Task' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state for an appointment with nothing scheduled, kept next to the populated ' +
          'stories so the difference between "no tasks" and "tasks failed to load" is visible: ' +
          'this panel has no loading or error state of its own, so both look identical here.',
      },
    },
  },
};
