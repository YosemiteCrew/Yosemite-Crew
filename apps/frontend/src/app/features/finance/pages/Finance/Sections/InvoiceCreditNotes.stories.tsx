import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import type { CreditNote, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import InvoiceCreditNotes from './InvoiceCreditNotes';

const ORG_ID = 'org-storybook';

/**
 * Seeds the store the gate reads rather than mocking PermissionGate away, so the
 * real gate runs. Every role in ROLE_PERMISSIONS carries `billing:edit:any`, so
 * a read-only billing user only exists through `revokedPermissions` - which is
 * what the read-only story below uses.
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

seedRole();

const note = (
  id: string,
  number: string,
  amount: number,
  status: CreditNote['status'],
  reason?: string
): CreditNote => ({
  id,
  invoiceId: 'inv-1',
  creditNoteNumber: number,
  amount,
  status,
  reason,
  createdAt: new Date('2026-08-30T09:00:00.000Z'),
  updatedAt: new Date('2026-08-30T09:00:00.000Z'),
});

const meta = {
  title: 'Finance/InvoiceCreditNotes',
  component: InvoiceCreditNotes,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The credit ledger on an invoice, and the controls to credit more or reverse one.\n\n' +
          'The amount is capped client-side at the invoice total minus every ISSUED note, ' +
          'matching the cap in `InvoiceService.issueCreditNote`, so the common mistake produces ' +
          'a message here instead of a 409. A VOIDED note stops counting against the cap, which ' +
          'is why the sum filters on status rather than adding up the whole list.\n\n' +
          'Issuing a credit note cancels every PaymentAttempt on the invoice that is not already ' +
          'SUCCEEDED or CANCELED. That is deliberate on the backend - an outstanding Stripe ' +
          'checkout link still names the old amount and would collect the full sum - and it is ' +
          'why the copy warns about open payment links rather than staying silent about a side ' +
          'effect the user cannot see.\n\n' +
          'Known gap: the Outstanding figure in the summary panel above does not yet respond to ' +
          'a credit note, because the finance list endpoint does not return `settlementSummary`. ' +
          'Tracked in #2595.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      seedRole();
      return (
        <div style={{ maxWidth: 420 }}>
          <Story />
        </div>
      );
    },
  ],
  args: {
    creditNotes: [note('cn-1', 'CN-0001', 40, 'ISSUED', 'Goodwill on the delayed dental')],
    totalAmount: 199.97,
    status: 'AWAITING_PAYMENT',
    currency: 'GBP',
    busy: false,
    error: null,
    onAction: () => {},
  },
} satisfies Meta<typeof InvoiceCreditNotes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneCredit: Story = {
  name: 'One credit issued',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('CN-0001')).toBeInTheDocument();
    await expect(canvas.getByText(/Goodwill on the delayed dental/)).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: /Void credit note CN-0001/i })
    ).toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'Nothing credited yet',
  args: { creditNotes: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Nothing has been credited against this invoice/i)
    ).toBeInTheDocument();
  },
};

export const VoidedDoesNotCount: Story = {
  name: 'A voided note stops reducing the invoice',
  args: {
    creditNotes: [
      note('cn-1', 'CN-0001', 40, 'ISSUED'),
      note('cn-2', 'CN-0002', 60, 'VOIDED', 'Raised against the wrong invoice'),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Credited counts the ISSUED 40 only, not 100. Read the figure opposite the
    // "Credited" label rather than by text - the note's own amount is also 40,
    // so a bare getByText('£40') matches two nodes and proves nothing.
    const credited = canvas.getByText('Credited').nextElementSibling;
    await expect(credited).toHaveTextContent('£40');
    await expect(canvas.getByText(/CN-0002 \(voided\)/)).toBeInTheDocument();
    // A voided note offers no Void control.
    await expect(
      canvas.queryByRole('button', { name: /Void credit note CN-0002/i })
    ).not.toBeInTheDocument();
  },
};

export const RejectsOverCap: Story = {
  name: 'Refuses more than the invoice can still take',
  args: { creditNotes: [note('cn-1', 'CN-0001', 180, 'ISSUED')] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 199.97 total less 180 issued leaves 19.97.
    await userEvent.type(canvas.getByLabelText('Amount'), '50');
    await userEvent.click(canvas.getByRole('button', { name: /Issue a credit note/i }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(/can still be credited/i);
  },
};

export const FullyCredited: Story = {
  name: 'Fully credited - no form at all',
  args: { creditNotes: [note('cn-1', 'CN-0001', 199.97, 'ISSUED')] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/This invoice is fully credited/i)).toBeInTheDocument();
    await expect(canvas.queryByLabelText('Amount')).not.toBeInTheDocument();
  },
};

export const Busy: Story = {
  name: 'Working',
  args: { busy: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: /Issue a credit note/i })
    ).toBeDisabled();
  },
};

export const ServerRefused: Story = {
  name: 'The server refused it',
  args: { error: 'Invoice cannot accept credit notes.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Invoice cannot accept credit notes.'
    );
  },
};

export const WithoutEditPermission: Story = {
  name: 'Billing edit revoked - ledger visible, no controls',
  decorators: [
    (Story) => {
      seedRole(['billing:edit:any']);
      return (
        <div style={{ maxWidth: 420 }}>
          <Story />
        </div>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('CN-0001')).toBeInTheDocument();
    await expect(canvas.queryByLabelText('Amount')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: /Void credit note CN-0001/i })
    ).not.toBeInTheDocument();
  },
};

export const CancelledInvoice: Story = {
  name: 'Cancelled invoice - ledger readable, no issuing',
  args: { status: 'CANCELLED' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The service rejects CANCELLED and REFUNDED with a 409 whatever the
    // balance, so offering the form would only invite a failing request.
    await expect(canvas.queryByLabelText('Amount')).not.toBeInTheDocument();
    await expect(
      canvas.getByText('A cancelled invoice cannot take a credit note.')
    ).toBeInTheDocument();
    await expect(canvas.getByText('CN-0001')).toBeInTheDocument();
  },
};
