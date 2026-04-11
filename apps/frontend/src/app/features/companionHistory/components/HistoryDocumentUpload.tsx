import React, { useState } from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
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
      onUploaded?.();
    } catch (error) {
      console.error('Failed to save companion document:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_EDIT_ANY]}>
      <Accordion title="Upload records" defaultOpen={false} showEditIcon={false} isEditing>
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
      </Accordion>
    </PermissionGate>
  );
};

export default HistoryDocumentUpload;
