import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);
import ProtectedIdexxWorkspace, {
  buildResultsColumns,
  ResultDetailBody,
  OrderDetailPanel,
  getInitials,
  isResultComplete,
  formatCensusIvlsDevices,
  getCensusDeviceSerial,
  buildCensusDeviceByPatientId,
  getCensusCardStatus,
  getResultStatusTone,
  getMeterMeta,
  getOrderUiUrl,
  getOrderPdfUrl,
  buildAppointmentIdByOrderId,
  getOrderExternalStatusSuffix,
  normalizeModality,
  matchesResultQuery,
} from '@/app/features/integrations/pages/IdexxWorkspace';

const listIdexxResultsMock = jest.fn();
const getIdexxCensusMock = jest.fn();
const listIdexxOrdersMock = jest.fn();
const getIdexxResultByIdMock = jest.fn();
const getIdexxOrderByIdMock = jest.fn();
const getIdexxResultPdfBlobMock = jest.fn();
const useIntegrationByProviderForPrimaryOrgMock = jest.fn();

let mockSearchQuery = '';
let mockPrimaryOrgId: string | null = 'org-1';

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

jest.mock('@/app/hooks/useWheelToHorizontalScroll', () => ({
  useWheelToHorizontalScroll: () => () => undefined,
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

jest.mock('@/app/ui/overlays/Modal/ModalBase', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/PdfPreviewOverlay', () => ({
  __esModule: true,
  default: ({ open, onClose }: any) =>
    open ? (
      <div data-testid="pdf-preview">
        <button type="button" onClick={onClose}>
          close-pdf
        </button>
      </div>
    ) : null,
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  __esModule: true,
  YosemiteLoader: () => <div data-testid="yosemite-loader" />,
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
  useSearchStore: (selector: any) => selector({ query: mockSearchQuery }),
}));

jest.mock('react-icons/io5', () => ({
  IoAdd: () => <span />,
  IoCalendarClearOutline: () => <span />,
  IoCheckmarkCircleOutline: () => <span />,
  IoChevronDownOutline: () => <span />,
  IoDocumentAttachOutline: () => <span />,
  IoFlaskOutline: () => <span />,
  IoInformationCircleOutline: () => <span />,
  IoOpenOutline: () => <span />,
  IoRefreshOutline: () => <span />,
  IoSyncOutline: () => <span />,
}));

jest.mock('@/app/lib/date', () => ({
  formatDateTimeLocal: (value: string | null | undefined, fallback?: string) =>
    value || fallback || '',
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeIdexxIframeUrl: (url: string) => url,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick, iconOnly }: any) =>
    iconOnly ? (
      <span>close</span>
    ) : (
      <button type="button" onClick={onClick}>
        close
      </button>
    ),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: mockPrimaryOrgId }),
}));

jest.mock('@/app/hooks/useIntegrations', () => ({
  useIntegrationByProviderForPrimaryOrg: (...args: any[]) =>
    useIntegrationByProviderForPrimaryOrgMock(...args),
}));

jest.mock('@/app/features/integrations/services/idexxService', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getIdexxResultPdfBlob: (...args: any[]) => getIdexxResultPdfBlobMock(...args),
  listIdexxResults: (...args: any[]) => listIdexxResultsMock(...args),
  getIdexxCensus: (...args: any[]) => getIdexxCensusMock(...args),
  listIdexxOrders: (...args: any[]) => listIdexxOrdersMock(...args),
  getIdexxOrderById: (...args: any[]) => getIdexxOrderByIdMock(...args),
  getIdexxResultById: (...args: any[]) => getIdexxResultByIdMock(...args),
}));

const makeResult = (over: Record<string, unknown> = {}) => ({
  _id: 'r1',
  provider: 'IDEXX',
  resultId: 'result-1',
  orderId: 'order-1',
  patientId: 'patient-1',
  patientName: 'Buddy',
  status: 'FINAL',
  ...over,
});

const findHeading = () => screen.findByRole('heading', { name: /IDEXX diagnostics/i });

const showingText = () =>
  screen
    .getByText(/Showing/)
    .textContent?.replace(/\s+/g, ' ')
    .trim();

describe('IDEXX Hub page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockSearchQuery = '';
    mockPrimaryOrgId = 'org-1';
    listIdexxResultsMock.mockResolvedValue([]);
    getIdexxCensusMock.mockResolvedValue([]);
    listIdexxOrdersMock.mockResolvedValue([]);
    getIdexxResultByIdMock.mockResolvedValue(makeResult({ rawPayload: { categories: [] } }));
    getIdexxOrderByIdMock.mockResolvedValue(null);
    getIdexxResultPdfBlobMock.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'enabled' });
    global.URL.createObjectURL = jest.fn(() => 'blob:fake');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('renders the not-connected empty state when IDEXX is disabled', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'disabled' });

    render(<ProtectedIdexxWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /IDEXX diagnostics/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'IDEXX Hub info' })).toBeInTheDocument();
      expect(screen.getByText("IDEXX isn't connected yet")).toBeInTheDocument();
      expect(screen.getByText('Enable IDEXX in Integrations')).toBeInTheDocument();
      expect(screen.getByText('Open Integrations')).toBeInTheDocument();
    });
  });

  it('has no axe violations on the disabled state', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({ status: 'disabled' });
    const { container } = render(<ProtectedIdexxWorkspace />);
    await screen.findByText('Open Integrations');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations when enabled', async () => {
    const { container } = render(<ProtectedIdexxWorkspace />);
    await findHeading();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the subtitle awaiting-review count and Review action for complete results', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult()]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await waitFor(() => {
      expect(screen.getByText(/1 results awaiting review/)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Review' }).length).toBeGreaterThan(0);
    });
  });

  // The UI must not claim an acknowledgement state that does not exist anywhere:
  // not on LabResult, not in the schema, not in the API, not in the permissions.
  it('never claims results are acknowledged, only that they await review', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult()]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await screen.findByText(/1 results awaiting review/);
    expect(screen.queryByText(/acknowledge/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Acknowledge/ })).not.toBeInTheDocument();
  });

  // Acknowledging a clinical lab result must be attributable and audited. Until a
  // real server-side ack exists, nothing may be written client-side: a per-browser
  // ack would hide an abnormal result from a covering colleague. Guard that here.
  it('persists no acknowledgement state when a result is reviewed', async () => {
    const localSetItem = jest.spyOn(Storage.prototype, 'setItem');
    listIdexxResultsMock.mockResolvedValue([makeResult()]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
    await screen.findByText('Order detail');
    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(localSetItem).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe('');
    // Only the read-only IDEXX services are ever called - no ack write exists.
    expect(
      Object.keys(jest.requireMock('@/app/features/integrations/services/idexxService'))
    ).toEqual(expect.not.arrayContaining([expect.stringMatching(/ack/i)]));
    // The queue still reports the result: reviewing it does not remove it.
    expect(screen.getByText(/1 results awaiting review/)).toBeInTheDocument();
    localSetItem.mockRestore();
  });

  // The count is derived from completion alone, so it over-reports rather than
  // hiding a result - the safe direction to fail in until a real ack lands.
  it('counts every completed result as awaiting review, regardless of age', async () => {
    listIdexxResultsMock.mockResolvedValue([
      makeResult({ resultId: 'old', status: 'FINAL', updatedAt: '2019-01-01' }),
      makeResult({ resultId: 'new', status: 'COMPLETE', updatedAt: '2026-07-17' }),
      makeResult({ resultId: 'conf', status: 'CONFIRMED' }),
      makeResult({ resultId: 'pending', status: 'PENDING' }),
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await waitFor(() => expect(screen.getByText(/3 results awaiting review/)).toBeInTheDocument());
  });

  it('shows Details action for non-complete results', async () => {
    listIdexxResultsMock.mockResolvedValue([
      makeResult({ resultId: 'result-2', status: 'PENDING' }),
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    expect(await screen.findByRole('button', { name: 'Details' })).toBeInTheDocument();
  });

  it('renders status pills across statuses and patient fallbacks', async () => {
    listIdexxResultsMock.mockResolvedValue([
      makeResult({ resultId: 'a', status: 'FINAL', patientName: 'Alpha One' }),
      makeResult({ resultId: 'b', status: 'ERROR', patientName: 'Beta' }),
      makeResult({ resultId: 'c', status: 'PENDING', patientName: '' }),
      makeResult({
        resultId: 'd',
        status: 'CREATED',
        patientName: 'Delta',
        clientFirstName: 'Lena',
        clientLastName: 'Hartmann',
      }),
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await waitFor(() => {
      expect(screen.getByText('Alpha One')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('Delta')).toBeInTheDocument();
      expect(screen.getByText('Lena Hartmann')).toBeInTheDocument();
    });
  });

  it('renders result status pills with shared inventory-style badge geometry', async () => {
    listIdexxResultsMock.mockResolvedValue([
      makeResult({ resultId: 'a', status: 'COMPLETE', patientName: 'Alpha One' }),
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();

    const pill = await screen.findByText('Complete');
    expect(pill).toHaveClass(
      'yc-status-pill',
      'rounded-full!',
      'border!',
      'px-2.5',
      'py-[3px]',
      'text-[10px]',
      'font-bold',
      'uppercase',
      'tracking-[0.08em]'
    );
    expect(pill).toHaveStyle({ backgroundColor: 'var(--color-pill-success-bg)' });
  });

  it('opens the order detail slide-over and loads the payload with meters', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult({ accessionId: 'ALP-2407-0138' })]);
    getIdexxResultByIdMock.mockResolvedValue(
      makeResult({
        accessionId: 'ALP-2407-0138',
        rawPayload: {
          categories: [
            {
              name: 'Chemistry',
              tests: [
                { name: 'Glucose', result: '15', referenceRange: '10 - 20' },
                { name: 'ALT', result: '25', referenceRange: '10 - 20', outOfRange: true },
                { name: 'Note', result: 'n/a' },
              ],
            },
          ],
        },
      })
    );
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
    await waitFor(() => {
      expect(screen.getByText('Order detail')).toBeInTheDocument();
      expect(screen.getByText('Result ID: result-1')).toBeInTheDocument();
      expect(screen.getByText(/Glucose/)).toBeInTheDocument();
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  it('closes the order detail slide-over via the close button', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult()]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
    await screen.findByText('Order detail');
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => {
      expect(screen.queryByText('Order detail')).not.toBeInTheDocument();
    });
  });

  it('shows run summaries in the order detail slide-over', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult()]);
    getIdexxResultByIdMock.mockResolvedValue(
      makeResult({
        rawPayload: {
          categories: [],
          runSummaries: [{ id: 'rs1', name: 'Chemistry Panel', code: 'CP' }],
        },
      })
    );
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
    await screen.findByText('Run summaries');
    expect(screen.getByText('Chemistry Panel (CP)')).toBeInTheDocument();
  });

  it('shows the loading state inside the slide-over', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult()]);
    getIdexxResultByIdMock.mockImplementation(() => new Promise(() => {}));
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
    await screen.findByText('Loading result details…');
  });

  it('surfaces an error when result details fail to load', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult()]);
    getIdexxResultByIdMock.mockRejectedValue(new Error('boom'));
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to load result details.');
    });
  });

  it('opens, re-opens, and closes the results PDF from the slide-over', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult()]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Open results PDF' }));
    await screen.findByTestId('pdf-preview');
    // Re-open so the previous blob URL is revoked before a new one is created.
    fireEvent.click(await screen.findByRole('button', { name: 'Open results PDF' }));
    await waitFor(() => expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake'));
    fireEvent.click(screen.getByRole('button', { name: 'close-pdf' }));
    await waitFor(() => {
      expect(screen.queryByTestId('pdf-preview')).not.toBeInTheDocument();
    });
  });

  it('shows a loading label while the results PDF is fetched', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult()]);
    getIdexxResultPdfBlobMock.mockImplementation(() => new Promise(() => {}));
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Open results PDF' }));
    await screen.findByRole('button', { name: 'Loading PDF...' });
  });

  it('surfaces an error when the results PDF fails', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult()]);
    getIdexxResultPdfBlobMock.mockRejectedValue(new Error('pdf boom'));
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Open results PDF' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to load IDEXX PDF preview.');
    });
  });

  it('links a result to its appointment labs when order maps to an appointment', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult({ orderId: '100329789' })]);
    listIdexxOrdersMock.mockResolvedValue([
      { _id: 'ord-1', idexxOrderId: '100329789', appointmentId: 'appt-1' },
      { _id: 'ord-2', idexxOrderId: '', appointmentId: '' },
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
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

  it('resolves the appointment labs link from requisitionId when orderId is missing', async () => {
    listIdexxResultsMock.mockResolvedValue([
      makeResult({ resultId: 'result-2', orderId: undefined, requisitionId: 'req-100' }),
    ]);
    listIdexxOrdersMock.mockResolvedValue([
      { _id: 'ord-2', idexxOrderId: 'req-100', appointmentId: 'appt-1' },
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await waitFor(() => {
      const links = screen.getAllByRole('link');
      expect(
        links.some((link) => String(link.getAttribute('href')).includes('appointmentId=appt-1'))
      ).toBe(true);
    });
  });

  it('renders census strip statuses and the detailed census list', async () => {
    getIdexxCensusMock.mockResolvedValue([
      {
        id: 1,
        patient: { patientId: 'patient-1', name: 'Poppy' },
        veterinarian: 'Lena Hartmann',
        ivls: [{ serialNumber: 'CAT1-4402', displayName: 'Catalyst One' }],
        confirmed: true,
      },
      {
        id: 2,
        patient: { patientId: 'patient-2', name: 'Miso' },
        ivls: [{ serialNumber: 'PCD-2210', displayName: null }],
        confirmed: false,
      },
      {
        id: 3,
        patient: { patientId: 'patient-3', name: 'Fjord' },
        ivls: [],
        confirmed: false,
      },
    ]);
    listIdexxResultsMock.mockResolvedValue([
      makeResult({ resultId: 'x', patientId: 'patient-1', status: 'FINAL' }),
      makeResult({ resultId: 'y', patientId: 'patient-2', status: 'PENDING' }),
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await waitFor(() => {
      expect(screen.getByText('Results ready · awaiting review')).toBeInTheDocument();
      expect(screen.getByText('1 running')).toBeInTheDocument();
      expect(screen.getByText('Awaiting collection')).toBeInTheDocument();
      expect(screen.getByText('Catalyst One (CAT1-4402)')).toBeInTheDocument();
    });
  });

  it('shows the IVLS device id serials in the census list', async () => {
    getIdexxCensusMock.mockResolvedValue([
      {
        id: 465,
        patient: { patientId: 'patient-1', name: 'Doggy' },
        veterinarian: 'Harshit Wandhare',
        ivls: [{ serialNumber: 'PTH999900000827', displayName: null }],
        confirmedBy: [],
        confirmed: false,
      },
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await waitFor(() => {
      expect(screen.getByText('IVLS Device ID')).toBeInTheDocument();
      expect(screen.getByText('PTH999900000827')).toBeInTheDocument();
    });
  });

  it('shows the no-census placeholder when census is empty', async () => {
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    expect(screen.getByText('No in-house census entries found.')).toBeInTheDocument();
  });

  it('shows the no-results placeholder in the mobile list', async () => {
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('filters results by modality pills', async () => {
    listIdexxResultsMock.mockResolvedValue([
      makeResult({ resultId: 'in', modality: 'INHOUSE', patientName: 'InHousePet' }),
      makeResult({ resultId: 'ref', modality: 'REFERENCE_LAB', patientName: 'RefPet' }),
      makeResult({ resultId: 'none', modality: undefined, patientName: 'NoModPet' }),
      makeResult({ resultId: 'xray', modality: 'XRAY', patientName: 'XrayPet' }),
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await screen.findByText('RefPet');
    fireEvent.click(screen.getByRole('button', { name: 'In-House' }));
    await waitFor(() => {
      expect(screen.getByText('InHousePet')).toBeInTheDocument();
      expect(screen.queryByText('RefPet')).not.toBeInTheDocument();
      expect(screen.queryByText('NoModPet')).not.toBeInTheDocument();
      expect(screen.queryByText('XrayPet')).not.toBeInTheDocument();
    });
  });

  it('filters results by the awaiting-review toggle', async () => {
    listIdexxResultsMock.mockResolvedValue([
      makeResult({ resultId: 'done', status: 'FINAL', patientName: 'DonePet' }),
      makeResult({ resultId: 'wait', status: 'PENDING', patientName: 'WaitPet' }),
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await screen.findByText('WaitPet');
    fireEvent.click(screen.getByRole('button', { name: 'Awaiting review' }));
    await waitFor(() => {
      expect(screen.getByText('DonePet')).toBeInTheDocument();
      expect(screen.queryByText('WaitPet')).not.toBeInTheDocument();
    });
  });

  it('filters results by the header search query', async () => {
    mockSearchQuery = 'buddy';
    listIdexxResultsMock.mockResolvedValue([
      makeResult({ resultId: 'a', patientName: 'Buddy' }),
      makeResult({ resultId: 'b', patientName: 'Max' }),
    ]);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await waitFor(() => {
      expect(screen.getByText('Buddy')).toBeInTheDocument();
      expect(screen.queryByText('Max')).not.toBeInTheDocument();
    });
  });

  it('paginates results and adjusts to the page size', async () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      makeResult({ resultId: `r-${i}`, patientName: `Pet ${i}` })
    );
    listIdexxResultsMock.mockResolvedValue(many);
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    await waitFor(() => expect(showingText()).toContain('1-5 of 7'));

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(showingText()).toContain('6-7 of 7'));

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(showingText()).toContain('1-5 of 7'));

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(showingText()).toContain('6-7 of 7'));
    fireEvent.change(screen.getByTestId('Page size'), { target: { value: '10' } });
    await waitFor(() => expect(showingText()).toContain('1-7 of 7'));
  });

  it('toggles auto-refresh off and on', async () => {
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click(screen.getByRole('button', { name: 'Auto-refresh: On' }));
    expect(await screen.findByRole('button', { name: 'Auto-refresh: Off' })).toBeInTheDocument();
  });

  it('shows the syncing skeleton and Refreshing label while loading', async () => {
    listIdexxResultsMock.mockImplementation(() => new Promise(() => {}));
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('button', { name: 'Refreshing...' });
    expect(screen.getByText('Syncing with IDEXX…')).toBeInTheDocument();
  });

  it('refreshes from the table footer control', async () => {
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    listIdexxResultsMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Refresh from IDEXX/ }));
    await waitFor(() => expect(listIdexxResultsMock).toHaveBeenCalled());
    await screen.findByRole('button', { name: 'Refresh' });
  });

  it('shows an error message when the initial fetch fails', async () => {
    listIdexxResultsMock.mockRejectedValue(new Error('network error'));
    render(<ProtectedIdexxWorkspace />);
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load IDEXX Hub data.');
  });

  it('labels the pagination navigation and shows the disclaimer', async () => {
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    expect(screen.getByRole('navigation', { name: 'Results pagination' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'IDEXX integration availability is currently limited to the USA, Canada, and the UK.'
      )
    ).toBeInTheDocument();
  });

  it('looks up an order and opens the follow-up frame and acknowledgment', async () => {
    getIdexxOrderByIdMock.mockResolvedValue({
      _id: 'o1',
      idexxOrderId: 'IDX-1',
      status: 'SUBMITTED',
      externalStatus: 'RESULTED',
      modality: 'INHOUSE',
      uiUrl: 'https://idexx.example/ui',
      pdfUrl: 'https://idexx.example/pdf',
      updatedAt: '2026-07-10',
    });
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.change(screen.getByLabelText('IDEXX order ID'), { target: { value: 'IDX-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lookup order' }));
    await screen.findByText('Order IDX-1');
    expect(screen.getByText(/Submitted \(Resulted\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open follow-up' }));
    await screen.findByText('IDEXX follow-up hub');
    const followUpIframe = screen.getByTitle('IDEXX follow-up hub');
    expect(followUpIframe).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-popups allow-forms allow-same-origin'
    );
    // The iframe onLoad hides the loader.
    fireEvent.load(followUpIframe);
    await waitFor(() => expect(screen.queryByTestId('yosemite-loader')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Close IDEXX follow-up frame' }));
    await waitFor(() => expect(screen.queryByText('IDEXX follow-up hub')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'View acknowledgment' }));
    await screen.findByTestId('pdf-preview');
    fireEvent.click(screen.getByRole('button', { name: 'close-pdf' }));
    await waitFor(() => expect(screen.queryByTestId('pdf-preview')).not.toBeInTheDocument());
  });

  it('uses nested responsePayload urls for follow-up when direct urls are absent', async () => {
    getIdexxOrderByIdMock.mockResolvedValue({
      _id: 'o3',
      idexxOrderId: 'IDX-3',
      status: 'SUBMITTED',
      uiUrl: '',
      responsePayload: { uiURL: 'https://nested.example/ui', pdfURL: 'https://nested.example/pdf' },
    });
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.change(screen.getByLabelText('IDEXX order ID'), { target: { value: 'IDX-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lookup order' }));
    await screen.findByText('Order IDX-3');
    fireEvent.click(screen.getByRole('button', { name: 'Open follow-up' }));
    await screen.findByText('IDEXX follow-up hub');
  });

  it('guards order actions when the order has no urls', async () => {
    getIdexxOrderByIdMock.mockResolvedValue({
      _id: 'o2',
      idexxOrderId: 'IDX-2',
      status: 'CREATED',
    });
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.change(screen.getByLabelText('IDEXX order ID'), { target: { value: 'IDX-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lookup order' }));
    await screen.findByText('Order IDX-2');

    fireEvent.click(screen.getByRole('button', { name: 'Open follow-up' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Follow-up workspace URL is not available for this order.'
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'View acknowledgment' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Acknowledgment PDF is not available for this order yet.'
      )
    );
  });

  it('surfaces an error when the order lookup fails', async () => {
    getIdexxOrderByIdMock.mockRejectedValue(new Error('lookup failed'));
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.change(screen.getByLabelText('IDEXX order ID'), { target: { value: 'IDX-9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lookup order' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Order lookup failed.')
    );
    expect(screen.queryByText('Order IDX-9')).not.toBeInTheDocument();
  });

  it('exposes the appointment labs deep-link inside the order detail slide-over', async () => {
    listIdexxResultsMock.mockResolvedValue([makeResult({ orderId: '55' })]);
    listIdexxOrdersMock.mockResolvedValue([
      { _id: 'ord', idexxOrderId: '55', appointmentId: 'appt-9' },
    ]);
    getIdexxResultByIdMock.mockResolvedValue(
      makeResult({ orderId: '55', rawPayload: { categories: [] } })
    );
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
    await screen.findByText('Order detail');
    await waitFor(() => {
      const detailLinks = screen
        .getAllByRole('link')
        .filter((link) => String(link.getAttribute('href')).includes('appointmentId=appt-9'));
      expect(detailLinks.length).toBeGreaterThan(0);
    });
    // The deep-link action is enabled because a matching appointment exists. It
    // only navigates to the appointment's labs tab; it records no acknowledgement.
    expect(screen.getByRole('button', { name: 'Open in appointment labs' })).toBeEnabled();
  });

  it('treats a missing integration record as not connected', async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue(null);
    render(<ProtectedIdexxWorkspace />);
    await waitFor(() => {
      expect(screen.getByText("IDEXX isn't connected yet")).toBeInTheDocument();
    });
  });

  it('short-circuits data + lookup actions when there is no primary org', async () => {
    mockPrimaryOrgId = null;
    render(<ProtectedIdexxWorkspace />);
    await findHeading();
    // refresh() returned early, so no data services were called.
    expect(listIdexxResultsMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('IDEXX order ID'), { target: { value: 'IDX-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lookup order' }));
    expect(getIdexxOrderByIdMock).not.toHaveBeenCalled();
  });
});

describe('buildResultsColumns', () => {
  const options = {
    censusDeviceByPatientId: { 'patient-1': 'CAT1-4402' },
    getAppointmentLabsHref: (result: any) =>
      result.resultId === 'full' ? '/appointments?appointmentId=appt-1' : '',
    openResultDetails: jest.fn().mockResolvedValue(undefined),
    terminologyText: (text: string) => text,
  };
  const columns = buildResultsColumns(options as any);

  const renderRow = (result: any) =>
    render(
      <table>
        <tbody>
          <tr>
            {columns.map((column, index) => (
              <td key={String(column.key)}>
                {column.render ? column.render(result as any, index) : null}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    );

  it('renders every column for a fully populated result', () => {
    renderRow(
      makeResult({
        resultId: 'full',
        status: 'FINAL',
        accessionId: 'ALP-1',
        orderId: 'IDX-1',
        patientId: 'patient-1',
        updatedAt: '2026-07-10',
      })
    );
    expect(screen.getByText('ALP-1')).toBeInTheDocument();
    expect(screen.getByText('IDX-1')).toBeInTheDocument();
    expect(screen.getByText('CAT1-4402')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/appointments?appointmentId=appt-1');
  });

  it('falls back to placeholders for a sparse result', () => {
    renderRow(
      makeResult({
        resultId: 'empty',
        status: 'PENDING',
        patientName: undefined,
        accessionId: undefined,
        orderId: undefined,
        patientId: 'other',
        updatedAt: undefined,
      })
    );
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('ResultDetailBody', () => {
  it('shows a placeholder when no result is selected', () => {
    render(
      <ResultDetailBody
        resultDetailLoading={false}
        activeResultDetail={null}
        terminologyText={(t) => t}
      />
    );
    expect(screen.getByText('No result selected.')).toBeInTheDocument();
  });

  it('shows a loader while the detail is loading', () => {
    render(
      <ResultDetailBody resultDetailLoading activeResultDetail={null} terminologyText={(t) => t} />
    );
    expect(screen.getByText('Loading result details…')).toBeInTheDocument();
  });

  it('renders categories, meters and run summaries', () => {
    render(
      <ResultDetailBody
        resultDetailLoading={false}
        activeResultDetail={
          makeResult({
            statusDetail: 'partial',
            rawPayload: {
              categories: [
                {
                  name: 'Chem',
                  tests: [
                    { name: 'Glucose', result: '15', referenceRange: '10 - 20' },
                    { name: 'Note', result: 'x' },
                  ],
                },
              ],
              runSummaries: [{ id: '1', name: 'Panel', code: 'P' }],
            },
          }) as any
        }
        terminologyText={(t) => t}
      />
    );
    expect(screen.getByText(/Glucose/)).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText('Panel (P)')).toBeInTheDocument();
  });

  it('falls back to dashes for a sparse detail without raw payload', () => {
    render(
      <ResultDetailBody
        resultDetailLoading={false}
        activeResultDetail={
          {
            resultId: 'sparse',
            provider: 'IDEXX',
            _id: 's',
          } as any
        }
        terminologyText={(t) => t}
      />
    );
    expect(screen.getByText('Order: -')).toBeInTheDocument();
    expect(screen.getByText(/Requisition: -/)).toBeInTheDocument();
  });
});

describe('OrderDetailPanel', () => {
  const baseProps = {
    resultDetailLoading: false,
    terminologyText: (t: string) => t,
    appointmentLabsHref: '',
    pdfPreviewLoadingId: null,
    openResultPdfPreview: jest.fn().mockResolvedValue(undefined),
    onClose: jest.fn(),
  };

  it('renders the empty header and disabled footer with no active result', () => {
    render(<OrderDetailPanel {...baseProps} activeResultDetail={null} />);
    expect(screen.getByText('Order detail')).toBeInTheDocument();
    expect(screen.getByText('No result selected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in appointment labs' })).toBeDisabled();
  });

  it('renders patient fallbacks for a sparse active result', () => {
    render(
      <OrderDetailPanel
        {...baseProps}
        activeResultDetail={
          { resultId: 'sparse', provider: 'IDEXX', _id: 's', patientName: undefined } as any
        }
      />
    );
    // Accession falls back to the resultId in the title.
    expect(screen.getByText('sparse')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('IdexxWorkspace pure helpers', () => {
  it('getInitials handles multi-word, single-word and blank names', () => {
    expect(getInitials('Poppy Field')).toBe('PF');
    expect(getInitials('Poppy')).toBe('P');
    expect(getInitials(undefined)).toBe('?');
    expect(getInitials('')).toBe('?');
  });

  it('isResultComplete recognises terminal statuses', () => {
    expect(isResultComplete('FINAL')).toBe(true);
    expect(isResultComplete('complete')).toBe(true);
    expect(isResultComplete('CONFIRMED')).toBe(true);
    expect(isResultComplete('PENDING')).toBe(false);
    expect(isResultComplete(undefined)).toBe(false);
  });

  it('formatCensusIvlsDevices covers every device shape', () => {
    expect(formatCensusIvlsDevices({} as any)).toBe('-');
    expect(formatCensusIvlsDevices({ ivls: [] } as any)).toBe('-');
    expect(
      formatCensusIvlsDevices({ ivls: [{ serialNumber: 'S1', displayName: 'Cat' }] } as any)
    ).toBe('Cat (S1)');
    expect(
      formatCensusIvlsDevices({ ivls: [{ serialNumber: 'S2', displayName: null }] } as any)
    ).toBe('S2');
    expect(formatCensusIvlsDevices({ ivls: [{ serialNumber: '', displayName: '' }] } as any)).toBe(
      '-'
    );
  });

  it('getCensusDeviceSerial returns the first serial or empty', () => {
    expect(getCensusDeviceSerial({ ivls: [{ serialNumber: 'S1' }] } as any)).toBe('S1');
    expect(getCensusDeviceSerial({} as any)).toBe('');
  });

  it('buildCensusDeviceByPatientId maps patients and skips incomplete entries', () => {
    expect(
      buildCensusDeviceByPatientId([
        { patient: { patientId: 'p1' }, ivls: [{ serialNumber: 'S1' }] },
        { patient: { patientId: 'p2' }, ivls: [] },
        { patient: {}, ivls: [{ serialNumber: 'S3' }] },
      ] as any)
    ).toEqual({ p1: 'S1' });
  });

  it('getCensusCardStatus derives blue/green/amber tones', () => {
    const entry = { patient: { patientId: 'p1' } } as any;
    expect(getCensusCardStatus(entry, [{ patientId: 'p1', status: 'FINAL' }] as any)).toMatchObject(
      {
        tone: 'green',
      }
    );
    expect(
      getCensusCardStatus(entry, [{ patientId: 'p1', status: 'PENDING' }] as any)
    ).toMatchObject({ tone: 'blue', label: '1 running' });
    expect(
      getCensusCardStatus(entry, [
        { patientId: 'p1', status: 'PENDING' },
        { patientId: 'p1', status: 'FINAL' },
      ] as any).label
    ).toBe('1 running · 1 complete');
    expect(getCensusCardStatus(entry, [] as any)).toMatchObject({ tone: 'amber' });
  });

  it('getResultStatusTone maps lab statuses to shared pill tones', () => {
    expect(getResultStatusTone('COMPLETE')).toBe('success');
    expect(getResultStatusTone('FINAL')).toBe('success');
    expect(getResultStatusTone('PENDING')).toBe('progress');
    expect(getResultStatusTone('RUNNING')).toBe('progress');
    expect(getResultStatusTone('FAILED')).toBe('danger');
    expect(getResultStatusTone('CREATED')).toBe('neutral');
    expect(getResultStatusTone(undefined)).toBe('neutral');
  });

  it('getMeterMeta guards invalid ranges and values', () => {
    expect(getMeterMeta({ result: '', referenceRange: '10 - 20' } as any).canRender).toBe(false);
    expect(getMeterMeta({ result: '15', referenceRange: 'positive' } as any).canRender).toBe(false);
    expect(getMeterMeta({ result: '15', referenceRange: '20 - 10' } as any).canRender).toBe(false);
    expect(getMeterMeta({ result: '15', referenceRange: '10 - 20' } as any).canRender).toBe(true);
    expect(
      getMeterMeta({ result: '25', referenceRange: '10 - 20', outOfRange: true } as any).markerClass
    ).toContain('red');
  });

  it('getOrderUiUrl and getOrderPdfUrl resolve direct, nested and null orders', () => {
    expect(getOrderUiUrl(null)).toBe('');
    expect(getOrderPdfUrl(null)).toBe('');
    expect(getOrderUiUrl({ uiUrl: 'https://a/ui' } as any)).toBe('https://a/ui');
    expect(getOrderPdfUrl({ pdfUrl: 'https://a/pdf' } as any)).toBe('https://a/pdf');
    expect(getOrderUiUrl({ responsePayload: { uiURL: 'https://n/ui' } } as any)).toBe(
      'https://n/ui'
    );
    expect(getOrderPdfUrl({ responsePayload: { pdfURL: 'https://n/pdf' } } as any)).toBe(
      'https://n/pdf'
    );
  });

  it('buildAppointmentIdByOrderId maps and skips incomplete orders', () => {
    expect(
      buildAppointmentIdByOrderId([
        { idexxOrderId: 'o1', appointmentId: 'a1' },
        { idexxOrderId: '', appointmentId: 'a2' },
        {},
      ] as any)
    ).toEqual({ o1: 'a1' });
  });

  it('getOrderExternalStatusSuffix compares external and current status', () => {
    expect(getOrderExternalStatusSuffix({ status: 'SUBMITTED' } as any)).toBe('');
    expect(
      getOrderExternalStatusSuffix({ status: 'SUBMITTED', externalStatus: 'SUBMITTED' } as any)
    ).toBe('');
    expect(
      getOrderExternalStatusSuffix({ status: 'SUBMITTED', externalStatus: 'RESULTED' } as any)
    ).toBe(' (Resulted)');
    expect(getOrderExternalStatusSuffix({ externalStatus: 'RESULTED' } as any)).toBe(' (Resulted)');
  });

  it('normalizeModality maps aliases and rejects unknowns', () => {
    expect(normalizeModality('REFERENCE_LAB')).toBe('REFLAB');
    expect(normalizeModality('IN_HOUSE')).toBe('INHOUSE');
    expect(normalizeModality('')).toBeNull();
    expect(normalizeModality('XRAY')).toBeNull();
  });

  it('matchesResultQuery scans populated and empty results', () => {
    const full = {
      resultId: 'R',
      orderId: 'O',
      accessionId: 'A',
      patientName: 'N',
      patientId: 'P',
      requisitionId: 'Q',
      status: 'S',
    } as any;
    expect(matchesResultQuery(full, 's')).toBe(true);
    expect(matchesResultQuery(full, 'zzz')).toBe(false);
    expect(matchesResultQuery({} as any, 'zzz')).toBe(false);
  });
});
