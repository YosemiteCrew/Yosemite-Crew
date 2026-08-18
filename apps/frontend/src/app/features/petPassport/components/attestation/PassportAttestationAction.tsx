'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { IoRibbonOutline } from 'react-icons/io5';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';
import {
  PassportRecordStatus,
  getPassportRecordLink,
} from '@/app/features/petPassport/components/attestation/attestationModel';

// The review panel carries the document preview, the declaration and the three
// attestation calls, and only a veterinarian ever opens it - so it ships as its
// own chunk rather than riding along with every surface that lists documents.
const AttestationModalSkeleton = () => (
  <div
    className="fixed inset-0 z-[1100] grid place-items-center bg-[var(--sh55)] p-4"
    aria-hidden="true"
  >
    <div className="h-96 w-full max-w-[840px] animate-pulse rounded-[22px] bg-card-hover" />
  </div>
);

const RecordAttestationModal = dynamic(
  () =>
    import('@/app/features/petPassport/components/attestation/RecordAttestationModal').then(
      (mod) => mod.default
    ),
  { loading: () => <AttestationModalSkeleton /> }
);

type PassportAttestationActionProps = {
  companionId: string;
  record: CompanionRecord;
};

const ACTION_LABEL: Record<PassportRecordStatus, string> = {
  DRAFT: 'Review and attest',
  IN_PROGRESS: 'Signature pending',
  SIGNED: 'Attested record',
  VOID: 'Revoked record',
};

/**
 * The veterinarian's way into review-and-attest, beside the record it belongs
 * to. Hidden for everyone without `passport:attest:any` - the backend is the
 * boundary, but a button that can only ever 403 is not worth showing - and
 * hidden for records the API has not linked to a passport record, because the
 * attestation routes have nothing to address without that id.
 */
const PassportAttestationAction = ({ companionId, record }: PassportAttestationActionProps) => {
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PassportRecordStatus | null>(null);

  const link = getPassportRecordLink(record);
  if (!link || !permissions.can(PERMISSIONS.PASSPORT_ATTEST_ANY)) return null;

  const currentStatus = status ?? link.status;
  const title = record.title?.trim() || 'Untitled document';

  return (
    <>
      <Secondary
        size="compact"
        text={ACTION_LABEL[currentStatus]}
        ariaLabel={`${ACTION_LABEL[currentStatus]}: ${title}`}
        icon={<IoRibbonOutline aria-hidden="true" />}
        onClick={() => setOpen(true)}
      />
      {open && (
        <RecordAttestationModal
          open
          companionId={companionId}
          record={record}
          link={{ recordId: link.recordId, status: currentStatus }}
          onClose={() => setOpen(false)}
          onStatusChange={setStatus}
        />
      )}
    </>
  );
};

export default PassportAttestationAction;
