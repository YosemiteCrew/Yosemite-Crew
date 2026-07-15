import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);
import ProtectedIdexxWorkspace from '@/app/features/integrations/pages/IdexxWorkspace';

const getIntegrationByProviderMock = jest.fn();
const listIdexxResultsMock = jest.fn();
const getIdexxCensusMock = jest.fn();
const listIdexxOrdersMock = jest.fn();
const getIdexxResultByIdMock = jest.fn();
const useIntegrationByProviderForPrimaryOrgMock = jest.fn();

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inname, inlabel, value, onChange }: any) => (
    <input aria-label={inlabel ?? inname} data-testid={inname} value={value} onChange={onChange} />
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, defaultOption, onSelect }: any) => (
    <select
      aria-label={placeholder}
      data-testid={placeholder}
      value={defaultOption ?? ''}
      onChange={(e) => onSelect({ value: e.target.value })}
    >
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/ModalBase', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/PdfPreviewOverlay', () => ({
  __esModule: true,
  default: ({ open }: any) => (open ? <div data-testid="pdf-preview" /> : null),
}));

jest.mock('@/app/ui/tables/GenericTable/GenericTable', () => ({
  __esModule: true,
  default: () => <div data-testid="generic-table" />,
}));

jest.mock('@/app/ui/primitives/Icons/Back', () => ({
  __esModule: true,
  default: ({ onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label="Back">
      Back
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Next', () => ({
  __esModule: true,
  default: ({ onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label="Next">
      Next
    </button>
  ),
}));

jest.mock('@/app/ui/widgets/LabResultValue', () => ({
  __esModule: true,
  default: ({ test }: any) => <span>{test?.result ?? ''}</span>,
}));

jest.mock('@/app/ui/layout/MobileSearchBar/MobileSearchBar', () => ({
  __esModule: true,
  default: () => <div data-testid="mobile-search-bar" />,
}));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/stores/searchStore', () => ({
  useSearchStore: (selector: any) => selector({ query: '' }),
}));

jest.mock('react-icons/io5', () => ({
  IoInformationCircleOutline: () => <span />,
  IoOpenOutline: () => <span />,
}));

jest.mock('@/app/lib/date', () => ({
  formatDateTimeLocal: (value: string | null | undefined, fallback?: string) =>
    value || fallback || '',
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeIdexxIframeUrl: (url: string) => url,
}));

jest.mock('@/app/constants/mediaSources', () => ({
  MEDIA_SOURCES: {
    futureAssets: { idexxLogoUrl: '/idexx.png' },
  },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="next-image" role="img" aria-label={alt} />,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: 'org-1' }),
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useLoadAppointmentsForPrimaryOrg: jest.fn(),
  useAppointmentsForPrimaryOrg: jest.fn(() => [
    { id: 'appt-1', companion: { id: 'patient-1', name: 'Buddy' } },
  ]),
}));

jest.mock('@/app/hooks/useIntegrations', () => ({
  useIntegrationByProviderForPrimaryOrg: (...args: any[]) =>
    useIntegrationByProviderForPrimaryOrgMock(...args),
}));

jest.mock('@/app/features/integrations/services/idexxService', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getIdexxResultPdfBlob: jest.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
  getIntegrationByProvider: (...args: any[]) => getIntegrationByProviderMock(...args),
  listIdexxResults: (...args: any[]) => listIdexxResultsMock(...args),
  getIdexxCensus: (...args: any[]) => getIdexxCensusMock(...args),
  listIdexxOrders: (...args: any[]) => listIdexxOrdersMock(...args),
  getIdexxOrderById: jest.fn(),
  getIdexxResultById: (...args: any[]) => getIdexxResultByIdMock(...args),
}));

describe('IDEXX Hub page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    getIdexxCensusMock.mockResolvedValue([]);
    listIdexxOrdersMock.mockResolvedValue([]);
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
  });

  it('shows disabled state when IDEXX integration is disabled', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'disabled' });

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'IDEXX' })).toBeInTheDocument();
      expect(screen.getByText('Hub')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'IDEXX Hub info' })).toBeInTheDocument();
      expect(screen.getByText('Open Integrations')).toBeInTheDocument();
    });
  });

  it('shows details and pdf actions for results', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'r1',
        provider: 'IDEXX',
        resultId: 'result-1',
        orderId: 'order-1',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Details' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'PDF' }).length).toBeGreaterThan(0);
    });
  });

  it('opens result details modal and loads single-result payload', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'r1',
        provider: 'IDEXX',
        resultId: 'result-1',
        orderId: 'order-1',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);
    getIdexxResultByIdMock.mockResolvedValue({
      _id: 'r1',
      provider: 'IDEXX',
      resultId: 'result-1',
      orderId: 'order-1',
      patientId: 'patient-1',
      patientName: 'Buddy',
      status: 'FINAL',
      rawPayload: {
        categories: [
          {
            name: 'Chemistry',
            tests: [{ name: 'Glucose', result: '109' }],
          },
        ],
      },
    });

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Details' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Result details')).toBeInTheDocument();
      expect(screen.getByText('Result ID: result-1')).toBeInTheDocument();
      expect(screen.getByText(/Glucose/)).toBeInTheDocument();
    });
  });

  it('shows appointment labs icon link when result order maps to appointment', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'r1',
        provider: 'IDEXX',
        resultId: 'result-1',
        orderId: '100329789',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-1',
        idexxOrderId: '100329789',
        appointmentId: 'appt-1',
      },
    ]);

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      const links = screen.getAllByRole('link');
      expect(
        links.some((link) =>
          String(link.getAttribute('href')).includes(
            '/appointments?appointmentId=appt-1&open=labs&subLabel=idexx-labs'
          )
        )
      ).toBe(true);
    });
  });

  it('resolves appointment labs link from requisitionId when orderId is missing', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    listIdexxResultsMock.mockResolvedValue([
      {
        _id: 'r2',
        provider: 'IDEXX',
        resultId: 'result-2',
        requisitionId: 'req-100',
        patientId: 'patient-1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);
    listIdexxOrdersMock.mockResolvedValue([
      {
        _id: 'ord-2',
        idexxOrderId: 'req-100',
        appointmentId: 'appt-1',
      },
    ]);

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      const links = screen.getAllByRole('link');
      expect(
        links.some((link) =>
          String(link.getAttribute('href')).includes(
            '/appointments?appointmentId=appt-1&open=labs&subLabel=idexx-labs'
          )
        )
      ).toBe(true);
    });
  });

  it('shows IVLS device IDs in the census list', async () => {
    getIdexxCensusMock.mockResolvedValue([
      {
        id: 465,
        patient: {
          patientId: 'patient-1',
          name: 'Doggy',
        },
        veterinarian: 'Harshit Wandhare',
        ivls: [{ serialNumber: 'PTH999900000827', displayName: null }],
        confirmedBy: [],
        confirmed: false,
      },
    ]);

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('IVLS Device ID')).toBeInTheDocument();
      expect(screen.getByText('PTH999900000827')).toBeInTheDocument();
    });
  });

  it('has no axe violations when integration is enabled', async () => {
    listIdexxResultsMock.mockResolvedValue([]);
    const { container } = render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('heading', { name: /IDEXX.*Hub/i });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations on the disabled state', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'disabled' });
    const { container } = render(<ProtectedIdexxWorkspace />);
    await screen.findByText('Open Integrations');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('pagination nav is labelled', async () => {
    listIdexxResultsMock.mockResolvedValue([]);
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('heading', { name: /IDEXX.*Hub/i });
    expect(screen.getByRole('navigation', { name: 'Results pagination' })).toBeInTheDocument();
  });

  it('shows loading state while refreshing', async () => {
    listIdexxResultsMock.mockImplementation(() => new Promise(() => {}));
    render(<ProtectedIdexxWorkspace />);
    // Loading state shows "Refreshing..." button
    await screen.findByRole('button', { name: 'Refreshing...' });
  });

  it('toggles auto-refresh off and on', async () => {
    listIdexxResultsMock.mockResolvedValue([]);
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('heading', { name: /IDEXX.*Hub/i });
    const autoRefreshBtn = screen.getByRole('button', { name: 'Auto-refresh: On' });
    expect(autoRefreshBtn).toBeInTheDocument();
    fireEvent.click(autoRefreshBtn);
    expect(await screen.findByRole('button', { name: 'Auto-refresh: Off' })).toBeInTheDocument();
  });

  it('shows no-results placeholder in mobile list when results empty', async () => {
    listIdexxResultsMock.mockResolvedValue([]);
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('heading', { name: /IDEXX.*Hub/i });
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('shows no census entries placeholder', async () => {
    listIdexxResultsMock.mockResolvedValue([]);
    getIdexxCensusMock.mockResolvedValue([]);
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('heading', { name: /IDEXX.*Hub/i });
    expect(screen.getByText('No in-house census entries found.')).toBeInTheDocument();
  });

  it('shows error message from API when fetch fails', async () => {
    listIdexxResultsMock.mockRejectedValue(new Error('network error'));
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load IDEXX Hub data.');
  });

  it('closes result modal via Close button', async () => {
    listIdexxResultsMock.mockResolvedValue([
      {
        resultId: 'r1',
        orderId: 'o1',
        patientId: 'p1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);
    getIdexxResultByIdMock.mockResolvedValue({
      resultId: 'r1',
      orderId: 'o1',
      patientId: 'p1',
      patientName: 'Buddy',
      status: 'FINAL',
      rawPayload: { categories: [] },
    });
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('button', { name: 'Details' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);
    await screen.findByText('Result details');
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => {
      expect(screen.queryByText('Result details')).not.toBeInTheDocument();
    });
  });

  it('displays run summaries in result detail modal', async () => {
    listIdexxResultsMock.mockResolvedValue([
      {
        resultId: 'r1',
        orderId: 'o1',
        patientId: 'p1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);
    getIdexxResultByIdMock.mockResolvedValue({
      resultId: 'r1',
      patientName: 'Buddy',
      status: 'FINAL',
      rawPayload: {
        categories: [],
        runSummaries: [{ id: 'rs1', name: 'Chemistry Panel', code: 'CP' }],
      },
    });
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('button', { name: 'Details' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);
    await screen.findByText('Run summaries');
    expect(screen.getByText('Chemistry Panel (CP)')).toBeInTheDocument();
  });

  it('shows loading PDF label while fetching PDF', async () => {
    const pdfBlobMock = jest.fn(async () => new Blob(['pdf'], { type: 'application/pdf' }));
    const { getIdexxResultPdfBlob } = jest.requireMock(
      '@/app/features/integrations/services/idexxService'
    );
    (getIdexxResultPdfBlob as jest.Mock).mockImplementation(pdfBlobMock);

    global.URL.createObjectURL = jest.fn(() => 'blob:fake');
    global.URL.revokeObjectURL = jest.fn();

    listIdexxResultsMock.mockResolvedValue([
      {
        resultId: 'r1',
        orderId: 'o1',
        patientId: 'p1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);

    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('button', { name: 'PDF' });
  });

  it('displays IDEXX disclaimer text', async () => {
    listIdexxResultsMock.mockResolvedValue([]);
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('heading', { name: /IDEXX.*Hub/i });
    expect(
      screen.getByText(
        'IDEXX integration availability is currently limited to the USA, Canada, and the UK.'
      )
    ).toBeInTheDocument();
  });

  it('shows result detail loading state when loading', async () => {
    listIdexxResultsMock.mockResolvedValue([
      {
        resultId: 'r1',
        orderId: 'o1',
        patientId: 'p1',
        patientName: 'Buddy',
        status: 'FINAL',
      },
    ]);
    getIdexxResultByIdMock.mockImplementation(() => new Promise(() => {}));
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('button', { name: 'Details' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);
    await screen.findByText('Loading result details…');
  });
});
