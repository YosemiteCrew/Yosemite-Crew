import React, { useState } from 'react';
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

const HistoryDocumentUpload = ({ companionId, onUploaded }: HistoryDocumentUploadProps) => {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<CompanionRecord>(emptyCompanionRecord);
  const [saving, setSaving] = useState(false);
  const [formDataErrors, setFormDataErrors] = useState<DocumentUploadFormErrors>({});
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
  }, [primaryOrgName]);

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

    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setSaving(true);
      await createCompanionDocument(formData, companionId);
      setFormData({
        ...emptyCompanionRecord,
        issuingBusinessName: primaryOrgName || undefined,
      });
      setFile(null);
      setFormDataErrors({});
      setUploadOpen(false);
      onUploaded?.();
    } catch (error) {
      console.error('Failed to save companion document:', error);
    } finally {
      setSaving(false);
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
