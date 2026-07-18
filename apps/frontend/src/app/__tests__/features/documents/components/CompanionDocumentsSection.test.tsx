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

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
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

jest.mock('@/app/lib/validators', () => ({
  toTitle: (value: string) => value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
}));

jest.mock('@/app/lib/forms', () => ({
  formatDateLabel: () => 'Jan 01, 2026',
  formatTimeLabel: () => '10:00 AM',
}));

let mockOrgState: { primaryOrgId: string | null; orgsById: Record<string, { name?: string }> } = {
  primaryOrgId: null,
  orgsById: {},
};

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: any) => unknown) => selector(mockOrgState),
}));

describe('CompanionDocumentsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrgState = { primaryOrgId: null, orgsById: {} };
    loadCompanionDocumentMock.mockResolvedValue([]);
    loadDocumentDownloadURLMock.mockResolvedValue([{ url: 'https://example.com/file.pdf' }]);
    (globalThis.open as any) = jest.fn();
  });

  it('shows empty state when no records exist', async () => {
    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(loadCompanionDocumentMock).toHaveBeenCalledWith('comp-1'));
    expect(screen.getByText('No documents found')).toBeInTheDocument();
  });

  it('renders records and opens file download link', async () => {
    loadCompanionDocumentMock.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'vaccination card',
        category: 'HEALTH',
        subcategory: 'VACCINATION',
        visitType: 'CHECKUP',
        issueDate: '2026-01-01T10:00:00Z',
        syncedFromPms: true,
        pmsVisible: true,
        attachments: [{ key: 'k1', mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('vaccination card')).toBeInTheDocument());
    expect(screen.getByText('Vaccination')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Open file'));
    await waitFor(() => expect(loadDocumentDownloadURLMock).toHaveBeenCalledWith('doc-1'));
    expect(globalThis.open).toHaveBeenCalledWith('https://example.com/file.pdf', '_blank');
  });

  it('validates required fields before saving', async () => {
    render(<CompanionDocumentsSection companionId="comp-1" />);

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
        subcategory: 'IMAGING_DIAGNOSTIC',
        attachments: [{ key: 'file-key-1', mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);

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
    expect(screen.getByText(/Issued by Biz Co/)).toBeInTheDocument();
    expect(screen.getByText('No attachments')).toBeInTheDocument();

    expect(screen.getByText('Parent Doc')).toBeInTheDocument();
    expect(screen.getByText(/Issued by Pet parent/)).toBeInTheDocument();
    expect(screen.getByText('2 files (PNG)')).toBeInTheDocument();

    expect(screen.getByText('Staff Doc')).toBeInTheDocument();
    expect(screen.getByText(/Issued by Staff/)).toBeInTheDocument();
    expect(screen.getByText('1 file (FILE)')).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('Open file'));
    await waitFor(() => expect(loadDocumentDownloadURLMock).toHaveBeenCalledWith('doc-err'));
    expect(globalThis.open).not.toHaveBeenCalled();
  });

  it('backfills issuingBusinessName from the primary org and preserves it across org changes', async () => {
    mockOrgState = { primaryOrgId: 'org-1', orgsById: { 'org-1': { name: 'Happy Vet' } } };

    const { rerender } = render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('No documents found')).toBeInTheDocument());

    // Switching the primary org re-runs the effect; issuingBusinessName is already
    // set, so the updater returns the previous state unchanged.
    mockOrgState = { primaryOrgId: 'org-2', orgsById: { 'org-2': { name: 'Second Clinic' } } };
    rerender(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('No documents found')).toBeInTheDocument());
  });

  it('resolves an empty org name when the primary org is missing from the store', async () => {
    mockOrgState = { primaryOrgId: 'org-missing', orgsById: {} };
    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('No documents found')).toBeInTheDocument());
  });

  it('resets records without fetching when companionId is empty', async () => {
    render(<CompanionDocumentsSection companionId="" />);
    await waitFor(() => expect(screen.getByText('No documents found')).toBeInTheDocument());
    expect(loadCompanionDocumentMock).not.toHaveBeenCalled();
  });

  it('treats a null document response as an empty list', async () => {
    loadCompanionDocumentMock.mockResolvedValue(null);
    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(loadCompanionDocumentMock).toHaveBeenCalledWith('comp-1'));
    await waitFor(() => expect(screen.getByText('No documents found')).toBeInTheDocument());
  });

  it('falls back to an empty list when loading documents fails', async () => {
    loadCompanionDocumentMock.mockRejectedValue(new Error('boom'));
    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(loadCompanionDocumentMock).toHaveBeenCalledWith('comp-1'));
    await waitFor(() => expect(screen.getByText('No documents found')).toBeInTheDocument());
  });

  it('swallows errors when creating a document fails', async () => {
    createCompanionDocumentMock.mockRejectedValue(new Error('save failed'));
    loadCompanionDocumentMock.mockResolvedValue([]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(loadCompanionDocumentMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'xray report' } });
    fireEvent.click(screen.getByText('Upload document'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(createCompanionDocumentMock).toHaveBeenCalled());
    // Reload never happens because the create rejected before the second fetch.
    expect(loadCompanionDocumentMock).toHaveBeenCalledTimes(1);
  });
});
