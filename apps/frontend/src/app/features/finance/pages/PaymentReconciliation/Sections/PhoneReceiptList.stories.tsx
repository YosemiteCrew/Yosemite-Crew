import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PhoneReceiptList from './PhoneReceiptList';
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
  allocatedAmount: 0,
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
  receipt({
    id: 'rec-unallocated',
    paymentRef: 'pi_3QhZ2mUnallocated',
    invoiceId: null,
    capturedAt: '2026-09-12T10:41:00.000Z',
  }),
  receipt({
    id: 'rec-partly-refunded',
    paymentRef: 'pi_3QhZ3mPartly',
    amount: 210,
    refundedAmount: 45,
    status: 'PARTIALLY_REFUNDED',
    reason: 'Dental extraction removed from the plan',
    capturedAt: '2026-09-11T16:20:00.000Z',
  }),
  receipt({
    id: 'rec-allocated',
    allocatedAmount: 65,
    paymentRef: 'pi_3QhZ4mAllocated',
    amount: 65,
    status: 'ALLOCATED',
    reason: null,
    capturedAt: '2026-09-11T09:12:00.000Z',
  }),
];

const meta = {
  title: 'Finance/Payment reconciliation/Phone list',
  component: PhoneReceiptList,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/finance/payment-reconciliation' } },
    docs: {
      description: {
        component:
          'The width `/finance/payment-reconciliation` gives this list on a 375px phone.\n\n' +
          'The queue is six columns wide. At phone widths the table clipped everything after the ' +
          'amount - the state, the provider reference, the source and the reason, which is ' +
          'every field an operator needs to decide anything - with no affordance saying so. ' +
          'The card carries the same data stacked, and drops the table dash for a missing ' +
          'reason: a dash keeps a column aligned, and a card has no column.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { receipts: RECEIPTS },
} satisfies Meta<typeof PhoneReceiptList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryState: Story = {
  name: 'Every state, stacked',
  play: async ({ canvasElement }) => {
    const cards = within(
      await within(canvasElement).findByRole('list', {
        name: 'Captured payments and how far each one has been reconciled',
      })
    );
    await expect(cards.getAllByRole('listitem')).toHaveLength(4);
    await expect(cards.getByText('Unattributed')).toBeVisible();
    await expect(cards.getByText('Not linked')).toBeVisible();
    await expect(cards.getByText('£165.00 after £45.00 refunded')).toBeVisible();
    await expect(cards.getByText('pi_3QhZ1mUna...')).toHaveAttribute(
      'title',
      'pi_3QhZ1mUnattributed'
    );
  },
};

export const SingleCapture: Story = {
  name: 'One capture, both sources',
  args: { receipts: [RECEIPTS[2]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('link', { name: 'Open invoice' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open appointment' })).toBeVisible();
  },
};

/**
 * The action, at the width the table cannot reach.
 *
 * It sits on the card rather than in a row of its own and only where the route
 * would accept the capture, so the two rows that cannot take it - the one
 * nobody owns and the one already fully applied - carry no control at all.
 */
export const WithTheAllocateAction: Story = {
  name: 'Apply, on the cards that can take it',
  args: { onAllocate: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = await canvas.findAllByRole('button', { name: /^Apply the payment captured/ });
    await expect(buttons).toHaveLength(2);

    await userEvent.click(buttons[0]);
    await expect(args.onAllocate).toHaveBeenCalled();
  },
};
