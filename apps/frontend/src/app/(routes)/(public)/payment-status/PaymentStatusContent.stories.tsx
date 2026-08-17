import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { PaymentStatusContent } from './PaymentStatusContent';

type Outcome = 'paid' | 'unpaid' | 'no_payment_required';

/**
 * The component fetches its own status, so each story stubs `fetch` for the
 * duration of its render. `unpaid` never resolves on purpose - that branch and
 * the loading branch share the pulsing dots, which is the surface this file
 * exists to guard.
 */
const withStubbedStatus = (outcome: Outcome | 'pending') => {
  const Decorator = (Story: React.ComponentType) => {
    const original = globalThis.fetch;
    globalThis.fetch = (() =>
      outcome === 'pending'
        ? new Promise(() => undefined)
        : Promise.resolve({
            json: () => Promise.resolve({ status: outcome, total: 4250 }),
          })) as typeof globalThis.fetch;

    React.useEffect(
      () => () => {
        globalThis.fetch = original;
      },
      [original]
    );

    return <Story />;
  };
  return Decorator;
};

const meta = {
  title: 'Public/PaymentStatus',
  component: PaymentStatusContent,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/payment-status', query: { session_id: 'cs_test_a1b2c3d4e5f6' } },
    },
    docs: {
      description: {
        component:
          'Where Stripe drops the payer after checkout. The card is deliberately a **fixed** ' +
          'light surface in both themes - it is a receipt, and a receipt that inverts under a ' +
          'dark OS setting reads as a different document.\n\n' +
          'That fixity is also the trap. The pulsing dots were painted with ' +
          '`--color-neutral-900`, which follows the theme, so on the pinned white card they ' +
          'resolved to a near-white and measured 1.34:1 in dark - the page looked like it had ' +
          'simply stopped. They use `--ink-fixed` now, which stays #1d1c1b in both themes like ' +
          'the surface under it. Flip the theme toolbar on the loading story to check.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PaymentStatusContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: 'Loading (pulsing dots)',
  decorators: [withStubbedStatus('pending')],
};

export const Paid: Story = {
  decorators: [withStubbedStatus('paid')],
};

export const Unpaid: Story = {
  decorators: [withStubbedStatus('unpaid')],
};

export const NoPaymentRequired: Story = {
  name: 'No payment required',
  decorators: [withStubbedStatus('no_payment_required')],
};

export const MissingSession: Story = {
  name: 'No session id in the URL',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/payment-status', query: {} } },
  },
};
