import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompanionHistoryTimeline from '@/app/features/companionHistory/components/CompanionHistoryTimeline';
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
  default: ({ open, pdfUrl, title }: any) =>
    open ? <div data-testid="pdf-preview">{`${title}-${pdfUrl}`}</div> : null,
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) =>
    selector({ primaryOrgId: 'org-1', orgsById: { 'org-1': { type: 'HOSPITAL' } } }),
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
    (loadDocumentDownloadURL as jest.Mock).mockClear();
    (changeAppointmentStatus as jest.Mock).mockClear().mockResolvedValue(undefined);
    (changeTaskStatus as jest.Mock).mockClear().mockResolvedValue(undefined);
    (getIdexxResultPdfBlob as jest.Mock)
      .mockClear()
      .mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    mockNotify.mockClear();
    Object.keys(mockAppointmentsById).forEach((key) => delete mockAppointmentsById[key]);
    Object.keys(mockTasksById).forEach((key) => delete mockTasksById[key]);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    windowOpenSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('renders table tabs and type-specific action labels', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries.map((entry) =>
        entry.type === 'INVOICE' ? { ...entry, status: 'AWAITING_PAYMENT' } : entry
      ),
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Consult')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Medical records' }));

    await waitFor(() => {
      expect(screen.getByText('Blood panel PDF')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Open file' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Diagnostics' }));

    await waitFor(() => {
      expect(screen.getByText('IDEXX Result')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Open result' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Follow up' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Billing' }));

    await waitFor(() => {
      expect(screen.getByText('i-1')).toBeInTheDocument();
    });

    expect(screen.getByText('Awaiting')).toBeInTheDocument();
    expect(screen.queryByText('Awaiting Payment')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open finance' })).toBeInTheDocument();
  });

  it('filters by selected table tab', async () => {
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
      expect(screen.getByText('Consult')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Medical records' }));

    await waitFor(() => {
      expect(screen.getByText('Blood panel PDF')).toBeInTheDocument();
      expect(screen.queryByText('Consult')).not.toBeInTheDocument();
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

  it('shows document upload accordion in medical records filter and refreshes after upload', async () => {
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
      expect(screen.getByText('Consult')).toBeInTheDocument();
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
            payload: { serviceName: 'Wellness consult', roomName: 'Room 3' },
          },
        ],
        nextCursor: null,
        summary: { totalReturned: 1, countsByType: {} },
      });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Consult')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(screen.getByText('Wellness consult')).toBeInTheDocument();
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
      expect(screen.getByText('No overview entries found.')).toBeInTheDocument();
    });
  });

  it('renders error state when fetch fails', async () => {
    (fetchCompanionHistory as jest.Mock).mockRejectedValue(new Error('failed'));

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load overview. Please try again.')).toBeInTheDocument();
    });
  });

  it('uses clinical label for forms filter', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Medical records' })).toBeInTheDocument();
    });
  });

  it('requests backend type filters when switching tabs', async () => {
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
      expect(screen.getByText('Consult')).toBeInTheDocument();
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

  it('renders companion audit trail entries under Audit trail filter', async () => {
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
      expect(screen.getByText('Consult')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Audit trail' }));

    await waitFor(() => {
      expect(screen.getByText('Invoice paid')).toBeInTheDocument();
    });
    expect(getCompanionAuditTrail).toHaveBeenCalledWith('c-1');
  });

  it('opens a document entry URL in the PDF preview overlay', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Medical records' }));

    const openFile = await screen.findByRole('button', { name: 'Open file' });
    fireEvent.click(openFile);

    await waitFor(() => {
      expect(loadDocumentDownloadURL).toHaveBeenCalledWith('d-1');
    });
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'Blood panel PDF-https://example.com/file.pdf'
    );
    expect(windowOpenSpy).not.toHaveBeenCalled();
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

    fireEvent.click(await screen.findByRole('tab', { name: 'Medical records' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open submission' }));

    expect(await screen.findByText('Heart rate')).toBeInTheDocument();
    expect(screen.getByText('88 / bpm')).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('tab', { name: 'Medical records' }));
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

    fireEvent.click(await screen.findByRole('tab', { name: 'Diagnostics' }));
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

  it('opens diagnostic acknowledgment PDFs directly from the order PDF URL', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [baseEntries[4]],
      nextCursor: null,
      summary: { totalReturned: 1, countsByType: { LAB_RESULT: 1 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Diagnostics' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledgment PDF' }));

    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent(
      'IDEXX Result-https://example.com/lab.pdf'
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

    await screen.findByText('Consult');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Checked-in' }));

    await waitFor(() => {
      expect(changeAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a-1' }),
        'CHECKED_IN'
      );
    });
    expect(await screen.findByText('Checked-in')).toBeInTheDocument();
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

    await screen.findByText('Consult');
    fireEvent.click(screen.getAllByRole('button', { name: 'Status' }).at(-1)!);

    // UPCOMING → CHECKED_IN | CANCELLED | NO_SHOW only.
    expect(screen.getByRole('menuitem', { name: 'Checked-in' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cancelled' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Requested' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Completed' })).not.toBeInTheDocument();
  });

  it('filters appointments by the selected section status', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: [
        { ...baseEntries[0], id: 'appt-upcoming', status: 'UPCOMING' },
        {
          ...baseEntries[0],
          id: 'appt-cancelled',
          status: 'CANCELLED',
          payload: { appointmentId: 'a-2', serviceName: 'Cancelled consult' },
        },
      ],
      nextCursor: null,
      summary: { totalReturned: 2, countsByType: { APPOINTMENT: 2 } },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await screen.findByText('Consult');
    expect(screen.getByText('Cancelled consult')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Status: All statuses' }));
    // The dropdown option is a button labelled exactly "Cancelled"; the cancelled
    // appointment row only renders a read-only status span, so this is unambiguous.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelled' }));

    await waitFor(() => {
      expect(screen.queryByText('Consult')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Cancelled consult')).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('tab', { name: 'Tasks' }));
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

    await screen.findByText('Consult');
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

    fireEvent.click(await screen.findByRole('tab', { name: 'Tasks' }));
    await screen.findByText('Give medication');
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
  });

  it('uses in-page callback for active appointment linked entries', async () => {
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

    fireEvent.click(await screen.findByRole('tab', { name: 'Diagnostics' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open result' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Appointments' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));

    expect(onOpenAppointmentView).toHaveBeenCalledWith({
      label: 'labs',
      subLabel: 'idexx-labs',
    });
    expect(onOpenAppointmentView).toHaveBeenCalledWith({
      label: 'info',
      subLabel: 'appointment',
    });
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
});
