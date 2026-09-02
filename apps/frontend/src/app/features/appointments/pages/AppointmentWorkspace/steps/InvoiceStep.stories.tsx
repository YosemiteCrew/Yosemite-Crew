import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';

import type {
  AppointmentEncounter,
  InvoiceLineItem,
  PastInvoice,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import InvoiceStep from './InvoiceStep';

const APPOINTMENT_ID = 'appt-invoice-step-1';
const LEAD = { id: 'prac-amara', name: 'Dr. Amara Weber' };

const READY = { value: true, byName: LEAD.name, at: '2026-03-12T11:04:00.000Z' };

const encounter = (over: Partial<AppointmentEncounter> = {}): AppointmentEncounter => ({
  appointmentId: APPOINTMENT_ID,
  mode: 'OUTPATIENT',
  consultationType: 'Outpatient consult',
  leadId: LEAD.id,
  leadName: LEAD.name,
  alerts: [],
  soap: [],
  soapTemplates: [],
  vitals: [],
  observations: [],
  diagnosticTests: [],
  diagnosticOrders: [],
  services: [],
  prescription: [],
  schedule: [],
  invoiceLineItems: [],
  pastInvoices: [],
  depositCents: 0,
  currency: 'USD',
  withdrawDeposit: false,
  taxPercent: 0,
  overallDiscountPercent: 0,
  dischargeSummary: '',
  documents: [],
  readyForBilling: READY,
  readyForDischarge: { value: false },
  stepStatus: {
    SOAP: 'COMPLETED',
    DIAGNOSTICS: 'COMPLETED',
    TREATMENT: 'COMPLETED',
    PASSPORT: 'EMPTY',
    INVOICE: 'IN_PROGRESS',
    SUMMARY: 'EMPTY',
  },
  viewOnly: false,
  ...over,
});

const line = (
  id: string,
  name: string,
  unitPriceCents: number,
  qty = 1,
  discountCents = 0
): InvoiceLineItem => ({
  id,
  name,
  unitPriceCents,
  qty,
  grossCents: unitPriceCents * qty,
  discountCents,
  amountCents: unitPriceCents * qty - discountCents,
});

const CONSULT = line('line-consult', 'Consultation - 30 min', 9_000);
const AMOXICILLIN = line('line-amox', 'Amoxicillin 250 mg', 3_800);
/** A line-level discount: 10% off the dental, which the total has to subtract. */
const DENTAL = line('line-dental', 'Dental scale and polish', 24_000, 1, 2_400);

/** $90 + $38 + ($240 - $24) = $344, no tax. */
const BILL_LINES = [CONSULT, AMOXICILLIN, DENTAL];

/**
 * A billed in-house medicine with none of its prescribing detail filled in. The
 * bill line and the prescription share a name, which is the match
 * `computeIncompleteMedicationNames` runs on.
 */
const UNFINISHED_AMOXICILLIN: PrescriptionItem = {
  id: 'rx-amox',
  medicineName: 'Amoxicillin 250 mg',
  fulfillment: 'IN_HOUSE',
  priceCents: 3_800,
};

const SETTLED: PastInvoice = {
  id: 'inv-2026-0416',
  createdAt: '2026-03-12T09:42:00.000Z',
  totalCents: 28_450,
  outstandingCents: 0,
  status: 'PAID_FULL',
  paidByName: 'Jonah Pike',
  paidAt: '2026-03-12T10:05:00.000Z',
  paymentMethod: 'CASH',
  items: [
    {
      id: 'past-consult',
      name: 'Consultation - 30 min',
      unitPriceCents: 9_000,
      qty: 1,
      grossCents: 9_000,
      discountCents: 0,
      amountCents: 9_000,
    },
    {
      id: 'past-package',
      name: 'Senior wellness package',
      unitPriceCents: 22_000,
      qty: 1,
      grossCents: 22_000,
      discountCents: 2_550,
      amountCents: 19_450,
    },
  ],
  payments: [
    {
      id: 'pay-1',
      amountCents: 28_450,
      method: 'CASH',
      provider: 'Front desk',
      status: 'succeeded',
      paidAt: '2026-03-12T10:05:00.000Z',
    },
  ],
};

const OUTSTANDING: PastInvoice = {
  id: 'inv-2026-0417',
  createdAt: '2026-03-12T14:18:00.000Z',
  totalCents: 15_600,
  outstandingCents: 7_800,
  status: 'PARTIAL',
  items: [
    {
      id: 'past-amox',
      name: 'Amoxicillin 250 mg',
      unitPriceCents: 1_200,
      qty: 8,
      grossCents: 9_600,
      discountCents: 0,
      amountCents: 9_600,
    },
    {
      id: 'past-dental',
      name: 'Dental scale and polish',
      unitPriceCents: 6_000,
      qty: 1,
      grossCents: 6_000,
      discountCents: 0,
      amountCents: 6_000,
    },
  ],
};

/**
 * Every backend call this step makes is gated on `organisationId` - the catalog
 * and inventory loads, the discount-cap read, the billing hydration and the
 * package-breakdown hydration all return at their first line without one. So
 * the stories leave the prop undefined and mount the real step with no service
 * stubbed anywhere. The stores are still cleared: a story that ran earlier in
 * the same tab would otherwise leak its catalog or invoices into this one.
 */
const resetStores = () => {
  const workspace = useAppointmentWorkspaceStore.getState();
  const invoices = useInvoiceStore.getState();
  const org = useOrgStore.getState();
  const inventory = useInventoryStore.getState();
  const catalog = useRevampCatalogStore.getState();

  useAppointmentWorkspaceStore.setState({ encountersById: {} });
  useInvoiceStore.setState({ invoicesById: {}, invoiceIdsByOrgId: {} });
  useOrgStore.setState({ primaryOrgId: null });
  useInventoryStore.setState({ itemsById: {}, itemIdsByOrgId: {} });
  useRevampCatalogStore.setState({
    specialities: [],
    services: [],
    packages: [],
    loadedSpecialityIds: [],
  });

  return () => {
    useRevampCatalogStore.setState(catalog);
    useInventoryStore.setState(inventory);
    useOrgStore.setState(org);
    useInvoiceStore.setState(invoices);
    useAppointmentWorkspaceStore.setState(workspace);
  };
};

const paymentRegion = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('region', { name: 'Payment method' });

const meta = {
  title: 'Workspace/InvoiceStep',
  component: InvoiceStep,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Invoice step of the appointment workspace: the Total Bill builder on the left, ' +
          'the payment-method card and its confirmation / error lines in a 340px aside, the ' +
          'past-invoices list underneath, and the Summary action that closes the step.\n\n' +
          'Three gates decide what the aside offers, and none of them is a prop. **Collect** ' +
          'is disabled until the visit is marked ready for billing, and the reason is only ' +
          'stated in a hover bubble around the button. **Send to Client** exists for ' +
          'inpatients only. **Summary** is refused while a billed in-house medicine still ' +
          'lacks its prescribing detail - the bill line and the prescription are matched by ' +
          'name, and the warning above the button is the only place that says so.\n\n' +
          'The figure on the Collect button is `computeInvoiceTotalCents`: gross less line ' +
          'discounts less the overall discount, plus tax, and less the deposit only when ' +
          '`withdrawDeposit` is on. A view-only encounter drops the builder and the aside ' +
          'entirely and shows the finalized invoices alone, without Share.\n\n' +
          'Every request the step can make is gated on `organisationId`, so the stories leave ' +
          'it undefined and render the real step offline. The invoice rows, the breakdown ' +
          'panel and the deposit / payment-progress dialogs have their own stories under ' +
          'Appointments/InvoicesSection and Workspace.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointmentId: APPOINTMENT_ID,
    encounter: encounter({ invoiceLineItems: BILL_LINES }),
    onOpenSummary: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-[720px] bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: resetStores,
} satisfies Meta<typeof InvoiceStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyToCollect: Story = {
  name: 'Ready for billing',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The three lines are on the bill.
    await expect(canvas.getAllByText(/Consultation - 30 min/).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText(/Amoxicillin 250 mg/).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText(/Dental scale and polish/).length).toBeGreaterThan(0);

    const payment = within(paymentRegion(canvasElement));
    await expect(payment.getByRole('button', { name: 'Online' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    /* $344: the dental discount is subtracted, nothing else is. A button reading
       $368 means the line discount was dropped; $304 means the package default
       discount was applied twice. */
    const collect = payment.getByRole('button', { name: 'Collect $344' });
    await expect(collect).toBeEnabled();
    // Ready, so no reason bubble wraps the button.
    await expect(collect.closest('.glass-tooltip')).toBeNull();
    // Outpatient: no Send to Client.
    await expect(payment.queryByRole('button', { name: 'Send to Client' })).not.toBeInTheDocument();

    await expect(canvas.getByText('No invoices recorded yet.')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Summary' })).toBeEnabled();
  },
};

export const NotReadyForBilling: Story = {
  name: 'Not yet ready for billing',
  args: {
    encounter: encounter({ invoiceLineItems: BILL_LINES, readyForBilling: { value: false } }),
  },
  play: async ({ canvasElement }) => {
    const payment = within(paymentRegion(canvasElement));
    const collect = payment.getByRole('button', { name: 'Collect $344' });
    await expect(collect).toBeDisabled();
    /* The reason lives in a GlassTooltip wrapper that only exists in this state;
       the button itself looks the same as the enabled one at 50% opacity. */
    await expect(collect.closest('.glass-tooltip')).not.toBeNull();
    // Being unready is not a reason to stop building the bill or closing the step.
    await expect(within(canvasElement).getByRole('button', { name: 'Summary' })).toBeEnabled();
  },
};

export const Inpatient: Story = {
  name: 'Inpatient: send to client',
  args: {
    encounter: encounter({
      mode: 'INPATIENT',
      consultationType: 'Inpatient stay',
      invoiceLineItems: BILL_LINES,
    }),
  },
  play: async ({ canvasElement }) => {
    const payment = within(paymentRegion(canvasElement));
    await expect(payment.getByRole('button', { name: 'Send to Client' })).toBeEnabled();
    await expect(payment.getByRole('button', { name: 'Collect $344' })).toBeEnabled();
  },
};

export const DepositApplied: Story = {
  name: 'Deposit withdrawn against the bill',
  args: {
    encounter: encounter({
      invoiceLineItems: BILL_LINES,
      depositCents: 5_000,
      withdrawDeposit: true,
    }),
  },
  play: async ({ canvasElement }) => {
    const payment = within(paymentRegion(canvasElement));
    // $344 less the $50 deposit. The Deposit segment stays selectable.
    await expect(payment.getByRole('button', { name: 'Collect $294' })).toBeEnabled();
    await expect(payment.getByRole('button', { name: 'Deposit' })).toBeEnabled();
  },
};

export const IncompleteMedication: Story = {
  name: 'Summary refused: unfinished prescription',
  args: {
    encounter: encounter({
      invoiceLineItems: [CONSULT, AMOXICILLIN],
      prescription: [UNFINISHED_AMOXICILLIN],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Fill prescription details in the Treatment step before finalizing.')
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Summary' })).toBeDisabled();
    // Collecting is still allowed - only closing the step is held.
    await expect(
      within(paymentRegion(canvasElement)).getByRole('button', { name: 'Collect $128' })
    ).toBeEnabled();
  },
};

export const WithPastInvoices: Story = {
  name: 'Past invoices listed',
  args: {
    encounter: encounter({ invoiceLineItems: BILL_LINES, pastInvoices: [SETTLED, OUTSTANDING] }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The first row opens expanded, so the settled composition is on screen at once.
    await expect(canvas.getByText('Invoice Paid')).toBeInTheDocument();
    await expect(canvas.getByText('Senior wellness package')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'View invoice inv-2026-0417' })).toBeVisible();
    // Settled and editable: Download and Share both offered on the paid row.
    await expect(
      canvas.getByRole('button', { name: 'Download invoice inv-2026-0416' })
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Share invoice inv-2026-0416' })).toBeVisible();
    await expect(canvas.queryByText('No invoices recorded yet.')).not.toBeInTheDocument();
  },
};

export const ViewOnly: Story = {
  name: 'View-only encounter',
  args: {
    encounter: encounter({
      viewOnly: true,
      invoiceLineItems: BILL_LINES,
      pastInvoices: [SETTLED],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The builder and the aside are gone, not disabled: a closed encounter shows
       the finalized invoices and nothing that could add to them. */
    await expect(canvas.queryByRole('region', { name: 'Payment method' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Summary' })).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Download invoice inv-2026-0416' })
    ).toBeVisible();
    // Share is gated on settled AND editable, so it disappears rather than disabling.
    await expect(
      canvas.queryByRole('button', { name: 'Share invoice inv-2026-0416' })
    ).not.toBeInTheDocument();
  },
};

export const BillBuilderHidden: Story = {
  name: 'Bill builder hidden',
  args: {
    encounter: encounter({ invoiceLineItems: BILL_LINES, pastInvoices: [OUTSTANDING] }),
    hideBillBuilder: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('region', { name: 'Payment method' })).not.toBeInTheDocument();
    // The step can still be closed and the invoices are still listed.
    await expect(canvas.getByRole('button', { name: 'Summary' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Hide invoice inv-2026-0417' })).toBeVisible();
  },
};

export const Phone: Story = {
  name: 'Phone: aside stacks under the bill',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const payment = paymentRegion(canvasElement);
    const bill = canvas.getAllByText(/Consultation - 30 min/)[0];
    // Below `lg` the flex row collapses: the payment card starts under the bill.
    await expect(payment.getBoundingClientRect().top).toBeGreaterThan(
      bill.getBoundingClientRect().bottom
    );
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
