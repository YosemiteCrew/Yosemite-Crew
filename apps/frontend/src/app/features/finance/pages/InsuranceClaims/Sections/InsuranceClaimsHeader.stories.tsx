import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import type {
  InsuranceClaim,
  InsuranceClaimStatus,
} from '@/app/features/finance/types/insuranceClaim';
import type { CompanionChoice } from '@/app/features/finance/pages/InsuranceClaims/Sections/CreateInsuranceClaimDialog';
import InsuranceClaimsHeader from './InsuranceClaimsHeader';

const ORG_ID = 'org-storybook';

/**
 * `New insurance claim` sits behind `PermissionGate`, which reads the
 * signed-in membership from the org store rather than being told the answer
 * by a prop - so the story seeds the store the gate actually reads, the same
 * way `InvoiceCreditNotes.stories.tsx` does. Every shipped role carries
 * `billing:edit:any`, so a read-only view only exists through
 * `revokedPermissions`, which the `NoEditPermission` story below uses.
 */
const seedRole = (revokedPermissions: string[] = []) => {
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: {
      [ORG_ID]: {
        id: 'membership-1',
        practitionerReference: 'Practitioner/practitioner-1',
        organizationReference: `Organization/${ORG_ID}`,
        roleCode: 'OWNER' as UserOrganization['roleCode'],
        roleDisplay: 'Owner',
        active: true,
        revokedPermissions,
      },
    },
    status: 'loaded',
  });
};

const claim = (
  overrides: Partial<InsuranceClaim> & { id: string; status: InsuranceClaimStatus }
): InsuranceClaim => ({
  organisationId: ORG_ID,
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
  claim({ id: 'c1', status: 'DRAFT', submittedAmount: 420 }),
  claim({
    id: 'c2',
    status: 'SUBMITTED',
    insurerName: 'Bought By Many',
    policyNumber: 'BBM-8841',
    claimNumber: 'CLM-5567',
    submittedAmount: 199.5,
    submittedAt: '2026-08-29T10:00:00.000Z',
  }),
  claim({
    id: 'c3',
    status: 'PAID',
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
];

const COMPANIONS: CompanionChoice[] = [
  { id: 'comp-1', name: 'Marnie' },
  { id: 'comp-2', name: 'Rufus' },
];

const meta = {
  title: 'InsuranceClaims/InsuranceClaimsHeader',
  component: InsuranceClaimsHeader,
  parameters: {
    layout: 'padded',
    // `Secondary`'s "Invoices" control renders a next/link `<Link>`.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The Insurance claims page header: a title with a live count and an info tooltip, ' +
          'a money sub-line, and - stacked on the right - the page actions above the status ' +
          'filter row, the same anatomy Finance and Estimates use.\n\n' +
          'The sub-line is derived, not passed in: `summariseClaims` adds up `submittedAmount` ' +
          'for every DRAFT/SUBMITTED/UNDER_REVIEW claim as "with insurers" and `paidAmount` for ' +
          'every PAID claim as "paid back", so it only ever tells the truth the row data can ' +
          'prove - a claim under review counts what was asked for, not what might be approved. ' +
          '`sharedCurrency` picks the one currency the claims agree on and falls back to the ' +
          "organisation's currency where they do not.\n\n" +
          '"New insurance claim" sits behind `billing:edit:any` and is separately disabled when ' +
          'there are no companions to file a claim for.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    claims: CLAIMS,
    currency: 'GBP',
    activeStatus: 'all',
    onStatusChange: fn(),
    companions: COMPANIONS,
    onCreate: fn(),
  },
  argTypes: {
    currency: { control: 'text' },
    activeStatus: { control: 'text' },
  },
  beforeEach: () => seedRole(),
} satisfies Meta<typeof InsuranceClaimsHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1, name: /Insurance claims/ })).toBeVisible();
    await expect(canvas.getByText('(3)')).toBeVisible();
    // 420 + 199.5 in progress; 88 paid back.
    await expect(canvas.getByText('£619.50 with insurers · £88.00 paid back')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Back to invoices' })).toHaveAttribute(
      'href',
      '/finance'
    );
    await expect(
      canvas.getByRole('button', { name: 'Create a new insurance claim' })
    ).toBeEnabled();
  },
};

export const Empty: Story = {
  name: 'No claims yet',
  args: { claims: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('(0)')).toBeVisible();
    await expect(canvas.getByText('£0.00 with insurers · £0.00 paid back')).toBeVisible();
  },
};

export const NoCompanionsDisablesCreate: Story = {
  name: 'No companions - Create is disabled',
  args: { companions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The button stays visible (the permission is held); it is the lack of a
    // companion to file against that disables it, not a permission denial.
    await expect(
      canvas.getByRole('button', { name: 'Create a new insurance claim' })
    ).toBeDisabled();
  },
};

export const NoEditPermission: Story = {
  name: 'Billing edit revoked - no Create button',
  beforeEach: () => seedRole(['billing:edit:any']),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The gate renders nothing rather than a disabled control, so the row is
    // just the Invoices link and the filters.
    await expect(
      canvas.queryByRole('button', { name: 'Create a new insurance claim' })
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Back to invoices' })).toBeVisible();
  },
};

export const ActiveStatusFilter: Story = {
  name: 'A status filter is active',
  args: { activeStatus: 'PAID' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Paid' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  },
};

export const ChangingTheFilter: Story = {
  name: 'Picking a filter calls onStatusChange',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Submitted' }));
    await expect(args.onStatusChange).toHaveBeenCalledWith('SUBMITTED');

    await userEvent.click(canvas.getByRole('button', { name: 'Create a new insurance claim' }));
    await expect(args.onCreate).toHaveBeenCalledTimes(1);
  },
};
