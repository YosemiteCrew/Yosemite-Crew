import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AttestationDocumentPanel from '@/app/features/petPassport/components/attestation/AttestationDocumentPanel';

const loadDocumentDownloadURLMock = jest.fn();

// The shared testMocks bundle is deliberately not used here: its Buttons mock
// spreads every prop onto the DOM node, which turns the real button's
// `ariaLabel` prop into an invalid DOM attribute. Only next/image needs mocking.
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src, unoptimized: _unoptimized, ...rest }: Record<string, unknown>) =>
    React.createElement('img', { alt, src, ...rest }),
}));

jest.mock('@/app/features/companions/services/companionDocumentService', () => ({
  loadDocumentDownloadURL: (...args: unknown[]) => loadDocumentDownloadURLMock(...args),
}));

const onOpenFile = jest.fn();

const renderPanel = (documentId?: string) =>
  render(
    <AttestationDocumentPanel
      documentId={documentId}
      title="Rabies certificate"
      onOpenFile={onOpenFile}
    />
  );

describe('AttestationDocumentPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis.open as unknown) = jest.fn();
  });

  it('says so plainly when the record has no file to read', () => {
    renderPanel(undefined);

    expect(screen.getByText(/No file is attached to this record/)).toBeInTheDocument();
    expect(loadDocumentDownloadURLMock).not.toHaveBeenCalled();
  });

  it('previews an image upload inline and opens it in a new tab', async () => {
    loadDocumentDownloadURLMock.mockResolvedValue([
      { url: 'https://files.example/cert.jpg', mimeType: 'image/jpeg', key: 'k1' },
    ]);

    renderPanel('doc-1');
    await waitFor(() => expect(loadDocumentDownloadURLMock).toHaveBeenCalledWith('doc-1'));

    const preview = await screen.findByAltText('Uploaded document: Rabies certificate');
    expect(preview).toHaveAttribute('src', 'https://files.example/cert.jpg');

    fireEvent.click(screen.getByRole('button', { name: 'Open Rabies certificate' }));
    expect(globalThis.open).toHaveBeenCalledWith(
      'https://files.example/cert.jpg',
      '_blank',
      'noopener'
    );
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  it('renders a typed tile for a file the viewer cannot frame, such as a PDF', async () => {
    loadDocumentDownloadURLMock.mockResolvedValue([
      { url: 'https://files.example/cert.pdf', mimeType: 'application/pdf', key: 'k1' },
    ]);

    renderPanel('doc-1');

    expect(await screen.findByText('PDF document')).toBeInTheDocument();
    expect(screen.queryByAltText('Uploaded document: Rabies certificate')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Rabies certificate' })).toBeInTheDocument();
  });

  it('labels each file when the record carries several', async () => {
    loadDocumentDownloadURLMock.mockResolvedValue([
      { url: 'https://files.example/a.pdf', mimeType: 'application/pdf', key: 'k1' },
      { url: 'https://files.example/b.pdf', key: 'k2' },
    ]);

    renderPanel('doc-1');

    expect(
      await screen.findByRole('button', { name: 'Open Rabies certificate (file 2)' })
    ).toBeInTheDocument();
    // A file with no mime type still names its tile rather than showing nothing.
    expect(screen.getByText('Document')).toBeInTheDocument();
  });

  it('drops a signed-url response that arrives after the panel is unmounted', async () => {
    let resolveLoad: (files: unknown[]) => void = () => undefined;
    loadDocumentDownloadURLMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      })
    );

    const { unmount } = renderPanel('doc-1');
    unmount();

    await act(async () => {
      resolveLoad([
        { url: 'https://files.example/late.pdf', mimeType: 'application/pdf', key: 'k' },
      ]);
    });

    expect(
      screen.queryByRole('button', { name: /Open Rabies certificate/ })
    ).not.toBeInTheDocument();
  });

  it('warns the vet rather than showing an empty panel when the file cannot be loaded', async () => {
    loadDocumentDownloadURLMock.mockRejectedValue(new Error('denied'));

    renderPanel('doc-1');

    expect(await screen.findByText(/Do not attest a record you cannot read/)).toBeInTheDocument();
  });

  it('treats an empty signed-url response as nothing to read', async () => {
    loadDocumentDownloadURLMock.mockResolvedValue([]);

    renderPanel('doc-1');

    expect(await screen.findByText(/No file is attached to this record/)).toBeInTheDocument();
  });
});
