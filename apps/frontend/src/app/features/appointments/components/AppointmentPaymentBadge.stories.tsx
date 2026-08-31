import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { Appointment, Invoice } from '@yosemite-crew/types';

import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';

import AppointmentPaymentBadge from './AppointmentPaymentBadge';

const ORG_ID = 'org-storybook';
const APPOINTMENT_ID = 'appt-pay-1';

const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
};

/**
 * `appointmentId` is deliberately the FHIR reference form. `createInvoiceByAppointmentId`
 * runs it through `normalizeAppointmentId`, which strips the `Appointment/` prefix - so
 * an invoice arriving from the FHIR layer keys onto the same bare id the appointment
 * carries. Get that wrong and every badge silently falls through to the no-invoice
 * branch, which reports "Paid". A wrong key does not look like a bug, it looks like
 * a settled clinic - and it is only visible from a state whose label is NOT "Paid",
 * which is why the cash and unpaid stories carry that guard rather than the paid one.
 */
const invoice = (overrides: Partial<Invoice>): Invoice => ({
  id: 'inv-1',
  organisationId: ORG_ID,
  appointmentId: `Appointment/${APPOINTMENT_ID}`,
  items: [{ id: 'line-1', name: 'Annual check-up', quantity: 1, unitPrice: 60, total: 60 }],
  subtotal: 60,
  totalAmount: 60,
  paymentCollectionMethod: 'PAYMENT_INTENT',
  currency: 'USD',
  status: 'PENDING',
  createdAt: new Date('2026-03-12T10:02:00.000Z'),
  updatedAt: new Date('2026-03-12T10:02:00.000Z'),
  ...overrides,
});

/** Settled through Stripe: paid, with a charge id to prove where the money came from. */
const STRIPE_PAID = invoice({
  status: 'PAID',
  stripeChargeId: 'ch_3QstoryPaid',
  paidAt: new Date('2026-03-12T10:15:00.000Z'),
  updatedAt: new Date('2026-03-12T10:15:00.000Z'),
});

/** Issued and still owing. */
const AWAITING = invoice({ status: 'AWAITING_PAYMENT', paymentCollectionMethod: 'PAYMENT_LINK' });

/**
 * Paid at the desk. There is no `cash` flag on an invoice - the state is INFERRED from
 * a paid invoice that carries no Stripe evidence and was not collected by payment link.
 */
const CASH_PAID = invoice({
  status: 'PAID',
  paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
  paidAt: new Date('2026-03-12T10:15:00.000Z'),
  updatedAt: new Date('2026-03-12T10:15:00.000Z'),
});

const mapOf = (...invoices: Invoice[]) => createInvoiceByAppointmentId(invoices);

/** Background + ink as one comparable string, for asserting states are visually distinct. */
const swatch = (el: HTMLElement): string => {
  const style = getComputedStyle(el);
  return `${style.backgroundColor}|${style.color}`;
};

/**
 * The alpha of a computed colour. `0` is what an UNRESOLVED custom property leaves
 * behind: `backgroundColor: var(--color-success-100)` with the token missing is an
 * invalid declaration, the property is dropped, and the computed value comes back
 * `rgba(0, 0, 0, 0)`. The dark tints are legitimately translucent, so alpha has to be
 * compared against zero rather than one.
 */
const alphaOf = (colour: string): number => {
  const parts = (colour.match(/[\d.]+/g) ?? []).map(Number);
  return parts.length === 4 ? parts[3] : 1;
};

const meta = {
  title: 'Appointments/AppointmentPaymentBadge',
  component: AppointmentPaymentBadge,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The payment chip on an appointment board card. It renders a `StatusPill` whose ' +
          'colours come from `getAppointmentPaymentDisplay`, so the component itself has no ' +
          'branches - every state below is a different answer out of that resolver.\n\n' +
          'There are three labels, not four: `PAID`, `UNPAID` and `PAID_CASH`. ' +
          '`PAYMENT_AT_CLINIC` deliberately shares the amber "Unpaid" treatment, because money ' +
          'promised at the desk is money not collected. There is no partial-payment state here ' +
          'at all - a part-settled invoice reads as Unpaid until it clears.\n\n' +
          'The branch worth staring at is the one with NO invoice: unless the appointment is ' +
          '`NO_PAYMENT`, an appointment with nothing in the lookup map reports **Paid**. That ' +
          'makes a broken map indistinguishable from a fully settled clinic, which is why the ' +
          'stories pin the FHIR-reference key normalisation as hard as they pin the colours.\n\n' +
          'Both the fill and the border are set from `badgeBackgroundColor`, so the chip is a ' +
          'solid tint rather than an outlined pill, and `StatusPill` renders the label ' +
          'uppercase - the DOM says "Paid", the screen says "PAID".',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: APPOINTMENT,
    invoicesByAppointmentId: mapOf(STRIPE_PAID),
  },
} satisfies Meta<typeof AppointmentPaymentBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paid: Story = {
  name: 'Paid (settled through Stripe)',
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText('Paid');
    const style = getComputedStyle(badge);

    /* This story cannot prove the lookup worked: a settled invoice and NO invoice at all
       resolve to the same PAID display, so "Paid" here is consistent with the map being
       empty. `PaidInCash` and `Unpaid` are the stories that pin the key normalisation,
       because their labels differ from the fallback. What this one pins is the chip
       itself - fill and border both come from `badgeBackgroundColor`, so it is a solid
       tint. Sourcing the border from the ink instead turns it into an outlined pill. */
    await expect(alphaOf(style.backgroundColor)).toBeGreaterThan(0);
    await expect(style.borderTopColor).toBe(style.backgroundColor);

    // Uppercased by StatusPill, so a text query has to use the DOM casing, not the screen's.
    await expect(style.textTransform).toBe('uppercase');
  },
  parameters: {
    docs: {
      description: {
        story: 'A paid invoice carrying Stripe evidence. The default state on a settled card.',
      },
    },
  },
};

export const Unpaid: Story = {
  name: 'Unpaid (invoice still owing)',
  args: { invoicesByAppointmentId: mapOf(AWAITING) },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText('Unpaid');
    await expect(alphaOf(getComputedStyle(badge).backgroundColor)).toBeGreaterThan(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'An issued, unsettled invoice. `PAYMENT_AT_CLINIC` appointments land on this same ' +
          'amber treatment rather than getting a state of their own.',
      },
    },
  },
};

export const PaidInCash: Story = {
  name: 'Paid in cash (inferred)',
  args: { invoicesByAppointmentId: mapOf(CASH_PAID) },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText('Paid in cash');

    /* This label is the normalisation guard. The fixture's `appointmentId` is the FHIR
       reference `Appointment/appt-pay-1`; if `createInvoiceByAppointmentId` ever stops
       stripping that prefix the lookup misses, the resolver takes the no-invoice branch,
       and the badge reads "Paid" - a cash payment quietly re-reported as a card one. */
    await expect(badge).toBeInTheDocument();

    /* The longest of the three labels, and the one that gets clipped first: `StatusPill`
       is `whitespace-nowrap` with `overflow-hidden`, and the title attribute is the only
       way the full label stays reachable once a narrow board column clamps it. */
    await expect(badge).toHaveAttribute('title', 'Paid in cash');
    await expect(alphaOf(getComputedStyle(badge).backgroundColor)).toBeGreaterThan(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A paid invoice with no Stripe ids and no payment link - the only signal the desk ' +
          'took cash. Nothing on the invoice states it outright.',
      },
    },
  },
};

export const NoMatchingInvoice: Story = {
  name: 'No invoice in the map',
  args: { invoicesByAppointmentId: {} },
  play: async ({ canvasElement }) => {
    /* Not "Unknown", not a dash: an appointment with nothing in the lookup reports PAID.
       That is the resolver's deliberate choice for a clinic that has not raised an
       invoice, but it also means a lookup built with the wrong key silently reports the
       whole board as settled. Pinned here so a change to that default is a red story
       rather than a quiet reassurance. */
    await expect(within(canvasElement).getByText('Paid')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The optimistic fallback. Worth knowing before trusting a green board: absence of ' +
          'an invoice is rendered the same as a settled one.',
      },
    },
  },
};

export const ExplicitStatusWins: Story = {
  name: 'Appointment status overrides the invoice',
  args: {
    appointment: { ...APPOINTMENT, paymentStatus: 'UNPAID' },
    invoicesByAppointmentId: mapOf(STRIPE_PAID),
  },
  play: async ({ canvasElement }) => {
    /* A settled Stripe invoice IS in the map, and the badge still says Unpaid. The
       appointment's own `paymentStatus` is checked before the map is ever consulted, so
       reordering those checks would flip this card without touching the component. */
    await expect(within(canvasElement).getByText('Unpaid')).toBeInTheDocument();
    await expect(within(canvasElement).queryByText('Paid')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same paid invoice as the first story, on an appointment the backend has ' +
          'explicitly marked unpaid. The explicit field wins.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme: three distinct tints',
  globals: { theme: 'dark' },
  render: (args) => (
    <div className="flex items-center gap-3">
      <AppointmentPaymentBadge {...args} invoicesByAppointmentId={mapOf(STRIPE_PAID)} />
      <AppointmentPaymentBadge {...args} invoicesByAppointmentId={mapOf(AWAITING)} />
      <AppointmentPaymentBadge {...args} invoicesByAppointmentId={mapOf(CASH_PAID)} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badges = [
      canvas.getByText('Paid'),
      canvas.getByText('Unpaid'),
      canvas.getByText('Paid in cash'),
    ];

    /* Every dark tint is a fresh `rgba(...)` declaration rather than an inherited light
       value, and each one is a separate token. A dark block that misses one leaves that
       state's `backgroundColor` at `rgba(0, 0, 0, 0)` - an invisible chip that still
       carries its label, so it reads as "no badge" rather than as broken. */
    for (const badge of badges) {
      await expect(alphaOf(getComputedStyle(badge).backgroundColor)).toBeGreaterThan(0);
    }

    /* Three states, three appearances. Colour is the only thing separating them at a
       glance on a board - the labels are 10px - so two states collapsing onto one tint
       is a real regression that no single-state story can see. */
    await expect(new Set(badges.map(swatch)).size).toBe(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'All three states together on the espresso ground, where the tints are translucent ' +
          'rather than flat.',
      },
    },
  },
};
