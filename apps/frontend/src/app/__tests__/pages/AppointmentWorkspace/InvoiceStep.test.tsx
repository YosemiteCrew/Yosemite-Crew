import { buildBillableItems } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/InvoiceStep';
import type {
  AppointmentEncounter,
  InvoiceLineItem,
} from '@/app/features/appointments/types/workspace';
import type { ServiceRevamp } from '@/app/features/organization/types/revamp';

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
