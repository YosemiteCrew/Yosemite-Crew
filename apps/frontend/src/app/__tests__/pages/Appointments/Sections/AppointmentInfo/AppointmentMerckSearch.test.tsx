import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  IoArrowForwardOutline: () => <span>arrow-forward-icon</span>,
  IoBookOutline: () => <span>book-icon</span>,
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

jest.mock('@/app/features/integrations/constants/merck', () => {
  const actual = jest.requireActual('@/app/features/integrations/constants/merck');
  return {
    ...actual,
    MERCK_COPYRIGHT_NOTICE: 'copyright notice',
    getMerckSubtopicPillStyle: () => ({}),
  };
});

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

  it('renders the in-visit popover chrome with an Open in Reference deep link', async () => {
    render(<AppointmentMerckSearch activeAppointment={null} />);

    expect(screen.getByText('MSD Manual')).toBeInTheDocument();
    expect(screen.getByText('In-visit lookup')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'otitis' } });

    const referenceLink = screen.getByRole('link', { name: /Open in Reference/ });
    expect(referenceLink).toHaveAttribute('href', '/integrations/merck-manuals?q=otitis');
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

    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Canine Fever')).toBeInTheDocument();
    });
    expect(searchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        query: 'fever',
        audience: 'PROV',
        language: 'en',
      })
    );
    // Wait for the async results render — a bare getByText here races the search
    // promise resolving and can catch the component still in its "Searching…" state.
    expect(await screen.findByText('Canine Fever')).toBeInTheDocument();
    expect(screen.queryByText('Blocked result')).not.toBeInTheDocument();
    expect(screen.getByText('copyright notice')).toBeInTheDocument();
  });

  it('highlights the first in-visit result and lists the remaining rows', async () => {
    searchMock.mockResolvedValue({
      entries: [baseEntry, { ...baseEntry, id: 'entry-2', title: 'Second result' }],
    });

    render(<AppointmentMerckSearch activeAppointment={null} />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'ear' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Canine Fever')).toBeInTheDocument();
    expect(screen.getByText('Second result')).toBeInTheDocument();
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

  it('surfaces server-provided and fallback error messages', async () => {
    searchMock.mockRejectedValueOnce({
      response: { data: { message: 'Backend exploded.' } },
    });
    render(<AppointmentMerckSearch activeAppointment={null} />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Backend exploded.')).toBeInTheDocument();

    searchMock.mockRejectedValueOnce({});
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(
      await screen.findByText('Unable to search Merck manuals right now.')
    ).toBeInTheDocument();
  });

  it('shows the no-results state after an empty search', async () => {
    searchMock.mockResolvedValueOnce({ entries: [] });
    render(<AppointmentMerckSearch activeAppointment={null} />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'zzz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('No results found')).toBeInTheDocument();
    expect(screen.getByText(/Check the spelling/)).toBeInTheDocument();
  });

  it('renders fallbacks for entries without a summary or sub-links', async () => {
    searchMock.mockResolvedValueOnce({
      entries: [{ ...baseEntry, summaryText: '', subLinks: [] }],
    });
    render(<AppointmentMerckSearch activeAppointment={null} />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('No summary available.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument();
  });

  it('does not search when there is no primary org', async () => {
    useOrgStoreMock.mockImplementation((selector: any) => selector({ primaryOrgId: null }));
    render(<AppointmentMerckSearch activeAppointment={null} />);

    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Consumer' }));
    await Promise.resolve();

    expect(searchMock).not.toHaveBeenCalled();
  });

  it('clears the reader loader once the iframe loads', async () => {
    render(<AppointmentMerckSearch activeAppointment={null} />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Canine Fever');

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const iframe = await screen.findByTitle('Canine Fever');
    expect(screen.getByTestId('appointment-merck-reader-loader')).toBeInTheDocument();
    // Without allow-same-origin, MSD's app throws reading document.cookie and the
    // frame hangs on its own loader forever.
    expect(iframe).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-popups allow-forms allow-same-origin'
    );

    fireEvent.load(iframe);
    await waitFor(() =>
      expect(screen.queryByTestId('appointment-merck-reader-loader')).not.toBeInTheDocument()
    );
  });

  it('falls back to the new-tab prompt when the reader never fires load', async () => {
    render(<AppointmentMerckSearch activeAppointment={null} />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Canine Fever');

    jest.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByTestId('appointment-merck-reader-loader')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(12000);
      });

      expect(screen.getByText(/didn.t load/)).toBeInTheDocument();
      expect(screen.queryByTestId('appointment-merck-reader-loader')).not.toBeInTheDocument();

      fireEvent.click(screen.getAllByRole('button', { name: 'Open in new tab' }).at(-1)!);
      expect(globalThis.open).toHaveBeenCalledWith(
        'https://www.merckvetmanual.com/topic',
        '_blank',
        'noopener,noreferrer'
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('opens the reader from the result title and sub-topic pills', async () => {
    render(<AppointmentMerckSearch activeAppointment={null} />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Canine Fever');

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(await screen.findByTitle('Canine Fever')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close Merck reader'));
    await waitFor(() => expect(screen.queryByTitle('Canine Fever')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Canine Fever' }));
    expect(await screen.findByTitle('Canine Fever')).toBeInTheDocument();
  });

  it('closes the reader via the header close button', async () => {
    render(<AppointmentMerckSearch activeAppointment={null} />);
    fireEvent.change(screen.getByLabelText('Search manuals'), { target: { value: 'fever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Canine Fever');

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const closeBtn = await screen.findByLabelText('Close Merck reader');
    fireEvent.mouseDown(closeBtn);
    fireEvent.click(closeBtn);

    await waitFor(() => expect(screen.queryByTitle('Canine Fever')).not.toBeInTheDocument());
  });

  it('switches the language pill and closes the refine panel from its own close button', async () => {
    render(<AppointmentMerckSearch activeAppointment={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show filters' }));

    fireEvent.click(await screen.findByRole('button', { name: 'ES' }));
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    fireEvent.click(screen.getByLabelText('Close refine results'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'EN' })).not.toBeInTheDocument()
    );
  });
});
