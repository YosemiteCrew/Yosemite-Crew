import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { IoTimeOutline } from 'react-icons/io5';
import { expect, within } from 'storybook/test';

import PopoverDetail from './PopoverDetail';

/* The real column. AppointmentPopover is `w-[440px] p-5` around a
   `grid-cols-2 gap-x-5 px-1` grid, so each cell is
   (440 - 40 padding - 8 px-1 - 20 gap) / 2 = 186px. Every truncation and
   overflow question this component answers is a question about that 186px, so
   the harness reproduces the popover rather than centring the cell on its own. */
const CELL_WIDTH = 186;

const LONG_REASON =
  'Post-operative recheck, suture removal, and a repeat lameness assessment on the left hind';

const PopoverGrid = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div className="rounded-3xl bg-neutral-0 p-5 shadow-lg" style={{ width: '440px' }}>
    <div className="grid grid-cols-2 gap-x-5 gap-y-3 px-1">
      {/* The cell under test sits in the SECOND column so the icon, which hangs
          on a negative offset, has the real 20px gutter to hang into. */}
      <div aria-hidden="true" />
      {children}
    </div>
  </div>
);

const meta = {
  title: 'Appointments/Calendar/PopoverDetail',
  component: PopoverDetail,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One labelled cell of the appointment popover detail grid - eight of these make up the ' +
          'body of the card. Three independent prop branches decide how the value behaves, and ' +
          'the popover uses a different combination in almost every cell.\n\n' +
          '`emphasized` is the payment cell: the value goes bold and moves from `--ink-body` up to ' +
          '`--ink`. `icon` is the duration cell: the glyph is absolutely positioned 20px to the ' +
          "LEFT of the value box and marked `pointer-events-none`, so it hangs in the grid's own " +
          'gutter and indents nothing. `scrollValue` is the reason cell, and it is the only cell ' +
          'in the popover that does not truncate - it scrolls horizontally instead, including on a ' +
          'vertical wheel, which is the single piece of behaviour in the file.\n\n' +
          'What every branch has in common is that the cell must never widen. The column is fixed ' +
          'at 186px and the whole chain is `min-w-0`, so an overlong reason or client name has to ' +
          'clip or scroll rather than push the second column off the card. That is the failure ' +
          'these stories measure.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: 'Client Name',
    value: 'Lena Hartmann',
  },
  decorators: [
    (Story) => (
      <PopoverGrid>
        <Story />
      </PopoverGrid>
    ),
  ],
} satisfies Meta<typeof PopoverDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Label and value',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText('Client Name');
    const value = canvas.getByText('Lena Hartmann');
    const cell = label.parentElement as HTMLElement;

    // The cell is the popover column, and the value box fills it exactly.
    await expect(cell.getBoundingClientRect().width).toBeCloseTo(CELL_WIDTH, 0);
    await expect(value.getBoundingClientRect().left).toBeCloseTo(
      cell.getBoundingClientRect().left,
      1
    );

    /* The default is `truncate`, which is three declarations rather than one. A
       change that dropped any of them turns a long name into a wrapped second
       line and pushes every cell below it down half a row. */
    const style = getComputedStyle(value);
    await expect(style.whiteSpace).toBe('nowrap');
    await expect(style.overflow).toBe('hidden');
    await expect(style.textOverflow).toBe('ellipsis');
    // The weight only moves under `emphasized` - see the payment story.
    await expect(style.fontWeight).toBe('400');
  },
};

export const Emphasized: Story = {
  name: 'Emphasized (the payment cell)',
  args: { label: 'Paid', value: '$148.00', emphasized: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const value = canvas.getByText('$148.00');
    const label = canvas.getByText('Paid');

    await expect(getComputedStyle(value).fontWeight).toBe('700');
    /* Only the value emphasises. The 11px semibold label is the constant that
       makes the grid scannable, and a change that bolded both would flatten it. */
    await expect(getComputedStyle(label).fontWeight).toBe('600');
    await expect(getComputedStyle(label).fontSize).toBe('11px');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one cell the popover emphasises: the money. Note the copy the real card produces ' +
          'for an appointment with no invoice - label "Paid", value "Paid" - which is ' +
          "`getAppointmentPaymentDisplay`'s doing, not this component's.",
      },
    },
  },
};

export const WithIcon: Story = {
  name: 'With a leading icon (the duration cell)',
  args: {
    label: 'Duration',
    value: '09:15 - 09:45',
    icon: <IoTimeOutline size={14} className="text-neutral-900" aria-hidden="true" />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const value = canvas.getByText('09:15 - 09:45');
    const cell = canvas.getByText('Duration').parentElement as HTMLElement;
    const iconWrap = cell.querySelector('.pointer-events-none') as HTMLElement;
    const valueRect = value.getBoundingClientRect();
    const iconRect = iconWrap.getBoundingClientRect();

    /* The glyph is absolute at -left-5, so it sits entirely outside the value box
       and the text starts on the same pixel as every other cell in the column. An
       icon moved back into the flow would indent this one row and nothing else. */
    await expect(iconRect.right).toBeLessThanOrEqual(valueRect.left);
    await expect(valueRect.left).toBeCloseTo(cell.getBoundingClientRect().left, 1);
    // Centred on the value line rather than on the whole cell.
    await expect(iconRect.top + iconRect.height / 2).toBeCloseTo(
      valueRect.top + valueRect.height / 2,
      0
    );
    // It hangs over the neighbouring column, so it must not intercept its clicks.
    await expect(getComputedStyle(iconWrap).pointerEvents).toBe('none');
  },
};

export const Truncated: Story = {
  name: 'Overlong value truncates',
  args: { label: 'Reason', value: LONG_REASON },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const value = canvas.getByText(LONG_REASON);
    const cell = canvas.getByText('Reason').parentElement as HTMLElement;

    // It genuinely overflows - a shorter fixture would prove nothing.
    await expect(value.scrollWidth).toBeGreaterThan(value.clientWidth);
    /* ... and the cell is still the width of its column. This is the assertion
       that matters: a value that widened its cell would drag the second column
       off the 440px card and there is no horizontal scroll to recover it. */
    await expect(cell.getBoundingClientRect().width).toBeCloseTo(CELL_WIDTH, 0);
    await expect(value.getBoundingClientRect().width).toBeLessThanOrEqual(CELL_WIDTH);
    /* The three declarations the Reason cell inverts: hidden overflow, an ellipsis
       on the clip, and no bottom padding held back for a scrollbar. Reading them
       off the computed style is what makes the two branches comparable. */
    const style = getComputedStyle(value);
    await expect(style.overflowX).toBe('hidden');
    await expect(style.textOverflow).toBe('ellipsis');
    await expect(style.paddingBottom).toBe('0px');
  },
};

export const Scrolling: Story = {
  name: 'Reason scrolls instead of truncating',
  args: { label: 'Reason', value: LONG_REASON, scrollValue: true },
  parameters: {
    docs: {
      description: {
        story:
          'The only cell that keeps its overflow reachable. It also maps a VERTICAL wheel onto ' +
          'horizontal scroll, so a trackpad reaches the end of a long reason without the popover ' +
          'needing a scrollbar of its own.\n\n' +
          'That handler is deliberately NOT driven from this play function. React registers ' +
          '`wheel` at the root as a passive listener, so the `preventDefault()` in it never takes ' +
          'effect and Chrome logs "Unable to preventDefault inside passive event listener ' +
          'invocation." on every wheel - in the running app as much as here. The scroll itself ' +
          'still works; the page behind the popover is simply not held still while it happens.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const value = canvas.getByText(LONG_REASON);
    const cell = canvas.getByText('Reason').parentElement as HTMLElement;

    // Same overflow, opposite treatment: a real scroll container, no ellipsis, and
    // 12px of bottom padding so the floating scrollbar never sits on the text.
    const style = getComputedStyle(value);
    await expect(style.overflowX).toBe('auto');
    await expect(style.textOverflow).toBe('clip');
    await expect(style.paddingBottom).toBe('12px');
    await expect(value.scrollWidth).toBeGreaterThan(value.clientWidth);
    await expect(cell.getBoundingClientRect().width).toBeCloseTo(CELL_WIDTH, 0);
  },
};

export const NodeValue: Story = {
  name: 'A ReactNode value',
  args: {
    label: 'Room / Unit',
    value: (
      <>
        Ward <span className="text-[var(--ink-faint)]">/ Kennel 3</span>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = canvas.getByText('Room / Unit').parentElement as HTMLElement;
    const nested = canvas.getByText('/ Kennel 3');

    await expect(nested).toBeInTheDocument();
    // Inline children are still inside the truncating box, so they clip with the
    // rest of the line rather than escaping the column.
    await expect(nested.getBoundingClientRect().right).toBeLessThanOrEqual(
      cell.getBoundingClientRect().right
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          '`value` is typed `ReactNode`, though every cell in the popover passes a string today - ' +
          'the Room / Unit cell composes its two halves into one string in ' +
          '`getAppointmentRoomDisplay` instead. Worth drawing because the truncation contract only ' +
          'holds for inline children: they clip with the line, a block or fixed-width child would ' +
          'not.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  args: { label: 'Reason', value: LONG_REASON, scrollValue: true },
  globals: { theme: 'dark' },
};
