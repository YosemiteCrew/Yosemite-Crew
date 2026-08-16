import React, { useCallback, useReducer, useState } from 'react';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Primary } from '@/app/ui/primitives/Buttons';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import {
  CompanionRecord,
  emptyCompanionRecord,
} from '@/app/features/documents/types/companionDocuments';
import { createCompanionDocument } from '@/app/features/companions/services/companionDocumentService';
import { useOrgStore } from '@/app/stores/orgStore';
import CompanionDocumentUploadForm, {
  DocumentUploadFormErrors,
} from '@/app/features/documents/components/CompanionDocumentUploadForm';

type HistoryDocumentUploadProps = {
  companionId: string;
  onUploaded?: () => void;
};

// The upload sheet's draft — the picked file, the form fields, their validation
// errors, and the in-flight save flag — is one conceptual unit that resets
// together on save, so it is grouped into a single reducer instead of separate
// related useStates (react-doctor/prefer-useReducer). `uploadOpen`, the sheet's
// visibility, is genuinely independent and stays as its own state.
type UploadDraftState = {
  file: File | null;
  formData: CompanionRecord;
  errors: DocumentUploadFormErrors;
  saving: boolean;
};

const INITIAL_UPLOAD_DRAFT: UploadDraftState = {
  file: null,
  formData: emptyCompanionRecord,
  errors: {},
  saving: false,
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

const HistoryDocumentUpload = ({ companionId, onUploaded }: HistoryDocumentUploadProps) => {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDraft, dispatchDraft] = useReducer(uploadDraftReducer, INITIAL_UPLOAD_DRAFT);
  const { file, formData, errors: formDataErrors, saving } = uploadDraft;
  const setFormData = useCallback<React.Dispatch<React.SetStateAction<CompanionRecord>>>(
    (value) => dispatchDraft((s) => ({ formData: resolveStateAction(s.formData, value) })),
    []
  );
  const setFile = useCallback<React.Dispatch<React.SetStateAction<File | null>>>(
    (value) => dispatchDraft((s) => ({ file: resolveStateAction(s.file, value) })),
    []
  );
  const primaryOrgName = useOrgStore((state) => {
    if (!state.primaryOrgId) return '';
    return state.orgsById?.[state.primaryOrgId]?.name ?? '';
  });

  React.useEffect(() => {
    if (!primaryOrgName) return;
    setFormData((prev) => {
      if (prev.issuingBusinessName?.trim()) return prev;
      return { ...prev, issuingBusinessName: primaryOrgName };
    });
  }, [primaryOrgName, setFormData]);

  const handleSave = async () => {
    const errors: DocumentUploadFormErrors = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    if (!formData.category) {
      errors.category = 'Category is required';
    }
    if (!formData.subcategory) {
      errors.sub = 'Sub-category is required';
    }
    if (formData.attachments.length <= 0) {
      errors.fileUrl = 'File is required';
    }

    dispatchDraft(() => ({ errors }));
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      dispatchDraft(() => ({ saving: true }));
      await createCompanionDocument(formData, companionId);
      dispatchDraft(() => ({
        formData: { ...emptyCompanionRecord, issuingBusinessName: primaryOrgName || undefined },
        file: null,
        errors: {},
      }));
      setUploadOpen(false);
      onUploaded?.();
    } catch (error) {
      console.error('Failed to save companion document:', error);
    } finally {
      dispatchDraft(() => ({ saving: false }));
    }
  };

  return (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_EDIT_ANY]}>
      <div className="flex justify-end">
        <Primary
          href="#"
          text="Upload record"
          onClick={() => setUploadOpen(true)}
          className="w-auto"
        />
      </div>

      <Modal
        variant="centered"
        size="md"
        showModal={uploadOpen}
        setShowModal={setUploadOpen}
        onClose={() => setUploadOpen(false)}
        aria-label="Upload record"
      >
        <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto scrollbar-hidden">
          <ModalHeader title="Upload record" onClose={() => setUploadOpen(false)} />
          <CompanionDocumentUploadForm
            companionId={companionId}
            formData={formData}
            setFormData={setFormData}
            file={file}
            setFile={setFile}
            formDataErrors={formDataErrors}
            saving={saving}
            onSave={handleSave}
            issueDateInputId="historyIncludeIssueDate"
          />
        </div>
      </Modal>
    </PermissionGate>
  );
};

export default HistoryDocumentUpload;
