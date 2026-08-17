import type { Meta, StoryObj } from '@storybook/react';
import { PaymentStatusContent } from './PaymentStatusContent';

type Outcome = 'paid' | 'unpaid' | 'no_payment_required';

/**
 * The component fetches its own status, so each story stubs `fetch` around its
 * render. `pending` is the one that never settles, which is how the loading
 * state is held open; `unpaid` resolves normally and reaches the same pulsing
 * dots by a different route, so both are worth a story.
 *
 * This is a `beforeEach` rather than a decorator. As a decorator the assignment
 * happened during RENDER and the restore in an effect cleanup, so re-rendering
 * a story - flipping the theme toolbar, which the docs above tell the reader to
 * do - installed the new stub and then let the previous cleanup put the real
 * `fetch` back underneath it. The mounted story would then poll the real
 * backend. Autodocs makes it worse by mounting several variants against the one
 * global. Storybook's lifecycle runs setup before the story mounts and the
 * returned teardown after it unmounts, which is the ordering this needs.
 */
const stubStatus = (outcome: Outcome | 'pending') => () => {
  const original = globalThis.fetch;
  const neverSettles = new Promise<never>(() => {
    // Deliberately empty: the loading state only exists while the request is in
    // flight, so the story has to keep it in flight.
  });

  globalThis.fetch = ((input: RequestInfo | URL) => {
    // Scoped to the status lookup. Anything else this page or Storybook itself
    // requests still goes to the real implementation rather than hanging.
    const url = typeof input === 'string' ? input : String((input as Request).url ?? input);
    if (!url.includes('payment-status') && !url.includes('session')) {
      return original(input as RequestInfo);
    }
    return outcome === 'pending'
      ? neverSettles
      : Promise.resolve({
          json: () => Promise.resolve({ status: outcome, total: 4250 }),
        });
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
  };
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
  beforeEach: stubStatus('pending'),
};

export const Paid: Story = {
  beforeEach: stubStatus('paid'),
};

export const Unpaid: Story = {
  beforeEach: stubStatus('unpaid'),
};

export const NoPaymentRequired: Story = {
  name: 'No payment required',
  beforeEach: stubStatus('no_payment_required'),
};

export const MissingSession: Story = {
  name: 'No session id in the URL',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/payment-status', query: {} } },
  },
};
