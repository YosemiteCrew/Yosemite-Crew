import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import { ChatHeaderContext } from './ChatHeaderContext';

/**
 * Only `startTime`, `status` and `patient.name` are read; the rest of `Appointment` is
 * required by the type and never touched, so it is filled once here and cast.
 */
const appointment = (over: Partial<Appointment> = {}): Appointment =>
  ({
    id: 'appt-88',
    organisationId: 'org-sb',
    patient: {
      id: 'companion-12',
      name: 'Kiko',
      species: 'Dog',
      parent: { id: 'parent-3', name: 'Marta Alvarez' },
    },
    startTime: new Date('2026-03-26T09:15:00.000Z'),
    status: 'UPCOMING',
    ...over,
  }) as unknown as Appointment;

/**
 * The chip's timestamp goes through `formatDateInPreferredTimeZone`, which reads a
 * localStorage token and falls back to Europe/Berlin. A story that ran after anything
 * that set a timezone would render a different clock time and the assertion would fail
 * for a reason that has nothing to do with this component - so the key is cleared for
 * the story and put back afterwards. 09:15Z is 10:15 in Berlin on 26 March 2026 (CET;
 * DST starts on the 29th).
 */
const pinnedTimeZone = () => {
  const key = 'yc_preferred_timezone';
  const previous = window.localStorage.getItem(key);
  window.localStorage.removeItem(key);
  return () => {
    if (previous !== null) window.localStorage.setItem(key, previous);
  };
};

/** The banner row that holds the appointment chip and its actions. */
const apptBanner = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByText('Appointment').closest('div') as HTMLElement;

/** Visible quick actions, in DOM order. */
const actionNames = (canvasElement: HTMLElement): string[] =>
  within(apptBanner(canvasElement))
    .getAllByRole('button')
    .map((button) => button.textContent?.trim() ?? '');

const meta = {
  title: 'Chat/ChatHeaderContext',
  component: ChatHeaderContext,
  decorators: [
    // `data-testid` so the "returns null" story can assert emptiness against THIS
    // element rather than by counting divs in the canvas - Storybook's own layout
    // wrappers are not part of the contract and a count would break on them.
    (Story) => (
      <div
        data-testid="context-frame"
        className="w-full max-w-[860px] border border-[var(--hairline)] bg-[var(--screen)]"
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The strip between the channel header and the message thread: a clinical safety band, ' +
          'an appointment context chip with quick actions, and the pinned-message banner.\n\n' +
          'It is mounted unconditionally by `ChatContainer` and then **returns `null`** unless it ' +
          'has something to say - `flags.length === 0 && !appointment && pinned.length === 0` is ' +
          'an early return. On a staff-to-staff conversation that is every render, so the strip ' +
          'is invisible for most of the product and had never been drawn with all three blocks ' +
          'stacked.\n\n' +
          'The interesting part is not the layout, it is **which actions exist**. The four quick ' +
          'actions are filtered per appointment status by three different rules that live in ' +
          'three different modules: `allowReschedule` (requested/upcoming only), ' +
          '`canTransitionAppointmentStatus(status, "COMPLETED")` (in-progress only, in practice), ' +
          'and `canEnterAppointmentWorkspace` for **Send form**, which is gated on the same check ' +
          'the workspace route enforces so the button cannot deep-link the user into a dead end. ' +
          'Only "Book follow-up" is unconditional. The result is that no two statuses show the ' +
          'same row, and a regression in any one of those helpers silently removes or adds a ' +
          'button rather than throwing. Each story below asserts the whole visible set, in order, ' +
          'rather than probing for one button.\n\n' +
          '`completing` is a fourth axis on top of status: it hides **Mark complete** while the ' +
          'status round-trip is in flight, which is the only thing stopping a double click from ' +
          'firing two completions. That is a state with no resting form at all.\n\n' +
          'The safety band is a filter too. Only `critical` and `high` alerts appear, only if ' +
          'they carry a title, and the allergy is prepended - all joined into one ' +
          '`--danger-bg` line rather than stacked, so a companion with several flags still costs ' +
          'one row of thread height.\n\n' +
          'Below `sm` the banner is a column and the actions become a horizontal scroller; from ' +
          '`sm` up it is a row with the actions wrapped right. Both are drawn.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    allergy: 'Penicillin',
    alerts: [
      { title: 'Anticoagulant therapy', severity: 'critical' },
      // Dropped: below the severity cut.
      { title: 'Nervous around other dogs', severity: 'medium' },
      // Dropped: high enough, but no title to render.
      { severity: 'high' },
    ],
    appointment: appointment(),
    pinned: [
      { id: 'p1', text: 'Recheck booked for 26 March at 10:15 - bring the medication box.' },
      { id: 'p2', text: 'Owner prefers WhatsApp for reminders.' },
      { id: 'p3', text: 'Weight to be recorded at every visit.' },
    ],
    onOpenPinned: fn(),
    onAction: fn(),
  },
  beforeEach: pinnedTimeZone,
} satisfies Meta<typeof ChatHeaderContext>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullContext: Story = {
  name: 'All three blocks (upcoming)',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // One band, one line, filtered: the medium alert and the title-less high alert are
    // both absent, and the survivors are joined with " · " rather than stacked.
    await expect(
      canvas.getByText('Allergy: Penicillin · Anticoagulant therapy')
    ).toBeInTheDocument();
    await expect(canvas.queryByText(/Nervous around other dogs/)).not.toBeInTheDocument();

    // The chip carries the formatted local time and the patient name.
    await expect(canvas.getByText('Thu, Mar 26, 10:15 AM · Kiko')).toBeInTheDocument();

    // UPCOMING: reschedulable, enterable by the workspace, not completable.
    await expect(actionNames(canvasElement)).toEqual(['Reschedule', 'Send form', 'Book follow-up']);

    // "Pinned · “first” + 2 more" - the count is of the OTHERS, not of all pins.
    const banner = canvas.getByRole('button', { name: /^Pinned/ });
    await expect(banner).toHaveTextContent(
      'Pinned · “Recheck booked for 26 March at 10:15 - bring the medication box.” + 2 more'
    );

    await userEvent.click(canvas.getByRole('button', { name: 'Reschedule' }));
    await expect(args.onAction).toHaveBeenCalledWith('Reschedule');
    await userEvent.click(banner);
    await expect(args.onOpenPinned).toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Everything at once, which in the app means a pet-parent conversation attached to a ' +
          'booked appointment on a companion with flags. Three stacked bands eat about 130px of ' +
          'thread height - worth seeing together, because each block was designed on its own and ' +
          'this is the only place they meet.',
      },
    },
  },
};

export const InProgress: Story = {
  name: 'In progress (Mark complete appears)',
  args: { appointment: appointment({ status: 'IN_PROGRESS' }) },
  play: async ({ canvasElement }) => {
    // Reschedule drops out and Mark complete arrives - the row is not a superset of the
    // upcoming one, it is a different row.
    await expect(actionNames(canvasElement)).toEqual([
      'Send form',
      'Mark complete',
      'Book follow-up',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only status where **Mark complete** is offered, because `IN_PROGRESS -> COMPLETED` ' +
          'is the only transition into `COMPLETED` the status machine allows. Rescheduling is ' +
          'gone by now: the consultation has started.',
      },
    },
  },
};

export const Completing: Story = {
  name: 'Completion in flight',
  args: { appointment: appointment({ status: 'IN_PROGRESS' }), completing: true },
  play: async ({ canvasElement }) => {
    // The button is REMOVED, not disabled - so the row reflows and the two survivors
    // shift left. That reflow is the whole reason to look at this state.
    await expect(actionNames(canvasElement)).toEqual(['Send form', 'Book follow-up']);
    // The name list alone would still pass if the hidden action left a non-button
    // placeholder behind holding its gap open, so the container's child count is
    // asserted too: two children, nothing standing in for the third.
    const actions = apptBanner(canvasElement).lastElementChild as HTMLElement;
    await expect(actions.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same appointment while the status PATCH is open. `completing` hides Mark complete ' +
          'so it cannot be pressed twice, and there is no spinner or disabled pill standing in ' +
          'for it - the row simply gets shorter. Whether that reads as "working" or as "the ' +
          'button vanished" is the design question this story exists to put in front of someone.',
      },
    },
  },
};

export const CancelledAppointment: Story = {
  name: 'Cancelled (one action left)',
  args: { appointment: appointment({ status: 'CANCELLED' }), allergy: undefined, alerts: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Every gated action fails its gate; only the unconditional one survives.
    await expect(actionNames(canvasElement)).toEqual(['Book follow-up']);
    // Send form is gated on `canEnterAppointmentWorkspace`, which refuses cancelled
    // appointments - offering it here would strand the user on the workspace's
    // "cannot be opened" message.
    await expect(canvas.queryByRole('button', { name: 'Send form' })).not.toBeInTheDocument();
    await expect(canvas.queryByText(/^Allergy:/)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A cancelled booking, and the narrowest the banner ever gets: chip on the left, a ' +
          'single pill on the right, and a lot of space between them. The chip is still shown ' +
          'because the conversation is still about that appointment.',
      },
    },
  },
};

export const PinnedOnly: Story = {
  name: 'Pinned banner only',
  args: {
    allergy: undefined,
    alerts: [],
    appointment: undefined,
    pinned: [{ id: 'p1', text: 'Discharge instructions are in the attached PDF.' }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = canvas.getByRole('button', { name: /^Pinned/ });
    // A single pin gets no "+ N more" suffix at all, rather than "+ 0 more".
    await expect(banner).toHaveTextContent(
      'Pinned · “Discharge instructions are in the attached PDF.”'
    );
    await expect(banner.textContent).not.toContain('more');
    // The other two blocks are absent, so the banner sits directly under the header
    // with only its own 6px top padding above it.
    await expect(canvas.queryByText('Appointment')).not.toBeInTheDocument();
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The staff-conversation case: no clinical record behind the thread, just pins. This is ' +
          'the only block that renders on its own in practice, and it is the one with no ' +
          'background of its own - a `--surface-soft` pill inset from the thread edges rather ' +
          'than a full-bleed band like the two above it.',
      },
    },
  },
};

export const RendersNothing: Story = {
  name: 'Nothing to show (returns null)',
  args: { allergy: undefined, alerts: [], appointment: undefined, pinned: [] },
  play: async ({ canvasElement }) => {
    // Asserted structurally rather than with a text query: the preview decorator puts an
    // sr-only <h1> in the canvas, so `canvasElement` is never empty and "no text" would
    // be true even for a component that rendered an empty shell.
    //
    // Measured against THIS story's own frame rather than by counting divs in the whole
    // canvas - the canvas also holds Storybook's layout wrappers, which are not part of
    // the contract. An empty frame is the only honest way to say the early return fired:
    // a component that returned `<div className="shrink-0" />` would still satisfy "no
    // text" and "no buttons".
    const frame = within(canvasElement).getByTestId('context-frame');
    await expect(frame.children).toHaveLength(0);
    await expect(frame.textContent).toBe('');
    await expect(canvasElement.querySelectorAll('button')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A staff thread with no pins - by volume, the most common state in the product. The ' +
          'component returns `null`, so the thread starts immediately under the channel header ' +
          "with no residual padding or hairline. This story's own frame is left completely " +
          'empty, which is what the play function checks.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: banner stacks, actions scroll',
  args: { appointment: appointment({ status: 'IN_PROGRESS' }) },
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in Storybook
  // 10 and is inert, so a story pinned that way silently renders the desktop branch.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = apptBanner(canvasElement);
    const chip = canvas.getByText('Appointment').parentElement?.parentElement as HTMLElement;
    const actions = banner.lastElementChild as HTMLElement;

    // Below `sm` the banner is a column: chip on its own line, actions under it.
    await expect(getComputedStyle(banner).flexDirection).toBe('column');
    // `self-start` keeps the chip its own width instead of stretching across the column.
    await expect(getComputedStyle(chip).alignSelf).toBe('flex-start');
    // The actions do not wrap on a phone, they scroll - three pills on a 375px screen
    // would otherwise become three stacked rows.
    await expect(getComputedStyle(actions).flexWrap).toBe('nowrap');
    await expect(getComputedStyle(actions).overflowX).toBe('auto');
    await expect(actionNames(canvasElement)).toEqual([
      'Send form',
      'Mark complete',
      'Book follow-up',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the same three actions are a horizontal scroller with `-mx-1` bleed, so the ' +
          'first pill starts at the thread edge and the last one is reachable by swiping rather ' +
          'than by the row growing a second line. The chip keeps its own width above it.',
      },
    },
  },
};
