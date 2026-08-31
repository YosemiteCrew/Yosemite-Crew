import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import WorkspaceActionRail from './WorkspaceActionRail';

/**
 * The rail's own order and copy, restated here on purpose. Every button is a bare
 * icon, so `aria-label` is the ONLY name any of them has - a swapped icon, a dropped
 * label or a reordered list is invisible in a screenshot and silent in the DOM.
 */
const RAIL_LABELS = [
  'Record vitals',
  'Tasks',
  'Documents',
  'Chat',
  'Activity',
  'MSD Manual',
  'Calculators',
];

const parseRgba = (value: string): [number, number, number, number] => {
  const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
};

const railIn = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByRole('navigation', { name: 'Workspace quick actions' });

const buttonsIn = (canvasElement: HTMLElement): HTMLElement[] =>
  within(railIn(canvasElement)).getAllByRole('button');

const meta = {
  title: 'Workspace/WorkspaceActionRail',
  component: WorkspaceActionRail,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The 58px quick-actions strip docked to the right of the workspace step content. Seven ' +
          'icon-only buttons open the matching Quick Actions panel, and the open one is reported ' +
          'with `aria-pressed` rather than by its tint alone.\n\n' +
          'It is hidden below `lg`, where the phone and tablet workspaces reach the same targets ' +
          'from their own bars - so a story pinned to a narrow viewport is a story of an empty ' +
          'canvas, which is the point. The decorator supplies the step panel it docks against, ' +
          'because the rail is `self-stretch` and has no height of its own.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeAction: null,
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-[420px] items-stretch gap-4">
        <div className="flex-1 rounded-2xl border border-card-border bg-neutral-0 p-4 text-text-secondary">
          Step content sits here - the rail docks against it.
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkspaceActionRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Nothing open',
  play: async ({ canvasElement }) => {
    const buttons = buttonsIn(canvasElement);

    // Names and order, in one assertion, so a reshuffle reports which one moved.
    await expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(RAIL_LABELS);

    /* Every button is a toggle and says so even when nothing is open. Dropping
       `aria-pressed` off the inactive ones costs nothing visually and leaves a
       screen-reader user with seven identical unlabelled-state buttons. */
    await expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(
      Array.from({ length: 7 }, () => 'false')
    );

    /* The design's geometry: a 58px strip of 40px targets. Both are hard-coded in
       the component and both are load-bearing - 40px is the touch/pointer target,
       and the 58px width is what the step content's flex row is sized around. */
    await expect(Math.round(railIn(canvasElement).getBoundingClientRect().width)).toBe(58);
    await expect(
      buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return `${Math.round(box.width)}x${Math.round(box.height)}`;
      })
    ).toEqual(Array.from({ length: 7 }, () => '40x40'));
  },
};

export const RecordActive: Story = {
  name: 'Record vitals open',
  args: { activeAction: 'RECORD' },
  play: async ({ args, canvasElement }) => {
    const buttons = buttonsIn(canvasElement);
    const [record, tasks] = buttons;

    await expect(record).toHaveAttribute('aria-pressed', 'true');
    // Exactly one, never two: the panel it mirrors only ever has one target open.
    await expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);

    /* The pressed tint comes from an inline `var(--blue-soft)`, which is the failure
       mode worth measuring: an unresolvable token leaves the inline background as an
       invalid value, so it paints nothing at all while `aria-pressed` still reports
       true. Sighted users then get seven identical icons and no idea what is open. */
    const activeFill = globalThis.getComputedStyle(record).backgroundColor;
    await expect(parseRgba(activeFill)[3]).toBeGreaterThan(0);
    await expect(activeFill).not.toBe(globalThis.getComputedStyle(tasks).backgroundColor);

    /* Each button reports its OWN key, not the active one. The seven handlers are
       built in a map and look identical, so a closure over the wrong variable would
       open Record vitals from every icon and nothing on screen would look broken. */
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Calculators' }));
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.onSelect).toHaveBeenCalledWith('CALCULATORS');
  },
};

export const CalculatorsActive: Story = {
  name: 'Calculators open (last in the rail)',
  args: { activeAction: 'CALCULATORS' },
  play: async ({ canvasElement }) => {
    const buttons = buttonsIn(canvasElement);
    const pressed = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true');

    /* The far end of the list, checked by position as well as by name: the rail maps
       a `SideAction` key onto an icon and a label in one literal, so a key paired
       with the wrong row still renders a plausible rail with the wrong icon lit. */
    await expect(pressed).toHaveLength(1);
    await expect(pressed[0]).toBe(buttons[buttons.length - 1]);
    await expect(pressed[0]).toHaveAttribute('aria-label', 'Calculators');

    // The icon ink moves too, not just the fill behind it.
    await expect(globalThis.getComputedStyle(pressed[0]).color).not.toBe(
      globalThis.getComputedStyle(buttons[0]).color
    );
  },
};

export const BelowBreakpoint: Story = {
  name: 'Below lg the rail is not rendered to anyone',
  args: { activeAction: 'TASKS' },
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: async ({ canvasElement }) => {
    const rail = canvasElement.querySelector<HTMLElement>('nav');
    if (!rail) throw new Error('the rail did not render at all');

    /* `hidden lg:flex`, asserted against the media query itself rather than against
       an assumed width - the headless verifier loads the story iframe at its own
       size, so a bare `display: none` assertion here would be testing the runner.
       Written this way it catches both halves: bump the breakpoint to `xl` and the
       laptop run fails, drop `hidden` and the tablet run fails.

       It matters that this is `display: none` and not opacity or a visually-hidden
       wrapper. The phone and tablet workspaces reach these same targets from their
       own bars, so a rail left in the a11y tree would read out seven duplicate
       buttons a touch user cannot see. */
    const isDesktop = globalThis.window.matchMedia('(min-width: 64rem)').matches;
    await expect(globalThis.getComputedStyle(rail).display).toBe(isDesktop ? 'flex' : 'none');
  },
};
