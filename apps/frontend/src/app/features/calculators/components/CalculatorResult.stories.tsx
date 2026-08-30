import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import CalculatorResult, { type ResultRow } from './CalculatorResult';

/* The five rows `fluid-rate` returns for an 18 kg dog at 7% dehydration with
   120 mL/day of ongoing losses - the widest real result in the registry, and the
   one that decides whether the numerals line up. */
const FLUID_RATE_ROWS: ResultRow[] = [
  { label: 'Maintenance', value: '1080 mL/day' },
  { label: 'Dehydration deficit', value: '1260 mL' },
  { label: 'Ongoing losses', value: '120 mL/day' },
  { label: 'Total volume', value: '2460 mL/day' },
  { label: 'Infusion rate', value: '102.5 mL/hr' },
];

const BSA_ROW: ResultRow = { label: 'Body surface area', value: '0.69 m²' };

const LONG_VALUE_ROW: ResultRow = {
  label: 'Interpretation',
  value: 'Non-azotemic; re-check creatinine in 6 months',
};

const meta = {
  title: 'Calculators/CalculatorResult',
  component: CalculatorResult,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The shared result block for every calculator - and two visually unrelated components ' +
          'behind one `rows` prop.\n\n' +
          '**Exactly one row** renders the serif hero: the row label is promoted to a 10.5px ' +
          'uppercase `--ink-faint` eyebrow and the value becomes 34px Newsreader. **Two or more** ' +
          'rows render a fixed "Result" eyebrow over a 13px/14px label-value list. Nothing in the ' +
          'prop names the branch, so a `compute` that starts returning an extra row silently ' +
          'changes the typography of a panel nobody edited - `body-surface-area` does exactly that ' +
          'when the optional mg/m² dose is filled in.\n\n' +
          'Both branches share the `role="status"` / `aria-live="polite"` wrapper. In the real form ' +
          'this block is unmounted until a calculation succeeds, so the live region is the only ' +
          'thing that announces the answer to a screen reader when it appears.',
      },
    },
  },
  tags: ['autodocs'],
  args: { rows: FLUID_RATE_ROWS },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 460 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CalculatorResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LabelValueList: Story = {
  name: 'Two or more rows - label/value list',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const status = canvas.getByRole('status');
    // Politeness is the whole point of the region: `assertive` would interrupt a
    // vet mid-sentence every time a number is recalculated.
    await expect(status).toHaveAttribute('aria-live', 'polite');

    const region = within(status);
    await expect(region.getByRole('heading', { level: 3 })).toHaveTextContent('Result');

    /* The list reads as a table without being one, and only because every value
       ends on the same right edge. `justify-between` plus `text-right` is what
       holds that column - a value that switched to left alignment would still
       "render fine" in a snapshot. */
    const rights = FLUID_RATE_ROWS.map((row) =>
      Math.round(region.getByText(row.value).getBoundingClientRect().right)
    );
    await expect(new Set(rights).size).toBe(1);

    // Five rows, five label/value pairs sharing a baseline - not ten stacked lines.
    for (const row of FLUID_RATE_ROWS) {
      const label = region.getByText(row.label).getBoundingClientRect();
      const value = region.getByText(row.value).getBoundingClientRect();
      await expect(label.top).toBeLessThan(value.bottom);
      await expect(value.top).toBeLessThan(label.bottom);
    }

    // Digits in a fixed-width column: without it the decimals wander as values change.
    await expect(
      globalThis.getComputedStyle(region.getByText('102.5 mL/hr')).fontVariantNumeric
    ).toContain('tabular-nums');
  },
};

export const SerifHero: Story = {
  name: 'Exactly one row - serif hero',
  args: { rows: [BSA_ROW] },
  play: async ({ canvasElement }) => {
    const region = within(within(canvasElement).getByRole('status'));

    /* The row label REPLACES the literal "Result" here. Getting this wrong prints
       a card whose eyebrow says "Result" above a bare number with no unit context. */
    const eyebrow = region.getByRole('heading', { level: 3 });
    await expect(eyebrow).toHaveTextContent(BSA_ROW.label);
    await expect(region.queryByText('Result')).not.toBeInTheDocument();

    const hero = region.getByText(BSA_ROW.value);
    const heroStyle = globalThis.getComputedStyle(hero);
    const eyebrowStyle = globalThis.getComputedStyle(eyebrow);

    // 34px is the design's hero size; the list branch renders the same values at 14px.
    await expect(heroStyle.fontSize).toBe('34px');
    /* The serif switch is a `font-newsreader` class over a token chain, so it fails
       to a silently inherited sans rather than to a visible error. Compare it with
       the eyebrow beside it rather than trusting the family string alone. */
    await expect(heroStyle.fontFamily).not.toBe(eyebrowStyle.fontFamily);
    await expect(heroStyle.fontFamily).toMatch(/serif/i);
    await expect(heroStyle.fontVariantNumeric).toContain('tabular-nums');
  },
};

export const LongValueInHero: Story = {
  name: 'Phone: a long value in the hero',
  args: { rows: [LONG_VALUE_ROW] },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  decorators: [
    (Story) => (
      // Pinned at a phone-ish width rather than left to the viewport global, so
      // the wrap being measured is the same one on every runner.
      <div style={{ width: 340 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    const hero = within(status).getByText(LONG_VALUE_ROW.value);

    // 34px of text in a 340px column has to wrap, and the card has to grow with it.
    const lineHeight = Number.parseFloat(globalThis.getComputedStyle(hero).lineHeight);
    await expect(
      Math.round(hero.getBoundingClientRect().height / lineHeight)
    ).toBeGreaterThanOrEqual(2);

    /* Nothing may spill sideways: the hero has no wrapping guard of its own, so a
       value the engine returns as prose is exactly what would push the card past
       the panel and take the phone layout with it. */
    await expect(hero.scrollWidth).toBeLessThanOrEqual(status.clientWidth);
    await expect(status.scrollWidth).toBeLessThanOrEqual(status.clientWidth);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The hero branch is reached by row count, not by content type, so any `compute` that ' +
          'returns a single descriptive row lands here rather than in the list. At 34px that is the ' +
          'case most likely to overflow the narrow calculators panel.',
      },
    },
  },
};
