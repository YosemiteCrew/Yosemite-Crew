import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import type { StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import type { Team } from '@/app/features/organization/types/team';
import type { Task } from '@/app/features/tasks/types/task';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { useAuthStore } from '@/app/stores/authStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useTeamStore } from '@/app/stores/teamStore';
import TaskBoard from './TaskBoard';

const ORG_ID = 'org-storybook';
const ME = 'practitioner-elena';
const COLLEAGUE = 'practitioner-ravi';

const MEMBERSHIP: UserOrganization = {
  id: 'membership-1',
  practitionerReference: `Practitioner/${ME}`,
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  roleDisplay: 'Veterinarian',
  active: true,
};

const teamMember = (practionerId: string, name: string, image?: string): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  image,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const TEAM: Team[] = [
  teamMember(ME, 'Dr. Elena Marsh'),
  // A legacy relative photo key, which is what older team rows actually carry.
  // `getSafeImageUrl` degrades anything that is not an https URL to the shared
  // person avatar, so this draws the <Image> branch of the assignee chip without
  // handing next/image a value it would reject.
  teamMember(COLLEAGUE, 'Dr. Ravi Patel', 'team/legacy-key.jpg'),
];

const COMPANION: StoredCompanion = {
  id: 'companion-kiko',
  organisationId: ORG_ID,
  parentId: 'parent-marta',
  name: 'Kiko',
  type: 'dog',
  breed: 'Border Collie',
  dateOfBirth: new Date('2019-04-18T00:00:00.000Z'),
  gender: 'male',
  isInsured: false,
  status: 'active',
};

/**
 * A fixed base instant so the card meta lines are stable. The preferred timezone
 * falls back to Europe/Berlin when nothing is stored and every formatter pins
 * en-US, so what renders does not depend on the machine.
 */
const DUE_BASE = new Date('2026-03-12T09:00:00.000Z');
const dueIn = (minutes: number) => new Date(DUE_BASE.getTime() + minutes * 60_000);

const task = (over: Partial<Task> = {}): Task => ({
  _id: 'task-1',
  organisationId: ORG_ID,
  assignedBy: ME,
  assignedTo: COLLEAGUE,
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'MEDICATION',
  priority: 'MEDIUM',
  name: 'Task',
  dueAt: dueIn(60),
  status: 'PENDING',
  ...over,
});

const seed = () => {
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
    status: 'loaded',
  });
  useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAM);
  useCompanionStore.getState().setCompanionsForOrg(ORG_ID, [COMPANION]);
  // Cleared, not merely left alone. Zustand stores are module singletons shared
  // by every story in the session, and `TaskInfo.stories` seeds a parent record
  // under this same id. Without this reset, viewing that file first makes the
  // board resolve `parent-marta` to "Marta Alvarez" through `useMemberMap` and
  // the raw-id finding below silently changes with the order the stories were
  // opened in. The board itself never loads parents - nothing on the tasks page
  // does - so an empty parent store is also what a real /tasks visit starts from.
  useParentStore.getState().clearParents();
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
 * The due-time fragment of a card's meta line, built with the app's own formatter.
 *
 * Not hardcoded as "2:00 PM": `getPreferredTimeZone` reads a localStorage token, so
 * a reviewer who changed the timezone anywhere else in this Storybook would make a
 * literal string fail for a reason that has nothing to do with the board. Composing
 * the expected line this way still pins the separator, the category label, the
 * assignee and WHICH task's time is being printed.
 */
const dueTimeLabel = (task: Task): string =>
  formatDateInPreferredTimeZone(new Date(task.dueAt), { hour: 'numeric', minute: '2-digit' });

/* ─────────────────────────── DOM readers ─────────────────────────── */

/**
 * The four column elements, in `BOARD_COLUMNS` order.
 *
 * Read positionally off the track rather than by heading text: the columns carry
 * no test id, and a text lookup would also match a card whose title happens to
 * contain the word.
 */
const boardTrack = (canvasElement: HTMLElement): HTMLElement => {
  const root = canvasElement.querySelector('[data-board-scroll-root="true"]');
  if (!root?.firstElementChild) {
    throw new Error('The board never rendered its column track.');
  }
  return root.firstElementChild as HTMLElement;
};

const boardColumns = (canvasElement: HTMLElement): HTMLElement[] =>
  [...boardTrack(canvasElement).children] as HTMLElement[];

const COLUMN = { pending: 0, inProgress: 1, completed: 2, cancelled: 3 } as const;

/** Header row layout: [dot + label, count]. */
const columnHeader = (column: HTMLElement): Element => {
  const header = column.firstElementChild?.firstElementChild;
  if (!header) throw new Error('A board column rendered without its header row.');
  return header;
};

const columnLabel = (column: HTMLElement): string =>
  (columnHeader(column).children[0]?.textContent ?? '').trim();

const columnCount = (column: HTMLElement): string =>
  (columnHeader(column).children[1]?.textContent ?? '').trim();

/** The scrolling card list, which is the element the collapse keeps inside its box. */
const columnScroller = (column: HTMLElement): HTMLElement => column.children[1] as HTMLElement;

const cardsIn = (column: HTMLElement): HTMLElement[] => [...column.querySelectorAll('article')];

/* Card layout: [full-bleed open button, title, meta, (progress), (footer), (updating)]. */
const cardTitle = (card: Element): string => (card.children[1]?.textContent ?? '').trim();
const cardMeta = (card: Element): string => (card.children[2]?.textContent ?? '').trim();
const cardTitles = (column: HTMLElement): string[] => cardsIn(column).map(cardTitle);

/* ─────────────────────────── Fixtures ─────────────────────────── */

const MIXED_TASKS: Task[] = [
  task({
    _id: 'p-1',
    name: 'Emergency triage handover',
    status: 'PENDING',
    priority: 'URGENT',
    category: 'CARE',
    dueAt: dueIn(240),
  }),
  task({
    _id: 'p-2',
    name: 'Midday analgesia round',
    status: 'PENDING',
    priority: 'HIGH',
    assignedTo: ME,
    companionId: COMPANION.id,
    dueAt: dueIn(120),
  }),
  task({
    _id: 'p-3',
    name: 'Order more 22g catheters',
    status: 'PENDING',
    priority: 'LOW',
    category: 'ADMIN',
    dueAt: dueIn(30),
  }),
  task({
    _id: 'p-4',
    name: 'Upload the post-op photos',
    status: 'PENDING',
    audience: 'PARENT_TASK',
    category: 'COMMUNICATION',
    assignedTo: 'parent-marta',
    dueAt: dueIn(300),
  }),
  task({
    _id: 'i-1',
    name: 'Dental chart for Kiko',
    status: 'IN_PROGRESS',
    category: 'PROCEDURE',
    assignedTo: ME,
    dueAt: dueIn(90),
  }),
  task({
    _id: 'c-1',
    name: 'Morning kennel walk',
    status: 'COMPLETED',
    category: 'CARE',
    assignedTo: ME,
    dueAt: dueIn(-120),
  }),
  task({
    _id: 'x-1',
    name: 'Repeat bloods for Nala',
    status: 'CANCELLED',
    category: 'DIAGNOSTIC',
    dueAt: dueIn(-60),
  }),
];

/** Eight settled tasks, which is four times what a collapsing column will show. */
const OVERFLOW_TASKS: Task[] = [
  ...Array.from({ length: 5 }, (_, index) =>
    task({
      _id: `p-${index + 1}`,
      name: `Pending round ${index + 1}`,
      status: 'PENDING',
      dueAt: dueIn(index * 30),
    })
  ),
  ...Array.from({ length: 8 }, (_, index) =>
    task({
      _id: `c-${index + 1}`,
      name: `Completed round ${index + 1}`,
      status: 'COMPLETED',
      dueAt: dueIn(-600 + index * 30),
    })
  ),
  ...Array.from({ length: 4 }, (_, index) =>
    task({
      _id: `x-${index + 1}`,
      name: `Cancelled round ${index + 1}`,
      status: 'CANCELLED',
      dueAt: dueIn(-900 + index * 30),
    })
  ),
];

const meta = {
  title: 'Tasks/TaskBoard',
  component: TaskBoard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The tasks kanban: four status columns, drag between them, and a card that changes shape ' +
          'with the task on it.\n\n' +
          '`BoardColumn` is module-private, so it is driven through the exported board rather than ' +
          'exported for a story. It costs three store seeds and nothing else - the board reads ' +
          'team, companions and auth through pure selectors, and the hooks that actually fetch ' +
          '(`useLoadTeam`, `useLoadCompanionsForPrimaryOrg`) are separate and not used here. Real ' +
          'component, real stores, no network.\n\n' +
          '**The "+N more" collapse is not an overflow behaviour**, which is the single most ' +
          'misread thing about this file. `COLLAPSING_COLUMNS` holds Completed and Cancelled, and ' +
          '`COLLAPSED_CARD_COUNT` is 2: those two columns truncate to two cards as soon as they ' +
          'hold a third, whatever the column height is, and Pending and In progress never truncate ' +
          'no matter how far they overflow. The collapse story below sets the board short enough ' +
          'that Pending genuinely overflows and scrolls while Completed - holding four times as ' +
          'many cards - fits comfortably and truncates anyway. That inversion is the behaviour, ' +
          'and it had never been rendered.\n\n' +
          'The card has five variants that no snapshot had contained: a pink-bordered pet-parent ' +
          'card, a done card (struck-through title, no footer), a cancelled card, an in-progress ' +
          'card with a slim `<progress>` elapsed track, and a plain pending card. The muted states ' +
          'deliberately carry **no opacity** - the meta line composited to 3.16:1 at 0.70 - so they ' +
          'recede in ink and shadow only, and the difference between "done" and "pending" is worth ' +
          'looking at directly.\n\n' +
          'Layout re-forms at `lg` (1024px): a four-track CSS grid above it, a row of fixed 320px ' +
          'columns in a horizontal scroller below. Both are drawn.\n\n' +
          'One finding: a pet-parent card resolves its assignee through the team map only, so a ' +
          'task addressed to an owner who is not a practitioner falls back to printing the raw ' +
          'identifier in the meta line. The task drawer fixed exactly this with an "Unavailable ' +
          'member" fallback; the board did not.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    tasks: MIXED_TASKS,
    canEditTasks: true,
    setActiveTask: fn(),
    setViewPopup: fn(),
    onAddTask: fn(),
  },
  beforeEach: () => {
    seed();
  },
  decorators: [
    (Story) => (
      <div className="h-[560px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TaskBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BoardColumns: Story = {
  name: 'Four columns',
  // Pinned even though `laptop` is already the project's initialGlobals value.
  // The viewport global PERSISTS across stories once a reader touches the toolbar,
  // so opening the phone story below and coming back here would render this one at
  // 375 - where the grid is off entirely and the four-track assertion fails for a
  // reason that has nothing to do with the board.
  globals: { viewport: { value: 'laptop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const track = boardTrack(canvasElement);
    const columns = boardColumns(canvasElement);

    // A CSS grid pretending to be a board: nothing enforces that the track count
    // and the child count agree, and a dropped or malformed template collapses to
    // a single column that still renders every card, just stacked.
    const tracks = getComputedStyle(track).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(4);
    await expect(columns).toHaveLength(4);

    await expect(columns.map(columnLabel)).toEqual([
      'Pending',
      'In progress',
      'Completed',
      'Cancelled',
    ]);
    await expect(columns.map(columnCount)).toEqual(['4', '1', '1', '1']);

    // Ordering is priority first, then due time - so the urgent card leads and the
    // low-priority one sinks, regardless of when either is due.
    await expect(cardTitles(columns[COLUMN.pending])).toEqual([
      'Emergency triage handover',
      'Midday analgesia round',
      'Upload the post-op photos',
      'Order more 22g catheters',
    ]);

    // Four meta shapes, built by four different branches of `buildBoardMeta`.
    // Asserted whole rather than by regex: a `.+` in the middle would accept a
    // blank time, the wrong task's time, or a missing separator.
    await expect(cardMeta(cardsIn(columns[COLUMN.pending])[0])).toBe(
      `Care · due ${dueTimeLabel(MIXED_TASKS[0])} · Dr. Ravi Patel`
    );
    await expect(cardMeta(cardsIn(columns[COLUMN.completed])[0])).toBe('Care · done · you');
    await expect(cardMeta(cardsIn(columns[COLUMN.cancelled])[0])).toBe(
      'Cancelled · Dr. Ravi Patel'
    );
    // FINDING: a pet-parent task prints the raw assignee id where a name belongs,
    // because the board resolves through the team map only.
    await expect(cardMeta(cardsIn(columns[COLUMN.pending])[2])).toBe('Parent task · parent-marta');

    // The card footer: assignee chip on the left, companion thumbnail on the right.
    // Initials rather than photos on both, because neither record carries an image.
    const mine = cardsIn(columns[COLUMN.pending])[1];
    const footer = mine.children[3] as HTMLElement;
    await expect(footer.children).toHaveLength(2);
    await expect((footer.children[0].textContent ?? '').trim()).toBe('EMyou');
    await expect((footer.children[1].textContent ?? '').trim()).toBe('K');

    // The colleague's row carries a photo key, so that chip renders an <img>.
    const theirs = cardsIn(columns[COLUMN.pending])[0];
    await expect(theirs.querySelector('img')).toHaveAttribute('alt', 'Dr. Ravi Patel');

    // Done and cancelled cards drop the footer entirely rather than dimming it:
    // three children (open button, title, meta) against the four a live card has.
    await expect(cardsIn(columns[COLUMN.completed])[0].children).toHaveLength(3);
    await expect(mine.children).toHaveLength(4);

    // Only terminal cards refuse to be picked up: `draggable` is gated on the
    // status having any legal transition at all.
    await expect(cardsIn(columns[COLUMN.pending])[0].draggable).toBe(true);
    await expect(cardsIn(columns[COLUMN.completed])[0].draggable).toBe(false);

    // The add affordance belongs to Pending alone.
    await expect(
      within(columns[COLUMN.pending]).getByRole('button', { name: 'Add task to Pending' })
    ).toBeInTheDocument();
    await expect(
      within(columns[COLUMN.completed]).queryByRole('button', { name: 'Add task to Pending' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting board with one of every card in it. Read the four meta lines against each ' +
          'other: they come from four separate branches and only agree on the middle dot.',
      },
    },
  },
};

export const ColumnOverflowCollapse: Story = {
  name: 'Column collapse ("+ 6 more")',
  args: { tasks: OVERFLOW_TASKS },
  // Pinned for the same reason as the story above: the scroll-height comparisons
  // below are read against a 420px board of four grid columns, and a leaked
  // `mobile` global would measure 320px flex columns instead.
  globals: { viewport: { value: 'laptop', isRotated: false } },
  decorators: [
    // Deliberately short. At this height the Pending column - five cards with
    // footers - genuinely overflows and scrolls, while Completed holds eight
    // shorter cards that would fit and truncates anyway. That inversion is the
    // whole point of the story.
    (Story) => (
      <div className="h-[420px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const track = boardTrack(canvasElement);
    const columns = boardColumns(canvasElement);
    const completed = columns[COLUMN.completed];
    const pending = columns[COLUMN.pending];

    // The board is still a four-track grid with four children while a column is
    // truncated. Collapsing changes what is INSIDE a column and must never
    // change the shape of the board, and a story that only indexed
    // `columns[2]` would keep passing if the grid had dropped to one track.
    await expect(getComputedStyle(track).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);
    await expect(columns).toHaveLength(4);

    // The header keeps the TRUE total while the list shows two. A collapse that
    // also truncated the count would read as "there are only 2" and lose 6 tasks.
    await expect(columnCount(completed)).toBe('8');
    await expect(cardsIn(completed)).toHaveLength(2);
    // The two survivors are the first two in board order, not an arbitrary pair.
    await expect(cardTitles(completed)).toEqual(['Completed round 1', 'Completed round 2']);
    await expect(within(completed).getByRole('button', { name: '+ 6 more' })).toBeInTheDocument();

    // Truncated, and comfortably inside its box - nothing here overflows.
    const completedScroller = columnScroller(completed);
    await expect(completedScroller.scrollHeight).toBeLessThanOrEqual(
      completedScroller.clientHeight
    );

    // Meanwhile the column that DOES overflow is the one with no collapse at all.
    const pendingScroller = columnScroller(pending);
    await expect(cardsIn(pending)).toHaveLength(5);
    await expect(pendingScroller.scrollHeight).toBeGreaterThan(pendingScroller.clientHeight);
    await expect(within(pending).queryByRole('button', { name: /more$/ })).not.toBeInTheDocument();

    // Cancelled collapses on the same rule with a different remainder.
    await expect(columnCount(columns[COLUMN.cancelled])).toBe('4');
    await expect(cardsIn(columns[COLUMN.cancelled])).toHaveLength(2);
    await expect(
      within(columns[COLUMN.cancelled]).getByRole('button', { name: '+ 2 more' })
    ).toBeInTheDocument();

    // Expanding restores every card and relabels the control.
    await userEvent.click(within(completed).getByRole('button', { name: '+ 6 more' }));
    await waitFor(() => expect(cardsIn(completed)).toHaveLength(8));
    await expect(cardTitles(completed)).toEqual([
      'Completed round 1',
      'Completed round 2',
      'Completed round 3',
      'Completed round 4',
      'Completed round 5',
      'Completed round 6',
      'Completed round 7',
      'Completed round 8',
    ]);
    await expect(within(completed).getByRole('button', { name: 'Show less' })).toBeInTheDocument();
    // Now it overflows, and the column scrolls rather than growing the board.
    await expect(columnScroller(completed).scrollHeight).toBeGreaterThan(
      columnScroller(completed).clientHeight
    );

    // And it collapses back: the control is a toggle, not a one-way reveal.
    await userEvent.click(within(completed).getByRole('button', { name: 'Show less' }));
    await waitFor(() => expect(cardsIn(completed)).toHaveLength(2));
    await expect(within(completed).getByRole('button', { name: '+ 6 more' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Eight completed tasks, four cancelled, five pending, in a board 420px tall. Completed ' +
          'and Cancelled truncate to two cards and offer the rest behind a link; Pending overflows ' +
          'its box and just scrolls. The collapse is keyed on the STATUS, not on the height - so ' +
          'a Completed column with three short cards in a tall board still hides one, and a ' +
          'Pending column with forty cards hides none.\n\n' +
          'The link is a bare text button in `--blue-text` with no underline, no icon and no hit ' +
          'padding beyond its line box, sitting where a reader expects the next card. Worth a ' +
          'look at whether it reads as a control at all.',
      },
    },
  },
};

export const EmptyBoard: Story = {
  name: 'Nothing to do',
  args: { tasks: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const columns = boardColumns(canvasElement);

    await expect(columns.map(columnCount)).toEqual(['0', '0', '0', '0']);
    // Every column states its own emptiness rather than the board stating it once.
    await expect(canvas.getAllByText('No tasks')).toHaveLength(4);
    await expect(cardsIn(columns[COLUMN.pending])).toHaveLength(0);
    // The add affordance survives the empty state, which is the only route into
    // the board from here.
    await expect(
      within(columns[COLUMN.pending]).getByRole('button', { name: 'Add task to Pending' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Four dashed placeholders rather than one empty-board illustration. On a fresh ' +
          'organisation this is the first screen anyone sees.',
      },
    },
  },
};

export const MineOnly: Story = {
  name: 'Scoped to my tasks',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = boardColumns(canvasElement);
    await expect(before.map(columnCount)).toEqual(['4', '1', '1', '1']);

    await userEvent.click(canvas.getByRole('button', { name: 'My tasks' }));

    await waitFor(() =>
      expect(boardColumns(canvasElement).map(columnCount)).toEqual(['1', '1', '1', '0'])
    );
    const columns = boardColumns(canvasElement);
    // Filtering is by assignee, so the parent task and the colleague's work leave
    // together - including a cancelled column that empties into its placeholder.
    await expect(cardTitles(columns[COLUMN.pending])).toEqual(['Midday analgesia round']);
    await expect(cardTitles(columns[COLUMN.inProgress])).toEqual(['Dental chart for Kiko']);
    await expect(within(columns[COLUMN.cancelled]).getByText('No tasks')).toBeInTheDocument();

    await expect(canvas.getByRole('button', { name: 'My tasks' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(canvas.getByRole('button', { name: 'All tasks' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The board has no filter bar - this segmented toggle is its entire filtering surface, ' +
          'and it sits alone in an otherwise empty control row above the columns. The scope is ' +
          'local state, so it resets on every remount.',
      },
    },
  },
};

export const ReadOnlyBoard: Story = {
  name: 'Without edit rights',
  args: { canEditTasks: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const columns = boardColumns(canvasElement);

    // Same four columns and the same cards - a reader loses the two ways of
    // changing anything and nothing else.
    await expect(columns.map(columnCount)).toEqual(['4', '1', '1', '1']);
    await expect(
      canvas.queryByRole('button', { name: 'Add task to Pending' })
    ).not.toBeInTheDocument();
    // Written as a list rather than `.every(...)`: an every() over an empty array
    // is true, so a board that rendered no cards at all would have passed the
    // read-only check it exists to make.
    await expect(cardsIn(columns[COLUMN.pending]).map((card) => card.draggable)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    // Opening a task is still allowed, so every card keeps its full-bleed button.
    await expect(
      within(columns[COLUMN.pending]).getByRole('button', {
        name: 'Open task Emergency triage handover',
      })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'No banner and no disabled styling: drag simply does not start, and the dashed Add tile ' +
          'is absent from the bottom of the Pending column.',
      },
    },
  },
};

export const ElapsedTrack: Story = {
  name: 'In-progress elapsed track',
  args: {
    tasks: [
      task({
        _id: 'i-live',
        name: 'Fluid therapy check',
        status: 'IN_PROGRESS',
        assignedTo: ME,
        // Relative to now on purpose: the track is drawn from `Date.now()` against
        // the run-up between the last update and the due time, so a fixed pair of
        // 2026 timestamps would always clamp to a full bar.
        updatedAt: new Date(Date.now() - 60 * 60_000),
        dueAt: new Date(Date.now() + 60 * 60_000),
      }),
      task({
        _id: 'p-live',
        name: 'Discharge paperwork',
        status: 'PENDING',
        assignedTo: ME,
        updatedAt: new Date(Date.now() - 60 * 60_000),
        dueAt: new Date(Date.now() + 60 * 60_000),
      }),
    ],
  },
  play: async ({ canvasElement }) => {
    const columns = boardColumns(canvasElement);
    await expect(columns).toHaveLength(4);
    await expect(columns.map(columnCount)).toEqual(['1', '1', '0', '0']);

    const track = within(columns[COLUMN.inProgress]).getByRole('progressbar', {
      name: 'Time elapsed toward due for Fluid therapy check',
    }) as HTMLProgressElement;
    // Halfway between the last update and the due time, so the value has to land
    // near the middle - a track stuck at 0 or clamped to 100 renders as a
    // perfectly plausible bar and tells the reader nothing. `max` is asserted
    // with it because a value of 50 against a max of 1 draws a full bar.
    await expect(track.max).toBe(100);
    await expect(track.value).toBeGreaterThan(35);
    await expect(track.value).toBeLessThan(65);

    // The same timestamps on a pending card draw no track at all: the guard is on
    // the status, so the bar means "running", not "overdue".
    await expect(
      within(columns[COLUMN.pending]).queryByRole('progressbar')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A native `<progress>` restyled into a 5px pill (`TaskBoard.css` paints the groove and ' +
          'the value per engine, since WebKit, Blink and Gecko each expose different ' +
          'pseudo-elements). It is drawn only for an in-progress task that carries usable ' +
          'timestamps, which is why every other story here has no track on any card.',
      },
    },
  },
};

export const PhoneBoard: Story = {
  name: 'Phone (375): a horizontal scroller',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 - it still type-checks and still runs, and silently renders the
  // desktop grid under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const track = boardTrack(canvasElement);
    const columns = boardColumns(canvasElement);

    // Below lg the grid is off entirely and the columns become a fixed-width flex
    // row. Assert both halves: `display` alone would still pass if the grid
    // template survived, and a stale template is what makes a 4-up board render
    // as one 320px column with everything crammed into it.
    await expect(getComputedStyle(track).display).toBe('flex');
    await expect(getComputedStyle(track).gridTemplateColumns).toBe('none');
    await expect(columns).toHaveLength(4);
    await expect(Math.round(columns[0].getBoundingClientRect().width)).toBe(320);

    // Four 320px columns plus gaps do not fit in 375, which is the point - the
    // board is swiped sideways rather than reflowed.
    const scrollRoot = track.parentElement as HTMLElement;
    await expect(scrollRoot.scrollWidth).toBeGreaterThan(scrollRoot.clientWidth);

    // Cards keep their full content at this width rather than dropping the footer.
    await expect(cardTitles(columns[COLUMN.pending])[0]).toBe('Emergency triage handover');
  },
  parameters: {
    docs: {
      description: {
        story:
          'One column and a sliver of the next, swiped horizontally. The wheel handler converts ' +
          'vertical scrolling into horizontal movement here, and each column keeps its own ' +
          'vertical scroller inside, so this frame has three nested scroll directions competing ' +
          'in 375px.',
      },
    },
  },
};
