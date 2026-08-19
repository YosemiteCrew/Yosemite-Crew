import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompanionHistoryTimeline, {
  PillDropdown,
  RequestedAppointmentActions,
  StatusPillSelect,
} from '@/app/features/companionHistory/components/CompanionHistoryTimeline';
import { fetchCompanionHistory } from '@/app/features/companionHistory/services/companionHistoryService';
import { getCompanionAuditTrail } from '@/app/features/audit/services/auditService';
import { loadDocumentDownloadURL } from '@/app/features/companions/services/companionDocumentService';
import { changeAppointmentStatus } from '@/app/features/appointments/services/appointmentService';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import { getIdexxResultPdfBlob } from '@/app/features/integrations/services/idexxService';

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  __esModule: true,
  PermissionGate: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div>fallback</div>,
}));

jest.mock('@/app/ui/overlays/PdfPreviewOverlay', () => ({
  __esModule: true,
  default: ({ open, pdfUrl, title, onClose }: any) =>
    open ? (
      <div data-testid="pdf-preview">
        {`${title}-${pdfUrl}`}
        <button type="button" onClick={onClose}>
          close pdf preview
        </button>
      </div>
    ) : null,
}));

let mockOrgState: any = {
  primaryOrgId: 'org-1',
  orgsById: { 'org-1': { type: 'HOSPITAL' } },
};
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector(mockOrgState),
}));

const mockAppointmentsById: Record<string, any> = {};
const mockTasksById: Record<string, any> = {};
const mockNotify = jest.fn();

jest.mock('@/app/stores/appointmentStore', () => ({
  useAppointmentStore: Object.assign(
    (selector: any) =>
      selector({
        appointmentsById: mockAppointmentsById,
        appointmentIdsByOrgId: { 'org-1': Object.keys(mockAppointmentsById) },
        status: 'loaded',
      }),
    {
      getState: () => ({
        appointmentsById: mockAppointmentsById,
        appointmentIdsByOrgId: { 'org-1': Object.keys(mockAppointmentsById) },
        status: 'loaded',
      }),
    }
  ),
}));

jest.mock('@/app/stores/taskStore', () => ({
  useTaskStore: Object.assign(
    (selector: any) =>
      selector({
        tasksById: mockTasksById,
        taskIdsByOrgId: { 'org-1': Object.keys(mockTasksById) },
        status: 'loaded',
      }),
    {
      getState: () => ({
        tasksById: mockTasksById,
        taskIdsByOrgId: { 'org-1': Object.keys(mockTasksById) },
        status: 'loaded',
      }),
    }
  ),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  changeAppointmentStatus: jest.fn().mockResolvedValue(undefined),
  loadAppointmentsForPrimaryOrg: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  changeTaskStatus: jest.fn().mockResolvedValue(undefined),
  loadTasksForPrimaryOrg: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/features/integrations/services/idexxService', () => ({
  getIdexxResultPdfBlob: jest
    .fn()
    .mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/features/companions/services/companionDocumentService', () => ({
  loadDocumentDownloadURL: jest.fn().mockResolvedValue([{ url: 'https://example.com/file.pdf' }]),
}));

// Observe (and neutralise) same-origin navigation without touching the
// non-configurable window.location.assign.
const mockGetSafeSameOriginPath = jest.fn((_path: string) => '');
jest.mock('@/app/lib/urls', () => {
  const actual = jest.requireActual('@/app/lib/urls');
  return {
    ...actual,
    getSafeSameOriginPath: (path: string) => mockGetSafeSameOriginPath(path),
  };
});

jest.mock('@/app/features/companionHistory/services/companionHistoryService', () => ({
  fetchCompanionHistory: jest.fn(),
}));

jest.mock('@/app/features/audit/services/auditService', () => ({
  getCompanionAuditTrail: jest.fn(),
}));

jest.mock('@/app/features/companionHistory/components/HistoryDocumentUpload', () => ({
  __esModule: true,
  default: ({ companionId, onUploaded }: any) => (
    <div>
      <div>history-document-upload-{companionId}</div>
      <button type="button" onClick={onUploaded}>
        trigger document upload refresh
      </button>
    </div>
  ),
}));

describe('CompanionHistoryTimeline', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let windowOpenSpy: jest.SpyInstance;
  let createObjectUrlSpy: jest.SpyInstance;
  let revokeObjectUrlSpy: jest.SpyInstance;

  const baseEntries: any[] = [
    {
      id: 'entry-appointment',
      type: 'APPOINTMENT',
      occurredAt: '2026-03-20T10:00:00.000Z',
      title: 'Recheck visit',
      subtitle: 'Dermatology',
      summary: 'Skin irritation follow-up',
      link: { kind: 'appointment', id: 'a-1', patientId: 'c-1' },
      source: 'APPOINTMENT',
      payload: { appointmentId: 'a-1', serviceName: 'Consult', roomName: 'Room 2' },
    },
    {
      id: 'entry-task',
      type: 'TASK',
      occurredAt: '2026-03-19T10:00:00.000Z',
      title: 'Give medication',
      subtitle: 'Medication',
      summary: 'Administer twice daily',
      link: { kind: 'task', id: 't-1', appointmentId: 'a-1', patientId: 'c-1' },
      source: 'TASK',
      payload: { audience: 'Parent' },
    },
    {
      id: 'entry-form',
      type: 'FORM_SUBMISSION',
      occurredAt: '2026-03-18T10:00:00.000Z',
      title: 'SOAP Subjective',
      subtitle: 'SOAP-Subjective',
      summary: 'Submitted',
      link: { kind: 'form_submission', id: 'f-1', appointmentId: 'a-1', patientId: 'c-1' },
      source: 'FORM',
      payload: { formCategory: 'SOAP-Subjective' },
    },
    {
      id: 'entry-document',
      type: 'DOCUMENT',
      occurredAt: '2026-03-17T10:00:00.000Z',
      title: 'Blood panel PDF',
      subtitle: 'Lab tests',
      summary: 'Uploaded manually',
      link: { kind: 'document', id: 'd-1', patientId: 'c-1' },
      source: 'DOCUMENT',
      payload: { documentId: 'd-1', syncedFromPms: false },
    },
    {
      id: 'entry-lab',
      type: 'LAB_RESULT',
      occurredAt: '2026-03-16T10:00:00.000Z',
      title: 'IDEXX Result',
      subtitle: 'Final',
      summary: 'No critical abnormalities',
      link: { kind: 'lab_result', id: 'l-1', appointmentId: 'a-1', patientId: 'c-1' },
      source: 'LAB',
      payload: { status: 'Final', pdfAvailable: true, pdfUrl: 'https://example.com/lab.pdf' },
    },
    {
      id: 'entry-invoice',
      type: 'INVOICE',
      occurredAt: '2026-03-15T10:00:00.000Z',
      title: 'Invoice',
      subtitle: 'Paid',
      summary: 'USD 120.00',
      link: { kind: 'invoice', id: 'i-1', appointmentId: 'a-1', patientId: 'c-1' },
      source: 'INVOICE',
      payload: { totalAmount: 120, currency: 'USD' },
    },
  ];

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    windowOpenSpy = jest.spyOn(globalThis.window, 'open').mockImplementation(() => null);
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: jest.fn(),
      });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: jest.fn(),
      });
    }
    createObjectUrlSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:lab-result');
    revokeObjectUrlSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    (fetchCompanionHistory as jest.Mock).mockReset();
    (getCompanionAuditTrail as jest.Mock).mockReset().mockResolvedValue([]);
    (loadDocumentDownloadURL as jest.Mock)
      .mockClear()
      .mockResolvedValue([{ url: 'https://example.com/file.pdf' }]);
    (changeAppointmentStatus as jest.Mock).mockClear().mockResolvedValue(undefined);
    (changeTaskStatus as jest.Mock).mockClear().mockResolvedValue(undefined);
    (getIdexxResultPdfBlob as jest.Mock)
      .mockClear()
      .mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    mockNotify.mockClear();
    mockOrgState = { primaryOrgId: 'org-1', orgsById: { 'org-1': { type: 'HOSPITAL' } } };
    mockGetSafeSameOriginPath.mockClear().mockImplementation((_path: string) => '');
    Object.keys(mockAppointmentsById).forEach((key) => delete mockAppointmentsById[key]);
    Object.keys(mockTasksById).forEach((key) => delete mockTasksById[key]);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    windowOpenSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('renders a single unified timeline mixing every entry type with per-type open labels', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries.map((entry) =>
        entry.type === 'INVOICE' ? { ...entry, status: 'AWAITING_PAYMENT' } : entry
      ),
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    // History heading + All chip active by default
    expect(await screen.findByText('History')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');

    // All types interleave chronologically in one list
    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });
    expect(screen.getByText('Give medication')).toBeInTheDocument();
    expect(screen.getByText('SOAP Subjective')).toBeInTheDocument();
    expect(screen.getByText('Blood panel PDF')).toBeInTheDocument();
    expect(screen.getByText('IDEXX Result')).toBeInTheDocument();
    expect(screen.getByText('Invoice')).toBeInTheDocument();

    // Per-type primary open affordances
    expect(screen.getByRole('button', { name: 'Open appointment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open submission' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open result' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open finance' })).toBeInTheDocument();

    // Read-only status badge for the invoice
    expect(screen.getByText('Awaiting Payment')).toBeInTheDocument();
    // Diagnostics inline action chips
    expect(screen.getByRole('button', { name: 'Result PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acknowledgment PDF' })).toBeInTheDocument();
  });

  it('narrows the timeline to a category and requests the matching backend type filter', async () => {
    (fetchCompanionHistory as jest.Mock)
      .mockResolvedValueOnce({
        entries: baseEntries,
        nextCursor: null,
        summary: { totalReturned: 6, countsByType: {} },
      })
      .mockResolvedValueOnce({
        entries: baseEntries.filter(
          (entry) => entry.type === 'DOCUMENT' || entry.type === 'FORM_SUBMISSION'
        ),
        nextCursor: null,
        summary: { totalReturned: 2, countsByType: { DOCUMENT: 1, FORM_SUBMISSION: 1 } },
      });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Medical records' }));

    await waitFor(() => {
      expect(screen.getByText('Blood panel PDF')).toBeInTheDocument();
      expect(screen.queryByText('Recheck visit')).not.toBeInTheDocument();
    });
    expect(fetchCompanionHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        companionId: 'c-1',
        organisationId: 'org-1',
        limit: 50,
        cursor: null,
        types: ['FORM_SUBMISSION', 'DOCUMENT'],
      })
    );
  });

  it('shows the document upload panel in the medical records filter and refreshes after upload', async () => {
    (fetchCompanionHistory as jest.Mock)
      .mockResolvedValueOnce({
        entries: baseEntries,
        nextCursor: null,
        summary: { totalReturned: 6, countsByType: {} },
      })
      .mockResolvedValueOnce({
        entries: baseEntries.filter(
          (entry) => entry.type === 'DOCUMENT' || entry.type === 'FORM_SUBMISSION'
        ),
        nextCursor: null,
        summary: { totalReturned: 2, countsByType: { DOCUMENT: 1, FORM_SUBMISSION: 1 } },
      });

    render(<CompanionHistoryTimeline companionId="c-1" showDocumentUpload />);

    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });

    expect(screen.queryByText('history-document-upload-c-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Medical records' }));

    await waitFor(() => {
      expect(screen.getByText('history-document-upload-c-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'trigger document upload refresh' }));

    await waitFor(() => {
      expect(fetchCompanionHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({
          companionId: 'c-1',
          organisationId: 'org-1',
          limit: 50,
          cursor: null,
          types: ['FORM_SUBMISSION', 'DOCUMENT'],
        })
      );
    });
  });

  it('appends entries on load more', async () => {
    (fetchCompanionHistory as jest.Mock)
      .mockResolvedValueOnce({
        entries: [baseEntries[0]],
        nextCursor: 'cursor-1',
        summary: { totalReturned: 1, countsByType: {} },
      })
      .mockResolvedValueOnce({
        entries: [
          {
            ...baseEntries[0],
            id: 'entry-appointment-2',
            title: 'Second appointment',
          },
        ],
        nextCursor: null,
        summary: { totalReturned: 1, countsByType: {} },
      });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(screen.getByText('Second appointment')).toBeInTheDocument();
    });
  });

  it('keeps existing entries when load more fails', async () => {
    (fetchCompanionHistory as jest.Mock)
      .mockResolvedValueOnce({
        entries: [baseEntries[0]],
        nextCursor: 'cursor-1',
        summary: { totalReturned: 1, countsByType: {} },
      })
      .mockRejectedValueOnce(new Error('load more failed'));

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(screen.getByText('Unable to load overview. Please try again.')).toBeInTheDocument();
    });
  });

  it('renders empty state', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [],
      nextCursor: null,
      summary: { totalReturned: 0, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('No records yet')).toBeInTheDocument();
    });
  });

  it('renders error state when fetch fails', async () => {
    (fetchCompanionHistory as jest.Mock).mockRejectedValue(new Error('failed'));

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load overview. Please try again.')).toBeInTheDocument();
    });
  });

  it('requests backend type filters when switching to a category chip', async () => {
    (fetchCompanionHistory as jest.Mock)
      .mockResolvedValueOnce({
        entries: baseEntries,
        nextCursor: null,
        summary: { totalReturned: 6, countsByType: {} },
      })
      .mockResolvedValueOnce({
        entries: baseEntries.filter((entry) => entry.type === 'TASK'),
        nextCursor: null,
        summary: { totalReturned: 1, countsByType: { TASK: 1 } },
      });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Tasks' }));

    await waitFor(() => {
      expect(fetchCompanionHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({
          types: ['TASK'],
        })
      );
    });
  });

  it('renders companion audit trail entries under the Audit trail chip', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });
    (getCompanionAuditTrail as jest.Mock).mockResolvedValue([
      {
        id: 'audit-1',
        eventType: 'INVOICE_PAID',
        entityType: 'INVOICE',
        actorType: 'PMS_USER',
        actorName: 'Dr vet',
        occurredAt: '2026-03-20T10:00:00.000Z',
      },
    ]);

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Audit trail' }));

    await waitFor(() => {
      expect(screen.getByText('Invoice paid')).toBeInTheDocument();
    });
    expect(getCompanionAuditTrail).toHaveBeenCalledWith('c-1');
  });

  it('shows audit trail error state when audit request fails', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });
    (getCompanionAuditTrail as jest.Mock).mockRejectedValue(new Error('audit failed'));

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Audit trail' }));

    await waitFor(() => {
      expect(screen.getByText('Unable to load audit trail. Please try again.')).toBeInTheDocument();
    });
  });

  it('opens a document entry URL in the PDF preview overlay', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[3]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { DOCUMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open file' }));

    await waitFor(() => {
      expect(loadDocumentDownloadURL).toHaveBeenCalledWith('d-1');
    });
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'Blood panel PDF-https://example.com/file.pdf'
    );
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('notifies when a document has no preview URL', async () => {
    (loadDocumentDownloadURL as jest.Mock).mockResolvedValueOnce([]);
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[3]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { DOCUMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open file' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Document unavailable' })
      );
    });
  });

  it('expands structured medical record results inline', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[2],
          payload: {
            ...baseEntries[2].payload,
            results: [{ test: 'Heart rate', value: '88', unit: 'bpm' }],
          },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { FORM_SUBMISSION: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open submission' }));

    expect(await screen.findByText('Heart rate')).toBeInTheDocument();
    expect(screen.getByText('88 bpm')).toBeInTheDocument();
  });

  it('opens medical record PDFs in the preview overlay when a URL is available', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[3],
          payload: { ...baseEntries[3].payload, pdfUrl: 'https://example.com/result.pdf' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { DOCUMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open file' }));

    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'Blood panel PDF-https://example.com/result.pdf'
    );
    expect(loadDocumentDownloadURL).not.toHaveBeenCalled();
  });

  it('opens diagnostic result PDFs directly from the result PDF endpoint', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[4]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Result PDF' }));

    await waitFor(() => {
      expect(getIdexxResultPdfBlob).toHaveBeenCalledWith({
        organisationId: 'org-1',
        resultId: 'l-1',
      });
    });
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'IDEXX Result PDF #l-1-blob:lab-result'
    );
  });

  it('notifies when a diagnostic result PDF cannot be loaded', async () => {
    (getIdexxResultPdfBlob as jest.Mock).mockRejectedValueOnce(new Error('pdf failed'));
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[4]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Result PDF' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Result PDF unavailable' })
      );
    });
  });

  it('opens diagnostic acknowledgment PDFs directly from the order PDF URL', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[4]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledgment PDF' }));

    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'IDEXX Result-https://example.com/lab.pdf'
    );
  });

  it('previews a paid invoice receipt from an inline chip', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[5],
          status: 'PAID',
          payload: { ...baseEntries[5].payload, pdfUrl: 'https://example.com/receipt.pdf' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { INVOICE: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Preview Invoice' }));

    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'Invoice-https://example.com/receipt.pdf'
    );
  });

  it('persists appointment status changes when the appointment is loaded', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'UPCOMING',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'UPCOMING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Checked in' }));

    await waitFor(() => {
      expect(changeAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a-1' }),
        'CHECKED_IN'
      );
    });
    expect(await screen.findByText('Checked in')).toBeInTheDocument();
  });

  it('only offers valid next statuses in the appointment status menu', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'UPCOMING',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'UPCOMING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);

    expect(screen.getByRole('menuitem', { name: 'Checked in' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cancelled' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Requested' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Completed' })).not.toBeInTheDocument();
  });

  it('surfaces the server message when an appointment status change is rejected', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'COMPLETED',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'UPCOMING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    // UPCOMING → CHECKED_IN is offered by the menu, but the loaded appointment is
    // COMPLETED so the transition is invalid.
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Checked in' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Status cannot be changed' })
      );
    });
    expect(changeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('filters a category by the selected section status', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        { ...baseEntries[0], id: 'appt-upcoming', title: 'Upcoming visit', status: 'UPCOMING' },
        {
          ...baseEntries[0],
          id: 'appt-cancelled',
          title: 'Cancelled visit',
          status: 'CANCELLED',
          payload: { appointmentId: 'a-2', serviceName: 'Cancelled consult' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 2, countsByType: { APPOINTMENT: 2 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Upcoming visit');
    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));
    await screen.findByText('Cancelled visit');

    fireEvent.click(screen.getByRole('button', { name: 'Status: All statuses' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelled' }));

    await waitFor(() => {
      expect(screen.queryByText('Upcoming visit')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Cancelled visit')).toBeInTheDocument();
  });

  it('persists task status changes when the task is loaded', async () => {
    mockTasksById['t-1'] = {
      _id: 't-1',
      organisationId: 'org-1',
      assignedTo: 'team-1',
      audience: 'PARENT_TASK',
      source: 'CUSTOM',
      category: 'Care',
      name: 'Give medication',
      dueAt: new Date('2026-03-19T10:00:00.000Z'),
      status: 'PENDING',
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[1], status: 'PENDING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { TASK: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Give medication');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'In progress' }));

    await waitFor(() => {
      expect(changeTaskStatus).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 't-1', status: 'IN_PROGRESS' })
      );
    });
    expect(await screen.findByText('In progress')).toBeInTheDocument();
  });

  it('blocks an invalid task transition and notifies', async () => {
    mockTasksById['t-1'] = {
      _id: 't-1',
      organisationId: 'org-1',
      assignedTo: 'team-1',
      audience: 'PARENT_TASK',
      source: 'CUSTOM',
      category: 'Care',
      name: 'Give medication',
      dueAt: new Date('2026-03-19T10:00:00.000Z'),
      status: 'COMPLETED',
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[1], status: 'PENDING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { TASK: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Give medication');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'In progress' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Status cannot be changed' })
      );
    });
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it('renders a read-only status pill for terminal appointment states', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'CANCELLED',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'CANCELLED' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
  });

  it('renders a read-only status pill for terminal task states', async () => {
    mockTasksById['t-1'] = {
      _id: 't-1',
      organisationId: 'org-1',
      assignedTo: 'team-1',
      audience: 'PARENT_TASK',
      source: 'CUSTOM',
      category: 'Care',
      name: 'Give medication',
      dueAt: new Date('2026-03-19T10:00:00.000Z'),
      status: 'CANCELLED',
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[1], status: 'CANCELLED' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { TASK: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Give medication');
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
  });

  it('uses in-page callbacks for every active-appointment linked entry type', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });
    const onOpenAppointmentView = jest.fn();

    render(
      <CompanionHistoryTimeline
        companionId="c-1"
        activeAppointmentId="a-1"
        onOpenAppointmentView={onOpenAppointmentView}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open result' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open finance' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open submission' }));

    expect(onOpenAppointmentView).toHaveBeenCalledWith({ label: 'labs', subLabel: 'idexx-labs' });
    expect(onOpenAppointmentView).toHaveBeenCalledWith({ label: 'info', subLabel: 'appointment' });
    expect(onOpenAppointmentView).toHaveBeenCalledWith({ label: 'tasks', subLabel: 'task' });
    expect(onOpenAppointmentView).toHaveBeenCalledWith({ label: 'finance', subLabel: 'summary' });
    expect(onOpenAppointmentView).toHaveBeenCalledWith({
      label: 'prescription',
      subLabel: 'forms',
    });
  });

  it('navigates to same-origin routes for non-active linked entries', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[0],
          id: 'nav-appointment',
          payload: { appointmentId: 'a-1' },
          link: { kind: 'appointment', id: 'a-1', patientId: 'c-1' },
        },
        { ...baseEntries[1], id: 'nav-task' },
        { ...baseEntries[5], id: 'nav-invoice' },
        {
          ...baseEntries[4],
          id: 'nav-lab',
          link: { kind: 'lab_result', id: 'l-9', patientId: 'c-1' },
          payload: { pdfUrl: 'https://example.com/lab-only.pdf' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 4, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open finance' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open appointment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open result' }));

    expect(mockGetSafeSameOriginPath).toHaveBeenCalledWith('/tasks?taskId=t-1');
    expect(mockGetSafeSameOriginPath).toHaveBeenCalledWith('/finance?invoiceId=i-1');
    expect(mockGetSafeSameOriginPath).toHaveBeenCalledWith(
      '/appointments?appointmentId=a-1&subLabel=appointment'
    );
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://example.com/lab-only.pdf',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('falls back to the appointment route when a task has no task id', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[1],
          link: { kind: 'other', id: 'x', appointmentId: 'a-7', patientId: 'c-1' },
          payload: {},
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { TASK: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open task' }));
    expect(mockGetSafeSameOriginPath).toHaveBeenCalledWith(
      '/appointments?appointmentId=a-7&subLabel=task'
    );
  });

  it('falls back to the finance route when an invoice has no invoice id', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[5],
          link: { kind: 'other', id: 'x', appointmentId: 'a-8', patientId: 'c-1' },
          payload: {},
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { INVOICE: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open finance' }));
    expect(mockGetSafeSameOriginPath).toHaveBeenCalledWith(
      '/appointments?appointmentId=a-8&open=finance&subLabel=summary'
    );
  });

  it('accepts a requested appointment from the inline action', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'REQUESTED',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'REQUESTED' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    const acceptButton = await screen.findByRole('button', { name: 'Accept Recheck visit' });
    expect(screen.getByRole('button', { name: 'Reject Recheck visit' })).toBeInTheDocument();
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(changeAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a-1' }),
        'UPCOMING'
      );
    });
  });

  it('surfaces the server message when a status change is rejected', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'UPCOMING',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (changeAppointmentStatus as jest.Mock).mockRejectedValueOnce({
      response: { data: { message: 'caseId could not be resolved for check-in.' } },
    });
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'UPCOMING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Checked in' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Status update failed',
        text: 'caseId could not be resolved for check-in.',
      });
    });
  });

  it('uses the generic error message when a rejection carries a plain Error', async () => {
    mockTasksById['t-1'] = {
      _id: 't-1',
      organisationId: 'org-1',
      assignedTo: 'team-1',
      audience: 'PARENT_TASK',
      source: 'CUSTOM',
      category: 'Care',
      name: 'Give medication',
      dueAt: new Date('2026-03-19T10:00:00.000Z'),
      status: 'PENDING',
    };
    (changeTaskStatus as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[1], status: 'PENDING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { TASK: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Give medication');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'In progress' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Status update failed',
        text: 'network down',
      });
    });
  });

  it('filters the timeline by the search query', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.change(screen.getByLabelText('Search overview records'), {
      target: { value: 'medication' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Recheck visit')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Give medication')).toBeInTheDocument();
  });

  it('re-sorts the timeline oldest first', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.click(screen.getByRole('button', { name: 'Sort by: Sort by newest' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sort by oldest' }));

    // Oldest entry (invoice) now leads the list
    const titles = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('button')?.textContent);
    expect(titles[0]).toBe('Invoice');
  });

  it('shows the compact notice and the full overview link', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: Array.from({ length: 10 }, (_, index) => ({
        ...baseEntries[0],
        id: `appt-${index}`,
        title: `Visit ${index}`,
        occurredAt: `2026-03-${10 + index}T10:00:00.000Z`,
      })),
      nextCursor: null,
      summary: { totalReturned: 10, countsByType: { APPOINTMENT: 10 } },
    });

    render(
      <CompanionHistoryTimeline companionId="c-1" compact fullPageHref="/companions/history" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Showing latest 8 records/)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Open full overview' })).toBeInTheDocument();
  });

  it('shows the overview loading indicator while the fetch is pending', async () => {
    (fetchCompanionHistory as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<CompanionHistoryTimeline companionId="c-1" />);

    expect(await screen.findByText('Loading overview…')).toBeInTheDocument();
  });

  it('shows the audit loading indicator while the audit request is pending', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });
    (getCompanionAuditTrail as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Audit trail' }));
    expect(await screen.findByText('Loading audit trail…')).toBeInTheDocument();
  });

  it('expands structured diagnostic results from the inline view chip', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[4],
          payload: {
            ...baseEntries[4].payload,
            results: [{ test: 'WBC', value: '6.1', unit: 'k/uL' }],
          },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'View IDEXX Result' }));

    expect(await screen.findByText('WBC')).toBeInTheDocument();
    expect(screen.getByText('6.1 k/uL')).toBeInTheDocument();
    // Chip toggles to the collapse affordance
    expect(screen.getByRole('button', { name: 'Hide IDEXX Result' })).toBeInTheDocument();
  });

  it('revokes a stale blob preview when opening another PDF', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[4]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Result PDF' }));
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'IDEXX Result PDF #l-1-blob:lab-result'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Acknowledgment PDF' }));

    await waitFor(() => {
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:lab-result');
    });
    expect(screen.getByTestId('pdf-preview')).toHaveTextContent(
      'IDEXX Result-https://example.com/lab.pdf'
    );
  });

  it('uses the generic fallback message for a non-object rejection', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'UPCOMING',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (changeAppointmentStatus as jest.Mock).mockRejectedValueOnce('boom');
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'UPCOMING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Checked in' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Status update failed',
        text: 'Please try again.',
      });
    });
  });

  it('renders the empty state and skips fetching when no companion id is provided', async () => {
    render(<CompanionHistoryTimeline companionId="" />);

    expect(await screen.findByText('No records yet')).toBeInTheDocument();
    expect(fetchCompanionHistory).not.toHaveBeenCalled();
  });

  it('renders a system audit actor without an entity pill', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });
    (getCompanionAuditTrail as jest.Mock).mockResolvedValue([
      {
        id: 'audit-2',
        eventType: 'NOTE_ADDED',
        actorType: 'PARENT',
        actorName: '',
        occurredAt: '2026-03-20T10:00:00.000Z',
      },
    ]);

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Audit trail' }));

    expect(await screen.findByText('Updated by: Pet parent')).toBeInTheDocument();
  });

  it('falls back to the generic message when a rejection object carries no message', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'UPCOMING',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (changeAppointmentStatus as jest.Mock).mockRejectedValueOnce({ code: 'ERR_UNKNOWN' });
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'UPCOMING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Checked in' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Status update failed',
        text: 'Please try again.',
      });
    });
  });

  it('falls back to the generic message when a rejection message is only whitespace', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'UPCOMING',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (changeAppointmentStatus as jest.Mock).mockRejectedValueOnce({ message: '   ' });
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'UPCOMING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Checked in' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Status update failed',
        text: 'Please try again.',
      });
    });
  });

  it('assigns the same-origin path when a linked entry resolves to a safe route', async () => {
    mockGetSafeSameOriginPath.mockImplementation((path: string) => path);
    let assignSpy: jest.Mock | null = null;
    try {
      assignSpy = jest.fn();
      Object.defineProperty(globalThis.window.location, 'assign', {
        configurable: true,
        value: assignSpy,
      });
    } catch {
      assignSpy = null;
    }
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[1], id: 'nav-task-safe' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { TASK: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open task' }));

    expect(mockGetSafeSameOriginPath).toHaveBeenCalledWith('/tasks?taskId=t-1');
    if (assignSpy) {
      expect(assignSpy).toHaveBeenCalledWith('/tasks?taskId=t-1');
    }
  });

  it('renders a dash status pill for an appointment with an empty status', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: '' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    expect(screen.getAllByTitle('-').length).toBeGreaterThan(0);
  });

  it('renders the compact "Awaiting" label for an awaiting-payment status pill', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'AWAITING_PAYMENT' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    expect(screen.getByText('Awaiting')).toBeInTheDocument();
  });

  it('renders audit rows for mixed event types, connectors, and unknown actor types', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });
    (getCompanionAuditTrail as jest.Mock).mockResolvedValue([
      {
        eventType: 'INVOICE_PAID',
        entityType: 'INVOICE',
        actorType: 'ROBOT',
        actorName: 'Bot 9000',
        occurredAt: '2026-03-20T10:00:00.000Z',
      },
      {
        id: 'audit-empty',
        eventType: '',
        actorType: 'SYSTEM',
        actorName: '',
        occurredAt: '2026-03-19T10:00:00.000Z',
      },
    ]);

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Audit trail' }));

    expect(await screen.findByText('Updated by: Bot 9000 • System')).toBeInTheDocument();
    expect(screen.getByText('Updated by: System')).toBeInTheDocument();
  });

  it('shows the empty audit state when the audit response is not an array', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });
    (getCompanionAuditTrail as jest.Mock).mockResolvedValue(null);

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Audit trail' }));

    expect(await screen.findByText('No audit entries found.')).toBeInTheDocument();
  });

  it('skips the audit fetch and shows an empty state without a companion id', async () => {
    render(<CompanionHistoryTimeline companionId="" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Audit trail' }));

    expect(await screen.findByText('No audit entries found.')).toBeInTheDocument();
    expect(getCompanionAuditTrail).not.toHaveBeenCalled();
  });

  it('opens a document by link id and revokes a stale blob preview', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        baseEntries[4],
        {
          ...baseEntries[3],
          id: 'doc-link-id',
          link: { kind: 'document', id: 'd-9' },
          payload: {},
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 2, countsByType: { LAB_RESULT: 1, DOCUMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Result PDF' }));
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'IDEXX Result PDF #l-1-blob:lab-result'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open file' }));

    await waitFor(() => {
      expect(loadDocumentDownloadURL).toHaveBeenCalledWith('d-9');
    });
    await waitFor(() => {
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:lab-result');
    });
    expect(screen.getByTestId('pdf-preview')).toHaveTextContent(
      'Blood panel PDF-https://example.com/file.pdf'
    );
  });

  it('logs when opening a document fails', async () => {
    (loadDocumentDownloadURL as jest.Mock).mockRejectedValueOnce(new Error('download failed'));
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[3]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { DOCUMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open file' }));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to open document:', expect.any(Error));
    });
  });

  it('navigates to the diagnostics route for a non-active linked lab result', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[4]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open result' }));

    expect(mockGetSafeSameOriginPath).toHaveBeenCalledWith(
      '/appointments?appointmentId=a-1&open=labs&subLabel=idexx-labs'
    );
  });

  it('does nothing when a linked medical entry resolves to no appointment', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[2],
          id: 'form-no-appt',
          link: { kind: 'form_submission', id: 'f-9', patientId: 'c-1' },
          payload: {},
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { FORM_SUBMISSION: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open submission' }));

    expect(mockGetSafeSameOriginPath).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('ignores a medical primary click while its document preview is still loading', async () => {
    (loadDocumentDownloadURL as jest.Mock).mockReturnValue(new Promise(() => {}));
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[3]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { DOCUMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open file' }));
    await waitFor(() => {
      expect(loadDocumentDownloadURL).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open file' }));

    expect(loadDocumentDownloadURL).toHaveBeenCalledTimes(1);
  });

  it('collapses expanded diagnostic results on a second toggle click', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[4],
          payload: {
            ...baseEntries[4].payload,
            results: [{ test: 'WBC', value: '6.1', unit: 'k/uL' }],
          },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'View IDEXX Result' }));
    expect(await screen.findByText('WBC')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide IDEXX Result' }));

    await waitFor(() => {
      expect(screen.queryByText('WBC')).not.toBeInTheDocument();
    });
  });

  it('revokes an earlier result-PDF blob when opening a second result PDF', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        baseEntries[4],
        {
          ...baseEntries[4],
          id: 'entry-lab-2',
          title: 'IDEXX Result 2',
          link: { kind: 'lab_result', id: 'l-2', appointmentId: 'a-1', patientId: 'c-1' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 2, countsByType: { LAB_RESULT: 2 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    const resultButtons = await screen.findAllByRole('button', { name: 'Result PDF' });
    fireEvent.click(resultButtons[0]);
    await screen.findByTestId('pdf-preview');

    fireEvent.click(resultButtons[1]);

    await waitFor(() => {
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:lab-result');
    });
  });

  it('renders a disabled status pill for a task that is not loaded', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[1], status: 'PENDING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { TASK: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Give medication');
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
  });

  it('resolves linked appointment and task ids from link and payload fallbacks', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'UPCOMING',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    mockTasksById['t-1'] = {
      _id: 't-1',
      organisationId: 'org-1',
      assignedTo: 'team-1',
      audience: 'PARENT_TASK',
      source: 'CUSTOM',
      category: 'Care',
      name: 'Give medication',
      dueAt: new Date('2026-03-19T10:00:00.000Z'),
      status: 'PENDING',
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[0],
          id: 'appt-fallback',
          status: 'UPCOMING',
          link: { kind: 'other', id: 'x', appointmentId: 'a-1', patientId: 'c-1' },
          payload: {},
        },
        {
          ...baseEntries[1],
          id: 'task-fallback',
          status: 'PENDING',
          link: { kind: 'task', id: '', appointmentId: 'a-9', patientId: 'c-1' },
          payload: { taskId: 't-1' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 2, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    expect(screen.getAllByRole('button', { name: 'Status' })).toHaveLength(2);
  });

  it('notifies when an appointment is unloaded before its status persists', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'UPCOMING',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'UPCOMING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    delete mockAppointmentsById['a-1'];
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Checked in' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Open appointment to change status' })
      );
    });
    expect(changeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('notifies when a task is unloaded before its status persists', async () => {
    mockTasksById['t-1'] = {
      _id: 't-1',
      organisationId: 'org-1',
      assignedTo: 'team-1',
      audience: 'PARENT_TASK',
      source: 'CUSTOM',
      category: 'Care',
      name: 'Give medication',
      dueAt: new Date('2026-03-19T10:00:00.000Z'),
      status: 'PENDING',
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[1], status: 'PENDING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { TASK: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Give medication');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    delete mockTasksById['t-1'];
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'In progress' }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Open task to change status' })
      );
    });
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it('hides the acknowledgment chip for a lab result without a fallback URL', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[4],
          payload: { status: 'Final' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    expect(await screen.findByRole('button', { name: 'Result PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledgment PDF' })).not.toBeInTheDocument();
  });

  it('shows only the acknowledgment chip for a lab result without a result id', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[4],
          link: { kind: 'other', id: 'x', appointmentId: 'a-1', patientId: 'c-1' },
          payload: { pdfUrl: 'https://example.com/ack-only.pdf' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    expect(await screen.findByRole('button', { name: 'Acknowledgment PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Result PDF' })).not.toBeInTheDocument();
  });

  it('matches the search query against actor name and tags', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        ...baseEntries,
        {
          ...baseEntries[0],
          id: 'entry-tagged',
          title: 'Tagged visit',
          actor: { id: 'u-1', name: 'Dr House', role: 'VET' },
          tags: ['urgent', 'recheck'],
          payload: { appointmentId: 'a-1' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 7, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Tagged visit');
    fireEvent.change(screen.getByLabelText('Search overview records'), {
      target: { value: 'urgent' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Give medication')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Tagged visit')).toBeInTheDocument();
  });

  it('renders positional labels and dashes for sparse structured results', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[4],
          payload: {
            ...baseEntries[4].payload,
            results: [{ value: '' }, 'not-an-object', { test: 'WBC', value: '6.1' }],
          },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'View IDEXX Result' }));

    expect(await screen.findByText('Result 1')).toBeInTheDocument();
    expect(screen.getByText('WBC')).toBeInTheDocument();
  });

  it('flags out-of-range analytes in the record drawer', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[4],
          title: 'Catalyst Chem 17',
          payload: {
            ...baseEntries[4].payload,
            results: [
              // In range: no arrow, no tint.
              { test: 'ALT', value: '48', referenceRange: '10-125' },
              // Above the interval.
              { test: 'WBC', value: '17.2', referenceRange: '5.1-16.8' },
              // Below the interval.
              { test: 'HCT', value: '30', referenceRange: '37-55' },
              // The lab's own flag wins where the value sits on the boundary.
              { test: 'ALP', value: '212', referenceRange: '23-212', interpretation: 'H' },
              // Flagged without a resolvable direction: tinted, but no arrow.
              { test: 'Lipase', value: 'see note', outOfRange: true },
            ],
          },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Open record detail for Catalyst Chem 17' })
    );
    const drawer = await screen.findByRole('dialog', { name: /Catalyst Chem 17/ });

    expect(within(drawer).getByText('ALT')).toBeInTheDocument();
    expect(within(drawer).getByText('10-125')).toBeInTheDocument();
    expect(within(drawer).getByText('WBC ↑')).toBeInTheDocument();
    expect(within(drawer).getByText('HCT ↓')).toBeInTheDocument();
    expect(within(drawer).getByText('ALP ↑')).toBeInTheDocument();
    expect(within(drawer).getByText('Lipase')).toBeInTheDocument();
  });

  it('renders an empty overview and skips fetching when there is no primary org', async () => {
    mockOrgState = { primaryOrgId: null, orgsById: {} };

    render(<CompanionHistoryTimeline companionId="c-1" />);

    expect(await screen.findByText('No records yet')).toBeInTheDocument();
    expect(fetchCompanionHistory).not.toHaveBeenCalled();
  });

  it('keeps every row when a stale status filter lingers after the companion changes', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });

    const { rerender } = render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));
    await screen.findByText('Recheck visit');

    // Pick a specific appointment status filter, then switch companions. The
    // companion-change layout effect resets the active tab to "All" but leaves
    // the status filter in place, so matchesStatusFilter runs against a tab that
    // has no status options at all.
    fireEvent.click(screen.getByRole('button', { name: 'Status: All statuses' }));
    fireEvent.click(screen.getByRole('button', { name: 'Requested' }));

    rerender(<CompanionHistoryTimeline companionId="c-2" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    });
    // The stale "requested" filter must not hide the non-appointment rows.
    expect(await screen.findByText('Give medication')).toBeInTheDocument();
  });

  it('closes the appointment status menu when the trigger loses focus', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'UPCOMING',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], status: 'UPCOMING' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Recheck visit');
    const statusButton = screen.getAllByRole('button', { name: 'Status' }).at(-1)!;
    fireEvent.click(statusButton);
    expect(screen.getByRole('menuitem', { name: 'Checked in' })).toBeInTheDocument();

    fireEvent.blur(statusButton);

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Checked in' })).not.toBeInTheDocument();
    });
  });

  it('resolves the appointment id from payload when the link kind or id is missing', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'UPCOMING',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[0],
          id: 'appt-kind-missing',
          status: 'UPCOMING',
          link: { id: 'a-1', patientId: 'c-1' },
          payload: { appointmentId: 'a-1' },
        },
        {
          ...baseEntries[0],
          id: 'appt-id-missing',
          status: 'UPCOMING',
          link: { kind: 'appointment', patientId: 'c-1' },
          payload: { appointmentId: 'a-1' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 2, countsByType: { APPOINTMENT: 2 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Status' })).toHaveLength(2);
    });
  });

  it('renders audit rows with missing actor and event fields via system fallbacks', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });
    (getCompanionAuditTrail as jest.Mock).mockResolvedValue([
      { id: 'audit-actorless', eventType: 'NOTE_ADDED', occurredAt: '2026-03-20T10:00:00.000Z' },
      { id: 'audit-eventless', occurredAt: '2026-03-19T10:00:00.000Z' },
    ]);

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Audit trail' }));

    expect(await screen.findAllByText('Updated by: System')).toHaveLength(2);
  });

  it('falls back to the default preview title when a document entry has no title', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[3], title: '', payload: { documentId: 'd-1' } }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { DOCUMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open file' }));

    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'Medical record preview-https://example.com/file.pdf'
    );
  });

  it('falls back to the default preview title when previewing a bundled PDF without a title', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[3],
          title: '',
          payload: { documentId: 'd-1', pdfUrl: 'https://example.com/no-title.pdf' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { DOCUMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open file' }));

    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'Medical record preview-https://example.com/no-title.pdf'
    );
    expect(loadDocumentDownloadURL).not.toHaveBeenCalled();
  });

  it('opens the record detail drawer from the row chevron and wires its actions', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[4],
          title: 'Catalyst Chem 17',
          summary: 'Mild ALP elevation.',
          payload: {
            ...baseEntries[4].payload,
            results: [{ test: 'ALP', value: '212', unit: 'U/L' }],
          },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Open record detail for Catalyst Chem 17' })
    );

    const drawer = await screen.findByRole('dialog', { name: /Catalyst Chem 17/ });
    expect(within(drawer).getByText('Record detail')).toBeInTheDocument();
    expect(within(drawer).getByText('ALP')).toBeInTheDocument();
    expect(within(drawer).getByText('212 U/L')).toBeInTheDocument();
    expect(within(drawer).getByText('Mild ALP elevation.')).toBeInTheDocument();
    expect(within(drawer).getByText('Linked to')).toBeInTheDocument();

    // Linked navigation reuses the preserved appointment routing
    fireEvent.click(within(drawer).getByText('Linked appointment'));
    expect(mockGetSafeSameOriginPath).toHaveBeenCalledWith(
      '/appointments?appointmentId=a-1&subLabel=appointment'
    );

    // Share / Discuss surface notifications
    fireEvent.click(within(drawer).getByRole('button', { name: 'Share to app' }));
    expect(mockNotify).toHaveBeenCalledWith(
      'info',
      expect.objectContaining({ title: 'Share to app' })
    );
    fireEvent.click(within(drawer).getByRole('button', { name: 'Discuss in chat' }));
    expect(mockNotify).toHaveBeenCalledWith(
      'info',
      expect.objectContaining({ title: 'Discuss in chat' })
    );

    fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('downloads the record PDF from the drawer as a real browser download', async () => {
    (loadDocumentDownloadURL as jest.Mock).mockResolvedValueOnce([
      { url: 'https://files.example.com/referral-resolved.pdf' },
    ]);
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        {
          ...baseEntries[3],
          title: 'Referral letter',
          payload: { documentId: 'd-1', pdfUrl: 'https://example.com/referral.pdf' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { DOCUMENT: 1 } },
    });

    const clickedAnchors: { href: string; download: string; rel: string; target: string }[] = [];
    const anchorClickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function mockAnchorClick(this: HTMLAnchorElement) {
        clickedAnchors.push({
          href: this.getAttribute('href') ?? '',
          download: this.getAttribute('download') ?? '',
          rel: this.getAttribute('rel') ?? '',
          target: this.getAttribute('target') ?? '',
        });
      });

    try {
      render(<CompanionHistoryTimeline companionId="c-1" />);

      fireEvent.click(
        await screen.findByRole('button', { name: 'Open record detail for Referral letter' })
      );
      const drawer = await screen.findByRole('dialog', { name: /Referral letter/ });
      fireEvent.click(within(drawer).getByRole('button', { name: 'Download PDF' }));

      // The drawer resolves the document's real URL by id and hands it to the
      // browser via a synthesised anchor, rather than opening the in-app viewer.
      await waitFor(() => expect(anchorClickSpy).toHaveBeenCalledTimes(1));
      expect(loadDocumentDownloadURL).toHaveBeenCalledWith('d-1');
      expect(clickedAnchors).toEqual([
        {
          href: 'https://files.example.com/referral-resolved.pdf',
          download: 'Referral letter',
          rel: 'noopener',
          target: '_blank',
        },
      ]);

      // A real download must not open the in-app PDF preview overlay.
      expect(screen.queryByTestId('pdf-preview')).not.toBeInTheDocument();
    } finally {
      anchorClickSpy.mockRestore();
    }
  });

  // Regression: the drawer's only primary action used to be "Download PDF", which
  // pushed entry.link.id into the document download endpoint. A lab / invoice /
  // task id is not a document id, so those records lost their open path and got a
  // "Document unavailable" error instead. Each non-document type keeps its own
  // routing and never touches the document endpoint.
  it.each([
    [
      'lab result',
      4,
      'IDEXX Result',
      'Open result',
      '/appointments?appointmentId=a-1&open=labs&subLabel=idexx-labs',
    ],
    ['invoice', 5, 'Invoice', 'Open finance', '/finance?invoiceId=i-1'],
    ['task', 1, 'Give medication', 'Open task', '/tasks?taskId=t-1'],
  ])(
    'opens a %s from the drawer through its own route, not the document endpoint',
    async (_type, entryIndex, title, actionLabel, expectedPath) => {
      (fetchCompanionHistory as jest.Mock).mockResolvedValue({
        entries: [baseEntries[entryIndex as number]],
        nextCursor: null,
        summary: { totalReturned: 1, countsByType: {} },
      });

      render(<CompanionHistoryTimeline companionId="c-1" />);

      fireEvent.click(
        await screen.findByRole('button', { name: `Open record detail for ${title}` })
      );
      const drawer = await screen.findByRole('dialog', { name: new RegExp(title as string) });

      expect(
        within(drawer).queryByRole('button', { name: 'Download PDF' })
      ).not.toBeInTheDocument();
      fireEvent.click(within(drawer).getByRole('button', { name: actionLabel as string }));

      expect(mockGetSafeSameOriginPath).toHaveBeenCalledWith(expectedPath);
      expect(loadDocumentDownloadURL).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }
  );

  it('opens the drawer record in place when it belongs to the active appointment', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[5]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { INVOICE: 1 } },
    });
    const onOpenAppointmentView = jest.fn();

    render(
      <CompanionHistoryTimeline
        companionId="c-1"
        activeAppointmentId="a-1"
        onOpenAppointmentView={onOpenAppointmentView}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open record detail for Invoice' }));
    const drawer = await screen.findByRole('dialog', { name: /Invoice/ });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Open finance' }));

    expect(onOpenAppointmentView).toHaveBeenCalledWith({ label: 'finance', subLabel: 'summary' });
    // The drawer must not stay on top of the workspace tab it just opened.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('uses the in-page callback and loaded appointment name for the drawer linked row', async () => {
    mockAppointmentsById['a-1'] = {
      id: 'a-1',
      organisationId: 'org-1',
      status: 'IN_PROGRESS',
      appointmentType: 'Annual check-up',
      companion: { id: 'c-1', name: 'Milo' },
      patient: { id: 'c-1', name: 'Milo' },
    };
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[4], title: 'Chem panel' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });
    const onOpenAppointmentView = jest.fn();

    render(
      <CompanionHistoryTimeline
        companionId="c-1"
        activeAppointmentId="a-1"
        onOpenAppointmentView={onOpenAppointmentView}
      />
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Open record detail for Chem panel' })
    );
    const drawer = await screen.findByRole('dialog', { name: /Chem panel/ });
    fireEvent.click(within(drawer).getByText('Annual check-up'));

    expect(onOpenAppointmentView).toHaveBeenCalledWith({ label: 'info', subLabel: 'appointment' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('omits the linked-to row for appointment records in the drawer', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [{ ...baseEntries[0], title: 'Annual check-up' }],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { APPOINTMENT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Open record detail for Annual check-up' })
    );
    const drawer = await screen.findByRole('dialog', { name: /Annual check-up/ });
    expect(within(drawer).queryByText('Linked to')).not.toBeInTheDocument();
  });

  it('revokes a blob preview URL when the overlay is closed', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[4]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Result PDF' }));
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'IDEXX Result PDF #l-1-blob:lab-result'
    );

    fireEvent.click(screen.getByRole('button', { name: 'close pdf preview' }));

    await waitFor(() => {
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:lab-result');
    });
    expect(screen.queryByTestId('pdf-preview')).not.toBeInTheDocument();
  });

  it('closes a non-blob preview without revoking an object URL', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[4]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledgment PDF' }));
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'IDEXX Result-https://example.com/lab.pdf'
    );
    revokeObjectUrlSpy.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'close pdf preview' }));

    await waitFor(() => {
      expect(screen.queryByTestId('pdf-preview')).not.toBeInTheDocument();
    });
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled();
  });

  it('ignores a late audit rejection after the timeline unmounts', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });
    let rejectAudit: (reason?: unknown) => void = () => undefined;
    (getCompanionAuditTrail as jest.Mock).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectAudit = reject;
      })
    );

    const { unmount } = render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Audit trail' }));
    await screen.findByText('Loading audit trail…');

    unmount();

    await act(async () => {
      rejectAudit(new Error('late audit rejection'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // The cleanup flagged the request cancelled, so the rejection is swallowed
    // without logging the audit-trail error.
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      'Failed to load companion audit trail:',
      expect.anything()
    );
  });

  it('renders the empty overview when the companion id is undefined', async () => {
    render(<CompanionHistoryTimeline companionId={undefined as unknown as string} />);

    expect(await screen.findByText('No records yet')).toBeInTheDocument();
    expect(fetchCompanionHistory).not.toHaveBeenCalled();
  });

  it('keeps the newer loading state when an earlier result PDF settles first', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        baseEntries[4],
        {
          ...baseEntries[4],
          id: 'entry-lab-second',
          title: 'IDEXX Result 2',
          link: { kind: 'lab_result', id: 'l-2', appointmentId: 'a-1', patientId: 'c-1' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 2, countsByType: { LAB_RESULT: 2 } },
    });

    let resolveFirst: (blob: Blob) => void = () => undefined;
    let resolveSecond: (blob: Blob) => void = () => undefined;
    (getIdexxResultPdfBlob as jest.Mock).mockImplementation(({ resultId }: { resultId: string }) =>
      resultId === 'l-1'
        ? new Promise((resolve) => {
            resolveFirst = resolve;
          })
        : new Promise((resolve) => {
            resolveSecond = resolve;
          })
    );

    render(<CompanionHistoryTimeline companionId="c-1" />);

    const resultButtons = await screen.findAllByRole('button', { name: 'Result PDF' });
    // Start loading the first result; its chip flips to the loading label.
    fireEvent.click(resultButtons[0]);
    // The only remaining "Result PDF" chip belongs to the second entry.
    fireEvent.click(await screen.findByRole('button', { name: 'Result PDF' }));

    // Settle the first (older) request while the second is still loading: the
    // finally clause must leave the newer entry's loading id intact.
    await act(async () => {
      resolveFirst(new Blob(['first'], { type: 'application/pdf' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // The second chip is still loading.
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeInTheDocument();

    // Settle the second request so nothing leaks past the test.
    await act(async () => {
      resolveSecond(new Blob(['second'], { type: 'application/pdf' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Loading…' })).not.toBeInTheDocument();
    });
  });

  it('keeps the newer document loading id when an earlier document preview settles first', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        baseEntries[3],
        {
          ...baseEntries[3],
          id: 'entry-document-2',
          title: 'Second document',
          link: { kind: 'document', id: 'd-2', patientId: 'c-1' },
          payload: { documentId: 'd-2' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 2, countsByType: { DOCUMENT: 2 } },
    });

    let resolveFirst: (urls: Array<{ url: string }>) => void = () => undefined;
    let resolveSecond: (urls: Array<{ url: string }>) => void = () => undefined;
    (loadDocumentDownloadURL as jest.Mock).mockImplementation((documentId: string) =>
      documentId === 'd-1'
        ? new Promise((resolve) => {
            resolveFirst = resolve;
          })
        : new Promise((resolve) => {
            resolveSecond = resolve;
          })
    );

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click((await screen.findAllByRole('button', { name: 'Open file' }))[0]);
    await waitFor(() => {
      expect(loadDocumentDownloadURL).toHaveBeenCalledWith('d-1');
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Open file' })[1]);
    await waitFor(() => {
      expect(loadDocumentDownloadURL).toHaveBeenCalledWith('d-2');
    });

    // Settle the first (older) request while the second is still loading; the
    // finally clause must not clear the newer entry's loading id.
    await act(async () => {
      resolveFirst([{ url: 'https://example.com/first.pdf' }]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'Blood panel PDF-https://example.com/first.pdf'
    );

    // Settle the second request so nothing leaks past the test.
    await act(async () => {
      resolveSecond([{ url: 'https://example.com/second.pdf' }]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe('StatusPillSelect', () => {
    it('renders every option when no allowed keys are provided and a nullish status defaults to pending', () => {
      const onChange = jest.fn();
      render(
        <StatusPillSelect
          status={null}
          options={[
            { name: 'Upcoming', key: 'upcoming' },
            { name: 'Checked in', key: 'checked_in' },
          ]}
          onChange={onChange}
        />
      );

      const trigger = screen.getByRole('button', { name: 'Status' });
      // Nullish status resolves to the neutral dash label.
      expect(trigger).toHaveTextContent('-');

      fireEvent.click(trigger);
      expect(screen.getByRole('menuitem', { name: 'Upcoming' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Checked in' })).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Upcoming' }));
      expect(onChange).toHaveBeenCalledWith('upcoming');
    });

    it('restricts the menu to the allowed keys when provided', () => {
      const onChange = jest.fn();
      render(
        <StatusPillSelect
          status="upcoming"
          options={[
            { name: 'Upcoming', key: 'upcoming' },
            { name: 'Checked in', key: 'checked_in' },
            { name: 'Completed', key: 'completed' },
          ]}
          allowedKeys={['CHECKED_IN']}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Status' }));
      expect(screen.getByRole('menuitem', { name: 'Checked in' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Upcoming' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Completed' })).not.toBeInTheDocument();
    });

    it('renders a read-only pill with no trigger when locked', () => {
      render(
        <StatusPillSelect
          status="completed"
          options={[{ name: 'Completed', key: 'completed' }]}
          locked
          onChange={jest.fn()}
        />
      );

      expect(screen.getByTitle('Completed')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
    });
  });

  describe('RequestedAppointmentActions', () => {
    it('renders the open primary action for a non-requested status', () => {
      const onOpen = jest.fn();
      const onStatusChange = jest.fn();
      render(
        <RequestedAppointmentActions
          entry={{ ...baseEntries[0], status: null } as any}
          canEdit
          onStatusChange={onStatusChange}
          onOpen={onOpen}
        />
      );

      const openButton = screen.getByRole('button', { name: 'Open' });
      fireEvent.click(openButton);
      expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'entry-appointment' }));
      expect(onStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('phone variant', () => {
    it('renders the compact layout without the desktop search / sort controls', async () => {
      (fetchCompanionHistory as jest.Mock).mockResolvedValue({
        entries: baseEntries,
        nextCursor: null,
        summary: { totalReturned: baseEntries.length, countsByType: {} },
      });

      render(<CompanionHistoryTimeline companionId="c-1" variant="phone" showDocumentUpload />);

      // Timeline entries and the filter tabs still render...
      expect(await screen.findByText('Recheck visit')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /All/ })).toBeInTheDocument();
      // ...but the desktop-only Search field and Sort pill are dropped on phone.
      expect(screen.queryByLabelText('Search overview records')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Sort by:/ })).not.toBeInTheDocument();
    });

    it('jumps to Medical records and reveals the uploader when the signal advances', async () => {
      (fetchCompanionHistory as jest.Mock).mockResolvedValue({
        entries: baseEntries,
        nextCursor: null,
        summary: { totalReturned: baseEntries.length, countsByType: {} },
      });

      const { rerender } = render(
        <CompanionHistoryTimeline
          companionId="c-1"
          variant="phone"
          showDocumentUpload
          openMedicalRecordsSignal={0}
        />
      );

      await screen.findByText('Recheck visit');
      // The uploader is hidden while the default (All) filter is active.
      expect(screen.queryByText('history-document-upload-c-1')).not.toBeInTheDocument();

      rerender(
        <CompanionHistoryTimeline
          companionId="c-1"
          variant="phone"
          showDocumentUpload
          openMedicalRecordsSignal={1}
        />
      );

      // Advancing the signal switches the active filter to Medical records,
      // which surfaces the document uploader.
      expect(await screen.findByText('history-document-upload-c-1')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Medical records/ })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });
});

describe('PillDropdown', () => {
  const OPTIONS = [
    { label: 'All statuses', value: 'all' },
    { label: 'Completed', value: 'completed' },
  ];

  it('toggles the menu and shows the selected option label in the trigger', () => {
    render(<PillDropdown label="Status" options={OPTIONS} value="all" onSelect={jest.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Status: All statuses' });
    // Menu is closed until the trigger is clicked.
    expect(screen.queryByRole('button', { name: 'Completed' })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();

    // Clicking the trigger again closes the menu (toggle-off branch).
    fireEvent.click(trigger);
    expect(screen.queryByRole('button', { name: 'Completed' })).not.toBeInTheDocument();
  });

  it('selects an option, notifies the caller, and closes the menu', () => {
    const onSelect = jest.fn();
    render(<PillDropdown label="Status" options={OPTIONS} value="all" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Status: All statuses' }));
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));

    expect(onSelect).toHaveBeenCalledWith('completed');
    expect(screen.queryByRole('button', { name: 'Completed' })).not.toBeInTheDocument();
  });

  it('falls back to the bare label when the value has no matching option', () => {
    render(<PillDropdown label="Status" options={OPTIONS} value="unknown" onSelect={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Status: Status' })).toBeInTheDocument();
  });

  it('closes on an outside pointer-down but ignores pointer-downs inside the control', () => {
    render(
      <div>
        <button type="button">outside</button>
        <PillDropdown label="Status" options={OPTIONS} value="all" onSelect={jest.fn()} />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Status: All statuses' }));
    // A pointer-down inside the control leaves the menu open.
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Completed' }));
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();

    // A pointer-down outside the control closes the menu.
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('button', { name: 'Completed' })).not.toBeInTheDocument();
  });
});
