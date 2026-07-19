import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { IoClose, IoSwapVerticalOutline } from 'react-icons/io5';
import Modal from '@/app/ui/overlays/Modal';
import { Primary } from '@/app/ui/primitives/Buttons';
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

const handleDownload = async (id: string | undefined) => {
  try {
    const data = await loadDocumentDownloadURL(id);
    if (data.length > 0) {
      const docURL = data[0].url;
      globalThis.open(docURL, '_blank');
    }
  } catch (error) {
    console.log(error);
  }
};

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
        ? 'border-[var(--divider)] bg-[var(--inset)] font-bold text-[var(--ink)]'
        : 'border-[var(--hairline)] font-semibold text-[var(--ink-muted)]'
    }`}
  >
    {children}
  </button>
);

type CompanionDocumentsSectionProps = {
  companionId: string;
};

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

  const groups = useMemo(
    () => groupRecordsByMonth(sortRecords(filterRecords(records, filter), sortDirection)),
    [records, filter, sortDirection]
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
    <Primary href="#" text="Upload record" onClick={openUpload} className="w-auto min-w-[150px]" />
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
      <button
        type="button"
        disabled
        style={{ borderColor: 'var(--hairline)', color: 'var(--ink-body)' }}
        className="flex h-[42px] items-center gap-1.5 rounded-full border px-[18px] text-[13px] font-semibold disabled:cursor-not-allowed"
      >
        Request from pet parent
      </button>
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
                    active={filter === tab.value}
                    onClick={() => setFilter(tab.value)}
                  >
                    {tab.value === 'ALL' ? `${tab.label} · ${records.length}` : tab.label}
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
              <div className="py-6 text-center text-[12.5px] text-[var(--ink-faint)]">
                No records match this filter.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((group) => (
                  <div key={group.label} className="flex flex-col gap-2">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
                      {group.label}
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.items.map((doc, index) => (
                        <CompanionRecordRow
                          key={doc.id ?? `${group.label}-${index}`}
                          doc={doc}
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
            <div className="flex items-center justify-between">
              <h2 className="text-heading-3 text-text-primary">Upload record</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeUpload}
                className="grid size-8 place-items-center rounded-full border border-[var(--hairline)] text-[var(--ink-faint)]"
              >
                <IoClose size={15} aria-hidden="true" />
              </button>
            </div>
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
