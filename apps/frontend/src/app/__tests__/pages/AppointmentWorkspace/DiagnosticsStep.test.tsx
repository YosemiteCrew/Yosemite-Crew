import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import type { Appointment } from '@yosemite-crew/types';
import type { IdexxTest, LabOrder, LabResult } from '@/app/features/integrations/services/types';
import type { UseLabTestsReturn } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';
import DiagnosticsStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/DiagnosticsStep';
import { getAppointmentWorkspaceBootstrap } from '@/app/features/appointments/services/workspaceAggregateService';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';

expect.extend(toHaveNoViolations);

// ---- module-under-mock: the real IDEXX backend hook + exported helpers ----
const mockUseLabTests = jest.fn();

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests',
  () => ({
    __esModule: true,
    default: () => <div>legacy lab tests</div>,
    useLabTests: (appt: unknown) => mockUseLabTests(appt),
    resolveOrderUiUrl: (order: { uiUrl?: string | null } | null) => order?.uiUrl ?? '',
    resolveOrderPdfUrl: (order: { pdfUrl?: string | null } | null) => order?.pdfUrl ?? '',
    formatTestPrice: (test: IdexxTest) => test.meta?.listPrice ?? '$0.00',
    getTestTurnaround: (test: IdexxTest) => test.meta?.turnaround ?? '24 hours',
    getTestSpecimen: (test: IdexxTest) => test.meta?.specimen ?? 'Serum',
    toTitleCase: (value?: string | null) => value ?? '',
    LabResultCategoryTable: ({ resultId }: { resultId: string }) => (
      <div data-testid={`category-${resultId}`}>category table</div>
    ),
  })
);

jest.mock('@/app/ui/overlays/PdfPreviewOverlay', () => ({
  __esModule: true,
  default: ({ open, title }: { open: boolean; title?: string }) =>
    open ? <div data-testid="pdf-overlay">{title}</div> : null,
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeIdexxIframeUrl: (url: string | null | undefined) => url ?? null,
}));

jest.mock('@/app/features/appointments/services/workspaceAggregateService', () => ({
  getAppointmentWorkspaceBootstrap: jest.fn().mockResolvedValue({}),
  normalizeWorkspaceBootstrapForEncounter: jest.fn(() => ({})),
}));

const APPOINTMENT = {
  id: 'appt-diagnostics',
  companion: { id: 'comp-1', name: 'Gigi' },
} as unknown as Appointment;

const makeTest = (overrides: Partial<IdexxTest> = {}): IdexxTest => ({
  _id: 't1',
  code: 'SA250',
  display: 'Canine Senior Screen',
  type: 'PANEL',
  meta: { listPrice: '$45.00', turnaround: '24 hours', specimen: 'Serum' },
  ...overrides,
});

const makeOrder = (overrides: Partial<LabOrder> = {}): LabOrder =>
  ({
    _id: 'o1',
    organisationId: 'org-1',
    provider: 'IDEXX',
    companionId: 'comp-1',
    status: 'SUBMITTED',
    modality: 'REFERENCE_LAB',
    idexxOrderId: '100358709',
    uiUrl: 'https://idexx.test/order',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:05:00Z',
    ...overrides,
  }) as LabOrder;

const makeResult = (overrides: Partial<LabResult> = {}): LabResult =>
  ({
    resultId: 'r1',
    orderId: '100358709',
    status: 'final',
    rawPayload: { categories: [{ name: 'Chemistry', tests: [] }] },
    ...overrides,
  }) as unknown as LabResult;

const baseHook = (overrides: Partial<UseLabTestsReturn> = {}): UseLabTestsReturn =>
  ({
    integrationEnabled: true,
    loading: false,
    error: null,
    devices: [{ deviceSerialNumber: '1234567890', displayName: 'IVLS' }],
    tests: [makeTest()],
    testsHasMore: false,
    testsLoadingMore: false,
    query: '',
    setQuery: jest.fn(),
    selectedTestLabel: '',
    setSelectedTestLabel: jest.fn(),
    selectedTests: [makeTest()],
    modality: 'REFERENCE_LAB',
    setModality: jest.fn(),
    selectedIvls: '',
    setSelectedIvls: jest.fn(),
    veterinarian: 'vet-1',
    setVeterinarian: jest.fn(),
    technician: 'tech-1',
    setTechnician: jest.fn(),
    notes: '',
    setNotes: jest.fn(),
    specimenCollectionDate: '',
    setSpecimenCollectionDate: jest.fn(),
    latestOrder: makeOrder(),
    appointmentOrders: [makeOrder()],
    ordersLoading: false,
    results: [makeResult()],
    censusEntries: [],
    creatingOrder: false,
    updatingCensus: false,
    refreshingResults: false,
    showOrderIframe: false,
    iframeOrderUiUrl: '',
    iframeOpenSource: 'order',
    showPdfPreview: false,
    pdfPreviewUrl: '',
    pdfPreviewTitle: '',
    pdfPreviewLoadingId: null,
    needsInitialOrderPlacement: false,
    canOpenFollowUpInCurrentOrder: false,
    resultProgressByOrderId: {},
    companionInCensus: false,
    selectedDeviceInCensus: false,
    inHouseCensusConfirmed: false,
    needsSelectedDeviceCensusAdd: false,
    modalityOptions: [
      { label: 'Reference lab', value: 'REFERENCE_LAB' },
      { label: 'In-house', value: 'INHOUSE' },
    ],
    practitionerOptions: [
      { label: 'Dr. Tim Apple', value: 'vet-1' },
      { label: 'Sarah Mitchell', value: 'tech-1' },
    ],
    companionId: 'comp-1',
    loadMoreTests: jest.fn(),
    refreshAppointmentOrders: jest.fn(),
    refreshCensus: jest.fn(),
    refreshResults: jest.fn(),
    openOrderIframe: jest.fn(),
    closeOrderIframeManually: jest.fn(),
    closePdfPreview: jest.fn(),
    openResultPdfPreview: jest.fn(),
    openResultPdfForOrder: jest.fn(),
    openOrderAcknowledgement: jest.fn(),
    setActiveOrderForActions: jest.fn(),
    addTest: jest.fn(),
    removeTest: jest.fn(),
    handleCreateOrder: jest.fn(),
    handleAddToCensus: jest.fn(),
    getOrderDisplayStatus: jest.fn(() => 'Submitted'),
    ...overrides,
  }) as unknown as UseLabTestsReturn;

const renderStep = (
  overrides: Partial<UseLabTestsReturn> = {},
  onOpenTreatment = jest.fn(),
  readOnly = false
) => {
  const hook = baseHook(overrides);
  mockUseLabTests.mockReturnValue(hook);
  render(
    <DiagnosticsStep
      appointment={APPOINTMENT}
      readOnly={readOnly}
      onOpenTreatment={onOpenTreatment}
    />
  );
  return { hook, onOpenTreatment };
};

describe('DiagnosticsStep (workspace, real IDEXX backend)', () => {
  beforeEach(() => {
    mockUseLabTests.mockReset();
    useAppointmentWorkspaceStore.setState({ encountersById: {} });
  });

  it('renders provider pills with IDEXX selected and the order builder/queue/results sections', () => {
    renderStep();

    expect(screen.getByRole('button', { name: 'IDEXX' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: 'IDEXX' })).toBeInTheDocument();
    expect(screen.getByText('Order Builder')).toBeInTheDocument();
    expect(screen.getByText('Test Queue')).toBeInTheDocument();
    expect(screen.getByText('Order Status')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Canine Senior Screen')).toBeInTheDocument();
    expect(screen.getAllByText(/Order 100358709/).length).toBeGreaterThan(0);
  });

  it('shows provider and modality origin badges on order rows', () => {
    renderStep();

    // The same order id also appears in the Results section, so target the
    // first occurrence — the Order Status row, which carries the origin badges.
    const orderRow = screen.getAllByText('1. Order 100358709')[0].parentElement as HTMLElement;
    expect(orderRow).toHaveTextContent('IDEXX');
    expect(orderRow).toHaveTextContent('Reference lab');
  });

  it('shows the in-house modality badge for in-house orders', () => {
    renderStep({
      appointmentOrders: [makeOrder({ modality: 'INHOUSE', idexxOrderId: '200001' })],
    });

    const orderRow = screen.getByText('1. Order 200001').parentElement as HTMLElement;
    expect(orderRow).toHaveTextContent('In-house');
  });

  it('disables the RadAnalyzer provider with an availability reason and keeps IDEXX active', () => {
    renderStep();

    const radButton = screen.getByRole('button', { name: /RadAnalyzer/i });
    expect(radButton).toBeDisabled();
    expect(radButton).toHaveAttribute('title', expect.stringMatching(/coming soon/i));

    // Clicking the disabled provider does not switch away from the IDEXX builder.
    fireEvent.click(radButton);
    expect(screen.getByText('Order Builder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'IDEXX' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps diagnostic history visible but hides new-order controls when read-only', () => {
    renderStep({}, jest.fn(), true);

    expect(screen.queryByText('Order Builder')).not.toBeInTheDocument();
    expect(screen.getByText('Order Status')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create lab order/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/remove canine senior screen/i)).not.toBeInTheDocument();
  });

  it('shows the not-enabled state when the integration is disabled', () => {
    renderStep({ integrationEnabled: false });

    expect(screen.getByText(/IDEXX integration is not enabled/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /enable idexx in integrations/i })).toBeInTheDocument();
  });

  it('shows the loading state', () => {
    renderStep({ loading: true });

    expect(screen.getByText(/Loading IDEXX integration/i)).toBeInTheDocument();
  });

  it('shows Follow up for submitted orders and Continue for created orders', () => {
    renderStep({
      latestOrder: makeOrder({ status: 'SUBMITTED' }),
      canOpenFollowUpInCurrentOrder: true,
      needsInitialOrderPlacement: false,
    });
    expect(
      screen.getByRole('button', { name: 'Follow up for order 100358709' })
    ).toBeInTheDocument();

    renderStep({
      latestOrder: makeOrder({ status: 'CREATED' }),
      appointmentOrders: [makeOrder({ status: 'CREATED' })],
      canOpenFollowUpInCurrentOrder: false,
      needsInitialOrderPlacement: true,
    });
    expect(
      screen.getByRole('button', { name: 'Continue for order 100358709' })
    ).toBeInTheDocument();
  });

  it('surfaces a hook error message', () => {
    renderStep({ error: 'IDEXX request failed' });

    expect(screen.getByText('IDEXX request failed')).toBeInTheDocument();
  });

  it('removes a queued test through the hook action', () => {
    const { hook } = renderStep();

    fireEvent.click(screen.getByRole('button', { name: /remove canine senior screen/i }));

    expect(hook.removeTest).toHaveBeenCalledWith('SA250');
  });

  it('creates a lab order through the hook action', () => {
    const { hook } = renderStep();

    fireEvent.click(screen.getByRole('button', { name: /create lab order/i }));

    expect(hook.handleCreateOrder).toHaveBeenCalled();
  });

  it('surfaces diagnostics preloaded from services and packages', () => {
    useAppointmentWorkspaceStore.setState({
      encountersById: {
        'appt-diagnostics': {
          diagnosticOrders: [
            {
              id: 'dx-1',
              orderCode: 'CBC',
              name: 'Complete Blood Count',
              kind: 'PROVIDER_TEST',
              provider: 'IDEXX',
              sourceKind: 'PACKAGE_ITEM',
              status: 'CREATED',
              createdAt: '2026-06-01T10:00:00Z',
            },
          ],
        } as unknown as AppointmentEncounter,
      },
    });
    renderStep();

    expect(screen.getByText('Preloaded from Services & Packages')).toBeInTheDocument();
    const row = screen.getByText('Complete Blood Count').parentElement as HTMLElement;
    expect(row).toHaveTextContent('Package');
    expect(row).toHaveTextContent('IDEXX');
  });

  it('refetches the encounter workspace after creating a lab order', async () => {
    mockUseLabTests.mockReturnValue(baseHook());
    const appointmentWithOrg = {
      id: 'appt-diagnostics',
      organisationId: 'org-1',
      companion: { id: 'comp-1', name: 'Gigi' },
    } as unknown as Appointment;
    render(<DiagnosticsStep appointment={appointmentWithOrg} onOpenTreatment={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /create lab order/i }));

    // Beyond the IDEXX tables, the encounter is re-hydrated so the diagnostic
    // queue, invoice candidates, and documents reflect the new order.
    await waitFor(() =>
      expect(getAppointmentWorkspaceBootstrap).toHaveBeenCalledWith('org-1', 'appt-diagnostics')
    );
  });

  it('updates order builder fields through the backend hook callbacks', () => {
    const { hook } = renderStep({ modality: 'REFERENCE_LAB' });

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Fasted sample' } });
    fireEvent.change(screen.getByLabelText('Collection Date'), { target: { value: '2026-06-03' } });
    fireEvent.click(screen.getByRole('button', { name: /veterinarian: dr\. tim apple/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Sarah Mitchell' }));
    fireEvent.click(screen.getByRole('button', { name: /technician: sarah mitchell/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Dr. Tim Apple' }));
    fireEvent.click(screen.getByRole('button', { name: /test type: reference lab/i }));
    fireEvent.click(screen.getByRole('button', { name: 'In-house' }));

    expect(hook.setNotes).toHaveBeenCalledWith('Fasted sample');
    expect(hook.setSpecimenCollectionDate).toHaveBeenCalledWith('2026-06-03');
    expect(hook.setVeterinarian).toHaveBeenCalledWith('tech-1');
    expect(hook.setTechnician).toHaveBeenCalledWith('vet-1');
    expect(hook.setModality).toHaveBeenCalledWith('INHOUSE');
  });

  it('disables create when no tests are queued and renders the empty queue message', () => {
    renderStep({ selectedTests: [] });

    expect(screen.getByText(/No tests selected yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create lab order/i })).toBeDisabled();
  });

  it('renders the in-house census variant and triggers add/refresh census', () => {
    const { hook } = renderStep({ modality: 'INHOUSE', selectedIvls: '1234567890' });

    expect(screen.getByText(/In-house IDEXX workflow/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add to census/i }));
    expect(hook.handleAddToCensus).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /refresh census/i }));
    expect(hook.refreshCensus).toHaveBeenCalled();
  });

  it('refreshes appointment orders through the hook action', () => {
    const { hook } = renderStep();

    fireEvent.click(screen.getByRole('button', { name: /refresh orders/i }));

    expect(hook.refreshAppointmentOrders).toHaveBeenCalled();
  });

  it('opens the order iframe for an incomplete order and the acknowledgement PDF', () => {
    const order = makeOrder({ pdfUrl: 'https://idexx.test/ack.pdf' } as Partial<LabOrder>);
    const { hook } = renderStep({ appointmentOrders: [order], latestOrder: order });

    fireEvent.click(screen.getByRole('button', { name: /follow up for order 100358709/i }));
    expect(hook.setActiveOrderForActions).toHaveBeenCalled();
    expect(hook.openOrderIframe).toHaveBeenCalledWith('followup', order.status, order);

    fireEvent.click(
      screen.getByRole('button', { name: /view acknowledgement for order 100358709/i })
    );
    expect(hook.openOrderAcknowledgement).toHaveBeenCalled();
  });

  it('opens the result PDF when an order is complete', () => {
    const order = makeOrder();
    const { hook } = renderStep({
      appointmentOrders: [order],
      getOrderDisplayStatus: jest.fn(
        () => 'Complete'
      ) as UseLabTestsReturn['getOrderDisplayStatus'],
    });

    fireEvent.click(screen.getByRole('button', { name: /open result pdf for order 100358709/i }));

    expect(hook.openResultPdfForOrder).toHaveBeenCalled();
  });

  it('opens a result PDF preview from the download action', () => {
    const { hook } = renderStep();

    fireEvent.click(screen.getByRole('button', { name: /download results pdf for result r1/i }));

    expect(hook.openResultPdfPreview).toHaveBeenCalledWith('r1');
  });

  it('toggles the result breakdown with the view action', () => {
    renderStep();

    // First result is expanded by default, so its breakdown is visible.
    expect(screen.getByTestId('category-r1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide results for result r1/i }));
    expect(screen.queryByTestId('category-r1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show results for result r1/i }));
    expect(screen.getByTestId('category-r1')).toBeInTheDocument();
  });

  it('shows the empty results message when there are none', () => {
    renderStep({ results: [] });

    expect(screen.getByText(/No results available yet/i)).toBeInTheDocument();
  });

  it('renders the order iframe overlay when showOrderIframe is set', () => {
    renderStep({ showOrderIframe: true, iframeOrderUiUrl: 'https://idexx.test/frame' });

    expect(screen.getByTitle('IDEXX order UI')).toBeInTheDocument();
  });

  it('shows the IDEXX loader when the follow-up iframe modal opens', () => {
    renderStep({
      showOrderIframe: true,
      iframeOrderUiUrl: 'https://idexx.test/follow-up',
      iframeOpenSource: 'followup',
    });

    expect(screen.getByText('IDEXX follow-up ordering')).toBeInTheDocument();
    expect(screen.getByTestId('idexx-order-loader')).toBeInTheDocument();
    expect(screen.getByText('Loading IDEXX')).toBeInTheDocument();
  });

  it('renders the PDF preview overlay when showPdfPreview is set', () => {
    renderStep({
      showPdfPreview: true,
      pdfPreviewUrl: 'https://idexx.test/pdf',
      pdfPreviewTitle: 'Result PDF',
    });

    expect(screen.getByTestId('pdf-overlay')).toHaveTextContent('Result PDF');
  });

  it('prints all results and opens the treatment plan', () => {
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    const { onOpenTreatment } = renderStep();

    fireEvent.click(screen.getByRole('button', { name: /print all results/i }));
    expect(printSpy).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /treatment plan/i }));
    expect(onOpenTreatment).toHaveBeenCalled();

    printSpy.mockRestore();
  });

  it('has no axe accessibility violations', async () => {
    const hook = baseHook();
    mockUseLabTests.mockReturnValue(hook);
    const { container } = render(
      <DiagnosticsStep appointment={APPOINTMENT} onOpenTreatment={jest.fn()} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
