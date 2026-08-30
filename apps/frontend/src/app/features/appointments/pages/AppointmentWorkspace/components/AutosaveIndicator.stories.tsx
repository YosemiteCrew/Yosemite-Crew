import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import AutosaveIndicator from './AutosaveIndicator';

/** The indicator's label with runs of whitespace flattened, the way a reader sees it. */
const labelOf = (el: HTMLElement): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Background + ink as one comparable string, for proving two states do not look alike. */
const swatch = (el: HTMLElement): string => {
  const style = getComputedStyle(el);
  return `${style.backgroundColor}|${style.color}`;
};

/**
 * The row the indicator actually lives in: `flex flex-wrap items-center justify-between`
 * with the SOAP template chip on the left. Reproduced here because the only interesting
 * layout question about this component is what its longest label does to that row.
 */
const HeaderRow = ({ width, children }: { width: number; children: React.ReactNode }) => (
  <div
    data-testid="header-row"
    className="flex flex-wrap items-center justify-between gap-3 p-4"
    style={{ width }}
  >
    <span
      data-testid="template-chip"
      className="rounded-full border border-card-border px-3 py-1.5 text-body-4 text-text-primary"
    >
      Template: Wellness exam
    </span>
    {children}
  </div>
);

const meta = {
  title: 'Workspace/AutosaveIndicator',
  component: AutosaveIndicator,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The save-state line that sits to the right of a workspace section title. It has four ' +
          'states and no interactions at all, so a story set is the only place its rendering is ' +
          'checked at any width or in any theme.\n\n' +
          'The state worth knowing about first is `idle`, which returns `null`. Not an empty ' +
          'span, not a placeholder - nothing, so the `justify-between` row it lives in collapses ' +
          'onto the template chip until the clinician has actually saved once. A component that ' +
          'quietly started rendering an empty element instead would shift that row and no unit ' +
          'test asserting "no indicator" would notice.\n\n' +
          'The three visible states are deliberately not equal in weight. `saving` is a plain ' +
          '`<span>`, so a spinner appearing mid-keystroke does not interrupt a screen reader; ' +
          '`saved` and `offline` are `<output>` elements, which map to `role="status"` and are ' +
          'announced politely. That split is invisible on screen and is the kind of thing a ' +
          'refactor to a single wrapper element would erase silently.\n\n' +
          'The timestamp is formatted through `formatStampTime`, which runs the ISO value through ' +
          "the practice's preferred time zone and returns an empty string for anything it cannot " +
          'parse. So there are two `saved` renderings, not one: with a clock time and without - ' +
          'and a malformed `savedAt` degrades to the bare label rather than printing ' +
          '"Autosaved Invalid Date".',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    status: 'saved',
  },
  argTypes: {
    status: { control: 'select', options: ['idle', 'saving', 'saved', 'offline'] },
  },
} satisfies Meta<typeof AutosaveIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  name: 'Idle renders nothing',
  args: { status: 'idle' },
  play: async ({ canvasElement }) => {
    /* The contract is absence, not emptiness. `queryByTestId` alone would still pass if the
       component started returning an empty styled span, which keeps `gap-3` spacing in the
       header row and nudges the template chip - so assert no element of this component's
       exists in the canvas at all. */
    await expect(within(canvasElement).queryByTestId('autosave-indicator')).toBeNull();
    await expect(canvasElement.querySelector('[data-state]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state every workspace section opens in. There is no autosave engine behind this ' +
          'component - it is driven off the explicit-save lifecycle - so until a save is attempted ' +
          'there is genuinely nothing to report and it draws nothing.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Saving (a save is in flight)',
  args: { status: 'saving' },
  play: async ({ canvasElement }) => {
    const el = within(canvasElement).getByTestId('autosave-indicator');
    await expect(el).toHaveAttribute('data-state', 'saving');

    /* A span, not an <output>. The transient state is deliberately NOT a live region: a
       screen reader user typing into the note should not be interrupted by "Saving" every
       time a debounce fires. Losing this by unifying the three branches onto one element
       would be inaudible in review and audible to exactly the users who cannot see it. */
    await expect(el.tagName).toBe('SPAN');
    await expect(within(canvasElement).queryByRole('status')).toBeNull();

    const icon = el.querySelector('svg');
    if (!icon) throw new Error('The saving state lost its spinner icon.');
    // The icon is decoration next to the word "Saving" - announcing it adds nothing.
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    /* Measured, not the `animate-spin` class name: a utility that stops resolving still
       leaves the class in the DOM and leaves a motionless icon on screen. */
    await expect(getComputedStyle(icon).animationName).not.toBe('none');

    // A single ellipsis character, not three periods - the only state with trailing punctuation.
    await expect(labelOf(el)).toBe('Saving…');
  },
};

export const Saved: Story = {
  name: 'Saved with a timestamp',
  args: { status: 'saved', savedAt: '2026-07-10T09:31:00.000Z' },
  play: async ({ canvasElement }) => {
    const el = within(canvasElement).getByTestId('autosave-indicator');
    await expect(el).toHaveAttribute('data-state', 'saved');

    // An <output>, so the save landing IS announced - the outcome is worth interrupting for.
    await expect(el.tagName).toBe('OUTPUT');
    await expect(within(canvasElement).getByRole('status')).toBe(el);

    /* The whole point of the timestamp branch: a clock time, in the practice's preferred
       time zone. Asserting only /Autosaved/ - which is what the unit test can afford to do -
       passes just as happily on "Autosaved 2026-07-10T09:31:00.000Z" and on
       "Autosaved Invalid Date". The exact time is not pinned because the zone is a stored
       preference, so the shape is what is guarded. */
    const label = labelOf(el);
    await expect(label).toMatch(/^Autosaved \d{1,2}:\d{2}\b/);
    await expect(label).not.toContain('2026-07-10');
  },
};

export const SavedWithoutTimestamp: Story = {
  name: 'Saved without a timestamp',
  args: { status: 'saved', savedAt: undefined },
  play: async ({ canvasElement }) => {
    /* Exactly "Autosaved" - no trailing space where the time would have gone. `savedAt` is
       optional and the workspace does not always have one to hand, so this is a real state
       rather than a defensive branch. */
    await expect(labelOf(within(canvasElement).getByTestId('autosave-indicator'))).toBe(
      'Autosaved'
    );
  },
};

export const SavedWithUnreadableTimestamp: Story = {
  name: 'Saved with a timestamp it cannot parse',
  args: { status: 'saved', savedAt: 'yesterday-ish' },
  play: async ({ canvasElement }) => {
    /* `formatStampTime` returns '' for a value `new Date` cannot read, so the label falls
       back to the bare form. Without that guard this reads "Autosaved Invalid Date" - which
       looks like a broken clinic rather than a broken payload. */
    await expect(labelOf(within(canvasElement).getByTestId('autosave-indicator'))).toBe(
      'Autosaved'
    );
  },
};

export const Offline: Story = {
  name: 'Offline (the save failed on the network)',
  args: { status: 'offline' },
  play: async ({ canvasElement }) => {
    const el = within(canvasElement).getByTestId('autosave-indicator');
    await expect(el).toHaveAttribute('data-state', 'offline');
    // Announced, like `saved`: the one state where the clinician has to change what they do.
    await expect(el.tagName).toBe('OUTPUT');

    /* The full sentence, not just "Offline". The promise that edits are kept locally is the
       reason there is no blocking toast here, so truncating this copy to fit a narrow header
       would quietly turn a reassurance into an alarm. */
    await expect(labelOf(el)).toBe('Offline · retrying, edits kept locally');
  },
};

export const EveryVisibleState: Story = {
  name: 'Every visible state',
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <AutosaveIndicator status="saving" />
      <AutosaveIndicator status="saved" savedAt="2026-07-10T09:31:00.000Z" />
      <AutosaveIndicator status="offline" />
      <AutosaveIndicator status="idle" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const indicators = within(canvasElement).getAllByTestId('autosave-indicator');

    // Four are rendered, three reach the DOM: `idle` contributes nothing to the stack.
    await expect(indicators).toHaveLength(3);

    /* Three states, three inks - tertiary, secondary and the error token. They are 11px
       text with no other differentiator, so two of them collapsing onto one colour is a
       state that has stopped being distinguishable while still rendering perfectly. */
    await expect(new Set(indicators.map(swatch)).size).toBe(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The three visible states stacked, plus an `idle` that draws nothing. This is the view ' +
          'that makes a token regression obvious: the only thing separating "Saving", "Autosaved" ' +
          'and the offline line at a glance is their ink.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <AutosaveIndicator status="saving" />
      <AutosaveIndicator status="saved" savedAt="2026-07-10T09:31:00.000Z" />
      <AutosaveIndicator status="offline" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    /* Proves the story is actually on the espresso ground before measuring anything on it.
       Theme is a GLOBAL - `globals: { theme: 'dark' }` - and a story that spelled it as a
       parameter would render in light, pass every colour assertion below, and be filed as
       dark-mode coverage that does not exist. */
    await expect(globalThis.document.documentElement.getAttribute('data-theme')).toBe('dark');

    const indicators = within(canvasElement).getAllByTestId('autosave-indicator');
    await expect(new Set(indicators.map(swatch)).size).toBe(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'On the espresso ground the three inks come from a different token block entirely. A ' +
          'dark block that misses one leaves that state reading in its light value, which on this ' +
          'background is the difference between a faint status line and an invisible one.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the offline line in a 375px header',
  args: { status: 'offline' },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <HeaderRow width={375}>
      <AutosaveIndicator {...args} />
    </HeaderRow>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const el = canvas.getByTestId('autosave-indicator');
    const row = canvas.getByTestId('header-row');
    const chip = canvas.getByTestId('template-chip');

    /* The row is pinned to 375px here rather than leaning on the viewport global alone, and
       every measurement below is taken against the ROW. Loaded outside the Storybook manager
       the viewport global does not resize anything, so a `window.innerWidth` assertion would
       be comparing against a 1280px canvas and passing for the wrong reason. */
    const rowBox = row.getBoundingClientRect();
    await expect(Math.round(rowBox.width)).toBe(375);

    /* "Offline · retrying, edits kept locally" is roughly three times the width of any other
       state's label. The row is `flex-wrap`, so the correct outcome is the indicator dropping
       to its own line under the chip - not the row growing and taking the page with it. */
    await expect(el.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      chip.getBoundingClientRect().bottom
    );
    await expect(el.getBoundingClientRect().right).toBeLessThanOrEqual(rowBox.right);
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  },
};
