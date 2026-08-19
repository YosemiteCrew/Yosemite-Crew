import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import {
  AppointmentFilters,
  AppointmentStatusFilters,
} from '@/app/features/appointments/types/appointments';
import type { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import Header from './Header';

const DEFAULT_DATE = new Date('2026-03-12T09:00:00');

type HeaderProps = ComponentProps<typeof Header>;

type HarnessProps = Omit<
  HeaderProps,
  | 'currentDate'
  | 'setCurrentDate'
  | 'setWeekStart'
  | 'activeStatus'
  | 'setActiveStatus'
  | 'activeFilter'
  | 'setActiveFilter'
  | 'activeCalendar'
  | 'setActiveCalendar'
  | 'zoomMode'
  | 'setZoomMode'
> & {
  initialDate?: Date;
  initialStatus?: string;
  initialFilter?: string;
  /** Non-empty renders the Day / Week / Team `SegmentedPill`. */
  initialCalendar?: string;
  /** Renders the +/- zoom toggle at the far right of the scroller. */
  withZoom?: boolean;
};

/**
 * `Header` is fully controlled - date, status, filter, view and zoom all live in
 * the calendar page above it - so nothing about it can be reached from static
 * args. This holds that state so the panels can actually be opened.
 */
const CalendarHeaderHarness = ({
  initialDate = DEFAULT_DATE,
  initialStatus = 'all',
  initialFilter = 'all',
  initialCalendar,
  withZoom = false,
  ...rest
}: HarnessProps) => {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [, setWeekStart] = useState(initialDate);
  const [activeStatus, setActiveStatus] = useState(initialStatus);
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [activeCalendar, setActiveCalendar] = useState(initialCalendar ?? 'day');
  const [zoomMode, setZoomMode] = useState<CalendarZoomMode>('in');

  return (
    <Header
      {...rest}
      currentDate={currentDate}
      setCurrentDate={setCurrentDate}
      setWeekStart={setWeekStart}
      activeStatus={activeStatus}
      setActiveStatus={setActiveStatus}
      activeFilter={activeFilter}
      setActiveFilter={setActiveFilter}
      activeCalendar={initialCalendar ? activeCalendar : undefined}
      setActiveCalendar={initialCalendar ? setActiveCalendar : undefined}
      zoomMode={withZoom ? zoomMode : undefined}
      setZoomMode={withZoom ? setZoomMode : undefined}
    />
  );
};

/** Opens the status dropdown and returns its portalled panel. */
const openStatusPanel = async (canvasElement: HTMLElement, triggerName: string | RegExp) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: triggerName }));
  // "No show" only ever exists inside the panel, so it is an unambiguous handle
  // on a portal that carries no role, id or label of its own. Its parent IS the
  // panel: StatusOptionButtons renders a bare fragment of buttons.
  const row = await within(document.body).findByRole('button', { name: 'No show' });
  return row.parentElement as HTMLElement;
};

const meta = {
  title: 'Appointments/Calendar/Header',
  component: CalendarHeaderHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The toolbar above every calendar view - Appointments day/week/team and the Tasks ' +
          'planner - carrying the date picker, the prev/label/next nav pill, Today, the view ' +
          'switcher, the status filter, the scope pills, the CTA and the zoom toggle in one ' +
          'horizontally scrolling row.\n\n' +
          'Two of those controls are surfaces no snapshot has ever held. `StatusFilterDropdown` ' +
          'is **module-private** - it is not exported, has no story of its own, and its panel is ' +
          '`createPortal`ed to `document.body`, so it can only be drawn by mounting `Header` and ' +
          'clicking. The panel is positioned imperatively by `useAnchoredDropdown(180)`: ' +
          '`position: fixed`, `top = trigger.bottom + 6`, `right = innerWidth - trigger.right`, ' +
          '`minWidth = max(triggerWidth, 180)`, `zIndex: 9999`. None of that is expressible as a ' +
          'class, so nothing but a rendered instance can show whether it lands under its trigger ' +
          'or off the edge of the toolbar.\n\n' +
          'The rows inside are the exact shape of the token bug this branch shipped elsewhere: ' +
          '`getDropdownStatusTextColor` resolves each label to `dropdownText ?? text ?? ' +
          '--color-text-primary`. Those tokens are `--status-*-text` **ink**, and the dot beside ' +
          'each label paints `--status-*-border`. Substituting the pill *fill* token for the ink ' +
          'one there produces text that is legible on the pill and nearly invisible on the ' +
          "panel's `bg-neutral-0` - and no test that only checks `aria-expanded` would notice.\n\n" +
          'The trigger itself has two disjoint renderings, not one styled two ways. With `all` ' +
          'selected it is a bare hairline pill reading “All statuses” at 12px/600 in ' +
          '`--ink-muted`; with any other status it is a `StatusPill` in that status’ own ' +
          'token set, with the chevron folded into the pill label. The stories draw both.\n\n' +
          'The second gated surface is the `Datepicker` popper, which react-datepicker renders ' +
          'into its own `#yc-datepicker-portal` node - also outside the story canvas, also only ' +
          'after a click.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    statusOptions: AppointmentStatusFilters,
    filterOptions: AppointmentFilters,
    hasEmergency: false,
    showAddButton: true,
    addButtonText: 'New appointment',
    onAddButtonClick: fn(),
  },
} satisfies Meta<typeof CalendarHeaderHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Resting toolbar',
  parameters: {
    docs: {
      description: {
        story:
          'Everything closed - the state every existing snapshot of a calendar page has held. ' +
          'The left cluster (date picker, nav pill, Today) is `shrink-0`; the right cluster lives ' +
          'in the `overflow-x-auto` half so the pills scroll rather than compress.',
      },
    },
  },
};

export const StatusPanelOpen: Story = {
  name: 'Status panel open',
  play: async ({ canvasElement }) => {
    const panel = await openStatusPanel(canvasElement, 'All statuses');
    // Assert the panel has its eight rows AND their swatches. Checking only that
    // the trigger flipped would pass on an empty portal - which is how a dropped
    // panel stays invisible.
    await expect(within(panel).getAllByRole('button')).toHaveLength(8);
    await expect(within(panel).getByText('Requested')).toBeInTheDocument();
    await expect(within(panel).getByText('Cancelled')).toBeInTheDocument();
    await expect(panel.querySelectorAll('span.rounded-full')).toHaveLength(8);
    // The imperative geometry: fixed rather than absolute, so it escapes the
    // toolbar's own horizontal scroller instead of being clipped by it.
    await expect(getComputedStyle(panel).position).toBe('fixed');
  },
  parameters: {
    docs: {
      description: {
        story:
          'All eight appointment statuses, each with a 8px dot in its `--status-*-border` tone and ' +
          'its label in the matching ink token, inside a `rounded-2xl` `bg-neutral-0` card with a ' +
          '`0 8px 24px --color-shadow-soft` drop shadow. The "All" row is the `allKey`, so it ' +
          'never takes the active font weight even while selected.',
      },
    },
  },
};

export const SelectedStatusPanelOpen: Story = {
  name: 'Status panel open (status selected)',
  args: { initialStatus: 'in_progress' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The trigger is now a StatusPill, not the "All statuses" outline pill.
    await expect(canvas.queryByRole('button', { name: 'All statuses' })).not.toBeInTheDocument();
    const panel = await openStatusPanel(canvasElement, 'In progress');
    await expect(within(panel).getAllByRole('button')).toHaveLength(8);
    // The selected row is marked by a trailing check only - there is no
    // background change - so its absence is the whole regression.
    await expect(within(panel).getByText('✓')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The other trigger branch. `getStatusPillTokens` hands the pill the status’ ' +
          '`bg`/`text`/`border`, falling back to the `--color-pill-neutral-*` set, and the ' +
          'chevron rides inside the pill rather than beside it. Worth seeing against the default: ' +
          'the two triggers share no markup at all.',
      },
    },
  },
};

export const DatepickerOpen: Story = {
  name: 'Date picker popper open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /toggle calendar/i }));
    // react-datepicker portals the popper into #yc-datepicker-portal, outside
    // the canvas. Assert the grid actually has day cells, not just that the
    // popper node exists.
    const calendar = document.querySelector('.yc-datepicker-calendar');
    await expect(calendar).toBeInTheDocument();
    await expect(
      (calendar as HTMLElement).querySelectorAll('.react-datepicker__day').length
    ).toBeGreaterThan(27);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The header wraps the picker in a `GlassTooltip` and a `relative z-150` box so the ' +
          'popper clears the `z-140` sticky toolbar. Both the tooltip bubble and the calendar ' +
          'portal out of the canvas, so this is the only way either is drawn.',
      },
    },
  },
};

export const EmergencyFilterActive: Story = {
  name: 'Emergency pill active, with waiting emergency',
  args: { initialFilter: 'emergencies', hasEmergency: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = canvas.getByRole('button', { name: 'Emergencies' });
    // Active emergency deliberately carries NO colour class: the fill and label
    // come from getEmergencyPillStyle's inline style, so an `!important` text
    // colour cannot override it. Only the weight class is applied.
    await expect(pill).toHaveClass('font-bold');
    await expect(pill.className).not.toContain('text-danger');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one filter pill with a third state: selected, plus a `--danger` notification dot ' +
          'ringed in `--screen` pinned to its top-right corner when an emergency is waiting. That ' +
          'dot is `-top-0.5 -right-0.5` and overflows the pill, so it only reads correctly with ' +
          'the neighbouring controls composited around it.',
      },
    },
  },
};

export const PlannerToolbar: Story = {
  name: 'Planner toolbar (view switcher + zoom)',
  args: {
    initialCalendar: 'week',
    withZoom: true,
    addButtonText: 'New task',
    statusOptions: [],
    filterOptions: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Zoom in timeline' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'New task' })).toBeInTheDocument();
    // The week view swaps the arrows from day-stepping to week-stepping, and the
    // labels are the only signal of which is wired up.
    await expect(canvas.getByRole('button', { name: 'Next week' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same component as the Tasks planner mounts: the Day/Week/Team `SegmentedPill` and ' +
          'the zoom toggle appear, the status dropdown and scope pills do not, and the CTA is ' +
          'relabelled. `activeCalendar === "week"` **and** a `setWeekStart` dispatch both being ' +
          'present is what flips the nav arrows from day-stepping to week-stepping - the arrow ' +
          'labels are the only thing that says which handler is wired up.',
      },
    },
  },
};
