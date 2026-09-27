import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BillingReviewContent } from '@/app/features/finance/pages/BillingReview/BillingReviewScreen';
import type {
  BillingReviewItem,
  BillingReviewPage,
} from '@/app/features/finance/types/billingReview';
import { useOrgStore } from '@/app/stores/orgStore';
import { getPreferredTimeZone, setPreferredTimeZone } from '@/app/lib/timezone';

const missingInvoice: BillingReviewItem = {
  id: 'visit/1',
  appointmentDate: '2026-09-24T10:30:00.000Z',
  patientName: 'Milo',
  clientName: 'Alex Morgan',
  appointmentType: 'Wellness exam',
  invoiceId: null,
  invoiceStatus: null,
  billingStatus: 'MISSING_INVOICE',
};

const page = (
  items: BillingReviewItem[],
  overrides: Partial<BillingReviewPage> = {}
): BillingReviewPage => ({
  items,
  nextCursor: null,
  hasMore: false,
  ...overrides,
});

describe('BillingReviewContent', () => {
  beforeEach(() => {
    useOrgStore.setState({ primaryOrgId: null });
  });

  it('shows a clear empty state when there is no selected practice', () => {
    render(<BillingReviewContent loadPage={jest.fn()} />);
    expect(screen.getByText('Select a practice to view completed visits.')).toBeInTheDocument();
  });

  it('renders visit details, human labels and a link back to the invoice workspace', async () => {
    const loadPage = jest.fn().mockResolvedValue(
      page([
        missingInvoice,
        {
          ...missingInvoice,
          id: 'visit-2',
          billingStatus: 'DRAFT_INVOICE',
          invoiceStatus: 'PENDING',
          patientName: null,
          clientName: null,
        },
        {
          ...missingInvoice,
          id: 'visit-3',
          billingStatus: 'READY_FOR_BILLING',
          invoiceStatus: 'OPEN',
          patientName: null,
          clientName: null,
          appointmentType: null,
        },
      ])
    );

    render(<BillingReviewContent organisationId="org-1" loadPage={loadPage} />);

    expect(await screen.findByText('Milo')).toBeInTheDocument();
    expect(screen.getAllByText('Client: Alex Morgan')).toHaveLength(1);
    expect(screen.getByTitle('Invoice needed')).toBeInTheDocument();
    expect(screen.getByTitle('Invoice in draft')).toBeInTheDocument();
    expect(screen.getByTitle('Invoice ready')).toBeInTheDocument();
    expect(screen.getByText('Invoice pending')).toBeInTheDocument();
    expect(screen.getByText('No invoice on file')).toBeInTheDocument();
    expect(screen.getByText('Client unavailable')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Review visit' })[0]).toHaveAttribute(
      'href',
      '/appointments/visit%2F1/workspace?step=INVOICE'
    );
  });

  it('updates visit dates when the preferred timezone changes', async () => {
    const originalTimezone = getPreferredTimeZone();
    const formattedAt = (timeZone: string) =>
      new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
      }).format(new Date(missingInvoice.appointmentDate));

    try {
      act(() => setPreferredTimeZone('UTC'));
      const { container } = render(
        <BillingReviewContent
          organisationId="org-1"
          loadPage={async () => page([missingInvoice])}
        />
      );
      expect(await screen.findByText('Milo')).toBeInTheDocument();
      const date = container.querySelector('time')!;
      expect(date).toHaveTextContent(formattedAt('UTC'));

      act(() => setPreferredTimeZone('Europe/Madrid'));
      expect(date).toHaveTextContent(formattedAt('Europe/Madrid'));
    } finally {
      act(() => setPreferredTimeZone(originalTimezone));
    }
  });

  it('shows an empty result state', async () => {
    render(<BillingReviewContent organisationId="org-1" loadPage={async () => page([])} />);
    expect(await screen.findByText('You’re caught up')).toBeInTheDocument();
  });

  it('hides the previous practice rows while a different practice loads', async () => {
    let finishSecondPage: ((result: BillingReviewPage) => void) | undefined;
    const loadPage = jest
      .fn()
      .mockResolvedValueOnce(page([missingInvoice]))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSecondPage = resolve;
          })
      );
    const { rerender } = render(
      <BillingReviewContent organisationId="org-1" loadPage={loadPage} />
    );
    expect(await screen.findByText('Milo')).toBeInTheDocument();

    rerender(<BillingReviewContent organisationId="org-2" loadPage={loadPage} />);

    expect(screen.queryByText('Milo')).not.toBeInTheDocument();
    expect(screen.queryByText('1 shown')).not.toBeInTheDocument();
    await act(async () =>
      finishSecondPage?.(page([{ ...missingInvoice, id: 'visit-2', patientName: 'Pip' }]))
    );
    expect(await screen.findByText('Pip')).toBeInTheDocument();
    expect(loadPage).toHaveBeenLastCalledWith('org-2');
  });

  it('ignores a pending load-more response from the previous practice', async () => {
    let finishOldLoadMore: ((result: BillingReviewPage) => void) | undefined;
    const loadPage = jest
      .fn()
      .mockResolvedValueOnce(page([missingInvoice], { nextCursor: 'old', hasMore: true }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOldLoadMore = resolve;
          })
      )
      .mockResolvedValueOnce(
        page([{ ...missingInvoice, id: 'visit-2', patientName: 'Pip' }], {
          nextCursor: 'new',
          hasMore: true,
        })
      );
    const { rerender } = render(
      <BillingReviewContent organisationId="org-1" loadPage={loadPage} />
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Load more visits' }));

    rerender(<BillingReviewContent organisationId="org-2" loadPage={loadPage} />);
    expect(await screen.findByText('Pip')).toBeInTheDocument();
    await act(async () =>
      finishOldLoadMore?.(page([{ ...missingInvoice, id: 'visit-3', patientName: 'Toby' }]))
    );

    expect(screen.getByText('Pip')).toBeInTheDocument();
    expect(screen.queryByText('Toby')).not.toBeInTheDocument();
    expect(screen.getByText('1 shown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more visits' })).toBeEnabled();
  });

  it('loads another page and disables the action while it is pending', async () => {
    let finishSecondPage: ((result: BillingReviewPage) => void) | undefined;
    const loadPage = jest
      .fn()
      .mockResolvedValueOnce(page([missingInvoice], { nextCursor: 'next', hasMore: true }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSecondPage = resolve;
          })
      );

    render(<BillingReviewContent organisationId="org-1" loadPage={loadPage} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more visits' }));

    expect(await screen.findByRole('button', { name: 'Loading…' })).toBeDisabled();
    expect(loadPage).toHaveBeenLastCalledWith('org-1', 'next');
    await act(async () =>
      finishSecondPage?.(page([{ ...missingInvoice, id: 'visit-2', patientName: 'Pip' }]))
    );
    expect(await screen.findByText('Pip')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more visits' })).not.toBeInTheDocument();
  });

  it('allows retry after an initial load fails', async () => {
    const loadPage = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([missingInvoice]));
    render(<BillingReviewContent organisationId="org-1" loadPage={loadPage} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry loading the billing review list' })
    );
    expect(await screen.findByText('Milo')).toBeInTheDocument();
    expect(loadPage).toHaveBeenCalledTimes(2);
  });

  it('ignores a pending retry from the previous practice', async () => {
    let finishOldRetry: ((result: BillingReviewPage) => void) | undefined;
    const loadPage = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOldRetry = resolve;
          })
      )
      .mockResolvedValueOnce(page([{ ...missingInvoice, id: 'visit-2', patientName: 'Pip' }]));
    const { rerender } = render(
      <BillingReviewContent organisationId="org-1" loadPage={loadPage} />
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry loading the billing review list' })
    );

    rerender(<BillingReviewContent organisationId="org-2" loadPage={loadPage} />);
    expect(await screen.findByText('Pip')).toBeInTheDocument();
    await act(async () =>
      finishOldRetry?.(page([{ ...missingInvoice, id: 'visit-3', patientName: 'Toby' }]))
    );

    expect(screen.getByText('Pip')).toBeInTheDocument();
    expect(screen.queryByText('Toby')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the existing list when loading another page fails and offers retry', async () => {
    const loadPage = jest
      .fn()
      .mockResolvedValueOnce(page([missingInvoice], { nextCursor: 'next', hasMore: true }))
      .mockRejectedValueOnce(new Error('offline'));
    render(<BillingReviewContent organisationId="org-1" loadPage={loadPage} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Load more visits' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load more visits. Try again.'
    );
    expect(screen.getByText('Milo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading the billing review list' }));
    await waitFor(() => expect(loadPage).toHaveBeenCalledTimes(3));
  });

  it('ignores a request that resolves after the component unmounts', async () => {
    let finishPage: ((result: BillingReviewPage) => void) | undefined;
    const loadPage = jest.fn(
      () =>
        new Promise<BillingReviewPage>((resolve) => {
          finishPage = resolve;
        })
    );
    const { unmount } = render(<BillingReviewContent organisationId="org-1" loadPage={loadPage} />);
    unmount();
    await act(async () => finishPage?.(page([missingInvoice])));
  });
});
