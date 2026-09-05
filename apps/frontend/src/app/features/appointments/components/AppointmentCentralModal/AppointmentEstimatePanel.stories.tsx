import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import AppointmentEstimatePanel from './AppointmentEstimatePanel';

/**
 * Resolve a token from inside the panel's own subtree. Several ink tokens are
 * re-declared under `body:has([data-yc-app])`, so a probe parked on `document`
 * reads the marketing value and the comparison is against the wrong number.
 */
const resolveColorToken = (near: Element, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.color = `var(${token})`;
  near.append(probe);
  const value = globalThis.getComputedStyle(probe).color;
  probe.remove();
  return value;
};

/** The three boxes: left column, hairline divider, right column. */
const columnsOf = (canvasElement: HTMLElement): HTMLElement[] => {
  const panel = canvasElement.querySelector<HTMLElement>('div.rounded-2xl');
  if (!panel) throw new Error('estimate panel did not render');
  return Array.from(panel.children) as HTMLElement[];
};

/** The big number sits immediately after its "Estimate" label in the right column. */
const estimateValue = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByText('Estimate').nextElementSibling as HTMLElement;

const meta = {
  title: 'Appointments/AppointmentEstimatePanel',
  component: AppointmentEstimatePanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The money summary at the foot of the central appointment panel: cost and max discount ' +
          'stacked on the left, a hairline, then the estimate as a 24px figure on the right.\n\n' +
          'Two behaviours here are easy to misread from the source. **The estimate is the cost, ' +
          'not the cost minus the discount** - `computeEstimate` is `Math.max(0, Number(cost) || 0)` ' +
          'and never looks at `maxDiscount` at all, so with a cost of $120 and a max discount of ' +
          '$15 the panel shows $120 twice. And **`currency` moves the label only**: it is ' +
          'interpolated into `Cost (USD):` while all three amounts are hard-coded to a dollar ' +
          'sign, so a EUR appointment reads `Cost (EUR): $89.50`.\n\n' +
          'Every slot branches on `> 0` rather than on presence, and each falls to an em dash ' +
          "when nothing is costed; the estimate's dash sits in tertiary ink so an empty slot " +
          'never reads as a live total. Money prints as `$143.00` - sign, no space. ' +
          'Both money props are typed `unknown` because they arrive off an API record, so the ' +
          'coercion story below is the real input shape, not a contrived one.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    cost: 120,
    maxDiscount: 15,
  },
} satisfies Meta<typeof AppointmentEstimatePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Costed, with a max discount',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Cost (USD):')).toBeInTheDocument();
    await expect(canvas.getByText('Max discount:')).toBeInTheDocument();

    /* Both amounts print in the one shape the design system allows: sign, no
       space, two decimals. A "$ 15.00" here is the drift this pins against. */
    await expect(canvas.getByText('$15.00')).toBeInTheDocument();

    /* The estimate does NOT subtract the discount - `computeEstimate` only ever
       sees `cost`. So the same figure appears twice, and finding it once would
       mean somebody had quietly made the estimate net. */
    await expect(canvas.getAllByText('$120.00')).toHaveLength(2);

    const value = estimateValue(canvasElement);
    await expect(value).toHaveTextContent('$120.00');
    // A live estimate is the 24px blue figure, not the tertiary placeholder ink.
    await expect(globalThis.getComputedStyle(value).fontSize).toBe('24px');
    await expect(globalThis.getComputedStyle(value).color).toBe(
      resolveColorToken(value.parentElement as Element, '--blue-text')
    );

    /* The divider is a `w-px self-stretch` element inside an `items-center` row.
       Without `self-stretch` it centres and collapses to zero height - still in
       the DOM, still 1px wide, and completely invisible. */
    const [left, divider] = columnsOf(canvasElement);
    await expect(divider.getBoundingClientRect().width).toBeLessThanOrEqual(1.5);
    await expect(divider.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      left.getBoundingClientRect().height
    );
  },
};

export const NothingCosted: Story = {
  name: 'Nothing costed yet',
  args: { cost: 0, maxDiscount: 0 },
  play: async ({ canvasElement }) => {
    // All three slots fall to an em dash - the estimate included. A "$ 00.00"
    // placeholder in the live blue reads as a real total of zero.
    await expect(within(canvasElement).getAllByText('—')).toHaveLength(3);

    // The estimate's dash keeps the tertiary ink so an empty slot never looks
    // like a live figure.
    const value = estimateValue(canvasElement);
    await expect(value).toHaveTextContent('—');
    const ink = globalThis.getComputedStyle(value).color;
    const ground = value.parentElement as Element;
    await expect(ink).toBe(resolveColorToken(ground, '--color-text-tertiary'));
    await expect(ink).not.toBe(resolveColorToken(ground, '--blue-text'));
  },
};

export const NonUsdCurrency: Story = {
  name: 'A non-USD currency',
  args: { cost: 89.5, maxDiscount: 0, currency: 'EUR' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Cost (EUR):')).toBeInTheDocument();
    /* `currency` reaches the LABEL only. Every amount is hard-coded to `$`, so a
       euro appointment prices itself in dollars. Asserted rather than fixed:
       changing the symbol is a product decision, and until it is made this is
       the behaviour a snapshot should hold still. */
    await expect(canvas.getAllByText('$89.50')).toHaveLength(2);
  },
};

export const CoercedInput: Story = {
  name: 'Strings and junk off the API record',
  args: { cost: '240.5', maxDiscount: 'n/a' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* A numeric STRING is what the appointment record actually carries, and it
       has to format like a number. `Number(cost) || 0` is doing that work; drop
       the coercion and the panel prints the raw string with no decimals. */
    await expect(canvas.getAllByText('$240.50')).toHaveLength(2);
    // Junk degrades to the dash rather than to "$NaN".
    await expect(canvas.getByText('—')).toBeInTheDocument();
    await expect(canvasElement.textContent).not.toMatch(/NaN/);
  },
};

export const Phone: Story = {
  name: 'Phone: still two columns',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    /* The row never wraps - there is no `flex-wrap`, so at 375px the left column
       squeezes instead of dropping under the estimate. Worth measuring: the
       failure mode is not a stacked layout, it is a 24px figure pushing the
       whole panel wider than the modal. */
    const [left, , right] = columnsOf(canvasElement);
    await expect(left.getBoundingClientRect().right).toBeLessThanOrEqual(
      right.getBoundingClientRect().left
    );
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
