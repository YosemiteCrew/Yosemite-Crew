import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import InsuranceClaimList from './InsuranceClaimList';
import type {
  InsuranceClaim,
  InsuranceClaimStatus,
} from '@/app/features/finance/types/insuranceClaim';

const claim = (
  id: string,
  insurerName: string,
  status: InsuranceClaimStatus,
  amounts: { submitted: number; approved?: number | null; paid?: number | null },
  claimNumber: string | null = null,
  currency = 'GBP'
): InsuranceClaim => ({
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
  currency,
  status,
  submittedAt: '2026-08-28T09:00:00.000Z',
  approvedAt: null,
  paidAt: null,
  rejectionReason: null,
  notes: null,
  externalClaimRef: null,
  createdAt: '2026-08-28T09:00:00.000Z',
  updatedAt: '2026-08-28T09:00:00.000Z',
});

const meta = {
  title: 'InsuranceClaims/InsuranceClaimList',
  component: InsuranceClaimList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The insurance claims list, rendered through the shared `GenericTable` so it inherits ' +
          "the app's column-header typography, contrast, sticky behaviour and pager rather than " +
          'maintaining a second finance table of its own.\n\n' +
          'The first column stacks the insurer over its policy number, the way the invoice table ' +
          'stacks a primary and a quiet second line, so the finance tables read as one family. ' +
          'Submitted, Approved and Paid are three separate money columns rather than one figure: ' +
          'Approved and Paid are nullable until the claim has moved past that stage, and render as ' +
          'a dash rather than a misleading zero. Claim number follows the same rule - it is ' +
          'assigned once the claim moves off DRAFT, so a fresh claim renders a dash there too.\n\n' +
          "The open claim is highlighted through GenericTable's row hook rather than dropped: " +
          'without it, the detail panel a caller renders below this list could belong to any row ' +
          'on screen.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    claims: [
      claim('c1', 'Petsure', 'DRAFT', { submitted: 420 }),
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
    onSelect: fn(),
  },
} satisfies Meta<typeof InsuranceClaimList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A row per claim',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Petsure')).toBeInTheDocument();
    await expect(canvas.getByText('PS-2291')).toBeInTheDocument();
    // Both decimals survive: 1240.6 must not print as "£1,241".
    await expect(canvas.getByText('£1,240.60')).toBeInTheDocument();
    await expect(canvas.getByText('£1,100.00')).toBeInTheDocument();
    // A draft claim has no claim number and no settled amounts yet - all dashes.
    await expect(canvas.getAllByText('-').length).toBeGreaterThanOrEqual(2);
    await expect(canvas.getByText('Partially approved')).toBeInTheDocument();
    // The open claim's row is the one GenericTable highlights.
    await expect(canvasElement.querySelector('tbody tr.bg-card-hover')).not.toBeNull();
  },
};

export const EmptyState: Story = {
  name: 'No claims yet',
  args: { claims: [], activeClaimId: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No claims yet')).toBeVisible();
    await expect(canvas.getByText('Claims appear here as soon as there are any.')).toBeVisible();
  },
};

export const NoActiveClaim: Story = {
  name: 'No claim is open yet',
  args: { activeClaimId: null },
  play: async ({ canvasElement }) => {
    // Nothing in the list should carry the active row's highlight.
    await expect(canvasElement.querySelector('tbody tr.bg-card-hover')).toBeNull();
  },
};

export const DifferentCurrency: Story = {
  name: 'A currency with no minor unit',
  args: {
    claims: [claim('c4', 'Zenoaq Cover', 'SUBMITTED', { submitted: 45000 }, 'ZC-1120', 'JPY')],
    activeClaimId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // JPY has no minor unit, so Intl prints no decimals - not "¥45,000.00".
    await expect(canvas.getByText('¥45,000')).toBeInTheDocument();
  },
};
