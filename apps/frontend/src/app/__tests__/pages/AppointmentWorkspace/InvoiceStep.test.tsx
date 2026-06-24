import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import InvoiceStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/InvoiceStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import {
  addLineItemsToAppointments,
  createFinanceInvoice,
  findOpenAppointmentInvoice,
  loadAppointmentBilling,
  seedAppointmentInvoice,
} from '@/app/features/billing/services/invoiceService';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';

jest.mock('@/app/features/billing/services/invoiceService', () => ({
  __esModule: true,
  loadAppointmentBilling: jest.fn(),
  seedAppointmentInvoice: jest.fn(),
  findOpenAppointmentInvoice: jest.fn(),
  addLineItemsToAppointments: jest.fn(),
  finalizeFinanceInvoice: jest.fn(),
  getPaymentLink: jest.fn(),
  recordManualInvoicePayment: jest.fn(),
  createFinanceInvoice: jest.fn(),
}));

jest.mock('@/app/features/inventory/services/inventoryService', () => ({
  __esModule: true,
  fetchInventoryItems: jest.fn(),
}));

jest.mock('@/app/features/inventory/pages/Inventory/utils', () => ({
  __esModule: true,
  mapApiItemToInventoryItem: (item: unknown) => item,
  getAvailableStock: () => 10,
}));

const mockLoadAppointmentBilling = loadAppointmentBilling as jest.Mock;
const mockSeedAppointmentInvoice = seedAppointmentInvoice as jest.Mock;
const mockFetchInventoryItems = fetchInventoryItems as jest.Mock;

expect.extend(toHaveNoViolations);

const APPT = 'appt-invoice';

const reset = () => {
  jest.clearAllMocks();
  mockLoadAppointmentBilling.mockResolvedValue({
    pastInvoices: [],
    depositCents: 0,
    invoicedItemNames: [],
  });
  mockFetchInventoryItems.mockResolvedValue([]);
  mockSeedAppointmentInvoice.mockResolvedValue({ id: 'inv-seed' });
  // No open invoice in the store by default → persistCurrentInvoice creates one
  // via the web POST /invoices route (not the mobile /seed route).
  (findOpenAppointmentInvoice as jest.Mock).mockReturnValue(undefined);
  (createFinanceInvoice as jest.Mock).mockResolvedValue({ id: 'inv-created' });
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'INVOICE',
    activeSideAction: null,
  });
  useRevampCatalogStore.setState({
    specialities: [],
    services: [],
    packages: [],
    status: 'idle',
    error: undefined,
    loadedSpecialityIds: [],
  });
  // Reset inventory so each test starts with an empty store; otherwise the
  // bill builder's "load inventory once" guard sees a prior test's items and
  // skips the fetchInventoryItems call this suite asserts on.
  useInventoryStore.setState({ itemsById: {}, itemIdsByOrgId: {} });
};

const seedAndGet = (mode: 'OUTPATIENT' | 'INPATIENT' = 'OUTPATIENT') => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, mode);
  useAppointmentWorkspaceStore.setState((state) => ({
    encountersById: {
      ...state.encountersById,
      [APPT]: {
        ...state.encountersById[APPT],
        depositCents: 120000,
        taxPercent: 7,
        overallDiscountPercent: 5,
        services: [
          {
            id: 'svc-line-bandage',
            refId: 'svc-bandage',
            kind: 'SERVICE',
            name: 'Bandage change',
            qty: 1,
            instructions: 'Change dressing',
            unitPriceCents: 6000,
            amountCents: 6000,
          },
          {
            id: 'svc-line-hospital',
            refId: 'svc-hospital-day',
            kind: 'SERVICE',
            name: 'Hospitalization day charge',
            qty: 1,
            instructions: 'Daily inpatient care',
            unitPriceCents: 12000,
            amountCents: 12000,
          },
        ],
        invoiceLineItems: [
          {
            id: 'inv-1',
            name: 'Initial Consultation',
            unitPriceCents: 10000,
            qty: 1,
            grossCents: 10000,
            discountCents: 1000,
            amountCents: 9000,
          },
          {
            id: 'inv-3',
            name: 'X-Ray Imaging',
            unitPriceCents: 20000,
            qty: 1,
            grossCents: 20000,
            discountCents: 2000,
            amountCents: 18000,
          },
        ],
        pastInvoices: [
          {
            id: '20560DTH',
            createdAt: '2026-04-20T12:00:00Z',
            totalCents: 41500,
            outstandingCents: 0,
            status: 'PAID_FULL',
            byName: 'Rachel Sanders',
            paidByName: 'Rachel Sanders',
            paidAt: '2026-04-20T13:15:00Z',
            paymentMethod: 'CASH',
            paidFromDeposit: true,
            items: [
              {
                id: 'pi-1',
                name: 'Initial Consultation',
                unitPriceCents: 10000,
                qty: 1,
                grossCents: 10000,
                discountCents: 1000,
                amountCents: 9000,
              },
            ],
          },
        ],
      },
    },
  }));
  return useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
};

const getEnc = () => useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;

const renderInvoice = (
  encounter: AppointmentEncounter,
  onOpenSummary = jest.fn(),
  hideBillBuilder = false,
  organisationId?: string
) => {
  render(
    <InvoiceStep
      appointmentId={APPT}
      encounter={encounter}
      organisationId={organisationId}
      hideBillBuilder={hideBillBuilder}
      onOpenSummary={onOpenSummary}
    />
  );
  return { onOpenSummary };
};

describe('InvoiceStep', () => {
  beforeEach(reset);

  it('renders the bill rows, totals and invoices section', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    expect(screen.getByText('Total Bill')).toBeInTheDocument();
    expect(screen.getAllByText('Initial Consultation').length).toBeGreaterThan(0);
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText(/Estimated Total/)).toBeInTheDocument();
  });

  it('shows exclusive-of-tax copy reflecting the backend tax rate', () => {
    renderInvoice(seedAndGet());
    expect(screen.getByText('Exclusive of 7% tax')).toBeInTheDocument();
  });

  it('shows no-tax copy when no tax rate applies', () => {
    const enc = { ...seedAndGet(), taxPercent: 0 } as AppointmentEncounter;
    renderInvoice(enc);
    expect(screen.getByText('No tax applied')).toBeInTheDocument();
  });

  it('adds and removes invoice line items via search', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'bandage' },
    });
    fireEvent.click(screen.getByRole('button', { name: /bandage change/i }));
    expect(getEnc().invoiceLineItems.at(-1)?.name).toBe('Bandage change');

    fireEvent.click(screen.getByRole('button', { name: /remove x-ray imaging/i }));
    expect(getEnc().invoiceLineItems.find((item) => item.name === 'X-Ray Imaging')).toBeUndefined();
  });

  it('uses the dark add button with the current first search match', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'hospital' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add invoice item/i }));

    expect(getEnc().invoiceLineItems.at(-1)?.name).toBe('Hospitalization day charge');
  });

  it('searches active catalog services when treatment has no billable items', async () => {
    useRevampCatalogStore.setState({
      services: [
        {
          id: 'svc-catalog-ultrasound',
          code: 'PR-0001',
          name: 'Ultrasound scan',
          description: 'Abdominal ultrasound',
          type: 'PROCEDURE',
          specialityId: 'spec-1',
          organisationId: 'org-1',
          grossAmount: 85,
          currency: 'USD',
          defaultDiscount: 0,
          maxDiscount: 10,
          durationMinutes: 30,
          isBookable: true,
          isInpatientPreferred: false,
          status: 'ACTIVE',
          createdAt: '2026-06-18T10:00:00.000Z',
        },
      ],
    });
    const enc = { ...seedAndGet(), services: [], prescription: [] };
    renderInvoice(enc, jest.fn(), false, 'org-1');

    // The org-scoped load effects fire on mount; let them settle before asserting.
    await waitFor(() => expect(mockLoadAppointmentBilling).toHaveBeenCalledWith('org-1', APPT));
    await waitFor(() => expect(mockFetchInventoryItems).toHaveBeenCalledWith('org-1'));

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'ultrasound' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ultrasound scan/i }));

    expect(getEnc().invoiceLineItems.at(-1)?.name).toBe('Ultrasound scan');
  });

  it('lists in-house medications and inventory items with a type pill in search', async () => {
    mockFetchInventoryItems.mockResolvedValue([
      {
        id: 'inv-amoxi',
        status: 'ACTIVE',
        basicInfo: { name: 'Amoxicillin 250mg' },
        pricing: { selling: '12' },
      },
    ]);
    const enc = {
      ...seedAndGet(),
      services: [],
      invoiceLineItems: [],
      prescription: [
        {
          id: 'rx-1',
          medicineName: 'Carprofen',
          fulfillment: 'IN_HOUSE' as const,
          priceCents: 1500,
        },
      ],
    } as AppointmentEncounter;
    renderInvoice(enc, jest.fn(), false, 'org-1');

    await waitFor(() => expect(mockFetchInventoryItems).toHaveBeenCalledWith('org-1'));

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'carprofen' },
    });
    const medRow = screen.getByRole('button', { name: /carprofen/i });
    expect(within(medRow).getByText('In-house prescription')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'amoxicillin' },
    });
    const invRow = await screen.findByRole('button', { name: /amoxicillin/i });
    expect(within(invRow).getByText('Stock item')).toBeInTheDocument();
  });

  it('backfills a linked prescription when a billed drug has none', async () => {
    mockFetchInventoryItems.mockResolvedValue([
      {
        id: 'inv-amoxi',
        status: 'ACTIVE',
        basicInfo: { name: 'Amoxicillin 250mg', itemType: 'Drug' },
        classification: {},
        pricing: { selling: '12' },
        stock: { reorderLevel: 5 },
        batch: {},
      },
    ]);
    const enc = {
      ...seedAndGet(),
      services: [],
      invoiceLineItems: [],
      prescription: [],
    } as AppointmentEncounter;
    renderInvoice(enc, jest.fn(), false, 'org-1');
    await waitFor(() => expect(mockFetchInventoryItems).toHaveBeenCalledWith('org-1'));

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'amoxicillin' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /amoxicillin/i }));

    // The billed drug is interlinked into the Treatment step as an in-house
    // prescription row so its clinical details can be required before finalize.
    await waitFor(() =>
      expect(
        getEnc().prescription.some(
          (rx) => rx.medicineName === 'Amoxicillin 250mg' && rx.fulfillment === 'IN_HOUSE'
        )
      ).toBe(true)
    );
  });

  it('backfills a prescription for a drug identified by schedule without an explicit item type', async () => {
    mockFetchInventoryItems.mockResolvedValue([
      {
        id: 'inv-trama',
        status: 'ACTIVE',
        basicInfo: { name: 'Tramadol 50mg', drugSchedule: 'Schedule IV' },
        classification: {},
        pricing: { selling: '8' },
        stock: { reorderLevel: 5 },
        batch: {},
      },
    ]);
    const enc = {
      ...seedAndGet(),
      services: [],
      invoiceLineItems: [],
      prescription: [],
    } as AppointmentEncounter;
    renderInvoice(enc, jest.fn(), false, 'org-1');
    await waitFor(() => expect(mockFetchInventoryItems).toHaveBeenCalledWith('org-1'));

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'tramadol' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /tramadol/i }));

    await waitFor(() =>
      expect(getEnc().prescription.some((rx) => rx.medicineName === 'Tramadol 50mg')).toBe(true)
    );
  });

  it('does not create a prescription when billing a non-drug stock item', async () => {
    mockFetchInventoryItems.mockResolvedValue([
      {
        id: 'inv-gauze',
        status: 'ACTIVE',
        basicInfo: { name: 'Gauze pad' },
        pricing: { selling: '3' },
      },
    ]);
    const enc = {
      ...seedAndGet(),
      services: [],
      invoiceLineItems: [],
      prescription: [],
    } as AppointmentEncounter;
    renderInvoice(enc, jest.fn(), false, 'org-1');
    await waitFor(() => expect(mockFetchInventoryItems).toHaveBeenCalledWith('org-1'));

    fireEvent.change(screen.getByLabelText(/search invoice items/i), {
      target: { value: 'gauze' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /gauze/i }));

    await waitFor(() => expect(getEnc().invoiceLineItems.length).toBeGreaterThan(0));
    expect(getEnc().prescription).toHaveLength(0);
  });

  it('hydrates existing invoices and deposit from finance on mount', async () => {
    mockLoadAppointmentBilling.mockResolvedValue({
      pastInvoices: [
        {
          id: 'finance-inv-99',
          createdAt: '2026-05-02T09:00:00Z',
          totalCents: 7500,
          outstandingCents: 7500,
          status: 'UNPAID',
          items: [],
        },
      ],
      depositCents: 20000,
      invoicedItemNames: [],
    });
    const enc = { ...seedAndGet(), pastInvoices: [] } as AppointmentEncounter;
    renderInvoice(enc, jest.fn(), false, 'org-1');

    await waitFor(() => expect(mockLoadAppointmentBilling).toHaveBeenCalledWith('org-1', APPT));
    await waitFor(() =>
      expect(getEnc().pastInvoices.some((invoice) => invoice.id === 'finance-inv-99')).toBe(true)
    );
    expect(getEnc().depositCents).toBe(20000);
  });

  it('falls back to the organisation catalog currency when the encounter has none', async () => {
    useRevampCatalogStore.setState({
      services: [
        {
          id: 'svc-gbp',
          code: 'PR-0002',
          name: 'Consult GBP',
          description: '',
          type: 'PROCEDURE',
          specialityId: 'spec-1',
          organisationId: 'org-1',
          grossAmount: 50,
          currency: 'GBP',
          defaultDiscount: 0,
          maxDiscount: 0,
          durationMinutes: 15,
          isBookable: true,
          isInpatientPreferred: false,
          status: 'ACTIVE',
          createdAt: '2026-06-18T10:00:00.000Z',
        },
      ],
    });
    const enc = {
      ...seedAndGet(),
      currency: '',
      services: [],
      invoiceLineItems: [],
      prescription: [],
    } as AppointmentEncounter;
    renderInvoice(enc, jest.fn(), false, 'org-1');

    // With no encounter currency yet, totals render in the org's catalog currency
    // (GBP) rather than a hardcoded USD default.
    await waitFor(() => expect(screen.getAllByText(/£/).length).toBeGreaterThan(0));
  });

  it("ignores another organisation's catalog currency on a fresh invoice", async () => {
    // Multi-org session: a different org's GBP service loaded first. The fresh
    // invoice for org-1 must not adopt GBP; it falls back to the USD default.
    useRevampCatalogStore.setState({
      services: [
        {
          id: 'svc-gbp-other',
          code: 'PR-0003',
          name: 'Consult GBP other org',
          description: '',
          type: 'PROCEDURE',
          specialityId: 'spec-2',
          organisationId: 'org-2',
          grossAmount: 50,
          currency: 'GBP',
          defaultDiscount: 0,
          maxDiscount: 0,
          durationMinutes: 15,
          isBookable: true,
          isInpatientPreferred: false,
          status: 'ACTIVE',
          createdAt: '2026-06-18T10:00:00.000Z',
        },
      ],
    });
    const enc = {
      ...seedAndGet(),
      currency: '',
    } as AppointmentEncounter;
    renderInvoice(enc, jest.fn(), false, 'org-1');

    await waitFor(() => expect(screen.getAllByText(/\$/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
  });

  it('does nothing when the dark add button has no current match', () => {
    const enc = seedAndGet();
    const before = getEnc().invoiceLineItems.length;
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /add invoice item/i }));
    expect(getEnc().invoiceLineItems.length).toBe(before);
  });

  it('edits a line quantity and re-derives gross/amount', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    const item = enc.invoiceLineItems.find((i) => i.name === 'X-Ray Imaging')!;
    fireEvent.change(screen.getByLabelText(`Quantity for ${item.name}`), {
      target: { value: '3' },
    });

    const updated = getEnc().invoiceLineItems.find((i) => i.id === item.id)!;
    expect(updated.qty).toBe(3);
    expect(updated.grossCents).toBe(item.unitPriceCents * 3);
    expect(updated.amountCents).toBe(updated.grossCents - updated.discountCents);
  });

  it('clamps an invalid quantity to at least one', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    const item = enc.invoiceLineItems[0];
    fireEvent.change(screen.getByLabelText(`Quantity for ${item.name}`), {
      target: { value: '0' },
    });
    expect(getEnc().invoiceLineItems[0].qty).toBe(1);
  });

  it('edits a line discount (in dollars) and re-derives the amount', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    const item = enc.invoiceLineItems[0];
    fireEvent.change(screen.getByLabelText(`Discount for ${item.name}`), {
      target: { value: '7.5' },
    });

    const updated = getEnc().invoiceLineItems.find((i) => i.id === item.id)!;
    expect(updated.discountCents).toBe(750);
    expect(updated.amountCents).toBe(updated.grossCents - 750);
  });

  it('edits the overall discount percent', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.change(screen.getByLabelText(/overall discount percent/i), {
      target: { value: '12' },
    });
    expect(getEnc().overallDiscountPercent).toBe(12);
  });

  it('toggles deposit withdrawal', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByLabelText(/withdraw from deposit/i));
    expect(getEnc().withdrawDeposit).toBe(true);
  });

  it('records a cash payment as a finalized invoice and clears the bill', async () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /collect cash/i }));

    expect(await screen.findByText(/paid via cash recorded/i)).toBeInTheDocument();
    await waitFor(() => expect(getEnc().invoiceLineItems).toHaveLength(0));
    const newest = getEnc().pastInvoices[0];
    expect(newest.paymentMethod).toBe('CASH');
    expect(newest.status).toBe('PAID_FULL');
    expect(newest.paidByName).toBe('Front desk');
    // Flush the trailing post-payment state update (processing flag/refetch) so
    // it doesn't surface as an act() warning in the next test.
    await act(async () => {});
  });

  it('reuses a server-loaded open invoice instead of creating a duplicate', async () => {
    // The global invoice store has no open invoice (default mock returns
    // undefined), but loadAppointmentBilling hydrated an open invoice into the
    // encounter. The bill must append to that invoice, never create a second one.
    const base = seedAndGet();
    const enc: AppointmentEncounter = {
      ...base,
      pastInvoices: [
        {
          id: 'server-open-inv',
          createdAt: '2026-04-20T12:00:00Z',
          totalCents: 9000,
          outstandingCents: 9000,
          status: 'UNPAID',
          items: [],
        },
      ],
    };
    renderInvoice(enc, jest.fn(), false, 'org-1');

    fireEvent.click(screen.getByRole('button', { name: /collect cash/i }));

    await waitFor(() => expect(addLineItemsToAppointments).toHaveBeenCalled());
    expect(createFinanceInvoice).not.toHaveBeenCalled();
    await act(async () => {});
  });

  it('creates a new invoice when no open invoice exists in the store or server data', async () => {
    // Both the store lookup (default undefined) and the server-loaded
    // pastInvoices (all PAID_FULL with no outstanding balance) lack an open
    // invoice, so the create branch must run.
    const enc = seedAndGet();
    renderInvoice(enc, jest.fn(), false, 'org-1');

    fireEvent.click(screen.getByRole('button', { name: /collect cash/i }));

    await waitFor(() => expect(createFinanceInvoice).toHaveBeenCalled());
    expect(addLineItemsToAppointments).not.toHaveBeenCalled();
    await act(async () => {});
  });

  it('ignores the appointment-id deposit-fallback sentinel when reusing an invoice', async () => {
    // hydrateInvoiceBilling uses appointmentId as the id for an invoice that
    // lacks one; that sentinel must not be treated as a reusable open invoice.
    const base = seedAndGet();
    const enc: AppointmentEncounter = {
      ...base,
      pastInvoices: [
        {
          id: APPT,
          createdAt: '2026-04-20T12:00:00Z',
          totalCents: 9000,
          outstandingCents: 9000,
          status: 'UNPAID',
          items: [],
        },
      ],
    };
    renderInvoice(enc, jest.fn(), false, 'org-1');

    fireEvent.click(screen.getByRole('button', { name: /collect cash/i }));

    await waitFor(() => expect(createFinanceInvoice).toHaveBeenCalled());
    expect(addLineItemsToAppointments).not.toHaveBeenCalled();
    await act(async () => {});
  });

  it('prepares an online payment without marking it paid locally', async () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /pay online/i }));
    expect(await screen.findByText(/invoice prepared for online payment/i)).toBeInTheDocument();
    expect(getEnc().pastInvoices[0].paymentMethod).not.toBe('ONLINE');
    await act(async () => {});
  });

  it('refetches finance after a cash payment so the bill reflects server truth', async () => {
    const enc = seedAndGet();
    // organisationId is required for the post-payment refetch to fire.
    renderInvoice(enc, jest.fn(), false, 'org-1');
    // Ignore the mount-time hydration call; assert the post-payment refetch.
    mockLoadAppointmentBilling.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /collect cash/i }));

    await waitFor(() => expect(mockLoadAppointmentBilling).toHaveBeenCalledWith('org-1', APPT));
    await act(async () => {});
  });

  it('collects a deposit payment and reduces the remaining deposit', async () => {
    const enc = seedAndGet();
    const startDeposit = enc.depositCents;
    renderInvoice(enc);

    fireEvent.click(screen.getAllByRole('button', { name: /collect deposit/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /collect deposit/i }).at(-1)!);

    const after = getEnc();
    expect(after.pastInvoices[0].paymentMethod).toBe('CASH');
    expect(after.depositCents).toBeGreaterThan(startDeposit);
    // Flush the deposit handler's trailing processing-flag update.
    await act(async () => {});
  });

  it('does not record an invoice payment when there are no line items', () => {
    const enc = { ...seedAndGet(), invoiceLineItems: [] };
    const before = getEnc().pastInvoices.length;
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /collect cash/i }));
    expect(getEnc().pastInvoices.length).toBe(before);
  });

  it('allows deposit collection when there are no invoice line items', async () => {
    const enc = { ...seedAndGet(), invoiceLineItems: [] };
    const beforeDeposit = getEnc().depositCents;
    renderInvoice(enc);

    fireEvent.click(screen.getAllByRole('button', { name: /collect deposit/i })[0]);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '25' } });
    fireEvent.click(screen.getAllByRole('button', { name: /collect deposit/i }).at(-1)!);

    expect(getEnc().depositCents).toBe(beforeDeposit + 2500);
    expect(getEnc().pastInvoices[0].paymentMethod).toBe('CASH');
    // Flush the deposit handler's trailing processing-flag update.
    await act(async () => {});
  });

  it('renders the inpatient send-to-client action', async () => {
    const enc = seedAndGet('INPATIENT');
    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /send to client/i }));
    expect(await screen.findByText(/invoice prepared for online payment/i)).toBeInTheDocument();
    await act(async () => {});
  });

  it('omits send-to-client for outpatient encounters', () => {
    const enc = seedAndGet('OUTPATIENT');
    renderInvoice(enc);
    expect(screen.queryByRole('button', { name: /send to client/i })).not.toBeInTheDocument();
  });

  it('expands an invoice to show its breakdown and settled badge', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    // The first invoice is expanded by default.
    expect(screen.getByText('Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Withdrawn from Deposit')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide invoice 20560dth/i }));
    expect(screen.queryByText('Breakdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /view invoice 20560dth/i }));
    expect(screen.getByText('Breakdown')).toBeInTheDocument();
  });

  it('shows the finalized payment stamp for a paid invoice', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    expect(screen.getByText('By Rachel Sanders')).toBeInTheDocument();
    expect(screen.getByText('Paid via Cash')).toBeInTheDocument();
  });

  it('exposes download and share actions while editable', async () => {
    const enc = seedAndGet();
    // Download opens a print window; Share copies to the clipboard. jsdom stubs
    // neither, so provide them and assert the handlers fire.
    const printSpy = jest.fn();
    const openSpy = jest.spyOn(globalThis.window, 'open').mockReturnValue({
      document: { head: {}, body: {}, write: jest.fn(), close: jest.fn() },
      focus: jest.fn(),
      print: printSpy,
    } as unknown as Window);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(globalThis.navigator, { clipboard: { writeText } });

    renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /download invoice 20560dth/i }));
    expect(openSpy).toHaveBeenCalled();
    expect(printSpy).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /share invoice 20560dth/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByText('Invoices')).toBeInTheDocument();

    openSpy.mockRestore();
  });

  it('shows an "Invoice Paid" badge when the invoice was not from deposit', () => {
    const base = seedAndGet();
    const enc = {
      ...base,
      pastInvoices: [{ ...base.pastInvoices[0], paidFromDeposit: false }],
    };
    renderInvoice(enc);
    expect(screen.getByText('Invoice Paid')).toBeInTheDocument();
  });

  describe('completed / read-only encounter', () => {
    it('hides the bill builder and payment controls', () => {
      const enc = { ...seedAndGet(), viewOnly: true };
      renderInvoice(enc);

      expect(screen.queryByText('Total Bill')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /collect cash/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /summary/i })).not.toBeInTheDocument();
      expect(screen.getByText('Invoices')).toBeInTheDocument();
    });

    it('hides the share action but keeps view/download', () => {
      const enc = { ...seedAndGet(), viewOnly: true };
      renderInvoice(enc);

      expect(
        screen.queryByRole('button', { name: /share invoice 20560dth/i })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /download invoice 20560dth/i })
      ).toBeInTheDocument();
    });

    it('shows the empty invoices state when there are none', () => {
      const enc = { ...seedAndGet(), viewOnly: true, pastInvoices: [] };
      renderInvoice(enc);
      expect(screen.getByText('No invoices recorded yet.')).toBeInTheDocument();
    });
  });

  it('shows the empty bill state when no line items are present', () => {
    const enc = { ...seedAndGet(), invoiceLineItems: [] };
    renderInvoice(enc);
    expect(screen.getByText('No invoice line items added yet.')).toBeInTheDocument();
  });

  it('hides the bill builder while keeping past invoices visible for completed appointments', () => {
    const enc = seedAndGet();
    renderInvoice(enc, jest.fn(), true);

    expect(screen.queryByText('Total Bill')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay online/i })).not.toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText(/ID - 20560DTH/i)).toBeInTheDocument();
  });

  it('completes the invoice and opens the summary', () => {
    const enc = seedAndGet();
    const { onOpenSummary } = renderInvoice(enc);

    fireEvent.click(screen.getByRole('button', { name: /summary/i }));

    expect(onOpenSummary).toHaveBeenCalled();
    expect(getEnc().stepStatus.INVOICE).toBe('COMPLETED');
  });

  it('blocks finalize and flags the row when a billed in-house medication is missing details', () => {
    const enc = {
      ...seedAndGet(),
      invoiceLineItems: [
        {
          id: 'inv-rx',
          name: 'Carprofen',
          unitPriceCents: 1500,
          qty: 1,
          grossCents: 1500,
          discountCents: 0,
          amountCents: 1500,
        },
      ],
      prescription: [
        {
          id: 'rx-1',
          medicineName: 'Carprofen',
          fulfillment: 'IN_HOUSE' as const,
          priceCents: 1500,
        },
      ],
    } as AppointmentEncounter;
    const { onOpenSummary } = renderInvoice(enc);

    // Row carries the "fill information" hint, and finalize is blocked.
    expect(screen.getByLabelText('Fill information in previous step')).toBeInTheDocument();
    expect(
      screen.getByText(/fill prescription details in the treatment step/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /summary/i }));
    expect(onOpenSummary).not.toHaveBeenCalled();
    expect(getEnc().stepStatus.INVOICE).not.toBe('COMPLETED');
  });

  it('allows finalize once the billed medication has full prescription details', () => {
    const enc = {
      ...seedAndGet(),
      invoiceLineItems: [
        {
          id: 'inv-rx',
          name: 'Carprofen',
          unitPriceCents: 1500,
          qty: 1,
          grossCents: 1500,
          discountCents: 0,
          amountCents: 1500,
        },
      ],
      prescription: [
        {
          id: 'rx-1',
          medicineName: 'Carprofen',
          fulfillment: 'IN_HOUSE' as const,
          priceCents: 1500,
          dosage: '50mg',
          route: 'Oral',
          frequency: 'BID',
          durationDays: '5',
        },
      ],
    } as AppointmentEncounter;
    const { onOpenSummary } = renderInvoice(enc);

    expect(screen.queryByLabelText('Fill information in previous step')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /summary/i }));
    expect(onOpenSummary).toHaveBeenCalled();
    expect(getEnc().stepStatus.INVOICE).toBe('COMPLETED');
  });

  it('renders the breakdown column headings', () => {
    const enc = seedAndGet();
    renderInvoice(enc);

    const breakdown = screen.getByText('Breakdown').closest('div')!;
    expect(within(breakdown).getAllByText('Gross Amt.').length).toBeGreaterThan(0);
  });

  it('has no axe accessibility violations', async () => {
    const enc = seedAndGet();
    const { container } = render(
      <InvoiceStep appointmentId={APPT} encounter={enc} onOpenSummary={jest.fn()} />
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  // Bug 9: saved Treatment items (Services/Packages + in-house prescriptions) are
  // auto-added to the Total Bill so they can be billed/paid without re-adding by search.
  describe('auto-seeds saved treatment items into the Total Bill', () => {
    // Subscribe to the store so an auto-seed write (or a manual remove) re-renders
    // the step with the fresh encounter, matching production.
    const StoreBoundInvoice = ({ organisationId }: { organisationId?: string }) => {
      const encounter = useAppointmentWorkspaceStore((s) => s.encountersById[APPT]);
      return (
        <InvoiceStep
          appointmentId={APPT}
          encounter={encounter as AppointmentEncounter}
          organisationId={organisationId}
          onOpenSummary={jest.fn()}
        />
      );
    };

    const seedFor = (overrides: Partial<AppointmentEncounter>) => {
      seedAndGet();
      useAppointmentWorkspaceStore.setState((state) => ({
        encountersById: {
          ...state.encountersById,
          [APPT]: {
            ...state.encountersById[APPT],
            services: [],
            prescription: [],
            invoiceLineItems: [],
            pastInvoices: [],
            ...overrides,
          },
        },
      }));
    };

    it('preserves qty and unit price (lossless map, not qty 1)', async () => {
      seedFor({
        services: [
          {
            id: 's1',
            refId: 'r1',
            kind: 'SERVICE',
            name: 'Ultrasound',
            qty: 3,
            unitPriceCents: 500,
            amountCents: 1500,
          },
        ],
      });
      render(<StoreBoundInvoice organisationId="org-1" />);

      await waitFor(() =>
        expect(getEnc().invoiceLineItems.some((i) => i.name === 'Ultrasound')).toBe(true)
      );
      const line = getEnc().invoiceLineItems.find((i) => i.name === 'Ultrasound')!;
      expect(line.unitPriceCents).toBe(500);
      expect(line.qty).toBe(3);
      expect(line.grossCents).toBe(1500);
      expect(line.amountCents).toBe(1500);
    });

    it('does not double-add a service already on the bill (name dedup)', async () => {
      seedFor({
        services: [
          {
            id: 's1',
            refId: 'r1',
            kind: 'SERVICE',
            name: 'Bandage change',
            qty: 1,
            unitPriceCents: 6000,
            amountCents: 6000,
          },
        ],
        invoiceLineItems: [
          {
            id: 'inv-x',
            name: 'Bandage change',
            unitPriceCents: 6000,
            qty: 1,
            grossCents: 6000,
            discountCents: 0,
            amountCents: 6000,
          },
        ],
      });
      render(<StoreBoundInvoice organisationId="org-1" />);

      await waitFor(() => expect(mockLoadAppointmentBilling).toHaveBeenCalled());
      await waitFor(() =>
        expect(getEnc().invoiceLineItems.filter((i) => i.name === 'Bandage change')).toHaveLength(1)
      );
    });

    it('excludes already-billed services', async () => {
      seedFor({
        services: [
          {
            id: 's1',
            refId: 'r1',
            kind: 'SERVICE',
            name: 'Old service',
            qty: 1,
            unitPriceCents: 3000,
            amountCents: 3000,
            billed: true,
          },
          {
            id: 's2',
            refId: 'r2',
            kind: 'SERVICE',
            name: 'New service',
            qty: 1,
            unitPriceCents: 4000,
            amountCents: 4000,
          },
        ],
      });
      render(<StoreBoundInvoice organisationId="org-1" />);

      await waitFor(() =>
        expect(getEnc().invoiceLineItems.some((i) => i.name === 'New service')).toBe(true)
      );
      expect(getEnc().invoiceLineItems.some((i) => i.name === 'Old service')).toBe(false);
    });

    it('seeds priced in-house prescriptions only (not prescription-only or zero-price)', async () => {
      seedFor({
        prescription: [
          { id: 'p1', medicineName: 'Amoxicillin', fulfillment: 'IN_HOUSE', priceCents: 800 },
          {
            id: 'p2',
            medicineName: 'Take-home Rx',
            fulfillment: 'PRESCRIPTION_ONLY',
            priceCents: 900,
          },
          { id: 'p3', medicineName: 'Zero price', fulfillment: 'IN_HOUSE', priceCents: 0 },
        ],
      });
      render(<StoreBoundInvoice organisationId="org-1" />);

      await waitFor(() =>
        expect(getEnc().invoiceLineItems.some((i) => i.name === 'Amoxicillin')).toBe(true)
      );
      const names = getEnc().invoiceLineItems.map((i) => i.name);
      expect(names).not.toContain('Take-home Rx');
      expect(names).not.toContain('Zero price');
    });

    it('does not re-seed a line the clinician removed', async () => {
      seedFor({
        services: [
          {
            id: 's1',
            refId: 'r1',
            kind: 'SERVICE',
            name: 'Removable',
            qty: 1,
            unitPriceCents: 1000,
            amountCents: 1000,
          },
        ],
      });
      render(<StoreBoundInvoice organisationId="org-1" />);

      await waitFor(() =>
        expect(getEnc().invoiceLineItems.some((i) => i.name === 'Removable')).toBe(true)
      );
      const id = getEnc().invoiceLineItems.find((i) => i.name === 'Removable')!.id;
      act(() => {
        useAppointmentWorkspaceStore.getState().removeInvoiceLineItem(APPT, id);
      });
      // The re-render must not snap the removed line back in.
      await waitFor(() =>
        expect(getEnc().invoiceLineItems.some((i) => i.name === 'Removable')).toBe(false)
      );
    });
  });
});
