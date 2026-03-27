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
  VisitType,
  VisitTypeOptions,
} from '@/app/features/documents/types/companionDocuments';
import { createCompanionDocument } from '@/app/features/companions/services/companionDocumentService';
import { useOrgStore } from '@/app/stores/orgStore';

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
          <LabelDropdown
            placeholder="Visit type"
            onSelect={(option) =>
              setFormData({
                ...formData,
                visitType: option.value as VisitType,
              })
            }
            defaultOption={formData.visitType ?? undefined}
            options={VisitTypeOptions}
          />
          <FormInput
            intype="text"
            inname="title"
            value={formData.title}
            inlabel="Title"
            onChange={(event) => setFormData({ ...formData, title: event.target.value })}
            error={formDataErrors.title}
          />
          <FormInput
            intype="text"
            inname="issuingBusinessName"
            value={formData.issuingBusinessName ?? ''}
            inlabel="Issuing business name"
            onChange={(event) =>
              setFormData({ ...formData, issuingBusinessName: event.target.value })
            }
          />
          <div className="flex w-full flex-nowrap items-center justify-between gap-3">
            <label
              htmlFor="historyIncludeIssueDate"
              className="inline-flex h-12 shrink-0 cursor-pointer items-center rounded-2xl border border-input-border-default px-4"
            >
              <span className="grid h-full place-items-center">
                <span className="inline-flex items-center">
                  <input
                    id="historyIncludeIssueDate"
                    type="checkbox"
                    className="m-0 h-4 w-4 shrink-0 align-middle accent-text-primary"
                    checked={formData.hasIssueDate ?? false}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        hasIssueDate: event.target.checked,
                      })
                    }
                  />
                  <span className="pl-2 text-body-4 text-text-primary">Include issue date</span>
                </span>
              </span>
            </label>
            {formData.hasIssueDate ? (
              <div className="w-[210px] shrink-0">
                <FormInput
                  intype="date"
                  inname="issueDate"
                  value={formData.issueDate ? formData.issueDate.split('T')[0] : ''}
                  inlabel="Issue date"
                  onChange={(event) => setFormData({ ...formData, issueDate: event.target.value })}
                />
              </div>
            ) : null}
          </div>
          <CompanionDoc
            placeholder="Upload document"
            apiUrl="/v1/document/pms/upload-url"
            companionId={companionId}
            onChange={(key, mimeType, size) =>
              setFormData({
                ...formData,
                attachments: [
                  {
                    key,
                    mimeType: mimeType || file?.type || 'application/pdf',
                    size,
                  },
                ],
              })
            }
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
          <div className="flex justify-center">
            <Primary
              href="#"
              text={saving ? 'Saving...' : 'Save'}
              onClick={handleSave}
              isDisabled={saving}
              className="w-auto min-w-[120px]"
            />
          </div>
        </div>
      </Accordion>
    </PermissionGate>
  );
};

export default HistoryDocumentUpload;
