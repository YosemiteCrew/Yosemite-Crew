import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import EstimateList from './EstimateList';
import type { Estimate, EstimateStatus } from '@/app/features/finance/types/estimate';

const NAMES: Record<string, string> = {
  'pat-1': 'Marnie Whitlock',
  'pat-2': 'Rufus Delacroix',
  'pat-3': 'Pepper Osei',
};

const row = (
  id: string,
  patientId: string,
  status: EstimateStatus,
  total: number,
  validUntil: string | null
): Estimate => ({
  id,
  organisationId: 'org-1',
  patientId,
  encounterId: null,
  status,
  validUntil,
  subtotal: total,
  taxAmount: 0,
  total,
  currency: 'GBP',
  notes: null,
  approvedBy: null,
  approvedAt: null,
  declinedAt: null,
  declineReason: null,
  convertedToInvoiceId: status === 'CONVERTED' ? 'inv-1' : null,
  createdBy: null,
  createdAt: '2026-08-28T09:00:00.000Z',
  updatedAt: '2026-08-28T09:00:00.000Z',
  items: [],
});

const meta = {
  title: 'Finance/EstimateList',
  component: EstimateList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The estimates list.\n\n' +
          'The API returns a bare `patientId`, so the companion name is resolved by the caller ' +
          'through the `companion` prop rather than joined server-side. An id with no loaded ' +
          'companion falls back to a readable label instead of printing a uuid at the user.\n\n' +
          '`validUntil` is optional on the model and renders as a dash when absent, which is the ' +
          'common case: nothing in the service ever sets EXPIRED, so an expiry date here is a note ' +
          'to the clinic rather than something the system enforces.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    estimates: [
      row('e1', 'pat-1', 'APPROVED', 199.97, '2026-10-01T00:00:00.000Z'),
      row('e2', 'pat-2', 'DRAFT', 45.5, null),
      row('e3', 'pat-3', 'CONVERTED', 1240.6, '2026-09-15T00:00:00.000Z'),
    ],
    activeEstimateId: 'e1',
    onSelect: () => {},
    companion: (patientId: string) => ({
      name: NAMES[patientId] ?? 'Unknown companion',
      speciesCode: 'dog',
    }),
  },
} satisfies Meta<typeof EstimateList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A row per estimate',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Marnie Whitlock')).toBeInTheDocument();
    // Both decimals survive: 45.5 must not print as "£46".
    await expect(canvas.getByText('£45.50')).toBeInTheDocument();
    await expect(canvas.getByText('£1,240.60')).toBeInTheDocument();
  },
};

export const UnknownCompanion: Story = {
  name: 'A companion that has not loaded',
  args: {
    estimates: [row('e9', 'pat-missing', 'SENT', 88, null)],
    activeEstimateId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Unknown companion')).toBeInTheDocument();
    // No validUntil on this row, so the cell reads as a dash.
    await expect(canvas.getAllByText('-').length).toBeGreaterThan(0);
  },
};

export const SingleRow: Story = {
  name: 'One estimate',
  args: {
    estimates: [row('e1', 'pat-1', 'DRAFT', 12, null)],
    activeEstimateId: null,
  },
};
