import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import type { BillingSubscription } from '../types/billing';
import StripeSettingsButton from './StripeSettingsButton';

const ORG_ID = 'org-stripe-settings-story';

const membership = (roleCode: string, roleDisplay: string): UserOrganization => ({
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode,
  roleDisplay,
  active: true,
});

/**
 * Permissions are derived from `roleCode` against the role table rather than
 * read off the stored `effectivePermissions` snapshot, so seeding the role is
 * enough - there is no permission array here to keep in step with the app.
 *
 * OWNER carries both `org:edit` and `subscription:edit:any`, the pair the
 * button asks for.
 */
const OWNER = membership('OWNER', 'Practice owner');

/**
 * ADMIN carries `org:edit` but not `subscription:edit:any`. The check is an
 * `allOf`, so this is the half-match branch - the one a slip to `anyOf` would
 * silently open up, handing Stripe onboarding to every practice administrator.
 */
const ADMIN = membership('ADMIN', 'Practice administrator');

const subscription = (overrides: Partial<BillingSubscription> = {}): BillingSubscription => ({
  orgId: ORG_ID,
  plan: 'free',
  accessState: 'free',
  currency: 'USD',
  subscriptionStatus: 'none',
  connectAccountId: 'acct_story_connect',
  connectChargesEnabled: false,
  connectPayoutsEnabled: false,
  canAcceptPayments: false,
  ...overrides,
});

/**
 * Seeds both stores the button reads through - the org store behind
 * `usePermissions`, the subscription store behind `useSubscriptionForPrimaryOrg`
 * - and restores both on unmount, so a seeded membership or subscription cannot
 * leak into the next story. Nothing here touches the network or Stripe.
 */
const seed = (member: UserOrganization | null, sub: BillingSubscription | null) => {
  return () => {
    const orgSnapshot = useOrgStore.getState();
    const subscriptionSnapshot = useSubscriptionStore.getState();

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      membershipsByOrgId: member ? { [ORG_ID]: member } : {},
      status: 'loaded',
    });
    useSubscriptionStore.setState({
      subscriptionByOrgId: sub ? { [ORG_ID]: sub } : {},
      status: 'loaded',
    });

    return () => {
      useOrgStore.setState(orgSnapshot);
      useSubscriptionStore.setState(subscriptionSnapshot);
    };
  };
};

/**
 * Three of the four branches render `null`, so "nothing on screen" is the whole
 * assertion. The `<h1>` the preview decorator injects is the positive control:
 * without it, a story that never mounted at all would pass this check just as
 * happily as a correctly hidden button.
 */
const expectHidden = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await expect(canvasElement.querySelector('h1')).not.toBeNull();
  await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
  await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
};

const meta = {
  title: 'Billing/StripeSettingsButton',
  component: StripeSettingsButton,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "Settings" pill that sends a practice back into Stripe Connect onboarding. It looks ' +
          'like a bare wrapper around Secondary, but it is really a gate: it renders nothing at all ' +
          'unless the primary organisation has a subscription record, the signed-in membership holds ' +
          '`org:edit` AND `subscription:edit:any`, and Connect charges are still switched off. Three ' +
          'of its four states are therefore an empty canvas, which is exactly why they are worth ' +
          'drawing - a regression here does not look broken, it looks like the button was never ' +
          'there.\n\n' +
          'Both inputs come from zustand rather than props, so these stories seed the org and ' +
          'subscription stores instead of calling Stripe or the billing API.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(OWNER, subscription()),
} satisfies Meta<typeof StripeSettingsButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Eligible: Story = {
  name: 'Eligible, Connect not charging yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: 'Stripe settings' });

    // BaseButton only reaches its <Link> branch for a non-empty href that is not
    // "#". Anything else silently falls through to a <button> that is pixel
    // identical and navigates nowhere, so the tag is the thing worth pinning.
    await expect(link.tagName).toBe('A');

    // The org id is interpolated into the query string. Losing it lands the
    // practice on a stripe-onboarding page with no account to onboard.
    await expect(link).toHaveAttribute('href', `/stripe-onboarding?orgId=${ORG_ID}`);

    // The visible word is only "Settings"; the aria-label is what says WHICH
    // settings. Drop it and a screen reader announces a bare "Settings" link
    // sitting next to every other Settings link in the product.
    await expect(link.textContent).toBe('Settings');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one state that renders. An owner whose Connect account exists but is not yet cleared ' +
          'to take charges gets a link back into onboarding, carrying the organisation id the ' +
          'onboarding page needs.',
      },
    },
  },
};

export const ChargesEnabled: Story = {
  name: 'Connect already charging',
  beforeEach: seed(OWNER, subscription({ connectChargesEnabled: true, canAcceptPayments: true })),
  play: async ({ canvasElement }) => {
    await expectHidden(canvasElement);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Once `connectChargesEnabled` flips true the practice has finished onboarding and the ' +
          'button removes itself. Same owner, same permissions as the eligible story - only the ' +
          'Connect flag differs.',
      },
    },
  },
};

export const MissingPermission: Story = {
  name: 'Admin without subscription:edit:any',
  beforeEach: seed(ADMIN, subscription()),
  play: async ({ canvasElement }) => {
    await expectHidden(canvasElement);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A practice administrator holds `org:edit`, and holds `billing:edit:any` besides, but not ' +
          '`subscription:edit:any`. The gate is an `allOf`, so half the pair hides the button ' +
          'entirely rather than showing a disabled one - moving money is an owner action.',
      },
    },
  },
};

export const NoSubscription: Story = {
  name: 'No subscription record',
  beforeEach: seed(OWNER, null),
  play: async ({ canvasElement }) => {
    await expectHidden(canvasElement);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The bootstrap window: the membership is loaded but the billing round trip has not landed ' +
          'a subscription for the primary organisation yet, so there is no org id to onboard with. ' +
          'A null `primaryOrgId` closes the same gate by the same route - the lookup returns null ' +
          'either way, and the button holds its space open rather than flashing in and out.',
      },
    },
  },
};

export const CustomClassName: Story = {
  name: 'Caller class pass-through',
  args: { className: 'mt-3' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: 'Stripe settings' });

    // Computed, not just present in the attribute: mt-3 is 12px, so this proves
    // the caller's class actually reaches the styled element rather than being
    // concatenated into a string nothing renders. Read off the computed style
    // rather than a bounding box - the wrapper has no padding or border, so the
    // margin collapses through it and both rects report the same top.
    await expect(globalThis.getComputedStyle(link).marginTop).toBe('12px');

    // Appended to the pill classes, never substituted for them. A refactor that
    // preferred `className` over the base string would still pass the offset
    // check above while stripping every border, radius and height.
    await expect(link).toHaveClass('mt-3');
    await expect(link).toHaveClass('min-h-10');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only prop the component takes. It is forwarded to Secondary and lands on the anchor ' +
          'alongside the size and outline classes, which is how a caller nudges the pill into a ' +
          'settings row without wrapping it.',
      },
    },
  },
};
