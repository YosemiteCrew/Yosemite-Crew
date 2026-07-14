import {
  formatTestPrice,
  getOrderStatusBadgeClass,
  getTestSpecimen,
  getTestTurnaround,
  resolveOrderPdfUrl,
  resolveOrderUiUrl,
  toTitleCase,
} from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/labTestsUtils';
import type { IdexxTest, LabOrder } from '@/app/features/integrations/services/types';
import { getSafeIdexxIframeUrl } from '@/app/lib/urls';

jest.mock('@/app/lib/urls', () => ({
  getSafeIdexxIframeUrl: jest.fn((value: string) => `safe:${value}`),
}));

const test = (overrides: Partial<IdexxTest> = {}): IdexxTest => ({
  _id: 'test-1',
  code: 'CBC',
  display: 'Complete Blood Count',
  type: 'REFERENCE',
  meta: {},
  ...overrides,
});

const order = (overrides: Partial<LabOrder> = {}): LabOrder => ({
  _id: 'order-1',
  organisationId: 'org-1',
  provider: 'IDEXX',
  companionId: 'comp-1',
  status: 'submitted',
  modality: 'REFERENCE_LAB',
  idexxOrderId: 'idexx-1',
  tests: [],
  ...overrides,
});

describe('labTestsUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats prices across empty, raw, fallback, and currency branches', () => {
    expect(formatTestPrice(test())).toBe('Rate unavailable');
    expect(formatTestPrice(test({ meta: { listPrice: '14.95' } }))).toBe('14.95');
    expect(formatTestPrice(test({ meta: { listPrice: '14.95', currencyCode: 'usd' } }))).toContain(
      '$14.95'
    );
    expect(formatTestPrice(test({ meta: { listPrice: 'not-a-price', currencyCode: 'cad' } }))).toBe(
      'CAD not-a-price'
    );
  });

  it('returns turnaround, specimen, and title-case fallbacks', () => {
    expect(getTestTurnaround(test())).toBe('TAT not listed');
    expect(getTestTurnaround(test({ meta: { turnaround: ' 24 hours ' } }))).toBe('24 hours');
    expect(getTestSpecimen(test())).toBe('Specimen not listed');
    expect(getTestSpecimen(test({ meta: { specimen: ' Serum ' } }))).toBe('Serum');
    expect(toTitleCase('  IN_PROGRESS  ')).toBe('In progress');
    expect(toTitleCase('')).toBe('-');
    expect(toTitleCase(null)).toBe('-');
  });

  it('resolves IDEXX UI and PDF URLs from top-level or nested payloads', () => {
    expect(resolveOrderUiUrl(null)).toBe('');
    expect(resolveOrderPdfUrl(null)).toBe('');
    expect(resolveOrderUiUrl(order({ uiUrl: ' https://ui ' }))).toBe('safe:https://ui');
    expect(
      resolveOrderPdfUrl(
        order({
          pdfUrl: '',
          responsePayload: { pdfURL: ' https://pdf ' },
        } as unknown as Partial<LabOrder>)
      )
    ).toBe('safe:https://pdf');
    expect(getSafeIdexxIframeUrl).toHaveBeenCalledTimes(2);
  });

  it('maps order/result states to badge classes', () => {
    const resultProgress = new Map<string, string>([
      ['complete', 'Complete'],
      ['process', 'In process'],
      ['error', 'Error'],
    ]);

    expect(
      getOrderStatusBadgeClass(
        order({ idexxOrderId: 'complete', status: 'created' }),
        resultProgress
      )
    ).toBe('bg-green-50 text-green-800');
    expect(
      getOrderStatusBadgeClass(
        order({ idexxOrderId: 'process', status: 'created' }),
        resultProgress
      )
    ).toBe('bg-amber-50 text-amber-700');
    expect(
      getOrderStatusBadgeClass(order({ idexxOrderId: 'error', status: 'created' }), resultProgress)
    ).toBe('bg-red-50 text-red-700');
    expect(getOrderStatusBadgeClass(order({ status: 'submitted' }), new Map())).toBe(
      'bg-green-50 text-green-800'
    );
    expect(getOrderStatusBadgeClass(order({ status: 'pending review' }), new Map())).toBe(
      'bg-amber-50 text-amber-700'
    );
    expect(getOrderStatusBadgeClass(order({ status: 'failed' }), new Map())).toBe(
      'bg-red-50 text-red-700'
    );
    expect(getOrderStatusBadgeClass(order({ status: 'unknown' }), new Map())).toBe(
      'bg-card-hover text-text-secondary'
    );
  });
});
