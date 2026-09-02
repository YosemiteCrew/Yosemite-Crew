import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { ESTIMATE_STATUSES } from '@/app/features/finance/types/estimate';
import EstimateStatusBadge from './EstimateStatusBadge';

const LABELS = ['Draft', 'Sent', 'Approved', 'Declined', 'Expired', 'Converted'];

const meta = {
  title: 'Finance/EstimateStatusBadge',
  component: EstimateStatusBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "An estimate's lifecycle state as a `StatusPill`, fed by `estimateStatusBadge` - " +
          'the one map that also colours the filter row, so the two can never drift apart.\n\n' +
          'The colours follow the invoice pills so the two finance lists read as one family: ' +
          'neutral while the estimate is still in play (Draft), info once sent, progress once ' +
          'approved, success for the terminal happy path (Converted), warning for the two dead ' +
          'ends (Declined, Expired). Nothing in the service ever sets EXPIRED, so that pill is ' +
          'drawn for completeness rather than because a story can reach it in the product.\n\n' +
          'The record is keyed by the status union, so an unmapped status is a type error ' +
          'rather than a runtime branch that renders an empty pill.',
      },
    },
  },
  tags: ['autodocs'],
  args: { status: 'DRAFT' },
} satisfies Meta<typeof EstimateStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Draft: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Draft')).toBeInTheDocument();
  },
};

export const Sent: Story = { args: { status: 'SENT' } };

export const Approved: Story = { args: { status: 'APPROVED' } };

export const Converted: Story = { args: { status: 'CONVERTED' } };

export const Declined: Story = { args: { status: 'DECLINED' } };

export const Expired: Story = { args: { status: 'EXPIRED' } };

/** Every lifecycle state side by side, for a one-glance check of the pill tokens. */
export const EveryStatus: Story = {
  name: 'Every status',
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {ESTIMATE_STATUSES.map((status) => (
        <EstimateStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of LABELS) {
      await expect(canvas.getByText(label)).toBeInTheDocument();
    }
    /* The tokens really differ: a Draft and a Converted pill must not share a
       fill, or the list loses the one glance that tells a quote from an invoice. */
    const fill = (label: string) =>
      getComputedStyle(canvas.getByText(label).closest('span') as HTMLElement).backgroundColor;
    await expect(fill('Draft')).not.toBe(fill('Converted'));
    await expect(fill('Declined')).not.toBe(fill('Approved'));
    // Declined and Expired share the warning tokens on purpose.
    await expect(fill('Declined')).toBe(fill('Expired'));
  },
};

export const Dark: Story = {
  name: 'Dark',
  globals: { theme: 'dark' },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {ESTIMATE_STATUSES.map((status) => (
        <EstimateStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(document.documentElement.dataset.theme).toBe('dark');
    await expect(within(canvasElement).getByText('Converted')).toBeInTheDocument();
  },
};
