import React, { useState } from 'react';
import { IoIosWarning } from 'react-icons/io';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import CompanionDoc from '@/app/ui/widgets/UploadImage/CompanionDoc';
import { Primary } from '@/app/ui/primitives/Buttons';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import {
  Category,
  CategoryOptions,
  CompanionRecord,
  emptyCompanionRecord,
  HealthCategoryOptions,
  HygieneCategoryOptions,
  Subcategory,
} from '@/app/features/documents/types/companionDocuments';
import { createCompanionDocument } from '@/app/features/companions/services/companionDocumentService';

type HistoryDocumentUploadProps = {
  companionId: string;
  onUploaded?: () => void;
};

const HistoryDocumentUpload = ({ companionId, onUploaded }: HistoryDocumentUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<CompanionRecord>(emptyCompanionRecord);
  const [saving, setSaving] = useState(false);
  const [formDataErrors, setFormDataErrors] = useState<{
    title?: string;
    category?: string;
    sub?: string;
    fileUrl?: string;
  }>({});

  const subcategoryOptions =
    formData.category === 'HEALTH' ? HealthCategoryOptions : HygieneCategoryOptions;

  const handleSave = async () => {
    const errors: { title?: string; category?: string; sub?: string; fileUrl?: string } = {};

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
      setFormData(emptyCompanionRecord);
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
        <div className="flex flex-col gap-3">
          <LabelDropdown
            placeholder="Category"
            onSelect={(option) =>
              setFormData({
                ...formData,
                category: option.value as Category,
              })
            }
            defaultOption={formData.category}
            options={CategoryOptions}
            error={formDataErrors.category}
          />
          <LabelDropdown
            placeholder="Sub-category"
            onSelect={(option) =>
              setFormData({
                ...formData,
                subcategory: option.value as Subcategory,
              })
            }
            defaultOption={formData.subcategory}
            options={subcategoryOptions}
            error={formDataErrors.sub}
          />
          <FormInput
            intype="text"
            inname="title"
            value={formData.title}
            inlabel="Title"
            onChange={(event) => setFormData({ ...formData, title: event.target.value })}
            error={formDataErrors.title}
          />
          <CompanionDoc
            placeholder="Upload document"
            apiUrl="/v1/document/pms/upload-url"
            companionId={companionId}
            onChange={(key) => setFormData({ ...formData, attachments: [{ key }] })}
            file={file}
            setFile={setFile}
            error={formDataErrors.fileUrl}
          />
          {formDataErrors.fileUrl ? (
            <div className="mt-1.5 flex items-center gap-1 px-4 text-caption-2 text-text-error">
              <IoIosWarning className="text-text-error" size={14} />
              <span>{formDataErrors.fileUrl}</span>
            </div>
          ) : null}
          <Primary
            href="#"
            text={saving ? 'Saving...' : 'Save'}
            onClick={handleSave}
            isDisabled={saving}
          />
        </div>
      </Accordion>
    </PermissionGate>
  );
};

export default HistoryDocumentUpload;
