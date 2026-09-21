import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { fn } from 'storybook/test';

import ReconciliationTable from './ReconciliationTable';
import type { ProviderReceipt } from '@/app/features/finance/types/providerReceipt';

const receipt = (over: Partial<ProviderReceipt>): ProviderReceipt => ({
  id: 'rec-1',
  provider: 'STRIPE',
  merchantAccountRef: 'acct_harbourside',
  paymentRef: 'pi_3QhZ1mExampleReference',
  organisationId: 'org-1',
  invoiceId: 'inv-7714',
  appointmentId: 'apt-4790',
  amount: 132.5,
  currency: 'GBP',
  capturedAt: '2026-09-12T14:03:00.000Z',
  status: 'UNALLOCATED',
  reason: 'The appointment already has a settled invoice',
  refundedAmount: 0,
  version: 1,
  createdAt: '2026-09-12T14:03:05.000Z',
  ...over,
});

const RECEIPTS: ProviderReceipt[] = [
  receipt({
    id: 'rec-unattributed',
    paymentRef: 'pi_3QhZ1mUnattributed',
    organisationId: null,
    invoiceId: null,
    appointmentId: null,
    amount: 84,
    status: 'UNATTRIBUTED',
    reason: 'No connected account matched the capture',
  }),
  receipt({ id: 'rec-unallocated', paymentRef: 'pi_3QhZ2mUnallocated', invoiceId: null }),
  receipt({
    id: 'rec-partly-refunded',
    paymentRef: 'pi_3QhZ3mPartly',
    amount: 210,
    refundedAmount: 45,
    status: 'PARTIALLY_REFUNDED',
    reason: 'Dental extraction removed from the plan',
  }),
  receipt({
    id: 'rec-allocated',
    paymentRef: 'pi_3QhZ4mAllocated',
    amount: 65,
    status: 'ALLOCATED',
    reason: null,
  }),
];

const meta = {
  title: 'Finance/Payment reconciliation/Table',
  component: ReconciliationTable,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/finance/payment-reconciliation' } },
    docs: {
      description: {
        component:
          'The reconciliation queue itself, as pure props - the four states an operator ' +
          'has to tell apart, side by side.\n\n' +
          'Two readings this table exists to prevent: a partly refunded capture shown at ' +
          'its full captured amount, which makes a reconciliation balance to the wrong ' +
          'number; and an unattributed capture given a source link with nowhere to go. ' +
          'The provider reference is truncated with the whole value on `title`, so nobody ' +
          'copies half a reference without knowing it is half.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    receipts: RECEIPTS,
    loading: false,
    loadingMore: false,
    hasMore: false,
    isFiltered: false,
    onLoadMore: fn(),
  },
} satisfies Meta<typeof ReconciliationTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryState: Story = {
  name: 'Every state side by side',
  play: async ({ canvasElement }) => {
    const table = within(await within(canvasElement).findByRole('table'));
    await expect(table.getByText('Unattributed')).toBeVisible();
    await expect(table.getByText('Unallocated')).toBeVisible();
    await expect(table.getByText('Partly refunded')).toBeVisible();
    await expect(table.getByText('Allocated')).toBeVisible();
    await expect(table.getByText('£165.00 after £45.00 refunded')).toBeVisible();
    await expect(table.getByText('Not linked')).toBeVisible();
    await expect(table.getByText('pi_3QhZ1mUna...')).toHaveAttribute(
      'title',
      'pi_3QhZ1mUnattributed'
    );
  },
};

export const Loading: Story = {
  name: 'Loading the first page',
  args: { receipts: [], loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Loading captured payments...')).toBeVisible();
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
  },
};

export const EmptyQueue: Story = {
  name: 'Nothing captured yet',
  args: { receipts: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No captured payments yet')).toBeVisible();
  },
};

/** A filter matching nothing is a different fact from an empty journal. */
export const EmptyUnderFilter: Story = {
  name: 'Nothing matches these filters',
  args: { receipts: [], isFiltered: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No captured payments match these filters')).toBeVisible();
    await expect(
      canvas.getByText('Widen the date range, or choose a different state.')
    ).toBeVisible();
  },
};

export const MorePages: Story = {
  name: 'More of the queue to read',
  args: { hasMore: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Load more captured payments' }));
    await expect(args.onLoadMore).toHaveBeenCalled();
  },
};

export const LoadingMorePages: Story = {
  name: 'Fetching the next page',
  args: { hasMore: true, loadingMore: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Disabled while in flight, so a second press cannot queue a duplicate page.
    await expect(
      canvas.getByRole('button', { name: 'Load more captured payments' })
    ).toBeDisabled();
  },
};
