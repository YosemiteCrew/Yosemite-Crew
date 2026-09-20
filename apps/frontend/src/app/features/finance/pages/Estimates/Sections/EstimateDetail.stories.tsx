import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import EstimateDetail from './EstimateDetail';
import type { Estimate, EstimateStatus } from '@/app/features/finance/types/estimate';

const ORG_ID = 'org-storybook';

/**
 * Seeds the one store the gate reads, rather than mocking PermissionGate away.
 * `usePermissions` derives the list from `roleCode`, so this exercises the real
 * gate - which matters here, because the action row is the part of this
 * component the gate hides, and stubbing it out would test nothing.
 *
 * All seven roles in ROLE_PERMISSIONS carry `billing:edit:any`, so a read-only
 * billing user cannot be produced by picking a weaker role. The only route to
 * one is `revokedPermissions`, which is what the read-only story below uses -
 * and it is the realistic case anyway, since that is how a practice actually
 * takes billing rights off one person.
 */
const seedRole = (roleCode: UserOrganization['roleCode'], revokedPermissions: string[] = []) => {
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: {
      [ORG_ID]: {
        id: 'membership-1',
        practitionerReference: 'Practitioner/practitioner-1',
        organizationReference: `Organization/${ORG_ID}`,
        roleCode,
        roleDisplay: roleCode,
        active: true,
        revokedPermissions,
      },
    },
    status: 'loaded',
  });
};

// Seeded at module scope as well as per-story. Seeding only inside a decorator
// leaves the gate resolving on the very first paint, and a play function that
// runs against that frame sees no action row at all - which is exactly how this
// showed up: two stories failing intermittently rather than every time.
seedRole('OWNER');

const item = (
  id: string,
  description: string,
  quantity: number,
  unitPrice: number,
  taxRate: number,
  notes: string | null = null
) => ({
  id,
  description,
  quantity,
  unitPrice,
  taxRate,
  lineTotal: quantity * unitPrice,
  notes,
});

/**
 * Figures are deliberately not round. `formatMoneyPrecise` keeps both decimals,
 * so 3 x 19.99 has to read as 59.97 - a story built on whole numbers would hide
 * the rounding bug this component exists to avoid.
 */
const estimate = (overrides: Partial<Estimate> = {}): Estimate => ({
  id: 'est-1',
  organisationId: 'org-1',
  patientId: 'pat-1',
  encounterId: null,
  status: 'APPROVED',
  validUntil: '2026-10-01T00:00:00.000Z',
  subtotal: 179.97,
  taxAmount: 20.0,
  total: 199.97,
  currency: 'GBP',
  notes: 'Two-stage dental under general anaesthetic.',
  approvedBy: 'user-1',
  approvedAt: '2026-09-01T09:00:00.000Z',
  declinedAt: null,
  declineReason: null,
  convertedToInvoiceId: null,
  createdBy: 'user-1',
  createdAt: '2026-08-30T09:00:00.000Z',
  updatedAt: '2026-09-01T09:00:00.000Z',
  items: [
    item('i1', 'Dental scale and polish', 1, 120, 0),
    item('i2', 'Pre-anaesthetic bloods', 3, 19.99, 20, 'Repeat on the day if delayed'),
  ],
  ...overrides,
});

const meta = {
  title: 'Finance/EstimateDetail',
  component: EstimateDetail,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One estimate: its lines, its totals, and the lifecycle actions the backend will ' +
          'currently accept.\n\n' +
          'The action row is gated twice. `PermissionGate` hides it entirely without ' +
          '`billing:edit:any`, and the status predicates decide which of the four actions is ' +
          'offered - so the UI never presents a transition `EstimateService` would answer with a ' +
          '409. Send is DRAFT only; approve and decline are DRAFT or SENT; convert is APPROVED ' +
          'only. A CONVERTED estimate offers nothing and instead links to the invoice it became.\n\n' +
          'Money uses `formatMoneyPrecise`, not the shared `formatMoney`, because that one rounds ' +
          'to whole units - fine for a dashboard tile, wrong for a figure a client approves and ' +
          'an invoice then has to match.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      seedRole('OWNER');
      return <Story />;
    },
  ],
  args: {
    estimate: estimate(),
    companionName: 'Marnie Whitlock',
    pendingAction: null,
    error: null,
    onAction: () => {},
  },
} satisfies Meta<typeof EstimateDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Query by the accessible name, which is the aria-label, NOT the visible text -
 * an aria-label replaces the label a button would otherwise get from its
 * content. Matching the visible text here silently found nothing, and because
 * the absent-action assertions then also "passed", the helper reported green
 * while proving nothing about two of the four actions.
 */
const ACTIONS = {
  'Mark as sent': 'Mark this estimate as sent',
  Decline: 'Decline this estimate',
  Approve: 'Approve this estimate',
  'Convert to invoice': 'Convert this estimate to an invoice',
} as const;

type ActionLabel = keyof typeof ACTIONS;

const expectActions = async (canvasElement: HTMLElement, expected: readonly ActionLabel[]) => {
  const canvas = within(canvasElement);
  for (const [label, accessibleName] of Object.entries(ACTIONS) as [ActionLabel, string][]) {
    const found = canvas.queryByRole('button', { name: accessibleName });
    if (expected.includes(label)) {
      await expect(found).toBeInTheDocument();
      // Guard against the failure this helper already had once: assert the
      // visible text too, so a renamed aria-label cannot make the query match
      // some other button.
      await expect(found).toHaveTextContent(label);
    } else {
      await expect(found).not.toBeInTheDocument();
    }
  }
};

export const Approved: Story = {
  name: 'Approved - the only state that can convert',
  play: async ({ canvasElement }) => {
    await expectActions(canvasElement, ['Convert to invoice']);
    const canvas = within(canvasElement);
    // 3 x 19.99 = 59.97, kept to the penny rather than rounded to 60.
    await expect(canvas.getByText('£59.97')).toBeInTheDocument();
    await expect(canvas.getByText('£199.97')).toBeInTheDocument();
  },
};

export const Draft: Story = {
  name: 'Draft - send, approve or decline',
  args: { estimate: estimate({ status: 'DRAFT', approvedAt: null, approvedBy: null }) },
  play: async ({ canvasElement }) => {
    await expectActions(canvasElement, ['Mark as sent', 'Approve', 'Decline']);
  },
};

export const Sent: Story = {
  name: 'Sent - no longer sendable',
  args: { estimate: estimate({ status: 'SENT' }) },
  play: async ({ canvasElement }) => {
    await expectActions(canvasElement, ['Approve', 'Decline']);
  },
};

export const Converted: Story = {
  name: 'Converted - no actions, links to the invoice',
  args: {
    estimate: estimate({ status: 'CONVERTED', convertedToInvoiceId: 'inv-77' }),
  },
  play: async ({ canvasElement }) => {
    await expectActions(canvasElement, []);
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: 'View the invoice' });
    await expect(link).toHaveAttribute('href', '/finance?invoiceId=inv-77');
    await expect(
      canvas.getByText(/Converting again would not create a second one/i)
    ).toBeInTheDocument();
  },
};

export const Declined: Story = {
  name: 'Declined - reason shown, nothing to do',
  args: {
    estimate: estimate({
      status: 'DECLINED',
      declinedAt: '2026-09-01T10:00:00.000Z',
      declineReason: 'Owner is seeking a second opinion.',
    }),
  },
  play: async ({ canvasElement }) => {
    await expectActions(canvasElement, []);
    await expect(within(canvasElement).getByText(/seeking a second opinion/i)).toBeInTheDocument();
  },
};

export const Converting: Story = {
  name: 'Converting - every action disabled',
  args: { pendingAction: 'convert' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: /Convert this estimate/i });
    await expect(button).toBeDisabled();
    await expect(button).toHaveTextContent('Converting...');
  },
};

export const ActionFailed: Story = {
  name: 'Action failed - the reason is on screen',
  args: { error: 'Only APPROVED estimates can be converted.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Only APPROVED estimates can be converted.'
    );
  },
};

/** Every lifecycle state side by side, for a one-glance check of the pill colours. */
export const EveryStatus: Story = {
  name: 'Every status',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {(['DRAFT', 'SENT', 'APPROVED', 'CONVERTED', 'DECLINED', 'EXPIRED'] as EstimateStatus[]).map(
        (status) => (
          <EstimateDetail
            key={status}
            estimate={estimate({
              status,
              convertedToInvoiceId: status === 'CONVERTED' ? 'inv-77' : null,
            })}
            companionName="Marnie Whitlock"
            pendingAction={null}
            error={null}
            onAction={() => {}}
          />
        )
      )}
    </div>
  ),
};

export const WithoutEditPermission: Story = {
  name: 'Billing edit revoked - no actions at all',
  decorators: [
    (Story) => {
      seedRole('RECEPTIONIST', ['billing:edit:any']);
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    // The estimate is APPROVED, so convert would be offered to an editor. With
    // billing:edit:any revoked the action row is absent rather than merely
    // disabled, and the estimate itself still reads fine.
    await expectActions(canvasElement, []);
    await expect(within(canvasElement).getByText('Dental scale and polish')).toBeInTheDocument();
  },
};
