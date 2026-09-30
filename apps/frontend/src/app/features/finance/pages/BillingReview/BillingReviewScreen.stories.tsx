import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
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
      invoiceTotal: null,
      currency: null,
      billingStatus: 'MISSING_INVOICE',
    },
    {
      id: 'visit-2',
      appointmentDate: '2026-09-23T14:00:00.000Z',
      patientName: 'Juniper',
      clientName: 'Sam Lee',
      appointmentType: 'Follow-up',
      invoiceId: 'invoice-2',
      invoiceStatus: 'AWAITING_PAYMENT',
      invoiceTotal: 120.5,
      currency: 'GBP',
      billingStatus: 'DRAFT_INVOICE',
    },
    {
      id: 'visit-3',
      appointmentDate: '2026-09-22T09:15:00.000Z',
      patientName: 'Pepper',
      clientName: 'Riya Shah',
      appointmentType: 'Dental clean',
      invoiceId: 'invoice-3',
      invoiceStatus: 'PAID',
      invoiceTotal: 4500,
      currency: 'INR',
      billingStatus: 'UNBILLED_CHARGES',
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

export const CompletedVisits: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Milo')).toBeVisible();
    await expect(canvas.getByTitle('Invoice needed')).toBeVisible();
    await expect(canvas.getByTitle('Invoice in draft')).toBeVisible();
    await expect(canvas.getByTitle('Charges not invoiced')).toBeVisible();
    // Each invoice keeps its own currency; nothing is totalled across visits.
    await expect(canvas.getByText('Invoice awaiting payment · £120.50')).toBeVisible();
    await expect(canvas.getByText('Invoice paid · ₹4,500.00')).toBeVisible();
    await expect(canvas.getByText('No invoice on file')).toBeVisible();
    await expect(canvas.getAllByRole('link', { name: 'Review visit' })[0]).toHaveAttribute(
      'href',
      '/appointments/visit-1/workspace?step=INVOICE'
    );
  },
};

export const Empty: Story = {
  args: { loadPage: async () => ({ items: [], nextCursor: null, hasMore: false }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'You’re caught up' })).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Review visit' })).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { loadPage: () => new Promise<BillingReviewPage>(() => {}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status', { name: 'Loading billing review' })).toBeVisible();
  },
};

export const LoadError: Story = {
  args: { loadPage: async () => Promise.reject(new Error('offline')) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'We could not load the billing review list. Try again.'
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retry loading the billing review list' })
    );
    await expect(await canvas.findByRole('alert')).toBeVisible();
  },
};
