import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { CreditNote, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import CreditNoteLedger from './CreditNoteLedger';

const ORG_ID = 'org-storybook-credit-ledger';

/**
 * Seeds the store the gate reads rather than mocking PermissionGate away, so
 * the real gate runs. Every role in ROLE_PERMISSIONS carries `billing:edit:any`,
 * so a read-only billing user only exists through `revokedPermissions` - which
 * is what the read-only story below uses.
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

// Seeded at module scope as well as per-story, so the gate is not resolving on
// the very first paint a play function runs against.
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
  createdAt: new Date(2026, 7, 30, 9, 0),
  updatedAt: new Date(2026, 7, 30, 9, 0),
});

const ISSUED = note('cn-1', 'CN-0001', 40, 'ISSUED', 'Goodwill on the delayed dental');
const VOIDED = note('cn-2', 'CN-0002', 60, 'VOIDED', 'Raised against the wrong invoice');

const meta = {
  title: 'Finance/CreditNoteLedger',
  component: CreditNoteLedger,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Every credit note on an invoice, issued or voided.\n\n' +
          'A voided note keeps its row, struck through, with the marker on its reason line - ' +
          'removing it would hide that a ' +
          'credit was raised and reversed, which is exactly the history a practice needs when ' +
          'reconciling. Only an issued note offers a Void control, and only to a role holding ' +
          '`billing:edit:any`; the ledger itself is readable by anyone who can see the ' +
          'invoice.\n\n' +
          'Voiding asks first. It cannot be undone from here, it moves money back onto what ' +
          'the client owes, and the control is a compact button inches from the amount - so ' +
          'the first click only arms it, swapping Void for a Confirm / Cancel pair on that row ' +
          'alone. The amounts use the shared `formatMoney`, which rounds to whole units, ' +
          'because these rows sit beside the rest of the invoice panel.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      seedRole();
      return (
        <div className="w-full max-w-[420px] rounded-2xl border border-card-border bg-neutral-0 p-4">
          <Story />
        </div>
      );
    },
  ],
  args: {
    notes: [ISSUED, VOIDED],
    currency: 'GBP',
    busy: false,
    onVoid: fn(),
  },
} satisfies Meta<typeof CreditNoteLedger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ledger: Story = {
  name: 'One issued, one voided',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('CN-0001')).toBeInTheDocument();
    await expect(canvas.getByText('Goodwill on the delayed dental')).toBeInTheDocument();
    /* The REASON is the row's lead line and carries the voided marker; the
       credit-note number is the caption beneath it. Asserted the way the row
       reads, because the number and the marker live in different elements. */
    await expect(canvas.getByText('Raised against the wrong invoice (voided)')).toBeInTheDocument();
    await expect(canvas.getByText('CN-0002')).toBeInTheDocument();

    // The voided amount is struck through; the issued one is not.
    await expect(getComputedStyle(canvas.getByText('£60.00')).textDecorationLine).toContain(
      'line-through'
    );
    await expect(getComputedStyle(canvas.getByText('£40.00')).textDecorationLine).not.toContain(
      'line-through'
    );

    // Void is offered on the issued note only.
    await expect(canvas.getByRole('button', { name: 'Void credit note CN-0001' })).toBeEnabled();
    await expect(
      canvas.queryByRole('button', { name: 'Void credit note CN-0002' })
    ).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'Nothing credited yet',
  args: { notes: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Nothing has been credited against this invoice.')
    ).toBeInTheDocument();
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument();
  },
};

export const VoidConfirmation: Story = {
  name: 'Voiding asks first',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Void credit note CN-0001' }));

    // The first click only arms it: Confirm and Cancel replace Void on that row.
    const confirm = canvas.getByRole('button', { name: 'Confirm voiding credit note CN-0001' });
    await expect(confirm).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Keep credit note CN-0001' })
    ).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Void credit note CN-0001' })
    ).not.toBeInTheDocument();
    await expect(args.onVoid).not.toHaveBeenCalled();

    await userEvent.click(confirm);
    // Addressed by note id, not by number - the number is display only.
    await expect(args.onVoid).toHaveBeenCalledWith('cn-1');
    // The pair collapses back to Void once the decision is handed up.
    await expect(
      canvas.getByRole('button', { name: 'Void credit note CN-0001' })
    ).toBeInTheDocument();
  },
};

export const KeepCancels: Story = {
  name: 'Keeping the note cancels the void',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Void credit note CN-0001' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Keep credit note CN-0001' }));
    await expect(args.onVoid).not.toHaveBeenCalled();
    await expect(
      canvas.getByRole('button', { name: 'Void credit note CN-0001' })
    ).toBeInTheDocument();
  },
};

export const Busy: Story = {
  name: 'Working',
  args: { busy: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Void credit note CN-0001' })
    ).toBeDisabled();
  },
};

export const SeveralIssued: Story = {
  name: 'Several issued notes',
  args: {
    notes: [
      ISSUED,
      note('cn-3', 'CN-0003', 15, 'ISSUED'),
      note('cn-4', 'CN-0004', 22.5, 'ISSUED', 'Duplicate charge for nail clip'),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('button', { name: /^Void credit note/ })).toHaveLength(3);
    // A note with no reason keeps a single-line row rather than an empty second line.
    await expect(canvas.getByText('CN-0003')).toBeInTheDocument();
  },
};

export const WithoutEditPermission: Story = {
  name: 'Billing edit revoked - ledger visible, no controls',
  decorators: [
    (Story) => {
      seedRole(['billing:edit:any']);
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('CN-0001')).toBeInTheDocument();
    await expect(canvas.getByText('Raised against the wrong invoice (voided)')).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Void credit note CN-0001' })
    ).not.toBeInTheDocument();
  },
};
