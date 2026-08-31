import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { IoIosCalendar } from 'react-icons/io';
import { IoEyeOutline, IoSyncOutline } from 'react-icons/io5';

import TaskPopoverActionButton from './TaskPopoverActionButton';
import {
  closeGlassTooltip,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';

/**
 * The footer sits on the task popover's panel: `bg-neutral-0` with a `card-border` hairline.
 * The button itself is transparent at rest, so this IS the ground its ink is read against.
 */
const PopoverFooter = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <div
    data-footer=""
    className="w-[280px] rounded-2xl border border-card-border bg-neutral-0 p-3 shadow-[0_8px_24px_0_rgba(0,0,0,0.16)]"
  >
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 border-t border-card-border pt-2">
      {children}
    </div>
  </div>
);

const rgb = (value: string): [number, number, number] => {
  const [r, g, b] = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [r, g, b];
};

/** Perceived lightness, only precise enough to say which of two colours is the lighter. */
const luminance = (value: string): number => {
  const [r, g, b] = rgb(value);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const meta = {
  title: 'Appointments/Calendar/TaskPopoverActionButton',
  component: TaskPopoverActionButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The round action every task-popover footer repeats: a tooltip wrapper, a 32px circle, ' +
          'and an icon. It only ever appears inside `TaskDetailsPopover`, which is a `<dialog ' +
          'open>` mounted while a task chip is hovered, so nothing had drawn it on its own.\n\n' +
          'Two contracts live here and both fail silently. First, `tooltip` and `label` are ' +
          'separate props on purpose: the bubble says "Change status" while the accessible name ' +
          'says "Change task status", because a screen-reader user hears the name with no ' +
          'surrounding popover to disambiguate it. Passing one string for both reads fine on ' +
          'screen and degrades only for the people who cannot see the screen. Second, the icon is ' +
          '`aria-hidden`, so the `aria-label` is the ONLY accessible name the control has - lose ' +
          'it and the footer becomes three unnamed buttons.\n\n' +
          'The geometry is asserted rather than the class list: `size-8 rounded-full!` has to ' +
          'render as a 32px circle, and unlayered rules in `globals.css` outrank Tailwind ' +
          'utilities, which is why the important is there in the first place.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    tooltip: 'View task',
    label: 'View task',
    onPress: fn(),
    children: <IoEyeOutline size={16} aria-hidden="true" />,
  },
  decorators: [
    (Story) => (
      <PopoverFooter>
        <Story />
      </PopoverFooter>
    ),
  ],
} satisfies Meta<typeof TaskPopoverActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'Resting',
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'View task' });

    // 32px square. The footer wraps at `gap-1.5`, so a button that grew with its icon
    // would push the third action onto a second row inside a fixed-width popover.
    const { width, height } = button.getBoundingClientRect();
    await expect(width).toBeCloseTo(32, 0);
    await expect(height).toBeCloseTo(32, 0);

    // A circle, measured rather than read off the class: `rounded-full!` only wins
    // because of the important, and a radius regression is invisible in a diff.
    const radius = Number.parseFloat(getComputedStyle(button).borderTopLeftRadius);
    await expect(radius).toBeGreaterThanOrEqual(height / 2);

    /* The icon is aria-hidden, so the name comes from `aria-label` alone - `getByRole`
       above already proves it, and this proves the sighted hover text is separate. */
    await expect(button).toHaveAttribute('title', 'View task');
  },
};

export const TooltipOnHover: Story = {
  name: 'Hovered (tooltip open, name differs)',
  args: {
    tooltip: 'Change status',
    label: 'Change task status',
    children: <IoSyncOutline size={16} aria-hidden="true" />,
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Change task status' });

    /* `openGlassTooltip`, not `userEvent.hover`: the bubble's listeners are bound in an
       effect that has not always flushed when a play function starts, so a single
       dispatch can land on an element that is not listening yet and is lost for good -
       leaving a tooltip story green with nothing ever opened. */
    const bubble = await openGlassTooltip(button);
    await expect(bubble).toHaveTextContent('Change status');

    // The whole point of the two props: what the eye reads is the short verb phrase,
    // what a screen reader announces names the object too. One string for both would
    // pass every visual check and quietly say "Change status" of nothing in particular.
    await expect(button).toHaveAccessibleName('Change task status');
    await expect(bubble.textContent).not.toBe(button.getAttribute('aria-label'));

    /* Bubbles portal to document.body and a dispatched mouseenter emits no mouseleave,
       so an unclosed one outlives the story and is counted by the next. */
    await closeGlassTooltip(button);
    await expect(globalThis.document.querySelector('[role="tooltip"]')).toBeNull();
  },
};

const onView = fn();
const onChangeStatus = fn();
const onReschedule = fn();

export const FooterRow: Story = {
  name: 'The three real footer actions',
  render: () => (
    <>
      <TaskPopoverActionButton tooltip="View task" label="View task" onPress={onView}>
        <IoEyeOutline size={16} aria-hidden="true" />
      </TaskPopoverActionButton>
      <TaskPopoverActionButton
        tooltip="Change status"
        label="Change task status"
        onPress={onChangeStatus}
      >
        <IoSyncOutline size={16} aria-hidden="true" />
      </TaskPopoverActionButton>
      <TaskPopoverActionButton tooltip="Reschedule" label="Reschedule task" onPress={onReschedule}>
        <IoIosCalendar size={16} aria-hidden="true" />
      </TaskPopoverActionButton>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    onView.mockClear();
    onChangeStatus.mockClear();
    onReschedule.mockClear();

    /* Three identical 32px circles differing only by glyph and name. That is exactly the
       arrangement where a mis-wired handler is invisible: the reschedule button would
       still light up, still animate, and change the status instead. */
    await expect(canvas.getAllByRole('button')).toHaveLength(3);

    await userEvent.click(canvas.getByRole('button', { name: 'Change task status' }));
    await expect(onChangeStatus).toHaveBeenCalledTimes(1);
    await expect(onView).not.toHaveBeenCalled();
    await expect(onReschedule).not.toHaveBeenCalled();

    // One row, not two: three 32px circles plus two 6px gaps fit the 304px popover, and
    // a wrap here is the first symptom of a size or gap change.
    const tops = canvas
      .getAllByRole('button')
      .map((b) => Math.round(b.getBoundingClientRect().top));
    await expect(new Set(tops).size).toBe(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The footer as `TaskDetailsPopover` assembles it. The two right-hand actions are ' +
          'permission- and status-gated there (`canEditTasks`, `canRescheduleTask`), so a viewer ' +
          'with read-only tasks sees the eye alone.',
      },
    },
  },
};

export const KeyboardFocus: Story = {
  name: 'Reached by keyboard (focus ring)',
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'View task' });

    // Tab, not `.focus()`: Chromium sets `:focus-visible` only for keyboard entry, so a
    // programmatic focus would report no ring even on a correct build.
    await userEvent.tab();
    await expect(button).toHaveFocus();

    /* The ring is not on the component - it comes from the global `:focus-visible` rule
       in globals.css, which several components have suppressed with `outline-none` while
       restyling. This control has no visible focus treatment of its own, so if that
       outline goes, a keyboard user loses the popover footer entirely. */
    const focused = getComputedStyle(button);
    await expect(focused.outlineStyle).toBe('solid');
    await expect(Number.parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(2);
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'View task' });
    const footer = canvasElement.querySelector('[data-footer]') as HTMLElement;

    /* `text-black-text` resolves through `--ink-body`, so on the espresso ground the ink
       has to come out LIGHTER than the panel. The name of the token says black; a build
       that resolved it literally would paint a black glyph on a near-black panel and the
       three footer actions would simply disappear. */
    const ink = luminance(getComputedStyle(button).color);
    const panel = luminance(getComputedStyle(footer).backgroundColor);
    await expect(panel).toBeLessThan(0.5);
    await expect(ink).toBeGreaterThan(panel + 0.3);

    // The circle is drawn by its border here, not by a fill, so a border that failed to
    // flip would be the only thing separating the control from the panel.
    await expect(getComputedStyle(button).borderTopWidth).toBe('1px');
    await expect(luminance(getComputedStyle(button).borderTopColor)).not.toBe(panel);
  },
};
