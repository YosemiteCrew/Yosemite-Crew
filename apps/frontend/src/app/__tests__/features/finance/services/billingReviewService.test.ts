import { getData } from '@/app/services/axios';
import { listBillingReview } from '@/app/features/finance/services/billingReviewService';

jest.mock('@/app/services/axios', () => ({ getData: jest.fn() }));

describe('billingReviewService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing practice before making a request', async () => {
    await expect(listBillingReview('')).rejects.toThrow('Organisation ID missing');
    expect(getData).not.toHaveBeenCalled();
  });

  it('requests and normalizes the review page', async () => {
    (getData as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            id: 'v1',
            billingStatus: 'DRAFT_INVOICE',
            patientName: 'Milo',
            appointmentDate: '2026-09-01',
          },
          { id: 'v2', billingStatus: 'READY_FOR_BILLING', invoiceStatus: 'PENDING' },
          { id: 'v3', billingStatus: 'unknown', appointmentType: 3 },
        ],
        meta: { nextCursor: 'next', hasMore: true },
      },
    });
    await expect(listBillingReview('org / one', 'cursor')).resolves.toEqual({
      items: [
        {
          id: 'v1',
          appointmentDate: '2026-09-01',
          patientName: 'Milo',
          clientName: null,
          appointmentType: null,
          invoiceId: null,
          invoiceStatus: null,
          billingStatus: 'DRAFT_INVOICE',
        },
        {
          id: 'v2',
          appointmentDate: '',
          patientName: null,
          clientName: null,
          appointmentType: null,
          invoiceId: null,
          invoiceStatus: 'PENDING',
          billingStatus: 'READY_FOR_BILLING',
        },
        {
          id: 'v3',
          appointmentDate: '',
          patientName: null,
          clientName: null,
          appointmentType: null,
          invoiceId: null,
          invoiceStatus: null,
          billingStatus: 'MISSING_INVOICE',
        },
      ],
      nextCursor: 'next',
      hasMore: true,
    });
    expect(getData).toHaveBeenCalledWith(
      '/v1/finance/organisation/org%20%2F%20one/completed-visits/billing-review',
      { limit: '50', cursor: 'cursor' }
    );
  });

  it('omits an absent cursor and safely handles malformed response bodies', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: { data: {}, meta: { nextCursor: 'next' } } });
    await expect(listBillingReview('org-1')).resolves.toEqual({
      items: [],
      nextCursor: 'next',
      hasMore: true,
    });
    expect(getData).toHaveBeenCalledWith(
      '/v1/finance/organisation/org-1/completed-visits/billing-review',
      { limit: '50' }
    );
    (getData as jest.Mock).mockResolvedValue({ data: null });
    await expect(listBillingReview('org-1')).resolves.toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it('turns API envelopes into errors', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: { error: { message: 'Not allowed' } } });
    await expect(listBillingReview('org-1')).rejects.toThrow('Not allowed');
    (getData as jest.Mock).mockResolvedValue({ data: { error: {} } });
    await expect(listBillingReview('org-1')).rejects.toThrow('Unable to load completed visits.');
  });
});
