import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AppointmentMerckSearch from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/AppointmentMerckSearch';

const useOrgStoreMock = jest.fn();
const useResolvedMerckIntegrationForPrimaryOrgMock = jest.fn();
const searchMock = jest.fn();
const isAllowedMerckUrlMock = jest.fn();

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span>{alt || 'image'}</span>,
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, inname, value, onChange }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel || inname} value={value} onChange={onChange} />
    </label>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ label, testId }: any) => <div data-testid={testId}>{label}</div>,
}));

jest.mock('react-icons/io5', () => ({
  IoCloseOutline: () => <span>close-icon</span>,
  IoCopyOutline: () => <span>copy-icon</span>,
  IoOpenOutline: () => <span>open-icon</span>,
  IoOptionsOutline: () => <span>options-icon</span>,
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

jest.mock('@/app/features/integrations/constants/merck', () => ({
  MERCK_COPYRIGHT_NOTICE: 'copyright notice',
  getMerckSubtopicPillStyle: () => ({}),
  sanitizeMerckHtml: (value: string) => value,
}));

jest.mock('@/app/constants/mediaSources', () => ({
  MEDIA_SOURCES: {
    futureAssets: {
      merckLogoUrl: '/merck.png',
    },
  },
}));

describe('AppointmentMerckSearch', () => {
  const baseEntry = {
    id: 'entry-1',
    title: 'Canine Fever',
    summaryText: 'summary',
    updatedAt: '2026-01-01T00:00:00Z',
    audience: 'PROV' as const,
    primaryUrl: 'https://www.merckvetmanual.com/topic',
    subLinks: [{ label: 'Overview', url: 'https://www.merckvetmanual.com/topic/overview' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useOrgStoreMock.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    useResolvedMerckIntegrationForPrimaryOrgMock.mockReturnValue({ isEnabled: true });
    searchMock.mockResolvedValue({ entries: [baseEntry] });
    isAllowedMerckUrlMock.mockImplementation((url: string) => {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return host === 'merckvetmanual.com' || host.endsWith('.merckvetmanual.com');
      } catch {
        return false;
      }
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'open', {
      value: jest.fn(),
      configurable: true,
    });
  });

  it('shows disabled message when integration is disabled', () => {
    useResolvedMerckIntegrationForPrimaryOrgMock.mockReturnValue({ isEnabled: false });

    render(<AppointmentMerckSearch activeAppointment={null} />);

    expect(
      screen.getByText('MSD Veterinary Manual is disabled for this organization.')
    ).toBeInTheDocument();
  });

  it('searches and renders entries with safe links only', async () => {
    searchMock.mockResolvedValue({
      entries: [
        baseEntry,
        {
          ...baseEntry,
          id: 'blocked',
          title: 'Blocked result',
          primaryUrl: 'https://evil.example/manual',
          subLinks: [],
        },
      ],
    });

    render(<AppointmentMerckSearch activeAppointment={null} />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));
    expect(searchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        query: 'fever',
        audience: 'PROV',
        language: 'en',
      })
    );
    expect(screen.getByText('Canine Fever')).toBeInTheDocument();
    expect(screen.queryByText('Blocked result')).not.toBeInTheDocument();
    expect(screen.getByText('copyright notice')).toBeInTheDocument();
  });

  it('changes audience and language filters for follow-up searches', async () => {
    render(<AppointmentMerckSearch activeAppointment={null} />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'query' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Show filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'ES' }));
    fireEvent.click(screen.getByRole('button', { name: 'Consumer' }));

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
    expect(searchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        audience: 'PAT',
        language: 'es',
      })
    );
  });

  it('uses cached result for repeated search key', async () => {
    render(<AppointmentMerckSearch activeAppointment={null} />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'cache me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Consumer' }));
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Professional' }));
    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('opens reader, opens external tab and copies URL', async () => {
    render(<AppointmentMerckSearch activeAppointment={null} />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'query' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByLabelText('Close Merck reader')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open in new tab' }));
    expect(globalThis.open).toHaveBeenCalledWith(
      'https://www.merckvetmanual.com/topic',
      '_blank',
      'noopener,noreferrer'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy manual URL' }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText as jest.Mock).toHaveBeenCalledWith(
        'https://www.merckvetmanual.com/topic'
      )
    );
    expect(await screen.findByText('URL copied')).toBeInTheDocument();
  });

  it('shows API and copy errors and blocks disallowed reader URLs', async () => {
    searchMock.mockRejectedValueOnce(new Error('search failed'));
    render(<AppointmentMerckSearch activeAppointment={null} />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'query' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('search failed')).toBeInTheDocument();

    searchMock.mockResolvedValueOnce({ entries: [baseEntry] });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(screen.getByText('Canine Fever')).toBeInTheDocument());

    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('copy failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy manual URL' }));
    expect(await screen.findByText('Unable to copy URL.')).toBeInTheDocument();

    isAllowedMerckUrlMock.mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(
      screen.getByText('Blocked URL: only Merck/MSD Manual links are allowed.')
    ).toBeInTheDocument();
  });
});
