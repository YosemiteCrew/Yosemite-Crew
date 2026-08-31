import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { setPreferredTimeZone } from '@/app/lib/timezone';
import ReadyToggle from './ReadyToggle';

/**
 * The stamp is formatted in the org's PREFERRED time zone, which is read from
 * `localStorage` on every call - not from the runner's clock. A token left
 * behind by another story (or by a developer's own session on :6117) would
 * reformat "10:25 AM" into whatever zone that token names, so the stories clear
 * the key, pin Europe/Berlin explicitly, and put the previous value back.
 */
const TIMEZONE_STORAGE_KEY = 'yc_preferred_timezone';

const withBerlinClock = () => {
  const previous = globalThis.localStorage.getItem(TIMEZONE_STORAGE_KEY);
  globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
  setPreferredTimeZone('Europe/Berlin');
  return () => {
    if (previous === null) globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
    else globalThis.localStorage.setItem(TIMEZONE_STORAGE_KEY, previous);
  };
};

/**
 * 16 March 2026, 09:25 UTC. Berlin is still on CET that week (DST starts on the
 * 29th), so this renders as "Mar 16, 10:25 AM". A fixed instant also keeps this
 * off the "Today" branch, which the Today story owns.
 */
const STAMPED_AT = new Date(Date.UTC(2026, 2, 16, 9, 25)).toISOString();

/** The 18px box is the first child span; the label text is the second. */
const checkbox = (button: HTMLElement): HTMLElement => button.firstElementChild as HTMLElement;

const meta = {
  title: 'Workspace/ReadyToggle',
  component: ReadyToggle,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Ready-for-billing / Ready-for-discharge toggle at the foot of the workspace.\n\n' +
          '**It looks like a checkbox and is a `<button>`.** Its state travels on ' +
          '`aria-pressed`, so the only thing telling a screen reader whether the visit is ready ' +
          'is an attribute with no visual counterpart - drop it and the control still paints ' +
          'green, still fills its box, and announces nothing. Every story below asserts it.\n\n' +
          '**Checking appends a provenance stamp inline**, in the label itself rather than in a ' +
          'second line: actor plus "Today, 10:25 AM" or "Mar 16, 10:25 AM". The actor falls back ' +
          'to "Clinical team" when the backend knows the timestamp but not the person, and the ' +
          'stamp is suppressed entirely when it knows neither - a checked toggle with no ' +
          'provenance is a real state, not an error.\n\n' +
          "The stamp is rendered in the org's preferred time zone, so these stories pin " +
          'Europe/Berlin around themselves rather than reading whatever the last visitor chose.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: withBerlinClock,
  args: {
    label: 'Ready for billing',
    state: { value: false },
    disabled: false,
    onToggle: fn(),
  },
} satisfies Meta<typeof ReadyToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  name: 'Not ready',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Ready for billing' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    const box = checkbox(button);
    // The box is drawn, not a real input, so its geometry is the only thing
    // making it read as a checkbox. size-[18px] with a 1.5px border.
    await expect(box.getBoundingClientRect().width).toBe(18);
    await expect(box.getBoundingClientRect().height).toBe(18);
    // Unchecked means an empty box: no tick, and nothing filling it.
    await expect(box.querySelector('svg')).toBeNull();
    await expect(globalThis.getComputedStyle(box).backgroundColor).toBe('rgba(0, 0, 0, 0)');

    await userEvent.click(button);
    await expect(args.onToggle).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state: a hairline box on muted ink, no stamp. The whole row is the hit ' +
          'target, not just the box.',
      },
    },
  },
};

export const CheckedWithStamp: Story = {
  name: 'Ready, with actor and time',
  args: {
    state: { value: true, byUserId: 'staff-weber', byName: 'Dr. Weber', at: STAMPED_AT },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The stamp is part of the label, so it is part of the accessible name too -
    // which is exactly how it should read out.
    const button = canvas.getByRole('button', {
      name: /^Ready for billing · Dr\. Weber Mar 16, 10:25 AM/,
    });
    await expect(button).toHaveAttribute('aria-pressed', 'true');

    const box = checkbox(button);
    // Checked fills the box with --success and drops the tick in. A resolved
    // token is the point: an unresolved one leaves the box transparent and the
    // tick white on white.
    await expect(box.querySelector('svg')).not.toBeNull();
    await expect(globalThis.getComputedStyle(box).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday checked state. Date and time are formatted in the preferred time zone and ' +
          'carry the zone abbreviation, so the stamp stays unambiguous for a multi-site org.',
      },
    },
  },
};

export const CheckedToday: Story = {
  name: 'Ready, stamped today',
  args: { label: 'Ready for discharge', state: { value: true, byName: 'Nurse Halloran' } },
  /**
   * "Today" is decided by comparing date keys against `new Date()` at render
   * time, so the timestamp is built at render time too. A literal baked into
   * `args` would be yesterday's the next morning and this frame would quietly
   * become the "Mar 16" one.
   */
  render: (args) => (
    <ReadyToggle {...args} state={{ ...args.state, at: new Date().toISOString() }} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', {
      name: /^Ready for discharge · Nurse Halloran Today,/,
    });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    // Same-day stamps say "Today" instead of the date - the branch that only
    // ever renders on the day the work happened.
    await expect(button).not.toHaveTextContent('Mar');
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the clinician actually sees the moment they tick it: the date collapses to ' +
          '"Today" and only the clock time carries information.',
      },
    },
  },
};

export const CheckedTimestampOnly: Story = {
  name: 'Ready, actor unknown',
  args: { state: { value: true, at: STAMPED_AT } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // No `byName`, so the stamp falls back to "Clinical team" rather than
    // leaving a dangling separator or blaming the wrong person.
    const button = canvas.getByRole('button', {
      name: /^Ready for billing · Clinical team Mar 16, 10:25 AM/,
    });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A record migrated or written without an actor. The time is still evidence, so the row ' +
          'keeps it and attributes the action to the clinical team.',
      },
    },
  },
};

export const CheckedWithoutStamp: Story = {
  name: 'Ready, no provenance',
  args: { state: { value: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Ready for billing' });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    // Neither actor nor time: the separator must not render at all. The
    // "Clinical team" fallback is reachable only alongside a timestamp, so a
    // bare `· Clinical team` here would be an invented claim.
    await expect(button.textContent).toBe('Ready for billing');
    await expect(checkbox(button).querySelector('svg')).not.toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Checked with nothing recorded about who or when - the state a legacy record lands in. ' +
          'The label stays bare rather than showing a half-empty stamp.',
      },
    },
  },
};

export const Disabled: Story = {
  name: 'Locked visit',
  args: {
    disabled: true,
    state: { value: true, byName: 'Dr. Weber', at: STAMPED_AT },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /^Ready for billing · Dr\. Weber/ });
    await expect(button).toBeDisabled();
    // Disabled is dimmed, not hidden, and it keeps announcing its state - the
    // stamp is the reason the row is worth reading on a locked visit.
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(button);
    await expect(args.onToggle).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A locked or view-only visit. The control drops to 60% opacity and the cursor changes, ' +
          'but the stamp still reads, which is what the frame is for.',
      },
    },
  },
};
