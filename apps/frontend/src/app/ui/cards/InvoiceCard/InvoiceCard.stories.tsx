import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { Appointment, Invoice } from '@yosemite-crew/types';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import InvoiceCard from './index';

const ORG_ID = 'org-1';
const APPOINTMENT_ID = 'appointment-1';

const patient: Appointment['patient'] = {
  id: 'companion-1',
  name: 'Kizie',
  species: 'Dog',
  breed: 'Beagle',
  parent: { id: 'parent-1', name: 'Sky Doe' },
};

const appointment: Appointment = {
  id: APPOINTMENT_ID,
  organisationId: ORG_ID,
  patient,
  companion: patient,
  appointmentDate: new Date('2026-08-12T09:30:00.000Z'),
  startTime: new Date('2026-08-12T09:30:00.000Z'),
  endTime: new Date('2026-08-12T10:00:00.000Z'),
  timeSlot: '09:30 AM',
  durationMinutes: 30,
  status: 'COMPLETED',
};

/**
 * The card takes the invoice as a prop but resolves the companion and parent names
 * itself, out of the appointment store, from `invoice.appointmentId` alone. Both
 * stores are plain Zustand stores with no provider and no fetch on read, so seeding
 * them in `beforeEach` — outside any React render — is the whole of the setup, and
 * every story below shares one seed.
 */
const seedStores = () => {
  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  useAppointmentStore.getState().setAppointmentsForOrg(ORG_ID, [appointment]);
};

const baseInvoice: Invoice = {
  id: 'a1b2c3d4e5f60718293a4b5c',
  organisationId: ORG_ID,
  appointmentId: APPOINTMENT_ID,
  items: [
    { name: 'General consultation', quantity: 1, unitPrice: 60, total: 60 },
    { name: 'Rabies vaccination', quantity: 1, unitPrice: 35, total: 35 },
  ],
  subtotal: 95,
  discountTotal: 10,
  taxTotal: 7.65,
  totalAmount: 92.65,
  paymentCollectionMethod: 'PAYMENT_INTENT',
  currency: 'USD',
  status: 'PAID',
  createdAt: new Date('2026-08-12T10:15:00.000Z'),
  updatedAt: new Date('2026-08-12T10:15:00.000Z'),
};

const meta = {
  title: 'Cards/InvoiceCard',
  component: InvoiceCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The phone and tablet form of one finance table row. Every money figure is run through ' +
          '`formatMoney` with the org currency, so a card cannot print a bare number in one place ' +
          'and a formatted one in another. Status is the shared `StatusPill`, toned by ' +
          '`getInvoiceStatusTone`, and the card closes with a full-width Secondary "View".',
      },
    },
  },
  tags: ['autodocs'],
  args: { invoice: baseInvoice, handleViewInvoice: fn() },
  beforeEach: seedStores,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 340 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paid: Story = {};

export const AwaitingPayment: Story = {
  name: 'Awaiting payment (payment link)',
  args: {
    invoice: {
      ...baseInvoice,
      id: 'b2c3d4e5f60718293a4b5c6d',
      status: 'AWAITING_PAYMENT',
      paymentCollectionMethod: 'PAYMENT_LINK',
      discountTotal: 0,
      taxTotal: 0,
      totalAmount: 95,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'The info-toned pill, and a zero discount and tax — those two rows always render, so ' +
          'this is the layout most invoices actually have.',
      },
    },
  },
};

export const Unlinked: Story = {
  name: 'No linked appointment',
  args: {
    invoice: {
      ...baseInvoice,
      id: 'c3d4e5f60718293a4b5c6d7e',
      appointmentId: undefined,
      status: 'CANCELLED',
      items: [
        {
          name: 'Prescription diet — renal support, 4kg bag',
          quantity: 2,
          unitPrice: 48,
          total: 96,
        },
        { name: 'Dispensing fee', quantity: 1, unitPrice: 5, total: 5 },
      ],
      subtotal: 101,
      discountTotal: 0,
      taxTotal: 8.08,
      totalAmount: 109.08,
      paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'An over-the-counter sale: with no `appointmentId` there is no companion or parent to ' +
          'look up, so the name line is blank and the parent falls back to `-` rather than to an ' +
          'id. The long service list is also the wrapping case for the Service row.',
      },
    },
  },
};
