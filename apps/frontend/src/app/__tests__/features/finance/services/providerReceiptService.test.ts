import {
  ProviderReceiptAllocationError,
  allocateProviderReceipt,
  getProviderReceiptErrorMessage,
  listProviderReceipts,
} from '@/app/features/finance/services/providerReceiptService';

const getData = jest.fn();
const postData = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...a: unknown[]) => getData(...a),
  postData: (...a: unknown[]) => postData(...a),
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
  postData.mockReset();
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

/*
 * The write half of the queue.
 *
 * Every assertion here is about what the screen is allowed to believe after a
 * call: the receipt it renders is the stored one, a refusal arrives as
 * something it can act on rather than only print, and a retry that found the
 * decision already taken is a success.
 */

const axiosError = (status: number, data: unknown) => {
  const error = new Error(`Request failed with status code ${status}`) as Error & {
    response: { status: number; data: unknown };
  };
  error.response = { status, data };
  return error;
};

describe('allocateProviderReceipt', () => {
  const input = {
    expectedVersion: 2,
    idempotencyKey: 'key-1',
    allocations: [{ invoiceId: 'inv-1', amount: 40 }],
  };

  it('posts to the receipt-scoped allocations path and reads the stored receipt back', async () => {
    postData.mockResolvedValue({
      data: {
        data: {
          receipt: { ...row, status: 'ALLOCATED', allocatedAmount: 40, version: 3 },
          remainingAmount: 80.5,
          allocations: [{ invoiceId: 'inv-1', amount: 40 }],
        },
        meta: { replayed: false },
        error: null,
      },
    });

    const result = await allocateProviderReceipt('org-1', 'rec-1', input);

    expect(postData).toHaveBeenCalledWith(
      '/v1/finance/organisation/org-1/provider-receipts/rec-1/allocations',
      input
    );
    expect(result.receipt).toMatchObject({ status: 'ALLOCATED', allocatedAmount: 40, version: 3 });
    expect(result.remainingAmount).toBe(80.5);
    expect(result.allocations).toEqual([{ invoiceId: 'inv-1', amount: 40 }]);
    expect(result.replayed).toBe(false);
  });

  it('encodes both ids as single path segments', async () => {
    postData.mockResolvedValue({
      data: {
        data: { receipt: row, remainingAmount: 0, allocations: [] },
        meta: null,
        error: null,
      },
    });

    await allocateProviderReceipt('org/../1', 'rec/../2', input);

    expect(postData).toHaveBeenCalledWith(
      '/v1/finance/organisation/org%2F..%2F1/provider-receipts/rec%2F..%2F2/allocations',
      input
    );
  });

  it('reports a replay as the success it is', async () => {
    postData.mockResolvedValue({
      data: {
        data: {
          receipt: row,
          remainingAmount: 12,
          allocations: [{ invoiceId: 'inv-1', amount: 40 }],
        },
        meta: { replayed: true },
        error: null,
      },
    });

    await expect(allocateProviderReceipt('org-1', 'rec-1', input)).resolves.toMatchObject({
      replayed: true,
    });
  });

  it('carries the stale version out of a conflict so the screen can act on it', async () => {
    postData.mockRejectedValue(
      axiosError(409, {
        message: 'The receipt changed since it was read.',
        error: { code: 'VERSION_CONFLICT', version: 7 },
      })
    );

    await expect(allocateProviderReceipt('org-1', 'rec-1', input)).rejects.toThrow(
      ProviderReceiptAllocationError
    );

    await allocateProviderReceipt('org-1', 'rec-1', input).catch((error: unknown) => {
      expect(error).toBeInstanceOf(ProviderReceiptAllocationError);
      expect((error as ProviderReceiptAllocationError).failure).toEqual({
        code: 'VERSION_CONFLICT',
        message: 'The receipt changed since it was read.',
        version: 7,
      });
    });
  });

  it('carries the residual and the request out of an over-allocation', async () => {
    postData.mockRejectedValue(
      axiosError(409, {
        message: 'The requested allocation is more than this capture has left to apply.',
        error: { code: 'EXCEEDS_RESIDUAL', residual: 20, requested: 40 },
      })
    );

    const failure = await allocateProviderReceipt('org-1', 'rec-1', input).catch(
      (error: ProviderReceiptAllocationError) => error.failure
    );

    expect(failure).toMatchObject({ code: 'EXCEEDS_RESIDUAL', residual: 20, requested: 40 });
  });

  /*
   * A rejection this screen never asked for - a 403 from the permission
   * middleware, a proxy's error page - has no code, and every branch that
   * reacts to one treats an empty code as "not something this screen can fix".
   */
  it('reads a refusal with no structured half as a message and nothing more', async () => {
    postData.mockRejectedValue(axiosError(403, { message: 'Forbidden' }));

    const failure = await allocateProviderReceipt('org-1', 'rec-1', input).catch(
      (error: ProviderReceiptAllocationError) => error.failure
    );

    expect(failure).toEqual({ code: '', message: 'Forbidden' });
  });

  it('falls back to a sentence of its own when the failure carries none', async () => {
    postData.mockRejectedValue({ response: { status: 502, data: '<html>bad gateway</html>' } });

    const failure = await allocateProviderReceipt('org-1', 'rec-1', input).catch(
      (error: ProviderReceiptAllocationError) => error.failure
    );

    expect(failure).toEqual({ code: '', message: 'Unable to apply this captured payment.' });
  });

  it('treats an error envelope on a 200 as the refusal it is', async () => {
    postData.mockResolvedValue({
      data: { data: null, meta: null, error: { code: 'NOT_FOUND', message: 'Receipt not found.' } },
    });

    await expect(allocateProviderReceipt('org-1', 'rec-1', input)).rejects.toThrow(
      'Receipt not found.'
    );
  });

  it('refuses to build a path from a missing id', async () => {
    await expect(allocateProviderReceipt('', 'rec-1', input)).rejects.toThrow(
      'Organisation ID missing'
    );
    await expect(allocateProviderReceipt('org-1', '', input)).rejects.toThrow('Receipt ID missing');
    expect(postData).not.toHaveBeenCalled();
  });
});
