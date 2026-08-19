import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import { AuditTimeline } from './CompanionHistoryTimeline';
import type { AuditActorType, AuditEventType, AuditTrail } from '@/app/features/audit/types/audit';

const ORG_ID = 'org-avenger-park';
const COMPANION_ID = 'companion-1';

const AUDIT_BASE: AuditTrail = {
  id: 'audit-base',
  organisationId: ORG_ID,
  companionId: COMPANION_ID,
  eventType: 'APPOINTMENT_CREATED',
  actorType: 'PMS_USER',
  actorName: 'Dr. Elena Marsh',
  entityType: 'APPOINTMENT',
  entityId: 'appt-1',
  occurredAt: new Date('2026-03-12T09:42:00.000Z'),
};

const audit = (over: Partial<AuditTrail>): AuditTrail => ({ ...AUDIT_BASE, ...over });

/**
 * `AuditActorType` and `AuditEventType` are closed unions, but the component's own
 * fallbacks exist precisely for values outside them - an actor type a later backend
 * adds, or a row written before the enum settled. Widening through `string` is what
 * makes those branches reachable from a story; a direct literal cast is rejected.
 */
const asActorType = (value: string): AuditActorType => value as AuditActorType;
const asEventType = (value: string): AuditEventType => value as AuditEventType;

/**
 * One booking's worth of trail, in the order the service returned it. The component
 * does not sort, so this order is the rendered order.
 */
const ENTRIES: AuditTrail[] = [
  audit({
    id: 'a-1',
    eventType: 'APPOINTMENT_REQUESTED',
    actorType: 'PARENT',
    actorName: 'Nina Alvarez',
    occurredAt: new Date('2026-03-10T08:15:00.000Z'),
  }),
  audit({
    id: 'a-2',
    eventType: 'APPOINTMENT_APPROVED',
    occurredAt: new Date('2026-03-10T09:02:00.000Z'),
  }),
  audit({
    id: 'a-3',
    eventType: 'APPOINTMENT_CHECKED_IN',
    occurredAt: new Date('2026-03-12T09:42:00.000Z'),
  }),
  audit({
    id: 'a-4',
    eventType: 'DOCUMENT_ADDED',
    entityType: 'DOCUMENT',
    entityId: 'doc-1',
    actorType: 'SYSTEM',
    actorName: null,
    occurredAt: new Date('2026-03-12T10:06:00.000Z'),
  }),
  audit({
    id: 'a-5',
    eventType: 'COMPANION_ORG_LINK_APPROVED',
    entityType: undefined,
    actorName: 'Tom Reyes',
    occurredAt: new Date('2026-03-12T10:11:00.000Z'),
  }),
];

/** The three-part rail between the timestamp and the card: stub, marker, stub. */
const stampOf = (item: HTMLElement): HTMLElement => item.children[0] as HTMLElement;
const railOf = (item: HTMLElement): HTMLElement => item.children[1] as HTMLElement;
const cardOf = (item: HTMLElement): HTMLElement => item.children[2] as HTMLElement;

/**
 * `Mar 12, 2026, 09:42 AM` - `formatDateTimeLocal` on an en-US `Intl.DateTimeFormat`.
 *
 * Read through `stampTextOf`, which collapses runs of whitespace first. Since ICU 72
 * the separator before AM/PM is U+202F NARROW NO-BREAK SPACE, not U+0020, so a
 * pattern written with a literal space fails on every current Chrome for a reason
 * that has nothing to do with this component. The hour is likewise `1,2` rather than
 * `2`: `hour: '2-digit'` is advisory under `hour12` and ICU has changed its mind
 * about padding it before now. What the pattern is really pinning is that the value
 * went through the formatter at all instead of landing on the `'-'` fallback that
 * `formatDateTimeLocal` is called with.
 */
const STAMP_PATTERN = /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/;

const stampTextOf = (item: HTMLElement): string =>
  (stampOf(item).textContent ?? '').replaceAll(/\s+/g, ' ').trim();

/**
 * What the browser actually paints for a design token, resolved in this subtree.
 *
 * Comparing a computed `rgb(...)` against the hex in `globals.css` needs a converter
 * and hard-codes a value that the dark theme overrides anyway; painting a throwaway
 * span with the token and reading it back gets the live value for whichever theme
 * the story is rendering in.
 */
const paintedColour = (host: HTMLElement, token: string): string => {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  host.append(probe);
  const painted = getComputedStyle(probe).color;
  probe.remove();
  return painted;
};

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const meta = {
  title: 'Companions/AuditTimeline',
  component: AuditTimeline,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Audit trail tab of the companion history timeline. It is reachable only by ' +
          "picking the last filter pill, and it is the one branch of the timeline's body that " +
          'renders none of the normal entry machinery - a different data type (`AuditTrail`, not ' +
          '`HistoryEntry`), a different loader, a different row. So none of it had ever been ' +
          'drawn: not the rows, not the loading line, not the two empty states.\n\n' +
          'The layout is a three-column flex row per entry: a fixed **160px** right-aligned ' +
          'timestamp in `--color-pill-success-text` (the green normally reserved for a completed ' +
          'status pill), a connector rail, then the card. The rail is assembled from three ' +
          'separate nodes - a 10px top stub, the dot, and a flexing bottom stub - and the top ' +
          'stub of the first row and the bottom stub of the last are deliberately left ' +
          'unpainted, so the line starts and stops at the dots instead of bleeding past them. ' +
          'That is three index comparisons carried in template strings, which is exactly the kind ' +
          'of thing that silently inverts, so the stories read the computed background of the ' +
          'individual stubs rather than trusting the classes.\n\n' +
          "Three content branches are worth a reviewer's attention. `getAuditActorDisplay` maps " +
          'only three actor types and falls back to **"System"** for anything else, so an actor ' +
          'type the backend adds later is silently reported as the system rather than as unknown. ' +
          'The dot has an inactive grey variant keyed on `eventType` being blank - which is ' +
          'the same condition that makes `toTitle` return an empty string, so the grey dot only ' +
          'ever appears next to a card with no heading. The error notice used to ask for a ' +
          'token that does not exist - `text-error-main` needs `--color-error-main`, which this ' +
          'design system never defines - so the failure message was painted in ordinary body ' +
          'ink; it now uses `text-text-error`, and the Error story asserts that red positively.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    loading: false,
    error: null,
    entries: ENTRIES,
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[820px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuditTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Audit trail',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('listitem');
    expect(items).toHaveLength(5);

    // Titles are `toTitle(eventType)`: underscores to spaces, then sentence case.
    // Only the first word keeps its capital, so "Appointment checked in".
    expect(within(items[0]).getByText('Appointment requested')).toBeInTheDocument();
    expect(within(items[2]).getByText('Appointment checked in')).toBeInTheDocument();
    expect(within(items[4]).getByText('Companion org link approved')).toBeInTheDocument();

    // All three actor renderings, in the order they appear.
    expect(within(items[0]).getByText('Updated by: Nina Alvarez • Pet parent')).toBeInTheDocument();
    expect(
      within(items[1]).getByText('Updated by: Dr. Elena Marsh • Team member')
    ).toBeInTheDocument();
    // No actor name, so the bullet and the name are dropped rather than left dangling.
    expect(within(items[3]).getByText('Updated by: System')).toBeInTheDocument();

    // The entity chip is conditional, and the last entry has no entityType at all -
    // so its header row holds the title and nothing else.
    expect(within(items[0]).getByText('Appointment')).toBeInTheDocument();
    expect(within(items[3]).getByText('Document')).toBeInTheDocument();
    expect(cardOf(items[0]).children[0].children).toHaveLength(2);
    expect(cardOf(items[4]).children[0].children).toHaveLength(1);

    // Every stamp resolved through the formatter rather than hitting the '-' fallback,
    // and the two same-day entries really do differ in their minutes.
    for (const item of items) {
      expect(stampTextOf(item)).toMatch(STAMP_PATTERN);
    }
    expect(stampTextOf(items[3])).not.toBe(stampTextOf(items[4]));

    /* Rail continuity. Each rail is exactly three nodes; the first row's TOP stub and
       the last row's BOTTOM stub are unpainted, every stub in between is not. Colours
       get read inside waitFor - these tokens land through a transition. */
    const rails = items.map(railOf);
    for (const rail of rails) {
      expect(rail.children).toHaveLength(3);
    }
    await waitFor(() => {
      expect(getComputedStyle(rails[0].children[0]).backgroundColor).toBe(TRANSPARENT);
      expect(getComputedStyle(rails[1].children[0]).backgroundColor).not.toBe(TRANSPARENT);
      expect(getComputedStyle(rails[3].children[2]).backgroundColor).not.toBe(TRANSPARENT);
      expect(getComputedStyle(rails[4].children[2]).backgroundColor).toBe(TRANSPARENT);
    });

    /* The timestamp is not body ink - it is the completed-status green, which is a
       deliberate call and the thing to sanity-check against the design. Matched
       against the resolved token rather than against "different from the card", so a
       change to some OTHER non-body colour fails here instead of passing. */
    const green = paintedColour(canvasElement, '--color-pill-success-text');
    await waitFor(() => {
      expect(getComputedStyle(stampOf(items[0])).color).toBe(green);
      expect(getComputedStyle(cardOf(items[0])).color).not.toBe(green);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'One appointment from request to check-in, plus the document and link events that ' +
          'landed alongside it. Five rows is enough to show every rail case at once: the bare top ' +
          'stub on row one, the continuous line through rows two to four, and the bare bottom ' +
          'stub on row five. Note that the component does not sort - this reads chronologically ' +
          'only because the service returned it that way.',
      },
    },
  },
};

export const SingleEntry: Story = {
  name: 'One entry (no rail)',
  args: { entries: [ENTRIES[2]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText('Appointment checked in')).toBeInTheDocument();
    expect(
      within(items[0]).getByText('Updated by: Dr. Elena Marsh • Team member')
    ).toBeInTheDocument();

    /* The only row is both `index === 0` and the last one, so BOTH stubs are
       unpainted and the dot floats with no line through it. Worth pinning: the two
       conditions are written independently, and a single-entry trail is the state a
       freshly linked companion is in. */
    const rail = railOf(items[0]);
    expect(rail.children).toHaveLength(3);
    await waitFor(() => {
      expect(getComputedStyle(rail.children[0]).backgroundColor).toBe(TRANSPARENT);
      expect(getComputedStyle(rail.children[2]).backgroundColor).toBe(TRANSPARENT);
      // The dot itself is still painted, so "no rail" is not "nothing rendered".
      expect(getComputedStyle(rail.children[1].children[0]).backgroundColor).not.toBe(TRANSPARENT);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'A companion with exactly one recorded event. The rail degenerates to a lone dot, ' +
          'which is correct but leaves 10px of empty gutter above it and a flexing empty stub ' +
          'below - so the dot does not sit centred on the card it belongs to.',
      },
    },
  },
};

export const UnknownActor: Story = {
  name: 'Actor fallbacks',
  args: {
    entries: [
      audit({
        id: 'u-1',
        actorType: asActorType('PRACTICE_MANAGER'),
        actorName: 'Sam Okoro',
      }),
      audit({ id: 'u-2', actorType: undefined, actorName: null }),
      audit({ id: 'u-3', actorType: 'SYSTEM', actorName: '   ' }),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('listitem');
    expect(items).toHaveLength(3);

    /* An actor type outside the three mapped ones is reported as "System" while the
       human's name is kept - so a real person's action is attributed to the system.
       That is the line to look at if the backend ever adds a fourth actor type. */
    expect(within(items[0]).getByText('Updated by: Sam Okoro • System')).toBeInTheDocument();

    // A missing type and a whitespace-only name both collapse to the bare label, so
    // "no actor recorded" and "the system did it" are indistinguishable here.
    expect(canvas.getAllByText('Updated by: System')).toHaveLength(2);

    /* The actor line is the last child of the card in every case, and the rest of the
       row is untouched by the fallback - same title, same chip. A fallback that had
       leaked into the heading would still satisfy the three queries above. */
    for (const item of items) {
      expect(within(item).getByText('Appointment created')).toBeInTheDocument();
      expect(within(item).getByText('Appointment')).toBeInTheDocument();
      expect(cardOf(item).children).toHaveLength(2);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The three ways the actor line degrades. Only `PMS_USER`, `PARENT` and `SYSTEM` are in ' +
          "the map; everything else - including `undefined` - takes the `|| 'System'` branch. " +
          'The first row is the interesting one: it keeps "Sam Okoro" and pairs it with "System", ' +
          'which reads as a contradiction rather than as an unrecognised role.',
      },
    },
  },
};

export const BlankEventType: Story = {
  name: 'Blank event type (inactive dot)',
  args: {
    entries: [
      audit({ id: 'b-1', eventType: 'INVOICE_PAID', entityType: 'INVOICE' }),
      audit({ id: 'b-2', eventType: asEventType(''), entityType: 'INVOICE' }),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Invoice paid')).toBeInTheDocument();

    // Same condition drives both: a blank eventType greys the dot AND empties the
    // heading, so the grey variant only ever renders beside a headless card.
    const heading = cardOf(items[1]).children[0].children[0];
    expect(heading.textContent).toBe('');
    // The chip is still there, so the card is not empty - just unlabelled. Both rows
    // keep the same two-row card shape, heading plus actor line.
    expect(canvas.getAllByText('Invoice')).toHaveLength(2);
    expect(cardOf(items[1]).children).toHaveLength(2);
    expect(
      within(items[1]).getByText('Updated by: Dr. Elena Marsh • Team member')
    ).toBeInTheDocument();

    const activeRing = railOf(items[0]).children[1];
    const inactiveRing = railOf(items[1]).children[1];
    /* Resolved outside the waitFor, like the Error story's probes: `paintedColour`
       mutates the DOM, and waitFor re-runs its callback from a MutationObserver
       microtask, so a callback that mutates and THEN throws spins forever without
       letting the timeout timer fire. Harmless while these four pass; a hang that
       takes out the whole lane the day one of them does not. */
    const grey = paintedColour(canvasElement, '--color-neutral-300');
    await waitFor(() => {
      // Ring and inner fill both switch from brand blue to neutral-300, and the
      // inactive pair is the SAME neutral in both places rather than two greys.
      expect(getComputedStyle(activeRing).borderTopColor).not.toBe(grey);
      expect(getComputedStyle(inactiveRing).borderTopColor).toBe(grey);
      expect(getComputedStyle(inactiveRing.children[0]).backgroundColor).toBe(grey);
      expect(getComputedStyle(activeRing.children[0]).backgroundColor).not.toBe(grey);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only render in which the inactive marker exists. `active` is ' +
          "`String(eventType ?? '').trim().length > 0`, so it is false exactly when `toTitle` " +
          'also returns an empty string - the grey dot and the blank heading are the same ' +
          'defect, seen twice. The API types `eventType` as a closed union, so this needs a cast ' +
          'to reproduce, but a payload from an older writer or a partially migrated row lands ' +
          'here for real.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Loading',
  // A non-null error AND a full entry list, both of which lose to `loading`.
  args: { loading: true, error: 'Audit trail is unavailable for this organisation.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A plain text line, not a skeleton and not the shared spinner - so the tab jumps
    // from one line of type to a full rail with no intermediate shape.
    const line = canvas.getByText('Loading audit trail…');
    // The other two branches are genuinely unreachable here, not merely empty.
    expect(canvas.queryByRole('alert')).toBeNull();
    expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
    expect(canvas.queryByText('Audit trail is unavailable for this organisation.')).toBeNull();

    /* The indent the prose below is about, measured rather than asserted from the
       class list: `px-4 py-8` here against the `px-1 py-8` the overview loader uses,
       so the two loading lines sit 12px apart when a user switches filter pills. */
    await waitFor(() => {
      const style = getComputedStyle(line);
      expect(style.paddingLeft).toBe('16px');
      expect(style.paddingTop).toBe('32px');
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          '`loading` wins over everything, including a non-null `error` and a populated ' +
          '`entries` - the three branches are checked in order. Compare the vertical rhythm ' +
          'against the "Loading overview…" line the other filters use: same treatment, ' +
          'different horizontal padding (`px-4` here, `px-1` there), so the two loaders sit at ' +
          'different indents when switching tabs.',
      },
    },
  },
};

export const ErrorState: Story = {
  name: 'Error',
  args: { error: 'Audit trail is unavailable for this organisation.', entries: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The error path is the only one that gets an assertive role, so a screen reader
    // hears the failure without moving focus.
    const alert = canvas.getByRole('alert');
    expect(alert).toHaveTextContent('Audit trail is unavailable for this organisation.');
    expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
    expect(canvas.queryByText('No records yet')).toBeNull();

    const notice = alert.children[0] as HTMLElement;

    /* Both token probes are resolved BEFORE the waitFor and never inside it.
       `paintedColour` appends and removes a node, and `waitFor` watches `document`
       with `{subtree, childList}`, re-running its callback from the
       MutationObserver - which is a MICROTASK. A callback that mutates and then
       throws therefore re-queues itself forever without ever yielding to the
       macrotask queue, so waitFor's own `setTimeout` timeout can never fire: the
       tab wedges instead of failing, taking the whole test lane with it. That is
       what timed this story out once the assertion below went stale. Token lookups
       are static, so hoisting them costs nothing; the live nodes are still read
       inside the callback, so colours are still polled through their transition. */
    const errorInk = paintedColour(canvasElement, '--color-text-error');
    const surface = paintedColour(canvasElement, '--color-neutral-0');

    await waitFor(() => {
      /* Guard first: colour utilities ARE live on this subtree - the card takes its
         `bg-neutral-0` fill - so the ink assertions below are findings about the
         notice itself and not about a stylesheet that never loaded. */
      expect(getComputedStyle(alert).backgroundColor).toBe(surface);

      /* The failure message is red, and specifically the design system's text-error
         ink: `--color-text-error`, which resolves to `--danger-text` (#a6271d on the
         bone screen, #f2938a in dark) rather than the `--color-error` FILL step.
         Matched against the resolved token rather than "differs from body ink", so a
         drift to some other non-body colour fails here instead of passing.

         This replaces a pin on a defect that has since been fixed. The branch used to
         ask for `text-error-main`, a class Tailwind compiled to NOTHING because no
         `--color-error-main` token exists, so the message inherited ordinary body ink
         and `role="alert"` was the only - invisible - signal of failure. The previous
         revision of this story pinned that and left a note to flip to a positive check
         on the red once it was fixed; `HistoryEmptyState` now uses `text-text-error`,
         so this is that flip. A repo-wide guard
         (`src/app/__tests__/ui/tokens/colorUtilityExists.test.ts`) now stops any
         colour utility naming a non-existent token from shipping again. */
      expect(getComputedStyle(notice).color).toBe(errorInk);
      // ...and it is therefore visibly distinct from the container's body ink, which
      // is the accessibility property the old defect defeated.
      expect(getComputedStyle(notice).color).not.toBe(getComputedStyle(alert).color);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The failure notice, rendered through the shared `HistoryEmptyState` with `isError`. ' +
          'It passes the raw service message straight through, so whatever the API says is what ' +
          'the practice reads, and it is painted in `--color-text-error` - which resolves to ' +
          '`--danger-text` (#a6271d on the bone screen, #f2938a in dark), not the ' +
          '`--color-error` fill step.\n\n' +
          'This branch previously asked for `text-error-main`, a class Tailwind compiled to no ' +
          'rule at all because no `--color-error-main` token exists (the defined ones are ' +
          '`--color-error`, `--color-error-100`, `--color-error-500`, `--color-error-700`). The ' +
          'message inherited body ink, was pixel-identical to the non-error notice, and ' +
          '`role="alert"` was the only - invisible - signal that anything had failed. That ' +
          'shipped across five error messages in PIMS before a story measured both inks as ' +
          'rgb(48, 47, 46) and caught it. All five are fixed, and ' +
          '`__tests__/ui/tokens/colorUtilityExists.test.ts` now fails any colour utility naming ' +
          'a token that does not exist.',
      },
    },
  },
};

export const EmptyState: Story = {
  name: 'No audit entries',
  args: { entries: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('No audit entries found.')).toBeInTheDocument();

    /* Loaded-and-empty takes the compact notice box, NOT the rich "No records yet"
       folder illustration - `HistoryEmptyState` only reaches that when both `isError`
       and `message` are absent, and this branch always passes a message. Assert the
       folder copy and its supporting line are genuinely not here, because the two
       states look nothing alike and the other filters show the illustrated one. */
    expect(canvas.queryByText('No records yet')).toBeNull();
    expect(canvas.queryByText(/Everything from visits lands here/)).toBeNull();
    expect(canvas.queryAllByRole('listitem')).toHaveLength(0);

    // ...and it is the notice box, not an alert: the empty branch drops `isError`, so
    // nothing here is announced assertively.
    expect(canvas.queryByRole('alert')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A companion whose trail is genuinely empty. This is the one filter that never shows ' +
          'the illustrated records empty state, because it always supplies a message - so ' +
          'switching from Medical records to Audit trail on an empty companion swaps a 64px ' +
          'illustration for a one-line box.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('listitem');
    expect(items).toHaveLength(5);

    /* The timestamp column is `w-40 shrink-0`, so it stays 160px at every width and
       the card absorbs the whole reduction. */
    const stamp = stampOf(items[0]);
    expect(Math.round(stamp.getBoundingClientRect().width)).toBe(160);
    /* `whitespace-nowrap` keeps date and time on one line rather than stacking them.
       Counted over a Range rather than the element: the stamp is a flex item, so it is
       blockified AND stretched to the row height, and its own rects say nothing about
       how the text inside flowed. A Range over the text returns one rect per line box. */
    expect(getComputedStyle(stamp).whiteSpace).toBe('nowrap');
    const stampText = document.createRange();
    stampText.selectNodeContents(stamp);
    expect(stampText.getClientRects()).toHaveLength(1);
    // One line, and it is the whole stamp - not a truncated one.
    expect(stampTextOf(items[0])).toMatch(STAMP_PATTERN);

    /* What is left for the card: 375 less the wrapper padding, the 160px stamp, the
       20px dot and two 12px gaps. Under 200px for a bold title, an entity chip and a
       full actor line, all of which then wrap. */
    const card = cardOf(items[0]);
    expect(card.getBoundingClientRect().width).toBeLessThan(200);
    /* The stamp is wider than the card it annotates - the ratio, not the absolute
       number, is the design problem here. */
    expect(stamp.getBoundingClientRect().width).toBeGreaterThan(card.getBoundingClientRect().width);

    /* Title and chip share one `flex-wrap` row, and at this width they no longer fit
       side by side, so the chip drops under the title and the header row is taller
       than either child. */
    const headerRow = card.children[0] as HTMLElement;
    expect(headerRow.children).toHaveLength(2);
    const title = headerRow.children[0] as HTMLElement;
    const chip = headerRow.children[1] as HTMLElement;
    expect(chip.getBoundingClientRect().top).toBeGreaterThan(
      title.getBoundingClientRect().bottom - 1
    );

    // The rail still assembles the same way - the phone layout is not a variant here.
    expect(railOf(items[0]).children).toHaveLength(3);
    expect(within(items[0]).getByText('Appointment requested')).toBeInTheDocument();
    expect(within(items[0]).getByText('Updated by: Nina Alvarez • Pet parent')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The audit tab inside the phone record. Nothing about this component is responsive: ' +
          'the 160px timestamp gutter is fixed and `shrink-0`, so at 375 it takes close to half ' +
          'the row, the card is squeezed under 200px, and the gutter ends up wider than the ' +
          'content it labels. The title and the entity chip stop fitting on one line and the ' +
          'chip drops beneath the title, which is the trade to look at - either the stamp moves ' +
          'above the card on narrow widths, or it drops the date and keeps the time.',
      },
    },
  },
};
