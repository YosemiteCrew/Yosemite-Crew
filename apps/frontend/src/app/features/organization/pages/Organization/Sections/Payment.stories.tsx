import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { BillingSubscription } from '@/app/features/billing/types/billing';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import Payment from './Payment';

const ORG_ID = 'org-storybook-payment';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
};

const membershipAs = (
  roleCode: UserOrganization['roleCode'],
  roleDisplay: string
): UserOrganization => ({
  id: `membership-${roleCode}`,
  practitionerReference: 'Practitioner/vet-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode,
  roleDisplay,
  active: true,
});

/* Real role codes, resolved through the shipped role table rather than a stub
   permission array - the three roles below are exactly the three outcomes this
   card has:
     OWNER        subscription:view:any + org:edit + subscription:edit:any -> link
     ADMIN        subscription:view:any + org:edit, no subscription:edit:any -> no link
     RECEPTIONIST no subscription:view:any at all                           -> Fallback
   ADMIN is the one worth knowing about: it holds org:edit, so the `allOf` pair is
   what withholds the link, not a missing org permission. */
const OWNER = membershipAs('OWNER', 'Owner');
const ADMIN = membershipAs('ADMIN', 'Administrator');
const RECEPTIONIST = membershipAs('RECEPTIONIST', 'Receptionist');

const subscription = (over: Partial<BillingSubscription> = {}): BillingSubscription => ({
  orgId: ORG_ID,
  connectAccountId: 'acct_storybook',
  plan: 'business',
  currency: 'EUR',
  ...over,
});

type Fixture = {
  membership?: UserOrganization;
  sub?: BillingSubscription | null;
};

/**
 * Seeds both stores the card reads: the org store answers `usePermissions`
 * (through `membershipsByOrgId`, not through a stored permission list) and the
 * subscription store answers `useSubscriptionForPrimaryOrg`, which is keyed on
 * `primaryOrgId`. `status: 'loaded'` matters as much as the membership - a store
 * left `idle` makes `PermissionGate` report `isLoading` and render its skeleton,
 * which here is `null`, so the whole card silently disappears.
 */
const seed =
  ({ membership = OWNER, sub = subscription({ connectChargesEnabled: true }) }: Fixture = {}) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const subSnapshot = useSubscriptionStore.getState();

    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership },
      status: 'loaded',
    });
    useSubscriptionStore.setState({
      subscriptionByOrgId: sub ? { [ORG_ID]: sub } : {},
      status: 'loaded',
    });

    return () => {
      useOrgStore.setState(orgSnapshot);
      useSubscriptionStore.setState(subSnapshot);
    };
  };

/** The card root: the status text sits in the middle span, whose parent is the row. */
const cardOf = (canvas: ReturnType<typeof within>): HTMLElement =>
  canvas.getByText('Payments · Stripe').parentElement?.parentElement as HTMLElement;

/** The 6px state dot - the first child of the span that also holds the status text. */
const dotOf = (statusLine: HTMLElement): HTMLElement => statusLine.firstElementChild as HTMLElement;

const meta = {
  title: 'Organization/Payment',
  component: Payment,
  parameters: {
    layout: 'padded',
    // `next/link` for the Manage href, and `Fallback` reaches `useRouter` for its
    // request-access route - without the app router the denied story throws.
    nextjs: { appDirectory: true, navigation: { pathname: '/organization' } },
    docs: {
      description: {
        component:
          'The Stripe row on the organization page. One line of copy, one optional link, and ' +
          'four outcomes behind them - none of which any other story in the repo draws.\n\n' +
          '`resolveStatus` reads the two Connect flags in order: charges enabled decides ' +
          '**connected**, and payouts only refines the wording ("Charges enabled · payouts ' +
          'weekly" against "Charges enabled"). An account that can pay out but cannot take ' +
          'charges is reported as not connected, which is right - it cannot be sold through.\n\n' +
          'Two independent permission checks then decide how much of the row exists. ' +
          '`subscription:view:any` gates the whole card through a `PermissionGate` whose ' +
          'fallback is the inline permission notice; `org:edit` **and** ' +
          '`subscription:edit:any` together gate the Manage/Connect link. An ADMIN holds the ' +
          'first of that pair and not the second, so the read-only card is a real, shipping ' +
          'state rather than a hypothetical.\n\n' +
          'The link also needs `subscription.orgId`, so an org with no subscription record at ' +
          'all shows "Not connected yet" with no way to connect - see that story.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: seed(),
} satisfies Meta<typeof Payment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ChargesAndPayouts: Story = {
  name: 'Connected, payouts enabled',
  beforeEach: seed({
    sub: subscription({
      connectChargesEnabled: true,
      connectPayoutsEnabled: true,
      canAcceptPayments: true,
    }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const statusLine = canvas.getByText('Charges enabled · payouts weekly');
    const link = canvas.getByRole('link', { name: 'Manage' });
    await expect(link).toHaveAttribute('href', `/stripe-onboarding?orgId=${ORG_ID}`);

    /* Both glyphs are aria-hidden, so the status reaches a screen reader as the
       sentence alone. The dot is the one that matters: it carries connected-ness
       in colour only, and announcing an unlabelled bullet would be worse than
       silence. */
    await expect(dotOf(statusLine)).toHaveAttribute('aria-hidden', 'true');
    await expect(cardOf(canvas).querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    /* Measured, because both are `flex-none` next to a `flex-1 min-w-0` middle
       column: drop either and the icon tile squashes to an oval and the dot to a
       sliver, which reads as a rendering glitch rather than as a layout bug. */
    const tile = cardOf(canvas).firstElementChild as HTMLElement;
    const tileBox = tile.getBoundingClientRect();
    await expect(tileBox.width).toBe(36);
    await expect(tileBox.height).toBe(36);
    const dotBox = dotOf(statusLine).getBoundingClientRect();
    await expect(dotBox.width).toBe(6);
    await expect(dotBox.height).toBe(6);

    // The link stays inside the card at the far end rather than being pushed out
    // by the middle column.
    await expect(link.getBoundingClientRect().right).toBeLessThanOrEqual(
      cardOf(canvas).getBoundingClientRect().right
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The healthy account. "payouts weekly" is copy, not data - nothing here reads a ' +
          'payout schedule off Stripe, so an account on a monthly schedule is described wrongly.',
      },
    },
  },
};

export const ChargesOnly: Story = {
  name: 'Connected, payouts not enabled yet',
  beforeEach: seed({
    sub: subscription({ connectChargesEnabled: true, connectPayoutsEnabled: false }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Charges alone is still connected: the account can take money, and the link
       stays "Manage" rather than reverting to "Connect". Payouts only shorten the
       sentence. */
    await expect(canvas.getByText('Charges enabled')).toBeInTheDocument();
    await expect(canvas.queryByText('Charges enabled · payouts weekly')).toBeNull();
    await expect(canvas.getByRole('link', { name: 'Manage' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The usual state a few minutes after onboarding: Stripe has enabled charges while ' +
          'payouts wait on verification. There is no third tone for it - the dot is the same ' +
          'green as a fully live account.',
      },
    },
  },
};

export const NotConnected: Story = {
  name: 'Not connected (Connect)',
  beforeEach: seed({
    sub: subscription({ connectChargesEnabled: false, connectPayoutsEnabled: false }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Not connected yet')).toBeInTheDocument();

    /* The link is the same element with different copy, not a second control, and
       it points at the same route - so a check for "is Stripe set up" that keys on
       the link's presence would be wrong in both directions. */
    const link = canvas.getByRole('link', { name: 'Connect' });
    await expect(link).toHaveAttribute('href', `/stripe-onboarding?orgId=${ORG_ID}`);
    await expect(canvas.queryByRole('link', { name: 'Manage' })).toBeNull();
    await expect(canvas.getAllByRole('link')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A subscription record exists but Connect onboarding has not finished. The dot drops ' +
          'to `--ink-faint2` and stops pulsing, which is the only difference in the row besides ' +
          'the two words.',
      },
    },
  },
};

export const NoSubscriptionRecord: Story = {
  name: 'No subscription record: no way to connect',
  beforeEach: seed({ sub: null }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* An OWNER, holding every permission, and still no link: the href needs
       `subscription.orgId`, and with no record `useSubscriptionForPrimaryOrg`
       returns null. The row reads exactly like the story above but is a dead end.
       Worth knowing before treating "Not connected yet" as an actionable state. */
    await expect(canvas.getByText('Not connected yet')).toBeInTheDocument();
    await expect(canvas.queryAllByRole('link')).toHaveLength(0);
    await expect(canvas.getByText('Payments · Stripe')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The record is normally created by `checkStatus` on load, so this is the gap between ' +
          'first paint and that response - and the permanent state if the call fails. The card ' +
          'cannot fall back to the org id it already has, because the link is built from the ' +
          'subscription rather than from the org.',
      },
    },
  },
};

export const ViewerCannotManage: Story = {
  name: 'Admin: can see it, cannot manage it',
  beforeEach: seed({
    membership: ADMIN,
    sub: subscription({ connectChargesEnabled: true, connectPayoutsEnabled: true }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* ADMIN passes the view gate and holds `org:edit`, so the card renders in
       full and only the link is withheld - the `allOf` pair is what fails, on
       `subscription:edit:any` alone. A regression that loosened the pair to
       `anyOf` would put a Manage link in front of every admin, and this is the
       only story that would catch it. */
    await expect(canvas.getByText('Charges enabled · payouts weekly')).toBeInTheDocument();
    await expect(canvas.queryAllByRole('link')).toHaveLength(0);
    await expect(canvas.queryByRole('status')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The read-only card. There is no explanation of why the link is missing - it is ' +
          'simply absent, which is the right call for a row this small, but it does mean an ' +
          'admin has nothing to click and nothing to read about it.',
      },
    },
  },
};

export const WithoutViewPermission: Story = {
  name: 'Receptionist: permission notice instead',
  beforeEach: seed({ membership: RECEPTIONIST }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The card is gone entirely - not greyed out, not empty.
    await expect(canvas.queryByText('Payments · Stripe')).toBeNull();
    await expect(canvas.queryAllByRole('link')).toHaveLength(0);

    /* What replaces it is the inline `Fallback`, rendered as an `<output>` for its
       implicit status role. The notice quotes the caller's real `roleDisplay` and
       the resource passed by this component, so the whole sentence is asserted:
       a role that failed to resolve degrades to "your current role" and every
       partial assertion would still pass. */
    const notice = canvas.getByRole('status');
    await expect(notice.textContent).toBe(
      "Your role (Receptionist) can't view billing and subscription. Request access"
    );
    await expect(within(notice).getByRole('button', { name: 'Request access' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The permission branch, which nothing else documents. `Fallback` is the compact ' +
          'variant of `PermissionDeniedState`; the full centered card would swamp a row this ' +
          'size. There is deliberately no loading story: `PermissionGate` renders its skeleton ' +
          'while the org store is `idle` or `loading`, and this caller passes no skeleton, so ' +
          'the mid-hydration state is an empty page rather than anything to look at.',
      },
    },
  },
};
