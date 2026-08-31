import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import AppointmentDetailField from './AppointmentDetailField';

/**
 * The label div and the value div beside it, located from the label's own text.
 * The component renders `{label}:`, so the colon is part of the string to match -
 * querying `'Room'` finds nothing and the story would fail for the wrong reason.
 */
const pair = (canvasElement: HTMLElement, label: string) => {
  const labelEl = within(canvasElement).getByText(`${label}:`);
  return { labelEl, valueEl: labelEl.nextElementSibling as HTMLElement };
};

/**
 * The `top` of each rendered LINE of an element's text, in order.
 *
 * `getBoundingClientRect()` is useless for counting lines here: the row is a flex
 * container at its default `align-items: stretch`, so the one-line label box is
 * stretched to the full height of a four-line value and measures identically to it.
 * A range over the text content reports real line boxes - but one rect per text
 * NODE, and `{label}:` is two adjacent text nodes, so the rects are de-duplicated
 * by their top edge rather than counted.
 */
const lineTops = (el: HTMLElement): number[] => {
  const range = globalThis.document.createRange();
  range.selectNodeContents(el);
  const tops = [...range.getClientRects()].map((rect) => Math.round(rect.top));
  return [...new Set(tops)].sort((a, b) => a - b);
};

/** Mean sRGB channel of a computed `rgb()`/`rgba()` colour. Used to compare inks against a ground. */
const meanChannel = (colour: string): number => {
  const [r = 0, g = 0, b = 0] = (colour.match(/[\d.]+/g) ?? []).map(Number);
  return (r + g + b) / 3;
};

/** The narrow column the field actually lives in on a board card, so wrapping is real. */
const Column = (Story: React.ComponentType) => (
  <div className="w-[220px] p-4">
    <Story />
  </div>
);

const meta = {
  title: 'Appointments/AppointmentDetailField',
  component: AppointmentDetailField,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One `Label: value` line. Both halves of the appointment card and the appointment ' +
          'history list are built out of these, so its two decisions apply everywhere at once.\n\n' +
          'The first is the fallback. It is `value || "-"`, not a null check, so an EMPTY STRING ' +
          'falls back as well - which is what a joined-but-empty list (`supportStaff` with no ' +
          'names) and a trimmed-to-nothing free-text `concern` both produce. A component that ' +
          'only guarded null would render "Staff:" followed by nothing and read as a broken row.\n\n' +
          'The second is the two inks. `text-text-extra` on the label against `text-text-primary` ' +
          'on the value is the only thing separating them - there is no weight change and no ' +
          'column rule - so if the two tokens ever resolve to the same colour the whole card ' +
          'turns into undifferentiated prose. That collapse is theme-specific: the faint ink is ' +
          're-declared under `body:has([data-yc-app])` for light and again under ' +
          '`html[data-theme="dark"] body:has([data-yc-app])`, and a dark block that forgets it ' +
          'leaves the label at a light-mode grey nobody can read on `--page`.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: 'Room',
    value: 'Consult 2',
  },
} satisfies Meta<typeof AppointmentDetailField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Label and value on one line',
  play: async ({ canvasElement }) => {
    const { labelEl, valueEl } = pair(canvasElement, 'Room');
    const label = labelEl.getBoundingClientRect();
    const value = valueEl.getBoundingClientRect();

    /* One sentence, not a two-column grid: `gap-1` is 4px and the value starts
       immediately after the colon. A drift to a bigger gap (or to a `justify-between`
       row) reads as a table with one populated column and is easy to ship unnoticed
       because both layouts "look fine" in isolation. */
    await expect(Math.round(value.left - label.right)).toBe(4);
    await expect(Math.round(value.top)).toBe(Math.round(label.top));

    /* `text-caption-1` on BOTH halves. A label that quietly loses the class picks up
       the inherited 16px body size and the line stops sitting on one baseline. */
    for (const el of [labelEl, valueEl]) {
      const style = getComputedStyle(el);
      await expect(style.fontSize).toBe('14px');
      await expect(style.lineHeight).toBe('20px');
      await expect(style.fontWeight).toBe('500');
    }

    // Colour is the ONLY separator here. Same ink = no label.
    await expect(getComputedStyle(labelEl).color).not.toBe(getComputedStyle(valueEl).color);
  },
  parameters: {
    docs: {
      description: {
        story: 'The populated case, as it renders inside an appointment card.',
      },
    },
  },
};

export const MissingValue: Story = {
  name: 'Nothing recorded',
  // Three instances rather than three stories: the point is that all three inputs
  // land on the SAME glyph, which is only checkable with them side by side.
  render: () => (
    <div>
      <AppointmentDetailField label="Reason" value={undefined} />
      <AppointmentDetailField label="Room" value={null} />
      <AppointmentDetailField label="Staff" value="" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    /* Three dashes, not two: the empty string is the case a `?? '-'` would miss, and
       it is the one the card hits most often because `supportStaff.map().join(', ')`
       returns '' for an appointment with no assigned staff. */
    await expect(within(canvasElement).getAllByText('-')).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Undefined, null and empty string all fall back to a dash, so a row is never left ' +
          'hanging after its colon.',
      },
    },
  },
};

export const LongValue: Story = {
  name: 'Phone: a long value wraps beside its label',
  args: {
    label: 'Staff',
    value: 'Dr. Amara Okonkwo, Nurse Priya Raman, Nurse Tom Becker, Dr. Lena Hartmann',
  },
  decorators: [Column],
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const { labelEl, valueEl } = pair(canvasElement, 'Staff');
    const labelLines = lineTops(labelEl);
    const valueLines = lineTops(valueEl);

    /* The value has genuinely run onto more than one line at this width, and the
       label has NOT. Flexbox will not shrink a flex item below its min-content
       width, which is the only thing keeping "Staff:" on one line here - a later
       `min-w-0` on the label (the usual fix when someone wants the value to
       truncate) removes exactly that floor and breaks the label mid-word. */
    await expect(labelLines).toHaveLength(1);
    await expect(valueLines.length).toBeGreaterThan(1);

    /* The row has no `flex-wrap`, so the label sits ON the value's first line
       rather than above the block, still one 4px gap away from it. */
    await expect(valueLines[0]).toBe(labelLines[0]);
    await expect(
      Math.round(valueEl.getBoundingClientRect().left - labelEl.getBoundingClientRect().right)
    ).toBe(4);

    // Nothing escapes the column on a 375px screen.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A joined staff list in the 220px column the field gets on a board card. The value ' +
          'wraps inside its own box; the row never becomes a stack.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const { labelEl, valueEl } = pair(canvasElement, 'Room');
    const labelInk = getComputedStyle(labelEl).color;
    const valueInk = getComputedStyle(valueEl).color;
    const ground = meanChannel(getComputedStyle(globalThis.document.body).backgroundColor);

    // The hierarchy has to survive the theme swap, not just exist in light.
    await expect(labelInk).not.toBe(valueInk);

    /* Both inks must have FLIPPED to the light end of their ramps. `--color-text-extra`
       is re-declared per theme under `body:has([data-yc-app])`; a dark block that
       misses it leaves the label on the light-mode grey, which lands a few points off
       `--page` and disappears. Comparing against the measured page ground catches that
       without pinning a hex that the palette is allowed to retune. */
    await expect(meanChannel(labelInk)).toBeGreaterThan(ground + 40);
    await expect(meanChannel(valueInk)).toBeGreaterThan(meanChannel(labelInk));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same line on the espresso ground. The label stays one step faint of the value ' +
          'rather than collapsing onto it.',
      },
    },
  },
};
