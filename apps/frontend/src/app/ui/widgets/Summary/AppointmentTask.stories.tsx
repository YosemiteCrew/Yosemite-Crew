import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment, UserOrganization } from '@yosemite-crew/types';

import type { Task } from '@/app/features/tasks/types/task';
import type { Team } from '@/app/features/organization/types/team';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useFormsStore } from '@/app/stores/formsStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { useTeamStore } from '@/app/stores/teamStore';
import AppointmentTask from './AppointmentTask';

const ORG_ID = 'org-schedule-widget-story';
const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';

/**
 * A receptionist membership. `usePermissions` derives the effective set from
 * `roleCode` against the role table, so seeding the role is enough - and this
 * widget is wrapped in a `PermissionGate` requiring both `appointments:view:any`
 * and `tasks:view:any`, so without it the story renders nothing at all.
 */
const MEMBERSHIP: UserOrganization = {
  practitionerReference: `Practitioner/${ELENA}`,
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'RECEPTIONIST',
  roleDisplay: 'Receptionist',
  active: true,
};

const member = (id: string, name: string): Team => ({
  _id: id,
  practionerId: id,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const TEAM: Team[] = [member(ELENA, 'Dr. Elena Marsh'), member(RAVI, 'Dr. Ravi Patel')];

const appointment = (id: string, name: string, parent: string, hour: string): Appointment => {
  const patient: Appointment['patient'] = {
    id: `companion-${id}`,
    name,
    species: 'Dog',
    breed: 'Beagle',
    parent: { id: `parent-${id}`, name: parent },
  };
  return {
    id,
    organisationId: ORG_ID,
    patient,
    companion: patient,
    appointmentType: {
      id: 'svc-annual',
      name: 'Annual check-up',
      speciality: { id: 'spec-general', name: 'General practice' },
    },
    appointmentDate: new Date(`2026-08-19T${hour}:00.000Z`),
    startTime: new Date(`2026-08-19T${hour}:00.000Z`),
    endTime: new Date(`2026-08-19T${hour}:00.000Z`),
    timeSlot: '09:30 AM',
    durationMinutes: 30,
    status: 'UPCOMING',
    concern: 'Annual boosters and a weight check.',
  };
};

const APPOINTMENTS: Appointment[] = [
  appointment('appointment-1', 'Kizie', 'Sky Doe', '09:30'),
  appointment('appointment-2', 'Bailey', 'Marta Lang', '10:15'),
  appointment('appointment-3', 'Nala', 'Ana Ferreira', '11:00'),
];

const task = (over: Partial<Task> & Pick<Task, '_id' | 'name' | 'status'>): Task => ({
  organisationId: ORG_ID,
  assignedBy: ELENA,
  assignedTo: RAVI,
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'MEDICATION',
  description: 'Recorded against the inpatient chart.',
  dueAt: new Date('2026-08-19T12:00:00.000Z'),
  ...over,
});

const TASKS: Task[] = [
  task({ _id: 'task-1', name: 'Midday analgesia round', status: 'PENDING' }),
  task({
    _id: 'task-2',
    name: 'Kennel 3 deep clean',
    status: 'IN_PROGRESS',
    category: 'HUSBANDRY',
    description: 'Between the morning and afternoon lists.',
  }),
  task({
    _id: 'task-3',
    name: 'Discharge call, Bailey',
    status: 'COMPLETED',
    category: 'COMMUNICATION',
    description: 'Confirm the owner collected the take-home meds.',
  }),
  task({
    _id: 'task-4',
    name: 'Vaccine fridge log',
    status: 'PENDING',
    category: 'COMPLIANCE',
    description: 'Twice-daily temperature reading.',
  }),
];

/**
 * Seeds the five stores the widget reads, so the mount is offline.
 *
 * The team seed is load-bearing twice over: `useLoadTeam` bails out on its first
 * line once the org key exists (no request), and the Tasks table resolves its
 * From/To columns through the same store, so without it those cells print raw
 * practitioner ids. The forms seed silences `useLoadFormsForPrimaryOrg` in the
 * detail modal.
 *
 * Two requests are still attempted and caught, both from modals that are mounted
 * CLOSED behind the widget: `AppointmentInfo` fetches the selected appointment's
 * forms (guarded by the appointment id, not by `showModal`), and `Reschedule`
 * asks for slots for its appointment type. Both fail into their own catch blocks
 * inside dialogs nobody opens here, and neither touches the surface under review.
 */
const seedStores = () => {
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
    status: 'loaded',
  });
  useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAM);
  useAppointmentStore.getState().setAppointmentsForOrg(ORG_ID, APPOINTMENTS);
  useTaskStore.getState().setTasksForOrg(ORG_ID, TASKS);
  useFormsStore.setState({ lastFetchedByOrgId: { [ORG_ID]: '2026-08-19T00:00:00.000Z' } });
};

/**
 * The one visible table. Only one of the two tables is rendered at a time, but the
 * matching `PaginatedCardList` is always rendered beside it (hidden above 1280),
 * so every task name exists twice in the DOM - queries have to be scoped to the
 * table or they see both.
 */
const table = (canvasElement: HTMLElement) => canvasElement.querySelector('table') as HTMLElement;

const columnLabels = (canvasElement: HTMLElement): string[] =>
  [...table(canvasElement).querySelectorAll('thead th')].map((cell) =>
    (cell.textContent ?? '').trim()
  );

/**
 * Blocks until nothing in the document has fired a `scroll` event for `quietMs`.
 *
 * This is not flake padding, it is a workaround for the defect the
 * `DismissedByAnUnrelatedScroll` block below asserts on purpose.
 * `useFilterDropdownDismiss` closes the status panel on EVERY scroll event captured at
 * the window, with no check that the scrolled node could move the panel's anchor - and
 * this widget mounts a `Reschedule` dialog CLOSED behind itself, whose `Slotpicker`
 * runs a `behavior: 'smooth'` `scrollTo` on its date strip when its slot request
 * settles. That animation streams a scroll event every ~17ms for ~700ms, so a panel
 * opened inside that window is shut about 15ms later, from a subtree nobody can see.
 */
const waitForScrollQuiet = async (quietMs = 250, timeoutMs = 4000) => {
  let last = performance.now();
  const onScroll = () => {
    last = performance.now();
  };
  globalThis.window.addEventListener('scroll', onScroll, true);
  try {
    const deadline = performance.now() + timeoutMs;
    while (performance.now() - last < quietMs && performance.now() < deadline) {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 60);
      });
    }
  } finally {
    globalThis.window.removeEventListener('scroll', onScroll, true);
  }
};

/** The status-filter panel portals to `document.body`, outside the canvas. */
const openStatusFilter = async (canvas: ReturnType<typeof within>, current: string) => {
  await waitForScrollQuiet();
  await userEvent.click(canvas.getByRole('button', { name: current }));
  return waitFor(() => {
    const panels = document.querySelectorAll('.yc-glass-overlay');
    expect(panels.length).toBeGreaterThan(0);
    return panels[panels.length - 1] as HTMLElement;
  });
};

/**
 * Option NAMES in the status panel.
 *
 * The trailing check is stripped: `StatusOptionButtons` renders the tick as a
 * third `<span>` inside the same button as the label, so the selected row's
 * `textContent` is "All\u2713" and a raw read never matches the option list it is
 * being compared against. `checkedStatus` below asserts the tick separately, so
 * dropping it here loses nothing.
 */
const statusOptions = (panel: HTMLElement): string[] =>
  [...panel.querySelectorAll('button')].map((option) =>
    (option.textContent ?? '').replaceAll('\u2713', '').trim()
  );

/** The single option carrying the tick, i.e. the one the filter is currently on. */
const checkedStatus = (panel: HTMLElement): string[] =>
  [...panel.querySelectorAll('button')]
    .filter((option) => (option.textContent ?? '').includes('\u2713'))
    .map((option) => (option.textContent ?? '').replaceAll('\u2713', '').trim());

const meta = {
  title: 'Widgets/Summary/AppointmentTask',
  component: AppointmentTask,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The Schedule widget on the dashboard, which is really two widgets behind one segmented ' +
          'pill. Only the Appointments side had ever been drawn.\n\n' +
          'Switching to **Tasks** swaps three things at once, none of which is a filter over the ' +
          'same rows: a different table (eight task columns for ten appointment ones), a different ' +
          'status set in the filter control (Pending/In progress/Completed/Cancelled, against the ' +
          'appointment lifecycle of Requested/Upcoming/Checked in/...), and a different footer link ' +
          '(`/tasks` rather than `/appointments`). The heading count and the "Showing n of n" line ' +
          'follow the active side too.\n\n' +
          'The swap also resets state that is easy to forget: `resetActiveTableState` puts the ' +
          'status filter back to All and closes any open appointment popup, so a reader who ' +
          'filtered Appointments to "Cancelled" and pressed Tasks does not land on a Tasks list ' +
          'silently filtered by a status tasks do not have.\n\n' +
          'Both tables run at the dashboard `small` page size of five, and the footer caption is ' +
          'hard-coded to that same five - it reports `Showing 5 of 12`, not the row count the ' +
          'auto-fitting table may actually have drawn.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: seedStores,
  decorators: [
    (Story) => (
      <div className="h-[620px] w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppointmentTask>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AppointmentsHalf: Story = {
  name: 'Appointments (the default half)',
  /* Pinned to 1440 as a GLOBAL, not a parameter - `parameters.viewport` selection
     was removed in Storybook 10 and is inert. 1440 rather than the 1280 laptop
     default because `.table-list` is hidden at `max-width: 1279.98px` while the
     card band is `xl:hidden` (min-width 1280): at exactly 1280 a preview
     scrollbar decides which of the two markups these stories assert against. */
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: 'Appointments' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(canvas.getByRole('button', { name: 'Tasks' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    // The count in the heading is the APPOINTMENT count on this side.
    await expect(canvas.getByRole('heading', { level: 2 }).textContent?.trim()).toBe(
      'Schedule (3)'
    );
    await expect(columnLabels(canvasElement)).toContain('Date/Time');
    await expect(columnLabels(canvasElement)).toContain('Lead');
    /* "Kizie · Doe", not "Kizie". Every companion name in PIMS goes through
       `formatCompanionNameWithOwnerLastName`, which appends the owner's LAST name - so
       the seeded pair ("Kizie", "Sky Doe") renders as one composed string and the bare
       fixture name never appears on its own. Both are asserted, because a regression
       that drops the suffix would still satisfy a substring match. */
    await expect(within(table(canvasElement)).getByText('Kizie · Doe')).toBeInTheDocument();
    await expect(within(table(canvasElement)).queryByText('Kizie')).not.toBeInTheDocument();

    await expect(canvas.getByText(/^Showing \d+ of \d+$/).textContent).toBe('Showing 3 of 3');
    await expect(canvas.getByRole('link', { name: /Open appointments/ })).toHaveAttribute(
      'href',
      '/appointments'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The side the dashboard opens on, kept here as the frame every assertion in the Tasks ' +
          'story is measured against.',
      },
    },
  },
};

export const TasksHalf: Story = {
  name: 'Tasks (the undrawn half)',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Tasks' }));

    /* The whole column set is replaced, not filtered. Asserted as an exact list,
       because a swap that rendered the Tasks DATA into the appointment columns
       would still satisfy any single-header lookup. */
    await waitFor(() =>
      expect(columnLabels(canvasElement)).toEqual([
        'Task',
        'Description',
        'Category',
        'From',
        'To',
        'Due date',
        'Status',
        'Actions',
      ])
    );

    const taskTable = within(table(canvasElement));
    await expect(taskTable.getByText('Midday analgesia round')).toBeInTheDocument();
    // From/To resolve through the team store rather than printing practitioner
    // ids, which is the one thing the seeded team is visible in.
    await expect(taskTable.getAllByText('Dr. Ravi Patel')).toHaveLength(4);
    // The composed name the appointments table would have drawn (see AppointmentsHalf).
    // Querying the bare fixture name here would pass on BOTH tables and prove nothing.
    await expect(taskTable.queryByText('Kizie · Doe')).not.toBeInTheDocument();

    // The heading, the caption and the link all follow the active side.
    await expect(canvas.getByRole('heading', { level: 2 }).textContent?.trim()).toBe(
      'Schedule (4)'
    );
    await expect(canvas.getByText(/^Showing \d+ of \d+$/).textContent).toBe('Showing 4 of 4');
    await expect(canvas.getByRole('link', { name: /Open tasks/ })).toHaveAttribute(
      'href',
      '/tasks'
    );
    await expect(canvas.queryByRole('link', { name: /Open appointments/ })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The Tasks table at the dashboard `small` page size. It is a wider table than the ' +
          'appointment one in practice - Description is a two-line clamp and the action rail needs ' +
          '176px - so this is also where the widget is most likely to need a horizontal scroll.',
      },
    },
  },
};

export const TaskStatusFilters: Story = {
  name: 'Tasks: the status set swaps too',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The appointment lifecycle first, so the two lists can be compared.
    const appointmentPanel = await openStatusFilter(canvas, 'All statuses');
    await expect(statusOptions(appointmentPanel)).toEqual([
      'All',
      'Requested',
      'Upcoming',
      'Checked in',
      'In progress',
      'Completed',
      'Cancelled',
      'No show',
    ]);
    // Nothing is filtered yet, so the tick is on All - which is also the baseline
    // the reset below has to come back to.
    await expect(checkedStatus(appointmentPanel)).toEqual(['All']);

    /* Pressing Tasks is itself the outside click that dismisses the panel - the
       dropdown closes on any mousedown outside the trigger, and has no Escape
       handler at all. Waiting for it to go is what keeps the reopen below from
       toggling the trigger shut instead. */
    await userEvent.click(canvas.getByRole('button', { name: 'Tasks' }));
    await waitFor(() => expect(document.body.contains(appointmentPanel)).toBe(false));
    const taskPanel = await openStatusFilter(canvas, 'All statuses');
    await expect(statusOptions(taskPanel)).toEqual([
      'All',
      'Pending',
      'In progress',
      'Completed',
      'Cancelled',
    ]);
    /* Back on All rather than on whatever the appointment side was: this is
       `resetActiveTableState` doing its job, and it is the assertion that would
       catch a Tasks list silently filtered by a status tasks do not have. */
    await expect(checkedStatus(taskPanel)).toEqual(['All']);

    /* DismissedByAnUnrelatedScroll - THE DEFECT, asserted rather than only worked
       around. `useFilterDropdownDismiss` registers `scroll` on the window with
       `capture: true` and calls `setOpen(false)` for every event it sees, without
       checking that the scrolled node is an ancestor of the trigger or of the panel. So
       a scroll in a subtree that cannot move this panel by a single pixel still shuts
       it. `document.body` is used here because it makes the demonstration
       deterministic - a capturing window listener receives the event on its way down,
       and body is provably not an ancestor of a `position: fixed` portal anchored to the
       trigger.

       In the product it arrives unprompted. This widget mounts a `Reschedule` dialog
       CLOSED behind itself; its `Slotpicker` centres the selected date with
       `strip.scrollTo({ behavior: 'smooth' })` as soon as the slot request settles, and
       that animation fires ~40 scroll events over ~700ms. A reader who opens the status
       filter in that window watches it close under their cursor for no visible reason,
       from a dialog they never opened. `waitForScrollQuiet` above exists only so the
       rest of this story survives it.

       This block should FAIL - and be deleted - the day the dismissal is scoped to
       scrolls that can actually move the panel. */
    await expect(document.body.contains(taskPanel)).toBe(true);
    document.body.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(document.body.contains(taskPanel)).toBe(false));

    // And it filters the list it belongs to: one of the four tasks is completed.
    const reopenedPanel = await openStatusFilter(canvas, 'All statuses');
    await expect(checkedStatus(reopenedPanel)).toEqual(['All']);
    await userEvent.click(within(reopenedPanel).getByText('Completed'));
    await waitFor(() =>
      expect(canvas.getByText(/^Showing \d+ of \d+$/).textContent).toBe('Showing 1 of 1')
    );
    const taskTable = within(table(canvasElement));
    await expect(taskTable.getByText('Discharge call, Bailey')).toBeInTheDocument();
    await expect(taskTable.queryByText('Midday analgesia round')).not.toBeInTheDocument();
    // The heading count is the FULL task count, not the filtered one - the two
    // numbers on this widget mean different things.
    await expect(canvas.getByRole('heading', { level: 2 }).textContent?.trim()).toBe(
      'Schedule (4)'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Four appointment statuses have no task equivalent and vice versa, so this control is a ' +
          'different control on each side of the pill even though it never moves or changes shape. ' +
          'The trigger reads "All statuses" in both cases, which is the only label a reader sees ' +
          'before opening it.\n\n' +
          '**This story also pins a live defect.** `useFilterDropdownDismiss` closes the panel on ' +
          'any `scroll` captured at the window, whoever fired it. The `Reschedule` dialog this ' +
          'widget mounts CLOSED behind itself smooth-scrolls its `Slotpicker` date strip for about ' +
          '700ms once its slot request settles, and every frame of that animation slams the status ' +
          'filter shut - so on the dashboard the control is unusable for the first second after the ' +
          'widget settles, and intermittently after that. The story asserts the dismissal is ' +
          'unscoped instead of waiting the bug out silently.',
      },
    },
  },
};
