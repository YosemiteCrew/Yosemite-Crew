import type { Meta, StoryObj } from '@storybook/react';
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
  httpError: 'cs_test_http_error',
} as const;

const OUTCOME_BY_SESSION: Record<string, Outcome | 'pending' | 'http_error'> = {
  [SESSION.loading]: 'pending',
  [SESSION.paid]: 'paid',
  [SESSION.unpaid]: 'unpaid',
  [SESSION.noPayment]: 'no_payment_required',
  [SESSION.httpError]: 'http_error',
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
    if (outcome === 'pending') return NEVER_SETTLES;
    // `ok` is what the lookup checks: fetch resolves on 4xx/5xx, so a stub that
    // omitted it would send every story down the "could not confirm" branch.
    if (outcome === 'http_error') {
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
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

export const Paid: Story = {
  parameters: withSession(SESSION.paid),
  beforeEach: stubStatus,
};

export const Unpaid: Story = {
  parameters: withSession(SESSION.unpaid),
  beforeEach: stubStatus,
};

export const NoPaymentRequired: Story = {
  name: 'No payment required',
  parameters: withSession(SESSION.noPayment),
  beforeEach: stubStatus,
};

export const RequestFailed: Story = {
  name: 'Lookup returned an HTTP error',
  parameters: withSession(SESSION.httpError),
  beforeEach: stubStatus,
};

export const MissingSession: Story = {
  name: 'No session id in the URL',
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/payment-status', query: {} } },
  },
};
