import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import InsuranceClaimDetail from './InsuranceClaimDetail';
import type { InsuranceClaim } from '@/app/features/finance/types/insuranceClaim';

const ORG_ID = 'org-insurance-claim-detail';

/**
 * OWNER carries `billing:edit:any` by default (see ROLE_PERMISSIONS), which is
 * what gates the whole action section - the status form and the Submit/Cancel
 * buttons. `revoked` reproduces a practice that has taken billing rights off
 * one person without touching their role.
 */
const membership = (revoked: string[] = []): UserOrganization => ({
  practitionerReference: 'Practitioner/vet-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

/**
 * `PermissionGate` reads `useOrgStore` through `usePermissions`, so every
 * story needs a loaded membership even though every other prop on this
 * component arrives as an arg, not store state.
 */
const withMembership =
  (revoked: string[] = []) =>
  () => {
    const snapshot = useOrgStore.getState();
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    return () => useOrgStore.setState(snapshot);
  };

const buildClaim = (overrides: Partial<InsuranceClaim>): InsuranceClaim => ({
  id: 'claim-1',
  organisationId: ORG_ID,
  patientId: 'patient-1',
  invoiceId: 'invoice-4471',
  encounterId: null,
  insurerName: 'Petsure',
  policyNumber: 'PS-2291-0087',
  claimNumber: null,
  submittedAmount: 980,
  approvedAmount: null,
  paidAmount: null,
  currency: 'GBP',
  status: 'DRAFT',
  submittedAt: null,
  approvedAt: null,
  paidAt: null,
  rejectionReason: null,
  notes: null,
  externalClaimRef: null,
  createdAt: '2026-08-15T09:00:00.000Z',
  updatedAt: '2026-08-15T09:00:00.000Z',
  ...overrides,
});

const DRAFT_CLAIM = buildClaim({});

const AWAITING_REVIEW_CLAIM = buildClaim({
  id: 'claim-2',
  status: 'SUBMITTED',
  claimNumber: 'PS-CLM-5510',
  submittedAt: '2026-08-16T09:00:00.000Z',
  notes: 'Dental extraction, x-rays attached to the original submission.',
});

const APPROVED_CLAIM = buildClaim({
  id: 'claim-3',
  insurerName: 'Bought By Many',
  status: 'APPROVED',
  submittedAmount: 980,
  approvedAmount: 640,
  claimNumber: 'BBM-8841',
  submittedAt: '2026-08-10T09:00:00.000Z',
  approvedAt: '2026-08-14T09:00:00.000Z',
});

const PAID_CLAIM = buildClaim({
  id: 'claim-4',
  insurerName: 'Agria',
  status: 'PAID',
  submittedAmount: 1240.6,
  approvedAmount: 1240.6,
  paidAmount: 1100,
  claimNumber: 'AG-5512',
  submittedAt: '2026-07-20T09:00:00.000Z',
  approvedAt: '2026-07-24T09:00:00.000Z',
  paidAt: '2026-08-02T09:00:00.000Z',
});

const statusForm = (canvasElement: HTMLElement) =>
  within(canvasElement).getByLabelText('Move claim to');

const meta = {
  title: 'InsuranceClaims/InsuranceClaimDetail',
  component: InsuranceClaimDetail,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One selected claim: its amounts and dates, and the lifecycle actions the backend ' +
          'will currently accept for its status. Purely presentational - every value and every ' +
          'callback arrives as a prop, and the parent page decides which claim is selected.\n\n' +
          "The status picker only ever offers a transition the service's own status endpoint " +
          'would accept (`nextReviewStatuses` mirrors `CLAIM_STATUS_TRANSITIONS`), and it echoes ' +
          "the service's amount rules (`assertClaimAmountsCoherent`) before sending anything, so " +
          'an approved amount above the submitted ask or a paid amount above the approved figure ' +
          'is caught locally rather than round-tripping to a 409. The whole action section - the ' +
          'form and the Submit/Cancel buttons - sits behind `billing:edit:any`, so a read-only ' +
          'user sees the claim but no way to change it.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: withMembership(),
  args: {
    claim: AWAITING_REVIEW_CLAIM,
    companionName: 'Bruno',
    pendingAction: null,
    error: null,
    onSubmit: fn(),
    onCancel: fn(),
    onUpdateStatus: fn(),
  },
  argTypes: {
    pendingAction: { control: 'radio', options: ['submit', 'cancel', 'status'] },
    error: { control: 'text' },
  },
} satisfies Meta<typeof InsuranceClaimDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AwaitingReview: Story = {
  name: 'Submitted, awaiting review',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Bruno')).toBeVisible();
    await expect(canvas.getByText('Petsure')).toBeVisible();
    await expect(canvas.getByText('£980.00')).toBeVisible();
    // A SUBMITTED claim can still be cancelled but not re-submitted.
    await expect(canvas.getByRole('button', { name: 'Cancel this claim' })).toBeEnabled();
    await expect(
      canvas.queryByRole('button', { name: 'Submit this claim to the insurer' })
    ).toBeNull();
    // The default target is "Under review", which needs no amount yet.
    await expect(statusForm(canvasElement)).toHaveValue('UNDER_REVIEW');
    await expect(canvas.queryByLabelText('Approved amount')).toBeNull();
  },
};

export const Draft: Story = {
  name: 'Draft - submit or cancel, no review form yet',
  args: { claim: DRAFT_CLAIM },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Nothing to review yet, so the picker is absent entirely.
    await expect(canvas.queryByLabelText('Move claim to')).toBeNull();
    await expect(canvas.getByRole('link', { name: 'View the invoice' })).toHaveAttribute(
      'href',
      '/finance?invoiceId=invoice-4471'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Submit this claim to the insurer' }));
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

export const ApprovedAwaitingPayment: Story = {
  name: 'Approved - recording the paid amount',
  args: { claim: APPROVED_CLAIM },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The only remaining transition is PAID, which needs a paid amount.
    await expect(statusForm(canvasElement)).toHaveValue('PAID');
    const paidInput = canvas.getByLabelText('Paid amount');
    const update = canvas.getByRole('button', { name: "Update this claim's status" });

    // Nothing entered yet - the client-side echo of the service's rule catches it.
    await userEvent.click(update);
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Enter the amount the insurer paid.'
    );
    await expect(args.onUpdateStatus).not.toHaveBeenCalled();

    // Above the approved figure (640) is refused the same way a 409 would be.
    await userEvent.type(paidInput, '700');
    await userEvent.click(update);
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Paid amount cannot exceed the approved amount.'
    );

    await userEvent.clear(paidInput);
    await userEvent.type(paidInput, '600');
    await userEvent.click(update);
    await expect(args.onUpdateStatus).toHaveBeenCalledWith({ status: 'PAID', paidAmount: 600 });
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

export const Paid: Story = {
  name: 'Paid - a closed claim has no actions left',
  args: { claim: PAID_CLAIM },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('£1,100.00')).toBeVisible();
    await expect(canvas.queryByLabelText('Move claim to')).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Cancel this claim' })).toBeNull();
    await expect(
      canvas.queryByRole('button', { name: 'Submit this claim to the insurer' })
    ).toBeNull();
  },
};

export const StatusUpdateFailed: Story = {
  name: 'Status update failed',
  args: {
    claim: AWAITING_REVIEW_CLAIM,
    error: 'The insurer already recorded a decision for this claim.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent(
      'The insurer already recorded a decision for this claim.'
    );
    // The form is still usable - the error is a retry prompt, not a lockout.
    await expect(canvas.getByRole('button', { name: "Update this claim's status" })).toBeEnabled();
  },
};

export const ReadOnly: Story = {
  name: 'Billing edit revoked - claim visible, no actions',
  beforeEach: withMembership(['billing:edit:any']),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Petsure')).toBeVisible();
    await expect(canvas.queryByLabelText('Move claim to')).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Cancel this claim' })).toBeNull();
  },
};
