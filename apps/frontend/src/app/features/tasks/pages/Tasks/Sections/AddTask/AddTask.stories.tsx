import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import type {
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import type { Team } from '@/app/features/organization/types/team';
import type { Task } from '@/app/features/tasks/types/task';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useTeamStore } from '@/app/stores/teamStore';
import AddTask from './index';

type AddTaskProps = ComponentProps<typeof AddTask>;

const ORG_ID = 'org-storybook';
const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';
const MARTA = 'parent-marta';
const SKY = 'parent-sky';

const membership: UserOrganization = {
  id: 'membership-1',
  practitionerReference: `Practitioner/${ELENA}`,
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const teamMember = (practionerId: string, name: string): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const TEAM: Team[] = [teamMember(ELENA, 'Dr. Elena Marsh'), teamMember(RAVI, 'Dr. Ravi Patel')];

const parent = (id: string, firstName: string, lastName: string): StoredParent => ({
  id,
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
  phoneNumber: '+34 600 000 000',
  address: { city: 'Barcelona', country: 'ES' },
  createdFrom: 'pms',
});

const PARENTS: StoredParent[] = [parent(MARTA, 'Marta', 'Alvarez'), parent(SKY, 'Sky', 'Doe')];

const companion = (id: string, name: string, parentId: string): StoredCompanion => ({
  id,
  organisationId: ORG_ID,
  parentId,
  name,
  type: 'dog',
  breed: 'Border Collie',
  dateOfBirth: new Date('2019-04-18T00:00:00.000Z'),
  gender: 'male',
  isInsured: false,
  status: 'active',
});

const COMPANIONS: StoredCompanion[] = [
  companion('companion-kiko', 'Kiko', MARTA),
  companion('companion-kizie', 'Kizie', SKY),
  // A second pet for Marta. The dialog folds companions by parent, so this must NOT
  // produce a second Marta chip - see the "Nothing chosen yet" story.
  companion('companion-luna', 'Luna', MARTA),
];

/**
 * Seeds the four stores the dialog reads, rather than mocking modules.
 *
 * The chip lists are pure selectors over `teamStore` and `companionStore`; the pet
 * parent's NAME comes from `parentStore` via `useMemberMap`. None of them fetches on
 * read - the loaders (`useLoadTeam`, `useLoadCompanionsForPrimaryOrg`) are separate
 * hooks this dialog does not call.
 *
 * `useTaskForm` does fetch: it loads org templates and the YC library on mount. Both
 * are wrapped in `Promise.allSettled` and both failing leaves `templateOptions` empty,
 * which is exactly the shape these stories assert - so the missing backend produces a
 * real state rather than a broken one, and no request mocking is needed (this
 * Storybook has none).
 */
const seed = ({
  team = TEAM,
  companions = COMPANIONS,
  parents = PARENTS,
}: { team?: Team[]; companions?: StoredCompanion[]; parents?: StoredParent[] } = {}) => {
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: membership },
    status: 'loaded',
  });
  useTeamStore.getState().setTeamsForOrg(ORG_ID, team);
  useCompanionStore.getState().setCompanionsForOrg(ORG_ID, companions);
  useParentStore.getState().setParents(parents);
};

/**
 * A completed, recurring task being duplicated - the shape the tasks page hands in
 * when a reader picks "Duplicate" on an existing row.
 *
 * Module-level so its identity is STABLE across renders. The hydration guard is
 * `prefill !== consumedPrefill`, an identity comparison, so a prefill rebuilt inline
 * in `args` would be a new object on every render and re-apply itself forever,
 * wiping anything the reader typed.
 */
const PREFILL: Partial<Task> = {
  _id: 'task-source-9001',
  organisationId: ORG_ID,
  appointmentId: 'appointment-8842',
  name: 'Twice-daily wound check',
  description: 'Check the incision site, photograph it, and log the result.',
  category: 'PROCEDURE',
  priority: 'URGENT',
  audience: 'EMPLOYEE_TASK',
  assignedTo: RAVI,
  source: 'CUSTOM',
  status: 'COMPLETED',
  completedAt: new Date('2026-03-10T09:00:00.000Z'),
  completedBy: ELENA,
  calendarEventId: 'calendar-event-31',
  // Fixed instant: `getPreferredTimeZone` falls back to Europe/Berlin with no timezone
  // token stored, so 12:00 UTC renders as 13:00 on every machine.
  dueAt: new Date('2026-03-12T12:00:00.000Z'),
  recurrence: { type: 'DAILY', isMaster: true, masterTaskId: 'task-master-77' },
};

/**
 * The tasks page mounts this dialog on demand and unmounts it on dismissal. Copying
 * that lifecycle keeps the docs page from holding half a dozen open dialogs at once,
 * each with a share of `ModalBase`'s ref-counted body scroll lock.
 */
const AddTaskHarness = ({
  showModal: _showModal,
  setShowModal: _setShowModal,
  ...args
}: AddTaskProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[620px] items-start bg-[var(--screen)] p-6">
      <button
        type="button"
        className="rounded-2xl bg-[var(--cta)] px-6 py-3 text-body-3-emphasis text-[var(--cta-text)]"
        onClick={() => setOpen(true)}
      >
        Open the New task dialog
      </button>
      {open && <AddTask {...args} showModal setShowModal={setOpen} />}
    </div>
  );
};

/**
 * Opens the dialog and returns it.
 *
 * Matched on `dialog[open]`, never on a class: `ModalBase` leaves a dismissed dialog
 * MOUNTED and only drops the `open` attribute, so a class lookup can return a panel
 * that is no longer on screen. It also portals to `document.body`, so none of the
 * dialog is inside `canvasElement`.
 *
 * The LAST open dialog is taken rather than the first: on the autodocs page every
 * story shares one `document.body`, and a dialog opened by an earlier story is still
 * there. Portals append in mount order, so the newest one is at the end.
 */
const openDialog = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Open the New task dialog' }));
  return waitFor(() => {
    const dialogs = document.querySelectorAll('dialog[open]');
    expect(dialogs.length).toBeGreaterThan(0);
    return dialogs[dialogs.length - 1] as HTMLElement;
  });
};

/** Resolved grid tracks for a row of the dialog's field grid. */
const tracks = (el: HTMLElement): string[] =>
  getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/);

/** The grid row a labelled field sits in. */
const gridRow = (dialog: HTMLElement, label: string): HTMLElement =>
  within(dialog).getByText(label).closest('.grid') as HTMLElement;

const meta = {
  title: 'Tasks/AddTask',
  component: AddTask,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The **New task** dialog - the only place in PIMS a task is created from scratch - and ' +
          'it had never been drawn. It opens on a click from the tasks page, so the whole surface ' +
          'was reviewable only by driving the live app against a seeded organisation.\n\n' +
          'It is a `centered` Modal at `md` (680px) holding three things: a `ModalHeader`, ' +
          '`TaskFormFields` in a layout that exists nowhere else, and a `ModalFooter`.\n\n' +
          'The **layout is unique to this caller**. `TaskFormFields` has three branches, and only ' +
          'this dialog passes `twoColumn` *and* `assigneeChips`: task name, category, then the ' +
          'chip row, then Due date / Time / Repeat sharing a three-track row and Priority / ' +
          'Reminder sharing a two-track one. Every other consumer gets the single-column stack. ' +
          'Both grids are `grid-cols-1 sm:grid-cols-N`, and `sm` is a **viewport** query, not a ' +
          'container one - so they collapse when the browser narrows even though the 680px panel ' +
          'has not changed.\n\n' +
          'The **assignee chips replace two dropdowns**. Team chips carry a violet monogram, ' +
          'pet-parent chips a pink dot, and picking one of the latter flips `audience` to ' +
          '`PARENT_TASK` and resolves a `companionId` behind the scenes. The pet-parent list is ' +
          'folded by parent, so an owner with three pets still gets one chip.\n\n' +
          'The **prefill hydration runs during render**, not in an effect: `if (showModal && ' +
          'prefill && prefill !== consumedPrefill)` sets five pieces of state and marks the ' +
          'prefill consumed. That identity comparison is load-bearing - a caller passing a freshly ' +
          'built object on each render would re-apply it forever and erase every keystroke. It ' +
          'also SCRUBS the source task: `_id`, `appointmentId`, `completedAt`, `completedBy`, ' +
          '`calendarEventId` and the series link are dropped and the status forced back to ' +
          '`PENDING`. None of that scrubbing is visible, which is precisely why it is worth ' +
          'writing down here.\n\n' +
          'One accessibility gap the stories pin rather than paper over: this caller passes ' +
          'neither `aria-label` nor `aria-labelledby` to `Modal`, so the dialog opens **without an ' +
          'accessible name** even though "New task" is right there in the header.\n\n' +
          'No story presses Create in a state that would pass validation. `handleCreate` POSTs, ' +
          'and this Storybook has no request mocking - the stories stop at the last frame before ' +
          'the write.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    prefill: null,
  },
  beforeEach: () => {
    seed();
  },
  render: (args) => <AddTaskHarness {...args} />,
} satisfies Meta<typeof AddTask>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewTask: Story = {
  name: 'Nothing chosen yet',
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const panel = within(dialog);

    await expect(panel.getByRole('heading', { name: 'New task' })).toBeInTheDocument();

    /* 680px, the `md` centered width. Measured with getBoundingClientRect because that
       is the border box - getComputedStyle().width reports the content box and would
       read 628 here, once the 26px insets are taken off. */
    await expect(Math.round(dialog.getBoundingClientRect().width)).toBe(680);

    /* The dialog carries NO accessible name. `Modal` applies whichever of aria-label /
       aria-labelledby it is handed, and this caller hands it neither - so a screen
       reader announces "dialog" with no title, while the sighted reader has "New task"
       in 17px bold at the top. Asserted rather than described, so that wiring the
       header up (a `titleId` and one prop) fails this line and gets it removed. */
    await expect(dialog).not.toHaveAttribute('aria-label');
    await expect(dialog).not.toHaveAttribute('aria-labelledby');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Empty form: the name is blank and the category holds EMPTY_TASK's default.
    await expect(panel.getByRole('textbox', { name: 'Task' })).toHaveValue('');
    await expect(panel.getByRole('button', { name: 'Category: Care' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Priority: Medium' })).toBeInTheDocument();

    /* Three chips, not four. Two clinicians and ONE Marta - she owns two of the three
       seeded companions, and the dialog folds the parent list through a Map keyed on
       `parentId` precisely so an owner with several pets does not repeat. The count is
       the only thing that catches a regression there. */
    await expect(panel.getByText('Assign to')).toBeInTheDocument();
    await expect(panel.getByText('Dr. Elena Marsh')).toBeInTheDocument();
    await expect(panel.getByText('Dr. Ravi Patel')).toBeInTheDocument();
    await expect(panel.getByText('Pet parent · Marta Alvarez')).toBeInTheDocument();
    await expect(panel.getByText('Pet parent · Sky Doe')).toBeInTheDocument();
    await expect(panel.queryAllByRole('button', { pressed: true })).toHaveLength(0);

    /* The two field grids, by track count AND child count. A three-track template over
       two children leaves a hole where Repeat should be, and a two-track template over
       three silently wraps one field onto a second line - neither shows up in a class
       list, and both are invisible in a screenshot that happens to look balanced. */
    const dueRow = gridRow(dialog, 'Due date');
    await expect(tracks(dueRow)).toHaveLength(3);
    await expect(dueRow.children).toHaveLength(3);
    const priorityRow = gridRow(dialog, 'Priority');
    await expect(tracks(priorityRow)).toHaveLength(2);
    await expect(priorityRow.children).toHaveLength(2);
    // Different rows, not one grid found twice.
    await expect(dueRow).not.toBe(priorityRow);

    /* No template picker. Both template loads fail here (there is no backend), so
       `templateOptions` is empty and the field is absent rather than an empty
       dropdown - which is also what a new organisation with no templates sees. */
    await expect(panel.queryByText('Load from template (optional)')).not.toBeInTheDocument();

    // The footer: Cancel and Create task, plus the hidden template action.
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    await expect(panel.getByRole('button', { name: 'Create task' })).toBeEnabled();

    /* The template action is shipped `className="hidden"` on every mount - present,
       wired to `handleCreateTemplate`, and painted out.

       It has to be found by TEXT. `getByRole('button', { name: 'Save as template',
       hidden: true })` can never match it: accname step 2A returns the EMPTY STRING for
       a `display: none` element, and testing-library computes the name without passing
       `hidden` through, so the option only relaxes the a11y-tree filter and leaves the
       name empty. The role query is kept below as an assertion of exactly that - the
       control is nameless, not absent - so un-hiding it flips both lines rather than
       silently satisfying one. */
    const templateAction = panel.getByText('Save as template').closest('button');
    await expect(templateAction?.tagName).toBe('BUTTON');
    await expect(templateAction?.classList.contains('hidden')).toBe(true);
    await expect(getComputedStyle(templateAction as HTMLElement).display).toBe('none');
    await expect(
      panel.queryByRole('button', { name: 'Save as template', hidden: true })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'How the dialog opens from the tasks page: an empty form, Category pre-set to Care by ' +
          '`EMPTY_TASK`, and a Create button that will bounce until a name and an assignee exist.',
      },
    },
  },
};

export const Prefilled: Story = {
  name: 'Prefilled from a duplicated task',
  args: { prefill: PREFILL },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const panel = within(dialog);

    // Everything the hydration writes that the reader can actually SEE.
    await expect(panel.getByRole('textbox', { name: 'Task' })).toHaveValue(
      'Twice-daily wound check'
    );
    await expect(panel.getByRole('button', { name: 'Category: Procedure' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Priority: Urgent' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Repeat: Daily' })).toBeInTheDocument();
    // 13:00, not 12:00 - the stored instant is UTC and the pickers render in the
    // preferred timezone (Europe/Berlin when no timezone token is saved).
    await expect(panel.getByRole('button', { name: 'Time: 13:00' })).toBeInTheDocument();
    await expect(
      panel.getByRole('button', { name: 'Due date: Mar 12, 2026, toggle calendar' })
    ).toBeInTheDocument();

    // The source task's assignee arrives selected, so the chip row opens pre-answered.
    const pressed = panel.getAllByRole('button', { pressed: true });
    await expect(pressed).toHaveLength(1);
    await expect(pressed[0]).toHaveTextContent('Dr. Ravi Patel');

    /* A daily recurrence adds the End date field, and it is EMPTY: the hydration keeps
       the type but the source task's end boundary is not carried, so the duplicate
       fails validation on a field the reader never touched. That is the one
       consequence of the scrub with a visible surface. */
    const endDate = panel.getByRole('button', { name: 'End date, toggle calendar' });
    // The accessible name is the label ALONE - a Datepicker holding a date reads
    // "End date: Mar 12, 2026, toggle calendar" - and the value span is empty.
    await expect(endDate.querySelector('span')).toBeEmptyDOMElement();

    /* The rest of the scrub is invisible by design and cannot be asserted from the
       DOM: `_id`, `appointmentId`, `completedAt`, `completedBy`, `calendarEventId` are
       cleared, `status` is forced to PENDING, and `recurrence.isMaster` is set false
       with `masterTaskId` dropped so the copy starts its own series rather than
       joining the source's. If any of that regresses, the dialog looks exactly like
       this frame and the bug lands in the database. */
    await expect(panel.getByRole('button', { name: 'Create task' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What "Duplicate" opens. Six fields arrive filled and one - End date - arrives empty and ' +
          'required, which is why duplicating a repeating task always needs one more decision ' +
          'than duplicating a one-off.',
      },
    },
  },
};

export const PrefillIsConsumedOnce: Story = {
  name: 'Typing survives the next render',
  args: { prefill: PREFILL },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const panel = within(dialog);
    const name = panel.getByRole('textbox', { name: 'Task' });
    await expect(name).toHaveValue('Twice-daily wound check');

    await userEvent.clear(name);
    await userEvent.type(name, 'Wound check - day 3');

    /* Every keystroke calls `setFormData` and re-renders the dialog, so this asserts
       the hydration guard rather than the input: `consumedPrefill` holds the same
       object identity the args still carry, the `if` is false, and the typed value
       stands. Without the guard - or with a value comparison in place of the identity
       one - the prefill would reapply on the render after each character and the field
       would snap back to "Twice-daily wound check". */
    await expect(name).toHaveValue('Wound check - day 3');

    // A second, unrelated field change re-renders again and still does not reset it.
    await userEvent.click(panel.getByText('Pet parent · Sky Doe'));
    await expect(name).toHaveValue('Wound check - day 3');

    /* And the chip click did land, flipping the task from the prefilled employee
       assignment to a parent task - one chip pressed, and it is not Ravi's. */
    const pressed = panel.getAllByRole('button', { pressed: true });
    await expect(pressed).toHaveLength(1);
    await expect(pressed[0]).toHaveTextContent('Pet parent · Sky Doe');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The render-phase hydration is the riskiest thing in this file, and this is the frame ' +
          'that would catch it breaking. It is not a visual story - the value in the field is the ' +
          'whole result - but nothing else in Storybook exercises a render-phase state write.',
      },
    },
  },
};

export const CreateWithoutAnAssignee: Story = {
  name: 'Create with nothing filled in',
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const panel = within(dialog);

    await userEvent.click(panel.getByRole('button', { name: 'Create task' }));

    /* `validateTaskForm` rejects, so nothing is POSTed and the dialog stays open. Two
       errors land in two different places: one on the name field, one under the chip
       row several rows further down. Neither moves focus, and the button that was
       pressed is at the bottom of a scrolling body - so on a short window the reader
       can press Create and see nothing change at all. */
    expect(await panel.findByText('Please select a companion or staff')).toBeInTheDocument();
    await expect(panel.getByText('Name is required')).toBeInTheDocument();

    // Category and Due date are NOT flagged: `EMPTY_TASK` ships a category, and
    // `useTaskForm` folds the date and time pickers into `dueAt` during render, so
    // both are already valid on an untouched form.
    await expect(panel.queryByText('Category is required')).not.toBeInTheDocument();
    await expect(panel.queryByText('Due date and time are required')).not.toBeInTheDocument();

    await expect(document.querySelector('dialog[open]')).not.toBeNull();
    await expect(panel.getByRole('button', { name: 'Create task' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The rejection path, which is the only way the assignee error is ever reachable. Worth ' +
          'looking at the distance between the pressed button and the two messages: they are the ' +
          'entire response, and one of them can be below the fold.',
      },
    },
  },
};

export const NoAssigneesToPick: Story = {
  name: 'A brand-new organisation',
  beforeEach: () => {
    seed({ team: [], companions: [], parents: [] });
  },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const panel = within(dialog);

    /* No colleagues invited and no pet parents yet, so the chip row collapses to one
       faint line. The whole row is REPLACED, not emptied: `hasOptions` is false and
       the ternary renders the sentence instead of the flex box, so there is nothing
       selectable between the "Assign to" label and the Due date row. Counted rather
       than eyeballed - an empty flex row and a replaced one look identical. */
    await expect(panel.getByText('Assign to')).toBeInTheDocument();
    await expect(panel.getByText('No assignees available yet.')).toBeInTheDocument();
    await expect(panel.queryByText('Pet parent · Marta Alvarez')).not.toBeInTheDocument();
    await expect(panel.queryByText(/^Pet parent · /)).not.toBeInTheDocument();
    await expect(panel.queryByText('Dr. Elena Marsh')).not.toBeInTheDocument();

    /* The rest of the dialog is untouched, which is the part worth pinning: the two
       field grids keep their three-track and two-track templates and all six fields,
       so the reader can fill in every other row and Create will still bounce on an
       assignee that cannot be chosen. */
    await expect(panel.getByRole('textbox', { name: 'Task' })).toHaveValue('');
    const dueRow = gridRow(dialog, 'Due date');
    await expect(tracks(dueRow)).toHaveLength(3);
    await expect(dueRow.children).toHaveLength(3);
    const priorityRow = gridRow(dialog, 'Priority');
    await expect(tracks(priorityRow)).toHaveLength(2);
    await expect(priorityRow.children).toHaveLength(2);
    await expect(panel.getByRole('button', { name: 'Create task' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The first-run state. It is reachable on day one of every new practice, and the dialog ' +
          'offers no route out of it - no invite link, no explanation that a task cannot be ' +
          'created without a team member or a pet parent.',
      },
    },
  },
};

export const UnknownPetParent: Story = {
  name: 'A pet parent missing from the store',
  beforeEach: () => {
    // The companion is there; its owner is not. This happens whenever the companion
    // list has loaded and the parent list has not - two independent fetches.
    seed({ companions: [companion('companion-kiko', 'Kiko', MARTA)], parents: [] });
  },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const panel = within(dialog);

    /* `resolveMemberName` returns '-' for an unknown id and the dialog falls back to
       `companion.name` - so the chip reads the PET's name behind a "Pet parent"
       prefix. It is a plausible-looking chip that names the wrong species. Asserted
       because it is silent: nothing about this frame suggests a lookup failed. */
    await expect(panel.getByText('Pet parent · Kiko')).toBeInTheDocument();
    await expect(panel.queryByText('Pet parent · Marta Alvarez')).not.toBeInTheDocument();

    /* ONE parent chip, not zero and not two: the fold still keys on `parentId`, so a
       missing parent record loses the name without losing the row. Counted because
       the two other plausible regressions - dropping the chip entirely, or emitting
       one chip per companion - both leave a frame that reads as reasonable. */
    await expect(panel.getAllByText(/^Pet parent · /)).toHaveLength(1);
    // The team chips are unaffected: the failed lookup is in the companion fold, and
    // it does not take the rest of the row with it.
    await expect(panel.getByText('Dr. Elena Marsh')).toBeInTheDocument();
    await expect(panel.getByText('Dr. Ravi Patel')).toBeInTheDocument();
    // And nothing is selected, so the reader can still pick the mislabelled chip -
    // which assigns the task to Marta under Kiko's name.
    await expect(panel.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    await userEvent.click(panel.getByText('Pet parent · Kiko'));
    const pressed = panel.getAllByRole('button', { pressed: true });
    await expect(pressed).toHaveLength(1);
    await expect(pressed[0]).toHaveTextContent('Pet parent · Kiko');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The fallback chain is `resolved name -> companion name -> raw parent id`, and the ' +
          'middle step is the one that produces a wrong answer rather than an obviously missing ' +
          'one. Worth deciding whether an unresolved parent should be dropped from the list ' +
          'instead.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375): the dialog becomes a sheet',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10: a story using it still renders, still plays and still passes -
  // at 1280px, under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const panel = within(dialog);

    /* `useIsPhone` is false during SSR and the first client render, so the sheet is a
       post-mount swap - polled rather than read once. */
    await waitFor(() => {
      expect(dialog.className).toContain('yc-phone-sheet');
    });

    /* The grabber is MEASURED, not merely found. Its geometry lives inside the
       `max-width: 767px` block in Sheet.css, so a 44x5 pill proves the phone rules
       actually matched - the class name alone would still be in the DOM with the
       viewport pin inert. */
    const grabber = dialog.querySelector('.yc-phone-sheet-grabber') as HTMLElement;
    await expect(grabber).not.toBeNull();
    const grabberStyle = getComputedStyle(grabber);
    await expect(grabberStyle.width).toBe('44px');
    await expect(grabberStyle.height).toBe('5px');

    // The sheet spans the viewport, and the viewport really is phone-sized.
    const viewportWidth = document.documentElement.clientWidth;
    await expect(viewportWidth).toBeLessThanOrEqual(430);
    await expect(Math.round(dialog.getBoundingClientRect().width)).toBe(viewportWidth);

    /* Both field grids collapse to a single track. This is the detail worth having a
       phone story for: the grids are keyed on `sm:` - a 640px VIEWPORT query - while
       the panel they live in is a different width entirely, so they narrow with the
       browser rather than with the sheet. */
    await expect(tracks(gridRow(dialog, 'Due date'))).toHaveLength(1);
    await expect(gridRow(dialog, 'Due date').children).toHaveLength(3);
    await expect(tracks(gridRow(dialog, 'Priority'))).toHaveLength(1);

    // The footer keeps both actions rather than stacking them.
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Create task' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the centered dialog re-forms into a bottom sheet with a grabber, and the ' +
          'three-across Due date / Time / Repeat row becomes three full-width fields. The dialog ' +
          'is long here - eight fields plus the chip row - so the footer is reached by scrolling ' +
          'the sheet body rather than by the sheet growing.',
      },
    },
  },
};
