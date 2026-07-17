import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  buildBillableItems,
  collectSeededBillNames,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/invoiceStepUtils';
import type {
  AppointmentEncounter,
  InvoiceLineItem,
  PastInvoice,
} from '@/app/features/appointments/types/workspace';
import type { ServiceRevamp } from '@/app/features/organization/types/revamp';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-icons/lu', () => ({
  LuArrowRight: () => <span data-testid="icon-arrow-right" />,
  LuBanknote: () => <span data-testid="icon-banknote" />,
  LuCheck: () => <span data-testid="icon-check" />,
  LuCreditCard: () => <span data-testid="icon-credit-card" />,
  LuDownload: () => <span data-testid="icon-download" />,
  LuEye: () => <span data-testid="icon-eye" />,
  LuEyeOff: () => <span data-testid="icon-eye-off" />,
  LuShare: () => <span data-testid="icon-share" />,
  LuUpload: () => <span data-testid="icon-upload" />,
}));

jest.mock(
  '@/app/features/appointments/pages/AppointmentWorkspace/components/TotalBillContainer',
  () => ({
    __esModule: true,
    default: ({
      items,
      onAddItem,
      onRemoveItem,
      onToggleWithdrawDeposit,
      onChangeOverallDiscount,
      onUpdateItem,
    }: {
      items: InvoiceLineItem[];
      onAddItem: (item: Omit<InvoiceLineItem, 'id'>) => void;
      onRemoveItem: (id: string) => void;
      onToggleWithdrawDeposit?: (value: boolean) => void;
      onChangeOverallDiscount?: (percent: number) => void;
      onUpdateItem?: (id: string, patch: Partial<InvoiceLineItem>) => void;
    }) => (
      <div data-testid="total-bill-container">
        <span>Bill lines: {items.length}</span>
        <button type="button" onClick={() => onToggleWithdrawDeposit?.(true)}>
          Toggle withdraw deposit
        </button>
        <button type="button" onClick={() => onChangeOverallDiscount?.(10)}>
          Set overall discount
        </button>
        <button type="button" onClick={() => items[0] && onUpdateItem?.(items[0].id, { qty: 2 })}>
          Bump first qty
        </button>
        <button
          type="button"
          onClick={() =>
            onAddItem({
              name: 'Manual add',
              unitPriceCents: 500,
              qty: 1,
              grossCents: 500,
              discountCents: 0,
              amountCents: 500,
            })
          }
        >
          Add manual item
        </button>
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onRemoveItem(item.id)}>
            Remove {item.name}
          </button>
        ))}
      </div>
    ),
  })
);

const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

const invoiceServiceMock = {
  createFinanceInvoice: jest.fn(),
  finalizeFinanceInvoice: jest.fn(),
  getPaymentLink: jest.fn(),
  loadAppointmentBilling: jest.fn(),
  recordManualInvoicePayment: jest.fn(),
  sendInvoiceToClient: jest.fn(),
  findOpenAppointmentInvoice: jest.fn(),
  addLineItemsToAppointments: jest.fn(),
};
jest.mock('@/app/features/billing/services/invoiceService', () => ({
  createFinanceInvoice: (...args: unknown[]) => invoiceServiceMock.createFinanceInvoice(...args),
  finalizeFinanceInvoice: (...args: unknown[]) =>
    invoiceServiceMock.finalizeFinanceInvoice(...args),
  getPaymentLink: (...args: unknown[]) => invoiceServiceMock.getPaymentLink(...args),
  loadAppointmentBilling: (...args: unknown[]) =>
    invoiceServiceMock.loadAppointmentBilling(...args),
  recordManualInvoicePayment: (...args: unknown[]) =>
    invoiceServiceMock.recordManualInvoicePayment(...args),
  sendInvoiceToClient: (...args: unknown[]) => invoiceServiceMock.sendInvoiceToClient(...args),
  findOpenAppointmentInvoice: (...args: unknown[]) =>
    invoiceServiceMock.findOpenAppointmentInvoice(...args),
  addLineItemsToAppointments: (...args: unknown[]) =>
    invoiceServiceMock.addLineItemsToAppointments(...args),
}));

const clinicalServiceMock = {
  deletePrescriptionArtifact: jest.fn(),
  savePrescriptionArtifact: jest.fn(),
};
jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  deletePrescriptionArtifact: (...args: unknown[]) =>
    clinicalServiceMock.deletePrescriptionArtifact(...args),
  savePrescriptionArtifact: (...args: unknown[]) =>
    clinicalServiceMock.savePrescriptionArtifact(...args),
}));

jest.mock('@/app/features/inventory/services/inventoryService', () => ({
  fetchInventoryItems: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/app/features/inventory/pages/Inventory/utils', () => ({
  mapApiItemToInventoryItem: (item: unknown) => item,
  getAvailableStock: () => undefined,
}));

const workspaceStoreMock = {
  setWithdrawDeposit: jest.fn(),
  setOverallDiscountPercent: jest.fn(),
  addInvoiceLineItem: jest.fn(),
  addPrescription: jest.fn(),
  updateInvoiceLineItem: jest.fn(),
  removeInvoiceLineItem: jest.fn(),
  removePrescription: jest.fn(),
  recordInvoicePayment: jest.fn(),
  recordDepositCollection: jest.fn(),
  hydrateInvoiceBilling: jest.fn(),
  setStepStatus: jest.fn(),
};
jest.mock('@/app/stores/appointmentWorkspaceStore', () => ({
  useAppointmentWorkspaceStore: jest.fn(),
}));

const catalogStoreState = {
  services: [] as ServiceRevamp[],
  packages: [] as unknown[],
  loadOrganisationCatalog: jest.fn().mockResolvedValue(undefined),
  hydratePackageDetail: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn(),
}));

const inventoryStoreState = {
  itemIdsByOrgId: {} as Record<string, string[]>,
  itemsById: {} as Record<string, unknown>,
  setInventoryForOrg: jest.fn(),
};
jest.mock('@/app/stores/inventoryStore', () => ({
  useInventoryStore: jest.fn(),
}));

import InvoiceStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/InvoiceStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';

const invoiceLine = (name: string): InvoiceLineItem => ({
  id: `invoice-${name}`,
  name,
  unitPriceCents: 1000,
  qty: 1,
  grossCents: 1000,
  discountCents: 0,
  amountCents: 1000,
});

const service = (name: string, overrides: Partial<ServiceRevamp> = {}): ServiceRevamp => ({
  id: `svc-${name}`,
  code: `SVC-${name}`,
  name,
  description: name,
  type: 'CONSULTATION',
  specialityId: 'spec-1',
  organisationId: 'org-1',
  grossAmount: 25,
  defaultDiscount: 0,
  maxDiscount: 0,
  durationMinutes: 30,
  isBookable: true,
  isInpatientPreferred: false,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const encounter = (invoiceLineItems: InvoiceLineItem[]): AppointmentEncounter =>
  ({
    services: [],
    prescription: [],
    invoiceLineItems,
  }) as unknown as AppointmentEncounter;

const pastInvoice = (status: PastInvoice['status'], itemNames: string[]): PastInvoice =>
  ({
    id: `inv-${status}-${itemNames.join('-')}`,
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    totalCents: 1000,
    outstandingCents: status === 'PAID_FULL' ? 0 : 1000,
    items: itemNames.map(invoiceLine),
  }) as unknown as PastInvoice;

describe('collectSeededBillNames', () => {
  it('includes builder line names, normalized', () => {
    const taken = collectSeededBillNames(['  Wellness Exam '], []);
    expect(taken.has('wellness exam')).toBe(true);
  });

  it('includes names from OPEN (unpaid/partial) invoices so they are not re-seeded', () => {
    const taken = collectSeededBillNames(
      [],
      [pastInvoice('UNPAID', ['Consultation']), pastInvoice('PARTIAL', ['Vaccination'])]
    );
    expect(taken.has('consultation')).toBe(true);
    expect(taken.has('vaccination')).toBe(true);
  });

  it('excludes names that only appear on a PAID_FULL invoice so a re-bill is still possible', () => {
    const taken = collectSeededBillNames([], [pastInvoice('PAID_FULL', ['Nail trim'])]);
    expect(taken.has('nail trim')).toBe(false);
  });
});

describe('InvoiceStep billable item search', () => {
  it('excludes active catalog items already present on the bill', () => {
    const items = buildBillableItems(
      encounter([invoiceLine('Wellness exam')]),
      [service('Wellness exam'), service('Nail trim')],
      [],
      [],
      'org-1'
    );

    expect(items.map((item) => item.name)).toEqual(['Nail trim']);
  });
});

// ---------------------------------------------------------------------------
// <InvoiceStep /> component tests
// ---------------------------------------------------------------------------

type BuildEncounterOverrides = Partial<AppointmentEncounter>;

const buildEncounter = (overrides: BuildEncounterOverrides = {}): AppointmentEncounter =>
  ({
    appointmentId: 'appt-1',
    mode: 'OUTPATIENT',
    consultationType: 'GENERAL',
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
    currency: '',
    withdrawDeposit: false,
    taxPercent: 0,
    overallDiscountPercent: 0,
    dischargeSummary: '',
    documents: [],
    readyForBilling: { value: true },
    readyForDischarge: { value: false },
    stepStatus: {},
    viewOnly: false,
    leadName: 'Dr Vet',
    ...overrides,
  }) as unknown as AppointmentEncounter;

const defaultProps = {
  appointmentId: 'appt-1',
  organisationId: 'org-1',
  patientId: 'patient-1',
  parentId: 'parent-1',
  onOpenSummary: jest.fn(),
};

const renderInvoiceStep = (encounterOverrides: BuildEncounterOverrides = {}, props = {}) =>
  render(
    <InvoiceStep {...defaultProps} encounter={buildEncounter(encounterOverrides)} {...props} />
  );

describe('<InvoiceStep /> component', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    (useAppointmentWorkspaceStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(workspaceStoreMock)
    );

    catalogStoreState.services = [];
    catalogStoreState.packages = [];
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(catalogStoreState)
    );

    inventoryStoreState.itemIdsByOrgId = {};
    inventoryStoreState.itemsById = {};
    (useInventoryStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(inventoryStoreState)
    );

    invoiceServiceMock.loadAppointmentBilling.mockResolvedValue({
      pastInvoices: [],
      depositCents: 0,
      currency: 'usd',
    });
    invoiceServiceMock.findOpenAppointmentInvoice.mockReturnValue(undefined);
    invoiceServiceMock.createFinanceInvoice.mockResolvedValue({ id: 'inv-new' });
    invoiceServiceMock.finalizeFinanceInvoice.mockResolvedValue({ id: 'inv-new' });
    invoiceServiceMock.getPaymentLink.mockResolvedValue('https://checkout.example/pay');
    invoiceServiceMock.recordManualInvoicePayment.mockResolvedValue(undefined);
    invoiceServiceMock.sendInvoiceToClient.mockResolvedValue({ emailSent: true });
    invoiceServiceMock.addLineItemsToAppointments.mockResolvedValue(undefined);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders without crashing and shows the bill builder for an editable encounter', async () => {
    renderInvoiceStep();

    expect(await screen.findByTestId('total-bill-container')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collect Deposit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /collect cash/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay online/i })).toBeInTheDocument();
    expect(screen.getByText(/no invoices recorded yet/i)).toBeInTheDocument();
  });

  it('renders existing pastInvoices and expands a row to show the breakdown', async () => {
    const invoice = pastInvoice('UNPAID', ['Consultation']);
    renderInvoiceStep({ pastInvoices: [invoice] });

    await screen.findByTestId('total-bill-container');
    expect(screen.getByText(new RegExp(`ID - ${invoice.id}`))).toBeInTheDocument();

    // First invoice is expanded by default (InvoicesSection defaults expandedId to invoices[0]).
    expect(screen.getByText('Consultation')).toBeInTheDocument();

    const hideButton = screen.getByRole('button', { name: `Hide invoice ${invoice.id}` });
    await userEvent.click(hideButton);
    expect(screen.queryByText('Consultation')).not.toBeInTheDocument();

    const showButton = screen.getByRole('button', { name: `View invoice ${invoice.id}` });
    await userEvent.click(showButton);
    expect(screen.getByText('Consultation')).toBeInTheDocument();
  });

  it('hides the bill builder when hideBillBuilder is true', async () => {
    renderInvoiceStep({}, { hideBillBuilder: true });
    await waitFor(() => expect(invoiceServiceMock.loadAppointmentBilling).toHaveBeenCalled());
    expect(screen.queryByTestId('total-bill-container')).not.toBeInTheDocument();
  });

  it('disables mutation actions and hides Share when readOnly (viewOnly)', async () => {
    const invoice = { ...pastInvoice('PAID_FULL', ['Consultation']) };
    renderInvoiceStep({ viewOnly: true, pastInvoices: [invoice] });

    await waitFor(() => expect(invoiceServiceMock.loadAppointmentBilling).toHaveBeenCalled());
    expect(screen.queryByTestId('total-bill-container')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collect Deposit' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Share invoice ${invoice.id}` })
    ).not.toBeInTheDocument();
    // Download still shows for a settled invoice even when read-only.
    expect(
      screen.getByRole('button', { name: `Download invoice ${invoice.id}` })
    ).toBeInTheDocument();
    // Summary button is hidden entirely when readOnly.
    expect(screen.queryByRole('button', { name: /summary/i })).not.toBeInTheDocument();
  });

  it('collects cash payment and shows confirmation', async () => {
    renderInvoiceStep({
      invoiceLineItems: [invoiceLine('Consultation')],
    });
    await screen.findByTestId('total-bill-container');

    const collectCash = screen.getByRole('button', { name: /collect cash/i });
    await act(async () => {
      await userEvent.click(collectCash);
    });

    await waitFor(() => expect(invoiceServiceMock.createFinanceInvoice).toHaveBeenCalled());
    expect(invoiceServiceMock.finalizeFinanceInvoice).toHaveBeenCalledWith('inv-new');
    expect(invoiceServiceMock.recordManualInvoicePayment).toHaveBeenCalled();
    expect(workspaceStoreMock.recordInvoicePayment).toHaveBeenCalledWith(
      'appt-1',
      expect.objectContaining({ method: 'CASH' })
    );
    expect(await screen.findByText(/paid via cash recorded/i)).toBeInTheDocument();
  });

  it('collects an online payment and shows the generated checkout link', async () => {
    renderInvoiceStep({
      invoiceLineItems: [invoiceLine('Consultation')],
    });
    await screen.findByTestId('total-bill-container');

    const payOnline = screen.getByRole('button', { name: /pay online/i });
    await act(async () => {
      await userEvent.click(payOnline);
    });

    await waitFor(() => expect(invoiceServiceMock.getPaymentLink).toHaveBeenCalledWith('inv-new'));
    // handleCollect overwrites the "Payment link generated:" confirmation set inside
    // runOnlineCollection with a final "<label> recorded" message once it resolves.
    expect(await screen.findByText(/paid online recorded/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /checkout.example\/pay/i })).toBeInTheDocument();
  });

  it('disables cash/online payment actions when not ready for billing', async () => {
    renderInvoiceStep({
      invoiceLineItems: [invoiceLine('Consultation')],
      readyForBilling: { value: false },
    });
    await screen.findByTestId('total-bill-container');

    const collectCash = screen.getByRole('button', { name: /collect cash/i });
    const payOnline = screen.getByRole('button', { name: /pay online/i });
    expect(collectCash).toBeDisabled();
    expect(payOnline).toBeDisabled();

    await act(async () => {
      await userEvent.click(collectCash);
    });

    expect(invoiceServiceMock.createFinanceInvoice).not.toHaveBeenCalled();
  });

  it('opens the deposit modal, submits CASH, and records the deposit collection', async () => {
    renderInvoiceStep({
      invoiceLineItems: [invoiceLine('Consultation')],
    });
    await screen.findByTestId('total-bill-container');

    await userEvent.click(screen.getByRole('button', { name: 'Collect Deposit' }));

    const amountInput = await screen.findByRole('spinbutton', { name: /amount/i });
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '50');

    const referenceInput = screen.getByRole('textbox', { name: /reference/i });
    await userEvent.type(referenceInput, 'ref-123');

    // Two "Collect Deposit" matches (the trigger + the modal submit) — pick the submit
    // button specifically by its exact modal label text.
    const modalSubmit = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent === 'Collect deposit');
    expect(modalSubmit).toBeDefined();

    await act(async () => {
      await userEvent.click(modalSubmit as HTMLElement);
    });

    await waitFor(() => expect(invoiceServiceMock.createFinanceInvoice).toHaveBeenCalled());
    expect(invoiceServiceMock.recordManualInvoicePayment).toHaveBeenCalledWith(
      'inv-new',
      expect.objectContaining({ settlementChannel: 'DEPOSIT' })
    );
    expect(workspaceStoreMock.recordDepositCollection).toHaveBeenCalledWith(
      'appt-1',
      expect.objectContaining({ method: 'CASH', amountCents: 5000 })
    );
  });

  it('opens the deposit modal, submits ONLINE, and generates a payment link', async () => {
    renderInvoiceStep({
      invoiceLineItems: [invoiceLine('Consultation')],
    });
    await screen.findByTestId('total-bill-container');

    await userEvent.click(screen.getByRole('button', { name: 'Collect Deposit' }));

    const onlineToggle = await screen.findByRole('button', { name: /online link/i });
    await userEvent.click(onlineToggle);

    const generateLink = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent === 'Generate link');
    expect(generateLink).toBeDefined();

    await act(async () => {
      await userEvent.click(generateLink as HTMLElement);
    });

    await waitFor(() => expect(invoiceServiceMock.getPaymentLink).toHaveBeenCalled());
    expect(workspaceStoreMock.recordDepositCollection).toHaveBeenCalledWith(
      'appt-1',
      expect.objectContaining({ method: 'ONLINE' })
    );
  });

  it('auto-seeds unbilled services/prescriptions onto the bill exactly once', async () => {
    const services = [
      {
        id: 'line-1',
        refId: 'svc-1',
        kind: 'SERVICE',
        name: 'Wellness exam',
        qty: 1,
        unitPriceCents: 2500,
        amountCents: 2500,
        billed: false,
      },
    ];

    const { rerender } = renderInvoiceStep({
      services: services as unknown as AppointmentEncounter['services'],
    });

    await waitFor(() => expect(invoiceServiceMock.loadAppointmentBilling).toHaveBeenCalled());
    await waitFor(() => expect(workspaceStoreMock.addInvoiceLineItem).toHaveBeenCalledTimes(1));
    expect(workspaceStoreMock.addInvoiceLineItem).toHaveBeenCalledWith(
      'appt-1',
      expect.objectContaining({ name: 'Wellness exam' })
    );

    rerender(
      <InvoiceStep
        {...defaultProps}
        encounter={buildEncounter({
          services: services as unknown as AppointmentEncounter['services'],
        })}
      />
    );

    // Re-render with the same encounter must not re-seed the same line.
    expect(workspaceStoreMock.addInvoiceLineItem).toHaveBeenCalledTimes(1);
  });

  // The bill/prescription interlink backfills a prescription row when a dispensable drug is
  // billed without one. Treatment has already run its save pass by the time the bill is built,
  // so the row must be persisted here or it is lost on refresh.
  describe('prescription backfill from the bill', () => {
    const seedDispensableDrug = () => {
      inventoryStoreState.itemIdsByOrgId = { 'org-1': ['inv-1'] };
      inventoryStoreState.itemsById = {
        'inv-1': {
          id: 'inv-1',
          basicInfo: { name: 'Manual add', itemType: 'Drug' },
          pricing: { selling: 5 },
          stock: {},
        },
      };
    };

    const clickAddManualItem = async () => {
      await screen.findByTestId('total-bill-container');
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Add manual item' }));
      });
    };

    it('persists the backfilled prescription and seeds the store with the backend id', async () => {
      seedDispensableDrug();
      clinicalServiceMock.savePrescriptionArtifact.mockResolvedValue({ id: 'rx-server-1' });

      renderInvoiceStep({}, { encounterId: 'enc-1', authorId: 'vet-1' });
      await clickAddManualItem();

      await waitFor(() =>
        expect(clinicalServiceMock.savePrescriptionArtifact).toHaveBeenCalledWith(
          expect.objectContaining({
            organisationId: 'org-1',
            appointmentId: 'appt-1',
            encounterId: 'enc-1',
            authorId: 'vet-1',
          }),
          expect.objectContaining({ medicineName: 'Manual add' })
        )
      );
      await waitFor(() =>
        expect(workspaceStoreMock.addPrescription).toHaveBeenCalledWith(
          'appt-1',
          expect.objectContaining({ medicineName: 'Manual add' }),
          'rx-server-1'
        )
      );
    });

    it('keeps the prescription row and notifies when persisting it fails', async () => {
      seedDispensableDrug();
      clinicalServiceMock.savePrescriptionArtifact.mockRejectedValue(new Error('boom'));

      renderInvoiceStep();
      await clickAddManualItem();

      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('error', expect.anything()));
      expect(workspaceStoreMock.addPrescription).toHaveBeenCalledWith(
        'appt-1',
        expect.objectContaining({ medicineName: 'Manual add' })
      );
    });

    it('does not backfill a prescription for a non-dispensable item', async () => {
      inventoryStoreState.itemIdsByOrgId = { 'org-1': ['inv-1'] };
      inventoryStoreState.itemsById = {
        'inv-1': {
          id: 'inv-1',
          basicInfo: { name: 'Manual add', itemType: 'Consumable' },
          pricing: { selling: 5 },
          stock: {},
        },
      };

      renderInvoiceStep();
      await clickAddManualItem();

      expect(clinicalServiceMock.savePrescriptionArtifact).not.toHaveBeenCalled();
      expect(workspaceStoreMock.addPrescription).not.toHaveBeenCalled();
    });
  });

  it('shows the incomplete-medications warning and blocks Summary', async () => {
    const rx = {
      id: 'rx-1',
      medicineName: 'Amoxicillin',
      fulfillment: 'IN_HOUSE',
      priceCents: 1500,
      billed: false,
    };

    renderInvoiceStep({
      invoiceLineItems: [invoiceLine('Amoxicillin')],
      prescription: [rx] as unknown as AppointmentEncounter['prescription'],
    });

    await screen.findByTestId('total-bill-container');

    expect(
      await screen.findByText(/fill prescription details in the treatment step/i)
    ).toBeInTheDocument();

    const summaryButton = screen.getByRole('button', { name: /summary/i });
    expect(summaryButton).toBeDisabled();
  });

  it('loads billing exactly once for a given appointment/org even across re-renders', async () => {
    const { rerender } = renderInvoiceStep();
    await waitFor(() => expect(invoiceServiceMock.loadAppointmentBilling).toHaveBeenCalledTimes(1));

    rerender(
      <InvoiceStep {...defaultProps} encounter={buildEncounter({ overallDiscountPercent: 5 })} />
    );
    rerender(
      <InvoiceStep {...defaultProps} encounter={buildEncounter({ overallDiscountPercent: 10 })} />
    );

    expect(invoiceServiceMock.loadAppointmentBilling).toHaveBeenCalledTimes(1);
  });

  it('does not crash when loadAppointmentBilling rejects, and logs the error', async () => {
    invoiceServiceMock.loadAppointmentBilling.mockRejectedValueOnce(new Error('network down'));

    renderInvoiceStep();

    await waitFor(() =>
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load appointment billing:',
        expect.any(Error)
      )
    );
    expect(screen.getByTestId('total-bill-container')).toBeInTheDocument();
  });

  it('does not crash when getPaymentLink rejects during online collection', async () => {
    invoiceServiceMock.getPaymentLink.mockRejectedValueOnce(new Error('link service down'));

    renderInvoiceStep({
      invoiceLineItems: [invoiceLine('Consultation')],
    });
    await screen.findByTestId('total-bill-container');

    const payOnline = screen.getByRole('button', { name: /pay online/i });
    await act(async () => {
      await userEvent.click(payOnline);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/link service down/i);
  });

  it('renders SettledBadge and Download/Share for a settled invoice when editable', async () => {
    const invoice = pastInvoice('PAID_FULL', ['Consultation']);
    renderInvoiceStep({ pastInvoices: [invoice] });

    await screen.findByTestId('total-bill-container');
    expect(await screen.findByText(/invoice paid/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Download invoice ${invoice.id}` })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Share invoice ${invoice.id}` })).toBeInTheDocument();
  });

  it('shows "Withdrawn from Deposit" badge when the invoice was paid from deposit', async () => {
    const invoice = { ...pastInvoice('PAID_FULL', ['Consultation']), paidFromDeposit: true };
    renderInvoiceStep({ pastInvoices: [invoice] });

    expect(await screen.findByText(/withdrawn from deposit/i)).toBeInTheDocument();
  });

  it('sends the invoice to the client for inpatient encounters', async () => {
    renderInvoiceStep({
      mode: 'INPATIENT',
      invoiceLineItems: [invoiceLine('Consultation')],
    });
    await screen.findByTestId('total-bill-container');

    const sendToClient = screen.getByRole('button', { name: /send to client/i });
    await act(async () => {
      await userEvent.click(sendToClient);
    });

    await waitFor(() => expect(invoiceServiceMock.sendInvoiceToClient).toHaveBeenCalled());
    expect(await screen.findByText(/invoice sent to client/i)).toBeInTheDocument();
  });

  it('forwards bill builder callbacks to the workspace store', async () => {
    renderInvoiceStep({ invoiceLineItems: [invoiceLine('Consultation')] });
    await screen.findByTestId('total-bill-container');

    await userEvent.click(screen.getByText('Toggle withdraw deposit'));
    expect(workspaceStoreMock.setWithdrawDeposit).toHaveBeenCalledWith('appt-1', true);

    await userEvent.click(screen.getByText('Set overall discount'));
    expect(workspaceStoreMock.setOverallDiscountPercent).toHaveBeenCalledWith('appt-1', 10);

    await userEvent.click(screen.getByText('Bump first qty'));
    expect(workspaceStoreMock.updateInvoiceLineItem).toHaveBeenCalledWith(
      'appt-1',
      'invoice-Consultation',
      { qty: 2 }
    );

    await userEvent.click(screen.getByText('Add manual item'));
    expect(workspaceStoreMock.addInvoiceLineItem).toHaveBeenCalledWith(
      'appt-1',
      expect.objectContaining({ name: 'Manual add' })
    );
  });

  it('completes the step and opens the summary from the Summary button', async () => {
    const onOpenSummary = jest.fn();
    renderInvoiceStep({ invoiceLineItems: [invoiceLine('Consultation')] }, { onOpenSummary });
    await screen.findByTestId('total-bill-container');

    await userEvent.click(screen.getByRole('button', { name: /summary/i }));

    expect(workspaceStoreMock.setStepStatus).toHaveBeenCalledWith('appt-1', 'INVOICE', 'COMPLETED');
    expect(onOpenSummary).toHaveBeenCalled();
  });

  describe('invoice download and share', () => {
    const settledInvoice = (overrides: Partial<PastInvoice> = {}): PastInvoice =>
      ({
        id: 'inv-doc',
        status: 'PAID_FULL',
        createdAt: '2026-01-01T00:00:00.000Z',
        totalCents: 1000,
        outstandingCents: 0,
        items: [invoiceLine('Consultation')],
        ...overrides,
      }) as unknown as PastInvoice;

    it('opens the backend PDF when the invoice has one', async () => {
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);
      renderInvoiceStep({ pastInvoices: [settledInvoice({ pdfUrl: 'https://cdn/invoice.pdf' })] });

      await userEvent.click(
        await screen.findByRole('button', { name: 'Download invoice inv-doc' })
      );

      expect(openSpy).toHaveBeenCalledWith(
        'https://cdn/invoice.pdf',
        '_blank',
        'noopener,noreferrer'
      );
      openSpy.mockRestore();
    });

    it('falls back to a print window and escapes invoice HTML', async () => {
      const printWindow = {
        document: { head: { innerHTML: '' }, body: { innerHTML: '' } },
        focus: jest.fn(),
        print: jest.fn(),
      };
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(printWindow as never);
      renderInvoiceStep({
        pastInvoices: [
          settledInvoice({ items: [{ ...invoiceLine('Rabies <vaccine> & "shot"') }] } as never),
        ],
      });

      await userEvent.click(
        await screen.findByRole('button', { name: 'Download invoice inv-doc' })
      );

      expect(printWindow.print).toHaveBeenCalled();
      expect(printWindow.document.body.innerHTML).toContain(
        'Rabies &lt;vaccine&gt; &amp; &quot;shot&quot;'
      );
      openSpy.mockRestore();
    });

    it('warns when the print popup is blocked', async () => {
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);
      renderInvoiceStep({ pastInvoices: [settledInvoice()] });

      await userEvent.click(
        await screen.findByRole('button', { name: 'Download invoice inv-doc' })
      );

      expect(mockNotify).toHaveBeenCalledWith(
        'warning',
        expect.objectContaining({ title: 'Allow pop-ups to download' })
      );
      openSpy.mockRestore();
    });

    it('copies the hosted PDF link to the clipboard when sharing', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      renderInvoiceStep({ pastInvoices: [settledInvoice({ pdfUrl: 'https://cdn/invoice.pdf' })] });

      await userEvent.click(await screen.findByRole('button', { name: 'Share invoice inv-doc' }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://cdn/invoice.pdf'));
      expect(await screen.findByText('Invoice link copied to clipboard.')).toBeInTheDocument();
    });

    it('falls back to the appointment deep link and handles clipboard failures', async () => {
      const writeText = jest.fn().mockRejectedValue(new Error('denied'));
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      renderInvoiceStep({ pastInvoices: [settledInvoice()] });

      await userEvent.click(await screen.findByRole('button', { name: 'Share invoice inv-doc' }));

      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          expect.stringContaining('/appointments/appt-1/workspace?step=INVOICE')
        )
      );
      expect(await screen.findByText('Invoice link:')).toBeInTheDocument();
    });

    it('shows the link without copying when the clipboard API is unavailable', async () => {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });
      renderInvoiceStep({ pastInvoices: [settledInvoice()] });

      await userEvent.click(await screen.findByRole('button', { name: 'Share invoice inv-doc' }));

      expect(await screen.findByText('Invoice link:')).toBeInTheDocument();
    });
  });

  describe('payment progress overlay', () => {
    const collectOnline = async () => {
      await screen.findByTestId('total-bill-container');
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: /pay online/i }));
      });
    };

    it('confirms the payment once the invoice settles and closes via Done', async () => {
      invoiceServiceMock.loadAppointmentBilling.mockResolvedValue({
        pastInvoices: [
          {
            id: 'inv-new',
            status: 'PAID_FULL',
            outstandingCents: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            totalCents: 1000,
            items: [],
          },
        ],
        depositCents: 0,
        currency: 'usd',
      });
      renderInvoiceStep({ invoiceLineItems: [invoiceLine('Consultation')] });

      await collectOnline();

      expect(await screen.findByText('Payment confirmed')).toBeInTheDocument();
      expect(workspaceStoreMock.recordInvoicePayment).toHaveBeenCalledWith(
        'appt-1',
        expect.objectContaining({ method: 'ONLINE' })
      );

      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(screen.queryByText('Payment confirmed')).not.toBeInTheDocument();
    });

    const goDelayed = async () => {
      // Re-check on window focus while still inside the polling window.
      await act(async () => {
        globalThis.window.dispatchEvent(new Event('focus'));
        await Promise.resolve();
      });
      expect(screen.getByText('Payment in progress')).toBeInTheDocument();

      // Jump the clock past the poll timeout, then trigger a visibility poll so
      // the overlay flips to the delayed state.
      const future = Date.now() + 130000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(future);
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });
      nowSpy.mockRestore();
      expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
    };

    it('polls, goes delayed after the timeout, retries, and aborts', async () => {
      renderInvoiceStep({ invoiceLineItems: [invoiceLine('Consultation')] });
      await collectOnline();

      expect(screen.getByText('Payment in progress')).toBeInTheDocument();
      expect(screen.getByText('Reopen Stripe checkout')).toBeInTheDocument();

      await goDelayed();

      // Check again restarts the checking state…
      fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByText('Payment in progress')).toBeInTheDocument();

      // …and Abort tears the overlay down.
      fireEvent.click(screen.getByRole('button', { name: 'Abort' }));
      expect(screen.queryByText('Payment in progress')).not.toBeInTheDocument();
    });

    it('continues editing after a delayed payment and reloads billing', async () => {
      renderInvoiceStep({ invoiceLineItems: [invoiceLine('Consultation')] });
      await collectOnline();
      await goDelayed();

      fireEvent.click(screen.getByRole('button', { name: 'Continue editing' }));
      expect(screen.queryByText('Payment in progress')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument();
    });
  });
});
