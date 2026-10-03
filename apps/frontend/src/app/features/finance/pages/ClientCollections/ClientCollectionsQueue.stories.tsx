import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import type { OverdueClientInvoice } from '@/app/features/finance/types/clientCollections';
import ClientCollectionsQueue from './ClientCollectionsQueue';

const invoices: OverdueClientInvoice[] = [
  {
    invoiceId: '10000000-0000-4000-8000-000000000001',
    parentId: 'parent-story-1',
    dueAt: '2026-09-05T22:59:59.999Z',
    dueDate: '2026-09-05',
    currency: 'GBP',
    balance: 145.5,
    netDays: 14,
    reviewedAt: null,
    reviewedBy: null,
  },
  {
    invoiceId: '20000000-0000-4000-8000-000000000002',
    parentId: 'parent-story-2',
    dueAt: '2026-09-11T22:59:59.999Z',
    dueDate: '2026-09-11',
    currency: 'KWD',
    balance: 82.125,
    netDays: 0,
    reviewedAt: '2026-09-18T00:00:00.000Z',
    reviewedBy: 'staff-story-1',
  },
];

const meta = {
  title: 'Finance/Overdue accounts/Queue',
  component: ClientCollectionsQueue,
  args: {
    error: null,
    loading: false,
    groups: [
      { parentId: 'parent-story-1', invoices: [invoices[0]] },
      { parentId: 'parent-story-2', invoices: [invoices[1]] },
    ],
    parentsById: {
      'parent-story-1': { firstName: 'Mara', lastName: 'Jones' },
      'parent-story-2': { firstName: 'Sam', lastName: 'Lee' },
    },
    canEditBilling: true,
    terms: { 'parent-story-1': 14, 'parent-story-2': 0 },
    draftDays: { 'parent-story-1': '14', 'parent-story-2': '0' },
    savingParent: null,
    reviewingInvoice: null,
    onReload: fn(),
    onSaveTerms: fn(),
    onReviewInvoice: fn(),
    onDraftDaysChange: fn(),
  },
} satisfies Meta<typeof ClientCollectionsQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClientBalances: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Mara Jones' })).toBeVisible();
    await expect(canvas.getByText('£145.50')).toBeVisible();
    await expect(canvas.getByText('Due Sep 5, 2026')).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Sam Lee' })).toBeVisible();
    await expect(canvas.getByText('KWD 82.125')).toBeVisible();
    await expect(canvas.getByText(/Reviewed/)).toBeVisible();
  },
};
