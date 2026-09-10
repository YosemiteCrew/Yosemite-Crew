import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from 'storybook/test';
import { PaymentStatusContent } from './PaymentStatusContent';

type Outcome = 'paid' | 'unpaid' | 'no_payment_required';

/**
 * Every story routes through ONE stub keyed by session id, rather than each
 * installing a stub that answers with its own outcome.
 *
 * There is a single `globalThis.fetch`, and Autodocs mounts all five variants
 * against it at once. With per-story stubs, whichever mounted last won: the
 * unpaid story re-polls after two seconds, by which point NoPaymentRequired had
 * installed its stub, so a story titled "Unpaid" rendered "Payment cancelled".
 * Teardowns chained the same way and could restore another story's stub instead
 * of the real `fetch`. Keying on the session id makes every installed stub
 * behave identically, so which one is live stops mattering.
 *
 * `pending` never settles, which is how the loading state is held open. `unpaid`
 * resolves normally and reaches the same pulsing dots by a different route, so
 * both are worth a story.
 */
const SESSION = {
  loading: 'cs_test_loading',
  paid: 'cs_test_paid',
  unpaid: 'cs_test_unpaid',
  noPayment: 'cs_test_no_payment',
} as const;

const OUTCOME_BY_SESSION: Record<string, Outcome | 'pending'> = {
  [SESSION.loading]: 'pending',
  [SESSION.paid]: 'paid',
  [SESSION.unpaid]: 'unpaid',
  [SESSION.noPayment]: 'no_payment_required',
};

const NEVER_SETTLES = new Promise<never>(() => {
  // Deliberately empty: the loading state only exists while the request is in
  // flight, so the story has to keep it in flight.
});

const stubStatus = () => {
  const original = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String((input as Request).url ?? input);
    const session = Object.keys(OUTCOME_BY_SESSION).find((id) => url.includes(id));
    // Anything that is not one of this file's sessions - another page's request,
    // or Storybook's own - reaches the real implementation instead of hanging.
    if (!session) return original(input as RequestInfo);

    const outcome = OUTCOME_BY_SESSION[session];
    return outcome === 'pending'
      ? NEVER_SETTLES
      : Promise.resolve({
          json: () => Promise.resolve({ status: outcome, total: 4250 }),
        });
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
  };
};

const withSession = (sessionId: string) => ({
  nextjs: {
    appDirectory: true,
    navigation: { pathname: '/payment-status', query: { session_id: sessionId } },
  },
});

const meta = {
  title: 'Public/PaymentStatus',
  component: PaymentStatusContent,
  parameters: {
    layout: 'fullscreen',
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
  parameters: withSession(SESSION.loading),
  beforeEach: stubStatus,
};

/** The icon circle, however many paths are drawn inside it - the first `<circle>` is always the ring. */
const iconRing = (canvasElement: HTMLElement) =>
  waitFor(() => {
    const el = canvasElement.querySelector('svg circle');
    if (!el) throw new Error('status icon has not rendered yet');
    return el;
  });

export const Paid: Story = {
  parameters: withSession(SESSION.paid),
  beforeEach: stubStatus,
  play: async ({ canvasElement }) => {
    const ring = await iconRing(canvasElement);
    // The app's own success token (#008f5d), not a generic Tailwind green.
    await expect(getComputedStyle(ring).stroke).toBe('rgb(0, 143, 93)');
  },
};

export const PaidDark: Story = {
  name: 'Paid (dark)',
  parameters: withSession(SESSION.paid),
  globals: { theme: 'dark' },
  beforeEach: stubStatus,
  play: async ({ canvasElement }) => {
    const ring = await iconRing(canvasElement);
    // --success itself flips to #2bbd86 in dark; the fixed-light pin on this
    // surface is what keeps the receipt's checkmark at the light value here.
    await expect(getComputedStyle(ring).stroke).toBe('rgb(0, 143, 93)');
  },
};

export const Unpaid: Story = {
  parameters: withSession(SESSION.unpaid),
  beforeEach: stubStatus,
};

export const NoPaymentRequired: Story = {
  name: 'No payment required',
  parameters: withSession(SESSION.noPayment),
  beforeEach: stubStatus,
  play: async ({ canvasElement }) => {
    const ring = await iconRing(canvasElement);
    // The app's own danger token (#ea3729), not Tailwind's red-600 (#dc2626).
    await expect(getComputedStyle(ring).stroke).toBe('rgb(234, 55, 41)');
  },
};

export const MissingSession: Story = {
  name: 'No session id in the URL',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/payment-status', query: {} } },
  },
};
