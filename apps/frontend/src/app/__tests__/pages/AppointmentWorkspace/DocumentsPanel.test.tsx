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
  default: ({
    open,
    pdfUrl,
    onClose,
    onDownload,
  }: {
    open: boolean;
    pdfUrl?: string | null;
    onClose?: () => void;
    onDownload?: () => void;
  }) => (
    <div data-testid="pdf-preview" data-open={String(open)} data-url={pdfUrl ?? ''}>
      <button type="button" data-testid="pdf-preview-close" onClick={onClose}>
        close preview
      </button>
      {onDownload ? (
        <button type="button" data-testid="pdf-preview-download" onClick={onDownload}>
          download preview
        </button>
      ) : null}
    </div>
  ),
}));

const makeAuthRedirectError = () =>
  Object.assign(new Error('Authentication required. Redirecting to sign in.'), {
    __ycAuthRedirect: true,
  });

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

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
  // clearMocks resets calls but not implementations, so re-establish the
  // aggregate-service defaults each test to stop persistent overrides leaking.
  (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([]);
  (createEncounterDocumentPacket as jest.Mock).mockResolvedValue({
    packetId: 'packet-1',
    status: 'DRAFT',
    signing: null,
  });
  (signWorkspaceDocumentPacket as jest.Mock).mockResolvedValue({
    packetId: 'packet-1',
    status: 'DRAFT',
    signing: { status: 'IN_PROGRESS', signingUrl: 'https://sign.test/abc' },
  });
  (getEncounterDocumentPacketPdfUrl as jest.Mock).mockResolvedValue('blob:packet-pdf');
  (reconcileWorkspaceDocumentPacket as jest.Mock).mockResolvedValue({ packetId: 'packet-1' });
  (linkAppointmentForms as jest.Mock).mockResolvedValue(undefined);
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

  it('stamps the assigned-form rows in the preferred timezone, not the device zone', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValueOnce({
      appointmentId: 'appt-1',
      forms: [
        {
          // 23:30 UTC is already the next day in Europe/Berlin (the default
          // preferred zone), so the date pins the zone rather than the device's.
          form: { _id: 'form-rollover', name: 'Rollover form', updatedAt: '2026-01-01T23:30:00Z' },
          submission: null,
          status: 'pending',
        },
        {
          // 07:05 UTC is 08:05 in Berlin; the leading zero pins hour: '2-digit',
          // which is what the Activity tab's formatDateTimeLocal renders.
          form: { _id: 'form-morning', name: 'Morning form', updatedAt: '2026-03-04T07:05:00Z' },
          submission: null,
          status: 'pending',
        },
      ],
    });

    renderPanel();

    // Was date.toLocaleDateString(undefined, …) / toLocaleTimeString(undefined, …):
    // the browser's locale in the device zone, so an en-GB machine read
    // "2 Jan 2026" / "00:30" and a UTC machine read "Jan 1, 2026" / "11:30 PM".
    expect(await screen.findByText('Jan 2, 2026')).toBeInTheDocument();
    expect(screen.getByText('12:30 AM')).toBeInTheDocument();
    expect(screen.getByText('Mar 4, 2026')).toBeInTheDocument();
    expect(screen.getByText('08:05 AM')).toBeInTheDocument();
    await settle();
  });

  it('formats string, missing, and invalid timestamps and falls back through the id chain', async () => {
    (fetchAppointmentForms as jest.Mock).mockResolvedValueOnce({
      appointmentId: 'appt-1',
      forms: [
        {
          // No `updatedAt` → falls back to the string `createdAt`; no `_id` on
          // form or submission → id falls back to the form name.
          form: { name: 'String dates form', createdAt: '2026-03-04T09:30:00Z', status: 'pending' },
          submission: null,
          status: 'pending',
        },
        {
          form: { _id: 'form-invalid', name: 'Invalid date form', updatedAt: 'not-a-date' },
          submission: null,
          status: 'pending',
        },
        {
          // No dates at all → formatDate/formatTime hit their empty guards; no
          // visibilityType or category → audience falls back to STAFF.
          form: { name: 'No dates form' },
          submission: null,
          status: 'pending',
        },
      ],
    });

    renderPanel();

    expect(await screen.findByText('String dates form')).toBeInTheDocument();
    expect(screen.getByText('Invalid date form')).toBeInTheDocument();
    expect(screen.getByText('No dates form')).toBeInTheDocument();
    // Two rows with neither visibilityType nor category resolve to Staff form.
    expect(screen.getAllByText('Staff form').length).toBeGreaterThanOrEqual(2);
    await settle();
  });
});

describe('DocumentsPanel clinical packet extra paths', () => {
  const renderSignedPanel = () => {
    (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([
      { documentId: 'doc-1', title: 'Clinical packet', signingStatus: 'SIGNED' },
    ]);
    return renderPanel();
  };

  it('rethrows an auth-redirect error from the document rows without falling back', async () => {
    (listEncounterWorkspaceDocuments as jest.Mock).mockRejectedValue(makeAuthRedirectError());

    renderPanel();

    await waitForDefaultFormsEmptyState();
    // The auth-redirect error is rethrown before the packet fallback runs.
    expect(createEncounterDocumentPacket).not.toHaveBeenCalled();
    await settle();
  });

  it('logs a non-auth failure when the packet endpoint itself rejects', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (createEncounterDocumentPacket as jest.Mock).mockRejectedValue(new Error('packet failed'));

    renderPanel();

    await waitForDefaultFormsEmptyState();
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith('Unable to load clinical packet:', expect.any(Error))
    );
    await settle();
    errorSpy.mockRestore();
  });

  it('swallows an auth-redirect error from the packet endpoint', async () => {
    (createEncounterDocumentPacket as jest.Mock).mockRejectedValue(makeAuthRedirectError());

    renderPanel();

    await waitForDefaultFormsEmptyState();
    await settle();
  });

  it('renders plain-label status and signing badges from the packet state', async () => {
    (createEncounterDocumentPacket as jest.Mock).mockResolvedValue({
      packetId: 'packet-1',
      status: 'FINAL',
      signing: { status: 'IN_PROGRESS' },
    });

    renderPanel();

    expect(await screen.findByText('Final')).toBeInTheDocument();
    // The label appears both as a badge and on the disabled Sign button.
    expect(screen.getAllByText('Signing in progress').length).toBeGreaterThanOrEqual(1);
    await settle();
  });

  it('drops unknown status/signing enums instead of surfacing raw values', async () => {
    (createEncounterDocumentPacket as jest.Mock).mockResolvedValue({
      packetId: 'packet-1',
      status: 'WEIRD',
      signing: { status: 'ODD' },
    });

    renderPanel();

    await waitForDefaultFormsEmptyState();
    expect(screen.queryByText('WEIRD')).not.toBeInTheDocument();
    expect(screen.queryByText('ODD')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    await settle();
  });

  it('renders no status badge when the packet has no status yet', async () => {
    (createEncounterDocumentPacket as jest.Mock).mockResolvedValue({ packetId: 'packet-1' });

    renderPanel();

    await waitForDefaultFormsEmptyState();
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    expect(screen.queryByText('Final')).not.toBeInTheDocument();
    await settle();
  });

  it('promotes the packet to signed when reconciliation reports a signature', async () => {
    (listEncounterWorkspaceDocuments as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ documentId: 'doc-1', signingStatus: 'SIGNED' }]);
    (reconcileWorkspaceDocumentPacket as jest.Mock).mockResolvedValueOnce({
      packetId: 'packet-1',
      status: 'FINAL',
      signing: { status: 'signed' },
    });

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

    expect(await screen.findByRole('button', { name: /download signed/i })).toBeInTheDocument();
    await settle();
  });

  it('logs a non-auth reconciliation failure and still refreshes', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (reconcileWorkspaceDocumentPacket as jest.Mock).mockRejectedValueOnce(
      new Error('reconcile failed')
    );

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
      expect(errorSpy).toHaveBeenCalledWith(
        'Unable to reconcile packet signing:',
        expect.any(Error)
      )
    );
    errorSpy.mockRestore();
    await settle();
  });

  it('swallows an auth-redirect reconciliation failure', async () => {
    (reconcileWorkspaceDocumentPacket as jest.Mock).mockRejectedValueOnce(makeAuthRedirectError());

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

    await waitFor(() => expect(reconcileWorkspaceDocumentPacket).toHaveBeenCalled());
    await settle();
  });

  it('logs a print failure without crashing the panel', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (getEncounterDocumentPacketPdfUrl as jest.Mock).mockRejectedValueOnce(
      new Error('print failed')
    );

    renderPanel();
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();

    fireEvent.click(screen.getByRole('button', { name: 'Print All' }));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        'Unable to open the clinical packet:',
        expect.any(Error)
      )
    );
    await settle();
    errorSpy.mockRestore();
  });

  it('downloads the signed packet and revokes the object url', async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    renderSignedPanel();

    fireEvent.click(await screen.findByRole('button', { name: /download signed/i }));

    await waitFor(() =>
      expect(getEncounterDocumentPacketPdfUrl).toHaveBeenCalledWith('org-1', 'enc-1')
    );
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:packet-pdf');
    clickSpy.mockRestore();
    await settle();
  });

  it('shows the default download message when the failure is not an Error', async () => {
    (getEncounterDocumentPacketPdfUrl as jest.Mock).mockRejectedValueOnce('boom');

    renderSignedPanel();

    fireEvent.click(await screen.findByRole('button', { name: /download signed/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to download the signed document.'
    );
    await settle();
  });

  it('opens, downloads from, and closes the packet preview overlay', async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    (getEncounterDocumentPacketPdfUrl as jest.Mock).mockResolvedValueOnce('blob:printed-packet');

    renderPanel();
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();

    fireEvent.click(screen.getByRole('button', { name: 'Print All' }));
    await waitFor(() =>
      expect(screen.getByTestId('pdf-preview')).toHaveAttribute('data-open', 'true')
    );

    // Download from the preview reuses the shared anchor-download helper.
    fireEvent.click(screen.getByTestId('pdf-preview-download'));
    expect(clickSpy).toHaveBeenCalled();

    // Closing revokes the preview blob; a second close is a no-op on the null url.
    fireEvent.click(screen.getByTestId('pdf-preview-close'));
    await waitFor(() =>
      expect(screen.getByTestId('pdf-preview')).toHaveAttribute('data-open', 'false')
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:printed-packet');
    fireEvent.click(screen.getByTestId('pdf-preview-close'));
    clickSpy.mockRestore();
    await settle();
  });

  it('applies packet/signing fallbacks when the sign response omits them', async () => {
    (signWorkspaceDocumentPacket as jest.Mock).mockResolvedValueOnce({
      packetId: 'packet-1',
      signing: { signingUrl: 'https://sign.test/fallback' },
    });

    renderPanel();
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();

    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    await waitFor(() =>
      expect(useSigningOverlayStore.getState().url).toBe('https://sign.test/fallback')
    );
    // status falls back to the created packet's DRAFT and signing to IN_PROGRESS.
    expect(await screen.findByText('Draft')).toBeInTheDocument();
    // The label appears both as a badge and on the disabled Sign button.
    expect(screen.getAllByText('Signing in progress').length).toBeGreaterThanOrEqual(1);
    await settle();
  });

  it('shows the default sign message when the failure is not an Error', async () => {
    renderPanel();
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    await waitForDefaultFormsEmptyState();
    (createEncounterDocumentPacket as jest.Mock).mockRejectedValueOnce('sign boom');

    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to start signing.');
    await settle();
  });
});

describe('DocumentsPanel template loading', () => {
  it('does not load templates when no organisation id is provided', async () => {
    render(
      <DocumentsPanel
        appointmentId="appt-1"
        companionId="comp-1"
        encounterId="enc-1"
        appointmentStatus="IN_PROGRESS"
      />
    );

    await waitForDefaultFormsEmptyState();
    expect(loadTemplateForms).not.toHaveBeenCalled();
    await settle();
  });

  it('logs a non-auth template load failure', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (loadTemplateForms as jest.Mock).mockRejectedValueOnce(new Error('templates failed'));

    renderPanel();

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        'Unable to load assignable form templates:',
        expect.any(Error)
      )
    );
    errorSpy.mockRestore();
    await settle();
  });

  it('swallows an auth-redirect template load failure', async () => {
    (loadTemplateForms as jest.Mock).mockRejectedValueOnce(makeAuthRedirectError());

    renderPanel();

    await waitForDefaultFormsEmptyState();
    await settle();
  });

  it('ignores a template load that resolves after unmount', async () => {
    let resolveTemplates: (value: unknown[]) => void = () => undefined;
    (loadTemplateForms as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTemplates = resolve;
      })
    );

    const { unmount } = renderPanel();
    await waitForDefaultFormsEmptyState();
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    await settle();

    unmount();

    await act(async () => {
      resolveTemplates([template()]);
      await Promise.resolve();
    });
  });

  it('ignores a second assignment while one is already in flight', async () => {
    let resolveLink: (value?: unknown) => void = () => undefined;
    (linkAppointmentForms as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLink = resolve;
      })
    );

    renderPanel();
    await waitFor(() => expect(fetchAppointmentForms).toHaveBeenCalled());

    fireEvent.focus(screen.getByLabelText('Search forms to add'));
    fireEvent.click(await screen.findByText('Surgery Consent'));
    // Second click while the first assignment is pending is ignored by the guard.
    fireEvent.click(screen.getByText('Custom intake form'));

    expect(linkAppointmentForms).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLink(undefined);
      await Promise.resolve();
    });
    await waitFor(() => expect(fetchAppointmentForms).toHaveBeenCalledTimes(2));
    await settle();
  });

  it('closes the search dropdown on an outside press', async () => {
    renderPanel();
    await waitForDefaultFormsEmptyState();

    fireEvent.focus(screen.getByLabelText('Search forms to add'));
    expect(await screen.findByText('Surgery Consent')).toBeInTheDocument();

    fireEvent.mouseDown(globalThis.document.body);

    await waitFor(() => expect(screen.queryByText('Surgery Consent')).not.toBeInTheDocument());
    await settle();
  });
});
