import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { ReactNode } from 'react';

import StaffInput from './StaffInput';

/**
 * The popover column this field lives in. 260px is narrow enough that a long
 * staff list has to do something - the `min-w-0` on the component's own root is
 * what stops it forcing the popover wider instead.
 */
const PopoverColumn = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div data-story-column style={{ width: 260, padding: '20px 0', background: 'var(--screen)' }}>
    {children}
  </div>
);

const fieldOf = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('textbox') as HTMLInputElement;

/** The component's own root (`relative min-w-0`), not FormInput's wrapper. */
const rootOf = (input: HTMLInputElement) => input.closest('.min-w-0') as HTMLElement;

const alphaOf = (color: string): number => {
  const rgba = /^rgba?\(([^)]+)\)$/.exec(color);
  if (rgba) {
    const parts = rgba[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length >= 4 ? Number(parts[3]) : 1;
  }
  return 1;
};

/**
 * The chip is `top-0 -translate-y-1/2`, so it is supposed to straddle the top
 * edge of the field group rather than sit inside it. Losing the translate is a
 * one-token change that leaves the label overlapping the value instead, and no
 * text assertion would notice.
 */
const expectChipStraddlesTheTopEdge = async (canvasElement: HTMLElement, labelText: string) => {
  const chip = within(canvasElement).getByText(labelText);
  const root = rootOf(fieldOf(canvasElement));
  const chipBox = chip.getBoundingClientRect();
  const rootTop = root.getBoundingClientRect().top;
  await expect(chipBox.top).toBeLessThan(rootTop);
  await expect(chipBox.bottom).toBeGreaterThan(rootTop);
  return chip;
};

const meta = {
  title: 'Appointments/Calendar/StaffInput',
  component: StaffInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The read-only staff row inside the appointment popover. It is a wrapper over ' +
          '`FormInput`, but not a pass-through one: it adds its own floating icon-and-label chip ' +
          'over the field border, derives the input `name` from the label ' +
          '(`appointment-popover-{label lowercased}`), and substitutes a literal `-` for an empty ' +
          'value so an unassigned slot reads as "nobody" rather than as a blank box someone might ' +
          'try to type into.\n\n' +
          'It is a display element wearing an input: `readonly` plus `tabIndex={-1}` keep it out ' +
          'of the tab order and uneditable. That pairing is the contract worth pinning - drop ' +
          'either half and the popover starts offering a caret in a field that has nowhere to ' +
          'save to.\n\n' +
          'The chip is decoration only. `FormInput` builds the accessible name from `inlabel`, ' +
          'which this component passes empty, so the visible "Vet" text is not associated with ' +
          'the field - see the note in the Value story.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: 'Vet',
    value: 'Dr. Sarah Chen',
  },
  decorators: [
    (Story) => (
      <PopoverColumn>
        <Story />
      </PopoverColumn>
    ),
  ],
} satisfies Meta<typeof StaffInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A named vet',
  play: async ({ canvasElement }) => {
    const input = fieldOf(canvasElement);
    await expect(input).toHaveValue('Dr. Sarah Chen');
    // Both halves of "looks like a field, is not one". readonly alone still
    // takes focus on Tab; tabIndex alone still lets a click place a caret.
    await expect(input).toHaveAttribute('readonly');
    await expect(input).toHaveAttribute('tabindex', '-1');
    // The name is derived from the label, so a capitalised label must not leak
    // into the field name the popover posts under.
    await expect(input).toHaveAttribute('name', 'appointment-popover-vet');

    const chip = await expectChipStraddlesTheTopEdge(canvasElement, 'Vet');
    // The person glyph is ornament next to text that already says "Vet"; if it
    // ever loses aria-hidden a screen reader announces an unlabelled graphic.
    await expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The filled state. Worth knowing: `getByRole("textbox")` finds this field with no ' +
          'accessible name at all, because `FormInput` sets `aria-label` from the empty `inlabel` ' +
          'and renders an empty `<label>`. The chip above the border is the only thing naming it, ' +
          'and it names it visually only.',
      },
    },
  },
};

export const EmptyValue: Story = {
  name: 'Nobody assigned',
  args: { value: '' },
  play: async ({ canvasElement }) => {
    const input = fieldOf(canvasElement);
    // `value || '-'`: an empty string renders a dash. A blank read-only box next
    // to a filled one reads as a loading state rather than as "unassigned".
    await expect(input).toHaveValue('-');
    await expectChipStraddlesTheTopEdge(canvasElement, 'Vet');
  },
  parameters: {
    docs: {
      description: {
        story:
          'An appointment with no vet on it. The dash is substituted here rather than upstream, so ' +
          'every caller gets it without having to remember.',
      },
    },
  },
};

export const LongStaffList: Story = {
  name: 'Several names in one field',
  args: {
    label: 'Assisted by',
    value: 'Dr. Sarah Chen, Nurse Priya Raghunathan, Amelia Fitzgerald-Whitmore, Tom Okonkwo',
  },
  play: async ({ canvasElement }) => {
    const input = fieldOf(canvasElement);
    const box = input.getBoundingClientRect();
    // The field is a single-line <input>, so the `whitespace-normal
    // wrap-break-word` classes cannot wrap it: it stays exactly one 44px row and
    // the tail of the list is simply not visible. Pinned because the classes
    // promise otherwise, and because a future switch to a textarea would change
    // the popover's height without anything else objecting.
    await expect(Math.round(box.height)).toBe(44);
    // `min-w-0` is what keeps that overflow inside the column instead of
    // stretching the popover to fit the longest staff list.
    const column = canvasElement.querySelector('[data-story-column]') as HTMLElement;
    await expect(Math.round(box.width)).toBeLessThanOrEqual(
      Math.round(column.getBoundingClientRect().width)
    );
    // A multi-word label still lowercases whole, spaces and all.
    await expect(input).toHaveAttribute('name', 'appointment-popover-assisted by');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Four names in the field the popover uses for assisting staff. The value is clipped, not ' +
          'wrapped, and the field name shows the other edge of deriving it from the label: a ' +
          'multi-word label produces a name with a space in it.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme, chip on the --screen band',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const chip = await expectChipStraddlesTheTopEdge(canvasElement, 'Vet');
    const background = globalThis.getComputedStyle(chip).backgroundColor;
    // The chip sits ON the field border, so its own band has to be opaque and
    // has to be the surface colour behind it. Transparent here and the border
    // runs straight through the label text.
    await expect(background).not.toBe('rgba(0, 0, 0, 0)');
    await expect(alphaOf(background)).toBe(1);
    // --screen in the espresso theme: the band tracks the token rather than
    // being painted in a light literal that only works on bone.
    await expect(background).toBe('rgb(47, 39, 30)');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The chip punches a hole in the field border with a `bg-[var(--screen)]` band, which is ' +
          'the one part of this component that has to know what it is sitting on. In dark that ' +
          'token flips to the espresso surface, so a hardcoded bone band would show as a pale ' +
          'smear across the border.',
      },
    },
  },
};
