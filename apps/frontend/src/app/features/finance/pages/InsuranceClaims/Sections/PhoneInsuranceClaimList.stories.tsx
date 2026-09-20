import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import PhoneInsuranceClaimList from './PhoneInsuranceClaimList';
import type {
  InsuranceClaim,
  InsuranceClaimStatus,
} from '@/app/features/finance/types/insuranceClaim';

/**
 * The width `/finance/insurance-claims` gives this list on a 390px phone,
 * measured on the route: `main` is 390 and `yc-page-content` adds 12px gutters,
 * so the content box is 366.
 *
 * Pinned with a decorator rather than a `viewport` global. Two reasons, and the
 * second is the load-bearing one:
 *
 *  - `.storybook/test-runner.ts` falls back to `laptop` (1280x800) for any story
 *    without a viewport pin, which is wide enough that every assertion below
 *    would hold no matter what the component did.
 *  - that hook reads `storyContext.globals`, and Storybook 10 carries the
 *    annotation as `storyGlobals`, so the pin does not currently apply at all.
 *    A decorator is the only width these stories are actually given.
 */
const ROUTE_CONTENT_WIDTH = 366;

const claim = (
  id: string,
  insurerName: string,
  status: InsuranceClaimStatus,
  amounts: { submitted: number; approved?: number | null; paid?: number | null },
  claimNumber: string | null
): InsuranceClaim =>
  ({
    id,
    organisationId: 'org-1',
    patientId: 'pat-1',
    invoiceId: null,
    encounterId: null,
    insurerName,
    policyNumber: 'PS-2291',
    claimNumber,
    submittedAmount: amounts.submitted,
    approvedAmount: amounts.approved ?? null,
    paidAmount: amounts.paid ?? null,
    currency: 'GBP',
    status,
    submittedAt: null,
    approvedAt: null,
    createdAt: '2026-08-28T09:00:00.000Z',
    updatedAt: '2026-08-28T09:00:00.000Z',
  }) as InsuranceClaim;

const meta = {
  title: 'Finance/PhoneInsuranceClaimList',
  component: PhoneInsuranceClaimList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The phone form of the insurance claims list.\n\n' +
          '`InsuranceClaims` had no phone branch, so a phone rendered the seven-column table ' +
          'inside a 364px scroll rail with `Approved`, `Paid`, `Status` and `Actions` past the ' +
          'right edge - `Status` starting 103px out. The rail works and the page never scrolled ' +
          'sideways; the defect was that the column the list is consulted for was behind an ' +
          'undiscoverable swipe.\n\n' +
          'The card leads with status for that reason, and shows one money figure rather than ' +
          'three: whichever the claim has reached (paid, else approved, else the submitted ask), ' +
          'labelled so the number is never ambiguous.',
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
    claims: [
      claim('c1', 'Petsure', 'DRAFT', { submitted: 420 }, null),
      claim(
        'c2',
        'Bought By Many',
        'PARTIALLY_APPROVED',
        { submitted: 980, approved: 640 },
        'BBM-8841'
      ),
      claim('c3', 'Agria', 'PAID', { submitted: 1240.6, approved: 1240.6, paid: 1100 }, 'AG-5512'),
    ],
    activeClaimId: 'c2',
    onSelect: () => {},
  },
} satisfies Meta<typeof PhoneInsuranceClaimList>;

export default meta;
type Story = StoryObj<typeof meta>;

const cardFor = (canvas: ReturnType<typeof within>, insurer: string) =>
  canvas.getByRole('button', { name: `Open the claim for ${insurer}` });

export const Default: Story = {
  name: 'A card per claim',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(cardFor(canvas, 'Petsure')).toBeInTheDocument();
    // Minor units survive: 1100 must not print as "£1,100" without decimals.
    expect(cardFor(canvas, 'Agria').textContent).toContain('£1,100.00');
  },
};

export const StatusIsOnScreen: Story = {
  name: 'Status and the amount need no sideways swipe',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const insurer of ['Petsure', 'Bought By Many', 'Agria']) {
      const card = cardFor(canvas, insurer);

      /* The defect this component exists to fix. In the table Status sat at
         x=493..659 and Actions at x=659..744, inside a 364px rail.

         Measured against the CARD, not `canvasElement`: Storybook renders the
         story inside a full-width <main>, so a check against the canvas passes
         at any component width and could never fail. */
      expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    }
  },
};

export const OneFigurePerCard: Story = {
  name: 'The figure shown is the furthest the claim has got',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Paid wins over approved and submitted, and says so.
    const paid = cardFor(canvas, 'Agria').textContent ?? '';
    expect(paid).toContain('Paid');
    expect(paid).toContain('£1,100.00');
    expect(paid).not.toContain('£1,240.60');

    // Approved wins over the submitted ask.
    const approved = cardFor(canvas, 'Bought By Many').textContent ?? '';
    expect(approved).toContain('Approved');
    expect(approved).toContain('£640.00');
    expect(approved).not.toContain('£980.00');

    // Nothing settled yet, so the ask is what is shown.
    const draft = cardFor(canvas, 'Petsure').textContent ?? '';
    expect(draft).toContain('Submitted');
    expect(draft).toContain('£420.00');
  },
};

export const ActiveCardIsMarked: Story = {
  name: 'The open claim is marked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Compared as RENDERED colour, not as a class name: a `toContain` on the
       className passes as long as the string is present, so it would still pass
       if the token resolved to the hairline colour or to nothing. */
    const borderOf = (el: Element) => globalThis.getComputedStyle(el).borderTopColor;
    expect(borderOf(cardFor(canvas, 'Bought By Many'))).not.toBe(
      borderOf(cardFor(canvas, 'Agria'))
    );
  },
};
