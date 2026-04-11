import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProtectedMerckManuals from '@/app/features/integrations/pages/MerckManuals';

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
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
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

jest.mock('@/app/features/integrations/constants/merck', () => ({
  MERCK_COPYRIGHT_NOTICE: 'copyright',
  getMerckSubtopicPillStyle: () => ({}),
  sanitizeMerckHtml: (s: string) => s,
}));

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
});
