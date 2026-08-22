import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import CompanionDocumentsSection from '@/app/features/documents/components/CompanionDocumentsSection';

const loadCompanionDocumentMock = jest.fn();
const createCompanionDocumentMock = jest.fn();
const loadDocumentDownloadURLMock = jest.fn();

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children, fallback }: any) => <>{children || fallback}</>,
}));

jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div>fallback</div>,
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ children, showModal }: any) => (showModal ? <div>{children}</div> : null),
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

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect }: any) => (
    <button
      type="button"
      onClick={() =>
        onSelect({ label: placeholder, value: placeholder === 'Category' ? 'HEALTH' : 'GENERAL' })
      }
    >
      Select {placeholder}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value} onChange={onChange} />
    </label>
  ),
}));

jest.mock('@/app/ui/widgets/UploadImage/CompanionDoc', () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange('file-key-1')}>
      Upload document
    </button>
  ),
}));

jest.mock('@/app/features/companions/services/companionDocumentService', () => ({
  createCompanionDocument: (...args: any[]) => createCompanionDocumentMock(...args),
  loadCompanionDocument: (...args: any[]) => loadCompanionDocumentMock(...args),
  loadDocumentDownloadURL: (...args: any[]) => loadDocumentDownloadURLMock(...args),
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: () => 'Jan 01, 2026',
}));

type MockOrgState = {
  primaryOrgId: string | null;
  orgsById: Record<string, { name?: string }>;
  // usePermissions derives the viewer's rights from the membership role, so the
  // passport action's gate can be exercised through the real permission table.
  membershipsByOrgId?: Record<string, { roleCode: string; active: boolean }>;
  status?: string;
};

let mockOrgState: MockOrgState = {
  primaryOrgId: null,
  orgsById: {},
};

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: any) => unknown) => selector(mockOrgState),
}));

const openUploadSheet = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Upload record' }));

describe('CompanionDocumentsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrgState = { primaryOrgId: null, orgsById: {} };
    loadCompanionDocumentMock.mockResolvedValue([]);
    loadDocumentDownloadURLMock.mockResolvedValue([{ url: 'https://example.com/file.pdf' }]);
    (globalThis.open as any) = jest.fn();
  });

  it('shows the designed empty state when no records exist', async () => {
    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(loadCompanionDocumentMock).toHaveBeenCalledWith('comp-1'));
    expect(screen.getByText('No records yet')).toBeInTheDocument();
    expect(screen.getByText(/Everything from visits lands here automatically/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload record' })).toBeInTheDocument();
    // The design pairs the CTA with a secondary "Request from pet parent" pill,
    // which has no flow behind it yet and so renders unavailable.
    expect(screen.getByRole('button', { name: 'Request from pet parent' })).toBeDisabled();
  });

  it('renders a grouped record row and opens the file on row click', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'vaccination card',
        category: 'HEALTH',
        subcategory: 'VACCINATION',
        issueDate: '2026-01-01T10:00:00Z',
        syncedFromPms: true,
        pmsVisible: true,
        attachments: [{ key: 'k1', mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('vaccination card')).toBeInTheDocument());
    // Month bucket header, typed sub-category label, and both status pills.
    expect(screen.getByText('January 2026')).toBeInTheDocument();
    expect(screen.getByText(/Vaccination/)).toBeInTheDocument();
    // "Synced" is both a filter tab (button) and this row's status pill (span).
    expect(screen.getByText('Synced', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('PMS visible')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open vaccination card' }));
    await waitFor(() => expect(loadDocumentDownloadURLMock).toHaveBeenCalledWith('doc-1'));
    expect(globalThis.open).toHaveBeenCalledWith(
      'https://example.com/file.pdf',
      '_blank',
      'noopener'
    );
  });

  it('validates required fields before saving from the upload sheet', async () => {
    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('No records yet')).toBeInTheDocument());

    openUploadSheet();
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('File is required')).toBeInTheDocument();
    });
    expect(createCompanionDocumentMock).not.toHaveBeenCalled();
  });

  it('creates a document after title and upload are provided', async () => {
    createCompanionDocumentMock.mockResolvedValue({});
    loadCompanionDocumentMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'doc-2',
        title: 'xray report',
        category: 'HEALTH',
        subcategory: 'IMAGING_OR_DIAGNOSTIC',
        attachments: [{ key: 'file-key-1', mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('No records yet')).toBeInTheDocument());

    openUploadSheet();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'xray report' } });
    fireEvent.click(screen.getByText('Upload document'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(createCompanionDocumentMock).toHaveBeenCalled());
    expect(loadCompanionDocumentMock).toHaveBeenCalledTimes(2);
  });

  it('renders document source, title fallback, and attachment summary variants', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      // Untitled + issuingBusinessName source + no attachments
      { id: 'd1', title: '', issuingBusinessName: 'Biz Co', category: 'HEALTH', attachments: [] },
      // Pet parent source + multiple attachments with a known mime type
      {
        id: 'd2',
        title: 'Parent Doc',
        uploadedByParentId: 'parent-1',
        category: 'HEALTH',
        attachments: [{ mimeType: 'image/png' }, { mimeType: 'image/png' }],
      },
      // Staff source + single attachment without a mime type (FILE fallback)
      { id: 'd3', title: 'Staff Doc', category: 'HEALTH', attachments: [{}] },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);

    await waitFor(() => expect(screen.getByText('Untitled document')).toBeInTheDocument());
    expect(screen.getByText('Undated · Biz Co')).toBeInTheDocument();
    expect(screen.getByText(/No attachments/)).toBeInTheDocument();

    expect(screen.getByText('Parent Doc')).toBeInTheDocument();
    expect(screen.getByText('Undated · Pet parent')).toBeInTheDocument();
    expect(screen.getByText(/2 files \(PNG\)/)).toBeInTheDocument();

    expect(screen.getByText('Staff Doc')).toBeInTheDocument();
    expect(screen.getByText('Undated · Staff')).toBeInTheDocument();
    expect(screen.getByText(/1 file \(FILE\)/)).toBeInTheDocument();
  });

  it('filters records by source', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 's1',
        title: 'Synced Report',
        category: 'HEALTH',
        subcategory: 'LAB_TEST',
        issueDate: '2026-02-01T10:00:00Z',
        syncedFromPms: true,
        attachments: [{ mimeType: 'application/pdf' }],
      },
      {
        id: 'm1',
        title: 'Manual Upload',
        category: 'HEALTH',
        subcategory: 'PRESCRIPTION',
        issueDate: '2026-02-02T10:00:00Z',
        attachments: [{ mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('Synced Report')).toBeInTheDocument());
    expect(screen.getByText('Manual Upload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All · 2' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Uploaded' }));
    expect(screen.queryByText('Synced Report')).not.toBeInTheDocument();
    expect(screen.getByText('Manual Upload')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Synced' }));
    expect(screen.getByText('Synced Report')).toBeInTheDocument();
    expect(screen.queryByText('Manual Upload')).not.toBeInTheDocument();
  });

  it('shows an inline message when a filter matches no records', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 's1',
        title: 'Synced Report',
        category: 'HEALTH',
        subcategory: 'LAB_TEST',
        issueDate: '2026-02-01T10:00:00Z',
        syncedFromPms: true,
        attachments: [{ mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('Synced Report')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Uploaded' }));
    expect(screen.getByText('No records match this filter.')).toBeInTheDocument();
    expect(screen.queryByText('Synced Report')).not.toBeInTheDocument();
  });

  // The design's Requested / Generated / Signed tabs depend on lifecycle fields
  // the companion documents endpoint does not populate yet, so they must stay
  // off screen rather than render as permanently-empty tabs.
  it('renders no lifecycle tabs for records that carry no lifecycle signal', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 's1',
        title: 'Synced Report',
        category: 'HEALTH',
        subcategory: 'LAB_TEST',
        issueDate: '2026-02-01T10:00:00Z',
        syncedFromPms: true,
        attachments: [{ mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('Synced Report')).toBeInTheDocument());

    // The existing source tabs are untouched.
    expect(screen.getByRole('button', { name: 'All · 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uploaded' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Synced' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Requested' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generated' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Signed' })).not.toBeInTheDocument();
  });

  it('renders and applies the lifecycle tabs the loaded records resolve to', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 'req',
        title: 'Awaited Referral',
        category: 'HEALTH',
        subcategory: 'OTHER',
        issueDate: '2026-02-01T10:00:00Z',
        lifecycle: 'requested',
        attachments: [],
      },
      {
        id: 'sig',
        title: 'Anaesthesia Consent',
        category: 'HEALTH',
        subcategory: 'SURGERY_OR_PROCEDURE',
        issueDate: '2026-02-02T10:00:00Z',
        signedAt: '2026-02-02T12:00:00Z',
        attachments: [{ mimeType: 'application/pdf' }],
      },
      {
        id: 'up',
        title: 'Parent Scan',
        category: 'HEALTH',
        subcategory: 'IMAGING_OR_DIAGNOSTIC',
        issueDate: '2026-02-03T10:00:00Z',
        uploadedByParentId: 'parent-1',
        attachments: [{ mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('Awaited Referral')).toBeInTheDocument());

    // Requested and Signed are populated; Generated is not, so it stays hidden.
    expect(screen.getByRole('button', { name: 'Requested' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Signed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generated' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Requested' }));
    expect(screen.getByText('Awaited Referral')).toBeInTheDocument();
    expect(screen.queryByText('Anaesthesia Consent')).not.toBeInTheDocument();
    expect(screen.queryByText('Parent Scan')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Signed' }));
    expect(screen.getByText('Anaesthesia Consent')).toBeInTheDocument();
    expect(screen.queryByText('Awaited Referral')).not.toBeInTheDocument();

    // The source tabs keep their own meaning alongside the lifecycle tabs.
    fireEvent.click(screen.getByRole('button', { name: 'Uploaded' }));
    expect(screen.getByText('Parent Scan')).toBeInTheDocument();
    expect(screen.getByText('Anaesthesia Consent')).toBeInTheDocument();
  });

  it('surfaces a Generated tab for system-produced records', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 'gen',
        title: 'Discharge Summary',
        category: 'HEALTH',
        subcategory: 'DISCHARGE_SUMMARY',
        issueDate: '2026-02-01T10:00:00Z',
        sourceKind: 'TEMPLATE_INSTANCE',
        attachments: [],
      },
      {
        id: 'plain',
        title: 'Plain Upload',
        category: 'HEALTH',
        subcategory: 'OTHER',
        issueDate: '2026-02-02T10:00:00Z',
        sourceKind: 'DOCUMENT',
        attachments: [{ mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('Discharge Summary')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Generated' }));
    expect(screen.getByText('Discharge Summary')).toBeInTheDocument();
    expect(screen.queryByText('Plain Upload')).not.toBeInTheDocument();
  });

  it('falls back to All when the active lifecycle tab disappears on reload', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 'sig',
        title: 'Signed Consent',
        category: 'HEALTH',
        subcategory: 'SURGERY_OR_PROCEDURE',
        issueDate: '2026-02-01T10:00:00Z',
        signedAt: '2026-02-01T12:00:00Z',
        attachments: [{ mimeType: 'application/pdf' }],
      },
    ]);

    const { rerender } = render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('Signed Consent')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Signed' }));
    expect(screen.getByText('Signed Consent')).toBeInTheDocument();

    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 'plain',
        title: 'Plain Record',
        category: 'HEALTH',
        subcategory: 'OTHER',
        issueDate: '2026-02-02T10:00:00Z',
        attachments: [{ mimeType: 'application/pdf' }],
      },
    ]);
    rerender(<CompanionDocumentsSection companionId="comp-2" />);

    await waitFor(() => expect(screen.getByText('Plain Record')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Signed' })).not.toBeInTheDocument();
    // The filter reset, so the record list is visible rather than empty.
    expect(screen.queryByText('No records match this filter.')).not.toBeInTheDocument();
  });

  it('opens and closes the upload sheet', async () => {
    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('No records yet')).toBeInTheDocument());

    openUploadSheet();
    expect(screen.getByRole('heading', { name: 'Upload record' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Upload record' })).not.toBeInTheDocument();
  });

  it('toggles the sort direction between newest and oldest first', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 'jan',
        title: 'January Report',
        category: 'HEALTH',
        subcategory: 'LAB_TEST',
        issueDate: '2026-01-15T10:00:00Z',
        attachments: [{ mimeType: 'application/pdf' }],
      },
      {
        id: 'mar',
        title: 'March Report',
        category: 'HEALTH',
        subcategory: 'LAB_TEST',
        issueDate: '2026-03-15T10:00:00Z',
        attachments: [{ mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('March Report')).toBeInTheDocument());

    const rowsDesc = screen.getAllByRole('button', { name: /^Open / });
    expect(rowsDesc[0]).toHaveAttribute('aria-label', 'Open March Report');

    fireEvent.click(screen.getByRole('button', { name: /Newest first/ }));

    expect(screen.getByRole('button', { name: /Oldest first/ })).toBeInTheDocument();
    const rowsAsc = screen.getAllByRole('button', { name: /^Open / });
    expect(rowsAsc[0]).toHaveAttribute('aria-label', 'Open January Report');

    // ... and back again, so both arms of the toggle are exercised.
    fireEvent.click(screen.getByRole('button', { name: /Oldest first/ }));
    expect(screen.getByRole('button', { name: /Newest first/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Open / })[0]).toHaveAttribute(
      'aria-label',
      'Open March Report'
    );
  });

  it('swallows errors when the download URL request fails', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 'doc-err',
        title: 'Broken',
        category: 'HEALTH',
        subcategory: 'VACCINATION',
        attachments: [{ mimeType: 'application/pdf' }],
      },
    ]);
    loadDocumentDownloadURLMock.mockRejectedValue(new Error('nope'));

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('Broken')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Open Broken' }));
    await waitFor(() => expect(loadDocumentDownloadURLMock).toHaveBeenCalledWith('doc-err'));
    expect(globalThis.open).not.toHaveBeenCalled();
  });

  it('backfills issuingBusinessName from the primary org and preserves it across org changes', async () => {
    mockOrgState = { primaryOrgId: 'org-1', orgsById: { 'org-1': { name: 'Happy Vet' } } };

    const { rerender } = render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('No records yet')).toBeInTheDocument());

    // Switching the primary org re-runs the effect; issuingBusinessName is already
    // set, so the updater returns the previous state unchanged.
    mockOrgState = { primaryOrgId: 'org-2', orgsById: { 'org-2': { name: 'Second Clinic' } } };
    rerender(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('No records yet')).toBeInTheDocument());
  });

  it('resolves an empty org name when the primary org is missing from the store', async () => {
    mockOrgState = { primaryOrgId: 'org-missing', orgsById: {} };
    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('No records yet')).toBeInTheDocument());
  });

  it('offers the passport review action to a veterinarian on a linked record', async () => {
    mockOrgState = {
      primaryOrgId: 'org-1',
      orgsById: {},
      membershipsByOrgId: { 'org-1': { roleCode: 'VETERINARIAN', active: true } },
      status: 'loaded',
    };
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'rabies certificate',
        category: 'HEALTH',
        subcategory: 'VACCINATION',
        issueDate: '2026-01-01T10:00:00Z',
        attachments: [{ key: 'k1', mimeType: 'application/pdf' }],
        uploadedByParentId: 'parent-1',
        passportRecordId: 'artifact-1',
        passportRecordStatus: 'DRAFT',
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);

    expect(await screen.findByRole('button', { name: 'Review and attest' })).toBeInTheDocument();
    // The row itself keeps its own open action - the two do not nest.
    expect(screen.getByRole('button', { name: 'Open rabies certificate' })).toBeInTheDocument();
  });

  it('hides the passport review action from a role that cannot attest', async () => {
    mockOrgState = {
      primaryOrgId: 'org-1',
      orgsById: {},
      membershipsByOrgId: { 'org-1': { roleCode: 'RECEPTIONIST', active: true } },
      status: 'loaded',
    };
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'rabies certificate',
        category: 'HEALTH',
        subcategory: 'VACCINATION',
        attachments: [{ key: 'k1', mimeType: 'application/pdf' }],
        passportRecordId: 'artifact-1',
        passportRecordStatus: 'DRAFT',
      },
      // A row the API returned without an id still renders and keeps its place.
      {
        title: 'boarding note',
        category: 'HEALTH',
        subcategory: 'OTHER',
        attachments: [{ key: 'k2', mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);

    await screen.findByRole('button', { name: 'Open rabies certificate' });
    expect(screen.getByRole('button', { name: 'Open boarding note' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review and attest' })).not.toBeInTheDocument();
  });

  it('resets records without fetching when companionId is empty', async () => {
    render(<CompanionDocumentsSection companionId="" />);
    await waitFor(() => expect(screen.getByText('No records yet')).toBeInTheDocument());
    expect(loadCompanionDocumentMock).not.toHaveBeenCalled();
  });

  it('treats a null document response as an empty list', async () => {
    loadCompanionDocumentMock.mockResolvedValue(null);
    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(loadCompanionDocumentMock).toHaveBeenCalledWith('comp-1'));
    await waitFor(() => expect(screen.getByText('No records yet')).toBeInTheDocument());
  });

  it('falls back to an empty list when loading documents fails', async () => {
    loadCompanionDocumentMock.mockRejectedValue(new Error('boom'));
    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(loadCompanionDocumentMock).toHaveBeenCalledWith('comp-1'));
    await waitFor(() => expect(screen.getByText('No records yet')).toBeInTheDocument());
  });

  it('swallows errors when creating a document fails', async () => {
    createCompanionDocumentMock.mockRejectedValue(new Error('save failed'));
    loadCompanionDocumentMock.mockResolvedValue([]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(loadCompanionDocumentMock).toHaveBeenCalledTimes(1));

    openUploadSheet();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'xray report' } });
    fireEvent.click(screen.getByText('Upload document'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(createCompanionDocumentMock).toHaveBeenCalled());
    // Reload never happens because the create rejected before the second fetch.
    expect(loadCompanionDocumentMock).toHaveBeenCalledTimes(1);
  });
});
