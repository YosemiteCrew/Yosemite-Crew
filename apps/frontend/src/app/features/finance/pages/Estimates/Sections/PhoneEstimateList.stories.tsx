import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import PhoneEstimateList from './PhoneEstimateList';
import type { Estimate, EstimateStatus } from '@/app/features/finance/types/estimate';

/**
 * The width `/finance/estimates` gives this list on a 390px phone, measured on
 * the route rather than assumed: `main` is 390 and `yc-page-content` adds 12px
 * gutters, so the content box is 366.
 *
 * The stories are pinned to it with a decorator instead of relying on the
 * runner's viewport. `.storybook/test-runner.ts` renders any story without a
 * `viewport` global at `laptop` (1280x800) - wide enough that every assertion
 * below would hold no matter what the component did, and so could never fail.
 * Pinning the box is what gives them the ability to go red.
 */
const ROUTE_CONTENT_WIDTH = 366;

const NAMES: Record<string, string> = {
  'pat-1': 'Marnie Whitlock',
  'pat-2': 'Rufus Delacroix',
  'pat-3': 'Pepper Osei',
};

const row = (
  id: string,
  patientId: string,
  status: EstimateStatus,
  total: number,
  validUntil: string | null
): Estimate => ({
  id,
  organisationId: 'org-1',
  patientId,
  encounterId: null,
  status,
  validUntil,
  subtotal: total,
  taxAmount: 0,
  total,
  currency: 'GBP',
  notes: null,
  approvedBy: null,
  approvedAt: null,
  declinedAt: null,
  declineReason: null,
  convertedToInvoiceId: status === 'CONVERTED' ? 'inv-1' : null,
  createdBy: null,
  createdAt: '2026-08-28T09:00:00.000Z',
  updatedAt: '2026-08-28T09:00:00.000Z',
  items: [],
});

const meta = {
  title: 'Finance/PhoneEstimateList',
  component: PhoneEstimateList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The phone form of the estimates list.\n\n' +
          '`Estimates` had no phone branch, so a phone rendered the six-column `EstimateList` ' +
          'table inside a 364px scroll rail: `Companion` and `Status` were on screen and ' +
          '`Created`, `Valid until`, `Total` and `Actions` began beyond the right edge. The rail ' +
          'works - the page never scrolls sideways - so this was never a layout-overflow bug. It ' +
          'is that the amount, which is what an estimates list is consulted for, was reached only ' +
          'by discovering a horizontal swipe on a table.\n\n' +
          'Finance had the same problem on its own list and answered it with `PhoneInvoiceList`, ' +
          'and Finance’s phone branch links here, so this screen is a routine phone destination ' +
          'that had been left on the desktop treatment. The card mirrors that component.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: ROUTE_CONTENT_WIDTH }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {
    estimates: [
      row('e1', 'pat-1', 'APPROVED', 199.97, '2026-10-01T00:00:00.000Z'),
      row('e2', 'pat-2', 'DRAFT', 45.5, null),
      row('e3', 'pat-3', 'CONVERTED', 1240.6, '2026-09-15T00:00:00.000Z'),
    ],
    activeEstimateId: 'e1',
    onSelect: () => {},
    companion: (patientId: string) => ({
      name: NAMES[patientId] ?? 'Unknown companion',
      speciesCode: 'dog',
    }),
  },
} satisfies Meta<typeof PhoneEstimateList>;

export default meta;
type Story = StoryObj<typeof meta>;

const cardFor = (canvas: ReturnType<typeof within>, name: string) =>
  canvas.getByRole('button', { name: `Open the estimate for ${name}` });

export const Default: Story = {
  name: 'A card per estimate',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Marnie Whitlock')).toBeInTheDocument();
    // Both decimals survive: 45.5 must not print as "£46".
    await expect(canvas.getByText('£45.50')).toBeInTheDocument();
    await expect(canvas.getByText('£1,240.60')).toBeInTheDocument();
  },
};

export const NothingNeedsASidewaysSwipe: Story = {
  name: 'The amount is on screen without scrolling',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const [name, amount] of [
      ['Marnie Whitlock', '£199.97'],
      ['Rufus Delacroix', '£45.50'],
      ['Pepper Osei', '£1,240.60'],
    ] as const) {
      const card = cardFor(canvas, name);

      /* The whole point of the card over the table: at the route's width the
         card needs no horizontal scrolling of its own. In the table this
         amount sat at x=488..575 inside a 364px rail.

         Measured against the CARD, not `canvasElement` - Storybook renders the
         story inside a full-width <main>, so a check against the canvas passes
         at any component width and cannot fail. */
      await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);

      const cardRight = card.getBoundingClientRect().right;
      await expect(canvas.getByText(amount).getBoundingClientRect().right).toBeLessThanOrEqual(
        cardRight
      );
    }
  },
};

export const ActiveCardIsMarked: Story = {
  name: 'The open estimate is marked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The accessible name matches the table's eye button, so a caller's tests
    // and a screen reader see one label across both breakpoints.
    const active = cardFor(canvas, 'Marnie Whitlock');
    const inactive = cardFor(canvas, 'Pepper Osei');

    /* Compared as RENDERED colour, not as a class name. `toContain('border-[var(--blue)]')`
       passes as long as the string is in the attribute - it would still pass if
       the token resolved to the same colour as the hairline, or to nothing, so
       it could not fail for the reason the assertion exists. */
    const borderOf = (el: Element) => globalThis.getComputedStyle(el).borderTopColor;
    await expect(borderOf(active)).not.toBe(borderOf(inactive));
  },
};

export const SingleEstimate: Story = {
  name: 'One estimate, no expiry date',
  args: {
    estimates: [row('e9', 'pat-2', 'SENT', 88, null)],
    activeEstimateId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // No validUntil, so the date line is the created date alone rather than
    // trailing an empty "valid to".
    await expect(canvas.getByText('Aug 28, 2026')).toBeInTheDocument();
    await expect(canvas.queryByText(/valid to/)).not.toBeInTheDocument();
  },
};
