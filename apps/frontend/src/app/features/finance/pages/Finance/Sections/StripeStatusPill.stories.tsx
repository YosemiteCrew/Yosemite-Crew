import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import type { BillingSubscription } from '@/app/features/billing/types/billing';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import StripeStatusPill from './StripeStatusPill';

const ORG_ID = 'org-avenger-park';
const OTHER_ORG_ID = 'org-riverside-referrals';

const membership = (roleCode: string, extraPermissions: string[] = []): UserOrganization => ({
  practitionerReference: 'Practitioner/pract-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode,
  extraPermissions,
});

const subscription = (overrides: Partial<BillingSubscription> = {}): BillingSubscription => ({
  orgId: ORG_ID,
  connectAccountId: 'acct_1QexampleStripe',
  connectChargesEnabled: true,
  connectPayoutsEnabled: true,
  canAcceptPayments: true,
  ...overrides,
});

/**
 * A second, fully connected organisation that is never the primary one. It is in
 * every story so the pill has something wrong to pick up: the component reads the
 * subscription for `primaryOrgId` alone, and a lookup that grabbed the first entry
 * in the map would send the practice to another organisation's Stripe onboarding.
 */
const DECOY: BillingSubscription = {
  orgId: OTHER_ORG_ID,
  connectAccountId: 'acct_1QdecoyStripe',
  connectChargesEnabled: true,
  canAcceptPayments: true,
};

/**
 * Both stores are plain Zustand and neither fetches on read, so seeding them is
 * the whole of the setup - no hook is mocked and the component under review is
 * the real one. The previous state is restored on unmount so a story that seeds a
 * connected org cannot leak a Stripe account into the next one.
 */
const seed =
  (options: {
    primaryOrgId?: string | null;
    membership?: UserOrganization | null;
    subscription?: BillingSubscription | null;
  }) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const billingSnapshot = useSubscriptionStore.getState();

    useOrgStore.setState({
      primaryOrgId: options.primaryOrgId ?? null,
      status: 'loaded',
      membershipsByOrgId: options.membership ? { [ORG_ID]: options.membership } : {},
    });
    useSubscriptionStore.setState({
      status: 'loaded',
      subscriptionByOrgId: options.subscription
        ? { [ORG_ID]: options.subscription, [OTHER_ORG_ID]: DECOY }
        : { [OTHER_ORG_ID]: DECOY },
    });

    return () => {
      useOrgStore.setState(orgSnapshot);
      useSubscriptionStore.setState(billingSnapshot);
    };
  };

/** The header slot the pill lives in, so an empty render is still something to assert on. */
const slot = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByTestId('finance-header-slot');

const meta = {
  title: 'Finance/StripeStatusPill',
  component: StripeStatusPill,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Stripe indicator in the finance header. It takes no props at all: everything it ' +
          'renders is derived from the org store and the billing store, and it has three distinct ' +
          'outcomes that no other surface shows.\n\n' +
          '**Nothing.** Until `connectChargesEnabled` is true the pill renders `null` and stays out ' +
          'of the way of the page\'s own "Connect Stripe account" banner, which owns the ' +
          'not-connected state. Same for an organisation whose subscription has not loaded.\n\n' +
          '**A static pill.** Connected, but the viewer holds neither `org:edit` nor ' +
          '`subscription:edit:any`: "Stripe · connected", with no link. The state is still worth ' +
          'seeing - a receptionist should know card payments are live - it is just not theirs to ' +
          'change.\n\n' +
          '**A linked pill.** Connected and manageable: the same badge wrapped in an anchor to ' +
          '`/stripe-onboarding?orgId=…` for the PRIMARY org, labelled "Stripe settings" so the ' +
          'middot in the visible text is never read out.\n\n' +
          'The permission test is `allOf`, not `anyOf`: half the pair grants nothing.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        data-testid="finance-header-slot"
        className="flex items-center justify-end gap-2 min-h-[38px]"
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StripeStatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Manageable: Story = {
  name: 'Connected, and the viewer can manage it',
  beforeEach: seed({
    primaryOrgId: ORG_ID,
    membership: membership('OWNER'),
    subscription: subscription(),
  }),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Stripe settings' });

    /* The primary org's id, not the decoy's. This href is the only thing carrying the
       org through to onboarding, and Stripe onboarding for the wrong organisation is
       a silent, damaging success rather than an error. */
    await expect(link).toHaveAttribute('href', `/stripe-onboarding?orgId=${ORG_ID}`);
    await expect(link.getAttribute('href')).not.toContain(OTHER_ORG_ID);

    /* The accessible name comes from the aria-label and deliberately differs from the
       visible text: read literally, "Stripe · settings" announces the middot. */
    await expect(link).toHaveTextContent('Stripe · settings');

    // A 38px row target for a badge that is only ~21px tall on its own.
    await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(38);

    /* The live dot is decorative and must stay out of the accessible name - "green
       circle Stripe settings" is what an unlabelled span would produce. */
    const badge = link.querySelector('.yc-status-pill') as HTMLElement;
    const dot = badge.firstElementChild as HTMLElement;
    await expect(dot).toHaveAttribute('aria-hidden', 'true');
    await expect(Math.round(dot.getBoundingClientRect().height)).toBe(6);
  },
};

export const ConnectedReadOnly: Story = {
  name: 'Connected, but not the viewer to manage',
  beforeEach: seed({
    primaryOrgId: ORG_ID,
    membership: membership('VETERINARIAN'),
    subscription: subscription(),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Same connected state, different wrapper: the badge is there and the link is
       gone. Hiding the pill outright would leave a vet unable to tell whether the
       clinic can take a card payment at all. */
    await expect(canvas.getByText('Stripe · connected')).toBeInTheDocument();
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Stripe · settings')).not.toBeInTheDocument();
  },
};

export const HalfPermitted: Story = {
  name: 'One of the two permissions is not enough',
  beforeEach: seed({
    primaryOrgId: ORG_ID,
    membership: membership('VETERINARIAN', [PERMISSIONS.ORG_EDIT]),
    subscription: subscription(),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `org:edit` without `subscription:edit:any`. The check is `allOf`, so this is
       still the static pill - and this is the story that would catch an `allOf` that
       had been relaxed to `anyOf`, which every other story here would pass unchanged. */
    await expect(canvas.getByText('Stripe · connected')).toBeInTheDocument();
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
  },
};

export const ChargesDisabled: Story = {
  name: 'Onboarded but charges not enabled yet',
  beforeEach: seed({
    primaryOrgId: ORG_ID,
    membership: membership('OWNER'),
    subscription: subscription({ connectChargesEnabled: false, canAcceptPayments: false }),
  }),
  play: async ({ canvasElement }) => {
    /* A Connect account exists and the viewer is an owner, and the pill still renders
       nothing: charges are what matter, not onboarding having been started. The page's
       own "Connect Stripe account" banner covers this state, so a pill here would
       contradict it on the same screen. Asserted on the slot's children, because
       "no text" would also pass against a component that rendered an empty wrapper. */
    await expect(slot(canvasElement).children).toHaveLength(0);
  },
};

export const NoSubscription: Story = {
  name: 'Before billing has loaded',
  beforeEach: seed({
    primaryOrgId: ORG_ID,
    membership: membership('OWNER'),
    subscription: null,
  }),
  play: async ({ canvasElement }) => {
    /* The billing store holds a connected subscription - for another organisation.
       The primary org has no row yet, which is also what a mid-hydration store looks
       like, and the pill renders nothing rather than borrowing the neighbour's. */
    /* Scoped to the slot, never to the canvas: the preview decorator injects an
       sr-only `<h1>` carrying the story's own title, so a canvas-wide "no /Stripe/"
       assertion matches "Finance/StripeStatusPill - Before billing has loaded" and
       fails on a component that rendered exactly nothing. */
    await expect(slot(canvasElement).children).toHaveLength(0);
    await expect(slot(canvasElement)).toHaveTextContent('');
  },
};
