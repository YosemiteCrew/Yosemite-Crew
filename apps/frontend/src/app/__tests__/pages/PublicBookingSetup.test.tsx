import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const notifyMock = jest.fn();
const loadCatalogMock = jest.fn().mockResolvedValue(undefined);

let servicesState: any[] = [];
let primaryOrgId: string | null = 'org-1';
let primaryOrg: any = null;

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: (selector: any) =>
    selector({ services: servicesState, loadOrganisationCatalog: loadCatalogMock }),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId }),
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: () => primaryOrg,
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

jest.mock('next/image', () => {
  const MockImage = ({ alt }: any) => <span data-testid="next-image">{alt}</span>;
  MockImage.displayName = 'MockNextImage';
  return { __esModule: true, default: MockImage };
});

jest.mock('react-icons/io5', () => ({
  IoAlertCircleOutline: () => <span data-testid="i-alert" />,
  IoArrowBack: () => <span data-testid="i-back" />,
  IoArrowForward: () => <span data-testid="i-fwd" />,
  IoCheckmark: () => <span data-testid="i-check" />,
  IoCopyOutline: () => <span data-testid="i-copy" />,
  IoGlobeOutline: () => <span data-testid="i-globe" />,
  IoRocketOutline: () => <span data-testid="i-rocket" />,
}));

import PublicBookingSetup from '@/app/features/onboarding/pages/PublicBookingSetup/PublicBookingSetup';
import { slugify } from '@/app/features/onboarding/pages/PublicBookingSetup/publicBookingSetup.utils';

const svc = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 's1',
  name: 'Wellness & vaccination',
  durationMinutes: 30,
  grossAmount: 64,
  currency: 'EUR',
  isBookable: true,
  status: 'ACTIVE',
  ...over,
});

const setClipboard = (writeText: ((v: string) => Promise<void>) | undefined) => {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
    writable: true,
  });
};

describe('PublicBookingSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primaryOrgId = 'org-1';
    primaryOrg = { name: 'Alpenblick Animal Clinic', imageURL: 'https://x/logo.png' };
    servicesState = [
      svc(),
      svc({ id: 's2', name: 'Sick visit', grossAmount: 72, currency: 'USD' }),
      svc({ id: 's3', name: 'Dental', grossAmount: 48, currency: 'XCD' }),
      svc({ id: 's6', name: 'No currency', grossAmount: 10, currency: undefined }),
      svc({ id: 's4', name: 'Archived one', status: 'ARCHIVED' }),
      svc({ id: 's5', name: 'Not bookable', isBookable: false }),
    ];
  });

  afterEach(() => setClipboard(undefined));

  describe('slugify', () => {
    it('slugifies names and falls back to a default', () => {
      expect(slugify('Alpenblick Animal Clinic')).toBe('alpenblick-animal-clinic');
      expect(slugify('!!!')).toBe('your-clinic');
      expect(slugify('')).toBe('your-clinic');
    });
  });

  it('loads the catalog and lists only bookable, active services with formatted prices', () => {
    render(<PublicBookingSetup />);

    expect(loadCatalogMock).toHaveBeenCalledWith('org-1');
    expect(screen.getByText('What can pet parents book?')).toBeInTheDocument();
    expect(screen.getByText('€64.00')).toBeInTheDocument();
    expect(screen.getByText('$72.00')).toBeInTheDocument();
    expect(screen.getByText('XCD 48.00')).toBeInTheDocument();
    expect(screen.getByText('€10.00')).toBeInTheDocument();
    expect(screen.queryByText('Archived one')).not.toBeInTheDocument();
    expect(screen.queryByText('Not bookable')).not.toBeInTheDocument();
    expect(screen.getByText('FIELDS ASSUMED · confirm with product')).toBeInTheDocument();
    // The wizard header carries the Yosemite Crew product mark, not an org initial.
    expect(screen.getAllByTestId('next-image')[0]).toHaveTextContent('Yosemite Crew');
  });

  it('gives the selected service row the blue border and focus-glow ring', () => {
    render(<PublicBookingSetup />);

    const first = screen.getByRole('button', { name: /Wellness & vaccination/ });
    expect(first).toHaveStyle({
      borderColor: 'var(--blue)',
      boxShadow: '0 0 0 3px var(--glow-b10)',
    });

    fireEvent.click(first);
    expect(first).toHaveStyle({ borderColor: 'var(--hairline)' });
  });

  it('seeds every service as selected and toggles selection', () => {
    render(<PublicBookingSetup />);

    const first = screen.getByRole('button', { name: /Wellness & vaccination/ });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders an empty state when no services are bookable', () => {
    servicesState = [];
    render(<PublicBookingSetup />);
    expect(screen.getByText(/No bookable services yet/)).toBeInTheDocument();
  });

  it('does not load the catalog without a primary org', () => {
    primaryOrgId = null;
    render(<PublicBookingSetup />);
    expect(loadCatalogMock).not.toHaveBeenCalled();
  });

  it('swallows a catalog load failure', async () => {
    loadCatalogMock.mockRejectedValueOnce(new Error('offline'));
    render(<PublicBookingSetup />);
    await waitFor(() => expect(loadCatalogMock).toHaveBeenCalledWith('org-1'));
    expect(screen.getByText('What can pet parents book?')).toBeInTheDocument();
  });

  it('updates availability selects and the confirmation toggle', () => {
    render(<PublicBookingSetup />);

    const windowSelect = screen.getByLabelText('Bookable window') as HTMLSelectElement;
    fireEvent.change(windowSelect, { target: { value: 'Up to 8 weeks ahead' } });
    expect(windowSelect.value).toBe('Up to 8 weeks ahead');

    const bufferSelect = screen.getByLabelText('Buffer between visits') as HTMLSelectElement;
    fireEvent.change(bufferSelect, { target: { value: '30 minutes' } });
    expect(bufferSelect.value).toBe('30 minutes');

    const toggle = screen.getByRole('switch', { name: 'Requests need confirmation' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('notifies when skipping setup', () => {
    render(<PublicBookingSetup />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(notifyMock).toHaveBeenCalledWith(
      'info',
      expect.objectContaining({ title: 'Setup skipped' })
    );
  });

  it('advances to branding, edits copy, and returns via back', () => {
    render(<PublicBookingSetup />);
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    expect(screen.getByText('Your booking page')).toBeInTheDocument();
    expect(screen.getByText('book.yosemitecrew.com/alpenblick-animal-clinic')).toBeInTheDocument();

    const welcome = screen.getByLabelText('Welcome message') as HTMLInputElement;
    fireEvent.change(welcome, { target: { value: 'Welcome to us' } });
    expect(welcome.value).toBe('Welcome to us');

    const replyTo = screen.getByLabelText('Confirmation email reply-to') as HTMLInputElement;
    fireEvent.change(replyTo, { target: { value: 'desk@x.vet' } });
    expect(replyTo.value).toBe('desk@x.vet');

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(notifyMock).toHaveBeenCalledWith(
      'info',
      expect.objectContaining({ title: 'Logo upload coming soon' })
    );

    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByText('What can pet parents book?')).toBeInTheDocument();
  });

  it('copies the public URL and handles a missing clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<PublicBookingSetup />);
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith('book.yosemitecrew.com/alpenblick-animal-clinic');
  });

  it('degrades gracefully when the clipboard is unavailable', async () => {
    setClipboard(undefined);
    render(<PublicBookingSetup />);
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    await waitFor(() => expect(loadCatalogMock).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
  });

  it('degrades gracefully when the clipboard write rejects', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('blocked'));
    setClipboard(writeText);
    render(<PublicBookingSetup />);
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
  });

  it('notifies on go live and falls back to a default clinic slug', () => {
    primaryOrg = null;
    render(<PublicBookingSetup />);
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    expect(screen.getByText('book.yosemitecrew.com/your-clinic')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Go live/ }));
    expect(notifyMock).toHaveBeenCalledWith(
      'info',
      expect.objectContaining({ title: 'Booking setup saved for review' })
    );
  });
});
