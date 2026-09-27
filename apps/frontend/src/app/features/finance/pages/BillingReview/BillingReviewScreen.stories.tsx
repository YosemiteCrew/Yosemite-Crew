import type { Meta, StoryObj } from '@storybook/react';
import { BillingReviewContent } from './BillingReviewScreen';
import type { BillingReviewPage } from '@/app/features/finance/types/billingReview';

const page: BillingReviewPage = {
  items: [
    {
      id: 'visit-1',
      appointmentDate: '2026-09-24T10:30:00.000Z',
      patientName: 'Milo',
      clientName: 'Alex Morgan',
      appointmentType: 'Wellness exam',
      invoiceId: null,
      invoiceStatus: null,
      billingStatus: 'MISSING_INVOICE',
    },
    {
      id: 'visit-2',
      appointmentDate: '2026-09-23T14:00:00.000Z',
      patientName: 'Juniper',
      clientName: 'Sam Lee',
      appointmentType: 'Follow-up',
      invoiceId: 'invoice-2',
      invoiceStatus: 'PENDING',
      billingStatus: 'DRAFT_INVOICE',
    },
    {
      id: 'visit-3',
      appointmentDate: '2026-09-22T09:15:00.000Z',
      patientName: 'Juniper',
      clientName: 'Sam Lee',
      appointmentType: 'Follow-up',
      invoiceId: 'invoice-3',
      invoiceStatus: 'OPEN',
      billingStatus: 'READY_FOR_BILLING',
    },
  ],
  nextCursor: null,
  hasMore: false,
};

const meta = {
  title: 'Finance/BillingReview',
  component: BillingReviewContent,
  args: {
    organisationId: 'demo-practice',
    loadPage: async () => page,
  },
} satisfies Meta<typeof BillingReviewContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompletedVisits: Story = {};

export const Empty: Story = {
  args: { loadPage: async () => ({ items: [], nextCursor: null, hasMore: false }) },
};

export const Loading: Story = {
  args: { loadPage: () => new Promise<BillingReviewPage>(() => {}) },
};

export const LoadError: Story = {
  args: { loadPage: async () => Promise.reject(new Error('offline')) },
};
