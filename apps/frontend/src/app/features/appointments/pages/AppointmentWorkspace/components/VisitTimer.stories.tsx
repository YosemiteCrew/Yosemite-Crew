import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import VisitTimer from './VisitTimer';

/**
 * Every story runs against a stopped clock.
 *
 * The pill reads `Date.now()` twice - once in the inner timer's state initialiser
 * and once per second from an interval - so an unfrozen clock makes the rendered
 * digits a function of how long Storybook took to boot. Freezing it means the
 * elapsed value is exactly `FROZEN_NOW - startAt` and can be asserted to the second.
 * Built with the local-time constructor rather than a UTC literal so the fixture does
 * not slide with the runner's offset.
 */
const FROZEN_NOW = new Date(2026, 2, 12, 10, 12, 34).getTime();

const freezeClock = () => {
  const realNow = Date.now;
  Date.now = () => FROZEN_NOW;
  return () => {
    Date.now = realNow;
  };
};

const agoMinutes = (minutes: number, seconds = 0): Date =>
  new Date(FROZEN_NOW - minutes * 60_000 - seconds * 1000);

const inMinutes = (minutes: number): Date => new Date(FROZEN_NOW + minutes * 60_000);

const parseRgba = (value: string): [number, number, number, number] => {
  const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
};

/**
 * `--color-warning-100` is an opaque tint in light and a 16% wash in dark, so the
 * amber pill's own `backgroundColor` is not the colour anybody looks at. Composite
 * down to the first opaque ancestor - reading the raw rgba in dark reports a ratio
 * that does not exist.
 */
const effectiveBackground = (element: Element): [number, number, number] => {
  const layers: Array<[number, number, number, number]> = [];
  for (let node: Element | null = element; node; node = node.parentElement) {
    const layer = parseRgba(globalThis.getComputedStyle(node).backgroundColor);
    if (layer[3] > 0) {
      layers.push(layer);
      if (layer[3] >= 1) break;
    }
  }
  let ground: [number, number, number] = [255, 255, 255];
  for (const [r, g, b, alpha] of layers.reverse()) {
    ground = [
      r * alpha + ground[0] * (1 - alpha),
      g * alpha + ground[1] * (1 - alpha),
      b * alpha + ground[2] * (1 - alpha),
    ];
  }
  return ground;
};

const relativeLuminance = ([r, g, b]: [number, number, number]): number => {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrastRatio = (ink: string, ground: [number, number, number]): number => {
  const [r, g, b] = parseRgba(ink);
  const inkLuminance = relativeLuminance([r, g, b]);
  const groundLuminance = relativeLuminance(ground);
  return (
    (Math.max(inkLuminance, groundLuminance) + 0.05) /
    (Math.min(inkLuminance, groundLuminance) + 0.05)
  );
};

const pillIn = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByTestId('visit-timer');

const meta = {
  title: 'Workspace/VisitTimer',
  component: VisitTimer,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The "In room HH:MM:SS" pill in the workspace header, counting up once a second from ' +
          'the best-available start (`encounter.admittedAt`, falling back to the booked ' +
          '`appointment.startTime`). Three states - resting, running, and amber past the booked ' +
          'slot - across a desktop and a phone presentation. It is informational only and never ' +
          'gates an action.\n\n' +
          '**The clock is frozen at 12 Mar 2026, 10:12:34 in every story here**, so the digits ' +
          'are deterministic and each fixture is expressed as an offset from that instant. ' +
          'Nothing in the timer is interactive, so there is nothing to click.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: freezeClock,
} satisfies Meta<typeof VisitTimer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotStarted: Story = {
  name: 'No start timestamp',
  play: async ({ canvasElement }) => {
    const pill = pillIn(canvasElement);
    await expect(pill).toHaveAttribute('data-state', 'idle');
    /* Exactly this, and only this. The data model has no room-entry timestamp, so
       the honest answer when nothing has been recorded is "Not started" - a zeroed
       "In room 00:00:00" would read as a visit that started and instantly froze. */
    await expect(pill.textContent).toBe('Not started');
  },
};

export const BookedButNotArrived: Story = {
  name: 'Start is still in the future',
  args: { startAt: inMinutes(20) },
  play: async ({ canvasElement }) => {
    const pill = pillIn(canvasElement);
    /* The `nowMs < startMs` guard. A 10:30 appointment opened at 10:12 has a start
       timestamp, so a naive `startAt ? running : idle` check counts up - and because
       `formatElapsed` clamps its negative span to zero, it does not look wrong. It
       looks like a visit sitting at 00:00:00, which is the one state this component
       must never invent. */
    await expect(pill).toHaveAttribute('data-state', 'idle');
    await expect(pill.textContent).toBe('Not started');
  },
};

export const Running: Story = {
  name: 'Running (1h 07m 12s in)',
  args: { startAt: agoMinutes(67, 12), bookedEndAt: inMinutes(23) },
  play: async ({ canvasElement }) => {
    const pill = pillIn(canvasElement);
    await expect(pill).toHaveAttribute('data-state', 'running');
    /* Full HH:MM:SS on the desktop pill - the header has the width for it, and the
       hour is the number a clinician running late actually needs. Asserted whole
       rather than by substring: the pulse dot is `aria-hidden` and contributes no
       text, so this string IS the accessible name of the pill. */
    await expect(pill.textContent).toBe('In room 01:07:12');
    // Still inside the booked slot, so no amber even though it has run over an hour.
    await expect(pill.textContent).not.toContain('Over booked slot');
  },
};

export const OverBooked: Story = {
  name: 'Past the booked slot',
  args: { startAt: agoMinutes(45), bookedEndAt: agoMinutes(15) },
  play: async ({ canvasElement }) => {
    const pill = pillIn(canvasElement);
    await expect(pill).toHaveAttribute('data-state', 'over');
    await expect(pill.textContent).toBe('Over booked slot · 00:45:00');

    /* The number the component's own comment is about. This label takes the 900 ink
       step, not the 700 mid-ramp fill, which measured 2.77:1 on its own warning-100
       tint - and this pill sits on every workspace step, so it was the least
       readable thing on the busiest screen in the product. Nothing but a measurement
       catches a slide back down the ramp. */
    const ink = globalThis.getComputedStyle(pill).color;
    await expect(contrastRatio(ink, effectiveBackground(pill))).toBeGreaterThanOrEqual(4.5);
  },
};

export const OverBookedDark: Story = {
  name: 'Dark: past the booked slot',
  args: { startAt: agoMinutes(45), bookedEndAt: agoMinutes(15) },
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const pill = pillIn(canvasElement);
    await expect(pill).toHaveAttribute('data-state', 'over');

    /* Dark is where the naive version of this check goes wrong: `--color-warning-100`
       is a 16% amber wash there rather than an opaque tint, so the ratio measured
       straight off the pill is against a colour that is never painted. Composited
       onto the espresso page it is the real number. */
    const ink = globalThis.getComputedStyle(pill).color;
    await expect(contrastRatio(ink, effectiveBackground(pill))).toBeGreaterThanOrEqual(4.5);
  },
};

export const Phone: Story = {
  name: 'Phone: all three states',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <VisitTimer variant="phone" />
      <VisitTimer variant="phone" startAt={agoMinutes(12, 5)} bookedEndAt={inMinutes(18)} />
      <VisitTimer variant="phone" startAt={agoMinutes(45)} bookedEndAt={agoMinutes(15)} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [idle, running, over] = within(canvasElement).getAllByTestId('visit-timer');

    await expect(idle).toHaveAttribute('data-state', 'idle');
    await expect(idle.textContent).toBe('Not started');

    /* The compaction, asserted by exact equality because that is the only way to see
       it. An under-an-hour visit drops the leading "00:" so the pill reads "12:05" -
       the un-compacted "00:12:05" still contains "12:05", so a substring assertion
       passes on the bug, and eight glyphs in a 10px pill is what pushes the phone
       patient bar into a second line. */
    await expect(running).toHaveAttribute('data-state', 'running');
    await expect(running.textContent).toBe('12:05');
    await expect(over).toHaveAttribute('data-state', 'over');
    await expect(over.textContent).toBe('45:00');

    // Amber is carried by the fill, not only by the digits changing.
    await expect(globalThis.getComputedStyle(over).backgroundColor).not.toBe(
      globalThis.getComputedStyle(running).backgroundColor
    );

    /* All three phone pills are the same height. They swap in place in the patient
       bar as the visit progresses, so a padding change on one branch alone would
       nudge the whole bar the moment a clinician marks the patient in the room. */
    const heights = new Set(
      [idle, running, over].map((pill) => Math.round(pill.getBoundingClientRect().height))
    );
    await expect(heights.size).toBe(1);
  },
};

export const CrampedHeaderRow: Story = {
  name: 'Cramped header row',
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex w-[260px] items-center gap-2">
        <span className="min-w-0 truncate text-caption-1 text-text-secondary">
          Poppy Hartmann · Beagle · Lena Hartmann · Consult 1
        </span>
        <VisitTimer startAt={agoMinutes(45)} bookedEndAt={agoMinutes(15)} />
      </div>
      <div className="flex w-[900px] items-center gap-2">
        <span className="min-w-0 truncate text-caption-1 text-text-secondary">Poppy Hartmann</span>
        <VisitTimer startAt={agoMinutes(45)} bookedEndAt={agoMinutes(15)} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [cramped, roomy] = within(canvasElement).getAllByTestId('visit-timer');

    /* `shrink-0`, measured as a relation rather than a magic number: the same pill in
       a 260px header row and in a 900px one must come out the same width. The header
       it lives in is a flex row with a patient name that can be arbitrarily long, and
       without `shrink-0` the pill is what gives - "Over booked slot · 00:45:00" wraps
       to two lines and silently makes the whole workspace header taller. The name is
       the element that is meant to truncate. */
    await expect(Math.round(cramped.getBoundingClientRect().width)).toBe(
      Math.round(roomy.getBoundingClientRect().width)
    );
    await expect(Math.round(cramped.getBoundingClientRect().height)).toBe(
      Math.round(roomy.getBoundingClientRect().height)
    );
  },
};
