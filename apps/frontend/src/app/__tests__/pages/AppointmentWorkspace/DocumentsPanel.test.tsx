import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DocumentsPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/DocumentsPanel';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import {
  fetchAppointmentForms,
  linkAppointmentForms,
} from '@/app/features/forms/services/appointmentFormsService';
import { downloadSubmissionPdf } from '@/app/features/forms/services/formSigningService';
import { loadTemplateForms } from '@/app/features/forms/services/templateFormsService';
import {
  createEncounterDocumentPacket,
  getEncounterDocumentPacketPdfUrl,
  listEncounterWorkspaceDocuments,
  reconcileWorkspaceDocumentPacket,
  signWorkspaceDocumentPacket,
} from '@/app/features/appointments/services/workspaceAggregateService';

jest.mock('@/app/features/appointments/services/workspaceAggregateService', () => ({
  createEncounterDocumentPacket: jest
    .fn()
    .mockResolvedValue({ packetId: 'packet-1', status: 'DRAFT', signing: null }),
  signWorkspaceDocumentPacket: jest.fn().mockResolvedValue({
    packetId: 'packet-1',
    status: 'DRAFT',
    signing: { status: 'IN_PROGRESS', signingUrl: 'https://sign.test/abc' },
  }),
  getEncounterDocumentPacketPdfUrl: jest.fn().mockResolvedValue('blob:packet-pdf'),
  listEncounterWorkspaceDocuments: jest.fn().mockResolvedValue([]),
  reconcileWorkspaceDocumentPacket: jest.fn().mockResolvedValue({ packetId: 'packet-1' }),
}));

jest.mock('@/app/features/forms/services/appointmentFormsService', () => ({
  fetchAppointmentForms: jest.fn(),
  linkAppointmentForms: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/features/forms/services/templateFormsService', () => ({
  loadTemplateForms: jest.fn(),
}));

jest.mock('@/app/features/forms/services/formSigningService', () => ({
  downloadSubmissionPdf: jest.fn(),
}));

jest.mock('@/app/features/documents/components/CompanionDocumentsSection', () => ({
  __esModule: true,
  default: () => <div data-testid="companion-docs" />,
}));

jest.mock('@/app/ui/overlays/SigningOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid="signing-overlay" />,
}));

jest.mock('@/app/ui/overlays/PdfPreviewOverlay', () => ({
  __esModule: true,
  default: ({ open, pdfUrl }: { open: boolean; pdfUrl?: string | null }) => (
    <div data-testid="pdf-preview" data-open={String(open)} data-url={pdfUrl ?? ''} />
  ),
}));

const template = (overrides: Record<string, unknown> = {}) => ({
  id: 'tpl-consent',
  organisationId: 'org-1',
  ownerUserId: null,
  ownership: 'ORGANISATION',
  kind: 'CONSENT',
  name: 'Surgery Consent',
  description: null,
  status: 'PUBLISHED',
  scope: 'ORGANISATION',
  rules: null,
  latestVersion: 1,
  publishedVersion: 1,
  createdBy: 'u1',
  updatedBy: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useSigningOverlayStore.setState({ open: false, url: null });
  Object.defineProperty(globalThis.window, 'open', {
    value: jest.fn(),
    writable: true,
    configurable: true,
  });
  URL.createObjectURL = jest.fn(() => 'blob:form-pdf');
  URL.revokeObjectURL = jest.fn();
  (fetchAppointmentForms as jest.Mock).mockResolvedValue({ appointmentId: 'appt-1', forms: [] });
  (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([]);
  (loadTemplateForms as jest.Mock).mockResolvedValue([
    template(),
    // Clinical + plan-definition kinds must be filtered out of the search.
    template({ id: 'tpl-soap', kind: 'SOAP_NOTE', name: 'SOAP note' }),
    template({ id: 'tpl-rx', kind: 'PRESCRIPTION', name: 'Prescription' }),
    template({ id: 'tpl-draft', kind: 'FORM', name: 'Draft form', status: 'DRAFT' }),
    template({ id: 'tpl-custom', kind: 'FORM', name: 'Custom intake form' }),
  ]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const renderPanel = () =>
  render(
    <DocumentsPanel
      appointmentId="appt-1"
      companionId="comp-1"
      organisationId="org-1"
      encounterId="enc-1"
      appointmentStatus="IN_PROGRESS"
    />
  );

const waitForDefaultFormsEmptyState = () =>
  screen.findByText('No forms assigned yet. Use the search above to add a consent or custom form.');

describe('DocumentsPanel forms search', () => {
  it('lists only assignable (consent/custom, published) templates in the search', async () => {
    renderPanel();
    await waitFor(() =>
      expect(loadTemplateForms).toHaveBeenCalledWith('org-1', { status: 'PUBLISHED' })
    );
    await waitForDefaultFormsEmptyState();

    fireEvent.change(screen.getByLabelText('Search forms to add'), { target: { value: 'form' } });

    expect(await screen.findByText('Custom intake form')).toBeInTheDocument();
    expect(screen.queryByText('SOAP note')).not.toBeInTheDocument();
    expect(screen.queryByText('Prescription')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft form')).not.toBeInTheDocument();
  });

  it('shows all assignable forms on focus without typing a query', async () => {
    renderPanel();
    await waitFor(() => expect(loadTemplateForms).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();

    fireEvent.focus(screen.getByLabelText('Search forms to add'));

    // Both assignable (consent + custom FORM) templates surface immediately;
    // clinical/plan/draft kinds stay filtered out.
    expect(await screen.findByText('Surgery Consent')).toBeInTheDocument();
    expect(screen.getByText('Custom intake form')).toBeInTheDocument();
    expect(screen.queryByText('SOAP note')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft form')).not.toBeInTheDocument();
  });

  it('assigns a template and refetches the assigned forms', async () => {
    renderPanel();
    await waitFor(() => expect(fetchAppointmentForms).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Search forms to add'), {
      target: { value: 'consent' },
    });
    fireEvent.click(await screen.findByText('Surgery Consent'));

    await waitFor(() =>
      expect(linkAppointmentForms).toHaveBeenCalledWith({
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        formIds: ['tpl-consent'],
      })
    );
    // Refetch after assignment.
    expect(fetchAppointmentForms).toHaveBeenCalledTimes(2);
  });

  it('hides already assigned templates from the search results', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValueOnce({
      appointmentId: 'appt-1',
      forms: [
        {
          form: {
            _id: 'form-1',
            name: 'Surgery Consent',
            visibilityType: 'External',
            status: 'pending',
            createdAt: new Date('2026-01-01T08:00:00Z'),
            updatedAt: new Date('2026-01-01T08:00:00Z'),
          },
          submission: null,
          status: 'pending',
        },
      ],
    });

    renderPanel();
    await waitFor(() => expect(loadTemplateForms).toHaveBeenCalled());

    fireEvent.focus(screen.getByLabelText('Search forms to add'));

    expect(await screen.findByText('Custom intake form')).toBeInTheDocument();
    expect(screen.getAllByText('Surgery Consent')).toHaveLength(1);
  });

  it('shows the empty search state when no template matches the query', async () => {
    renderPanel();
    await waitFor(() => expect(loadTemplateForms).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();

    fireEvent.change(screen.getByLabelText('Search forms to add'), {
      target: { value: 'rabies release' },
    });

    expect(
      await screen.findByText('No forms available to add for this search.')
    ).toBeInTheDocument();
  });

  it('shows the empty browse state when the org has no assignable templates', async () => {
    (loadTemplateForms as jest.Mock).mockResolvedValueOnce([]);

    renderPanel();
    await waitFor(() => expect(loadTemplateForms).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();

    fireEvent.focus(screen.getByLabelText('Search forms to add'));

    expect(await screen.findByText('No assignable forms available to add.')).toBeInTheDocument();
  });

  it('shows an assignment error when linking the form fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (linkAppointmentForms as jest.Mock).mockRejectedValueOnce(new Error('assign failed'));

    renderPanel();
    await waitFor(() => expect(fetchAppointmentForms).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Search forms to add'), {
      target: { value: 'consent' },
    });
    fireEvent.click(await screen.findByText('Surgery Consent'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to assign this form. Please try again.'
    );
    errorSpy.mockRestore();
  });
});

describe('DocumentsPanel clinical packet', () => {
  it('uses signed encounter document rows to keep quick actions in sync', async () => {
    (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([
      {
        documentId: 'doc-1',
        title: 'Clinical packet',
        signingStatus: 'SIGNED',
      },
    ]);

    renderPanel();

    expect(await screen.findByRole('button', { name: /download signed/i })).toBeInTheDocument();
    await waitForDefaultFormsEmptyState();
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByText('Signed')).toBeInTheDocument();
    expect(createEncounterDocumentPacket).not.toHaveBeenCalled();
  });

  it('falls back to the packet endpoint when encounter document rows fail to load', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (listEncounterWorkspaceDocuments as jest.Mock).mockRejectedValue(new Error('rows failed'));

    renderPanel();

    await waitFor(() =>
      expect(createEncounterDocumentPacket).toHaveBeenCalledWith('org-1', 'enc-1')
    );
    await waitForDefaultFormsEmptyState();
    errorSpy.mockRestore();
  });

  it('reconciles the packet against Documenso when the signing overlay closes', async () => {
    renderPanel();
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();

    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));
    await waitFor(() =>
      expect(useSigningOverlayStore.getState().url).toBe('https://sign.test/abc')
    );

    await act(async () => {
      useSigningOverlayStore.getState().close();
    });

    await waitFor(() =>
      expect(reconcileWorkspaceDocumentPacket).toHaveBeenCalledWith('org-1', 'packet-1')
    );
  });

  it('shows the fallback packet copy when no encounter context is available', async () => {
    render(
      <DocumentsPanel
        appointmentId="appt-1"
        companionId="comp-1"
        organisationId="org-1"
        appointmentStatus="IN_PROGRESS"
      />
    );

    await waitForDefaultFormsEmptyState();
    expect(
      screen.getByText('Open this from an encounter to print or sign the combined packet.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print All' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign' })).toBeDisabled();
  });

  it('opens the packet preview after print succeeds', async () => {
    (getEncounterDocumentPacketPdfUrl as jest.Mock).mockResolvedValueOnce('blob:printed-packet');

    renderPanel();
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();

    fireEvent.click(screen.getByRole('button', { name: 'Print All' }));

    await waitFor(() =>
      expect(screen.getByTestId('pdf-preview')).toHaveAttribute('data-open', 'true')
    );
    expect(getEncounterDocumentPacketPdfUrl).toHaveBeenCalledWith('org-1', 'enc-1');
  });

  it('shows a packet creation error when signing cannot create a packet', async () => {
    renderPanel();
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();
    (createEncounterDocumentPacket as jest.Mock).mockResolvedValueOnce({ packetId: null });

    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Document packet could not be created.'
    );
  });

  it('shows a signing link error when the packet service returns no link', async () => {
    renderPanel();
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();
    (createEncounterDocumentPacket as jest.Mock).mockResolvedValueOnce({
      packetId: 'packet-2',
      status: 'DRAFT',
      signing: null,
    });
    (signWorkspaceDocumentPacket as jest.Mock).mockResolvedValueOnce({
      packetId: 'packet-2',
      status: 'DRAFT',
      signing: { status: 'IN_PROGRESS' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Signing link is not available yet.'
    );
  });

  it('shows a download error when the signed packet cannot be fetched', async () => {
    (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValueOnce([
      {
        documentId: 'doc-1',
        title: 'Clinical packet',
        signingStatus: 'SIGNED',
      },
    ]);
    (getEncounterDocumentPacketPdfUrl as jest.Mock).mockRejectedValueOnce(
      new Error('signed packet unavailable')
    );

    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /download signed/i }));
    await waitForDefaultFormsEmptyState();

    expect(await screen.findByRole('alert')).toHaveTextContent('signed packet unavailable');
  });

  it('shows the records empty state when no companion id is available', async () => {
    render(<DocumentsPanel appointmentId="appt-1" organisationId="org-1" encounterId="enc-1" />);

    await waitForDefaultFormsEmptyState();
    fireEvent.click(screen.getByRole('tab', { name: 'Records' }));

    expect(await screen.findByText('No companion records available.')).toBeInTheDocument();
  });

  it('renders the loading and error states for assigned forms', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (fetchAppointmentForms as jest.Mock).mockRejectedValueOnce(new Error('forms failed'));

    renderPanel();

    expect(await screen.findByText('Unable to load forms. Try again later.')).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});

describe('DocumentsPanel form rows', () => {
  it('renders completed and pending rows with the correct action labels', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValueOnce({
      appointmentId: 'appt-1',
      forms: [
        {
          form: {
            _id: 'form-1',
            name: 'Pre-op consent',
            visibilityType: 'External',
            status: 'completed',
            createdAt: new Date('2026-01-01T08:00:00Z'),
            updatedAt: new Date('2026-01-01T08:00:00Z'),
          },
          submission: { _id: 'submission-1' },
          status: 'completed',
        },
        {
          form: {
            _id: 'form-2',
            name: 'Staff intake',
            visibilityType: 'Internal',
            status: 'pending',
            createdAt: new Date('2026-01-02T08:00:00Z'),
            updatedAt: new Date('2026-01-02T08:00:00Z'),
          },
          submission: null,
          status: 'pending',
        },
      ],
    });

    renderPanel();

    expect(await screen.findByText('Pre-op consent')).toBeInTheDocument();
    expect(screen.getByText('Authorized by Client')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Pre-op consent' })).toBeInTheDocument();
    expect(screen.getByText('Staff intake')).toBeInTheDocument();
    expect(screen.getByText('Acknowledgement pending')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Awaiting parent submission for Staff intake' })
    ).toBeDisabled();
  });

  it('falls back to category when resolving legacy form audience payloads', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValueOnce({
      appointmentId: 'appt-1',
      forms: [
        {
          form: {
            _id: 'form-legacy-consent',
            name: 'Legacy consent',
            category: 'Consent',
            status: 'completed',
            createdAt: new Date('2026-01-01T08:00:00Z'),
            updatedAt: new Date('2026-01-01T08:00:00Z'),
          },
          submission: { _id: 'submission-legacy-consent' },
          status: 'completed',
        },
        {
          form: {
            _id: 'form-legacy-staff',
            name: 'Legacy staff form',
            category: 'Exam',
            status: 'completed',
            createdAt: new Date('2026-01-02T08:00:00Z'),
            updatedAt: new Date('2026-01-02T08:00:00Z'),
          },
          submission: { _id: 'submission-legacy-staff' },
          status: 'completed',
        },
      ],
    });

    renderPanel();

    expect(await screen.findByText('Legacy consent')).toBeInTheDocument();
    expect(screen.getByText('Parent consent')).toBeInTheDocument();
    expect(screen.getByText('Legacy staff form')).toBeInTheDocument();
    expect(screen.getByText('Staff form')).toBeInTheDocument();
    expect(screen.getByText('Authorized by Service Provider')).toBeInTheDocument();
  });

  it('downloads a submitted form and opens the blob in a new tab', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValueOnce({
      appointmentId: 'appt-1',
      forms: [
        {
          form: {
            _id: 'form-1',
            name: 'Pre-op consent',
            visibilityType: 'External',
            status: 'completed',
            createdAt: new Date('2026-01-01T08:00:00Z'),
            updatedAt: new Date('2026-01-01T08:00:00Z'),
          },
          submission: { _id: 'submission-1' },
          status: 'completed',
        },
      ],
    });
    (downloadSubmissionPdf as jest.Mock).mockResolvedValueOnce(
      new Blob(['pdf'], { type: 'application/pdf' })
    );

    renderPanel();

    await screen.findByText('Pre-op consent');
    fireEvent.click(screen.getByRole('button', { name: 'Download Pre-op consent' }));

    await waitFor(() => expect(downloadSubmissionPdf).toHaveBeenCalledWith('submission-1'));
    expect(globalThis.window.open).toHaveBeenCalledWith('blob:form-pdf', '_blank', 'noopener');
  });

  it('shows a download error when the form PDF cannot be fetched', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (fetchAppointmentForms as jest.Mock).mockResolvedValueOnce({
      appointmentId: 'appt-1',
      forms: [
        {
          form: {
            _id: 'form-1',
            name: 'Pre-op consent',
            visibilityType: 'External',
            status: 'completed',
            createdAt: new Date('2026-01-01T08:00:00Z'),
            updatedAt: new Date('2026-01-01T08:00:00Z'),
          },
          submission: { _id: 'submission-1' },
          status: 'completed',
        },
      ],
    });
    (downloadSubmissionPdf as jest.Mock).mockRejectedValueOnce(new Error('download failed'));

    renderPanel();

    await screen.findByText('Pre-op consent');
    fireEvent.click(screen.getByRole('button', { name: 'Download Pre-op consent' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to download this form. Please try again.'
    );
    errorSpy.mockRestore();
  });
});
