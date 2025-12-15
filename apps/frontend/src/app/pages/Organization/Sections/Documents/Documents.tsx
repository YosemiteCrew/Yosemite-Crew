import AccordionButton from "@/app/components/Accordion/AccordionButton";
import React, { useEffect, useState } from "react";
import DocumentsTable from "@/app/components/DataTable/DocumentsTable";
import AddDocument from "./AddDocument";
import DocumentInfo from "./DocumentInfo";
import { useDocumentsForPrimaryOrg } from "@/app/hooks/useDocuments";
import { OrganizationDocument } from "@/app/types/document";

const Documents = () => {
  const documents = useDocumentsForPrimaryOrg();
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

  return (
    <>
      <AccordionButton
        title="Company documents"
        buttonTitle="Add"
        buttonClick={setAddPopup}
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
        />
      )}
    </>
  );
};

export default Documents;
