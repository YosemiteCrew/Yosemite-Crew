import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import type { Option } from '@/app/features/companions/types/companion';
import type { Task } from '@/app/features/tasks/types/task';
import TaskFormFields from './TaskFormFields';

type TaskFormFieldsProps = React.ComponentProps<typeof TaskFormFields>;

/**
 * A fixed instant, deliberately mid-day UTC. The pickers render in the preferred
 * timezone, which is Europe/Berlin with no timezone token stored, so 12:00Z is
 * still 12 March in every zone a reviewer is likely to be in - a midnight fixture
 * would flip the date and the story would fail by geography.
 */
const DUE_AT = new Date('2026-03-12T12:00:00.000Z');

const task = (over: Partial<Task> = {}): Task => ({
  _id: 'task-analgesia',
  organisationId: 'org-storybook',
  assignedTo: 'practitioner-ravi',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'MEDICATION',
  priority: 'HIGH',
  name: 'Midday analgesia round',
  description: 'Meloxicam 0.1mg/kg PO, then recheck the incision site.',
  recurrence: { type: 'ONCE', isMaster: false },
  dueAt: DUE_AT,
  status: 'PENDING',
  ...over,
});

const TEMPLATE_OPTIONS: Option[] = [
  { label: 'Post-op analgesia round', value: 'template-analgesia' },
  { label: 'Daily wound check', value: 'template-wound' },
];

const ASSIGNEE_OPTIONS: Option[] = [
  { label: 'Dr. Elena Marsh', value: 'practitioner-elena' },
  { label: 'Dr. Ravi Patel', value: 'practitioner-ravi' },
];

const AUDIENCE_OPTIONS: Option[] = [
  { label: 'Staff task', value: 'EMPLOYEE_TASK' },
  { label: 'Pet parent task', value: 'PARENT_TASK' },
];

const PARENT_OPTIONS: Option[] = [{ label: 'Marta Nowak', value: 'parent-marta' }];

/**
 * Every field writes through `setFormData` / `setDue` / `setDueTimeValue`, which the
 * real consumers get from `useTaskForm`. Holding that state here keeps the fields
 * editable without pulling in the hook - and the hook is what fetches templates on
 * mount, so this also keeps the stories off the network.
 *
 * The box is a fixed width so the layouts can be compared side by side, but it does
 * NOT drive them: both grids are `grid-cols-1 sm:grid-cols-N`, and `sm` is a
 * viewport query, so they collapse when the browser narrows and ignore this box
 * entirely.
 */
const FormHarness = ({
  formData: initialFormData,
  setFormData: _setFormData,
  due: initialDue,
  setDue: _setDue,
  dueTimeValue: initialDueTimeValue,
  setDueTimeValue: _setDueTimeValue,
  ...rest
}: TaskFormFieldsProps) => {
  const [formData, setFormData] = useState<Task>(initialFormData);
  const [due, setDue] = useState<Date | null>(initialDue);
  const [dueTimeValue, setDueTimeValue] = useState(initialDueTimeValue);

  return (
    <div data-fields-host className="w-[600px] max-w-full bg-[var(--screen)] p-4">
      <TaskFormFields
        {...rest}
        formData={formData}
        setFormData={setFormData}
        due={due}
        setDue={setDue}
        dueTimeValue={dueTimeValue}
        setDueTimeValue={setDueTimeValue}
      />
    </div>
  );
};

/**
 * The component's own root, taken as the harness's only child rather than by class.
 * All three branches return a different wrapper (`gap-3` for the stack, `gap-3.5`
 * for both dialog layouts), so a class selector would have to change per story and
 * would silently match nothing the day a gap is retuned.
 */
const fieldRoot = (canvasElement: HTMLElement): HTMLElement =>
  (canvasElement.querySelector('[data-fields-host]') as HTMLElement)
    .firstElementChild as HTMLElement;

/** Field labels in render order, one entry per direct child of the root. */
const fieldOrder = (canvasElement: HTMLElement): string[] =>
  [...fieldRoot(canvasElement).children].map((child) => child.textContent ?? '');

/** Resolved grid tracks for one row of a dialog layout. */
const tracks = (row: Element): string[] =>
  getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/);

const meta = {
  title: 'Tasks/TaskFormFields',
  component: TaskFormFields,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The shared field set behind every task form in PIMS - the tasks drawer, the New task ' +
          'dialog, the appointment workspace panel and the companion drawer all render this one ' +
          'component and differ only in the props they pass.\n\n' +
          'It has **three mutually exclusive layouts**, chosen by two booleans:\n\n' +
          '- neither flag: the single-column stack every side panel uses;\n' +
          '- `twoColumn`: Category + assignee share a row and Due date / Time / Repeat share ' +
          'another. **No consumer passes this on its own today**, so it is a live branch nothing ' +
          'in the product exercises;\n' +
          '- `twoColumn` + `assigneeChips`: the New task dialog, where the chip row replaces the ' +
          'two dropdowns.\n\n' +
          'The third one is the trap. In that branch the audience and assignee dropdowns are ' +
          '**never rendered at all** - not hidden, not disabled - so a caller that passes ' +
          '`showAssigneeSelect` alongside `assigneeChips` silently loses the dropdown it asked ' +
          'for. The chips are the only assignee control, and their error slot is the only place ' +
          '`formDataErrors.assignedTo` can surface.\n\n' +
          'Two fields are conditional rather than positional. **End date appears only while the ' +
          'task repeats** (`recurrence.type !== ONCE`), and it lands in a different place in ' +
          'each branch - last in the two stacks, but *above* Instructions in the chips layout. ' +
          '**The template picker disappears** when `hideTemplatePicker` is set or ' +
          '`templateOptions` is empty, and those two paths are indistinguishable in the output.\n\n' +
          'Errors are reported inconsistently by the underlying inputs, which is the one ' +
          'accessibility fact worth knowing here: the task name, due date and time errors are ' +
          '`role="alert"`, while the category and assignee errors come from `LabelDropdown` and ' +
          'are announced to nobody. The same `dueAt` error is also passed to two fields, so it ' +
          'renders - and is announced - twice.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    formData: task(),
    setFormData: fn(),
    formDataErrors: {},
    templateOptions: TEMPLATE_OPTIONS,
    due: DUE_AT,
    setDue: fn(),
    dueTimeValue: '13:00',
    setDueTimeValue: fn(),
    onSelectTemplate: fn(),
  },
  render: (args) => <FormHarness {...args} />,
} satisfies Meta<typeof TaskFormFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SidePanelStack: Story = {
  name: 'Single column - the side panels',
  args: { showAssigneeSelect: true, assigneeOptions: ASSIGNEE_OPTIONS, onAssigneeSelect: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = fieldRoot(canvasElement);

    /* One column, and nothing inside it is a grid. Both halves matter: the flex
       direction is what the drawer relies on, and the absence of a grid child is
       what separates this branch from the dialog ones - a stray `twoColumn` would
       keep the direction and change the row grouping. */
    await expect(getComputedStyle(root).flexDirection).toBe('column');
    for (const child of root.children) {
      await expect(getComputedStyle(child).display).not.toBe('grid');
    }

    /* Ten fields in render order. The audience dropdown is absent because
       `showAudienceSelect` is not set, and End date is absent because the task does
       not repeat - the two nulls are why this is 10 and not 12. */
    const order = fieldOrder(canvasElement);
    await expect(order).toHaveLength(10);
    await expect(order[0]).toContain('Assigned to');
    await expect(order[1]).toContain('Load from template (optional)');
    await expect(order[2]).toContain('Category');
    await expect(order[3]).toContain('Priority');
    await expect(order[4]).toContain('Task');
    await expect(order[5]).toContain('Instructions (optional)');
    await expect(order[6]).toContain('Due date');
    await expect(order[7]).toContain('Time');
    await expect(order[8]).toContain('Reminder (optional)');
    await expect(order[9]).toContain('Repeat');

    /* The values come from `formData`, not from the fields' own defaults, and the
       dropdowns resolve stored codes against their option lists rather than
       printing the raw enum - `MEDICATION` would be the visible failure. */
    await expect(canvas.getByRole('textbox', { name: 'Task' })).toHaveValue(
      'Midday analgesia round'
    );
    await expect(canvas.getByRole('button', { name: 'Category: Medication' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Assigned to: Dr. Ravi Patel' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Repeat: Does not repeat' })
    ).toBeInTheDocument();
    await expect(canvas.queryByText('MEDICATION')).not.toBeInTheDocument();
  },
};

export const DialogTwoColumn: Story = {
  name: 'Two column - the branch nothing ships',
  args: {
    twoColumn: true,
    showAudienceSelect: true,
    audienceOptions: AUDIENCE_OPTIONS,
    onAudienceSelect: fn(),
    showAssigneeSelect: true,
    assigneeOptions: ASSIGNEE_OPTIONS,
    onAssigneeSelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const order = fieldOrder(canvasElement);

    /* Eight children, two of which are grid rows holding two and three fields.
       This is the only branch that renders BOTH dropdowns and pairs them, so the
       count is the quickest way to notice it has silently fallen back to the
       stack. */
    await expect(order).toHaveLength(8);
    await expect(order[0]).toContain('Type');
    await expect(order[1]).toContain('Load from template (optional)');
    await expect(order[2]).toContain('Task');
    await expect(order[4]).toContain('Priority');
    await expect(order[6]).toContain('Reminder (optional)');
    await expect(order[7]).toContain('Instructions (optional)');

    /* Measured tracks, not class names. `grid-cols-1 sm:grid-cols-2` resolves to
       one track below 640px, so reading the class would report a two-column layout
       on a phone where the fields are actually stacked. */
    const pairRow = fieldRoot(canvasElement).children[3];
    const tripleRow = fieldRoot(canvasElement).children[5];
    await expect(tracks(pairRow)).toHaveLength(2);
    await expect(tracks(tripleRow)).toHaveLength(3);
    await expect(pairRow.textContent).toContain('Category');
    await expect(pairRow.textContent).toContain('Assigned to');

    // Paired means side by side, which is the whole claim: same top, different left.
    const [category, assignee] = [...pairRow.children].map((child) =>
      child.getBoundingClientRect()
    );
    await expect(Math.round(category.top)).toBe(Math.round(assignee.top));
    await expect(category.left).toBeLessThan(assignee.left);

    // Priority is NOT in a row here - it sits alone between the two grids, unlike
    // the chips layout where it pairs with Reminder.
    await expect(getComputedStyle(fieldRoot(canvasElement).children[4]).display).not.toBe('grid');
    await expect(canvas.getByRole('button', { name: 'Priority: High' })).toBeInTheDocument();
  },
};

export const NewTaskChips: Story = {
  name: 'Two column with assignee chips - the New task dialog',
  args: {
    twoColumn: true,
    assigneeChips: true,
    teamOptions: ASSIGNEE_OPTIONS,
    parentOptions: PARENT_OPTIONS,
    onSelectTeam: fn(),
    onSelectParent: fn(),
    // Set on purpose, and ignored by this branch. See the assertion below.
    showAudienceSelect: true,
    audienceOptions: AUDIENCE_OPTIONS,
    showAssigneeSelect: true,
    assigneeOptions: ASSIGNEE_OPTIONS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const order = fieldOrder(canvasElement);

    await expect(order).toHaveLength(7);
    await expect(order[0]).toContain('Load from template (optional)');
    await expect(order[1]).toContain('Task');
    await expect(order[2]).toContain('Category');
    await expect(order[3]).toContain('Assign to');
    await expect(order[6]).toContain('Instructions (optional)');

    /* The branch ignores both dropdown flags. `showAudienceSelect` and
       `showAssigneeSelect` are true in these args and neither control exists - a
       caller migrating a surface to the chips would see its assignee dropdown
       vanish with no warning, which is exactly the silent case worth pinning. */
    await expect(canvas.queryByText('Type')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Assigned to')).not.toBeInTheDocument();
    await expect(canvas.getByText('Assign to')).toBeInTheDocument();

    /* Exactly one chip is pressed, and it is the team chip for the task's current
       assignee - `audience` decides which list the selection is read against, so a
       parent whose id happened to match would NOT light up here. Matched on the
       pressed state and the text rather than the accessible name, because the
       monogram avatar is not `aria-hidden` and folds its initials into the name. */
    const chipRow = fieldRoot(canvasElement).children[3] as HTMLElement;
    const pressed = within(chipRow).getAllByRole('button', { pressed: true });
    await expect(pressed).toHaveLength(1);
    await expect(pressed[0]).toHaveTextContent('Dr. Ravi Patel');
    await expect(within(chipRow).getAllByRole('button')).toHaveLength(3);

    /* Due / Time / Repeat share a three-track row and Priority / Reminder a
       two-track one - the demotion of the secondary controls below the core fields
       is the difference between this layout and the plain `twoColumn` one. */
    await expect(tracks(fieldRoot(canvasElement).children[4])).toHaveLength(3);
    await expect(tracks(fieldRoot(canvasElement).children[5])).toHaveLength(2);
    await expect(fieldRoot(canvasElement).children[5].textContent).toContain('Priority');
    await expect(fieldRoot(canvasElement).children[5].textContent).toContain('Reminder (optional)');
    await expect(canvas.getByRole('button', { name: 'Time: 13:00' })).toBeInTheDocument();
  },
};

export const RecurringAddsEndDate: Story = {
  name: 'A repeating task grows an End date field',
  args: {
    formData: task({
      name: 'Twice-daily wound check',
      recurrence: { type: 'DAILY', isMaster: true },
    }),
    formDataErrors: { endDate: 'End date must be on or after the due date' },
    twoColumn: true,
    assigneeChips: true,
    teamOptions: ASSIGNEE_OPTIONS,
    parentOptions: PARENT_OPTIONS,
    onSelectTeam: fn(),
    onSelectParent: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const order = fieldOrder(canvasElement);

    /* One more child than the same layout with a one-off task, and it is NOT last:
       in this branch End date lands above Instructions, while the stack and the
       plain two-column layout both append it at the very end. The field is derived
       from `recurrence`, so the only route to it is changing Repeat. */
    await expect(order).toHaveLength(8);
    await expect(order[6]).toContain('End date');
    await expect(order[7]).toContain('Instructions (optional)');
    await expect(canvas.getByRole('button', { name: 'Repeat: Daily' })).toBeInTheDocument();

    // The error belongs to the End date field itself, not to a form-level line.
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent('End date must be on or after the due date');
    await expect(fieldRoot(canvasElement).children[6]).toContainElement(alert);

    /* Empty rather than pre-filled. The task has a due date and a recurrence, and
       the boundary is still blank - so the first save after switching Repeat on
       always bounces on this field. */
    await expect(
      canvas.getByRole('button', { name: 'End date, toggle calendar' })
    ).toBeInTheDocument();
  },
};

export const ValidationErrors: Story = {
  name: 'Validation errors, and which ones are announced',
  args: {
    formData: task({ name: '', category: '', assignedTo: '' }),
    formDataErrors: {
      name: 'Name is required',
      category: 'Category is required',
      assignedTo: 'Please select a companion or staff',
      dueAt: 'Due date and time are required',
    },
    showAssigneeSelect: true,
    assigneeOptions: ASSIGNEE_OPTIONS,
    onAssigneeSelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Every message is on screen, in the exact wording `validateTaskForm` produces.
    await expect(canvas.getByText('Name is required')).toBeInTheDocument();
    await expect(canvas.getByText('Category is required')).toBeInTheDocument();
    await expect(canvas.getByText('Please select a companion or staff')).toBeInTheDocument();

    /* One error, two fields. `formDataErrors.dueAt` is handed to the Datepicker AND
       the Timepicker, so the same sentence is printed twice and announced twice -
       which is a deliberate trade (either field can be the broken one) but reads as
       a duplication bug if you meet it in a screenshot. */
    await expect(canvas.getAllByText('Due date and time are required')).toHaveLength(2);

    /* Three alerts, not five. The task name, due date and time errors are
       `role="alert"`; the category and assignee errors come from `LabelDropdown`,
       which renders them as plain text - visible, red, and announced to nobody.
       Asserted as a count so that fixing the dropdown flips this deliberately
       rather than passing quietly. */
    const alerts = canvas.getAllByRole('alert');
    await expect(alerts).toHaveLength(3);
    await expect(canvas.getByText('Category is required').closest('[role="alert"]')).toBeNull();
    await expect(
      canvas.getByText('Please select a companion or staff').closest('[role="alert"]')
    ).toBeNull();
    await expect(canvas.getByText('Name is required').closest('[role="alert"]')).not.toBeNull();

    // The empty task name is a real empty input, not a placeholder-shaped value.
    await expect(canvas.getByRole('textbox', { name: 'Task' })).toHaveValue('');
  },
};

export const WithoutTemplatePicker: Story = {
  name: 'No template picker when editing',
  args: {
    hideTemplatePicker: true,
    showAssigneeSelect: true,
    assigneeOptions: ASSIGNEE_OPTIONS,
    onAssigneeSelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const order = fieldOrder(canvasElement);

    /* Nine fields where the side-panel story has ten, with the same props apart
       from this flag. `templateOptions` is still fully populated here - the panel
       hides the picker while EDITING, because re-applying a template would
       overwrite the record being edited. An empty `templateOptions` produces the
       identical output, so the absence of the field says nothing about which of
       the two happened. */
    await expect(order).toHaveLength(9);
    await expect(canvas.queryByText('Load from template (optional)')).not.toBeInTheDocument();
    await expect(order[0]).toContain('Assigned to');
    await expect(order[1]).toContain('Category');
  },
};
