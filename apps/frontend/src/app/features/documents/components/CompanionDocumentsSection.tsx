import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { IoSwapVerticalOutline } from 'react-icons/io5';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Fallback from '@/app/ui/overlays/Fallback';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import {
  CompanionRecord,
  emptyCompanionRecord,
} from '@/app/features/documents/types/companionDocuments';
import {
  createCompanionDocument,
  loadCompanionDocument,
  loadDocumentDownloadURL,
} from '@/app/features/companions/services/companionDocumentService';
import { useOrgStore } from '@/app/stores/orgStore';
import CompanionDocumentUploadForm, {
  DocumentUploadFormErrors,
} from '@/app/features/documents/components/CompanionDocumentUploadForm';
import CompanionRecordRow from '@/app/features/documents/components/CompanionRecordRow';
import CompanionRecordsEmptyState from '@/app/features/documents/components/CompanionRecordsEmptyState';
import {
  RecordFilter,
  RecordSortDirection,
  filterRecords,
  groupRecordsByMonth,
  sortRecords,
} from '@/app/features/documents/components/recordDisplay';
import {
  RECORD_LIFECYCLE_FILTERS,
  RECORD_LIFECYCLE_LABELS,
  getAvailableLifecycleTabs,
  getLifecycleForFilter,
} from '@/app/features/documents/components/recordLifecycle';
import PassportAttestationAction from '@/app/features/petPassport/components/attestation/PassportAttestationAction';

const handleDownload = async (id: string | undefined) => {
  try {
    const data = await loadDocumentDownloadURL(id);
    if (data.length > 0) {
      const docURL = data[0].url;
      // `noopener` keeps the signed storage URL from handing the opener window
      // to the new tab.
      globalThis.open(docURL, '_blank', 'noopener');
    }
  } catch (error) {
    console.log(error);
  }
};

// Source tabs, always available because every record carries the dimension.
// The design's lifecycle tabs (Requested / Generated / Signed) are appended at
// render time, and only for lifecycles the loaded records resolve to.
const FILTER_TABS: { value: RecordFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'UPLOADED', label: 'Uploaded' },
  { value: 'SYNCED', label: 'Synced' },
];

type FilterPillProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

const FilterPill = ({ active, onClick, children }: FilterPillProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`rounded-full border px-3 py-1.5 text-[12px] ${
      active
        ? 'border-[var(--chip-selected-border)] bg-[var(--chip-selected-bg)] font-bold text-[var(--chip-selected-ink)]'
        : 'border-[var(--hairline)] font-semibold text-[var(--ink-muted)]'
    }`}
  >
    {children}
  </button>
);

type CompanionDocumentsSectionProps = {
  companionId: string;
};

/**
 * A record row plus the veterinarian's passport action. The action renders
 * nothing unless the record is linked to a passport clinical record and the
 * viewer may attest, so every other role and record keeps the plain row.
 * `CompanionRecordRow` is itself a button, so the action sits beside it rather
 * than inside it.
 */
const RecordListRow = ({
  doc,
  companionId,
  onOpen,
}: {
  doc: CompanionRecord;
  companionId: string;
  onOpen: () => void;
}) => (
  <div className="flex items-center gap-2">
    <div className="min-w-0 flex-1">
      <CompanionRecordRow doc={doc} onOpen={onOpen} />
    </div>
    <PassportAttestationAction companionId={companionId} record={doc} />
  </div>
);

// The upload sheet's draft — the picked file, the form fields, and their
// validation errors — is one conceptual unit that is reset together on save, so
// it is grouped into a single reducer instead of separate related useStates
// (react-doctor/prefer-useReducer). Views that are genuinely independent
// (records, filter, sort direction, sheet open/closed) stay as their own state.
type UploadDraftState = {
  file: File | null;
  formData: CompanionRecord;
  errors: DocumentUploadFormErrors;
};

const INITIAL_UPLOAD_DRAFT: UploadDraftState = {
  file: null,
  formData: emptyCompanionRecord,
  errors: {},
};

const uploadDraftReducer = (
  state: UploadDraftState,
  update: (current: UploadDraftState) => Partial<UploadDraftState>
): UploadDraftState => ({ ...state, ...update(state) });

// Resolve a React setState-style value (a next value or an updater function)
// against the previous value, so the reducer-backed setters below keep the
// exact `Dispatch<SetStateAction<T>>` contract the child form expects.
const resolveStateAction = <T,>(prev: T, value: React.SetStateAction<T>): T =>
  typeof value === 'function' ? (value as (p: T) => T)(prev) : value;

const CompanionDocumentsSection = ({ companionId }: CompanionDocumentsSectionProps) => {
  const [uploadDraft, dispatchDraft] = useReducer(uploadDraftReducer, INITIAL_UPLOAD_DRAFT);
  const { file, formData, errors: formDataErrors } = uploadDraft;
  const setFormData = useCallback<React.Dispatch<React.SetStateAction<CompanionRecord>>>(
    (value) => dispatchDraft((s) => ({ formData: resolveStateAction(s.formData, value) })),
    []
  );
  const setFile = useCallback<React.Dispatch<React.SetStateAction<File | null>>>(
    (value) => dispatchDraft((s) => ({ file: resolveStateAction(s.file, value) })),
    []
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filter, setFilter] = useState<RecordFilter>('ALL');
  const [sortDirection, setSortDirection] = useState<RecordSortDirection>('desc');

  const [records, setRecords] = useState<CompanionRecord[]>([]);
  const primaryOrgId = useOrgStore((state) => state.primaryOrgId);
  const primaryOrgName = useOrgStore((state) => {
    if (!state.primaryOrgId) return '';
    return state.orgsById?.[state.primaryOrgId]?.name ?? '';
  });

  useEffect(() => {
    if (!primaryOrgName) return;
    setFormData((prev) => {
      if (prev.issuingBusinessName?.trim()) return prev;
      return { ...prev, issuingBusinessName: primaryOrgName };
    });
  }, [primaryOrgId, primaryOrgName, setFormData]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!companionId) {
        setRecords([]);
        return;
      }
      try {
        const data = await loadCompanionDocument(companionId);
        if (!cancelled) setRecords(data ?? []);
      } catch {
        if (!cancelled) setRecords([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [companionId]);

  const lifecycleTabs = useMemo(() => getAvailableLifecycleTabs(records), [records]);

  // A lifecycle tab only exists while some loaded record resolves to it. If a
  // reload empties the active one, fall back to All rather than stranding the
  // list on a filter whose pill is no longer on screen. Derived during render
  // rather than corrected in an effect, so there is no extra render and no
  // frame where the list is empty before the reset lands.
  const activeLifecycle = getLifecycleForFilter(filter);
  const effectiveFilter: RecordFilter =
    activeLifecycle && !lifecycleTabs.includes(activeLifecycle) ? 'ALL' : filter;

  const groups = useMemo(
    () => groupRecordsByMonth(sortRecords(filterRecords(records, effectiveFilter), sortDirection)),
    [records, effectiveFilter, sortDirection]
  );

  const handleSave = async () => {
    const errors: DocumentUploadFormErrors = {};
    if (!formData.title) errors.title = 'Name is required';
    if (formData.attachments.length <= 0) errors.fileUrl = 'File is required';
    dispatchDraft(() => ({ errors }));
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await createCompanionDocument(formData, companionId);
      const data = await loadCompanionDocument(companionId);
      setRecords(data ?? []);
      setFormData({
        ...emptyCompanionRecord,
        issuingBusinessName: primaryOrgName || undefined,
      });
      dispatchDraft(() => ({ errors: {} }));
      setFile(null);
      setUploadOpen(false);
    } catch (error) {
      console.log(error);
    }
  };

  const openUpload = () => setUploadOpen(true);
  const closeUpload = () => setUploadOpen(false);
  const toggleSort = () => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));

  const uploadButton = (
    <Primary href="#" text="Upload record" onClick={openUpload} className="w-auto min-w-37.5" />
  );

  const uploadCta = (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_EDIT_ANY]}>{uploadButton}</PermissionGate>
  );

  // The design's empty state pairs the upload CTA with a secondary outline
  // "Request from pet parent" pill. There is no request flow behind it yet, so
  // the control ships in its unavailable state rather than inventing one.
  const emptyStateActions = (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_EDIT_ANY]}>
      {uploadButton}
      <Secondary href="#" text="Request from pet parent" isDisabled />
    </PermissionGate>
  );

  return (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]} fallback={<Fallback />}>
      <div className="flex w-full flex-1 flex-col gap-6 overflow-y-auto scrollbar-hidden">
        {records.length === 0 ? (
          <CompanionRecordsEmptyState action={emptyStateActions} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {FILTER_TABS.map((tab) => (
                  <FilterPill
                    key={tab.value}
                    active={effectiveFilter === tab.value}
                    onClick={() => setFilter(tab.value)}
                  >
                    {tab.value === 'ALL' ? `${tab.label} · ${records.length}` : tab.label}
                  </FilterPill>
                ))}
                {lifecycleTabs.map((lifecycle) => (
                  <FilterPill
                    key={lifecycle}
                    active={effectiveFilter === RECORD_LIFECYCLE_FILTERS[lifecycle]}
                    onClick={() => setFilter(RECORD_LIFECYCLE_FILTERS[lifecycle])}
                  >
                    {RECORD_LIFECYCLE_LABELS[lifecycle]}
                  </FilterPill>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSort}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-muted)]"
                >
                  <IoSwapVerticalOutline size={12} aria-hidden="true" />
                  {sortDirection === 'desc' ? 'Newest first' : 'Oldest first'}
                </button>
                {uploadCta}
              </div>
            </div>

            {groups.length === 0 ? (
              <div className="py-6 text-center text-caption-2 text-[var(--ink-faint)]">
                No records match this filter.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((group) => (
                  <div key={group.label} className="flex flex-col gap-2">
                    <div className="text-caption-3 text-[var(--ink-faint)]">{group.label}</div>
                    <div className="flex flex-col gap-2">
                      {group.items.map((doc) => (
                        <RecordListRow
                          key={doc.id ?? `${group.label}-${doc.title}-${doc.issueDate ?? ''}`}
                          doc={doc}
                          companionId={companionId}
                          onOpen={() => handleDownload(doc.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <Modal
          variant="centered"
          size="md"
          showModal={uploadOpen}
          setShowModal={setUploadOpen}
          onClose={closeUpload}
          aria-label="Upload record"
        >
          <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto scrollbar-hidden">
            <ModalHeader title="Upload record" onClose={closeUpload} />
            <CompanionDocumentUploadForm
              companionId={companionId}
              formData={formData}
              setFormData={setFormData}
              file={file}
              setFile={setFile}
              formDataErrors={formDataErrors}
              onSave={handleSave}
            />
          </div>
        </Modal>
      </div>
    </PermissionGate>
  );
};

export default CompanionDocumentsSection;
