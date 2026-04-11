import React, { useEffect, useState } from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Secondary } from '@/app/ui/primitives/Buttons';
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
import { toTitle } from '@/app/lib/validators';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { useOrgStore } from '@/app/stores/orgStore';
import CompanionDocumentUploadForm, {
  DocumentUploadFormErrors,
} from '@/app/features/documents/components/CompanionDocumentUploadForm';

type CompanionDocumentsSectionProps = {
  companionId: string;
};

const CompanionDocumentsSection = ({ companionId }: CompanionDocumentsSectionProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<CompanionRecord>(emptyCompanionRecord);
  const [formDataErrors, setFormDataErrors] = useState<DocumentUploadFormErrors>({});

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
    const errors: DocumentUploadFormErrors = {};
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
            <CompanionDocumentUploadForm
              companionId={companionId}
              formData={formData}
              setFormData={setFormData}
              file={file}
              setFile={setFile}
              formDataErrors={formDataErrors}
              onSave={handleSave}
            />
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
