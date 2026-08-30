import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import type {
  OutpatientScheduleModel,
  OutpatientVisit,
} from '@/app/features/appointments/lib/outpatientSchedule';
import OutpatientSchedule from './OutpatientSchedule';

/**
 * `timeLabel` and `dayMarker` read LOCAL hours and dates off the ISO string, so
 * the fixtures are built from local-time components. A UTC literal
 * ('2026-03-16T09:30:00.000Z') would slide by the runner's offset and change
 * both the row clock and the day marker from one machine to the next.
 *
 * March 2026: the 16th is a Monday, the 17th and the 24th are Tuesdays.
 */
const at = (day: number, hour: number, minute: number): string =>
  new Date(2026, 2, day, hour, minute).toISOString();

const LASER_SESSION_2: OutpatientVisit = {
  id: 'visit-laser-2',
  title: 'Laser therapy',
  startTime: at(16, 9, 30),
  durationMinutes: 20,
  leadName: 'Dr. Ravi Menon',
  roomName: 'Rehab suite',
  status: 'SCHEDULED',
  group: 'THIS_WEEK',
  seriesIndex: 2,
  seriesTotal: 6,
};

/** No `seriesIndex`/`seriesTotal`, so this row must stay a plain title. */
const BANDAGE_CHANGE: OutpatientVisit = {
  id: 'visit-bandage',
  title: 'Bandage change',
  startTime: at(17, 14, 0),
  durationMinutes: 15,
  leadName: 'Nurse Halloran',
  status: 'PROPOSED',
  group: 'THIS_WEEK',
};

const LASER_SESSION_3: OutpatientVisit = {
  id: 'visit-laser-3',
  title: 'Laser therapy',
  startTime: at(24, 9, 30),
  durationMinutes: 20,
  leadName: 'Dr. Ravi Menon',
  roomName: 'Rehab suite',
  status: 'SCHEDULED',
  group: 'NEXT_WEEK',
  seriesIndex: 3,
  seriesTotal: 6,
};

const SCHEDULE: OutpatientScheduleModel = {
  thisWeek: [LASER_SESSION_2, BANDAGE_CHANGE],
  nextWeek: [LASER_SESSION_3],
  total: 3,
  proposedCount: 1,
};

const EMPTY_SCHEDULE: OutpatientScheduleModel = {
  thisWeek: [],
  nextWeek: [],
  total: 0,
  proposedCount: 0,
};

/** Rows the browser is actually painting with the next-visit wash and spine. */
const highlightedRows = (canvasElement: HTMLElement): HTMLElement[] =>
  [...canvasElement.querySelectorAll('li')].filter((row) =>
    globalThis.getComputedStyle(row).boxShadow.includes('inset')
  );

const meta = {
  title: 'Workspace/OutpatientSchedule',
  component: OutpatientSchedule,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Treatment step\'s outpatient visit list: a "This week"/"Next week" card, one row ' +
          'per upcoming visit, and a soft wash plus a blue inset spine on the nearest one.\n\n' +
          '**The highlight is positional, not a flag.** The component picks ' +
          '`thisWeek[0]?.id ?? nextWeek[0]?.id` and compares ids as it maps, so a duplicated id ' +
          'or an unsorted group paints the spine on more than one row - or on none. Nothing in ' +
          'the type system says only one row may carry it, so the play functions count the rows ' +
          'the browser is actually painting `inset` on rather than trusting the source.\n\n' +
          '**The session suffix and the two backend-owned extras are all `&&` branches.** ' +
          '"Laser therapy · session 2 of 6" is appended only when BOTH `seriesIndex` and ' +
          '`seriesTotal` are present, and the series note and the progress rail render only when ' +
          'the schedule carries them - no backend populates any of the three yet, so the default ' +
          'frame is the one without them and their presence is the exception.\n\n' +
          '**Read-only disables the add affordance rather than hiding it**; passing no ' +
          '`onAddVisit` at all is what removes it. Those are two different frames.\n\n' +
          'Row clocks and day markers come from `new Date(iso)` read in LOCAL time, so an ' +
          'unparseable start time degrades to `--:--` and a `--` marker instead of throwing.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    schedule: SCHEDULE,
    readOnly: false,
    onAddVisit: fn(),
  },
} satisfies Meta<typeof OutpatientSchedule>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Two weeks of visits',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Scheduled outpatient tasks · 3')).toBeInTheDocument();

    // Exactly one row may carry the next-visit spine, and it must be the first
    // of "This week". Duplicate ids would paint two, and both frames look
    // plausible in a screenshot.
    const highlighted = highlightedRows(canvasElement);
    await expect(highlighted).toHaveLength(1);
    await expect(highlighted[0]).toHaveTextContent('Laser therapy · session 2 of 6');

    // The suffix needs BOTH series fields; a visit carrying neither stays bare.
    await expect(canvas.getByText('Bandage change')).toBeInTheDocument();
    await expect(canvas.queryByText(/Bandage change · session/)).not.toBeInTheDocument();

    // SCHEDULED and PROPOSED map to different status tokens ('upcoming' vs
    // 'requested'). If the mapping collapsed, or a token failed to resolve, both
    // pills would paint the same and the list would read as one state.
    const scheduled = canvas.getAllByText('Scheduled')[0];
    const proposed = canvas.getByText('Proposed');
    const scheduledBg = globalThis.getComputedStyle(scheduled).backgroundColor;
    await expect(scheduledBg).not.toBe('rgba(0, 0, 0, 0)');
    await expect(globalThis.getComputedStyle(proposed).backgroundColor).not.toBe(scheduledBg);

    await expect(canvas.getByText('1 proposed visit awaiting owner confirmation')).toBeVisible();

    // Neither backend-owned extra is supplied here, so neither may be invented.
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Series note')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two visits this week, one next, and a single proposed visit awaiting the owner. The ' +
          'footer line is singular here - it pluralises off `proposedCount`.',
      },
    },
  },
};

export const NextWeekOnly: Story = {
  name: 'Nothing this week',
  args: {
    schedule: {
      thisWeek: [],
      nextWeek: [LASER_SESSION_3],
      total: 1,
      proposedCount: 0,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The empty group drops its heading entirely rather than printing an empty
    // "This week" label above the following group.
    await expect(canvas.queryByText('This week')).not.toBeInTheDocument();
    await expect(canvas.getByText('Next week')).toBeInTheDocument();

    // The `?? nextWeek[0]` fallback: with no rows this week the spine has to
    // move to the first row of next week, not disappear.
    const highlighted = highlightedRows(canvasElement);
    await expect(highlighted).toHaveLength(1);
    await expect(highlighted[0]).toHaveTextContent('Laser therapy · session 3 of 6');

    // Zero proposed visits means no footer line at all, not "0 proposed visits".
    await expect(canvas.queryByText(/awaiting owner confirmation/)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A single visit, and it is next week. Worth its own frame because the highlight is ' +
          'sourced from `thisWeek[0]` first - the fallback is the only thing keeping the nearest ' +
          'visit marked when this week is empty.',
      },
    },
  },
};

export const SeriesNoteAndProgress: Story = {
  name: 'Series note and progress rail',
  args: {
    schedule: {
      ...SCHEDULE,
      seriesNote:
        'Owner is administering gabapentin 90 minutes before each session; reschedule rather ' +
        'than treat if the limp has worsened.',
      seriesProgress: { completed: 1, total: 6 },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The rail is a native <progress>, so the fill is the engine's and the only
    // thing that can silently go wrong is the value/max pair or the label the
    // screen reader gets. The restyled pill geometry hides a swapped pair
    // completely.
    const rail = canvas.getByRole('progressbar', { name: 'Series progress' });
    await expect((rail as HTMLProgressElement).value).toBe(1);
    await expect((rail as HTMLProgressElement).max).toBe(6);
    await expect(canvas.getByText('1 / 6 done')).toBeVisible();

    await expect(canvas.getByText('Series note')).toBeVisible();
    await expect(canvas.getByText(/gabapentin 90 minutes before each session/)).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the card looks like once `Appointment.seriesNote` and the delivered-session count ' +
          'exist. `completed` is never inferred from `seriesIndex` - a scheduled session 2 does ' +
          'not prove session 1 happened - so this frame is only reachable when the backend sends ' +
          'both numbers.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No scheduled tasks',
  args: { schedule: EMPTY_SCHEDULE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No scheduled tasks for this companion.')).toBeVisible();
    await expect(canvas.getByText('Scheduled outpatient tasks · 0')).toBeInTheDocument();
    // Both group headings hang off the row lists, so an empty schedule must not
    // leave orphaned labels above the notice.
    await expect(canvas.queryByText('This week')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Next week')).not.toBeInTheDocument();
    // Booking is still reachable from the empty state - that is the one action
    // that matters here.
    await expect(canvas.getByRole('button', { name: 'Add task' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'No upcoming visits sourced for this companion. The count in the header still renders, ' +
          'so the card reads as "we looked and there are none" rather than as a failed load.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only',
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Read-only DISABLES the affordance, it does not remove it: the button is
    // still in the accessibility tree, just not operable.
    const add = canvas.getByRole('button', { name: 'Add task' });
    await expect(add).toBeVisible();
    await expect(add).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A locked visit. Everything else in the card is static text, so the disabled "Add task" ' +
          'is the only visible difference from the default frame.',
      },
    },
  },
};

export const WithoutAddAffordance: Story = {
  name: 'No add handler',
  args: { onAddVisit: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Omitting the handler removes the button outright - the other half of the
    // read-only pair, and the frame a caller with no booking route gets.
    await expect(canvas.queryByRole('button', { name: 'Add task' })).not.toBeInTheDocument();
    await expect(canvas.getByText('Scheduled outpatient tasks · 3')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Callers that cannot route to the booking flow pass no `onAddVisit`, and the header ' +
          'collapses to the count alone.',
      },
    },
  },
};

export const UnparseableStartTime: Story = {
  name: 'Unparseable start time',
  args: {
    schedule: {
      thisWeek: [{ ...LASER_SESSION_2, startTime: 'not-a-timestamp' }],
      nextWeek: [],
      total: 1,
      proposedCount: 0,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByText('Laser therapy · session 2 of 6').closest('li') as HTMLElement;
    // A bad timestamp degrades to placeholders instead of "NaN:NaN" or a throw,
    // and the rest of the subline still has to render around it.
    await expect(row).toHaveTextContent('--:-- · 20 min · Dr. Ravi Menon · Rehab suite');
    // The day marker degrades in both halves - weekday AND date.
    await expect(within(row).getAllByText('--')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a malformed `startTime` off the wire looks like. The row keeps its title, ' +
          'duration, lead and room, so the visit stays actionable even when its clock is not.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375) - long visit title',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /**
   * The viewport global is applied by the MANAGER, which resizes the preview
   * iframe - so it does nothing when the story is opened as `iframe.html`
   * directly, which is how the headless checks render it. The wrapper pins the
   * 375px column inside the story itself so the measurement below is the phone
   * measurement wherever it runs; the global keeps the manager frame honest too.
   */
  decorators: [
    (Story) => (
      <div style={{ width: 375 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    schedule: {
      thisWeek: [
        {
          ...LASER_SESSION_2,
          title: 'Photobiomodulation and underwater treadmill rehabilitation review',
        },
      ],
      nextWeek: [],
      total: 1,
      proposedCount: 0,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText(
      'Photobiomodulation and underwater treadmill rehabilitation review · session 2 of 6'
    );
    const row = title.closest('li') as HTMLElement;
    const pill = within(row).getByText('Scheduled');

    // The title column is `min-w-0 flex-1 truncate`: it has to clip rather than
    // widen the row. Without `min-w-0` the flex item refuses to shrink below its
    // content and pushes the pill out past the card edge - invisible at 1280px.
    await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
    await expect(pill.getBoundingClientRect().right).toBeLessThanOrEqual(
      row.getBoundingClientRect().right
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The row at phone width with a title long enough to need the clamp. The day marker, the ' +
          'status pill and the overflow glyph are all `shrink-0`, so the title is the only part ' +
          'that gives - and it has to.',
      },
    },
  },
};
