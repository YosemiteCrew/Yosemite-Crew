import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

import ProtectedMerckManuals, {
  EmbeddedMerckManuals,
} from '@/app/features/integrations/pages/MerckManuals';

const useSearchParamsMock = jest.fn();
const useResolvedMerckIntegrationForPrimaryOrgMock = jest.fn();
const searchMock = jest.fn();
const isAllowedMerckUrlMock = jest.fn();
const useOrgStoreMock = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <span data-testid="mock-next-image">{props.alt || 'image'}</span>,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled, className }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled} className={className}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, href }: any) => (
    <button type="button" onClick={onClick} data-href={href}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, inname }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel || inname} value={value} onChange={onChange} />
    </label>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: () => <span>close</span>,
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => useOrgStoreMock(selector),
}));

jest.mock('@/app/hooks/useMerckIntegration', () => ({
  useResolvedMerckIntegrationForPrimaryOrg: () => useResolvedMerckIntegrationForPrimaryOrgMock(),
}));

jest.mock('@/app/features/integrations/services/merckService', () => ({
  getMerckGateway: () => ({ search: searchMock }),
  isAllowedMerckUrl: (url: string) => isAllowedMerckUrlMock(url),
}));

jest.mock('@/app/constants/mediaSources', () => ({
  MEDIA_SOURCES: {
    futureAssets: {
      merckLogoUrl: '/merck.png',
    },
  },
}));

jest.mock('@/app/features/integrations/constants/merck', () => {
  const actual = jest.requireActual('@/app/features/integrations/constants/merck');
  return {
    ...actual,
    MERCK_COPYRIGHT_NOTICE: 'copyright',
    getMerckSubtopicPillStyle: () => ({}),
  };
});

jest.mock('@/app/lib/date', () => ({
  formatDateTimeLocal: (value: string | null | undefined, fallback: string) => value || fallback,
}));

describe('MerckManuals page', () => {
  const baseEntry = {
    id: 'entry-1',
    title: 'Canine Fever',
    summaryText: '<b>summary</b>',
    updatedAt: '2026-01-01T00:00:00Z',
    audience: 'PROV' as const,
    primaryUrl: 'https://www.merckvetmanual.com/topic',
    subLinks: [{ label: 'Overview', url: 'https://www.merckvetmanual.com/topic/overview' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useOrgStoreMock.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    useSearchParamsMock.mockReturnValue({ get: () => null });
    useResolvedMerckIntegrationForPrimaryOrgMock.mockReturnValue({
      integration: { source: 'backend' },
      isEnabled: true,
    });
    searchMock.mockResolvedValue({ entries: [baseEntry] });
    isAllowedMerckUrlMock.mockImplementation((url: string) => {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return host === 'merckvetmanual.com' || host.endsWith('.merckvetmanual.com');
      } catch {
        return false;
      }
    });
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows disabled state when integration is disabled', () => {
    useResolvedMerckIntegrationForPrimaryOrgMock.mockReturnValue({
      integration: { source: 'backend' },
      isEnabled: false,
    });

    render(<ProtectedMerckManuals />);

    expect(
      screen.getByText('MSD Veterinary Manual is disabled for this organization.')
    ).toBeInTheDocument();
    expect(screen.getByText('Manage Integrations')).toBeInTheDocument();
  });

  it('executes search and renders allowed results', async () => {
    render(<ProtectedMerckManuals />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));
    expect(searchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        query: 'fever',
        audience: 'PROV',
      })
    );
    expect(screen.getByText('Canine Fever')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('aligns the search row along the bottom with a 48px Search button, matching the field height (regression for search-row alignment)', () => {
    render(<ProtectedMerckManuals />);

    const searchInput = screen.getByLabelText('Search manuals');
    const row = searchInput.closest('.items-end');
    expect(row).not.toBeNull();

    const searchButton = screen.getByRole('button', { name: 'Search' });
    expect(row).toContainElement(searchButton);
    expect(searchButton.className).toContain('h-12!');
  });

  it('filters out disallowed results', async () => {
    searchMock.mockResolvedValue({
      entries: [
        baseEntry,
        {
          ...baseEntry,
          id: 'blocked',
          title: 'Blocked',
          primaryUrl: 'https://evil.com/x',
          subLinks: [],
        },
      ],
    });

    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'query' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument();
  });

  it('copies URL and shows success message', async () => {
    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Copy URL'));

    await waitFor(() => expect(screen.getByText('Copied URL to clipboard.')).toBeInTheDocument());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(baseEntry.primaryUrl);
  });

  it('shows copy error when clipboard write fails', async () => {
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
      new Error('clipboard failed')
    );

    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Copy URL'));

    await waitFor(() => expect(screen.getByText('Unable to copy URL.')).toBeInTheDocument());
  });

  it('opens and closes embedded reader for allowed URLs', async () => {
    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Open'));

    await waitFor(() => expect(screen.getByTitle('Canine Fever')).toBeInTheDocument());
    expect(document.body.querySelector('[data-merck-reader-overlay="true"]')).toHaveClass(
      'fixed',
      'inset-0',
      'z-10000'
    );
    expect(screen.getByTitle('Canine Fever')).toHaveAttribute('referrerpolicy', 'strict-origin');
    fireEvent.click(screen.getByLabelText('Close Merck reader'));
    await waitFor(() => expect(screen.queryByTitle('Canine Fever')).not.toBeInTheDocument());
  });

  it('shows blocked URL error for disallowed open action', async () => {
    searchMock.mockResolvedValue({ entries: [{ ...baseEntry, subLinks: [] }] });

    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());
    isAllowedMerckUrlMock.mockReturnValue(false);
    fireEvent.click(screen.getByText('Open'));
    expect(
      screen.getByText('Blocked URL: only Merck/MSD Vet Manual links are allowed.')
    ).toBeInTheDocument();
  });

  it('auto-searches when q query param exists and integration is enabled', async () => {
    useSearchParamsMock.mockReturnValue({
      get: (key: string) => (key === 'q' ? 'renal disease' : null),
    });

    render(<ProtectedMerckManuals />);

    await waitFor(() => expect(searchMock).toHaveBeenCalled());
    expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ query: 'renal disease' }));
  });

  it('has no axe violations on initial render (enabled)', async () => {
    const { container } = render(<ProtectedMerckManuals />);
    await screen.findByRole('heading', { name: 'MSD Veterinary Manual' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when integration is disabled', async () => {
    useResolvedMerckIntegrationForPrimaryOrgMock.mockReturnValue({
      integration: { source: 'backend' },
      isEnabled: false,
    });
    const { container } = render(<ProtectedMerckManuals />);
    await screen.findByText('MSD Veterinary Manual is disabled for this organization.');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('audience toggle exposes aria-pressed for each mode', () => {
    render(<ProtectedMerckManuals />);
    const profButton = screen.getByRole('button', { name: 'Veterinary professional' });
    const consButton = screen.getByRole('button', { name: 'Pet parent version' });
    expect(profButton).toHaveAttribute('aria-pressed', 'true');
    expect(consButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the connected header with a Manage Integrations link when enabled', async () => {
    render(<ProtectedMerckManuals />);
    await screen.findByRole('heading', { name: 'MSD Veterinary Manual' });
    expect(screen.getByRole('link', { name: 'Manage Integrations' })).toHaveAttribute(
      'href',
      '/integrations'
    );
  });

  it('renders the design no-results state and results count for the query', async () => {
    searchMock.mockResolvedValueOnce({ entries: [] });
    render(<ProtectedMerckManuals />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'otittis' } });
    fireEvent.click(screen.getByText('Search'));

    expect(await screen.findByText('No results for “otittis”')).toBeInTheDocument();
    expect(screen.getByText(/Check the spelling or try a broader term/)).toBeInTheDocument();

    // Now a query with results shows the count line
    searchMock.mockResolvedValueOnce({ entries: [baseEntry] });
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));

    expect(await screen.findByText('1 results for “fever”')).toBeInTheDocument();
  });

  it('renders the reader chrome with the audience badge and copies from the reader', async () => {
    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Open'));

    await waitFor(() => expect(screen.getByTitle('Canine Fever')).toBeInTheDocument());
    const overlay = document.body.querySelector(
      '[data-merck-reader-overlay="true"]'
    ) as HTMLElement;
    expect(within(overlay).getByText('PROFESSIONAL')).toBeInTheDocument();
    expect(
      within(overlay).getByText(
        "Content © MSD Veterinary Manual · displayed under your clinic's integration"
      )
    ).toBeInTheDocument();

    fireEvent.click(within(overlay).getByRole('button', { name: 'Copy manual URL' }));
    await waitFor(() => expect(screen.getByText('Copied URL to clipboard.')).toBeInTheDocument());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(baseEntry.primaryUrl);
  });

  it('re-runs the search when the audience changes after a query', async () => {
    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Pet parent version' }));

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
    expect(searchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ audience: 'PAT', query: 'fever' })
    );
  });

  it('does not search when the audience changes without a query', () => {
    render(<ProtectedMerckManuals />);
    fireEvent.click(screen.getByRole('button', { name: 'Pet parent version' }));
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('language filter pills expose aria-pressed state', async () => {
    render(<ProtectedMerckManuals />);
    fireEvent.click(screen.getByLabelText('Show filters'));
    await screen.findByRole('button', { name: 'EN' });
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ES' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('surfaces object, message and fallback error shapes when a search fails', async () => {
    searchMock.mockRejectedValueOnce({
      response: { data: { message: 'Server is down for maintenance.' } },
    });
    render(<ProtectedMerckManuals />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));
    expect(await screen.findByText('Server is down for maintenance.')).toBeInTheDocument();

    searchMock.mockRejectedValueOnce(new Error('Network unreachable'));
    fireEvent.click(screen.getByText('Search'));
    expect(await screen.findByText('Network unreachable')).toBeInTheDocument();

    searchMock.mockRejectedValueOnce({});
    fireEvent.click(screen.getByText('Search'));
    expect(await screen.findByText('Unable to search manuals right now.')).toBeInTheDocument();
  });

  it('clears the reader loader once the iframe finishes loading', async () => {
    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));
    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Open'));
    const iframe = await screen.findByTitle('Canine Fever');
    expect(screen.getByText(/Fetching/)).toBeInTheDocument();

    fireEvent.load(iframe);
    await waitFor(() => expect(screen.queryByText(/Fetching/)).not.toBeInTheDocument());
  });

  it('falls back to open-in-new-tab when the reader load times out (framing refused)', async () => {
    jest.useFakeTimers();
    try {
      render(<ProtectedMerckManuals />);
      fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
      fireEvent.click(screen.getByText('Search'));
      await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Open'));
      await screen.findByTitle('Canine Fever');
      expect(screen.getByText(/Fetching/)).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(12000);
      });

      const fallback = screen
        .getByText('This manual can’t be shown here')
        .closest('div') as HTMLElement;
      expect(fallback).toBeInTheDocument();
      // The infinite spinner and the un-renderable iframe are both gone.
      expect(screen.queryByText(/Fetching/)).not.toBeInTheDocument();
      expect(screen.queryByTitle('Canine Fever')).not.toBeInTheDocument();
      // The fallback reuses the "Open in new tab" action pointing at the original URL.
      const fallbackLink = within(fallback).getByRole('link', { name: /Open in new tab/ });
      expect(fallbackLink).toHaveAttribute('href', baseEntry.primaryUrl);
      expect(fallbackLink).toHaveAttribute('target', '_blank');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not fall back when the iframe loads before the timeout elapses', async () => {
    jest.useFakeTimers();
    try {
      render(<ProtectedMerckManuals />);
      fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
      fireEvent.click(screen.getByText('Search'));
      await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Open'));
      const iframe = await screen.findByTitle('Canine Fever');

      act(() => {
        fireEvent.load(iframe);
      });
      act(() => {
        jest.advanceTimersByTime(12000);
      });

      expect(screen.queryByText('This manual can’t be shown here')).not.toBeInTheDocument();
      expect(screen.queryByText(/Fetching/)).not.toBeInTheDocument();
      expect(screen.getByTitle('Canine Fever')).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('resets the blocked fallback when a new reader is opened', async () => {
    jest.useFakeTimers();
    try {
      render(<ProtectedMerckManuals />);
      fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
      fireEvent.click(screen.getByText('Search'));
      await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Open'));
      await screen.findByTitle('Canine Fever');
      act(() => {
        jest.advanceTimersByTime(12000);
      });
      expect(screen.getByText('This manual can’t be shown here')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Close Merck reader'));
      fireEvent.click(screen.getByRole('button', { name: 'Overview' }));

      expect(await screen.findByTitle('Canine Fever')).toBeInTheDocument();
      expect(screen.queryByText('This manual can’t be shown here')).not.toBeInTheDocument();
      expect(screen.getByText(/Fetching/)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('opens the reader from the title button, sub-topic pill and supports open-in-new-tab', async () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));
    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Open in new tab'));
    expect(openSpy).toHaveBeenCalledWith(baseEntry.primaryUrl, '_blank', 'noopener,noreferrer');

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(await screen.findByTitle('Canine Fever')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close Merck reader'));
    await waitFor(() => expect(screen.queryByTitle('Canine Fever')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Canine Fever' }));
    expect(await screen.findByTitle('Canine Fever')).toBeInTheDocument();

    openSpy.mockRestore();
  });

  it('renders a fallback summary when an entry has no summary text', async () => {
    searchMock.mockResolvedValueOnce({ entries: [{ ...baseEntry, summaryText: '' }] });
    render(<ProtectedMerckManuals />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));

    expect(await screen.findByText('No summary available.')).toBeInTheDocument();
  });

  it('shows the em-dash placeholder when the query is cleared after a no-results search', async () => {
    searchMock.mockResolvedValueOnce({ entries: [] });
    render(<ProtectedMerckManuals />);

    const input = screen.getByLabelText('Search manuals');
    fireEvent.change(input, { target: { value: 'zzz' } });
    fireEvent.click(screen.getByText('Search'));
    expect(await screen.findByText('No results for “zzz”')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '' } });
    expect(await screen.findByText('No results for “—”')).toBeInTheDocument();
  });

  it('serves cached entries when returning to a previously searched audience', async () => {
    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));
    await screen.findByText('Canine Fever');

    fireEvent.click(screen.getByRole('button', { name: 'Pet parent version' }));
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Veterinary professional' }));
    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('re-runs a search from a frequent-search chip', async () => {
    window.localStorage.clear();
    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));
    await screen.findByText('Canine Fever');

    const chip = await screen.findByRole('button', { name: 'fever' });
    fireEvent.click(chip);
    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());
  });

  it('ignores a stale search response when a newer request supersedes it', async () => {
    let resolveStale: (value: unknown) => void = () => undefined;
    const stalePromise = new Promise((resolve) => {
      resolveStale = resolve;
    });
    searchMock.mockReturnValueOnce(stalePromise).mockResolvedValueOnce({
      entries: [{ ...baseEntry, id: 'fresh', title: 'Fresh Result' }],
    });

    render(<ProtectedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));

    fireEvent.click(screen.getByRole('button', { name: 'Pet parent version' }));
    expect(await screen.findByText('Fresh Result')).toBeInTheDocument();

    resolveStale({ entries: [{ ...baseEntry, id: 'stale', title: 'Stale Result' }] });
    await waitFor(() => expect(screen.queryByText('Stale Result')).not.toBeInTheDocument());
    expect(screen.getByText('Fresh Result')).toBeInTheDocument();
  });

  it('renders the embedded variant and runs a search', async () => {
    render(<EmbeddedMerckManuals />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));
    expect(await screen.findByText('Canine Fever')).toBeInTheDocument();
  });

  it('hides the Manage Integrations action in the embedded disabled state', () => {
    useResolvedMerckIntegrationForPrimaryOrgMock.mockReturnValue({
      integration: { source: 'backend' },
      isEnabled: false,
    });
    render(<EmbeddedMerckManuals />);

    expect(
      screen.getByText('MSD Veterinary Manual is disabled for this organization.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Manage Integrations')).not.toBeInTheDocument();
  });

  it('does not search when there is no primary org', async () => {
    useOrgStoreMock.mockImplementation((selector: any) => selector({ primaryOrgId: null }));
    render(<ProtectedMerckManuals />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByText('Search'));
    await Promise.resolve();

    expect(searchMock).not.toHaveBeenCalled();
  });

  it('switches language pills and closes the refine panel from its own close button', async () => {
    render(<ProtectedMerckManuals />);
    fireEvent.click(screen.getByLabelText('Show filters'));

    fireEvent.click(await screen.findByRole('button', { name: 'ES' }));
    expect(screen.getByRole('button', { name: 'ES' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByLabelText('Close refine results'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'EN' })).not.toBeInTheDocument()
    );
  });
});
