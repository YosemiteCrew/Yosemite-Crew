import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import RecordAttestationModal from '@/app/features/petPassport/components/attestation/RecordAttestationModal';
import type { PassportRecordStatus } from '@/app/features/petPassport/components/attestation/attestationModel';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';

const requestRecordSignatureMock = jest.fn();
const attestRecordMock = jest.fn();
const revokeRecordMock = jest.fn();
const loadDocumentDownloadURLMock = jest.fn();

jest.mock('@/app/features/petPassport/services/passportRecords.service', () => ({
  requestRecordSignature: (...args: unknown[]) => requestRecordSignatureMock(...args),
  attestRecord: (...args: unknown[]) => attestRecordMock(...args),
  revokeRecord: (...args: unknown[]) => revokeRecordMock(...args),
}));

jest.mock('@/app/features/companions/services/companionDocumentService', () => ({
  loadDocumentDownloadURL: (...args: unknown[]) => loadDocumentDownloadURLMock(...args),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src, unoptimized: _unoptimized, ...rest }: Record<string, unknown>) =>
    React.createElement('img', { alt, src, ...rest }),
}));

type ModalMockProps = {
  children: React.ReactNode;
  showModal: boolean;
  canClose?: () => boolean;
  setShowModal: (open: boolean) => void;
};

// The real Modal measures the viewport to choose drawer/sheet chrome, so the
// panel renders inline here. The stub keeps ModalBase's dismissal contract -
// escape and outside clicks run `canClose` first - so the panel's own guard is
// exercised rather than assumed.
jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ children, showModal, canClose, setShowModal }: ModalMockProps) =>
    showModal ? (
      <div>
        <button
          type="button"
          onClick={() => {
            if (canClose && !canClose()) return;
            setShowModal(false);
          }}
        >
          dismiss overlay
        </button>
        {children}
      </div>
    ) : null,
}));

const record: CompanionRecord = {
  id: 'doc-1',
  title: 'Rabies certificate',
  category: 'HEALTH',
  subcategory: 'VACCINATION',
  issueDate: '2026-01-04T00:00:00Z',
  issuingBusinessName: 'Bristol Vets',
  uploadedByParentId: 'parent-1',
  attachments: [{ key: 'k1', mimeType: 'application/pdf' }],
};

const onClose = jest.fn();
const onStatusChange = jest.fn();

const axiosFailure = (status: number, message: string) => ({
  isAxiosError: true,
  message: 'Request failed',
  response: { status, data: { message } },
});

const renderModal = async (status: PassportRecordStatus = 'DRAFT') => {
  render(
    <RecordAttestationModal
      open
      companionId="comp-1"
      record={record}
      link={{ recordId: 'artifact-1', status }}
      onClose={onClose}
      onStatusChange={onStatusChange}
    />
  );
  // The document panel resolves its signed URL on mount; wait for it so no
  // state lands outside act() and every assertion sees the loaded panel.
  await screen.findByRole('button', { name: /Open Rabies certificate/ });
};

const tickDeclaration = () => fireEvent.click(screen.getByRole('checkbox'));

const clickButton = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }));

describe('RecordAttestationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadDocumentDownloadURLMock.mockResolvedValue([
      { url: 'https://files.example/cert.pdf', mimeType: 'application/pdf', key: 'k1' },
    ]);
    requestRecordSignatureMock.mockResolvedValue({ artifactId: 'artifact-1' });
    attestRecordMock.mockResolvedValue({ artifactId: 'artifact-1' });
    revokeRecordMock.mockResolvedValue({ artifactId: 'artifact-1' });
    (globalThis.open as unknown) = jest.fn();
  });

  it('shows the uploaded document beside the parsed record, and neither action fires before the declaration is ticked', async () => {
    await renderModal();
    await waitFor(() => expect(loadDocumentDownloadURLMock).toHaveBeenCalledWith('doc-1'));

    // Header meta and the parsed "Document" field both name the upload.
    expect(screen.getAllByText('Rabies certificate').length).toBeGreaterThan(1);
    expect(screen.getByText('Bristol Vets')).toBeInTheDocument();
    expect(screen.getByText('Uploaded by the pet parent')).toBeInTheDocument();
    expect(screen.getByText('Not attested')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Send for signature/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Attest manually instead/ })).toBeDisabled();

    tickDeclaration();
    expect(screen.getByRole('button', { name: /Send for signature/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Attest manually instead/ })).toBeEnabled();
  });

  it('prefers e-signature and reports the pending state without claiming the record is signed', async () => {
    await renderModal();
    tickDeclaration();

    fireEvent.change(screen.getByLabelText('Signing veterinarian (optional)'), {
      target: { value: ' Dr Ana Reyes ' },
    });
    fireEvent.change(screen.getByLabelText('Licence number (optional)'), {
      target: { value: 'RCVS-4471' },
    });

    clickButton(/Send for signature/);

    await waitFor(() =>
      expect(requestRecordSignatureMock).toHaveBeenCalledWith('comp-1', 'artifact-1', {
        signatoryName: 'Dr Ana Reyes',
        signatoryLicence: 'RCVS-4471',
      })
    );
    expect(await screen.findByText('Signature pending')).toBeInTheDocument();
    expect(screen.getByText(/not passport-valid yet/)).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenCalledWith('IN_PROGRESS');
    // The declaration resets, so the fallback cannot be fired by a stray click.
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Attest manually instead/ })).toBeDisabled();
  });

  it('omits signatory fields the vet left blank', async () => {
    await renderModal();
    tickDeclaration();
    clickButton(/Send for signature/);

    await waitFor(() =>
      expect(requestRecordSignatureMock).toHaveBeenCalledWith('comp-1', 'artifact-1', {})
    );
  });

  it('promotes manual attestation when the practice has no Documenso configured', async () => {
    requestRecordSignatureMock.mockRejectedValue(
      axiosFailure(400, 'Documenso signing is not configured for this practice or signer.')
    );

    await renderModal();
    tickDeclaration();
    clickButton(/Send for signature/);

    expect(await screen.findByText(/Documenso e-signature is not set up/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send for signature/ })).not.toBeInTheDocument();
    // The fallback becomes the only route; a failed send does not un-tick the
    // declaration the vet already made.
    expect(screen.getByRole('checkbox')).toBeChecked();
    clickButton(/Attest manually/);
    await waitFor(() => expect(attestRecordMock).toHaveBeenCalledWith('comp-1', 'artifact-1', {}));
  });

  it('surfaces the service message for a failure that is not a missing integration', async () => {
    requestRecordSignatureMock.mockRejectedValue(
      axiosFailure(502, 'Failed to create the signing document.')
    );

    await renderModal();
    tickDeclaration();
    clickButton(/Send for signature/);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to create the signing document.'
    );
    expect(screen.queryByText(/Documenso e-signature is not set up/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send for signature/ })).toBeInTheDocument();
  });

  it('attests manually, then offers revocation instead of another attestation', async () => {
    await renderModal();
    tickDeclaration();
    clickButton(/Attest manually instead/);

    await waitFor(() => expect(attestRecordMock).toHaveBeenCalledWith('comp-1', 'artifact-1', {}));
    expect(await screen.findByText('Attested')).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenCalledWith('SIGNED');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revoke attestation/ })).toBeInTheDocument();
  });

  it('takes a second, explicit step to revoke and stores the reason', async () => {
    await renderModal('SIGNED');

    clickButton(/Revoke attestation/);
    expect(
      screen.getByText(/Revoking removes this record from the pet passport/)
    ).toBeInTheDocument();
    expect(revokeRecordMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Reason \(optional/), {
      target: { value: ' superseded certificate ' },
    });
    clickButton(/Revoke attestation/);

    await waitFor(() =>
      expect(revokeRecordMock).toHaveBeenCalledWith('comp-1', 'artifact-1', {
        reason: 'superseded certificate',
      })
    );
    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenCalledWith('VOID');
    expect(screen.queryByRole('button', { name: /Revoke attestation/ })).not.toBeInTheDocument();
  });

  it('sends an empty body when the vet gives no revocation reason, and can back out first', async () => {
    await renderModal('SIGNED');

    clickButton(/Revoke attestation/);
    clickButton('Back');
    expect(screen.queryByLabelText(/Reason \(optional/)).not.toBeInTheDocument();

    clickButton(/Revoke attestation/);
    clickButton(/Revoke attestation/);
    await waitFor(() => expect(revokeRecordMock).toHaveBeenCalledWith('comp-1', 'artifact-1', {}));
  });

  it('keeps the manual fallback reachable while a signature is outstanding', async () => {
    await renderModal('IN_PROGRESS');

    expect(screen.getByText('Signature pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attest manually instead/ })).toBeInTheDocument();
  });

  it('falls back to a plain name for an upload with no title', async () => {
    render(
      <RecordAttestationModal
        open
        companionId="comp-1"
        record={{ ...record, title: '   ' }}
        link={{ recordId: 'artifact-1', status: 'DRAFT' }}
        onClose={onClose}
      />
    );

    expect(
      await screen.findByRole('button', { name: 'Open Untitled document' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('Untitled document').length).toBeGreaterThan(1);
  });

  it('offers no attestation action for a revoked record', async () => {
    await renderModal('VOID');

    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Attest/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it('blocks dismissal while a request is in flight', async () => {
    let resolveAttest: (value: unknown) => void = () => undefined;
    attestRecordMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAttest = resolve;
      })
    );

    await renderModal();
    tickDeclaration();
    clickButton(/Attest manually instead/);

    expect(screen.getByRole('button', { name: 'Close review panel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Attesting/ })).toBeDisabled();
    // An outside click or escape key is refused too, not just the buttons.
    clickButton('dismiss overlay');
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      resolveAttest({ artifactId: 'artifact-1' });
    });

    expect(screen.getByRole('button', { name: 'Close review panel' })).toBeEnabled();
    clickButton('dismiss overlay');
    expect(onClose).toHaveBeenCalledTimes(1);
    clickButton('Close review panel');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('drops the read-the-document prompt once the vet opens the file', async () => {
    await renderModal();

    expect(
      screen.getByText(/Open the uploaded document and check it against the record/)
    ).toBeInTheDocument();

    clickButton(/Open Rabies certificate/);

    expect(globalThis.open).toHaveBeenCalled();
    expect(
      screen.queryByText(/Open the uploaded document and check it against the record/)
    ).not.toBeInTheDocument();
  });
});
