import type { CreditNote, CreditNoteStatus } from '@yosemite-crew/types';
import {
  getCreditNoteErrorMessage,
  issueCreditNote,
  remainingCreditable,
  voidCreditNote,
} from '@/app/features/finance/services/creditNoteService';
import { postData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  postData: jest.fn(),
}));

const mockPostData = postData as jest.Mock;

const ISSUE_PATH = '/fhir/v1/invoice/inv-1/credit-notes';
const VOID_PATH = '/fhir/v1/invoice/inv-1/credit-notes/cn-1/void';

const makeCreditNote = (overrides: Partial<CreditNote> = {}): CreditNote => ({
  id: 'cn-1',
  invoiceId: 'inv-1',
  creditNoteNumber: 'CN-0001',
  amount: 25,
  status: 'ISSUED',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const noteWith = (amount: number, status: CreditNoteStatus, id: string): CreditNote =>
  makeCreditNote({ id, amount, status });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('issueCreditNote', () => {
  it('posts to the invoice router path, not the finance prefix', async () => {
    const note = makeCreditNote();
    mockPostData.mockResolvedValue({ data: { data: note, meta: null, error: null } });

    const issued = await issueCreditNote('inv-1', { amount: 25 });

    expect(mockPostData).toHaveBeenCalledTimes(1);
    expect(mockPostData.mock.calls[0][0]).toBe(ISSUE_PATH);
    expect(mockPostData.mock.calls[0][0]).not.toContain('/v1/finance');
    expect(issued).toEqual(note);
  });

  it('omits the reason key entirely when no reason is given', async () => {
    mockPostData.mockResolvedValue({ data: makeCreditNote() });

    await issueCreditNote('inv-1', { amount: 25 });

    expect(mockPostData).toHaveBeenCalledWith(ISSUE_PATH, { amount: 25 });
    const body = mockPostData.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['amount']);
  });

  it('omits the reason key for an empty string', async () => {
    mockPostData.mockResolvedValue({ data: makeCreditNote() });

    await issueCreditNote('inv-1', { amount: 10, reason: '' });

    expect(mockPostData).toHaveBeenCalledWith(ISSUE_PATH, { amount: 10 });
  });

  it('omits the reason key for a whitespace-only reason', async () => {
    mockPostData.mockResolvedValue({ data: makeCreditNote() });

    await issueCreditNote('inv-1', { amount: 10, reason: '   \n\t ' });

    expect(mockPostData).toHaveBeenCalledWith(ISSUE_PATH, { amount: 10 });
    expect(mockPostData.mock.calls[0][1]).not.toHaveProperty('reason');
  });

  it('sends the reason trimmed when one is given', async () => {
    mockPostData.mockResolvedValue({ data: makeCreditNote({ reason: 'Goodwill' }) });

    await issueCreditNote('inv-1', { amount: 40, reason: '  Goodwill  ' });

    expect(mockPostData).toHaveBeenCalledWith(ISSUE_PATH, { amount: 40, reason: 'Goodwill' });
  });

  it('accepts a bare credit note body with no envelope', async () => {
    const note = makeCreditNote({ amount: 12 });
    mockPostData.mockResolvedValue({ data: note });

    await expect(issueCreditNote('inv-1', { amount: 12 })).resolves.toEqual(note);
  });

  it('throws the envelope error message', async () => {
    mockPostData.mockResolvedValue({
      data: {
        data: null,
        meta: null,
        error: { code: 'CONFLICT', message: 'Credit note amount exceeds invoice remaining amount' },
      },
    });

    await expect(issueCreditNote('inv-1', { amount: 500 })).rejects.toThrow(
      'Credit note amount exceeds invoice remaining amount'
    );
  });

  it('throws the envelope error code when no message is present', async () => {
    mockPostData.mockResolvedValue({ data: { data: null, error: { code: 'INVOICE_LOCKED' } } });

    await expect(issueCreditNote('inv-1', { amount: 5 })).rejects.toThrow('INVOICE_LOCKED');
  });

  it('throws the generic fallback when the envelope error is empty', async () => {
    mockPostData.mockResolvedValue({ data: { data: null, error: {} } });

    await expect(issueCreditNote('inv-1', { amount: 5 })).rejects.toThrow('Finance request failed');
  });

  it('throws for a missing invoice id and makes no request', async () => {
    await expect(issueCreditNote('', { amount: 5 })).rejects.toThrow('Invoice ID missing');
    expect(mockPostData).not.toHaveBeenCalled();
  });

  it('propagates a transport failure', async () => {
    mockPostData.mockRejectedValue(new Error('Request failed with status code 409'));

    await expect(issueCreditNote('inv-1', { amount: 5 })).rejects.toThrow(
      'Request failed with status code 409'
    );
  });
});

describe('voidCreditNote', () => {
  it('posts to the void sub-path', async () => {
    const note = makeCreditNote({ status: 'VOIDED' });
    mockPostData.mockResolvedValue({ data: { data: note, meta: null, error: null } });

    const voided = await voidCreditNote('inv-1', 'cn-1');

    expect(mockPostData.mock.calls[0][0]).toBe(VOID_PATH);
    expect(voided).toEqual(note);
  });

  it('sends an empty body when no reason is given', async () => {
    mockPostData.mockResolvedValue({ data: makeCreditNote({ status: 'VOIDED' }) });

    await voidCreditNote('inv-1', 'cn-1');

    expect(mockPostData).toHaveBeenCalledWith(VOID_PATH, {});
  });

  it('sends an empty body for a whitespace-only reason', async () => {
    mockPostData.mockResolvedValue({ data: makeCreditNote({ status: 'VOIDED' }) });

    await voidCreditNote('inv-1', 'cn-1', '  ');

    expect(mockPostData).toHaveBeenCalledWith(VOID_PATH, {});
  });

  it('sends the reason trimmed when one is given', async () => {
    mockPostData.mockResolvedValue({ data: makeCreditNote({ status: 'VOIDED' }) });

    await voidCreditNote('inv-1', 'cn-1', '  Issued in error  ');

    expect(mockPostData).toHaveBeenCalledWith(VOID_PATH, { reason: 'Issued in error' });
  });

  it('accepts a bare credit note body with no envelope', async () => {
    const note = makeCreditNote({ status: 'VOIDED' });
    mockPostData.mockResolvedValue({ data: note });

    await expect(voidCreditNote('inv-1', 'cn-1')).resolves.toEqual(note);
  });

  it('throws the envelope error message', async () => {
    mockPostData.mockResolvedValue({
      data: { data: null, meta: null, error: { message: 'Credit note already voided.' } },
    });

    await expect(voidCreditNote('inv-1', 'cn-1')).rejects.toThrow('Credit note already voided.');
  });

  it('throws the envelope error code when no message is present', async () => {
    mockPostData.mockResolvedValue({ data: { data: null, error: { code: 'ALREADY_VOIDED' } } });

    await expect(voidCreditNote('inv-1', 'cn-1')).rejects.toThrow('ALREADY_VOIDED');
  });

  it('throws the generic fallback when the envelope error is empty', async () => {
    mockPostData.mockResolvedValue({ data: { data: null, error: {} } });

    await expect(voidCreditNote('inv-1', 'cn-1')).rejects.toThrow('Finance request failed');
  });

  it('throws for a missing invoice id and makes no request', async () => {
    await expect(voidCreditNote('', 'cn-1')).rejects.toThrow('Invoice ID missing');
    expect(mockPostData).not.toHaveBeenCalled();
  });

  it('throws for a missing credit note id and makes no request', async () => {
    await expect(voidCreditNote('inv-1', '')).rejects.toThrow('Credit note ID missing');
    expect(mockPostData).not.toHaveBeenCalled();
  });

  it('propagates a transport failure', async () => {
    mockPostData.mockRejectedValue(new Error('network down'));

    await expect(voidCreditNote('inv-1', 'cn-1')).rejects.toThrow('network down');
  });
});

describe('getCreditNoteErrorMessage', () => {
  it('reads the controller bare { message } body', () => {
    const error = {
      message: 'Request failed with status code 409',
      response: { data: { message: 'Credit note amount exceeds invoice remaining amount' } },
    };

    expect(getCreditNoteErrorMessage(error, 'fallback')).toBe(
      'Credit note amount exceeds invoice remaining amount'
    );
  });

  it('surfaces the "cannot accept credit notes" 409 verbatim', () => {
    const error = { response: { data: { message: 'Invoice cannot accept credit notes.' } } };

    expect(getCreditNoteErrorMessage(error, 'fallback')).toBe(
      'Invoice cannot accept credit notes.'
    );
  });

  it('reads a nested { error: { message } } body', () => {
    const error = { response: { data: { error: { message: 'Invalid credit note amount' } } } };

    expect(getCreditNoteErrorMessage(error, 'fallback')).toBe('Invalid credit note amount');
  });

  it('prefers the nested envelope message over the top-level message', () => {
    const error = {
      response: { data: { message: 'outer', error: { message: 'inner' } } },
    };

    expect(getCreditNoteErrorMessage(error, 'fallback')).toBe('inner');
  });

  it('trims the surfaced message', () => {
    const error = { response: { data: { message: '  Credit note not found  ' } } };

    expect(getCreditNoteErrorMessage(error, 'fallback')).toBe('Credit note not found');
  });

  it('falls back to a plain Error message when there is no response body', () => {
    expect(getCreditNoteErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('uses the fallback for a blank body message', () => {
    expect(getCreditNoteErrorMessage({ response: { data: { message: '   ' } } }, 'fallback')).toBe(
      'fallback'
    );
  });

  it('uses the fallback for a blank Error message', () => {
    expect(getCreditNoteErrorMessage(new Error('   '), 'fallback')).toBe('fallback');
  });

  it('uses the fallback for a non-string body message', () => {
    expect(getCreditNoteErrorMessage({ response: { data: { message: 42 } } }, 'fallback')).toBe(
      'fallback'
    );
  });

  it('uses the fallback for null, undefined, a string and a number', () => {
    expect(getCreditNoteErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getCreditNoteErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(getCreditNoteErrorMessage('nope', 'fallback')).toBe('fallback');
    expect(getCreditNoteErrorMessage(500, 'fallback')).toBe('fallback');
  });

  it('uses the fallback when the response data is not an object', () => {
    expect(getCreditNoteErrorMessage({ response: { data: 'oops' } }, 'fallback')).toBe('fallback');
  });

  it('uses the fallback when the response data is null', () => {
    expect(getCreditNoteErrorMessage({ response: { data: null } }, 'fallback')).toBe('fallback');
  });
});

describe('remainingCreditable', () => {
  it('returns the full total for an undefined list', () => {
    expect(remainingCreditable(100, undefined)).toBe(100);
  });

  it('returns the full total for an empty list', () => {
    expect(remainingCreditable(100, [])).toBe(100);
  });

  it('subtracts a single ISSUED note', () => {
    expect(remainingCreditable(100, [noteWith(30, 'ISSUED', 'cn-1')])).toBe(70);
  });

  it('subtracts every ISSUED note', () => {
    const notes = [
      noteWith(30, 'ISSUED', 'cn-1'),
      noteWith(20, 'ISSUED', 'cn-2'),
      noteWith(5, 'ISSUED', 'cn-3'),
    ];

    expect(remainingCreditable(100, notes)).toBe(45);
  });

  it('excludes VOIDED notes so voiding restores the cap', () => {
    const notes = [noteWith(30, 'ISSUED', 'cn-1'), noteWith(40, 'VOIDED', 'cn-2')];

    expect(remainingCreditable(100, notes)).toBe(70);
  });

  it('restores the whole total when every note is voided', () => {
    const notes = [noteWith(60, 'VOIDED', 'cn-1'), noteWith(40, 'VOIDED', 'cn-2')];

    expect(remainingCreditable(100, notes)).toBe(100);
  });

  it('excludes DRAFT notes as well', () => {
    expect(remainingCreditable(100, [noteWith(25, 'DRAFT', 'cn-1')])).toBe(100);
  });

  it('returns 0 for a fully credited invoice', () => {
    const notes = [noteWith(60, 'ISSUED', 'cn-1'), noteWith(40, 'ISSUED', 'cn-2')];

    expect(remainingCreditable(100, notes)).toBe(0);
  });

  it('never goes negative when the invoice is over-credited', () => {
    const notes = [noteWith(80, 'ISSUED', 'cn-1'), noteWith(50, 'ISSUED', 'cn-2')];

    expect(remainingCreditable(100, notes)).toBe(0);
  });

  it('handles a zero-total invoice', () => {
    expect(remainingCreditable(0, [])).toBe(0);
  });
});
