import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import InsuranceClaims from './InsuranceClaims';
import type {
  InsuranceClaim,
  InsuranceClaimStatus,
} from '@/app/features/finance/types/insuranceClaim';

const NAMES: Record<string, string> = {
  'pat-1': 'Marnie Whitlock',
  'pat-2': 'Rufus Delacroix',
  'pat-3': 'Pepper Osei',
  'pat-4': 'Biscuit Adeyemi',
};

const claim = (
  overrides: Partial<InsuranceClaim> & { id: string; status: InsuranceClaimStatus }
): InsuranceClaim => ({
  organisationId: 'org-1',
  patientId: 'pat-1',
  invoiceId: null,
  encounterId: null,
  insurerName: 'Petsure',
  policyNumber: 'PS-2291',
  claimNumber: null,
  submittedAmount: 420,
  approvedAmount: null,
  paidAmount: null,
  currency: 'GBP',
  submittedAt: null,
  approvedAt: null,
  paidAt: null,
  rejectionReason: null,
  notes: null,
  externalClaimRef: null,
  createdAt: '2026-08-28T09:00:00.000Z',
  updatedAt: '2026-08-28T09:00:00.000Z',
  ...overrides,
});

const CLAIMS: InsuranceClaim[] = [
  claim({
    id: 'c1',
    status: 'DRAFT',
    patientId: 'pat-1',
    insurerName: 'Petsure',
    policyNumber: 'PS-2291',
    submittedAmount: 420,
  }),
  claim({
    id: 'c2',
    status: 'SUBMITTED',
    patientId: 'pat-2',
    insurerName: 'Bought By Many',
    policyNumber: 'BBM-8841',
    claimNumber: 'CLM-5567',
    submittedAmount: 199.5,
    submittedAt: '2026-08-29T10:00:00.000Z',
  }),
  claim({
    id: 'c3',
    status: 'PARTIALLY_APPROVED',
    patientId: 'pat-3',
    insurerName: 'Agria',
    policyNumber: 'AG-1200',
    claimNumber: 'CLM-5568',
    submittedAmount: 1240.6,
    approvedAmount: 900,
    submittedAt: '2026-08-25T10:00:00.000Z',
    approvedAt: '2026-08-27T10:00:00.000Z',
  }),
  claim({
    id: 'c4',
    status: 'PAID',
    patientId: 'pat-4',
    insurerName: 'ManyPets',
    policyNumber: 'MP-7781',
    claimNumber: 'CLM-5569',
    submittedAmount: 88,
    approvedAmount: 88,
    paidAmount: 88,
    invoiceId: 'inv-1',
    submittedAt: '2026-08-20T10:00:00.000Z',
    approvedAt: '2026-08-22T10:00:00.000Z',
    paidAt: '2026-08-24T10:00:00.000Z',
  }),
  claim({
    id: 'c5',
    status: 'REJECTED',
    patientId: 'pat-1',
    insurerName: 'Petsure',
    policyNumber: 'PS-9002',
    claimNumber: 'CLM-5570',
    submittedAmount: 310,
    rejectionReason: 'Pre-existing condition excluded by the policy.',
    submittedAt: '2026-08-18T10:00:00.000Z',
  }),
];

const noop = () => {};

const meta = {
  title: 'Finance/InsuranceClaims',
  component: InsuranceClaims,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Insurance claims screen, presentational.\n\n' +
          'Every piece of state and every action is handed in, so the same component drives the ' +
          'page, this story and its test. Money is a plain float in major units, so £45.50 is stored ' +
          'as 45.5 and formatted straight through; the approved and paid columns show a dash until ' +
          'the insurer’s decision is recorded.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    claims: CLAIMS,
    loading: false,
    error: null,
    onReload: noop,
    emptyMessage: 'File a claim to recover a treatment cost from a pet parent’s insurer.',
    activeStatus: 'all',
    onStatusChange: noop,
    companionName: (patientId: string) => NAMES[patientId] ?? 'Unknown companion',
    companions: [
      { id: 'pat-1', name: 'Marnie Whitlock' },
      { id: 'pat-2', name: 'Rufus Delacroix' },
    ],
    currency: 'GBP',
    activeClaimId: 'c3',
    onSelect: noop,
    pendingAction: null,
    actionError: null,
    onSubmitClaim: noop,
    onCancelClaim: noop,
    onUpdateStatus: noop,
    createOpen: false,
    onCreateOpenChange: noop,
    creating: false,
    createError: null,
    onCreate: noop,
  },
} satisfies Meta<typeof InsuranceClaims>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedStatuses: Story = {
  name: 'A row per claim',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Bought By Many')).toBeInTheDocument();
    // Both decimals survive: 199.5 must not print as "£200".
    await expect(canvas.getByText('£199.50')).toBeInTheDocument();
    // The paid column reads as a dash while a claim is still under review.
    await expect(canvas.getAllByText('-').length).toBeGreaterThan(0);
  },
};

export const Empty: Story = {
  name: 'No claims yet',
  args: {
    claims: [],
    activeClaimId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No insurance claims yet')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  name: 'Loading',
  args: {
    claims: [],
    loading: true,
    activeClaimId: null,
  },
};

export const LoadError: Story = {
  name: 'Failed to load',
  args: {
    claims: [],
    error: 'Unable to load insurance claims.',
    activeClaimId: null,
  },
};
