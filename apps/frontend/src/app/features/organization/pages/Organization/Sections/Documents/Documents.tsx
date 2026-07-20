import AccordionButton from '@/app/ui/primitives/Accordion/AccordionButton';
import React, { useEffect, useState } from 'react';
import { IoCreateOutline, IoDocumentTextOutline, IoEllipsisHorizontal } from 'react-icons/io5';
import AddDocument from '@/app/features/organization/pages/Organization/Sections/Documents/AddDocument';
import DocumentInfo from '@/app/features/organization/pages/Organization/Sections/Documents/DocumentInfo';
import { useDocumentsForPrimaryOrg } from '@/app/hooks/useDocuments';
import { OrganizationDocument } from '@/app/features/documents/types/document';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { toTitle } from '@/app/lib/validators';

const BADGE_BASE =
  'inline-flex items-center rounded-full border px-[9px] py-[3px] text-[9.5px] font-bold';
const BADGE_ESIGN =
  'bg-[var(--status-completed-bg)] text-[var(--status-completed-text)] border-[var(--status-completed-border)]';
const BADGE_FILE =
  'bg-[var(--status-upcoming-bg)] text-[var(--status-upcoming-text)] border-[var(--status-upcoming-border)]';

/**
 * The design colour-codes the two kinds of org document: green E-SIGN for in-app
 * templates and blue for a static upload. A document with no uploaded file is the
 * template case — there is nothing to download, it gets signed in the app.
 */
const getDocTypeBadge = (fileUrl?: string): { label: string; className: string } => {
  const url = String(fileUrl ?? '')
    .trim()
    .toLowerCase();
  if (!url) return { label: 'E-SIGN', className: BADGE_ESIGN };
  if (url.endsWith('.pdf')) return { label: 'PDF', className: BADGE_FILE };
  if (url.endsWith('.doc') || url.endsWith('.docx')) return { label: 'DOC', className: BADGE_FILE };
  return { label: 'FILE', className: BADGE_FILE };
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
        <div className="rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] overflow-hidden shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
          <div className="px-5! py-3! border-b border-[var(--hairline)] text-[11.5px] text-[var(--ink-faint)]">
            Clinic-wide templates and files
          </div>

          {documents.length === 0 ? (
            <div className="px-5! py-4! text-[13px] text-[var(--ink-faint)]">
              No documents yet. Add clinic-wide templates and files.
            </div>
          ) : (
            documents.map((document) => {
              const badge = getDocTypeBadge(document.fileUrl);
              const isTemplate = badge.label === 'E-SIGN';
              return (
                <div
                  key={document._id}
                  className="flex items-center gap-3 px-5! py-3! border-b border-[var(--hairline)]"
                >
                  <span className="shrink-0 flex items-center justify-center size-9 rounded-[11px] bg-[var(--blue-soft)] text-[var(--blue-text)]">
                    {isTemplate ? (
                      <IoCreateOutline size={16} />
                    ) : (
                      <IoDocumentTextOutline size={16} />
                    )}
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
                  <span className={`${BADGE_BASE} ${badge.className}`}>{badge.label}</span>
                  <button
                    type="button"
                    onClick={() => handleView(document)}
                    className="shrink-0 text-[var(--ink-faint)] hover:text-[var(--ink)]"
                    aria-label={`Actions for ${document.title}`}
                  >
                    <IoEllipsisHorizontal size={15} />
                  </button>
                </div>
              );
            })
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
