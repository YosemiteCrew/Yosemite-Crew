import { act, renderHook, waitFor } from '@testing-library/react';
import type { CreditNote, Invoice } from '@yosemite-crew/types';

const creditNoteServiceMock = {
  issueCreditNote: jest.fn(),
  voidCreditNote: jest.fn(),
};
jest.mock('@/app/features/finance/services/creditNoteService', () => ({
  issueCreditNote: (...args: unknown[]) => creditNoteServiceMock.issueCreditNote(...args),
  voidCreditNote: (...args: unknown[]) => creditNoteServiceMock.voidCreditNote(...args),
  // Mirrors the real helper closely enough to tell "server said why" from
  // "fall back to our own copy" - the two branches the hook depends on.
  getCreditNoteErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error && error.message.trim() ? error.message.trim() : fallback,
}));

const invoiceStoreMock = {
  upsertInvoice: jest.fn(),
};
jest.mock('@/app/stores/invoiceStore', () => ({
  useInvoiceStore: (selector: (state: { upsertInvoice: jest.Mock }) => unknown) =>
    selector({ upsertInvoice: invoiceStoreMock.upsertInvoice }),
}));

const notifyMock = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

import { useInvoiceCreditNotes } from '@/app/features/finance/hooks/useInvoiceCreditNotes';

/** A promise plus the handles to settle it, so a test can inspect mid-flight state. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const creditNote = (overrides: Partial<CreditNote> = {}): CreditNote =>
  ({
    id: 'cn-1',
    invoiceId: 'inv-1',
    creditNoteNumber: 'CN-0001',
    amount: 25,
    status: 'ISSUED',
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  }) as CreditNote;

const invoiceFixture = (overrides: Partial<Invoice> = {}): Invoice =>
  ({
    id: 'inv-1',
    organisationId: 'org-1',
    items: [],
    subtotal: 100,
    totalAmount: 100,
    currency: 'usd',
    paymentCollectionMethod: 'PAYMENT_LINK',
    status: 'PENDING',
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  }) as Invoice;

beforeEach(() => {
  creditNoteServiceMock.issueCreditNote.mockResolvedValue(creditNote());
  creditNoteServiceMock.voidCreditNote.mockResolvedValue(creditNote({ status: 'VOIDED' }));
});

describe('useInvoiceCreditNotes', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useInvoiceCreditNotes(invoiceFixture()));

    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does nothing without an invoice', () => {
    const { result } = renderHook(() => useInvoiceCreditNotes(null));

    act(() => result.current.run({ type: 'issue', amount: 25 }));

    expect(creditNoteServiceMock.issueCreditNote).not.toHaveBeenCalled();
    expect(creditNoteServiceMock.voidCreditNote).not.toHaveBeenCalled();
    expect(invoiceStoreMock.upsertInvoice).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });

  it('does nothing for an invoice that has no id yet', () => {
    // An unsaved invoice would otherwise POST to /invoices/undefined/credit-notes.
    const { result } = renderHook(() => useInvoiceCreditNotes(invoiceFixture({ id: undefined })));

    act(() => result.current.run({ type: 'void', creditNoteId: 'cn-1' }));

    expect(creditNoteServiceMock.voidCreditNote).not.toHaveBeenCalled();
    expect(invoiceStoreMock.upsertInvoice).not.toHaveBeenCalled();
  });

  it('issues a credit note with the invoice id, amount and reason', async () => {
    const { result } = renderHook(() => useInvoiceCreditNotes(invoiceFixture()));

    act(() => result.current.run({ type: 'issue', amount: 25, reason: 'Goodwill' }));

    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(creditNoteServiceMock.issueCreditNote).toHaveBeenCalledWith('inv-1', {
      amount: 25,
      reason: 'Goodwill',
    });
    expect(creditNoteServiceMock.voidCreditNote).not.toHaveBeenCalled();
  });

  it('appends the issued note to an invoice that had none', async () => {
    const { result } = renderHook(() => useInvoiceCreditNotes(invoiceFixture()));

    act(() => result.current.run({ type: 'issue', amount: 25 }));

    await waitFor(() => expect(invoiceStoreMock.upsertInvoice).toHaveBeenCalled());
    const merged = invoiceStoreMock.upsertInvoice.mock.calls[0][0] as Invoice;
    expect(merged.id).toBe('inv-1');
    expect(merged.totalAmount).toBe(100);
    expect(merged.creditNotes).toEqual([creditNote()]);
    expect(result.current.error).toBeNull();
  });

  it('keeps the notes already on the invoice when appending a new one', async () => {
    const existing = creditNote({ id: 'cn-existing', amount: 10 });
    const { result } = renderHook(() =>
      useInvoiceCreditNotes(invoiceFixture({ creditNotes: [existing] }))
    );
    creditNoteServiceMock.issueCreditNote.mockResolvedValue(creditNote({ id: 'cn-2' }));

    act(() => result.current.run({ type: 'issue', amount: 25 }));

    await waitFor(() => expect(invoiceStoreMock.upsertInvoice).toHaveBeenCalled());
    const merged = invoiceStoreMock.upsertInvoice.mock.calls[0][0] as Invoice;
    expect(merged.creditNotes?.map((note) => note.id)).toEqual(['cn-existing', 'cn-2']);
  });

  it('voids a credit note by id', async () => {
    const { result } = renderHook(() =>
      useInvoiceCreditNotes(invoiceFixture({ creditNotes: [creditNote()] }))
    );

    act(() => result.current.run({ type: 'void', creditNoteId: 'cn-1' }));

    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(creditNoteServiceMock.voidCreditNote).toHaveBeenCalledWith('inv-1', 'cn-1');
    expect(creditNoteServiceMock.issueCreditNote).not.toHaveBeenCalled();
  });

  it('replaces a note already on the invoice rather than duplicating it', async () => {
    // Voiding returns the SAME id with a new status. Appending it would show the
    // note twice in the ledger and double-count it in remainingCreditable.
    const { result } = renderHook(() =>
      useInvoiceCreditNotes(
        invoiceFixture({ creditNotes: [creditNote({ id: 'cn-keep' }), creditNote()] })
      )
    );

    act(() => result.current.run({ type: 'void', creditNoteId: 'cn-1' }));

    await waitFor(() => expect(invoiceStoreMock.upsertInvoice).toHaveBeenCalled());
    const merged = invoiceStoreMock.upsertInvoice.mock.calls[0][0] as Invoice;
    expect(merged.creditNotes).toHaveLength(2);
    expect(merged.creditNotes?.map((note) => note.id)).toEqual(['cn-keep', 'cn-1']);
    expect(merged.creditNotes?.find((note) => note.id === 'cn-1')?.status).toBe('VOIDED');
    expect(merged.creditNotes?.find((note) => note.id === 'cn-keep')?.status).toBe('ISSUED');
  });

  it('is busy while the request is in flight and idle once it settles', async () => {
    const pending = deferred<CreditNote>();
    creditNoteServiceMock.issueCreditNote.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useInvoiceCreditNotes(invoiceFixture()));

    act(() => result.current.run({ type: 'issue', amount: 25 }));

    expect(result.current.busy).toBe(true);
    expect(invoiceStoreMock.upsertInvoice).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve(creditNote());
      await pending.promise;
    });

    expect(result.current.busy).toBe(false);
    expect(invoiceStoreMock.upsertInvoice).toHaveBeenCalledTimes(1);
  });

  it('clears a previous error when a new request starts', async () => {
    creditNoteServiceMock.issueCreditNote.mockRejectedValueOnce(new Error('Nope.'));
    const { result } = renderHook(() => useInvoiceCreditNotes(invoiceFixture()));

    act(() => result.current.run({ type: 'issue', amount: 25 }));
    await waitFor(() => expect(result.current.error).toBe('Nope.'));

    const pending = deferred<CreditNote>();
    creditNoteServiceMock.issueCreditNote.mockReturnValue(pending.promise);
    act(() => result.current.run({ type: 'issue', amount: 25 }));

    expect(result.current.error).toBeNull();

    await act(async () => {
      pending.resolve(creditNote());
      await pending.promise;
    });
  });

  it('surfaces a failure message and notifies, leaving the invoice untouched', async () => {
    creditNoteServiceMock.issueCreditNote.mockRejectedValue(
      new Error('Credit note amount exceeds invoice remaining amount')
    );
    const { result } = renderHook(() => useInvoiceCreditNotes(invoiceFixture()));

    act(() => result.current.run({ type: 'issue', amount: 500 }));

    await waitFor(() =>
      expect(result.current.error).toBe('Credit note amount exceeds invoice remaining amount')
    );
    expect(result.current.busy).toBe(false);
    expect(invoiceStoreMock.upsertInvoice).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith('error', {
      title: 'Credit note not saved',
      text: 'Credit note amount exceeds invoice remaining amount',
    });
  });

  it('falls back to issue-specific copy when the failure carries no message', async () => {
    creditNoteServiceMock.issueCreditNote.mockRejectedValue({ status: 500 });
    const { result } = renderHook(() => useInvoiceCreditNotes(invoiceFixture()));

    act(() => result.current.run({ type: 'issue', amount: 25 }));

    await waitFor(() => expect(result.current.error).toBe('The credit note could not be issued.'));
  });

  it('falls back to void-specific copy when the failure carries no message', async () => {
    creditNoteServiceMock.voidCreditNote.mockRejectedValue({ status: 500 });
    const { result } = renderHook(() =>
      useInvoiceCreditNotes(invoiceFixture({ creditNotes: [creditNote()] }))
    );

    act(() => result.current.run({ type: 'void', creditNoteId: 'cn-1' }));

    await waitFor(() => expect(result.current.error).toBe('The credit note could not be voided.'));
    expect(notifyMock).toHaveBeenCalledWith('error', {
      title: 'Credit note not saved',
      text: 'The credit note could not be voided.',
    });
  });

  it('notifies success with issue copy', async () => {
    const { result } = renderHook(() => useInvoiceCreditNotes(invoiceFixture()));

    act(() => result.current.run({ type: 'issue', amount: 25 }));

    await waitFor(() => expect(notifyMock).toHaveBeenCalled());
    expect(notifyMock).toHaveBeenCalledWith('success', {
      title: 'Credit note issued',
      text: 'The credit has been recorded against this invoice.',
    });
    expect(result.current.error).toBeNull();
  });

  it('notifies success with different copy for a void', async () => {
    const { result } = renderHook(() =>
      useInvoiceCreditNotes(invoiceFixture({ creditNotes: [creditNote()] }))
    );

    act(() => result.current.run({ type: 'void', creditNoteId: 'cn-1' }));

    await waitFor(() => expect(notifyMock).toHaveBeenCalled());
    expect(notifyMock).toHaveBeenCalledWith('success', {
      title: 'Credit note voided',
      text: 'The credit note no longer reduces this invoice.',
    });
  });
});
