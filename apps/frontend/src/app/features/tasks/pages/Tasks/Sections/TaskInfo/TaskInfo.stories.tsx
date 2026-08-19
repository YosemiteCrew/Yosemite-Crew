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
import { useAuthStore } from '@/app/stores/authStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useTeamStore } from '@/app/stores/teamStore';
import TaskInfo from './index';

type TaskInfoProps = ComponentProps<typeof TaskInfo>;

const ORG_ID = 'org-storybook';
/** The signed-in reader. `sub` is what `useTaskEditMode` matches against. */
const ME = 'practitioner-elena';
const COLLEAGUE = 'practitioner-ravi';
const PET_PARENT = 'parent-marta';

const membership = (over: Partial<UserOrganization> = {}): UserOrganization => ({
  id: 'membership-1',
  practitionerReference: `Practitioner/${ME}`,
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
  ...over,
});

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

const TEAM: Team[] = [teamMember(ME, 'Dr. Elena Marsh'), teamMember(COLLEAGUE, 'Dr. Ravi Patel')];

const PARENT: StoredParent = {
  id: PET_PARENT,
  firstName: 'Marta',
  lastName: 'Alvarez',
  email: 'marta.alvarez@example.com',
  phoneNumber: '+34 600 000 000',
  address: { city: 'Barcelona', country: 'ES' },
  createdFrom: 'pms',
};

const COMPANION: StoredCompanion = {
  id: 'companion-kiko',
  organisationId: ORG_ID,
  parentId: PET_PARENT,
  name: 'Kiko',
  type: 'dog',
  breed: 'Border Collie',
  dateOfBirth: new Date('2019-04-18T00:00:00.000Z'),
  gender: 'male',
  isInsured: false,
  status: 'active',
};

const task = (over: Partial<Task> = {}): Task => ({
  _id: 'task-analgesia',
  organisationId: ORG_ID,
  companionId: COMPANION.id,
  assignedBy: ME,
  assignedTo: ME,
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'MEDICATION',
  priority: 'HIGH',
  name: 'Midday analgesia round',
  description: 'Meloxicam 0.1mg/kg PO, then recheck the incision site.',
  // A fixed instant. `getPreferredTimeZone` falls back to Europe/Berlin whenever
  // no timezone token is stored, and every formatter here pins the en-US locale,
  // so the rendered date and time do not depend on the machine running this.
  dueAt: new Date('2026-03-12T12:00:00.000Z'),
  reminder: { enabled: true, offsetMinutes: 30 },
  syncWithCalendar: false,
  status: 'PENDING',
  ...over,
});

/**
 * Seeds the four stores the drawer reads, rather than mocking the modules.
 *
 * Nothing here fetches: `useTeamForPrimaryOrg` and `useCompanionsForPrimaryOrg` are
 * pure selectors, and the hooks that DO load (`useLoadTeam`, `useLoadCompanionsForPrimaryOrg`)
 * are separate and are not used by this drawer. So the real component runs against
 * the real stores with no network and no request stubbing - which this Storybook has
 * no wiring for anyway.
 */
const seed = (over: Partial<UserOrganization> = {}) => {
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: membership(over) },
    status: 'loaded',
  });
  useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAM);
  useCompanionStore.getState().setCompanionsForOrg(ORG_ID, [COMPANION]);
  useParentStore.getState().setParents([PARENT]);
  useAuthStore.setState({
    attributes: {
      sub: ME,
      email: 'elena.marsh@example.com',
      given_name: 'Elena',
      family_name: 'Marsh',
    },
  });
};

/**
 * The drawer is mounted on demand by the tasks page and unmounted on dismissal.
 * Reproducing that here keeps the docs page free of a dozen simultaneously open
 * dialogs, each holding a share of `ModalBase`'s ref-counted body scroll lock.
 */
const TaskDrawerHarness = ({
  showModal: _showModal,
  setShowModal: _setShowModal,
  ...args
}: TaskInfoProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[520px] items-start bg-[var(--screen)] p-6">
      <button
        type="button"
        className="rounded-2xl bg-[var(--cta)] px-6 py-3 text-body-3-emphasis text-[var(--cta-text)]"
        onClick={() => setOpen(true)}
      >
        Open task drawer
      </button>
      {open && <TaskInfo {...args} showModal setShowModal={setOpen} />}
    </div>
  );
};

const openDrawer = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Open task drawer' }));
  return waitFor(() => {
    const node = document.querySelector('dialog[open]');
    expect(node).not.toBeNull();
    return node as HTMLElement;
  });
};

/**
 * Every read-mode row label, in render order.
 *
 * Keyed on the label cell's own class rather than on text, because the labels are
 * not unique in the tree: "Task" is also the drawer's eyebrow, and the accordion
 * headers repeat "Status". `FieldValueRow` is the only thing in here that renders
 * `text-body-4-emphasis`, so this counts rows and nothing else.
 */
const rowLabels = (scope: HTMLElement): string[] =>
  [...scope.querySelectorAll('.text-body-4-emphasis')].map((cell) =>
    (cell.textContent ?? '').trim()
  );

/** The value rendered beside one row label. */
const rowValue = (scope: HTMLElement, label: string): string => {
  const cell = [...scope.querySelectorAll('.text-body-4-emphasis')].find(
    (node) => (node.textContent ?? '').trim() === label
  );
  if (!cell) {
    throw new Error(`No "${label}" row is being rendered in read mode.`);
  }
  return (cell.nextElementSibling?.textContent ?? '').trim();
};

const ONE_OFF_ROWS = [
  'Status',
  'Task',
  'Category',
  'Priority',
  'Instructions (optional)',
  'From',
  'To',
  'Due date',
  'Due time',
  'Reminder',
  'Repeat',
  'Sync with calendar',
];

const meta = {
  title: 'Tasks/TaskInfo',
  component: TaskInfo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The task detail drawer: two `EditableAccordion`s (Status, Task details) inside a 470px ' +
          '`Modal`, plus a Reuse action that only exists on a finished task.\n\n' +
          'What makes it worth stories is that **it renders four different drawers from the same ' +
          'props**. `useTaskEditMode` compares the signed-in user against the task and returns ' +
          '`FULL` (I raised it and I own it), `DETAILS_ONLY` (I raised it, someone else owns it), ' +
          '`STATUS_ONLY` (someone else raised it, I own it) or `NONE`. The only visible difference ' +
          'between those four is **which pencil icons are present** - there is no banner, no ' +
          'disabled styling and no explanation - so a regression in that hook shows up as a ' +
          'missing or an extra pencil and nothing else. All four are drawn below.\n\n' +
          'Two findings this pass turned up, both visible in the frames rather than in the code:\n\n' +
          '- **The Due time row renders blank.** `taskData.dueTime` is a clock string ("13:00"), ' +
          'and the `timeInput` read renderer sends it through `formatTimeLabel`, which parses with ' +
          '`new Date("13:00")` - an Invalid Date - and returns its empty fallback. The row draws ' +
          'its label and nothing beside it. It is not even the dash the other unset rows use.\n' +
          '- **The same person appears under two names.** The From row resolves through ' +
          '`useMemberMap`, whose last write is the profile name of the signed-in user, while the ' +
          'To row resolves through the assignee dropdown options, which use the team record. A ' +
          'task I raised for myself therefore reads "Elena Marsh" on one line and "Dr. Elena ' +
          'Marsh" on the next.\n\n' +
          'Also worth attention from a reviewer: this drawer passes no `aria-label` and no ' +
          '`titleId` to its `Modal`, so the `<dialog>` has no accessible name even though ' +
          '`ModalHeader` already accepts one.\n\n' +
          'Editing a task that belongs to a recurring series does not save - it opens ' +
          '`RecurrenceScopeModal` over the drawer and holds the payload in a ref until the scope ' +
          'is chosen. That two-dialog frame is drawn below and had never been seen anywhere.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    activeTask: task(),
    onReuseTask: fn(),
  },
  beforeEach: () => {
    seed();
  },
  render: (args) => <TaskDrawerHarness {...args} />,
} satisfies Meta<typeof TaskInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullAccess: Story = {
  name: 'Full access (mine, raised by me)',
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);
    const panel = within(drawer);

    await expect(
      panel.getByRole('heading', { name: 'Midday analgesia round' })
    ).toBeInTheDocument();
    await expect(panel.getByText('Due Mar 12, 2026')).toBeInTheDocument();

    // Both accordions open by default, so the drawer's whole read surface is one
    // list of rows. Assert the list, not that "some rows rendered": a field
    // dropped from the config disappears silently.
    await expect(rowLabels(drawer)).toEqual(ONE_OFF_ROWS);

    await expect(rowValue(drawer, 'Status')).toBe('Pending');
    await expect(rowValue(drawer, 'Task')).toBe('Midday analgesia round');
    await expect(rowValue(drawer, 'Category')).toBe('Medication');
    await expect(rowValue(drawer, 'Priority')).toBe('High');
    await expect(rowValue(drawer, 'Due date')).toBe('Mar 12, 2026');
    await expect(rowValue(drawer, 'Reminder')).toBe('30 minutes before');
    await expect(rowValue(drawer, 'Repeat')).toBe('Does not repeat');
    await expect(rowValue(drawer, 'Sync with calendar')).toBe('No');

    // DEFECT, recorded deliberately: the value cell is empty rather than a time or
    // a dash. `formatTimeLabel('13:00')` parses to an Invalid Date and falls back
    // to ''. When that is fixed this line goes red, which is the point.
    await expect(rowValue(drawer, 'Due time')).toBe('');

    // DEFECT, recorded deliberately: one person, two names, on adjacent rows.
    await expect(rowValue(drawer, 'From')).toBe('Elena Marsh');
    await expect(rowValue(drawer, 'To')).toBe('Dr. Elena Marsh');

    // FULL is the only mode with both pencils.
    await expect(panel.getByRole('button', { name: 'Edit Status' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Edit Task details' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everything-allowed drawer, and the baseline the three restricted modes below are ' +
          'read against. Note the two rows carrying the findings named above: Due time is blank, ' +
          'and From and To name the same person differently.',
      },
    },
  },
};

export const DetailsOnly: Story = {
  name: 'Details only (I raised it for someone else)',
  args: { activeTask: task({ assignedTo: COLLEAGUE }) },
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);
    const panel = within(drawer);

    await expect(rowValue(drawer, 'To')).toBe('Dr. Ravi Patel');
    await expect(panel.getByRole('button', { name: 'Edit Task details' })).toBeInTheDocument();
    // Whoever is doing the work owns its status; the raiser cannot move it for them.
    await expect(panel.queryByRole('button', { name: 'Edit Status' })).not.toBeInTheDocument();
    await expect(rowLabels(drawer)).toEqual(ONE_OFF_ROWS);
  },
  parameters: {
    docs: {
      description: {
        story:
          'One pencil, on the lower accordion. The Status accordion still renders its row and its ' +
          'header - only the pencil is gone - so at a glance this is indistinguishable from the ' +
          'full drawer.',
      },
    },
  },
};

export const StatusOnly: Story = {
  name: 'Status only (someone else raised it for me)',
  args: { activeTask: task({ assignedBy: COLLEAGUE }) },
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);
    const panel = within(drawer);

    await expect(rowValue(drawer, 'From')).toBe('Dr. Ravi Patel');
    await expect(rowValue(drawer, 'To')).toBe('Dr. Elena Marsh');
    await expect(panel.getByRole('button', { name: 'Edit Status' })).toBeInTheDocument();
    await expect(
      panel.queryByRole('button', { name: 'Edit Task details' })
    ).not.toBeInTheDocument();
    // The same twelve rows as every other mode. Asserted in all four so the
    // comparison the docs above ask a reviewer to make is actually enforced:
    // restricting edit rights must not quietly drop a row from the read view.
    await expect(rowLabels(drawer)).toEqual(ONE_OFF_ROWS);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The mirror image, and the most common drawer in practice: the person doing the work can ' +
          'report progress but cannot rewrite the instruction they were given.',
      },
    },
  },
};

export const NoAccess: Story = {
  name: "No access (someone else's task)",
  args: { activeTask: task({ assignedBy: COLLEAGUE, assignedTo: COLLEAGUE }) },
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);
    const panel = within(drawer);

    await expect(panel.queryByRole('button', { name: 'Edit Status' })).not.toBeInTheDocument();
    await expect(
      panel.queryByRole('button', { name: 'Edit Task details' })
    ).not.toBeInTheDocument();
    // Read-only does not mean empty: every row is still there to be read.
    await expect(rowLabels(drawer)).toEqual(ONE_OFF_ROWS);
    await expect(rowValue(drawer, 'From')).toBe('Dr. Ravi Patel');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A task between two colleagues. The drawer is a viewer, with nothing to say that it is ' +
          'one.',
      },
    },
  },
};

export const PermissionRevoked: Story = {
  name: 'Permission revoked (my own task, still read-only)',
  beforeEach: () => {
    // Every role in the table carries tasks:edit, so NONE is only reachable this
    // way in practice: a per-membership revocation. Same drawer as the story
    // above, reached by a completely different route.
    seed({ revokedPermissions: ['tasks:edit:any', 'tasks:edit:own'] });
  },
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);
    const panel = within(drawer);

    await expect(panel.queryByRole('button', { name: 'Edit Status' })).not.toBeInTheDocument();
    await expect(
      panel.queryByRole('button', { name: 'Edit Task details' })
    ).not.toBeInTheDocument();
    // Identical to the NoAccess frame above, row for row and value for value -
    // which is the finding. The two are reached through completely different
    // branches (ownership vs the permission gate ahead of it) and a reviewer has
    // no way to tell them apart on screen.
    await expect(rowLabels(drawer)).toEqual(ONE_OFF_ROWS);
    await expect(rowValue(drawer, 'From')).toBe('Elena Marsh');
    await expect(rowValue(drawer, 'To')).toBe('Dr. Elena Marsh');
    await expect(rowValue(drawer, 'Status')).toBe('Pending');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The task is mine and raised by me, so ownership says FULL - the permission check ahead ' +
          'of it says otherwise and wins. Worth having both routes drawn, because the resulting ' +
          'frame is identical and the causes are not.',
      },
    },
  },
};

export const EditingDetails: Story = {
  name: 'Editing the details',
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);
    const panel = within(drawer);

    await userEvent.click(panel.getByRole('button', { name: 'Edit Task details' }));

    // Every editable row swaps to a control, so the only read-mode rows LEFT are
    // the ones the config marks uneditable - From here, plus Status in the other
    // accordion. That is a much stronger check than "an input appeared".
    await waitFor(() => expect(rowLabels(drawer)).toEqual(['Status', 'From']));
    await expect(rowValue(drawer, 'From')).toBe('Elena Marsh');

    await expect(panel.getByRole('textbox', { name: 'Task' })).toHaveValue(
      'Midday analgesia round'
    );
    await expect(panel.getByRole('textbox', { name: 'Instructions (optional)' })).toHaveValue(
      'Meloxicam 0.1mg/kg PO, then recheck the incision site.'
    );
    await expect(panel.getByRole('button', { name: 'Category: Medication' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'To: Dr. Elena Marsh' })).toBeInTheDocument();
    // The time survives perfectly well into the EDIT control - which localises the
    // blank Due time row above to the read renderer alone, not to the data.
    await expect(panel.getByRole('button', { name: 'Due time: 13:00' })).toBeInTheDocument();

    // The action row is the accordion's own 2-up grid, not the centered pill pair
    // the dialogs use - a full-width Cancel | Save split under the form. Track
    // count AND child count, because a dropped template collapses it to a stacked
    // pair that still renders both buttons.
    const save = panel.getByRole('button', { name: 'Save' });
    const actionRow = save.parentElement as HTMLElement;
    await expect(getComputedStyle(actionRow).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(
      2
    );
    await expect(actionRow.children).toHaveLength(2);
    await expect([...actionRow.children].map((child) => (child.textContent ?? '').trim())).toEqual([
      'Cancel',
      'Save',
    ]);

    await userEvent.click(panel.getByRole('button', { name: 'Cancel' }));

    // Cancel rebuilds the form from `data`, so the full read list comes back.
    await waitFor(() => expect(rowLabels(drawer)).toEqual(ONE_OFF_ROWS));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The edit form: eleven rows become a text input, five dropdowns, a datepicker, a time ' +
          'picker and a Cancel/Save pair, inside a 470px drawer that now scrolls. The uneditable ' +
          'From row stays a plain value row in the middle of the form, which is the layout detail ' +
          'this frame exists to expose.',
      },
    },
  },
};

export const EditingStatus: Story = {
  name: 'Editing the status',
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);
    const panel = within(drawer);

    await userEvent.click(panel.getByRole('button', { name: 'Edit Status' }));
    await userEvent.click(await panel.findByRole('button', { name: 'Status: Pending' }));

    // The menu portals to document.body, outside the dialog and outside the canvas.
    // Take the LAST panel: one left open by another story would otherwise be read.
    const menu = await waitFor(() => {
      const panels = document.querySelectorAll('[data-portal-dropdown]');
      expect(panels.length).toBeGreaterThan(0);
      return panels[panels.length - 1] as HTMLElement;
    });
    const options = [...menu.querySelectorAll('button')].map((option) =>
      (option.textContent ?? '').trim()
    );
    // Same transition table the standalone ChangeTaskStatus dialog filters on. The
    // two surfaces derive their lists independently, so this is the assertion that
    // keeps them in agreement.
    await expect(options).toEqual(['Pending', 'In Progress', 'Completed', 'Cancelled']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second place in the product a task status can be changed. It is a plain dropdown ' +
          'inside the accordion rather than the shared `ChangeStatusModal`, and it computes its own ' +
          'allowed list - a drift between the two would be invisible without both being drawn.',
      },
    },
  },
};

export const RecurringTask: Story = {
  name: 'Recurring task (grows an End date)',
  args: {
    activeTask: task({
      _id: 'task-recurring',
      name: 'Twice-daily wound check',
      recurrence: {
        type: 'DAILY',
        isMaster: true,
        endDate: new Date('2026-03-31T23:59:59.000Z'),
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);

    // The End date row is conditional on the recurrence type, so a repeating task
    // renders one row MORE than a one-off - the count, and its position, matter.
    await expect(rowLabels(drawer)).toEqual([
      'Status',
      'Task',
      'Category',
      'Priority',
      'Instructions (optional)',
      'From',
      'To',
      'Due date',
      'Due time',
      'Reminder',
      'Repeat',
      'End date',
      'Sync with calendar',
    ]);
    await expect(rowValue(drawer, 'Repeat')).toBe('Daily');
    // The whole label, not `toContain('2026')`. The end date travels through two
    // conversions before it is drawn - `toISOString().slice(0, 10)` on the way
    // into the form, then parsed back and formatted in the preferred timezone -
    // and either one landing a day out still contains "2026".
    await expect(rowValue(drawer, 'End date')).toBe('Mar 31, 2026');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A one-off task has a due date and nothing else; a repeating one also has a horizon. The ' +
          'row is inserted between Repeat and Sync with calendar rather than appended, so this is ' +
          'the only frame that shows the drawer at its full height.',
      },
    },
  },
};

export const SeriesEditAsksForScope: Story = {
  name: 'Saving a series edit asks for scope',
  args: {
    activeTask: task({
      _id: 'task-recurring',
      name: 'Twice-daily wound check',
      recurrence: { type: 'DAILY', isMaster: true },
    }),
  },
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);
    const panel = within(drawer);

    await userEvent.click(panel.getByRole('button', { name: 'Edit Task details' }));
    await userEvent.click(await panel.findByRole('button', { name: 'Save' }));

    // Save does not write. `isSeriesTask` diverts the payload into a ref and opens
    // a SECOND dialog over the drawer, so both are open at once - a nesting the
    // shared modal stack exists for and that nothing had ever rendered.
    await waitFor(() => expect(document.querySelectorAll('dialog[open]')).toHaveLength(2));
    const scope = document.querySelectorAll('dialog[open]')[1] as HTMLElement;

    await expect(
      within(scope).getByRole('heading', { name: 'Edit recurring task' })
    ).toBeInTheDocument();
    await expect(
      within(scope).getByText(/"Twice-daily wound check" is part of a recurring series/)
    ).toBeInTheDocument();
    await expect(within(scope).getAllByRole('radio')).toHaveLength(3);
    await expect(within(scope).getByRole('radio', { name: 'This task only' })).toBeChecked();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Nothing is confirmed here - `onConfirm` is what calls `updateTask`, so the story stops ' +
          'at the frame before the write. Look at the stacking: the scope dialog is centered over ' +
          'a right-hand drawer that is still fully drawn behind it, and only the topmost one ' +
          'answers Escape.',
      },
    },
  },
};

export const CompletedTask: Story = {
  name: 'Completed (read-only, with Reuse)',
  args: {
    activeTask: task({
      status: 'COMPLETED',
      completedAt: new Date('2026-03-12T13:10:00.000Z'),
    }),
  },
  play: async ({ canvasElement, args }) => {
    const drawer = await openDrawer(canvasElement);
    const panel = within(drawer);

    await expect(rowValue(drawer, 'Status')).toBe('Completed');
    // A finished task is frozen regardless of who owns it: `effectiveEditMode` is
    // forced to NONE, so the FULL-access reader loses both pencils.
    await expect(panel.queryByRole('button', { name: 'Edit Status' })).not.toBeInTheDocument();
    await expect(
      panel.queryByRole('button', { name: 'Edit Task details' })
    ).not.toBeInTheDocument();

    // The footer only exists on this one state - it is the whole reason the drawer
    // has a `ModalFooter` at all.
    await userEvent.click(panel.getByRole('button', { name: 'Reuse task' }));
    await expect(args.onReuseTask).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: '',
        status: 'PENDING',
        name: 'Midday analgesia round',
        category: 'MEDICATION',
      })
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reuse hands the caller a stripped copy - blank id, status back to Pending, due date ' +
          'today, completion metadata dropped - and closes the drawer. It never writes anything ' +
          'itself, which is why this story can press it.',
      },
    },
  },
};

export const UnresolvableAssignee: Story = {
  name: 'Assignee who left the practice',
  args: { activeTask: task({ assignedTo: 'c3b4a812-4051-701e-08ce-cb5c2a489951' }) },
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);

    // A member outside the org resolves to nothing, and the raw id used to be
    // printed here - a UUID where a name belongs. The fallback has to be a
    // sentence, and it has to survive into the To dropdown's options too.
    await expect(rowValue(drawer, 'To')).toBe('Unavailable member');
    await expect(drawer.textContent).not.toContain('c3b4a812');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Someone who left, or who belongs to another organisation. This is the guard in ' +
          '`useTaskInfoFields` under load - and the board does NOT have it, so the same task ' +
          'renders a raw identifier on a card and a readable sentence here.',
      },
    },
  },
};

export const ParentTask: Story = {
  name: 'Pet-parent task',
  args: {
    activeTask: task({
      _id: 'task-parent',
      audience: 'PARENT_TASK',
      name: 'Send the discharge photos',
      category: 'COMMUNICATION',
      assignedTo: PET_PARENT,
    }),
  },
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);

    // The assignee list switches source entirely for a parent task: it is built
    // from the companions' parents rather than from the team, so a broken switch
    // shows up as a To row that cannot resolve its own value.
    await expect(rowValue(drawer, 'To')).toBe('Marta Alvarez');
    await expect(rowValue(drawer, 'Category')).toBe('Communication');
    await expect(rowValue(drawer, 'From')).toBe('Elena Marsh');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Tasks addressed to the owner rather than to staff. Same drawer, same rows, a different ' +
          'population behind the To dropdown.',
      },
    },
  },
};

export const PhoneDrawer: Story = {
  name: 'Phone (375)',
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and silently renders desktop markup under a phone name.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const drawer = await openDrawer(canvasElement);

    // Below 768px `Modal` swaps the 470px right-hand drawer for a full-screen
    // panel. `useIsPhone` is false during the first render, so this is a
    // post-mount swap that a static desktop snapshot never contains.
    await waitFor(() => expect(drawer.className).toContain('yc-modal-fullscreen'));
    // `yc-modal-fullscreen` is `inset: 0; width: 100%`, so full-screen means
    // exactly the viewport width - not merely "wider than the 470px drawer",
    // which a partially-applied class would also satisfy.
    await expect(Math.round(drawer.getBoundingClientRect().width)).toBe(
      document.documentElement.clientWidth
    );
    await expect(rowLabels(drawer)).toEqual(ONE_OFF_ROWS);
    // The values survive the swap too: the phone panel is a re-layout, not a
    // reduced drawer with rows dropped to fit.
    await expect(rowValue(drawer, 'Reminder')).toBe('30 minutes before');
    await expect(rowValue(drawer, 'To')).toBe('Dr. Elena Marsh');
    await expect(
      within(drawer).getByRole('heading', { name: 'Midday analgesia round' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Twelve label/value rows in a `justify-between` row each, at 375px. The long ones - the ' +
          'instructions line, and a To row holding a full name - are where this layout gives out ' +
          'first.',
      },
    },
  },
};
