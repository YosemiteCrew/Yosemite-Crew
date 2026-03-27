import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompanionHistoryTimeline from '@/app/features/companionHistory/components/CompanionHistoryTimeline';
import { fetchCompanionHistory } from '@/app/features/companionHistory/services/companionHistoryService';
import { getCompanionAuditTrail } from '@/app/features/audit/services/auditService';
import { loadCompanionDocument } from '@/app/features/companions/services/companionDocumentService';

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  __esModule: true,
  PermissionGate: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div>fallback</div>,
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) =>
    selector({ primaryOrgId: 'org-1', orgsById: { 'org-1': { type: 'HOSPITAL' } } }),
}));

jest.mock('@/app/features/companions/services/companionDocumentService', () => ({
  loadCompanionDocument: jest.fn().mockResolvedValue([]),
  loadDocumentDownloadURL: jest.fn().mockResolvedValue([{ url: 'https://example.com/file.pdf' }]),
}));

jest.mock('@/app/features/companionHistory/services/companionHistoryService', () => ({
  fetchCompanionHistory: jest.fn(),
}));

jest.mock('@/app/features/audit/services/auditService', () => ({
  getCompanionAuditTrail: jest.fn(),
}));

describe('CompanionHistoryTimeline', () => {
  let consoleErrorSpy: jest.SpyInstance;

  const baseEntries: any[] = [
    {
      id: 'entry-appointment',
      type: 'APPOINTMENT',
      occurredAt: '2026-03-20T10:00:00.000Z',
      title: 'Recheck visit',
      subtitle: 'Dermatology',
      summary: 'Skin irritation follow-up',
      link: { kind: 'appointment', id: 'a-1', appointmentId: 'a-1', companionId: 'c-1' },
      source: 'APPOINTMENT',
      payload: { serviceName: 'Consult', roomName: 'Room 2' },
    },
    {
      id: 'entry-task',
      type: 'TASK',
      occurredAt: '2026-03-19T10:00:00.000Z',
      title: 'Give medication',
      subtitle: 'Medication',
      summary: 'Administer twice daily',
      link: { kind: 'task', id: 't-1', appointmentId: 'a-1', companionId: 'c-1' },
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
      link: { kind: 'form_submission', id: 'f-1', appointmentId: 'a-1', companionId: 'c-1' },
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
      link: { kind: 'document', id: 'd-1', companionId: 'c-1' },
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
      link: { kind: 'lab_result', id: 'l-1', appointmentId: 'a-1', companionId: 'c-1' },
      source: 'LAB',
      payload: { status: 'Final' },
    },
    {
      id: 'entry-invoice',
      type: 'INVOICE',
      occurredAt: '2026-03-15T10:00:00.000Z',
      title: 'Invoice',
      subtitle: 'Paid',
      summary: 'USD 120.00',
      link: { kind: 'invoice', id: 'i-1', appointmentId: 'a-1', companionId: 'c-1' },
      source: 'INVOICE',
      payload: { totalAmount: 120, currency: 'USD' },
    },
  ];

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (fetchCompanionHistory as jest.Mock).mockReset();
    (getCompanionAuditTrail as jest.Mock).mockReset().mockResolvedValue([]);
    (loadCompanionDocument as jest.Mock).mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders mixed entries and type-specific action labels', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
      expect(screen.getByText('Blood panel PDF')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Open file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open result' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open finance' })).toBeInTheDocument();
  });

  it('filters by selected quick filter', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });
    (loadCompanionDocument as jest.Mock).mockResolvedValue([
      {
        id: 'd-1',
        title: 'Blood panel PDF',
        category: 'HEALTH',
        subcategory: 'LAB_TESTS',
        attachments: [{ key: 'doc-key-1' }],
        issueDate: '2026-03-17T10:00:00.000Z',
      },
    ]);

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));

    await waitFor(() => {
      expect(screen.getAllByText('Blood panel PDF').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Recheck visit')).not.toBeInTheDocument();
  });

  it('appends entries on load more', async () => {
    (fetchCompanionHistory as jest.Mock)
      .mockResolvedValueOnce({
        entries: baseEntries.slice(0, 2),
        nextCursor: 'cursor-1',
        summary: { totalReturned: 2, countsByType: {} },
      })
      .mockResolvedValueOnce({
        entries: baseEntries.slice(2, 4),
        nextCursor: null,
        summary: { totalReturned: 2, countsByType: {} },
      });

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(screen.getByText('SOAP Subjective')).toBeInTheDocument();
      expect(screen.getByText('Blood panel PDF')).toBeInTheDocument();
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
      expect(screen.getByText('No history entries found.')).toBeInTheDocument();
    });
  });

  it('renders error state when fetch fails', async () => {
    (fetchCompanionHistory as jest.Mock).mockRejectedValue(new Error('failed'));

    render(<CompanionHistoryTimeline companionId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load history. Please try again.')).toBeInTheDocument();
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
      expect(screen.getByRole('tab', { name: 'SOAP / Templates' })).toBeInTheDocument();
    });
  });

  it('shows upload records only under Documents filter', async () => {
    (fetchCompanionHistory as jest.Mock).mockResolvedValue({
      entries: baseEntries,
      nextCursor: null,
      summary: { totalReturned: 6, countsByType: {} },
    });

    render(<CompanionHistoryTimeline companionId="c-1" showDocumentUpload />);

    await waitFor(() => {
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Upload records' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(screen.getByRole('button', { name: 'Upload records' })).toBeInTheDocument();
    expect(loadCompanionDocument).toHaveBeenCalledWith('c-1');
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
      expect(screen.getByText('Recheck visit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Audit trail' }));

    await waitFor(() => {
      expect(screen.getByText('Invoice paid')).toBeInTheDocument();
    });
    expect(getCompanionAuditTrail).toHaveBeenCalledWith('c-1');
  });
});
