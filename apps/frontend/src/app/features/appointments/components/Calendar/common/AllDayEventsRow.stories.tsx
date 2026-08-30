import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import AllDayEventsRow from './AllDayEventsRow';

/** The id `DayCalendar` gives its single shared popover; every chip points at it. */
const POPOVER_ID = 'day-calendar-appointment-popover';
const ORG_ID = 'org-storybook';

/**
 * One instant shared by every fixture. The tray formats no times at all - the date
 * only reaches the DOM through `getEventKey`, which stamps `toISOString()` into the
 * chip key - so a UTC literal is safe here and keeps the expected keys below
 * identical in every timezone.
 */
const DAY = new Date('2026-07-14T00:00:00.000Z');

const allDay = (
  name: string,
  concern: string,
  status: Appointment['status'] = 'UPCOMING',
  species = 'dog'
): Appointment => {
  const companion = {
    id: `companion-${name.toLowerCase()}`,
    name,
    species,
    breed: 'Beagle',
    parent: { id: `parent-${name.toLowerCase()}`, name: 'Lena Hartmann' },
  };
  return {
    id: `appt-${name.toLowerCase()}`,
    patient: companion,
    companion,
    organisationId: ORG_ID,
    appointmentDate: DAY,
    startTime: DAY,
    endTime: DAY,
    timeSlot: 'All day',
    durationMinutes: 24 * 60,
    status,
    concern,
  };
};

/** What `getEventKey` builds: source, companion name, ISO start, and the index. */
const keyFor = (name: string, index: number) => `all-day-${name}-${DAY.toISOString()}-${index}`;

const chipRowOf = (button: HTMLElement): HTMLElement => button.parentElement as HTMLElement;

const meta = {
  title: 'Appointments/Calendar/AllDayEventsRow',
  component: AllDayEventsRow,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The all-day tray above the day timeline: a wrapping row of status-coloured chips, each ' +
          "one a button that opens the calendar's single shared appointment popover.\n\n" +
          'The chips carry the whole popover contract. `aria-controls` names the one popover the ' +
          'day view owns, and `aria-expanded` is true only for the chip whose key matches ' +
          '`activePopoverKey` - a key built from the source, the companion name, the ISO start ' +
          'and the index, so it is stable across a re-render but changes the moment the tray is ' +
          'reordered. The visible text truncates hard (the name at 160px, the reason at 120px) ' +
          'while the accessible name keeps both in full, which is the only reason a clipped chip ' +
          'is still usable.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activePopoverKey: null,
    appointmentPopoverId: POPOVER_ID,
    onMarkerClick: fn(),
    onMarkerDoubleClick: fn(),
    onMarkerContextMenu: fn(),
  },
} satisfies Meta<typeof AllDayEventsRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A single all-day appointment',
  args: { allDayEvents: [allDay('Milo', 'Dental check')] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('All-day')).toBeVisible();

    const chip = canvas.getByRole('button');
    /* The chip's own text is two truncating fragments; its accessible name is the
       assembled sentence. Both halves matter - the name is what a screen reader
       announces, and it is the only place the reason survives the 120px clamp. */
    await expect(chip).toHaveAccessibleName(
      'All-day appointment for Milo · Hartmann. Dental check'
    );

    // Popover wiring. All three attributes fail silently: the chip looks and clicks
    // exactly the same whether or not it points at a popover that exists.
    await expect(chip).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(chip).toHaveAttribute('aria-controls', POPOVER_ID);
    await expect(chip).toHaveAttribute('aria-expanded', 'false');

    // The avatar is decorative on purpose - the accessible name already says whose
    // appointment this is, and an alt here would announce the companion twice.
    await expect(chip.querySelector('img')).toHaveAttribute('alt', '');

    /* The click hands back the key the parent stores as `activePopoverKey`. This is
       the format the Expanded story feeds back in: change either end of it and the
       popover simply never opens, with nothing thrown. */
    await userEvent.click(chip);
    await expect(args.onMarkerClick).toHaveBeenCalledWith(expect.anything(), keyFor('Milo', 0));
  },
};

export const Expanded: Story = {
  name: 'The open chip is the one that matches',
  args: {
    allDayEvents: [
      allDay('Milo', 'Dental check'),
      allDay('Nala', 'Post-op recheck'),
      allDay('Otto', ''),
    ],
    activePopoverKey: keyFor('Nala', 1),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chips = canvas.getAllByRole('button');
    await expect(chips).toHaveLength(3);

    /* Exactly one chip is expanded, and it is the one the key names. The index is
       part of the key, so this also pins that the tray is keyed by POSITION as well
       as by companion - two all-day bookings for the same companion are a real
       case, and a name-only key would open both. */
    const expanded = chips.filter((chip) => chip.getAttribute('aria-expanded') === 'true');
    await expect(expanded).toHaveLength(1);
    await expect(expanded[0]).toHaveAccessibleName(
      'All-day appointment for Nala · Hartmann. Post-op recheck'
    );

    /* A booking with no stated reason drops the suffix rather than announcing a
       dangling full stop or the string "undefined". */
    await expect(chips[2]).toHaveAccessibleName('All-day appointment for Otto · Hartmann');
  },
};

export const Statuses: Story = {
  name: 'One colour per status',
  args: {
    allDayEvents: [
      allDay('Milo', 'Dental check', 'UPCOMING'),
      allDay('Nala', 'Arrived', 'CHECKED_IN'),
      allDay('Otto', 'On the table', 'IN_PROGRESS'),
      allDay('Pepper', 'Discharged', 'COMPLETED'),
      allDay('Quill', 'Owner cancelled', 'CANCELLED'),
    ],
  },
  play: async ({ canvasElement }) => {
    const chips = within(canvasElement).getAllByRole('button');
    const fills = chips.map((chip) => globalThis.getComputedStyle(chip).backgroundColor);

    /* Five statuses, five fills. `getStatusStyle` lowercases the SCREAMING_CASE
       status to look the palette up and falls back to the "requested" style on a
       miss - so a broken mapping does not throw, it paints the whole tray one
       colour, and the tray still reads as a tray. */
    await expect(new Set(fills).size).toBe(5);
    for (const fill of fills) {
      await expect(fill).not.toBe('rgba(0, 0, 0, 0)');
    }
  },
};

export const Wrapping: Story = {
  name: 'Wrapping onto a second row on a phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* The viewport global resizes the iframe from the MANAGER, so a story opened
     straight at `iframe.html` - which is how the headless checks load it - renders
     at the panel width and the wrap never happens. A width-dependent assertion has
     to pin the box itself; the global is here so the toolbar agrees with it. */
  decorators: [
    (Story) => (
      <div style={{ width: 375 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    allDayEvents: [
      allDay('Milo', 'Dental'),
      allDay('Nala', 'Recheck'),
      allDay('Otto', 'Bloods'),
      allDay('Pepper', 'Fluids'),
      allDay('Quill', 'Vaccines'),
    ],
  },
  play: async ({ canvasElement }) => {
    const chips = within(canvasElement).getAllByRole('button');
    const chipRow = chipRowOf(chips[0]);

    // More than one line of chips at 375px, which is the state the tray is built for.
    const rows = new Set(chips.map((chip) => Math.round(chip.getBoundingClientRect().top)));
    await expect(rows.size).toBeGreaterThan(1);

    /* And it wraps rather than overflowing. The tray sits above a timeline that owns
       the horizontal axis; a chip row that scrolls sideways would steal the gesture
       and hide chips behind an edge with nothing to say they are there. */
    await expect(chipRow.scrollWidth).toBeLessThanOrEqual(chipRow.clientWidth + 1);
    const rowRight = chipRow.getBoundingClientRect().right;
    for (const chip of chips) {
      await expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(rowRight + 1);
    }
  },
};

export const LongContent: Story = {
  name: 'A long name and a long reason',
  args: {
    allDayEvents: [
      allDay(
        'Bartholomew Wigglesworth III',
        'Suspected foreign body, admitted overnight for imaging'
      ),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole('button');
    const chipContent = within(chip);

    const name = chipContent.getByText('Bartholomew Wigglesworth III · Hartmann');
    const reason = chipContent.getByText('Suspected foreign body, admitted overnight for imaging');

    // Both fragments are clamped, not shrunk to fit: the text is wider than the box
    // it is allowed to occupy, which is what makes the ellipsis appear.
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
    await expect(reason.scrollWidth).toBeGreaterThan(reason.clientWidth);

    // The name gets the wider clamp of the two - it is the identifying half.
    await expect(name.clientWidth).toBeGreaterThan(reason.clientWidth);

    /* Nothing escapes the tray. Without both max-widths the chip grows to its text
       and pushes the row wide, which on the day view is a horizontal scrollbar under
       a calendar that already owns that axis. */
    const chipRow = chipRowOf(chip);
    await expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(
      chipRow.getBoundingClientRect().right + 1
    );

    // Truncation is visual only: the full reason is still announced.
    await expect(chip).toHaveAccessibleName(
      'All-day appointment for Bartholomew Wigglesworth III · Hartmann. Suspected foreign body, admitted overnight for imaging'
    );
  },
};
