import {
  listOverdueClientInvoices,
  markClientInvoiceReviewed,
  saveClientPaymentTerms,
} from '@/app/features/finance/services/clientCollectionsService';

const getData = jest.fn();
const putData = jest.fn();
const postData = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...args: unknown[]) => getData(...args),
  putData: (...args: unknown[]) => putData(...args),
  postData: (...args: unknown[]) => postData(...args),
}));

const row = {
  invoiceId: 'invoice-1',
  parentId: 'parent/1',
  dueAt: '2026-09-01T00:00:00.000Z',
  dueDate: '2026-09-01',
  currency: 'GBP',
  balance: 45,
  netDays: 14,
  reviewedAt: null,
  reviewedBy: null,
};

beforeEach(() => {
  getData.mockReset();
  putData.mockReset();
  postData.mockReset();
});

describe('listOverdueClientInvoices', () => {
  it('returns valid overdue rows and fills absent review values', async () => {
    getData.mockResolvedValue({ data: { data: [row, { invoiceId: 'bad' }, null], error: null } });

    await expect(listOverdueClientInvoices('org/1')).resolves.toEqual([
      { ...row, reviewedAt: null, reviewedBy: null },
    ]);
    expect(getData).toHaveBeenCalledWith('/v1/finance/organisation/org%2F1/collections/overdue');
  });

  it.each([
    ['a due date that is not a calendar date', { dueDate: '2026-09-01T00:00:00Z' }],
    ['a missing due date', { dueDate: undefined }],
    ['fractional payment terms', { netDays: 1.5 }],
    ['missing payment terms', { netDays: undefined }],
    ['a non-finite balance', { balance: Number.POSITIVE_INFINITY }],
  ])('drops a row with %s', async (_label, override) => {
    getData.mockResolvedValue({ data: { data: [{ ...row, ...override }], error: null } });
    await expect(listOverdueClientInvoices('org-1')).resolves.toEqual([]);
  });

  it('rejects missing organisation and returns empty for non-array data', async () => {
    await expect(listOverdueClientInvoices('')).rejects.toThrow('Organisation ID missing');
    getData.mockResolvedValue({ data: { data: {}, error: null } });
    await expect(listOverdueClientInvoices('org-1')).resolves.toEqual([]);
  });

  it('surfaces a finance envelope error', async () => {
    getData.mockResolvedValue({ data: { error: { message: 'Denied' } } });
    await expect(listOverdueClientInvoices('org-1')).rejects.toThrow('Denied');
  });
});

describe('saveClientPaymentTerms', () => {
  it('validates days and writes the setting', async () => {
    await expect(saveClientPaymentTerms('org-1', 'parent-1', 1.2)).rejects.toThrow(
      'between 0 and 365'
    );
    await expect(saveClientPaymentTerms('org-1', 'parent-1', 366)).rejects.toThrow(
      'between 0 and 365'
    );
    putData.mockResolvedValue({
      data: { data: { netDays: 30, updatedAt: '2026-09-10', updatedBy: 'user-1' } },
    });
    await expect(saveClientPaymentTerms('org-1', 'parent-1', 30)).resolves.toMatchObject({
      netDays: 30,
    });
    expect(putData).toHaveBeenCalledWith(
      '/v1/finance/organisation/org-1/clients/parent-1/payment-terms',
      { netDays: 30 }
    );
  });

  it('rejects missing account identifiers', async () => {
    await expect(saveClientPaymentTerms('', 'parent-1', 30)).rejects.toThrow(
      'Client account missing'
    );
  });
});

describe('markClientInvoiceReviewed', () => {
  it('posts the review action and returns the server result', async () => {
    postData.mockResolvedValue({
      data: {
        data: {
          id: 'invoice-1',
          collectionsReviewedAt: '2026-09-10',
          collectionsReviewedBy: 'user-1',
        },
      },
    });
    await expect(markClientInvoiceReviewed('org-1', 'invoice/1')).resolves.toMatchObject({
      id: 'invoice-1',
    });
    expect(postData).toHaveBeenCalledWith(
      '/v1/finance/organisation/org-1/collections/overdue/invoice%2F1/review',
      {}
    );
  });

  it('rejects missing identifiers', async () => {
    await expect(markClientInvoiceReviewed('org-1', '')).rejects.toThrow('Invoice missing');
  });
});
