import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, waitFor, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import type { Option } from '@/app/features/companions/types/companion';
import type { Task } from '@/app/features/tasks/types/task';
import { useOrgStore } from '@/app/stores/orgStore';
import TaskFormBody from './TaskFormBody';

type TaskFormBodyProps = ComponentProps<typeof TaskFormBody>;

const ORG_ID = 'org-storybook';

const membership = (over: Partial<UserOrganization> = {}): UserOrganization => ({
  id: 'membership-1',
  practitionerReference: 'Practitioner/practitioner-elena',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
  ...over,
});

/**
 * Seeds the one store the gate reads. `usePermissions` derives the permission list
 * from `roleCode` + extras - revocations on every render; nothing here fetches, so
 * this is the whole of the setup and the gate under review is the real one.
 *
 * `status` matters as much as the membership: the gate treats `idle` and `loading`
 * as "still resolving" and renders its `skeleton` instead of either branch.
 */
const seedPermissions = (over: Partial<UserOrganization> = {}) => {
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: membership(over) },
    status: 'loaded',
  });
};

/**
 * A fixed instant. `getPreferredTimeZone` falls back to Europe/Berlin whenever no
 * timezone token is stored, so 12:00 UTC on 12 March renders as 13:00 on every
 * machine rather than drifting with the reviewer's clock.
 */
const DUE_AT = new Date('2026-03-12T12:00:00.000Z');

const task = (over: Partial<Task> = {}): Task => ({
  _id: 'task-analgesia',
  organisationId: ORG_ID,
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

const ASSIGNEE_OPTIONS: Option[] = [
  { label: 'Dr. Elena Marsh', value: 'practitioner-elena' },
  { label: 'Dr. Ravi Patel', value: 'practitioner-ravi' },
];

/**
 * The body is a controlled form: every field writes through `setFormData` / `setDue` /
 * `setDueTimeValue`, which the real consumers get from `useTaskForm`. Holding that
 * state here keeps the fields editable in the docs page without pulling in the hook -
 * and the hook is what fetches templates on mount, so this also keeps the stories off
 * the network entirely.
 */
const FormHarness = ({
  formData: initialFormData,
  setFormData: _setFormData,
  due: initialDue,
  setDue: _setDue,
  dueTimeValue: initialDueTimeValue,
  setDueTimeValue: _setDueTimeValue,
  ...rest
}: TaskFormBodyProps) => {
  const [formData, setFormData] = useState<Task>(initialFormData);
  const [due, setDue] = useState<Date | null>(initialDue);
  const [dueTimeValue, setDueTimeValue] = useState(initialDueTimeValue);

  return (
    // 470px is the `md` drawer the side-panel consumers put this body in, less its
    // padding. The stack is single-column at every width, but the width still decides
    // where the labels truncate.
    <div className="flex min-h-[640px] w-[446px] max-w-full flex-col bg-[var(--screen)] p-3">
      <TaskFormBody
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

/** The stacked field list inside the accordion, which is the layout under review. */
const fieldStack = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('.flex.flex-col.gap-3') as HTMLElement;

const meta = {
  title: 'Tasks/TaskFormBody',
  component: TaskFormBody,
  parameters: {
    layout: 'fullscreen',
    // `Fallback` renders `PermissionDeniedState`, which calls next/navigation's
    // useRouter during render for its "Request access" route.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The shared task form body, used by the task drawer and the appointment workspace ' +
          'panel. It is four things stacked: a `PermissionGate`, an `Accordion` titled "Task", ' +
          '`TaskFormFields` in its single-column form, and a footer holding the error line and ' +
          'the Save button.\n\n' +
          'None of it had ever been drawn, and the gate is the reason it matters. ' +
          '`PermissionGate allOf={[TASKS_EDIT_ANY]}` has **three** outcomes, not two: permitted ' +
          'renders the form, denied renders `Fallback`, and *still resolving* renders the default ' +
          '`skeleton`, which is `null`. So a reader whose org membership has not loaded yet sees ' +
          'an entirely blank panel - no form, no notice, no spinner - and nothing in the markup ' +
          'distinguishes that from a denial except the absence of the denial.\n\n' +
          'The footer holds a second surprise: **"Save as template" is rendered on every mount ' +
          'with `className="hidden"`**. It is in the DOM, it is wired to ' +
          '`handleCreateTemplate`, and it is invisible. The stories assert it is display:none ' +
          'rather than quietly ignoring it, because "hidden" and "removed" are very different ' +
          'things for a control that still runs a POST when something focuses and activates it.\n\n' +
          'Two query traps worth knowing before writing more stories here. **"Task" names two ' +
          'different controls**: the accordion header is a `button` labelled "Task", the task-name ' +
          'field is a `textbox` labelled "Task", and only the role tells them apart. And the ' +
          'hidden template action **has no accessible name at all** - accname returns the empty ' +
          "string for a `display: none` element, and `getByRole`'s `hidden: true` does not change " +
          'that, so it has to be reached by text.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    formData: task(),
    setFormData: fn(),
    due: DUE_AT,
    setDue: fn(),
    dueTimeValue: '13:00',
    setDueTimeValue: fn(),
    formDataErrors: {},
    error: null,
    isLoading: false,
    templateOptions: [],
    selectTemplate: fn(),
    handleCreate: fn(),
    handleCreateTemplate: fn(),
  },
  beforeEach: () => {
    seedPermissions();
  },
  render: (args) => <FormHarness {...args} />,
} satisfies Meta<typeof TaskFormBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Permitted: Story = {
  name: 'Permitted - the whole body',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The accordion opens itself (`defaultOpen`) and its edit affordance is
    // suppressed (`showEditIcon={false} isEditing`), so the header is one button.
    const header = canvas.getByRole('button', { name: 'Task' });
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.queryByRole('button', { name: 'Edit Task' })).not.toBeInTheDocument();

    /* Eight fields in one column. Both halves are asserted: the count says every field
       mounted, and the flex direction says they stack rather than sharing rows - this
       body deliberately does NOT pass `twoColumn`, which is the whole difference
       between it and the New task dialog's grid. */
    const stack = fieldStack(canvasElement);
    await expect(getComputedStyle(stack).flexDirection).toBe('column');
    await expect(stack.children).toHaveLength(8);

    // Named in render order, so a reordering shows up here rather than in a screenshot.
    const labels = [...stack.children].map((field) => field.textContent ?? '');
    await expect(labels[0]).toContain('Category');
    await expect(labels[1]).toContain('Priority');
    await expect(labels[2]).toContain('Task');
    await expect(labels[3]).toContain('Instructions (optional)');
    await expect(labels[4]).toContain('Due date');
    await expect(labels[5]).toContain('Time');
    await expect(labels[6]).toContain('Reminder (optional)');
    await expect(labels[7]).toContain('Repeat');

    // The values arrive from `formData`, not from the fields' own defaults.
    await expect(canvas.getByRole('textbox', { name: 'Task' })).toHaveValue(
      'Midday analgesia round'
    );
    await expect(canvas.getByRole('button', { name: 'Category: Medication' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Priority: High' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Repeat: Does not repeat' })
    ).toBeInTheDocument();
    // 13:00, not 12:00: the stored instant is UTC and the pickers render in the
    // preferred timezone, which is Europe/Berlin with no timezone token saved.
    await expect(canvas.getByRole('button', { name: 'Time: 13:00' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Due date: Mar 12, 2026, toggle calendar' })
    ).toBeInTheDocument();

    // No template picker: `templateOptions` is empty, so the field is absent rather
    // than an empty dropdown. That is why the stack is 8 and not 9.
    await expect(canvas.queryByText('Load from template (optional)')).not.toBeInTheDocument();

    /* Save is live and there is no error line above it. */
    const save = canvas.getByRole('button', { name: 'Save' });
    await expect(save).toBeEnabled();
    await expect(canvas.queryByRole('button', { name: 'Saving...' })).not.toBeInTheDocument();

    /* "Save as template" is NOT absent - it is shipped `hidden` on every mount. It
       still holds its click handler, which creates a template AND a task. Asserted as
       display:none rather than skipped, so that un-hiding it (or losing the class in a
       refactor) fails here instead of quietly adding a second write path to the form.

       Anchored on the TEXT and walked up with `closest`, never on
       `getByRole('button', { name: 'Save as template', hidden: true })`. That query
       cannot match and never could: accname step 2A returns the EMPTY STRING for a
       `display: none` element, and testing-library computes the name with
       `computeAccessibleName(element, { computedStyleSupportsPseudoElements })` - it
       does not forward `hidden`, so the option relaxes the a11y-tree filter and leaves
       the name empty. A painted-out control is therefore unreachable by name, which is
       exactly what the last assertion here pins. */
    const templateAction = canvas.getByText('Save as template').closest('button');
    await expect(templateAction?.tagName).toBe('BUTTON');
    await expect(templateAction?.classList.contains('hidden')).toBe(true);
    await expect(getComputedStyle(templateAction as HTMLElement).display).toBe('none');
    /* Painted out AND nameless. The button is a real, enabled, wired `<button>` that a
       programmatic click still fires - `handleCreateTemplate` POSTs - but no assistive
       technology and no name-based query can reach it. Both halves are asserted so that
       un-hiding it fails the display check AND flips this one. */
    await expect(
      canvas.queryByRole('button', { name: 'Save as template', hidden: true })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The permitted body at rest. Eight fields, one column, one live action - and one more ' +
          'action that is in the DOM but painted out.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Saving',
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The label and the disabled state are one prop, so they can never disagree -
       which is exactly why both are asserted: a refactor that split them would leave
       a button reading "Saving..." that still accepts a second click. */
    const save = canvas.getByRole('button', { name: 'Saving...' });
    await expect(save).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    // `isDisabled` also drops the pill to 60% and kills pointer events, so the frame
    // reads as busy rather than merely inert.
    await expect(save).toHaveClass('pointer-events-none');
    await expect(getComputedStyle(save).opacity).toBe('0.6');

    // The fields stay live during the write. Nothing disables them, so a reader can
    // keep typing into a form that is already being submitted.
    await expect(canvas.getByRole('textbox', { name: 'Task' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The frame between pressing Save and the API answering. It is prop-driven here, which ' +
          'is the only way to hold it still - in the app it lasts exactly as long as one POST.',
      },
    },
  },
};

export const SaveFailed: Story = {
  name: 'Save failed',
  args: { error: 'Failed to create task. Please try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The exact copy `useTaskForm` sets when `createTask` rejects.
    const error = canvas.getByText('Failed to create task. Please try again.');

    /* Resolved before the poll, never inside it: `resolveToken` appends a probe, and a
       DOM mutation inside a `waitFor` callback re-queues the MutationObserver forever
       instead of failing. */
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--color-text-error)';
    canvasElement.append(probe);
    const errorInk = getComputedStyle(probe).backgroundColor;
    probe.remove();
    await expect(errorInk).not.toBe('rgba(0, 0, 0, 0)');
    await waitFor(() => {
      expect(getComputedStyle(error).color).toBe(errorInk);
    });

    /* It sits ABOVE the action row and is centred, so on a narrow panel it pushes the
       Save button down rather than sitting beside it. Asserted geometrically because
       that shift is the thing a reviewer would notice and the class list would not
       tell them. */
    const save = canvas.getByRole('button', { name: 'Save' });
    await expect(error.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      save.getBoundingClientRect().top
    );

    // The form is fully usable again: nothing is disabled and the values survived.
    await expect(save).toBeEnabled();
    await expect(canvas.getByRole('textbox', { name: 'Task' })).toHaveValue(
      'Midday analgesia round'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'One sentence, no detail, no retry affordance beyond pressing Save again. It is the ' +
          'same string for every failure mode - a 400 from validation, a 500, or an offline ' +
          'browser all land here - which is worth knowing when triaging a report of it.',
      },
    },
  },
};

export const WithAssigneeDropdown: Story = {
  name: 'With the assignee dropdown',
  args: {
    showAssigneeSelect: true,
    assigneeOptions: ASSIGNEE_OPTIONS,
    onAssigneeSelect: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The assignee field is opt-in and lands FIRST in the stack, above Category -
       nine children now, not eight. Position matters here: the side panels turn this
       on and the New task dialog does not, so the two surfaces open on different
       first fields. */
    const stack = fieldStack(canvasElement);
    await expect(stack.children).toHaveLength(9);
    await expect(stack.children[0].textContent).toContain('Assigned to');

    // It resolves the current `assignedTo` against the options rather than showing the
    // raw id, which is the entire reason the options list is passed alongside it.
    await expect(
      canvas.getByRole('button', { name: 'Assigned to: Dr. Ravi Patel' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel consumers keep the plain dropdown. Only the New task dialog swapped it for ' +
          'the chip row, so both controls are live in the product at the same time and this is ' +
          'the one that has to keep working.',
      },
    },
  },
};

export const RepeatingTask: Story = {
  name: 'Repeating task adds an end date',
  args: {
    formData: task({
      name: 'Twice-daily wound check',
      recurrence: { type: 'DAILY', isMaster: true },
    }),
    formDataErrors: { endDate: 'End date is required for a repeating task' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* A ninth field appears at the BOTTOM once the recurrence stops being ONCE. It is
       derived from `formData.recurrence`, not from a separate toggle, so the only way
       to reach this layout is to change Repeat - and the field it adds is required. */
    const stack = fieldStack(canvasElement);
    await expect(stack.children).toHaveLength(9);
    await expect(stack.children[8].textContent).toContain('End date');
    await expect(canvas.getByRole('button', { name: 'Repeat: Daily' })).toBeInTheDocument();

    // The error is the validator's, and it renders on the End date field itself.
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent('End date is required for a repeating task');
    await expect(stack.children[8]).toContainElement(alert);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The field count changes with the data. A repeating task needs a boundary, so the form ' +
          'grows one row and immediately fails validation until it is filled - which means the ' +
          'first Save after switching Repeat to Daily always bounces.',
      },
    },
  },
};

export const Denied: Story = {
  name: 'Denied - tasks:edit:any revoked',
  beforeEach: () => {
    // A real membership with the one permission taken away, rather than a role with
    // no task rights at all: revocations are applied after the role baseline, and
    // that subtraction is the path most custom memberships take.
    seedPermissions({ revokedPermissions: ['tasks:edit:any'] });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The notice quotes the reader's REAL role, read from the membership - so the
       sentence changes per user and is worth reading in full rather than matching a
       fragment. Read off the element's text because the role and the "Request access"
       link are separate nodes inside it. */
    const notice = canvas.getByRole('status');
    await expect(notice).toHaveTextContent("Your role (Veterinarian) can't view this section.");
    await expect(canvas.getByRole('button', { name: 'Request access' })).toBeInTheDocument();

    // The body is gone entirely - not disabled, not read-only. Both the accordion and
    // the write action are checked, because a gate that leaked either one would still
    // render this notice above it.
    await expect(canvas.queryByRole('button', { name: 'Task' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    /* By TEXT, because the hidden action has no accessible name to query by (see
       Permitted) - a `queryByRole(..., { name: 'Save as template' })` here would have
       passed with the control fully present, which is the kind of assertion that reads
       like coverage and proves nothing. */
    await expect(canvas.queryByText('Save as template')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The compact inline denial, sized for a panel rather than the full-page card. It names ' +
          'the role and offers a route to Organization, which is the difference between this and ' +
          'the bare red "Not authorized" line it replaced.',
      },
    },
  },
};

export const PermissionsStillResolving: Story = {
  name: 'Permissions still resolving - a blank panel',
  beforeEach: () => {
    // No membership and `status: 'loading'`. `usePermissions` reports isLoading from
    // the store status alone, so this is the state during every cold page load.
    useOrgStore.setState({ primaryOrgId: null, membershipsByOrgId: {}, status: 'loading' });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Neither branch renders. `PermissionGate`'s `skeleton` defaults to `null` and this
       caller passes none, so the panel is genuinely EMPTY while permissions resolve -
       and it looks identical to a panel whose content failed to mount. Asserting the
       absence of BOTH branches is what makes this a state rather than a typo: checking
       only for the missing form would also pass on the denied story. */
    await expect(canvas.queryByRole('button', { name: 'Task' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Request access' })).not.toBeInTheDocument();

    /* Measured rather than only queried: the gate returns `null`, so the harness box
       that holds the panel has ZERO element children and no text of its own. A pile of
       absent-query assertions would also pass on a body that rendered a spinner, an
       empty card or a stray wrapper with padding, and each of those is a different bug
       from "nothing at all". */
    const host = canvasElement.querySelector('.min-h-\\[640px\\]') as HTMLElement;
    await expect(host.childElementCount).toBe(0);
    await expect(host.textContent).toBe('');
    // The 640px minimum is the harness's, not the component's: the blank region a
    // reader sees is whatever the drawer around it happens to be tall.
    await expect(host.getBoundingClientRect().height).toBeGreaterThanOrEqual(640);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The third outcome, and the one no reviewer would think to ask for. It lasts as long as ' +
          'the org membership takes to load, which on a cold start is the same window in which ' +
          'the reader is most likely to be looking at the panel. A `skeleton` here would cost one ' +
          'prop.',
      },
    },
  },
};
