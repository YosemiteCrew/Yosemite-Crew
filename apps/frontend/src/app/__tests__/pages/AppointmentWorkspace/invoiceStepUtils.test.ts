import {
  BillableCandidate,
  breakdownToInvoiceBreakdown,
  buildBillableItems,
  collectSeededBillNames,
  discountCentsFromPercent,
  getInvoiceErrorMessage,
  moneyToCents,
  normalizeLineName,
  packageToInvoiceCandidate,
  serviceToInvoiceCandidate,
  toInvoiceCandidate,
  uniqueByName,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/invoiceStepUtils';
import type {
  AppointmentEncounter,
  InvoiceLineItem,
  PastInvoice,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';
import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import type {
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
} from '@/app/features/organization/types/revamp';

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

const packageBreakdown = (overrides: Partial<PackageBreakdownItem> = {}): PackageBreakdownItem => ({
  id: 'bd-1',
  name: 'Bloodwork',
  type: 'SERVICE' as PackageBreakdownItem['type'],
  quantity: 2,
  unitPrice: 10,
  discount: 25,
  ...overrides,
});

const pkg = (name: string, overrides: Partial<PackageRevamp> = {}): PackageRevamp =>
  ({
    id: `pkg-${name}`,
    code: `PKG-${name}`,
    name,
    description: name,
    specialityId: 'spec-1',
    organisationId: 'org-1',
    status: 'ACTIVE',
    grossAmount: 40,
    breakdown: [packageBreakdown()],
    additionalDiscount: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as unknown as PackageRevamp;

const inventoryItem = (name: string, overrides: Partial<InventoryItem> = {}): InventoryItem =>
  ({
    id: `inv-${name}`,
    status: 'ACTIVE',
    basicInfo: {
      name,
      category: 'Medicine',
      subCategory: 'General',
      department: '',
      description: '',
      status: 'ACTIVE',
      itemType: 'Consumable',
      prescriptionRequired: 'no',
      drugSchedule: '',
    },
    pricing: { selling: 12.5 },
    stock: { reorderLevel: 1, current: 10, allocated: 0 },
    ...overrides,
  }) as unknown as InventoryItem;

const prescriptionItem = (
  medicineName: string,
  overrides: Partial<PrescriptionItem> = {}
): PrescriptionItem =>
  ({
    id: `rx-${medicineName}`,
    medicineName,
    fulfillment: 'IN_HOUSE',
    billed: false,
    priceCents: 450,
    quantity: 1,
    frequency: 'BID',
    duration: '5 days',
    ...overrides,
  }) as unknown as PrescriptionItem;

const encounter = (overrides: Partial<AppointmentEncounter> = {}): AppointmentEncounter =>
  ({
    services: [],
    prescription: [],
    invoiceLineItems: [],
    ...overrides,
  }) as unknown as AppointmentEncounter;

const treatmentLine = (name: string, overrides: Record<string, unknown> = {}) =>
  ({
    id: `line-${name}`,
    refId: `ref-${name}`,
    kind: 'BILLING_ONLY',
    name,
    qty: 1,
    unitPriceCents: 1000,
    grossCents: 1000,
    discountCents: 0,
    amountCents: 1000,
    billed: false,
    ...overrides,
  }) as unknown as AppointmentEncounter['services'][number];

const pastInvoice = (status: PastInvoice['status'], itemNames: string[]): PastInvoice =>
  ({
    id: `inv-${status}-${itemNames.join('-')}`,
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    totalCents: 1000,
    outstandingCents: status === 'PAID_FULL' ? 0 : 1000,
    items: itemNames.map(invoiceLine),
  }) as unknown as PastInvoice;

describe('invoiceStepUtils primitives', () => {
  it('normalizes line names and converts money/discount values', () => {
    expect(normalizeLineName('  Wellness Exam ')).toBe('wellness exam');
    expect(moneyToCents(12.345)).toBe(1235);
    expect(discountCentsFromPercent(1000, 12.5)).toBe(125);
    expect(discountCentsFromPercent(1000, 200)).toBe(1000);
  });

  it('creates plain invoice candidates', () => {
    expect(toInvoiceCandidate('Exam', 2500, 'BILLING_ONLY')).toEqual({
      name: 'Exam',
      unitPriceCents: 2500,
      qty: 1,
      grossCents: 2500,
      discountCents: 0,
      amountCents: 2500,
      kind: 'BILLING_ONLY',
    });
  });

  it('deduplicates candidates by normalized name and respects exclusions', () => {
    const candidates = [
      toInvoiceCandidate('  Exam ', 1000, 'BILLING_ONLY'),
      toInvoiceCandidate('exam', 1000, 'BILLING_ONLY'),
      toInvoiceCandidate('Nail trim', 1000, 'BILLING_ONLY'),
      { ...toInvoiceCandidate('', 1000, 'BILLING_ONLY'), name: '' },
    ] as BillableCandidate[];

    expect(uniqueByName(candidates, new Set(['nail trim']))).toEqual([
      expect.objectContaining({ name: '  Exam ' }),
    ]);
  });
});

describe('getInvoiceErrorMessage', () => {
  const axiosLikeError = (status: number, data: unknown) =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
      response: { status, data },
    });

  it("surfaces the backend's reason instead of the raw axios status text on a 409", () => {
    const message = getInvoiceErrorMessage(
      axiosLikeError(409, { message: 'Cannot modify a closed invoice' }),
      'Unable to process payment.'
    );

    expect(message).toBe('Cannot modify a closed invoice');
    expect(message).not.toMatch(/status code/i);
  });

  it('prefers a nested error.message body', () => {
    expect(
      getInvoiceErrorMessage(
        axiosLikeError(409, { error: { message: 'Invoice has no outstanding balance' } }),
        'Unable to collect deposit.'
      )
    ).toBe('Invoice has no outstanding balance');
  });

  it('falls back to the caller copy rather than dumping a raw axios message', () => {
    expect(
      getInvoiceErrorMessage(axiosLikeError(409, undefined), 'Unable to process payment.')
    ).toBe('Unable to process payment.');
    expect(getInvoiceErrorMessage(axiosLikeError(500, { message: '   ' }), 'Fallback copy.')).toBe(
      'Fallback copy.'
    );
  });

  it('keeps a meaningful non-axios Error message', () => {
    expect(
      getInvoiceErrorMessage(new Error('Unable to prepare the invoice for sending.'), 'Fallback.')
    ).toBe('Unable to prepare the invoice for sending.');
  });

  it('falls back for non-error throwables', () => {
    expect(getInvoiceErrorMessage('boom', 'Fallback.')).toBe('Fallback.');
    expect(getInvoiceErrorMessage(null, 'Fallback.')).toBe('Fallback.');
  });
});

describe('invoiceStepUtils catalog mapping', () => {
  it('maps services and packages into discounted invoice candidates', () => {
    expect(
      serviceToInvoiceCandidate(service('Exam', { grossAmount: 40, defaultDiscount: 25 }))
    ).toEqual(
      expect.objectContaining({
        name: 'Exam',
        grossCents: 4000,
        discountCents: 1000,
        amountCents: 3000,
        maxDiscountPercent: 0,
        kind: 'BILLING_ONLY',
      })
    );

    const packageCandidate = packageToInvoiceCandidate(
      pkg('Diagnostics bundle', {
        additionalDiscount: 10,
        breakdown: [packageBreakdown({ quantity: 4, unitPrice: 15, discount: 20 })],
      })
    );

    expect(packageCandidate).toEqual(
      expect.objectContaining({
        name: 'Diagnostics bundle',
        kind: 'PACKAGE_COMPONENT',
        packageDefaultDiscountPercent: 10,
      })
    );
    expect(packageCandidate.breakdown).toEqual([
      expect.objectContaining({
        id: 'bd-1',
        qty: 4,
        unitPriceCents: 1500,
      }),
    ]);
  });

  it('maps package breakdown values through catalog calculations', () => {
    expect(breakdownToInvoiceBreakdown(packageBreakdown())).toEqual({
      id: 'bd-1',
      name: 'Bloodwork',
      qty: 2,
      instructions: 'SERVICE',
      unitPriceCents: 1000,
      grossCents: 2000,
      discountPercent: 25,
      discountCents: 500,
      amountCents: 1500,
    });
  });
});

describe('collectSeededBillNames', () => {
  it('includes builder line names, normalized', () => {
    const taken = collectSeededBillNames(['  Wellness Exam '], []);
    expect(taken.has('wellness exam')).toBe(true);
  });

  it('includes names from OPEN invoices and excludes PAID_FULL names', () => {
    const taken = collectSeededBillNames(
      ['Builder line'],
      [
        pastInvoice('UNPAID', ['Consultation']),
        pastInvoice('PARTIAL', ['Vaccination']),
        pastInvoice('PAID_FULL', ['Nail trim']),
      ]
    );

    expect(taken.has('builder line')).toBe(true);
    expect(taken.has('consultation')).toBe(true);
    expect(taken.has('vaccination')).toBe(true);
    expect(taken.has('nail trim')).toBe(false);
  });
});

describe('buildBillableItems', () => {
  it('builds unique candidates from treatments, prescriptions, catalog, and inventory', () => {
    const items = buildBillableItems(
      encounter({
        services: [
          treatmentLine('Treatment A', { amountCents: 2000 }),
          treatmentLine('Already billed', { amountCents: 2500 }),
          treatmentLine('Skip zero', { amountCents: 0 }),
          treatmentLine('Skip billed', { billed: true, amountCents: 1500 }),
        ],
        prescription: [
          prescriptionItem('Rx In House'),
          prescriptionItem('External Rx', { fulfillment: 'OUTSIDE_PHARMACY' as never }),
          prescriptionItem('Billed Rx', { billed: true }),
        ],
        invoiceLineItems: [invoiceLine('Already billed')],
      }),
      [
        service('Catalog service'),
        service('Wrong org', { organisationId: 'org-2' }),
        service('Archived service', { status: 'ARCHIVED' }),
      ],
      [
        pkg('Catalog package'),
        pkg('Wrong org package', { organisationId: 'org-2' }),
        pkg('Archived package', { status: 'ARCHIVED' }),
      ],
      [
        inventoryItem('Bandage'),
        inventoryItem('Hidden stock', { status: 'HIDDEN' }),
        inventoryItem('Amoxicillin', {
          basicInfo: {
            name: 'Amoxicillin',
            category: 'Medicine',
            subCategory: 'General',
            department: '',
            description: '',
            status: 'ACTIVE',
            itemType: 'Drug',
            prescriptionRequired: 'required',
            drugSchedule: 'II',
          },
        }),
      ],
      'org-1'
    );

    expect(items.map((item) => item.name)).toEqual([
      'Treatment A',
      'Rx In House',
      'Bandage',
      'Amoxicillin',
      'Catalog service',
      'Catalog package',
    ]);
    expect(items.find((item) => item.name === 'Amoxicillin')).toEqual(
      expect.objectContaining({
        kind: 'INVENTORY',
        prescription: expect.objectContaining({ medicineName: 'Amoxicillin' }),
      })
    );
  });

  it('omits catalog items when organisation is missing and avoids duplicate visit names', () => {
    const items = buildBillableItems(
      encounter({
        services: [
          treatmentLine('Duplicate', { amountCents: 1000 }),
          treatmentLine('Duplicate', { amountCents: 2000 }),
        ],
        prescription: [prescriptionItem('Duplicate')],
      }),
      [service('Catalog service')],
      [pkg('Catalog package')],
      [],
      undefined
    );

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Duplicate');
  });
});

describe('in-house prescription quantity', () => {
  it('bills the prescribed quantity, not one unit', () => {
    // priceCents is the UNIT price. Ignoring qty meant a package-expanded
    // medication of 5 at 4.50 each appeared on the bill as a single 4.50 line.
    const items = buildBillableItems(
      encounter({
        prescription: [prescriptionItem('Amoxicillin', { qty: '5' })],
      }),
      [],
      [],
      [],
      'org-1'
    );

    const line = items.find((item) => item.name === 'Amoxicillin');
    expect(line).toMatchObject({
      qty: 5,
      unitPriceCents: 450,
      grossCents: 2250,
      amountCents: 2250,
    });
  });

  it('falls back to a single unit when no quantity is recorded', () => {
    const items = buildBillableItems(
      encounter({ prescription: [prescriptionItem('Metacam')] }),
      [],
      [],
      [],
      'org-1'
    );

    expect(items.find((item) => item.name === 'Metacam')).toMatchObject({
      qty: 1,
      amountCents: 450,
    });
  });
});
