import { MAX_ACTIVE_API_KEYS } from '@/app/services/developerApiKeyStatus';
import type { DeveloperPlanTier } from '@/app/services/developerBilling';

export interface BillingPlan {
  key: DeveloperPlanTier;
  name: string;
  price: string;
  priceSub: string;
  description: string;
  features: string[];
  recommended: boolean;
}

/**
 * Marketing copy for the three tiers. Lives beside the card that renders it
 * rather than on the page, since nothing else reads it.
 *
 * The per-call rate and the included allowance are copy, not configuration - the
 * real numbers are the Stripe price's tiers. Keep them in step by hand.
 *
 * The key allowance is the exception: it reads MAX_ACTIVE_API_KEYS rather than
 * a per-tier number, because key issuance does not consult the plan at all. The
 * cards used to advertise one key on Free and unlimited keys on Pro and
 * Enterprise while every owner was held to the same ceiling, so the copy
 * promised an entitlement no tier had and understated the one Free actually
 * gets.
 */
export const PLANS: BillingPlan[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    priceSub: 'forever',
    description: 'Explore the API and build your first integration.',
    features: [
      '1,000 API calls / month',
      `Up to ${MAX_ACTIVE_API_KEYS} active API keys`,
      'Test environment access',
      'Community support',
    ],
    recommended: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'Pay as you go',
    priceSub: 'metered · billed monthly',
    description: 'Scales with your usage — pay only for what you consume.',
    features: [
      '~$0.002 per API call',
      'First 1,000 calls free each month',
      `Up to ${MAX_ACTIVE_API_KEYS} active API keys`,
      'Live + test environments',
      'Priority support',
    ],
    recommended: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    priceSub: 'volume discounts available',
    description: 'For platforms and large teams with predictable high-volume needs.',
    features: [
      'Custom per-call rate',
      `Up to ${MAX_ACTIVE_API_KEYS} active API keys`,
      'Dedicated support',
      'Custom SLA',
      'Usage analytics dashboard',
    ],
    recommended: false,
  },
];
