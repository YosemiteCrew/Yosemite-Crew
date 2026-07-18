import AccordionButton from '@/app/ui/primitives/Accordion/AccordionButton';
import React, { useEffect, useState } from 'react';
import { IoDocumentTextOutline, IoEllipsisHorizontal } from 'react-icons/io5';
import AddDocument from '@/app/features/organization/pages/Organization/Sections/Documents/AddDocument';
import DocumentInfo from '@/app/features/organization/pages/Organization/Sections/Documents/DocumentInfo';
import { useDocumentsForPrimaryOrg } from '@/app/hooks/useDocuments';
import { OrganizationDocument } from '@/app/features/documents/types/document';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { toTitle } from '@/app/lib/validators';

const getDocTypeLabel = (fileUrl?: string): string => {
  const url = String(fileUrl ?? '').toLowerCase();
  if (url.endsWith('.pdf')) return 'PDF';
  if (url.endsWith('.doc') || url.endsWith('.docx')) return 'DOC';
  return 'FILE';
};

const Documents = () => {
  const documents = useDocumentsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditDocument = can(PERMISSIONS.DOCUMENT_EDIT_ANY);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeDocument, setActiveDocument] = useState<OrganizationDocument | null>(
    documents[0] ?? null
  );

  useEffect(() => {
    setActiveDocument((prev) => {
      if (documents.length === 0) return null;
      if (prev?._id) {
        const updated = documents.find((s) => s._id === prev._id);
        if (updated) return updated;
      }
      return documents[0];
    });
  }, [documents]);

  const handleView = (document: OrganizationDocument) => {
    setActiveDocument(document);
    setViewPopup(true);
  };

  return (
    <PermissionGate allOf={[PERMISSIONS.DOCUMENT_VIEW_ANY]}>
      <AccordionButton
        title="Documents"
        buttonTitle="Add"
        buttonClick={setAddPopup}
        showButton={canEditDocument}
      >
        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] overflow-hidden">
          <div className="px-5! py-3! border-b border-[var(--hairline)] text-[11.5px] text-[var(--ink-faint)]">
            Clinic-wide templates and files
          </div>

          {documents.length === 0 ? (
            <div className="px-5! py-4! text-[13px] text-[var(--ink-faint)]">
              No documents yet. Add clinic-wide templates and files.
            </div>
          ) : (
            documents.map((document) => (
              <div
                key={document._id}
                className="flex items-center gap-3 px-5! py-3! border-b border-[var(--hairline)]"
              >
                <span className="shrink-0 flex items-center justify-center size-9 rounded-[11px] bg-[var(--blue-soft)] text-[var(--blue-text)]">
                  <IoDocumentTextOutline size={16} />
                </span>
                <button
                  type="button"
                  onClick={() => handleView(document)}
                  className="flex-1 min-w-0 text-left"
                  aria-label={`View ${document.title}`}
                >
                  <span className="block text-[13px] font-bold text-[var(--ink)] truncate">
                    {document.title}
                  </span>
                  <span className="block text-[11px] text-[var(--ink-faint)] truncate">
                    {toTitle(document.category)}
                    {document.description ? ` · ${document.description}` : ''}
                  </span>
                </button>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[9.5px] font-bold bg-[var(--status-upcoming-bg)] text-[var(--status-upcoming-text)] border border-[var(--status-upcoming-border)]">
                  {getDocTypeLabel(document.fileUrl)}
                </span>
                <button
                  type="button"
                  onClick={() => handleView(document)}
                  className="shrink-0 text-[var(--ink-faint)] hover:text-[var(--ink)]"
                  aria-label={`Actions for ${document.title}`}
                >
                  <IoEllipsisHorizontal size={15} />
                </button>
              </div>
            ))
          )}

          <div className="px-5! py-3! text-[11.5px] text-[var(--ink-faint)]">
            Templates support merge fields: patient, parent, visit, practitioner
          </div>
        </div>
      </AccordionButton>
      <AddDocument showModal={addPopup} setShowModal={setAddPopup} />
      {activeDocument && (
        <DocumentInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeDocument={activeDocument}
          canEditDocument={canEditDocument}
        />
      )}
    </PermissionGate>
  );
};

export default Documents;
