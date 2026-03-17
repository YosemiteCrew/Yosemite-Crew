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

describe('CompanionDocumentsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        subcategory: 'GENERAL',
        visitType: 'CHECKUP',
        issueDate: '2026-01-01T10:00:00Z',
        syncedFromPms: true,
        pmsVisible: true,
        attachments: [{ key: 'k1', mimeType: 'application/pdf' }],
      },
    ]);

    render(<CompanionDocumentsSection companionId="comp-1" />);
    await waitFor(() => expect(screen.getByText('vaccination card')).toBeInTheDocument());

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
        subcategory: 'GENERAL',
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
});
