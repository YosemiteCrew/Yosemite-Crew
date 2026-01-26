import AccordionButton from "@/app/components/Accordion/AccordionButton";
import React, { useEffect, useState } from "react";
import DocumentsTable from "@/app/components/DataTable/DocumentsTable";
import AddDocument from "./AddDocument";
import DocumentInfo from "./DocumentInfo";
import { useDocumentsForPrimaryOrg } from "@/app/hooks/useDocuments";
import { OrganizationDocument } from "@/app/types/document";
import { usePermissions } from "@/app/hooks/usePermissions";
import { PERMISSIONS } from "@/app/utils/permissions";
import { PermissionGate } from "@/app/components/PermissionGate";

const Documents = () => {
  const documents = useDocumentsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditDocument = can(PERMISSIONS.DOCUMENT_EDIT_ANY);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeDocument, setActiveDocument] =
    useState<OrganizationDocument | null>(documents[0] ?? null);

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

  return (
    <PermissionGate allOf={[PERMISSIONS.DOCUMENT_VIEW_ANY]}>
      <AccordionButton
        title="Company documents"
        buttonTitle="Add"
        buttonClick={setAddPopup}
        showButton={canEditDocument}
      >
        <DocumentsTable
          filteredList={documents}
          setActive={setActiveDocument}
          setView={setViewPopup}
        />
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
