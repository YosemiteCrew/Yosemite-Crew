import type { Meta, StoryObj } from '@storybook/react';

import InsuranceClaimStatusBadge from './InsuranceClaimStatusBadge';

const meta = {
  title: 'InsuranceClaims/InsuranceClaimStatusBadge',
  component: InsuranceClaimStatusBadge,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The claim's lifecycle badge, shown in the claims table and on the claim detail page. It " +
          'is a thin wrapper around `StatusPill`: `claimStatusBadge` resolves the status to the same ' +
          'label and pill-token set the status filter row uses, so the badge and the filter can never ' +
          'read differently for the same status. It has no interaction of its own - moving a claim to ' +
          'a new status happens through the status control on the claim page, not through this badge.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'APPROVED',
        'PARTIALLY_APPROVED',
        'REJECTED',
        'PAID',
        'CANCELLED',
      ],
    },
  },
  args: {
    status: 'SUBMITTED',
  },
} satisfies Meta<typeof InsuranceClaimStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A freshly submitted claim - the most common state in an active claims list. */
export const Default: Story = {};

/** Before submission, using the neutral token shared with other "not yet sent" states. */
export const Draft: Story = { args: { status: 'DRAFT' } };

/** A partial payout decision - its own accent tone, distinct from a full approval. */
export const PartiallyApproved: Story = { args: { status: 'PARTIALLY_APPROVED' } };

/** The claim's successful end state. */
export const Paid: Story = { args: { status: 'PAID' } };

/** The insurer declined the claim - the one danger-toned state on this badge. */
export const Rejected: Story = { args: { status: 'REJECTED' } };

/** Withdrawn by the practice rather than declined by the insurer, so it gets its own tone. */
export const Cancelled: Story = { args: { status: 'CANCELLED' } };
