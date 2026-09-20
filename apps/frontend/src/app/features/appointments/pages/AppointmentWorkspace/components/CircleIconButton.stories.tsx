import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { IoAddOutline, IoChevronDown, IoPrintOutline, IoTrashOutline } from 'react-icons/io5';

import {
  closeGlassTooltip,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';

import CircleIconButton from './CircleIconButton';

/** Background + ink + border as one comparable string, for proving variants differ. */
const swatch = (el: HTMLElement): string => {
  const style = getComputedStyle(el);
  return `${style.backgroundColor}|${style.color}|${style.borderTopColor}`;
};

/**
 * Room for a bubble on every side. The tooltip is a portal that clamps itself 8px inside
 * the viewport, so a trigger sitting near an edge gets a bubble pushed back OVER it - the
 * placement assertions below would then be measuring the clamp, not the side.
 */
const Room = (Story: React.ComponentType) => (
  <div className="flex min-h-[560px] items-center justify-center p-12">
    <Story />
  </div>
);

const meta = {
  title: 'Workspace/CircleIconButton',
  component: CircleIconButton,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The circular icon action used everywhere in the appointment workspace: dark filled for ' +
          'view/hide and add, outlined for edit/reschedule/print, red-outlined for delete. Three ' +
          'variants, a disabled state, and a tooltip that can be inherited, overridden or turned ' +
          'off - eight renderings that no unit test looks at.\n\n' +
          'The tooltip branch is the one worth opening. `tooltip ?? label` means the hint is ' +
          'normally just the accessible name, but the real call sites pull those apart on ' +
          'purpose: a package row labels its button "Hide breakdown of <package name>" so screen ' +
          'reader users can tell twenty identical buttons apart, then passes the short "Hide ' +
          'breakdown" as the tooltip so sighted users are not handed a sentence. Both halves of ' +
          'that only exist with the bubble open.\n\n' +
          'Two ways out of the tooltip entirely, and they are not the same: `showTooltip={false}` ' +
          'is the explicit opt-out, while an empty `tooltip` string falls through the ' +
          '`!tooltipContent` guard. Either way the component returns the bare button with no ' +
          '`GlassTooltip` wrapper at all - not a wrapper that never opens - which matters because ' +
          'the wrapper is an extra `inline-flex` span in the flex row.\n\n' +
          'The bubbles are opened with `openGlassTooltip` rather than `userEvent.hover`. ' +
          "GlassTooltip binds `mouseenter` imperatively inside an effect, and a play function's " +
          'first hover can land before that effect has flushed - the event is then lost for good ' +
          'and the story passes having proved nothing.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    icon: <IoPrintOutline size={18} aria-hidden="true" />,
    label: 'Print labels',
    onClick: fn(),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['dark', 'outline', 'danger'] },
    tooltipSide: { control: 'inline-radio', options: ['top', 'right', 'bottom', 'left'] },
  },
} satisfies Meta<typeof CircleIconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outline: Story = {
  name: 'Outline (the default variant)',
  play: async ({ args, canvasElement }) => {
    /* Named by `label` alone - the button has no text, so if `aria-label` ever stops being
       wired the control becomes an unlabelled button and this query is what notices. */
    const button = within(canvasElement).getByRole('button', { name: 'Print labels' });
    const box = button.getBoundingClientRect();
    const style = getComputedStyle(button);

    // A circle, measured: 38x38 with a radius of at least half the box.
    await expect(Math.round(box.width)).toBe(38);
    await expect(Math.round(box.height)).toBe(38);
    await expect(Number.parseFloat(style.borderTopLeftRadius)).toBeGreaterThanOrEqual(
      box.width / 2
    );

    /* `shrink-0` is load-bearing rather than cosmetic. These buttons sit at the end of flex
       rows next to a growing medicine or package name; without it the row squeezes them into
       ovals long before it wraps, and an oval "circle icon button" is a bug nobody files. */
    await expect(style.flexShrink).toBe('0');

    /* The enabled half of the pair the `Disabled` story closes with. Nothing in globals.css
       gives a bare <button> the pointer cursor, so this primitive rendered an arrow over a
       clickable circle at all 19 of its call sites. Asserted on the computed value because
       the class only matters if it survives the cascade: `disabled:cursor-not-allowed` is
       the more specific selector and must keep winning on the disabled state. */
    await expect(style.cursor).toBe('pointer');

    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Dark: Story = {
  name: 'Dark (view, hide, add)',
  args: {
    icon: <IoAddOutline size={20} aria-hidden="true" />,
    label: 'Add invoice item',
    variant: 'dark',
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Add invoice item' });
    /* The only variant with a filled ground. If `bg-neutral-900` stops resolving the fill
       computes to `rgba(0, 0, 0, 0)` and the button keeps its white icon - a white glyph on
       the warm-bone page, invisible rather than obviously broken. */
    await expect(getComputedStyle(button).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  },
};

export const Danger: Story = {
  name: 'Danger (delete)',
  args: {
    icon: <IoTrashOutline size={18} aria-hidden="true" />,
    label: 'Remove Amoxicillin 250mg',
    variant: 'danger',
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Remove Amoxicillin 250mg' });
    const style = getComputedStyle(button);
    /* Red is the ONLY thing marking this as destructive - same size, same shape, same
       position in the row as edit. The border and the ink both carry it, and they have to
       agree, so a variant that lost one of the two would read as a half-hearted outline. */
    await expect(style.borderTopColor).toBe(style.color);
    await expect(Number.parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
  },
};

export const EveryVariant: Story = {
  name: 'Every variant, plus disabled',
  render: (args) => (
    <div className="flex items-center gap-4">
      <CircleIconButton
        {...args}
        icon={<IoAddOutline size={20} aria-hidden="true" />}
        label="Add schedule task"
        variant="dark"
      />
      <CircleIconButton
        {...args}
        icon={<IoPrintOutline size={18} aria-hidden="true" />}
        label="Print labels"
        variant="outline"
      />
      <CircleIconButton
        {...args}
        icon={<IoTrashOutline size={18} aria-hidden="true" />}
        label="Remove Amoxicillin 250mg"
        variant="danger"
      />
      <CircleIconButton
        {...args}
        icon={<IoTrashOutline size={18} aria-hidden="true" />}
        label="Remove Meloxicam 1.5mg"
        variant="danger"
        disabled
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [dark, outline, danger] = [
      canvas.getByRole('button', { name: 'Add schedule task' }),
      canvas.getByRole('button', { name: 'Print labels' }),
      canvas.getByRole('button', { name: 'Remove Amoxicillin 250mg' }),
    ];

    /* Three variants, three appearances. They are identical 38px circles differing only in
       fill, ink and border, so two of them collapsing onto one treatment is a regression
       that leaves every button on screen still looking deliberate. */
    await expect(new Set([dark, outline, danger].map(swatch)).size).toBe(3);

    // The two dangers differ only by `disabled`, which must be visible as well as announced.
    const locked = canvas.getByRole('button', { name: 'Remove Meloxicam 1.5mg' });
    await expect(locked).toBeDisabled();
    await expect(Number.parseFloat(getComputedStyle(locked).opacity)).toBeLessThan(1);
    await expect(getComputedStyle(locked).opacity).not.toBe(getComputedStyle(danger).opacity);
  },
};

export const Disabled: Story = {
  name: 'Disabled (a locked line item)',
  args: {
    icon: <IoTrashOutline size={18} aria-hidden="true" />,
    label: 'Remove Amoxicillin 250mg',
    variant: 'danger',
    disabled: true,
  },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Remove Amoxicillin 250mg' });
    await expect(button).toBeDisabled();

    /* Disabled rather than hidden: on a billed prescription line the clinician should still
       see that a delete exists and is refused, not wonder where it went. So the click has to
       be genuinely inert - not merely styled as if it were. */
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(getComputedStyle(button).cursor).toBe('not-allowed');
  },
};

export const TooltipFromLabel: Story = {
  name: 'Tooltip inherited from the label',
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Print labels' });
    /* The positive control for `WithoutTooltip` and `EmptyTooltipString` below, which both
       assert this selector finds NOTHING. Without proving it finds something here, a renamed
       wrapper class would make all three stories pass while the opt-out did nothing. */
    await expect(canvasElement.querySelector('.glass-tooltip')).not.toBeNull();

    const bubble = await openGlassTooltip(button);

    // With no `tooltip` prop the hint IS the accessible name - one string, two audiences.
    await expect(bubble).toHaveTextContent('Print labels');

    /* The default side is `bottom`, not `top`: these buttons sit in the header row of a
       section, and a bubble above one would cover the section title it belongs to. */
    await expect(bubble.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      button.getBoundingClientRect().bottom
    );
    await closeGlassTooltip(button);
  },
};

export const TooltipOverridesTheLabel: Story = {
  name: 'Short tooltip over a long label',
  args: {
    icon: <IoChevronDown size={20} aria-hidden="true" />,
    label: 'Hide breakdown of Dental prophylaxis package',
    tooltip: 'Hide breakdown',
    variant: 'dark',
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Hide breakdown of Dental prophylaxis package',
    });
    const bubble = await openGlassTooltip(button);

    /* The two strings are deliberately different and both matter. The accessible name keeps
       the package name so a screen reader user can tell one row's chevron from the next; the
       bubble stays short so a sighted user is not handed a sentence on hover. Collapsing
       them back onto one value breaks whichever audience loses. */
    await expect((bubble.textContent ?? '').trim()).toBe('Hide breakdown');
    await expect(bubble).not.toHaveTextContent('Dental prophylaxis');
    await expect(button).toHaveAttribute(
      'aria-label',
      'Hide breakdown of Dental prophylaxis package'
    );
    await closeGlassTooltip(button);
  },
};

export const TooltipSides: Story = {
  name: 'Every tooltip side, measured',
  render: (args) => (
    <div className="flex items-center gap-32">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <CircleIconButton
          key={side}
          {...args}
          icon={<IoPrintOutline size={18} aria-hidden="true" />}
          label={side}
          tooltipSide={side}
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Placement is measured rather than trusted, because `tooltipSide` is forwarded straight
       into GlassTooltip and a typo there produces a bubble that still opens, still reads
       correctly, and simply sits on the wrong edge. The trigger is far enough from every
       viewport edge that the 8px clamp cannot fire - otherwise these numbers would be
       describing the clamp instead of the side. */
    type Placement = (bubble: DOMRect, trigger: DOMRect) => Promise<void>;
    const cases: Array<[string, Placement]> = [
      ['top', async (bubble, trigger) => expect(bubble.bottom).toBeLessThanOrEqual(trigger.top)],
      [
        'right',
        async (bubble, trigger) => expect(bubble.left).toBeGreaterThanOrEqual(trigger.right),
      ],
      [
        'bottom',
        async (bubble, trigger) => expect(bubble.top).toBeGreaterThanOrEqual(trigger.bottom),
      ],
      ['left', async (bubble, trigger) => expect(bubble.right).toBeLessThanOrEqual(trigger.left)],
    ];

    for (const [side, assertPlacement] of cases) {
      const button = canvas.getByRole('button', { name: side });
      const bubble = await openGlassTooltip(button);
      await expect(bubble).toHaveTextContent(side);
      await assertPlacement(bubble.getBoundingClientRect(), button.getBoundingClientRect());
      /* Closed before the next one opens. A dispatched `mouseenter` emits no `mouseleave`
         on the previous trigger, so without this the bubbles pile up on `document.body`. */
      await closeGlassTooltip(button);
    }
  },
};

export const WithoutTooltip: Story = {
  name: 'Tooltip opted out',
  args: { showTooltip: false },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Print labels' });

    /* No wrapper at all, rather than a wrapper that never opens. The wrapper is an
       `inline-flex` span, so leaving one behind adds a layout box to every flex row that
       opted out - and hides the fact that the opt-out stopped working. */
    await expect(canvasElement.querySelector('.glass-tooltip')).toBeNull();
    await expect(button.parentElement?.classList.contains('glass-tooltip')).toBe(false);
  },
};

export const EmptyTooltipString: Story = {
  name: 'Empty tooltip string falls through too',
  args: { tooltip: '' },
  play: async ({ canvasElement }) => {
    /* `tooltip ?? label` only falls back on null/undefined, so an empty string survives the
       `??` and is caught one line later by `!tooltipContent`. A call site building its hint
       conditionally lands here, and gets the bare button rather than an empty bubble that
       opens on every hover. */
    await expect(within(canvasElement).getByRole('button', { name: 'Print labels' })).toBeVisible();
    await expect(canvasElement.querySelector('.glass-tooltip')).toBeNull();
  },
};
