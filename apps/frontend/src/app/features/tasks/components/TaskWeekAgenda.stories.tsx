import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import {
  getStartOfWeek,
  getWeekDays,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import type { Team } from '@/app/features/organization/types/team';
import type { Task } from '@/app/features/tasks/types/task';
import {
  formatDateInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
  setPreferredTimeZone,
  TIMEZONE_STORAGE_KEY,
} from '@/app/lib/timezone';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useTeamStore } from '@/app/stores/teamStore';
import TaskWeekAgenda from './TaskWeekAgenda';

const ORG_ID = 'org-week-agenda';
const ME = 'practitioner-elena';
const COLLEAGUE = 'practitioner-ravi';

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

/**
 * Pin the formatting zone to the runner's own zone for the duration of a story.
 *
 * Every day column is a LOCAL-midnight Date out of `getWeekDays`, and both the
 * column label and the task bucketing run it through the preferred-timezone
 * helpers, which fall back to Europe/Berlin when nothing is stored. Those two
 * zones agreeing is an accident of where the machine is: run this east of Berlin
 * and local midnight Monday is Sunday evening in Berlin, so the columns relabel
 * themselves AND a 09:00 task lands in the neighbouring column. Storing the
 * runner's own zone makes the two agree everywhere. Same helper, same reasoning
 * as `TaskWeekNav.stories`.
 */
const withRunnerTimeZone = () => {
  const previous = globalThis.localStorage.getItem(TIMEZONE_STORAGE_KEY);
  setPreferredTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return () => {
    if (previous === null) globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
    else globalThis.localStorage.setItem(TIMEZONE_STORAGE_KEY, previous);
  };
};

/**
 * The board resolves assignee names through `useMemberMap`, which reads the team
 * store (keyed off `useOrgStore.primaryOrgId`), the parent store and the auth
 * attributes. Nothing here fetches - the loader hooks are separate - so three
 * seeds and a clear are the whole setup.
 *
 * The parent store is CLEARED rather than left alone. Zustand stores are module
 * singletons shared by every story in the session, so a neighbouring file that
 * seeded a parent record could otherwise change how an id on this board resolves
 * depending on which story was opened first.
 */
const seedStores = () => {
  const org = useOrgStore.getState();
  const team = useTeamStore.getState();
  const parents = useParentStore.getState();
  const auth = useAuthStore.getState();

  useOrgStore.setState({ primaryOrgId: ORG_ID });
  useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAM);
  useParentStore.getState().clearParents();
  useAuthStore.setState({
    attributes: {
      sub: ME,
      email: 'elena.marsh@example.com',
      given_name: 'Elena',
      family_name: 'Marsh',
    },
  });

  return () => {
    useOrgStore.setState(org);
    useTeamStore.setState(team);
    useParentStore.setState(parents);
    useAuthStore.setState(auth);
  };
};

const prepare = () => {
  const restoreZone = withRunnerTimeZone();
  const restoreStores = seedStores();
  return () => {
    restoreStores();
    restoreZone();
  };
};

/* ─────────────────────────── Fixtures ─────────────────────────── */

const task = (over: Partial<Task> & Pick<Task, '_id' | 'name' | 'dueAt'>): Task => ({
  organisationId: ORG_ID,
  assignedBy: ME,
  assignedTo: COLLEAGUE,
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'CARE',
  priority: 'MEDIUM',
  status: 'PENDING',
  ...over,
});

/**
 * Monday 6 July 2026 to Sunday 12 July 2026, built with the local constructor
 * rather than a UTC literal: the board walks the week with `getDay()`/`setDate()`,
 * so an ISO string would land on a different weekday depending on the offset.
 *
 * The week is deliberately in the PAST. `today` is read from the real clock inside
 * the component, so a fixed week is the only way to hold the today tint and the
 * future-day card variant still - both are exercised against the live clock in
 * "Today's column" instead.
 */
const july = (dayOfMonth: number, hour: number, minute = 0) =>
  new Date(2026, 6, dayOfMonth, hour, minute);

/** A Wednesday. The board re-aligns whatever it is given to Monday, and passing a
    mid-week date is what proves it rather than assuming it. */
const MID_WEEK = july(8, 9);
const WEEK_START = july(6, 0);

const WEEK_TASKS: Task[] = [
  task({
    _id: 'mon-kennel',
    name: 'Kennel round',
    category: 'CARE',
    dueAt: july(6, 10),
  }),
  // Listed after the 10:00 card and due before it, so the Monday column can only
  // come out in the right order if the board actually sorts by due time.
  task({
    _id: 'mon-meds',
    name: 'Morning meds for Kiko',
    category: 'MEDICATION',
    status: 'COMPLETED',
    assignedTo: ME,
    dueAt: july(6, 8),
  }),
  task({
    _id: 'tue-stock',
    name: 'Restock 22g catheters',
    category: 'ADMIN',
    assignedTo: '',
    dueAt: july(7, 12),
  }),
  task({
    _id: 'wed-photos',
    name: 'Upload the post-op photos',
    category: 'COMMUNICATION',
    audience: 'PARENT_TASK',
    dueAt: july(8, 9),
  }),
  task({
    _id: 'thu-bloods',
    name: 'Repeat bloods for Nala',
    category: 'DIAGNOSTIC',
    status: 'CANCELLED',
    dueAt: july(9, 14),
  }),
  task({
    _id: 'fri-dental',
    name: 'Dental chart for Kiko',
    category: 'PROCEDURE',
    status: 'IN_PROGRESS',
    assignedTo: ME,
    dueAt: july(10, 11),
  }),
  // The Monday of the FOLLOWING week: in range for the list, out of range for the
  // board, which drops anything it cannot find a column for rather than clamping
  // it into the last one.
  task({ _id: 'next-week', name: 'Next Monday planning', dueAt: july(13, 9) }),
];

/** One long day. Ten cards is roughly twice what fits in the frame below. */
const CROWDED_TASKS: Task[] = [
  task({ _id: 'crowd-mon', name: 'Kennel round', dueAt: july(6, 10) }),
  ...Array.from({ length: 10 }, (_, index) =>
    task({
      _id: `crowd-${index}`,
      name: `Ward check ${index + 1}`,
      dueAt: july(7, 8, index * 30),
    })
  ),
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The live week, Monday-aligned exactly the way the component aligns it. */
const currentWeekDays = () => getWeekDays(getStartOfWeek(new Date(), 1));

const CURRENT_WEEK_TASKS: Task[] = currentWeekDays().map((day, index) => {
  const dueAt = new Date(day);
  dueAt.setHours(9, 30, 0, 0);
  return task({ _id: `live-${index}`, name: `${WEEKDAYS[index]} rounds`, dueAt });
});

/** The time fragment of a card's meta line, composed with the app's own formatter
    rather than written out as "10:00 AM" - the zone is a stored preference. */
const timeLabel = (due: Date) =>
  formatDateInPreferredTimeZone(due, { hour: 'numeric', minute: '2-digit' });

/* ─────────────────────────── DOM readers ─────────────────────────── */

/** The board root, reached through the frame the decorator marks rather than by
    class: every class on it is a styling decision that may legitimately change. */
const boardRoot = (canvasElement: HTMLElement): HTMLElement => {
  const frame = canvasElement.querySelector('[data-agenda-frame="true"]');
  const root = frame?.firstElementChild;
  if (!root) throw new Error('The agenda never rendered its board.');
  return root as HTMLElement;
};

const agendaFrame = (canvasElement: HTMLElement): HTMLElement => {
  const frame = canvasElement.querySelector('[data-agenda-frame="true"]');
  if (!frame) throw new Error('The story frame is missing.');
  return frame as HTMLElement;
};

/** Header row and body are two SEPARATE grids stacked in the card. */
const headerRow = (canvasElement: HTMLElement) =>
  boardRoot(canvasElement).children[0] as HTMLElement;
const bodyGrid = (canvasElement: HTMLElement) =>
  boardRoot(canvasElement).children[1] as HTMLElement;

const headerCells = (canvasElement: HTMLElement) =>
  [...headerRow(canvasElement).children] as HTMLElement[];
const dayColumns = (canvasElement: HTMLElement) =>
  [...bodyGrid(canvasElement).children] as HTMLElement[];

const cardsIn = (column: HTMLElement) =>
  [...column.querySelectorAll('button[aria-label^="Open task"]')] as HTMLElement[];

/* Card layout: [title span (dot + name), meta span]. */
const cardTitle = (card: HTMLElement) => (card.children[0]?.textContent ?? '').trim();
const cardMeta = (card: HTMLElement) => (card.children[1]?.textContent ?? '').trim();
const cardTitles = (column: HTMLElement) => cardsIn(column).map(cardTitle);

const addButtons = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll('button[aria-label^="Add task on"]')] as HTMLElement[];

/**
 * What the stylesheet actually paints for a token, resolved inside the board so
 * any scoped override applies. Compared against rather than a hex literal: the
 * palette is allowed to change, the tokens being DISTINCT is the contract, and a
 * token that has been renamed away resolves to transparent rather than throwing.
 */
const tokenColour = (host: HTMLElement, token: string): string => {
  const probe = globalThis.document.createElement('div');
  probe.style.backgroundColor = `var(${token})`;
  host.appendChild(probe);
  const colour = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return colour;
};

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const meta = {
  title: 'Tasks/TaskWeekAgenda',
  component: TaskWeekAgenda,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A seven-column week board: MON to SUN, one column per day, tasks bucketed by their ' +
          'due day and sorted by due time inside it.\n\n' +
          'Nothing in the product renders it. The tasks planner reaches its week view through ' +
          '`TaskCalendar`, and no module outside the unit test imports this file - so these ' +
          'stories are the only place the board is drawn at all.\n\n' +
          'It is **always Monday-aligned**: it re-derives its own week with ' +
          '`getStartOfWeek(currentDate, 1)` whatever weekday `currentDate` lands on, and reads ' +
          '`weekStart` only as a remount key. A task with no column - anything outside the ' +
          'visible week - is dropped rather than clamped into the last day.\n\n' +
          'The card has **five variants** off `getTaskCardVariant`: pet-parent (pink hairline, ' +
          'pink dot, its own glow), completed, cancelled, in progress, and pending - where ' +
          'pending splits again by day, `upcoming` for a day after today and `requested` for ' +
          'today or earlier. Only COMPLETED strikes its title through; cancelled recedes on ' +
          'colour alone. None of them dims: the muted states carry no opacity at all, because ' +
          'every text descendant already sits on a faint token and 0.75 sank the meta line to ' +
          '3.23:1.\n\n' +
          'Two things are read off the live clock rather than off a prop - the tinted today ' +
          'column and the future-day card variant - so the fixed-week stories below deliberately ' +
          'sit in the past and "Today\'s column" runs against the real date instead.\n\n' +
          'The per-column Add affordance is `opacity-0` until the column is hovered or the ' +
          'button is focused, which makes it the one control here that can disappear for a ' +
          'keyboard user without anything failing.',
      },
    },
  },
  tags: ['autodocs'],
  // Pinned rather than inherited from `initialGlobals`. The viewport is a GLOBAL and
  // PERSISTS once a reader touches the toolbar, so opening any phone story elsewhere
  // and coming back would render these seven columns at 375px and the geometry
  // assertions would fail for a reason that has nothing to do with the board.
  globals: { viewport: { value: 'laptop', isRotated: false } },
  args: {
    filteredList: WEEK_TASKS,
    currentDate: MID_WEEK,
    weekStart: WEEK_START,
    canEditTasks: true,
    setActiveTask: fn(),
    setViewPopup: fn(),
    onCreateFromCalendarSlot: fn(),
  },
  beforeEach: prepare,
  decorators: [
    // The board is `h-full` with an internal scroller, so it needs a bounded frame
    // to be anything at all. The marker is what the DOM readers above anchor to.
    (Story) => (
      <div data-agenda-frame="true" className="h-[520px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TaskWeekAgenda>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SettledWeek: Story = {
  name: 'A past week, one of every card',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const columns = dayColumns(canvasElement);

    // Monday-aligned from a Wednesday `currentDate`, and the day numbers are the
    // ones the preferred-timezone formatter produces - see `withRunnerTimeZone`.
    await expect(headerCells(canvasElement).map((cell) => cell.textContent)).toEqual([
      'MON 6',
      'TUE 7',
      'WED 8',
      'THU 9',
      'FRI 10',
      'SAT 11',
      'SUN 12',
    ]);

    /* The week is in the past, so nothing may claim to be today. Asserted on both
       halves of the marker: the header suffix and the column tint are set from two
       separate `isOnPreferredTimeZoneCalendarDay` calls, and a board that tinted
       every column would still read correctly in the header row. */
    await expect(canvas.queryByText(/· today/)).not.toBeInTheDocument();
    await expect(columns.map((column) => getComputedStyle(column).backgroundColor)).toEqual(
      Array(7).fill(TRANSPARENT)
    );

    // One card per due day, Saturday and Sunday empty, and the task due the
    // FOLLOWING Monday dropped rather than folded into a column it does not own.
    await expect(columns.map((column) => cardsIn(column).length)).toEqual([2, 1, 1, 1, 1, 0, 0]);
    await expect(
      canvas.queryByRole('button', { name: 'Open task Next Monday planning' })
    ).not.toBeInTheDocument();

    // Sorted by due time, not by the order they arrived in `filteredList`.
    await expect(cardTitles(columns[0])).toEqual(['Morning meds for Kiko', 'Kennel round']);

    /* Four meta lines out of two branches. Asserted whole rather than by regex: a
       `.+` in the middle would swallow a blank time, the wrong task's time, or a
       missing separator. */
    const [done, kennel] = cardsIn(columns[0]);
    // A completed card keeps its category and time here - unlike the kanban card,
    // which replaces the time with the word "done".
    await expect(cardMeta(done)).toBe(`Medication · ${timeLabel(july(6, 8))} · you`);
    await expect(cardMeta(kennel)).toBe(`Care · ${timeLabel(july(6, 10))} · Dr. Ravi Patel`);
    // An unassigned task drops the trailing segment instead of printing an empty
    // one, so the line ends at the time rather than at a dangling separator.
    await expect(cardMeta(cardsIn(columns[1])[0])).toBe(`Admin · ${timeLabel(july(7, 12))}`);
    // The pet-parent branch prints neither category nor time.
    await expect(cardMeta(cardsIn(columns[2])[0])).toBe('Parent task · Dr. Ravi Patel');

    /* The pink dot is decoration and must not reach the accessible name: the whole
       card is one button and its `aria-label` is the entire announcement. */
    const parent = cardsIn(columns[2])[0];
    const dot = parent.children[0].firstElementChild as HTMLElement;
    await expect(dot).toHaveAttribute('aria-hidden', 'true');
    await expect(parent).toHaveAccessibleName('Open task Upload the post-op photos');

    /* Strike-through is COMPLETED only. Read off the computed style rather than the
       class list, and paired with the cancelled card, which recedes on colour alone
       - the two are one `isCompleted` flag apart and easy to conflate. */
    const cancelled = cardsIn(columns[3])[0];
    await expect(getComputedStyle(done.children[0]).textDecorationLine).toContain('line-through');
    await expect(getComputedStyle(cancelled.children[0]).textDecorationLine).toBe('none');

    /* No dimming on the settled cards. An `opacity-75` reinstated here would look
       tidy and drop the meta line to 3.23:1 against its own background, which is
       the reason the component carries a comment instead of an opacity class. */
    await expect(getComputedStyle(done).opacity).toBe('1');
    await expect(getComputedStyle(cancelled).opacity).toBe('1');

    /* Five variants, five different fills. A `--status-*` family collapsing onto
       another (or being renamed out from under the card, which resolves to
       transparent rather than throwing) is invisible without this. */
    const fills = [
      getComputedStyle(kennel).backgroundColor, // requested
      getComputedStyle(done).backgroundColor, // completed
      getComputedStyle(cancelled).backgroundColor, // cancelled
      getComputedStyle(cardsIn(columns[4])[0]).backgroundColor, // in progress
      getComputedStyle(parent).backgroundColor, // pet parent
    ];
    await expect(new Set(fills).size).toBe(5);
    await expect(fills).not.toContain(TRANSPARENT);
    // Only the pet-parent card carries a glow.
    await expect(getComputedStyle(parent).boxShadow).not.toBe('none');
    await expect(getComputedStyle(kennel).boxShadow).toBe('none');

    // Opening a card hands the task up and opens the drawer. Both, in that order:
    // a board that only set the active task would open an empty drawer.
    await userEvent.click(kennel);
    await expect(args.setActiveTask).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'mon-kennel' })
    );
    await expect(args.setViewPopup).toHaveBeenCalledWith(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          'One card of every kind in a week that has already happened. Read the four meta lines ' +
          'against each other - they come from two branches and only agree on the middle dot.',
      },
    },
  },
};

export const CurrentWeek: Story = {
  name: "Today's column",
  args: {
    filteredList: CURRENT_WEEK_TASKS,
    currentDate: new Date(),
    weekStart: getStartOfWeek(new Date(), 1),
  },
  play: async ({ canvasElement }) => {
    const columns = dayColumns(canvasElement);
    const days = currentWeekDays();
    const todayIndex = days.findIndex((day) => isOnPreferredTimeZoneCalendarDay(new Date(), day));

    /* Everything below is relative to where today falls, because the board reads
       the real clock. Written this way rather than with a frozen date so the story
       says something true on a Sunday as well as on a Tuesday. */
    await expect(todayIndex).toBeGreaterThanOrEqual(0);

    // Exactly one column is tinted and it is today's. The design tints the whole
    // column, not just the header cell, so the tint is read off the column element.
    await expect(
      columns.map((column, index) =>
        index === todayIndex
          ? getComputedStyle(column).backgroundColor !== TRANSPARENT
          : getComputedStyle(column).backgroundColor === TRANSPARENT
      )
    ).toEqual(Array(7).fill(true));

    // And exactly one header carries the word, on the same column.
    await expect(
      headerCells(canvasElement).map((cell) => (cell.textContent ?? '').includes('· today'))
    ).toEqual(days.map((_, index) => index === todayIndex));

    /* The pending card splits by day: a day AFTER today reads as upcoming, today
       and everything before it as requested. Compared against the tokens the
       stylesheet resolves rather than against each other - a comparison between the
       two groups passes vacuously in the week where today is Sunday and there is no
       future group at all. */
    const host = boardRoot(canvasElement);
    const upcoming = tokenColour(host, '--status-upcoming-bg');
    const requested = tokenColour(host, '--status-requested-bg');
    await expect(upcoming).not.toBe(requested);
    await expect(
      columns.map((column) => getComputedStyle(cardsIn(column)[0]).backgroundColor)
    ).toEqual(days.map((_, index) => (index > todayIndex ? upcoming : requested)));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The live week, one task a day. Two things here come from `new Date()` inside the ' +
          'component rather than from a prop - the tinted column and the blue upcoming card - so ' +
          'this is the only story that can show either, and it has to assert them relative to ' +
          'wherever today happens to fall.',
      },
    },
  },
};

export const CrowdedDay: Story = {
  name: 'A day that overflows',
  args: { filteredList: CROWDED_TASKS },
  play: async ({ canvasElement }) => {
    const frame = agendaFrame(canvasElement);
    const board = boardRoot(canvasElement);
    const body = bodyGrid(canvasElement);

    /* The containment contract: `min-h-0` on the scrolling body against
       `overflow-hidden` on the card. Lose the `min-h-0` and the flex child grows to
       its content instead of scrolling - the board simply runs off the bottom of
       the page, which no assertion about card counts would notice. 32px is the
       frame's own padding. */
    await expect(Math.round(board.getBoundingClientRect().height)).toBe(frame.clientHeight - 32);
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);

    // Seven equal tracks in both grids, and they are separate grids - the header
    // row is not inside the scroller.
    await expect(
      getComputedStyle(headerRow(canvasElement)).gridTemplateColumns.split(/\s+/)
    ).toHaveLength(7);
    await expect(getComputedStyle(body).gridTemplateColumns.split(/\s+/)).toHaveLength(7);
    await expect(body.contains(headerCells(canvasElement)[0])).toBe(false);

    const columns = dayColumns(canvasElement);
    const widths = columns.map((column) => Math.round(column.getBoundingClientRect().width));
    await expect(new Set(widths).size).toBe(1);

    /* Each label sits over its own column. The two grids are laid out
       independently, so a scrollbar gutter on the body alone (the scrollbar is
       hidden here, which is the only reason this holds) shifts all seven columns
       left of their labels by half a day. */
    const cells = headerCells(canvasElement);
    await expect(
      cells.map((cell, index) =>
        Math.abs(cell.getBoundingClientRect().left - columns[index].getBoundingClientRect().left)
      )
    ).toEqual(Array(7).fill(0));

    // The labels stay put while the cards scroll under them.
    const labelTop = cells[0].getBoundingClientRect().top;
    const firstCardTop = cardsIn(columns[1])[0].getBoundingClientRect().top;
    body.scrollTop = 150;
    await waitFor(() =>
      expect(cardsIn(columns[1])[0].getBoundingClientRect().top).toBeLessThan(firstCardTop - 100)
    );
    await expect(cells[0].getBoundingClientRect().top).toBe(labelTop);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Ten tasks on one Tuesday in a 520px frame. The board never grows past its frame: the ' +
          'day columns scroll together as one grid, the header row stays behind, and the ' +
          'scrollbar is hidden so the columns keep sitting under their own labels.',
      },
    },
  },
};

export const EmptyWeek: Story = {
  name: 'An empty week',
  args: { filteredList: [] },
  play: async ({ args, canvasElement }) => {
    const columns = dayColumns(canvasElement);
    await expect(columns.map((column) => cardsIn(column).length)).toEqual(Array(7).fill(0));

    /* Seven Add buttons, each naming its own day. The icon is `aria-hidden` and the
       visible text is the word "Add" on all seven, so without the label a screen
       reader hears the same control seven times and cannot tell which day it is
       about to file a task under. */
    const adds = addButtons(canvasElement);
    await expect(adds.map((button) => button.getAttribute('aria-label'))).toEqual(
      getWeekDays(WEEK_START).map(
        (day) =>
          `Add task on ${formatDateInPreferredTimeZone(day, {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          })}`
      )
    );

    /* The affordance is invisible until the column is hovered, which leaves the
       keyboard route resting on `focus-visible` alone. Tabbed rather than
       `.focus()`ed on purpose: a programmatic focus does not set `:focus-visible`
       in Chromium, so the reveal would appear broken. `waitFor` because the reveal
       is a CSS transition and the first frame still reads 0. */
    await expect(getComputedStyle(adds[0]).opacity).toBe('0');
    await userEvent.tab();
    await expect(adds[0]).toHaveFocus();
    await waitFor(() => expect(getComputedStyle(adds[0]).opacity).toBe('1'));
    // Its neighbours stay hidden - the reveal is per column, not per board.
    await expect(getComputedStyle(adds[1]).opacity).toBe('0');

    /* The new task is prefilled at 09:00 on the column's own day, not at the
       current time and not at midnight, and it carries no assignee. */
    await userEvent.click(adds[0]);
    await expect(args.onCreateFromCalendarSlot).toHaveBeenCalledWith({ dueAt: july(6, 9) });
  },
  parameters: {
    docs: {
      description: {
        story:
          'A week with nothing in it. Seven dashed Add buttons are the only thing on the board, ' +
          'and all seven are invisible until you hover or tab onto one.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without edit rights',
  args: { canEditTasks: false },
  play: async ({ args, canvasElement }) => {
    const columns = dayColumns(canvasElement);

    // The add affordance is gone entirely rather than disabled, so there is no
    // route into creating a task from here.
    await expect(addButtons(canvasElement)).toHaveLength(0);

    // Everything else is unchanged: same six cards in the same columns, still
    // openable. A viewer loses the one way of changing the week and nothing else.
    await expect(columns.map((column) => cardsIn(column).length)).toEqual([2, 1, 1, 1, 1, 0, 0]);
    await userEvent.click(cardsIn(columns[2])[0]);
    await expect(args.setActiveTask).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'wed-photos' })
    );
    await expect(args.setViewPopup).toHaveBeenCalledWith(true);
    await expect(args.onCreateFromCalendarSlot).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same week for someone who may read tasks but not write them. `canEditTasks` ' +
          'defaults to false, so this is also what the board does when a caller forgets to pass ' +
          'the flag at all.',
      },
    },
  },
};
