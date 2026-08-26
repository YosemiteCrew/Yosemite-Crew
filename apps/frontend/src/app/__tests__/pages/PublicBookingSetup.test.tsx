import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const notifyMock = jest.fn();
const loadCatalogMock = jest.fn().mockResolvedValue(undefined);
const getConfigMock = jest.fn();
const saveConfigMock = jest.fn();

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

jest.mock('@/app/features/onboarding/services/bookingPageApiService', () => ({
  bookingPageApi: {
    getConfig: (...args: unknown[]) => getConfigMock(...args),
    saveConfig: (...args: unknown[]) => saveConfigMock(...args),
  },
}));

jest.mock('next/image', () => {
  const MockImage = ({ alt }: any) => <span data-testid="next-image">{alt}</span>;
  MockImage.displayName = 'MockNextImage';
  return { __esModule: true, default: MockImage };
});

jest.mock('react-icons/io5', () => ({
  IoArrowBack: () => <span data-testid="i-back" />,
  IoArrowForward: () => <span data-testid="i-fwd" />,
  IoCheckmark: () => <span data-testid="i-check" />,
  IoCopyOutline: () => <span data-testid="i-copy" />,
  IoGlobeOutline: () => <span data-testid="i-globe" />,
  IoSaveOutline: () => <span data-testid="i-save" />,
}));

import PublicBookingSetup from '@/app/features/onboarding/pages/PublicBookingSetup/PublicBookingSetup';

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

const config = (over: Partial<Record<string, unknown>> = {}) => ({
  organisationId: 'org-1',
  slug: null,
  publicBookingEnabled: false,
  publicUrl: null,
  serviceIds: [],
  bookingWindowDays: 28,
  bufferMinutes: 10,
  autoConfirm: false,
  welcomeMessage: null,
  replyToEmail: null,
  ...over,
});

const setClipboard = (writeText: ((v: string) => Promise<void>) | undefined) => {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
    writable: true,
  });
};

// The page loads its configuration in an effect, so every test has to let that
// promise settle before asserting - otherwise the resolution lands after the
// test body and React reports an unwrapped state update.
const renderSetup = async () => {
  render(<PublicBookingSetup />);
  await act(async () => {});
};

const goToBranding = async () => {
  await renderSetup();
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
};

describe('PublicBookingSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primaryOrgId = 'org-1';
    primaryOrg = { name: 'Alpenblick Animal Clinic', imageURL: 'https://x/logo.png' };
    getConfigMock.mockResolvedValue(config());
    saveConfigMock.mockResolvedValue(config({ slug: 'alpenblick-animal-clinic' }));
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

  it('loads the catalog and lists only bookable, active services with formatted prices', async () => {
    await renderSetup();

    expect(loadCatalogMock).toHaveBeenCalledWith('org-1');
    expect(screen.getByText('What can pet parents book?')).toBeInTheDocument();
    expect(screen.getByText('€64.00')).toBeInTheDocument();
    expect(screen.getByText('$72.00')).toBeInTheDocument();
    expect(screen.getByText('XCD 48.00')).toBeInTheDocument();
    expect(screen.getByText('€10.00')).toBeInTheDocument();
    expect(screen.queryByText('Archived one')).not.toBeInTheDocument();
    expect(screen.queryByText('Not bookable')).not.toBeInTheDocument();
    // The wizard header carries the Yosemite Crew product mark, not an org initial.
    expect(screen.getAllByTestId('next-image')[0]).toHaveTextContent('Yosemite Crew');
  });

  it('no longer claims the fields are assumed', async () => {
    await renderSetup();
    expect(screen.queryByText(/FIELDS ASSUMED/)).not.toBeInTheDocument();
  });

  it('gives the selected service row the blue border and focus-glow ring', async () => {
    await renderSetup();

    const first = screen.getByRole('button', { name: /Wellness & vaccination/ });
    expect(first).toHaveStyle({
      borderColor: 'var(--blue)',
      boxShadow: '0 0 0 3px var(--glow-b10)',
    });

    fireEvent.click(first);
    expect(first).toHaveStyle({ borderColor: 'var(--hairline)' });
  });

  it('seeds every service as selected and toggles selection', async () => {
    await renderSetup();

    const first = screen.getByRole('button', { name: /Wellness & vaccination/ });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders an empty state when no services are bookable', async () => {
    servicesState = [];
    await renderSetup();
    expect(screen.getByText(/No bookable services yet/)).toBeInTheDocument();
  });

  it('does not load the catalog or the configuration without a primary org', async () => {
    primaryOrgId = null;
    await renderSetup();
    expect(loadCatalogMock).not.toHaveBeenCalled();
    expect(getConfigMock).not.toHaveBeenCalled();
  });

  it('swallows a catalog load failure', async () => {
    loadCatalogMock.mockRejectedValueOnce(new Error('offline'));
    await renderSetup();
    await waitFor(() => expect(loadCatalogMock).toHaveBeenCalledWith('org-1'));
    expect(screen.getByText('What can pet parents book?')).toBeInTheDocument();
  });

  it('updates availability selects and the confirmation toggle', async () => {
    await renderSetup();

    const windowSelect = screen.getByLabelText('Bookable window') as HTMLSelectElement;
    fireEvent.change(windowSelect, { target: { value: '56' } });
    expect(windowSelect.value).toBe('56');

    const bufferSelect = screen.getByLabelText('Buffer between visits') as HTMLSelectElement;
    fireEvent.change(bufferSelect, { target: { value: '30' } });
    expect(bufferSelect.value).toBe('30');

    const toggle = screen.getByRole('switch', { name: 'Requests need confirmation' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('notifies when skipping setup', async () => {
    await renderSetup();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(notifyMock).toHaveBeenCalledWith(
      'info',
      expect.objectContaining({ title: 'Setup skipped' })
    );
  });

  it('advances to branding, edits copy, and returns via back', async () => {
    await goToBranding();

    expect(screen.getByText('Your booking page')).toBeInTheDocument();

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

  it('falls back to a generic clinic name when no org is loaded', async () => {
    primaryOrg = null;
    await goToBranding();

    expect(screen.getByText('Your clinic')).toBeInTheDocument();
    expect(screen.getByText('No logo uploaded')).toBeInTheDocument();
  });

  it('discards a configuration that arrives after unmount', async () => {
    let release: (value: unknown) => void = () => {};
    getConfigMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const { unmount } = render(<PublicBookingSetup />);
    unmount();

    await act(async () => {
      release(config({ slug: 'late-arrival' }));
    });

    expect(screen.queryByText('late-arrival')).not.toBeInTheDocument();
  });

  describe('booking address', () => {
    it('never renders a book.yosemitecrew.com address', async () => {
      await goToBranding();
      expect(screen.queryByText(/book\.yosemitecrew\.com/)).not.toBeInTheDocument();
    });

    it('says no address exists yet before the first save', async () => {
      await goToBranding();

      expect(screen.getByText('Reserved when you save')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Copy/ })).not.toBeInTheDocument();
    });

    it('shows the reserved slug without a copy button while the page is not live', async () => {
      getConfigMock.mockResolvedValue(config({ slug: 'alpenblick-animal-clinic' }));
      await goToBranding();

      expect(screen.getByText('alpenblick-animal-clinic')).toBeInTheDocument();
      expect(screen.getByText(/not live yet, so there is no link to share/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Copy/ })).not.toBeInTheDocument();
    });

    it('shows the real address with a copy button once the API reports one', async () => {
      getConfigMock.mockResolvedValue(
        config({
          slug: 'alpenblick-animal-clinic',
          publicBookingEnabled: true,
          publicUrl: 'https://app.example.com/book/alpenblick-animal-clinic',
        })
      );
      await goToBranding();

      expect(
        screen.getByText('https://app.example.com/book/alpenblick-animal-clinic')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    });

    it('copies the address the API supplied', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      setClipboard(writeText);
      getConfigMock.mockResolvedValue(
        config({
          slug: 'alpenblick-animal-clinic',
          publicBookingEnabled: true,
          publicUrl: 'https://app.example.com/book/alpenblick-animal-clinic',
        })
      );
      await goToBranding();

      fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument()
      );
      expect(writeText).toHaveBeenCalledWith(
        'https://app.example.com/book/alpenblick-animal-clinic'
      );
    });

    it('degrades gracefully when the clipboard is unavailable', async () => {
      setClipboard(undefined);
      getConfigMock.mockResolvedValue(
        config({ slug: 'x', publicBookingEnabled: true, publicUrl: 'https://a/book/x' })
      );
      await goToBranding();

      fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
      await waitFor(() => expect(loadCatalogMock).toHaveBeenCalled());
      expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    });

    it('degrades gracefully when the clipboard write rejects', async () => {
      const writeText = jest.fn().mockRejectedValue(new Error('blocked'));
      setClipboard(writeText);
      getConfigMock.mockResolvedValue(
        config({ slug: 'x', publicBookingEnabled: true, publicUrl: 'https://a/book/x' })
      );
      await goToBranding();

      fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    });
  });

  describe('loading stored configuration', () => {
    it('restores the saved window, buffer, confirmation mode and copy', async () => {
      getConfigMock.mockResolvedValue(
        config({
          bookingWindowDays: 56,
          bufferMinutes: 30,
          autoConfirm: true,
          welcomeMessage: 'Stored welcome',
          replyToEmail: 'stored@example.com',
        })
      );
      await renderSetup();

      await waitFor(() =>
        expect((screen.getByLabelText('Bookable window') as HTMLSelectElement).value).toBe('56')
      );
      expect((screen.getByLabelText('Buffer between visits') as HTMLSelectElement).value).toBe(
        '30'
      );
      expect(screen.getByRole('switch', { name: 'Requests need confirmation' })).toHaveAttribute(
        'aria-checked',
        'false'
      );

      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
      expect((screen.getByLabelText('Welcome message') as HTMLInputElement).value).toBe(
        'Stored welcome'
      );
      expect((screen.getByLabelText('Confirmation email reply-to') as HTMLInputElement).value).toBe(
        'stored@example.com'
      );
    });

    it('restores a stored service selection instead of selecting everything', async () => {
      getConfigMock.mockResolvedValue(config({ serviceIds: ['s2'] }));
      await renderSetup();

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Wellness & vaccination/ })).toHaveAttribute(
          'aria-pressed',
          'false'
        )
      );
      expect(screen.getByRole('button', { name: /Sick visit/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('falls back to defaults and shows no address when the load fails', async () => {
      getConfigMock.mockRejectedValue(new Error('offline'));
      await goToBranding();

      expect(screen.getByText('Reserved when you save')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Copy/ })).not.toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('sends the selected services and settings to the API', async () => {
      await renderSetup();
      await waitFor(() => expect(getConfigMock).toHaveBeenCalled());

      fireEvent.click(screen.getByRole('button', { name: /Wellness & vaccination/ }));
      fireEvent.change(screen.getByLabelText('Bookable window'), { target: { value: '14' } });
      fireEvent.change(screen.getByLabelText('Buffer between visits'), { target: { value: '0' } });
      fireEvent.click(screen.getByRole('switch', { name: 'Requests need confirmation' }));
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
      fireEvent.change(screen.getByLabelText('Welcome message'), {
        target: { value: '  Come and see us  ' },
      });
      fireEvent.change(screen.getByLabelText('Confirmation email reply-to'), {
        target: { value: 'desk@x.vet' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Save booking setup/ }));

      await waitFor(() => expect(saveConfigMock).toHaveBeenCalled());
      const [orgId, payload] = saveConfigMock.mock.calls[0];
      expect(orgId).toBe('org-1');
      expect(payload).toEqual({
        serviceIds: expect.not.arrayContaining(['s1']),
        bookingWindowDays: 14,
        bufferMinutes: 0,
        autoConfirm: true,
        welcomeMessage: 'Come and see us',
        replyToEmail: 'desk@x.vet',
      });
    });

    it('sends blank optional text as null', async () => {
      await goToBranding();

      fireEvent.change(screen.getByLabelText('Welcome message'), { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: /Save booking setup/ }));

      await waitFor(() => expect(saveConfigMock).toHaveBeenCalled());
      expect(saveConfigMock.mock.calls[0][1]).toMatchObject({
        welcomeMessage: null,
        replyToEmail: null,
      });
    });

    it('tells the practice the page is not open yet when the API reports no address', async () => {
      await goToBranding();

      fireEvent.click(screen.getByRole('button', { name: /Save booking setup/ }));

      await waitFor(() =>
        expect(notifyMock).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({
            title: 'Booking setup saved',
            text: expect.stringContaining('not open to pet parents yet'),
          })
        )
      );
    });

    it('tells the practice the page is live when the API returns an address', async () => {
      saveConfigMock.mockResolvedValue(
        config({ slug: 'x', publicBookingEnabled: true, publicUrl: 'https://a/book/x' })
      );
      await goToBranding();

      fireEvent.click(screen.getByRole('button', { name: /Save booking setup/ }));

      await waitFor(() =>
        expect(notifyMock).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ text: expect.stringContaining('live at the address above') })
        )
      );
    });

    it('reports a save failure without claiming anything was stored', async () => {
      saveConfigMock.mockRejectedValue(new Error('500'));
      await goToBranding();

      fireEvent.click(screen.getByRole('button', { name: /Save booking setup/ }));

      await waitFor(() =>
        expect(notifyMock).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            title: 'Could not save booking setup',
            text: expect.stringContaining('Nothing was changed'),
          })
        )
      );
    });

    it('disables the button while a save is in flight', async () => {
      let release: (value: unknown) => void = () => {};
      saveConfigMock.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        })
      );
      await goToBranding();

      const button = screen.getByRole('button', { name: /Save booking setup/ });
      fireEvent.click(button);

      await waitFor(() => expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled());

      // A second click while in flight must not fire a second request.
      fireEvent.click(screen.getByRole('button', { name: /Saving/ }));
      expect(saveConfigMock).toHaveBeenCalledTimes(1);

      release(config());
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Save booking setup/ })).toBeEnabled()
      );
    });

    it('does nothing without a primary org', async () => {
      primaryOrgId = null;
      await renderSetup();
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
      fireEvent.click(screen.getByRole('button', { name: /Save booking setup/ }));

      await waitFor(() => expect(screen.getByText('Your booking page')).toBeInTheDocument());
      expect(saveConfigMock).not.toHaveBeenCalled();
    });
  });
});
