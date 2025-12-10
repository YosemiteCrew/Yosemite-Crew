import AccordionButton from "@/app/components/Accordion/AccordionButton";
import React, { useEffect, useState } from "react";
import { demoDocuments } from "../../demo";
import DocumentsTable from "@/app/components/DataTable/DocumentsTable";
import AddDocument from "./AddDocument";
import DocumentInfo from "./DocumentInfo";

const Documents = () => {
  const [documents] = useState(demoDocuments);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeDocument, setActiveDocument] = useState<any>(
    demoDocuments[0] ?? null
  );

  useEffect(() => {
    if (documents.length > 0) {
      setActiveDocument(documents[0]);
    } else {
      setActiveDocument(null);
    }
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
