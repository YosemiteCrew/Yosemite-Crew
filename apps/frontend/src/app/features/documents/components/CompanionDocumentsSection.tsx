import React, { useEffect, useState } from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Fallback from '@/app/ui/overlays/Fallback';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { IoIosWarning } from 'react-icons/io';
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
import {
  createCompanionDocument,
  loadCompanionDocument,
  loadDocumentDownloadURL,
} from '@/app/features/companions/services/companionDocumentService';
import { toTitle } from '@/app/lib/validators';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import CompanionDoc from '@/app/ui/widgets/UploadImage/CompanionDoc';
import { useOrgStore } from '@/app/stores/orgStore';

type CompanionDocumentsSectionProps = {
  companionId: string;
};

const CompanionDocumentsSection = ({ companionId }: CompanionDocumentsSectionProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<CompanionRecord>(emptyCompanionRecord);
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    category?: string;
    sub?: string;
    fileUrl?: string;
  }>({});

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
  }, [primaryOrgId, primaryOrgName]);

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

  const handleSave = async () => {
    const errors: { title?: string; fileUrl?: string } = {};
    if (!formData.title) errors.title = 'Name is required';
    if (formData.attachments.length <= 0) errors.fileUrl = 'File is required';
    setFormDataErrors(errors);
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
      setFormDataErrors({});
      setFile(null);
    } catch (error) {
      console.log(error);
    }
  };

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

  const subcategoryOptions =
    formData.category === 'HEALTH' ? HealthCategoryOptions : HygieneCategoryOptions;

  const formatTextValue = (value?: string | null) => {
    if (!value) return '-';
    return toTitle(value);
  };

  const getDocumentSource = (doc: CompanionRecord) => {
    if (doc.issuingBusinessName) return doc.issuingBusinessName;
    if (doc.syncedFromPms) return 'PMS';
    if (doc.uploadedByParentId) return 'Pet parent';
    return 'Staff';
  };

  const getAttachmentSummary = (doc: CompanionRecord) => {
    if (!doc.attachments?.length) return 'No attachments';
    const first = doc.attachments[0];
    const mime = first?.mimeType ? first.mimeType.split('/').pop()?.toUpperCase() : 'FILE';
    return doc.attachments.length > 1
      ? `${doc.attachments.length} files (${mime || 'FILE'})`
      : `1 file (${mime || 'FILE'})`;
  };

  return (
    <PermissionGate allOf={[PERMISSIONS.COMPANIONS_VIEW_ANY]} fallback={<Fallback />}>
      <div className="flex flex-col gap-6 w-full flex-1 overflow-y-auto scrollbar-hidden">
        <PermissionGate allOf={[PERMISSIONS.COMPANIONS_EDIT_ANY]}>
          <Accordion
            title="Upload records"
            defaultOpen={false}
            showEditIcon={false}
            isEditing={true}
          >
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
                inname="name"
                value={formData.title}
                inlabel="Title"
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                error={formDataErrors.name}
              />
              <FormInput
                intype="text"
                inname="issuingBusinessName"
                value={formData.issuingBusinessName ?? ''}
                inlabel="Issuing business name"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    issuingBusinessName: e.target.value,
                  })
                }
              />
              <div className="flex w-full flex-nowrap items-center justify-between gap-3">
                <label
                  htmlFor="includeIssueDate"
                  className="inline-flex h-12 shrink-0 cursor-pointer items-center rounded-2xl border border-input-border-default px-4"
                >
                  <span className="grid h-full place-items-center">
                    <span className="inline-flex items-center">
                      <input
                        id="includeIssueDate"
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
                      onChange={(event) =>
                        setFormData({ ...formData, issueDate: event.target.value })
                      }
                    />
                  </div>
                ) : null}
              </div>
              <CompanionDoc
                placeholder="Upload document"
                apiUrl={`/v1/document/pms/upload-url`}
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
              {formDataErrors.fileUrl && (
                <div
                  className={`
                    mt-1.5 flex items-center gap-1 px-4
                    text-caption-2 text-text-error
                  `}
                >
                  <IoIosWarning className="text-text-error" size={14} />
                  <span>{formDataErrors.fileUrl}</span>
                </div>
              )}
              <div className="flex justify-center">
                <Primary
                  href="#"
                  text="Save"
                  onClick={handleSave}
                  className="w-auto min-w-[120px]"
                />
              </div>
            </div>
          </Accordion>
        </PermissionGate>
        <div className="w-full">
          {records.length === 0 ? (
            <div className="flex items-center justify-center text-body-4 text-text-primary">
              No documents found
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {records.map((doc) => (
                <div
                  key={doc.id}
                  className="w-full rounded-2xl border border-card-border bg-white px-4 py-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-body-3-emphasis text-text-primary break-words">
                        {doc.title || 'Untitled document'}
                      </div>
                      <div className="text-caption-1 text-text-secondary mt-1">
                        Issued by {getDocumentSource(doc)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {doc.pmsVisible ? (
                        <span className="text-label-xsmall px-2 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
                          PMS visible
                        </span>
                      ) : null}
                      {doc.syncedFromPms ? (
                        <span className="text-label-xsmall px-2 py-1 rounded-full bg-green-50 text-green-800 whitespace-nowrap">
                          Synced
                        </span>
                      ) : (
                        <span className="text-label-xsmall px-2 py-1 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">
                          Manual
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="text-caption-1 text-text-extra">Category:</div>
                      <div className="text-caption-1 text-text-primary">
                        {formatTextValue(doc.category)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="text-caption-1 text-text-extra">Sub-category:</div>
                      <div className="text-caption-1 text-text-primary">
                        {formatTextValue(doc.subcategory)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="text-caption-1 text-text-extra">Visit:</div>
                      <div className="text-caption-1 text-text-primary">
                        {formatTextValue(doc.visitType)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="text-caption-1 text-text-extra">Issue date:</div>
                      <div className="text-caption-1 text-text-primary">
                        {doc.issueDate
                          ? `${formatDateLabel(doc.issueDate)} ${formatTimeLabel(doc.issueDate)}`
                          : '-'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-card-border">
                    <div className="text-caption-1 text-text-secondary">
                      {getAttachmentSummary(doc)}
                    </div>
                    <Secondary
                      href="#"
                      onClick={() => handleDownload(doc.id)}
                      text="Open file"
                      className="w-auto min-w-[120px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PermissionGate>
  );
};

export default CompanionDocumentsSection;
