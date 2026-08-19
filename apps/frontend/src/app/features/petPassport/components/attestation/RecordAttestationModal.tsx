'use client';

import React, { useState } from 'react';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import { Secondary } from '@/app/ui/primitives/Buttons';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';
import {
  attestRecord,
  requestRecordSignature,
  revokeRecord,
  type AttestationInput,
} from '@/app/features/petPassport/services/passportRecords.service';
import AttestationActions, {
  type AttestationBusy,
} from '@/app/features/petPassport/components/attestation/AttestationActions';
import AttestationConfirmPanel, {
  type SignatoryDetails,
} from '@/app/features/petPassport/components/attestation/AttestationConfirmPanel';
import AttestationDocumentPanel from '@/app/features/petPassport/components/attestation/AttestationDocumentPanel';
import AttestationRecordPanel from '@/app/features/petPassport/components/attestation/AttestationRecordPanel';
import AttestationRevokePanel from '@/app/features/petPassport/components/attestation/AttestationRevokePanel';
import {
  PassportRecordLink,
  PassportRecordStatus,
  canAttestStatus,
  getAttestationErrorMessage,
  isDocumensoUnavailable,
} from '@/app/features/petPassport/components/attestation/attestationModel';

type RecordAttestationModalProps = {
  open: boolean;
  companionId: string;
  record: CompanionRecord;
  link: PassportRecordLink;
  onClose: () => void;
  /** Lets the surrounding list reflect the new state without a full reload. */
  onStatusChange?: (status: PassportRecordStatus) => void;
};

type ModalView = 'REVIEW' | 'REVOKE';

type AttestationDraft = {
  confirmed: boolean;
  signatory: SignatoryDetails;
  reason: string;
};

type AttestationOutcome = {
  status: PassportRecordStatus;
  error: string | null;
  documensoUnavailable: boolean;
};

const TITLE_ID = 'passport-record-attestation-title';

const EMPTY_DRAFT: AttestationDraft = {
  confirmed: false,
  signatory: { signatoryName: '', signatoryLicence: '' },
  reason: '',
};

const DOCUMENSO_NOTICE =
  'Documenso e-signature is not set up for this practice, so manual attestation is the only route available. An admin can connect it from Integrations.';

const REVIEW_HINT = 'Open the uploaded document and check it against the record before you attest.';

/** Only non-empty signatory details travel; the service accepts an empty body. */
const buildAttestationInput = (signatory: SignatoryDetails): AttestationInput => {
  const input: AttestationInput = {};
  const name = signatory.signatoryName.trim();
  const licence = signatory.signatoryLicence.trim();
  if (name) input.signatoryName = name;
  if (licence) input.signatoryLicence = licence;
  return input;
};

const AttestationNotice = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-[12px] border border-[var(--divider)] bg-[var(--inset)] px-3.5 py-2.5 text-[12px] leading-relaxed text-[var(--ink-body)]">
    {children}
  </p>
);

/**
 * Review-and-attest for a pet-parent upload that has been captured as a passport
 * clinical record: the file and the parsed record side by side, a declaration the
 * vet must tick, then either the preferred Documenso e-signature or the manual
 * fallback. A signed record can be revoked from the same panel.
 */
const RecordAttestationModal = ({
  open,
  companionId,
  record,
  link,
  onClose,
  onStatusChange,
}: RecordAttestationModalProps) => {
  const [view, setView] = useState<ModalView>('REVIEW');
  const [busy, setBusy] = useState<AttestationBusy>(null);
  const [draft, setDraft] = useState<AttestationDraft>(EMPTY_DRAFT);
  const [documentOpened, setDocumentOpened] = useState(false);
  const [outcome, setOutcome] = useState<AttestationOutcome>({
    status: link.status,
    error: null,
    documensoUnavailable: false,
  });

  const applyStatus = (status: PassportRecordStatus) => {
    setOutcome({ status, error: null, documensoUnavailable: false });
    setDraft((prev) => ({ ...prev, confirmed: false }));
    onStatusChange?.(status);
  };

  const applyFailure = (error: unknown, fallback: string) => {
    setOutcome((prev) => ({
      status: prev.status,
      error: getAttestationErrorMessage(error, fallback),
      documensoUnavailable: prev.documensoUnavailable || isDocumensoUnavailable(error),
    }));
  };

  const runAction = (
    action: AttestationBusy,
    task: () => Promise<PassportRecordStatus>,
    fallback: string
  ) => {
    setBusy(action);
    task()
      .then(applyStatus)
      .catch((error: unknown) => applyFailure(error, fallback))
      .finally(() => setBusy(null));
  };

  const handleSign = () =>
    runAction(
      'SIGN',
      () =>
        requestRecordSignature(
          companionId,
          link.recordId,
          buildAttestationInput(draft.signatory)
        ).then((): PassportRecordStatus => 'IN_PROGRESS'),
      'The signature request could not be sent.'
    );

  const handleAttest = () =>
    runAction(
      'ATTEST',
      () =>
        attestRecord(companionId, link.recordId, buildAttestationInput(draft.signatory)).then(
          (): PassportRecordStatus => 'SIGNED'
        ),
      'This record could not be attested.'
    );

  const handleRevoke = () =>
    runAction(
      'REVOKE',
      () => {
        const reason = draft.reason.trim();
        return revokeRecord(companionId, link.recordId, reason ? { reason } : {}).then(
          (): PassportRecordStatus => {
            setView('REVIEW');
            return 'VOID';
          }
        );
      },
      'This attestation could not be revoked.'
    );

  // Every dismissal path is already blocked while a request is in flight: the
  // close controls are disabled, and ModalBase runs `canClose` before an escape
  // key or an outside click can close the panel.
  const handleClose = () => onClose();

  const isRevoking = view === 'REVOKE';
  const showConfirm = !isRevoking && canAttestStatus(outcome.status);

  return (
    <Modal
      variant="centered"
      size="lg"
      showModal={open}
      setShowModal={handleClose}
      onClose={handleClose}
      canClose={() => busy === null}
      aria-labelledby={TITLE_ID}
    >
      <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto scrollbar-hidden">
        <ModalHeader
          eyebrow="Passport record"
          title="Review and attest"
          meta={record.title?.trim() || 'Untitled document'}
          titleId={TITLE_ID}
          onClose={handleClose}
          isCloseDisabled={busy !== null}
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <AttestationDocumentPanel
            documentId={record.id}
            title={record.title?.trim() || 'Untitled document'}
            onOpenFile={() => setDocumentOpened(true)}
          />
          <AttestationRecordPanel record={record} status={outcome.status} />
        </div>

        {outcome.documensoUnavailable && <AttestationNotice>{DOCUMENSO_NOTICE}</AttestationNotice>}
        {showConfirm && !documentOpened && <AttestationNotice>{REVIEW_HINT}</AttestationNotice>}

        {outcome.error && (
          <p
            role="alert"
            className="rounded-[12px] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3.5 py-2.5 text-[12px] text-[var(--danger-text)]"
          >
            {outcome.error}
          </p>
        )}

        {showConfirm && (
          <AttestationConfirmPanel
            confirmed={draft.confirmed}
            onConfirmedChange={(confirmed) => setDraft((prev) => ({ ...prev, confirmed }))}
            signatory={draft.signatory}
            onSignatoryChange={(signatory) => setDraft((prev) => ({ ...prev, signatory }))}
            disabled={busy !== null}
          />
        )}

        {isRevoking && (
          <AttestationRevokePanel
            reason={draft.reason}
            onReasonChange={(reason) => setDraft((prev) => ({ ...prev, reason }))}
            disabled={busy !== null}
          />
        )}

        <ModalFooter>
          {isRevoking ? (
            <>
              <Secondary text="Back" isDisabled={busy !== null} onClick={() => setView('REVIEW')} />
              <Secondary
                danger
                text={busy === 'REVOKE' ? 'Revoking...' : 'Revoke attestation'}
                isDisabled={busy !== null}
                onClick={handleRevoke}
              />
            </>
          ) : (
            <>
              <Secondary
                text="Close"
                ariaLabel="Close review panel"
                isDisabled={busy !== null}
                onClick={handleClose}
              />
              <AttestationActions
                status={outcome.status}
                documensoUnavailable={outcome.documensoUnavailable}
                confirmed={draft.confirmed}
                busy={busy}
                onSign={handleSign}
                onAttest={handleAttest}
                onRevoke={() => setView('REVOKE')}
              />
            </>
          )}
        </ModalFooter>
      </div>
    </Modal>
  );
};

export default RecordAttestationModal;
