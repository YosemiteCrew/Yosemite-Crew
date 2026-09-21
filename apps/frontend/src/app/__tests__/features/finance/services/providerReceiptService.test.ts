import {
  getProviderReceiptErrorMessage,
  listProviderReceipts,
} from '@/app/features/finance/services/providerReceiptService';

const getData = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...a: unknown[]) => getData(...a),
}));

const row = {
  id: 'rec-1',
  provider: 'STRIPE',
  merchantAccountRef: 'acct_1',
  paymentRef: 'pi_abcdefghijklmnop',
  organisationId: 'org-1',
  invoiceId: 'inv-1',
  appointmentId: 'apt-1',
  amount: 120.5,
  currency: 'GBP',
  capturedAt: '2026-09-12T14:03:00.000Z',
  status: 'UNALLOCATED',
  reason: 'No invoice found',
  refundedAmount: 0,
  version: 2,
  createdAt: '2026-09-12T14:03:05.000Z',
};

const envelope = (data: unknown, meta: unknown) => ({
  data: { data, meta, error: null },
});

beforeEach(() => {
  getData.mockReset();
});

describe('listProviderReceipts', () => {
  it('requests the org-scoped queue path and maps the envelope', async () => {
    getData.mockResolvedValue(envelope([row], { nextCursor: 'cur-2', hasMore: true, limit: 50 }));

    const page = await listProviderReceipts('org-1');

    expect(getData).toHaveBeenCalledWith('/v1/finance/organisation/org-1/provider-receipts', {});
    expect(page.receipts).toHaveLength(1);
    expect(page.receipts[0]).toMatchObject({ id: 'rec-1', amount: 120.5, status: 'UNALLOCATED' });
    expect(page.nextCursor).toBe('cur-2');
    expect(page.hasMore).toBe(true);
    expect(page.limit).toBe(50);
  });

  it('encodes the organisation id as a single path segment', async () => {
    getData.mockResolvedValue(envelope([], { nextCursor: null, hasMore: false, limit: 50 }));

    await listProviderReceipts('org/../1');

    expect(getData).toHaveBeenCalledWith(
      '/v1/finance/organisation/org%2F..%2F1/provider-receipts',
      {}
    );
  });

  it('sends only the filters that are set, plus the cursor', async () => {
    getData.mockResolvedValue(envelope([], { nextCursor: null, hasMore: false, limit: 50 }));

    await listProviderReceipts(
      'org-1',
      { status: 'UNATTRIBUTED', capturedFrom: '2026-09-01T00:00:00.000Z' },
      'cur-2'
    );

    expect(getData).toHaveBeenCalledWith('/v1/finance/organisation/org-1/provider-receipts', {
      status: 'UNATTRIBUTED',
      capturedFrom: '2026-09-01T00:00:00.000Z',
      cursor: 'cur-2',
    });
  });

  it('rejects when the organisation id is missing, before any request', async () => {
    await expect(listProviderReceipts('')).rejects.toThrow('Organisation ID missing');
    expect(getData).not.toHaveBeenCalled();
  });

  it('throws the envelope error rather than returning an empty page', async () => {
    getData.mockResolvedValue({ data: { data: null, meta: null, error: { message: 'Denied' } } });

    await expect(listProviderReceipts('org-1')).rejects.toThrow('Denied');
  });

  it('falls back to the error code when the envelope error has no message', async () => {
    getData.mockResolvedValue({ data: { data: null, meta: null, error: { code: 'FORBIDDEN' } } });

    await expect(listProviderReceipts('org-1')).rejects.toThrow('FORBIDDEN');
  });

  it('treats a non-array payload as an empty page rather than crashing the table', async () => {
    getData.mockResolvedValue(envelope({ unexpected: true }, null));

    const page = await listProviderReceipts('org-1');

    expect(page.receipts).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(page.hasMore).toBe(false);
    expect(page.limit).toBe(0);
  });

  it('infers hasMore from the cursor only when the field is absent', async () => {
    getData.mockResolvedValue(envelope([], { nextCursor: 'cur-9' }));

    await expect(listProviderReceipts('org-1')).resolves.toMatchObject({ hasMore: true });
  });

  it('keeps an explicit hasMore=false even when a cursor is present', async () => {
    getData.mockResolvedValue(envelope([], { nextCursor: 'cur-9', hasMore: false }));

    await expect(listProviderReceipts('org-1')).resolves.toMatchObject({ hasMore: false });
  });

  it('keeps a receipt whose status this build does not know, as unattributed', async () => {
    getData.mockResolvedValue(envelope([{ ...row, status: 'SOME_NEW_STATE' }], null));

    const page = await listProviderReceipts('org-1');

    expect(page.receipts).toHaveLength(1);
    expect(page.receipts[0].status).toBe('UNATTRIBUTED');
  });

  it('normalises absent and non-numeric fields instead of rendering them raw', async () => {
    getData.mockResolvedValue(
      envelope([{ id: 'rec-2', amount: 'not-a-number', refundedAmount: null }], null)
    );

    const page = await listProviderReceipts('org-1');

    expect(page.receipts[0]).toMatchObject({
      id: 'rec-2',
      amount: 0,
      refundedAmount: 0,
      currency: '',
      capturedAt: '',
      organisationId: null,
      invoiceId: null,
      appointmentId: null,
      reason: null,
    });
  });

  it('survives a null row and a response with no body at all', async () => {
    getData.mockResolvedValue({ data: undefined });

    await expect(listProviderReceipts('org-1')).resolves.toEqual({
      receipts: [],
      nextCursor: null,
      hasMore: false,
      limit: 0,
    });

    getData.mockResolvedValue(envelope([null], null));
    const page = await listProviderReceipts('org-1');
    expect(page.receipts[0]).toMatchObject({ id: '', provider: '', currency: '' });
  });

  it('sends only the captured-to bound when that is the only one set', async () => {
    getData.mockResolvedValue(envelope([], null));

    await listProviderReceipts('org-1', { capturedTo: '2026-09-30T23:59:59.999Z' });

    expect(getData).toHaveBeenCalledWith('/v1/finance/organisation/org-1/provider-receipts', {
      capturedTo: '2026-09-30T23:59:59.999Z',
    });
  });

  it('falls back to its own wording when the envelope error names neither', async () => {
    getData.mockResolvedValue({ data: { data: null, meta: null, error: {} } });

    await expect(listProviderReceipts('org-1')).rejects.toThrow(
      'Unable to load the reconciliation queue.'
    );
  });
});

describe('getProviderReceiptErrorMessage', () => {
  it('prefers the nested error message the finance envelope carries', () => {
    const error = { response: { data: { error: { message: 'Not allowed here' } } } };

    expect(getProviderReceiptErrorMessage(error, 'fallback')).toBe('Not allowed here');
  });

  it('reads the bare message the finance controllers reply with', () => {
    const error = { response: { data: { message: '  Invalid reconciliation filter.  ' } } };

    expect(getProviderReceiptErrorMessage(error, 'fallback')).toBe(
      'Invalid reconciliation filter.'
    );
  });

  it('falls back to the error own message for a transport failure', () => {
    expect(getProviderReceiptErrorMessage(new Error('Network Error'), 'fallback')).toBe(
      'Network Error'
    );
  });

  it('uses the caller fallback when there is nothing readable', () => {
    expect(getProviderReceiptErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getProviderReceiptErrorMessage({ response: { data: 'text' } }, 'fallback')).toBe(
      'fallback'
    );
    expect(getProviderReceiptErrorMessage(new Error('   '), 'fallback')).toBe('fallback');
  });
});
